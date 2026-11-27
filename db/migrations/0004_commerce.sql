-- 0004 reservations, receipts (bills), orders, payments, notifications, email outbox

CREATE TABLE reservations (
  id                  TEXT PRIMARY KEY,
  list_item_id        TEXT NOT NULL REFERENCES list_items(id) ON DELETE CASCADE,
  guest_session_hash  TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','converted','released')),
  expires_at          INTEGER NOT NULL,
  created_at          INTEGER NOT NULL
);
CREATE INDEX idx_reservations_item ON reservations(list_item_id, status);
-- at most one active hold per list item
CREATE UNIQUE INDEX uq_reservations_active ON reservations(list_item_id) WHERE status = 'held';

-- The bill a guest sees after checkout. One receipt can cover orders from several shops.
CREATE TABLE receipts (
  id                 TEXT PRIMARY KEY,
  number             TEXT NOT NULL UNIQUE,     -- human readable, e.g. BWL-20261127-4F7K
  list_id            TEXT NOT NULL REFERENCES lists(id),
  kid_first_name     TEXT NOT NULL,            -- snapshot for the bill
  buyer_name         TEXT NOT NULL,
  buyer_email_enc    TEXT NOT NULL,
  greeting           TEXT,
  delivery_method    TEXT NOT NULL CHECK (delivery_method IN ('pickup','delivery')),
  delivery_address_enc TEXT,
  subtotal_agorot    INTEGER NOT NULL,         -- total before VAT
  vat_agorot         INTEGER NOT NULL,
  total_agorot       INTEGER NOT NULL,         -- VAT included
  vat_rate_bp        INTEGER NOT NULL DEFAULT 1700,  -- basis points
  access_token_hash  TEXT NOT NULL,
  created_at         INTEGER NOT NULL
);

CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  receipt_id    TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  shop_id       TEXT NOT NULL REFERENCES shops(id),
  number        TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','preparing','ready','shipped','done','cancelled')),
  total_agorot  INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_orders_shop ON orders(shop_id, created_at);
CREATE INDEX idx_orders_receipt ON orders(receipt_id);

CREATE TABLE order_items (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  list_item_id      TEXT NOT NULL REFERENCES list_items(id),
  product_id        TEXT NOT NULL REFERENCES products(id),
  title_snapshot    TEXT NOT NULL,
  price_agorot      INTEGER NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Payment attempts. Never stores card data: only the provider name and its reference.
CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  receipt_id    TEXT REFERENCES receipts(id),
  provider      TEXT NOT NULL,
  provider_ref  TEXT,
  amount_agorot INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'ILS',
  status        TEXT NOT NULL CHECK (status IN ('succeeded','failed','refunded')),
  created_at    INTEGER NOT NULL
);

-- In-app notifications (kid activity feed, shop alerts). Kid notifications never say who/what.
CREATE TABLE notifications (
  id             TEXT PRIMARY KEY,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('kid','shop','admin')),
  recipient_id   TEXT NOT NULL,
  kind           TEXT NOT NULL,          -- gift_bought | order_new | shop_pending ...
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  ref_id         TEXT,
  read_at        INTEGER,
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id, created_at);

-- Every email the system sends is recorded here (dev "outbox"; Resend in prod when configured).
CREATE TABLE email_outbox (
  id          TEXT PRIMARY KEY,
  to_enc      TEXT NOT NULL,
  to_hint     TEXT NOT NULL,            -- masked, e.g. n***@g***.com
  subject     TEXT NOT NULL,
  html        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('stored','sent','failed')),
  error       TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_outbox_created ON email_outbox(created_at);
