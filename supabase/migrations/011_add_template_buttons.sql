-- Add button columns to whatsapp_templates table for storing up to 2 buttons
ALTER TABLE whatsapp_templates
ADD COLUMN IF NOT EXISTS button1_text TEXT,
ADD COLUMN IF NOT EXISTS button1_type TEXT,
ADD COLUMN IF NOT EXISTS button1_url TEXT,
ADD COLUMN IF NOT EXISTS button1_phone TEXT,
ADD COLUMN IF NOT EXISTS button2_text TEXT,
ADD COLUMN IF NOT EXISTS button2_type TEXT,
ADD COLUMN IF NOT EXISTS button2_url TEXT,
ADD COLUMN IF NOT EXISTS button2_phone TEXT;

-- Add comments to document the purpose
COMMENT ON COLUMN whatsapp_templates.button1_text IS 'First button text (max 2 buttons per template)';
COMMENT ON COLUMN whatsapp_templates.button1_type IS 'First button type: URL or PHONE_NUMBER';
COMMENT ON COLUMN whatsapp_templates.button1_url IS 'First button URL (if type is URL)';
COMMENT ON COLUMN whatsapp_templates.button1_phone IS 'First button phone number (if type is PHONE_NUMBER)';
COMMENT ON COLUMN whatsapp_templates.button2_text IS 'Second button text';
COMMENT ON COLUMN whatsapp_templates.button2_type IS 'Second button type: URL or PHONE_NUMBER';
COMMENT ON COLUMN whatsapp_templates.button2_url IS 'Second button URL (if type is URL)';
COMMENT ON COLUMN whatsapp_templates.button2_phone IS 'Second button phone number (if type is PHONE_NUMBER)';


