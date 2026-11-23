"""Validate design artifacts; does not replace Docker or MySQL runtime checks.

Install scripts/requirements-design.txt in a virtualenv, or into .tools/python.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
local_tools = ROOT / '.tools' / 'python'
if local_tools.is_dir():
    sys.path.insert(0, str(local_tools))

import yaml
from openapi_spec_validator import validate


def load_yaml(path):
    # Reject duplicate mappings instead of silently accepting overwritten routes.
    class UniqueLoader(yaml.SafeLoader):
        pass

    def mapping(loader, node, deep=False):
        explicit = [key.value for key, _ in node.value if key.tag != 'tag:yaml.org,2002:merge']
        assert len(explicit) == len(set(explicit)), f'Duplicate YAML key in {path}'
        loader.flatten_mapping(node)
        return dict(loader.construct_pairs(node, deep=deep))

    UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
    return yaml.load(path.read_text(encoding='utf-8'), Loader=UniqueLoader)


api = load_yaml(ROOT / 'docs/openapi.yaml')
validate(api)
operations = [operation for item in api['paths'].values()
              for method, operation in item.items()
              if method in {'get', 'post', 'patch', 'delete', 'put'}]
operation_ids = [operation['operationId'] for operation in operations]
assert len(operation_ids) == len(set(operation_ids)), 'Duplicate operationId'
print(f'PASS: OpenAPI 3.1 specification, {len(api["paths"])} paths, {len(operations)} unique operations.')

compose = load_yaml(ROOT / 'compose.yaml')
services = compose['services']
active = {name: service for name, service in services.items() if not service.get('profiles')}
assert set(active) == {'database', 'backend', 'frontend', 'nginx', 'adminer'}
for name, service in active.items():
    assert 'healthcheck' in service, f'{name} has no healthcheck'
    if name not in {'nginx', 'frontend', 'adminer'}:
        assert not service.get('ports'), f'{name} unexpectedly publishes a port'
    build = service.get('build')
    if build:
        assert (ROOT / build['dockerfile']).is_file()
    for dependency, settings in service.get('depends_on', {}).items():
        assert dependency in active
        assert settings['condition'] == 'service_healthy'
assert 'postgres-data:/var/lib/postgresql/data' in services['database']['volumes']
assert services['test']['profiles'] == ['tools']
assert services['test']['environment']['DB_DATABASE'].endswith('_test')
assert active['nginx']['ports'] == ['127.0.0.1:${HTTP_PORT:-8080}:80', '127.0.0.1:${BACKEND_PORT:-8000}:8081']
assert active['frontend']['ports'] == ['127.0.0.1:${FRONTEND_PORT:-5173}:5173']
assert active['adminer']['ports'] == ['127.0.0.1:${DATABASE_ADMIN_PORT:-8888}:8080']
assert active['adminer']['environment']['ADMINER_DEFAULT_SERVER'] == 'database'
assert active['backend']['environment']['SESSION_DOMAIN'] == '${SESSION_DOMAIN:-}'
assert '127.0.0.1:${FRONTEND_PORT:-5173}' in active['backend']['environment']['SANCTUM_STATEFUL_DOMAINS']
print('PASS: Compose YAML, build paths, health dependencies, persistent volume and private service ports.')

sql = (ROOT / 'docs/schema.sql').read_text(encoding='utf-8')
tables = set(re.findall(r'CREATE TABLE (\w+)', sql))
assert len(tables) == 17
for reference in re.findall(r'REFERENCES (\w+)\(', sql):
    assert reference in tables, f'Unknown referenced table: {reference}'
print('PASS: SQL artifact table/reference inventory (not MySQL syntax/execution validation).')

for document in [ROOT / 'README.md', *sorted((ROOT / 'docs').rglob('*.md'))]:
    for link in re.findall(r'\]\(([^)]+)\)', document.read_text(encoding='utf-8')):
        if '://' in link or link.startswith('#'):
            continue
        target = link.split('#', 1)[0]
        assert (document.parent / target).exists(), f'Broken local link in {document}: {link}'
print('PASS: local Markdown document links.')
