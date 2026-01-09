-- Allow nullable contact_id in messages table to handle cases where contact doesn't exist yet
-- Also add phone_e164 to messages for linking messages to contacts

-- First, drop the foreign key constraint temporarily
ALTER TABLE messages 
  DROP CONSTRAINT IF EXISTS messages_contact_id_fkey;

-- Make contact_id nullable
ALTER TABLE messages 
  ALTER COLUMN contact_id DROP NOT NULL;

-- Add phone_e164 column to messages for linking
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

-- Re-add the foreign key constraint but allow NULL
ALTER TABLE messages 
  ADD CONSTRAINT messages_contact_id_fkey 
  FOREIGN KEY (contact_id) 
  REFERENCES contacts(id) 
  ON DELETE CASCADE;

-- Create index on phone_e164 for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_phone_e164 ON messages(phone_e164);

-- Create function to link orphaned messages to contacts by phone number
CREATE OR REPLACE FUNCTION link_messages_to_contacts()
RETURNS void AS $$
BEGIN
  UPDATE messages m
  SET contact_id = c.id
  FROM contacts c
  WHERE m.contact_id IS NULL
    AND m.phone_e164 IS NOT NULL
    AND c.phone_e164 = m.phone_e164;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to auto-link messages when a contact is created
CREATE OR REPLACE FUNCTION auto_link_messages_on_contact_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Link any orphaned messages with matching phone number
  UPDATE messages
  SET contact_id = NEW.id
  WHERE contact_id IS NULL
    AND phone_e164 = NEW.phone_e164;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-link messages when contact is inserted
CREATE TRIGGER trigger_auto_link_messages_on_contact_insert
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_messages_on_contact_insert();

-- Set default value for direction column (default to 'in' for inbound messages)
ALTER TABLE messages 
  ALTER COLUMN direction SET DEFAULT 'in';

-- Set default value for status column (default to 'delivered' for inbound messages)
ALTER TABLE messages 
  ALTER COLUMN status SET DEFAULT 'delivered';

-- Add comment to document the nullable contact_id
COMMENT ON COLUMN messages.contact_id IS 'Can be NULL temporarily if contact does not exist yet. Should be populated via phone_e164 lookup.';
COMMENT ON COLUMN messages.phone_e164 IS 'Phone number in E.164 format. Used to link messages to contacts when contact_id is NULL.';
COMMENT ON COLUMN messages.direction IS 'Message direction: in (inbound) or out (outbound). Defaults to in.';
COMMENT ON COLUMN messages.status IS 'Message status: sent/delivered/failed/read. Defaults to delivered.';

