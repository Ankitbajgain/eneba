ARG PHP_IMAGE=php:8.3-fpm-bookworm
FROM ${PHP_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git unzip libicu-dev libzip-dev libonig-dev libfcgi-bin \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring intl zip bcmath opcache \
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
