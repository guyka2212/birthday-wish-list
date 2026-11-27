-- 0005 kid profile photo + quiz-generated guest-shop themes

-- Profile photo: a small JPEG (base64), AES-256-GCM encrypted like other personal data.
-- Shown only inside the kid's own app, never on public share pages.
ALTER TABLE users ADD COLUMN photo_enc TEXT;

-- Quiz answers that generated the list's theme, and the generated theme itself (JSON, see packages/shared/src/quiz.ts).
ALTER TABLE lists ADD COLUMN quiz_answers TEXT;
ALTER TABLE lists ADD COLUMN custom_theme TEXT;

-- lists.theme_id references themes(id); 'custom' means "use lists.custom_theme".
INSERT INTO themes (id, name_he, name_en, emoji, primary_hex, accent_hex, bg_hex, sort_order)
VALUES ('custom', 'עיצוב אישי', 'My own theme', '✨', '#3FA9F5', '#FFC93C', '#F2F8FF', 0);
