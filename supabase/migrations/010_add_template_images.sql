-- Add image columns to whatsapp_templates table for storing up to 8 image URLs
ALTER TABLE whatsapp_templates
ADD COLUMN IF NOT EXISTS image1 TEXT,
ADD COLUMN IF NOT EXISTS image2 TEXT,
ADD COLUMN IF NOT EXISTS image3 TEXT,
ADD COLUMN IF NOT EXISTS image4 TEXT,
ADD COLUMN IF NOT EXISTS image5 TEXT,
ADD COLUMN IF NOT EXISTS image6 TEXT,
ADD COLUMN IF NOT EXISTS image7 TEXT,
ADD COLUMN IF NOT EXISTS image8 TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN whatsapp_templates.image1 IS 'First image URL for template (max 8 images per template)';
COMMENT ON COLUMN whatsapp_templates.image2 IS 'Second image URL for template';
COMMENT ON COLUMN whatsapp_templates.image3 IS 'Third image URL for template';
COMMENT ON COLUMN whatsapp_templates.image4 IS 'Fourth image URL for template';
COMMENT ON COLUMN whatsapp_templates.image5 IS 'Fifth image URL for template';
COMMENT ON COLUMN whatsapp_templates.image6 IS 'Sixth image URL for template';
COMMENT ON COLUMN whatsapp_templates.image7 IS 'Seventh image URL for template';
COMMENT ON COLUMN whatsapp_templates.image8 IS 'Eighth image URL for template';


