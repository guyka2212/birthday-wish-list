-- 0007 kid photo in the guest shop (per-list switch) + "order details" wording

-- Show the kid's profile photo on this list's public gift shop. On by default; the kid/parent can turn it off per list.
ALTER TABLE lists ADD COLUMN show_photo INTEGER NOT NULL DEFAULT 1;

-- "קבלה" is now called "פרטי ההזמנה". Update the default template only if the admin never edited it.
UPDATE email_templates
SET body = replace(body, 'לקבלה המלאה: {{receiptLink}}', 'לפרטי ההזמנה המלאים: {{receiptLink}}')
WHERE key = 'set_aside' AND updated_at = 0;
