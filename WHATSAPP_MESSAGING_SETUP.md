# WhatsApp Messaging Integration - Step-by-Step Setup Guide

This guide will walk you through implementing the WhatsApp-like messaging platform in your CRM.

## Prerequisites

- Supabase project set up and running
- Next.js application running
- Database access to run migrations

---

## Step 1: Run Database Migration

The first step is to update your database schema to support messaging features.

### 1.1 Open Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### 1.2 Run the Migration

1. Copy the entire contents of `supabase/migrations/005_enhance_messages_table.sql`
2. Paste it into the SQL Editor
3. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

**What this migration does:**
- Adds `body` column to store message content
- Adds `is_read` column to track read status
- Adds `read_at` column to timestamp when messages were read
- Creates indexes for better query performance

### 1.3 Verify Migration Success

After running, you should see:
- ✅ Success message in the SQL Editor
- No error messages

**Verify in Table Editor:**
1. Go to **Table Editor** → `messages` table
2. Check that the new columns exist: `body`, `is_read`, `read_at`

---

## Step 2: Update Webhook Handler (Already Done)

The webhook handler has been updated to save message content. This happens automatically when messages come in via `/api/whatsapp/webhook`.

**What happens:**
- When a WhatsApp message is received, it saves the message `body` to the database
- Sets `is_read = false` by default for new inbound messages

---

## Step 3: Test the API Endpoints

Let's verify all APIs are working correctly.

### 3.1 Test Unread Count API

**Using Browser/Postman:**
```
GET http://localhost:3000/api/messages/unread-count
```

**Expected Response:**
```json
{
  "unreadCount": 0
}
```

### 3.2 Test Conversations API

```
GET http://localhost:3000/api/messages/conversations?limit=50
```

**Expected Response:**
```json
{
  "conversations": []
}
```

(Empty array is normal if you have no messages yet)

### 3.3 Test Send Message API

```
POST http://localhost:3000/api/messages/{contactId}
Content-Type: application/json

{
  "body": "Hello, this is a test message"
}
```

Replace `{contactId}` with an actual contact ID from your database.

---

## Step 4: Using the Messaging Interface

### 4.1 Access the Messages Page

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Open your browser to `http://localhost:3000`

3. Look for the **WhatsApp icon** in the top right corner of the navbar

4. Click the WhatsApp icon to go to `/messages`

### 4.2 Understanding the Interface

**Left Panel (Conversations List):**
- Shows all contacts who have sent/received messages
- Displays contact name or phone number
- Shows latest message preview
- Red badge shows unread count
- Click any conversation to open it

**Right Panel (Message View):**
- Shows all messages in the selected conversation
- Outgoing messages appear on the right (blue)
- Incoming messages appear on the left (white)
- Message input at the bottom
- Send button (green, WhatsApp-style)

### 4.3 Sending Your First Message

1. **Select a Contact:**
   - Choose a contact from the left panel
   - Make sure the contact has `opt_in_status = true` in the database

2. **Type Your Message:**
   - Click in the message input field at the bottom
   - Type your message

3. **Send:**
   - Click the green **Send** button, OR
   - Press `Enter` key

4. **What Happens:**
   - Message appears immediately in the chat
   - Message is saved to database with `direction = 'out'`
   - If n8n webhook is configured, it sends the message via webhook

---

## Step 5: Receiving Messages (Webhook Setup)

### 5.1 Configure Webhook Endpoint

Your webhook endpoint is already set up at:
```
POST /api/whatsapp/webhook
```

### 5.2 Test Webhook (Optional)

You can simulate an incoming message by sending a POST request:

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+85212345678",
    "body": "Hello from customer!",
    "message_id": "test_123",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

**What Happens:**
- If contact exists, message is saved with `direction = 'in'`
- If contact doesn't exist, a new contact is created
- Contact's `opt_in_status` is set to `true`
- Message appears in the conversations list

### 5.3 Connect Your WhatsApp Provider

Configure your WhatsApp Business API provider (Meta, Twilio, etc.) to send webhooks to:
```
https://yourdomain.com/api/whatsapp/webhook
```

---

## Step 6: Understanding the Features

### 6.1 Unread Badge

**Location:** Top right corner, next to WhatsApp icon

**Functionality:**
- Shows red badge with number of unread inbound messages
- Updates automatically every 10 seconds
- Clicking navigates to messages page
- Badge disappears when all messages are read

### 6.2 Read Status

**Automatic Marking:**
- When you open a conversation, all inbound messages are automatically marked as read
- `is_read` changes from `false` to `true`
- `read_at` timestamp is saved

**Manual Marking:**
- API endpoint: `POST /api/messages/{contactId}/read`
- Marks all inbound messages for a contact as read

### 6.3 Message Status

**Outgoing Messages Show:**
- `✓` = Sent
- `✓✓` = Delivered
- No check = Failed

### 6.4 Opt-in Compliance

**Important:** Messages can only be sent to contacts with `opt_in_status = true`

**Automatic Opt-in:**
- When a contact sends an inbound message, they are automatically opted in
- `opt_in_status` is set to `true`
- `opt_in_timestamp` and `opt_in_source` are recorded

---

## Step 7: Integration with n8n (Optional)

If you're using n8n for message sending:

### 7.1 Configure n8n Webhook

1. Go to **Settings** page in your CRM
2. Enter your n8n webhook URL
3. Optionally add webhook secret
4. Click **Save Settings**

### 7.2 Message Payload Format

When you send a message from the CRM, n8n receives:

```json
{
  "action": "send_message",
  "contact_id": "uuid-here",
  "phone_e164": "+85212345678",
  "message": {
    "body": "Your message text here"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7.3 Update Message Status (Recommended)

After sending via n8n, update the message status via API:

```
PATCH /api/messages/{messageId}
{
  "status": "delivered",
  "provider_message_id": "whatsapp_message_id"
}
```

(You may need to create this endpoint if it doesn't exist)

---

## Step 8: Testing Checklist

Use this checklist to verify everything works:

- [ ] Database migration completed successfully
- [ ] Can access `/messages` page
- [ ] WhatsApp icon visible in navbar
- [ ] Unread count badge appears (if there are unread messages)
- [ ] Can see conversations list (if messages exist)
- [ ] Can select a conversation
- [ ] Can see messages in a conversation
- [ ] Can send a message
- [ ] Message appears immediately after sending
- [ ] Webhook receives incoming messages
- [ ] Incoming messages appear in conversations
- [ ] Unread badge updates when new messages arrive
- [ ] Messages are marked as read when conversation is opened

---

## Step 9: Troubleshooting

### Issue: No conversations showing

**Possible Causes:**
1. No messages in database yet
2. Database migration not run
3. API error

**Solution:**
- Check browser console for errors
- Verify migration was run
- Send a test message first

### Issue: Can't send messages

**Possible Causes:**
1. Contact `opt_in_status` is `false`
2. Network error
3. API error

**Solution:**
- Check contact's opt-in status in database
- Check browser console for errors
- Verify API endpoint is accessible

### Issue: Unread badge not updating

**Possible Causes:**
1. No unread messages
2. JavaScript error
3. API not responding

**Solution:**
- Check browser console
- Verify `/api/messages/unread-count` returns correct count
- Check network tab for API calls

### Issue: Messages not appearing

**Possible Causes:**
1. Messages not saved to database
2. Wrong contact ID
3. Refresh needed

**Solution:**
- Check database directly for messages
- Verify contact ID matches
- Refresh the page

---

## Step 10: Customization Options

### 10.1 Change Auto-Refresh Interval

In `app/messages/page.tsx`, find:
```typescript
const interval = setInterval(() => {
  fetchConversations();
  if (selectedContact) {
    fetchMessages(selectedContact.id);
  }
}, 10000); // Change 10000 to your desired interval in milliseconds
```

### 10.2 Change Badge Polling Interval

In `components/whatsapp-icon.tsx`, find:
```typescript
const interval = setInterval(fetchUnreadCount, 10000);
// Change 10000 to your desired interval
```

### 10.3 Customize Message Styling

Edit `app/messages/page.tsx` to change:
- Message bubble colors
- Font sizes
- Spacing
- Time format

---

## Next Steps

Once everything is working:

1. **Connect Real WhatsApp Provider**
   - Configure Meta WhatsApp Business API
   - Or use another provider (Twilio, etc.)
   - Point webhooks to your `/api/whatsapp/webhook` endpoint

2. **Set Up Message Status Updates**
   - Implement webhook callbacks for delivery status
   - Update message status in database
   - Show delivery/read receipts

3. **Add Features (Optional)**
   - Message search
   - File attachments
   - Message reactions
   - Group conversations
   - Message templates in chat

4. **Performance Optimization**
   - Implement pagination for conversations
   - Use Supabase Realtime for instant updates
   - Add message caching

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check server logs
3. Verify database schema matches migration
4. Test API endpoints individually
5. Check Supabase logs for database errors

---

## Summary

You've successfully set up:
✅ Database schema for messaging
✅ API endpoints for messages
✅ WhatsApp icon with unread badge
✅ Messaging interface
✅ Webhook integration
✅ Read/unread status tracking

Your CRM now has a fully functional WhatsApp-like messaging system! 🎉

