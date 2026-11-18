-- Per-user language preference.
ALTER TABLE users ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es'));

-- Prayers sent from a prayer request are now marked by template instead of
-- stored English text, so the app can show them in the reader's language.
UPDATE encouragements SET template_id = 'request', text = ''
 WHERE type = 'prayer' AND text = 'is praying for your request';
