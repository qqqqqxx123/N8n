# WhatsApp Account Protection Guide

This CRM includes comprehensive protection mechanisms to prevent Meta from banning your WhatsApp account.

## Protection Features

### 1. **Daily & Hourly Quotas**
- **Daily Limit**: 1000 messages per day (configurable)
- **Hourly Limit**: 100 messages per hour (configurable)
- Automatically tracks and enforces limits
- Prevents exceeding Meta's rate limits

### 2. **Per-Contact Frequency Limits** (Currently Disabled)
- ~~**Minimum 1 hour** between messages to the same contact~~ (Disabled)
- ~~**Maximum 3 messages** per contact per day~~ (Disabled)
- Can be re-enabled by updating protection settings if needed

### 3. **24-Hour Window Compliance** (Currently Disabled)
- ~~Enforces Meta's 24-hour messaging window~~ (Disabled)
- ~~**Template messages**: Always allowed (outside 24h window)~~ (Disabled)
- ~~**Free-form messages**: Only allowed within 24h window~~ (Disabled)
- **Current behavior**: Can send any message type anytime, regardless of 24-hour window
- ⚠️ **Warning**: Disabling this may violate Meta's policies and could result in account restrictions

### 4. **Message Spacing**
- **Minimum 2 seconds** delay between messages
- Prevents rapid-fire sending that triggers spam detection
- Configurable via `MIN_DELAY_BETWEEN_MESSAGES_MS` environment variable

### 5. **Error Handling & Backoff**
- Detects Meta rate limit errors (429)
- Detects ban warnings
- Automatic exponential backoff on errors
- Prevents further violations when issues occur

### 6. **Message Queue Protection**
- Built-in delays in message queue
- Respects rate limits automatically
- Prevents overwhelming Meta's API

## Configuration

### Environment Variables

**wa-bridge/.env:**
```env
# Message queue delays
MIN_DELAY_BETWEEN_MESSAGES_MS=2000  # 2 seconds between messages

# Retry settings
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minute window
RATE_LIMIT_MAX_REQUESTS=20  # Max 20 requests per minute
```

### Database Settings

Protection settings are stored in `whatsapp_protection_settings` table:

```sql
-- View current settings
SELECT * FROM whatsapp_protection_settings WHERE key = 'protection_config';

-- Update settings (example: increase daily limit to 5000)
UPDATE whatsapp_protection_settings
SET value = jsonb_set(
  value,
  '{maxMessagesPerDay}',
  '5000'::jsonb
)
WHERE key = 'protection_config';
```

## Default Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `maxMessagesPerDay` | 1000 | Maximum messages per day |
| `maxMessagesPerHour` | 100 | Maximum messages per hour |
| `minHoursBetweenMessages` | 0 | Minimum hours between messages to same contact (0 = disabled) |
| `maxMessagesPerContactPerDay` | 999999 | Maximum messages per contact per day (999999 = effectively unlimited) |
| `minDelayBetweenMessages` | 2000ms | Minimum delay between any messages (2 seconds) |
| `enforce24HourWindow` | false | Enforce Meta's 24-hour window (currently disabled) |

## How It Works

### Single Message Sending (`/api/messages/[contactId]`)

Before sending, the system checks:
1. ✅ Daily quota (haven't exceeded daily limit)
2. ✅ Hourly quota (haven't exceeded hourly limit)
3. ✅ Contact frequency (currently disabled - no per-contact limits)
4. ✅ 24-hour window (currently disabled - can send anytime)

If any check fails, the message is **blocked** with a detailed error message.

### Campaign Sending (`/api/campaigns/trigger`)

Before sending a campaign:
1. ✅ Checks global daily/hourly quotas
2. ✅ Filters out contacts that don't meet frequency limits
3. ✅ Filters out contacts that violate 24-hour window
4. ✅ Only sends to eligible contacts

### Message Queue (wa-bridge)

The message queue automatically:
- Adds delays between messages (2 seconds minimum)
- Respects rate limits
- Handles retries with exponential backoff
- Prevents rapid-fire sending

## Error Responses

When protection limits are exceeded, you'll receive detailed error responses:

```json
{
  "error": "Cannot send message - protection limits exceeded",
  "reasons": [
    "Daily quota exceeded (1000/1000)",
    "Minimum 1 hours between messages not met (0.5 hours since last message)"
  ],
  "details": {
    "dailyQuota": {
      "sent": 1000,
      "limit": 1000,
      "remaining": 0
    },
    "hourlyQuota": {
      "sent": 100,
      "limit": 100,
      "remaining": 0
    },
    "contactFrequency": {
      "messagesToday": 3,
      "lastMessageAt": "2024-01-15T10:00:00Z"
    },
    "window24h": {
      "inWindow": false,
      "canSendFreeForm": false
    }
  }
}
```

## Best Practices

### 1. **Start Conservative**
- Begin with default limits (1000/day)
- Monitor for Meta warnings
- Gradually increase if account is verified and stable

### 2. **Monitor Daily Stats**
```sql
-- Check today's message count
SELECT * FROM whatsapp_daily_stats WHERE date = CURRENT_DATE;

-- Check messages sent today
SELECT COUNT(*) FROM messages 
WHERE direction = 'out' 
AND DATE(created_at) = CURRENT_DATE;
```

### 3. **Respect 24-Hour Window**
- Always use templates for initial outreach
- Only send free-form messages after contact responds
- System automatically enforces this

### 4. **Space Out Campaigns**
- Don't send multiple campaigns to same contacts
- Wait at least 1 hour between messages
- System enforces this automatically

### 5. **Handle Errors Gracefully**
- If you get rate limit errors, wait before retrying
- System automatically backs off on errors
- Don't manually retry immediately

## Increasing Limits

For verified WhatsApp Business accounts, you can increase limits:

```sql
-- Increase to 10,000 messages per day (for verified accounts)
UPDATE whatsapp_protection_settings
SET value = jsonb_set(
  value,
  '{maxMessagesPerDay}',
  '10000'::jsonb
)
WHERE key = 'protection_config';

-- Increase hourly limit to 1000
UPDATE whatsapp_protection_settings
SET value = jsonb_set(
  value,
  '{maxMessagesPerHour}',
  '1000'::jsonb
)
WHERE key = 'protection_config';
```

**⚠️ Warning**: Only increase limits if your account is verified and you understand Meta's policies. Exceeding limits can result in account bans.

## Monitoring

### Check Protection Status

```typescript
import { checkDailyQuota, checkHourlyQuota } from '@/lib/utils/whatsapp-protection';

const daily = await checkDailyQuota();
console.log(`Daily: ${daily.sentToday}/${daily.remaining + daily.sentToday} messages`);

const hourly = await checkHourlyQuota();
console.log(`Hourly: ${hourly.sentThisHour}/${hourly.remaining + hourly.sentThisHour} messages`);
```

### View Protection Logs

Check server logs for protection-related messages:
- Quota exceeded warnings
- Contact frequency violations
- 24-hour window checks
- Rate limit backoffs

## Troubleshooting

### "Daily quota exceeded"
- Wait until next day (resets at midnight)
- Or increase limit if account is verified
- Check `whatsapp_daily_stats` table

### "Contact frequency limit exceeded"
- ~~Contact has received too many messages today~~ (Currently disabled)
- ~~Wait at least 1 hour between messages~~ (Currently disabled)
- Per-contact frequency limits are currently disabled

### "24-hour window violation"
- Trying to send free-form message outside 24h window
- Use template message instead
- Or wait for contact to message you first

### Messages sending too slowly
- This is intentional to prevent bans
- Minimum 2 seconds between messages
- Can reduce `MIN_DELAY_BETWEEN_MESSAGES_MS` but not recommended

## Meta's Official Limits

According to Meta's documentation:
- **New accounts**: ~1,000 conversations/day
- **Verified accounts**: Up to 1,000+ conversations/day
- **24-hour window**: Must use templates outside window
- **Rate limits**: Vary by account status

Our protection system enforces these limits automatically to keep your account safe.

