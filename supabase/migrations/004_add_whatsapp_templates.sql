-- Create whatsapp_templates table to store Meta WhatsApp Templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  waba_id TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL, -- APPROVED, PENDING, REJECTED
  components JSONB NOT NULL DEFAULT '{}', -- Raw template components from Meta API
  variable_count INT DEFAULT 0, -- Max number of variables ({{1}}, {{2}}, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(waba_id, name, language)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON whatsapp_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_waba_id ON whatsapp_templates(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_name ON whatsapp_templates(name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON whatsapp_templates(category);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at 
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

