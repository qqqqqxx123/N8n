-- WhatsApp Protection Settings
-- Store protection configuration and quotas

CREATE TABLE IF NOT EXISTS whatsapp_protection_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default protection settings
INSERT INTO whatsapp_protection_settings (key, value)
VALUES (
  'protection_config',
  '{
    "maxMessagesPerDay": 1000,
    "maxMessagesPerHour": 100,
    "minHoursBetweenMessages": 0,
    "maxMessagesPerContactPerDay": 999999,
    "minDelayBetweenMessages": 2000,
    "enforce24HourWindow": false
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Track daily message counts for quota management
CREATE TABLE IF NOT EXISTS whatsapp_daily_stats (
  date DATE PRIMARY KEY,
  messages_sent INT DEFAULT 0,
  messages_failed INT DEFAULT 0,
  rate_limit_hits INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track per-contact message frequency
CREATE INDEX IF NOT EXISTS idx_messages_contact_date ON messages(contact_id, direction, created_at) 
WHERE direction = 'out';

-- Function to get or create daily stats
CREATE OR REPLACE FUNCTION get_or_create_daily_stats(target_date DATE)
RETURNS whatsapp_daily_stats AS $$
DECLARE
  stats whatsapp_daily_stats;
BEGIN
  SELECT * INTO stats FROM whatsapp_daily_stats WHERE date = target_date;
  
  IF NOT FOUND THEN
    INSERT INTO whatsapp_daily_stats (date, messages_sent, messages_failed, rate_limit_hits)
    VALUES (target_date, 0, 0, 0)
    RETURNING * INTO stats;
  END IF;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;

