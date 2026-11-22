"""Download public promotional artwork for the internship reference demo.

Source URLs are recorded in docs/assets.md. No production data is scraped.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import urllib.request

root = Path(__file__).resolve().parent.parent
entries = json.loads((root / 'backend/database/seeders/data/catalog.json').read_text(encoding='utf-8'))
destination = root / 'frontend/public/images/games'
destination.mkdir(parents=True, exist_ok=True)


def download(entry):
    target = destination / (entry['slug'] + '.jpg')
    url = f"https://cdn.akamai.steamstatic.com/steam/apps/{entry['steam_app_id']}/library_600x900.jpg"
    if not target.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            data = response.read()
        if not data.startswith(b'\xff\xd8'):
            raise ValueError('Expected JPEG promotional artwork: ' + entry['slug'])
        target.write_bytes(data)
    return f"- {entry['title']}: [Steam promotional artwork]({url})"


with ThreadPoolExecutor(max_workers=6) as pool:
    sources = list(pool.map(download, entries))

hero = root / 'frontend/public/images/hero.jpg'
url = 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_hero.jpg'
if not hero.exists():
    with urllib.request.urlopen(url, timeout=40) as response:
        hero.write_bytes(response.read())

(root / 'docs/assets.md').write_text(
    '# Demo artwork sources\n\nPromotional game artwork is used in this non-commercial internship reference demo. '
    'Game titles/artwork belong to their respective publishers; demo offers, sellers, prices and keys are fictional. '
    'Files are stored locally so application rendering does not depend on live scraping. '
    'Do not treat this record as a license for commercial redistribution.\n\n'
    + '\n'.join(sources) + f'\n- Homepage campaign: [ELDEN RING promotional hero]({url})\n', encoding='utf-8')
print(f'Downloaded/verified {len(entries)} covers and one campaign image.')
