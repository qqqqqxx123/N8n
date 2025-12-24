-- Add default setting for inbound webhook URL
INSERT INTO settings (key, value) VALUES
  ('n8n_webhook_inbound_url', '{"url": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
