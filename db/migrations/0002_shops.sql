-- 0002 shops, API keys, products, stock

CREATE TABLE shops (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  business_id_enc  TEXT NOT NULL,
  address_enc      TEXT NOT NULL,
  city             TEXT NOT NULL,             -- public, for "pickup in <city>"
  phone_enc        TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  email_enc        TEXT NOT NULL,
  email_hash       TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  logo_url         TEXT,
  brand_color      TEXT NOT NULL DEFAULT '#3FA9F5',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  pickup_info      TEXT,                      -- e.g. opening hours shown on the bill
  offers_delivery  INTEGER NOT NULL DEFAULT 0,
  webhook_url      TEXT,
  webhook_secret_enc TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  approved_at      INTEGER
);

CREATE TABLE shop_api_keys (
  id           TEXT PRIMARY KEY,
  shop_id      TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  prefix       TEXT NOT NULL,                 -- first chars, shown in the dashboard
  key_hash     TEXT NOT NULL UNIQUE,          -- sha256 of the full key
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at   INTEGER
);
CREATE INDEX idx_api_keys_shop ON shop_api_keys(shop_id);

CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  shop_id       TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  external_sku  TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL CHECK (category IN ('toys','books','lego','sports','art','games','other')),
  price_agorot  INTEGER NOT NULL CHECK (price_agorot >= 0),   -- VAT included
  image_url     TEXT,
  age_min       INTEGER,
  age_max       INTEGER,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (shop_id, external_sku)
);
CREATE INDEX idx_products_shop ON products(shop_id);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE stock (
  product_id  TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  INTEGER NOT NULL
);
