-- Enhance messages table for WhatsApp-like messaging
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS body TEXT,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

-- Create index for unread messages query performance
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(contact_id, is_read, direction) WHERE is_read = false AND direction = 'in';
CREATE INDEX IF NOT EXISTS idx_messages_contact_created ON messages(contact_id, created_at DESC);

-- Create index for conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(contact_id, direction, created_at DESC);

