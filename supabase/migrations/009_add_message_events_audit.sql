-- Create message_events table for audit logging
CREATE TABLE IF NOT EXISTS message_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- 'send', 'inbound', 'disconnect', etc.
  metadata JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_message_events_event_type ON message_events(event_type);
CREATE INDEX IF NOT EXISTS idx_message_events_timestamp ON message_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_message_events_success ON message_events(success);

-- Add comment
COMMENT ON TABLE message_events IS 'Audit log for WhatsApp message events from wa-bridge service';



