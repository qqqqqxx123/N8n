-- Create storage bucket for WhatsApp template images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-templates',
  'whatsapp-templates',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for public read access
CREATE POLICY IF NOT EXISTS "Public read access for whatsapp-templates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'whatsapp-templates');

-- Allow public uploads (server-side with service role key)
CREATE POLICY IF NOT EXISTS "Public can upload whatsapp-templates"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-templates');

-- Allow public updates
CREATE POLICY IF NOT EXISTS "Public can update whatsapp-templates"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'whatsapp-templates');

-- Allow public deletes
CREATE POLICY IF NOT EXISTS "Public can delete whatsapp-templates"
ON storage.objects
FOR DELETE
USING (bucket_id = 'whatsapp-templates');

