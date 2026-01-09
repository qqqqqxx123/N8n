-- Add is_custom field to distinguish custom templates from Meta templates
ALTER TABLE whatsapp_templates
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

-- Make waba_id nullable for custom templates (Meta templates require it)
ALTER TABLE whatsapp_templates
ALTER COLUMN waba_id DROP NOT NULL;

-- Update unique constraint to allow custom templates without waba_id
-- First, drop the existing unique constraint if it exists
ALTER TABLE whatsapp_templates
DROP CONSTRAINT IF EXISTS whatsapp_templates_waba_id_name_language_key;

-- Add new unique constraint that allows null waba_id for custom templates
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_templates_unique 
ON whatsapp_templates (COALESCE(waba_id, ''), name, language)
WHERE is_custom = false;

-- For custom templates, ensure name+language is unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_templates_custom_unique
ON whatsapp_templates (name, language)
WHERE is_custom = true;

-- Create index for custom templates
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_is_custom ON whatsapp_templates(is_custom);



