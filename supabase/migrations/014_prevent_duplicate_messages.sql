-- Prevent duplicate inbound messages by adding unique constraint
-- This ensures that the same provider_message_id cannot be inserted twice for the same phone and direction

-- First, remove any existing duplicate messages (keep the first one)
DELETE FROM messages m1
WHERE EXISTS (
  SELECT 1 FROM messages m2
  WHERE m2.provider_message_id = m1.provider_message_id
    AND m2.direction = m1.direction
    AND m2.phone_e164 = m1.phone_e164
    AND m2.id < m1.id
    AND m2.provider_message_id IS NOT NULL
    AND m2.direction = 'in'
);

-- Create unique index to prevent duplicates
-- Only applies to messages with provider_message_id (inbound messages from providers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_unique_provider_id 
ON messages (provider_message_id, direction, phone_e164)
WHERE provider_message_id IS NOT NULL AND direction = 'in';

-- Add comment
COMMENT ON INDEX idx_messages_unique_provider_id IS 'Prevents duplicate inbound messages with the same provider_message_id, direction, and phone_e164';

