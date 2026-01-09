-- Add WhatsApp connection status table
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'not_connected', -- not_connected, qr_pending, connected, expired
  qr_code_data TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  session_id TEXT UNIQUE,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status ON whatsapp_connections(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_session_id ON whatsapp_connections(session_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_whatsapp_connections_updated_at 
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add phone_e164 column to messages table if it doesn't exist (for linking messages without contact_id)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

-- Create index for phone-based message queries
CREATE INDEX IF NOT EXISTS idx_messages_phone_e164 ON messages(phone_e164);




