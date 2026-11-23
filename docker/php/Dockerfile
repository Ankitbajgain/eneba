ARG PHP_IMAGE=php:8.3-fpm-bookworm
ARG NODE_IMAGE=node:slim
FROM ${NODE_IMAGE} AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ${PHP_IMAGE} AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git unzip libicu-dev libzip-dev libonig-dev libfcgi-bin libpq-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql pdo_pgsql mbstring intl zip bcmath opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/marketplace.ini
COPY docker/php/zz-marketplace.conf /usr/local/etc/php-fpm.d/zz-marketplace.conf
COPY docker/php/healthcheck.sh /usr/local/bin/fpm-healthcheck
COPY docker/php/entrypoint.sh /usr/local/bin/marketplace-entrypoint
RUN chmod +x /usr/local/bin/fpm-healthcheck /usr/local/bin/marketplace-entrypoint

WORKDIR /var/www/backend
ENTRYPOINT ["marketplace-entrypoint"]
CMD ["php-fpm", "-F"]

FROM base AS development

FROM base AS production
ENV APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr CACHE_STORE=database CACHE_LIMITER=database SESSION_DRIVER=database SESSION_SECURE_COOKIE=true
COPY backend/ /var/www/backend/
RUN composer install --no-dev --no-interaction --prefer-dist --classmap-authoritative --no-scripts \
    && php artisan package:discover --ansi \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
COPY docker/php/production.ini /usr/local/etc/php/conf.d/zz-production.ini
COPY docker/php/production-pool.conf /usr/local/etc/php-fpm.d/zzz-production.conf
COPY --chmod=755 docker/php/production-entrypoint.sh /usr/local/bin/production-entrypoint
USER www-data
ENTRYPOINT ["production-entrypoint"]
CMD ["php-fpm", "-F"]

FROM production AS vercel
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor gettext-base \
    && rm -rf /var/lib/apt/lists/*
COPY --from=frontend-build /workspace/frontend/dist /usr/share/nginx/html
COPY docker/nginx/production.conf.template /etc/nginx/marketplace.conf.template
COPY docker/vercel/nginx.conf /etc/nginx/nginx-vercel.conf
COPY docker/vercel/supervisord.conf /etc/supervisor/marketplace.conf
COPY --chmod=755 docker/vercel/entrypoint.sh /usr/local/bin/vercel-entrypoint
ENV PORT=8080 PHP_FPM_UPSTREAM=127.0.0.1:9000
USER www-data
ENTRYPOINT ["vercel-entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisor/marketplace.conf"]
EXPOSE 8080

# The same HTTP image is portable to Render; keep explicit build targets.
FROM vercel AS render
