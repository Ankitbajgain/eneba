-- MySQL marketplace domain schema, applied by the versioned migration.

CREATE TABLE sellers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  rating_hundredths SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CHECK (rating_hundredths <= 500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  cover_url VARCHAR(2048) NOT NULL,
  release_date DATE NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  INDEX products_public_title (is_published, title, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE platforms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE regions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  activation_note TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  platform_id BIGINT UNSIGNED NOT NULL,
  region_id BIGINT UNSIGNED NOT NULL,
  price_minor INT UNSIGNED NOT NULL,
  reference_price_minor INT UNSIGNED NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY offers_identity (product_id, seller_id, platform_id, region_id),
  INDEX offers_filter (is_active, platform_id, region_id, price_minor, product_id),
  INDEX offers_product_price (product_id, is_active, price_minor),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (platform_id) REFERENCES platforms(id),
  FOREIGN KEY (region_id) REFERENCES regions(id),
  CHECK (price_minor BETWEEN 1 AND 10000000),
  CHECK (reference_price_minor IS NULL OR reference_price_minor >= price_minor),
  CHECK (currency = 'EUR')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE carts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT UNSIGNED NOT NULL,
  offer_id BIGINT UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  observed_price_minor INT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY cart_offer (cart_id, offer_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  CHECK (quantity BETWEEN 1 AND 10),
  CHECK (observed_price_minor BETWEEN 1 AND 10000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  total_minor BIGINT UNSIGNED NOT NULL,
  idempotency_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  fulfilled_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY order_idempotency (user_id, idempotency_key),
  INDEX orders_history (user_id, created_at, id),
  INDEX orders_bestsellers (status, fulfilled_at, id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  CHECK (status IN ('fulfilled', 'failed')),
  CHECK (currency = 'EUR'),
  CHECK (total_minor > 0),
  CHECK ((status = 'fulfilled' AND fulfilled_at IS NOT NULL)
      OR (status = 'failed' AND fulfilled_at IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  offer_id BIGINT UNSIGNED NOT NULL,
  product_title VARCHAR(255) NOT NULL,
  seller_name VARCHAR(120) NOT NULL,
  platform_name VARCHAR(100) NOT NULL,
  region_name VARCHAR(100) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_price_minor INT UNSIGNED NOT NULL,
  line_total_minor BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  CHECK (quantity BETWEEN 1 AND 10),
  CHECK (unit_price_minor BETWEEN 1 AND 10000000),
  CHECK (line_total_minor = quantity * unit_price_minor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE digital_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  encrypted_value TEXT NOT NULL,
  fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  order_item_id BIGINT UNSIGNED NULL,
  sold_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  INDEX keys_inventory (offer_id, order_item_id, id),
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CHECK ((order_item_id IS NULL AND sold_at IS NULL)
      OR (order_item_id IS NOT NULL AND sold_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  provider VARCHAR(30) NOT NULL DEFAULT 'simulated',
  reference CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  created_at DATETIME(6) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  CHECK (provider = 'simulated'),
  CHECK (status IN ('succeeded', 'declined')),
  CHECK (amount_minor > 0),
  CHECK (currency = 'EUR')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE homepage_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  block_key VARCHAR(80) NOT NULL UNIQUE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(150) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME(6) NULL,
  ends_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  INDEX homepage_order (is_enabled, position, id),
  CHECK (type IN ('banner', 'best_sellers', 'deals')),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE banners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  homepage_block_id BIGINT UNSIGNED NOT NULL,
  heading VARCHAR(150) NOT NULL,
  subheading VARCHAR(255) NULL,
  image_url VARCHAR(2048) NOT NULL,
  target_path VARCHAR(255) NOT NULL,
  cta_label VARCHAR(80) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  starts_at DATETIME(6) NULL,
  ends_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  INDEX banners_block (homepage_block_id, position, id),
  FOREIGN KEY (homepage_block_id) REFERENCES homepage_blocks(id),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_search_grams (
  gram VARCHAR(3) NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (gram, product_id),
  INDEX grams_product (product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
