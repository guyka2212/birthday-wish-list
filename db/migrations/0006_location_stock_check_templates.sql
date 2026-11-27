-- 0006 kid location, shop stock-check flow, admin-editable email templates

-- The kid's city (id from packages/shared/src/cities.ts), encrypted like other personal data.
ALTER TABLE users ADD COLUMN city_enc TEXT;

-- Stock-check flow: "new" = waiting for the shop to check stock, "ready" = set aside for the buyer,
-- "cancelled" with decline_reason='unavailable' = not in stock (refunded, gift back on the list).
ALTER TABLE orders ADD COLUMN decline_reason TEXT;
ALTER TABLE orders ADD COLUMN responded_at INTEGER;
ALTER TABLE orders ADD COLUMN buyer_notified_at INTEGER;
ALTER TABLE orders ADD COLUMN buyer_notified_count INTEGER NOT NULL DEFAULT 0;

-- Receipt link token, encrypted, so the shop's email can include the buyer's receipt link.
ALTER TABLE receipts ADD COLUMN access_token_enc TEXT;

-- Email templates the admin edits. Placeholders look like {{orderNumber}}; values are HTML-escaped when sent.
CREATE TABLE email_templates (
  key        TEXT PRIMARY KEY,           -- set_aside | unavailable
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,              -- plain text with placeholders; line breaks are kept
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

INSERT INTO email_templates (key, subject, body, updated_at) VALUES
('set_aside',
 'המתנה ל{{kidName}} שמורה בשבילך! 🎁 (הזמנה {{orderNumber}})',
 'שלום {{buyerName}},

יש לנו חדשות טובות! בדקנו והמתנה במלאי — שמרנו אותה בצד במיוחד בשבילך:
{{items}}

מספר הזמנה: {{orderNumber}}
סה״כ: {{total}}
תאריך ההזמנה: {{date}}

איפה אוספים: {{shopName}}, {{shopAddress}}
טלפון: {{shopPhone}}
שעות איסוף: {{pickupInfo}}

לקבלה המלאה: {{receiptLink}}

תודה, ויום הולדת שמח ל{{kidName}}! 🎂
צוות {{shopName}}',
 0),
('unavailable',
 'עדכון לגבי הזמנה {{orderNumber}}',
 'שלום {{buyerName}},

לצערנו המתנה שבחרת אזלה מהמלאי ב{{shopName}}:
{{items}}

ההזמנה בוטלה והתשלום ({{total}}) הוחזר במלואו.
המתנה חזרה לרשימה של {{kidName}}, ואפשר לבחור מתנה אחרת כאן:
{{listLink}}

מצטערים על אי הנוחות,
צוות {{shopName}}',
 0);
