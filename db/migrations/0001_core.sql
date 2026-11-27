-- 0001 core: kids, parent consent, admins, auth tokens, audit, rate limits
-- All timestamps are unix epoch milliseconds (INTEGER).
-- Columns ending in _enc hold AES-256-GCM ciphertext ("v1:<iv>:<ct>"); *_hash hold HMAC/SHA-256 hex.

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL,                -- display name shown in the app (not public)
  first_name      TEXT NOT NULL,                -- the only name shown on public pages
  email_enc       TEXT NOT NULL,
  email_hash      TEXT NOT NULL UNIQUE,         -- blind index for login lookup
  password_hash   TEXT NOT NULL,                -- argon2id
  birthday        TEXT,                         -- YYYY-MM-DD (never shown publicly)
  avatar          TEXT NOT NULL DEFAULT '🦄',   -- emoji avatar
  locale          TEXT NOT NULL DEFAULT 'he',
  consent_status  TEXT NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending','verified')),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE TABLE parent_consents (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_email_enc  TEXT NOT NULL,
  parent_email_hash TEXT NOT NULL,
  token_hash        TEXT NOT NULL UNIQUE,
  verified_at       INTEGER,
  expires_at        INTEGER NOT NULL,
  created_at        INTEGER NOT NULL
);
CREATE INDEX idx_parent_consents_user ON parent_consents(user_id);

CREATE TABLE admins (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email_enc     TEXT NOT NULL,
  email_hash    TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

-- Refresh tokens for kids, shops and admins (opaque, stored as sha256, rotated on use)
CREATE TABLE refresh_tokens (
  id            TEXT PRIMARY KEY,
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('kid','shop','admin')),
  subject_id    TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    INTEGER NOT NULL,
  revoked_at    INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_refresh_subject ON refresh_tokens(subject_type, subject_id);

CREATE TABLE password_resets (
  id            TEXT PRIMARY KEY,
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('kid','shop','admin')),
  subject_id    TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    INTEGER NOT NULL,
  used_at       INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id          TEXT PRIMARY KEY,
  actor_type  TEXT NOT NULL,      -- kid | shop | admin | guest | system | api_key
  actor_id    TEXT,
  action      TEXT NOT NULL,      -- e.g. auth.login, list.create, order.status
  target_type TEXT,
  target_id   TEXT,
  meta        TEXT,               -- small JSON, never secrets or PII
  ip_hash     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_audit_created ON audit_log(created_at);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
