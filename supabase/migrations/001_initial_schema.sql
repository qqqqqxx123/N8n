-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT,
  phone_e164 TEXT UNIQUE NOT NULL,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  opt_in_status BOOLEAN DEFAULT false,
  opt_in_timestamp TIMESTAMPTZ NULL,
  opt_in_source TEXT NULL,
  last_purchase_at TIMESTAMPTZ NULL,
  total_spend NUMERIC DEFAULT 0,
  interest_type TEXT NULL, -- engagement/wedding/fashion
  DOB DATE NULL, -- Date of Birth
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- csv_import/purchase/inquiry/whatsapp_inbound/whatsapp_outbound
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores table
CREATE TABLE scores (
  contact_id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  score INT DEFAULT 0,
  segment TEXT NOT NULL, -- hot/warm/cold
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- in/out
  template_name TEXT NULL,
  status TEXT NOT NULL, -- sent/delivered/failed/read
  provider_message_id TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table for n8n webhook URL, templates, and scoring weights
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contacts_phone_e164 ON contacts(phone_e164);
CREATE INDEX idx_contacts_opt_in_status ON contacts(opt_in_status);
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_events_contact_id ON events(contact_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_scores_segment ON scores(segment);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_status ON messages(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on contacts
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('n8n_webhook_url', '{"url": "", "secret": ""}'::jsonb),
  ('whatsapp_templates', '[]'::jsonb),
  ('scoring_weights', '{
    "inquiry_recent": 30,
    "interest_type_engagement": 20,
    "interest_type_wedding": 20,
    "high_spend": 15,
    "ring_size_known": 10,
    "recent_purchase_penalty": -25,
    "opt_out_penalty": -100
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;


