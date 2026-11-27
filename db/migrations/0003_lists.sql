-- 0003 themes, lists, list items, share links

CREATE TABLE themes (
  id          TEXT PRIMARY KEY,              -- space | unicorn | football | dinosaurs | ocean | gaming
  name_he     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  primary_hex TEXT NOT NULL,
  accent_hex  TEXT NOT NULL,
  bg_hex      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO themes (id, name_he, name_en, emoji, primary_hex, accent_hex, bg_hex, sort_order) VALUES
  ('space',     'חלל',      'Space',     '🚀', '#4C3BCF', '#FFD23F', '#0F0C29', 1),
  ('unicorn',   'חד-קרן',   'Unicorn',   '🦄', '#E056FD', '#7FE7DC', '#FFF0FB', 2),
  ('football',  'כדורגל',   'Football',  '⚽', '#1B9C4B', '#FFFFFF', '#E9F9EE', 3),
  ('dinosaurs', 'דינוזאורים','Dinosaurs', '🦖', '#6AA121', '#FF8C42', '#F3FBE6', 4),
  ('ocean',     'אוקיינוס', 'Ocean',     '🌊', '#0077B6', '#00F5D4', '#E6F7FF', 5),
  ('gaming',    'גיימינג',  'Gaming',    '🎮', '#7B2FF7', '#00E5FF', '#14101F', 6);

CREATE TABLE lists (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  birthday     TEXT,                          -- YYYY-MM-DD party/birthday date for the countdown
  theme_id     TEXT NOT NULL DEFAULT 'unicorn' REFERENCES themes(id),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER
);
CREATE INDEX idx_lists_user ON lists(user_id);

CREATE TABLE list_items (
  id            TEXT PRIMARY KEY,
  list_id       TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id),
  status        TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','purchased')),
  purchased_at  INTEGER,
  created_at    INTEGER NOT NULL,
  UNIQUE (list_id, product_id)
);
CREATE INDEX idx_list_items_list ON list_items(list_id);

CREATE TABLE share_links (
  id          TEXT PRIMARY KEY,
  list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,           -- 22 random base62 chars
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);
CREATE INDEX idx_share_links_list ON share_links(list_id);
