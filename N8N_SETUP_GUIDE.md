# n8n Integration Setup Guide for WhatsApp Messaging

This guide explains how to set up n8n workflows to integrate with your CRM's WhatsApp messaging system.

## Overview

Your CRM sends messages to n8n via webhook, and n8n can:
1. Send messages to WhatsApp (via Meta API, Twilio, or other providers)
2. Receive incoming WhatsApp messages and forward to your CRM
3. Update message delivery status back to CRM

---

## Step 1: Configure n8n Webhook in CRM Settings

### 1.1 Get Your n8n Webhook URL

1. Open your n8n instance
2. Create a new workflow
3. Add a **Webhook** node
4. Click **Execute Node** to get the webhook URL
5. Copy the webhook URL (e.g., `https://your-n8n-instance.com/webhook/campaign`)

### 1.2 Set Webhook URL in CRM

1. Go to your CRM → **Settings** page
2. Find **n8n Webhook Configuration** section
3. Enter your webhook URL in **Webhook URL** field
4. (Optional) Enter **Webhook Secret** for authentication
5. Click **Save Settings**

---

## Step 2: Create n8n Workflow for Sending Messages

This workflow handles messages sent from the CRM.

### 2.1 Create New Workflow

1. In n8n, click **+ Add workflow**
2. Name it: "WhatsApp Send Message"

### 2.2 Add Webhook Node

1. Drag **Webhook** node onto canvas
2. Configure:
   - **HTTP Method:** POST
   - **Path:** `/webhook/send-message` (or your preferred path)
   - **Response Mode:** Last Node
   - **Authentication:** None (or Header Auth if using secret)

### 2.3 Add Set Node (Optional - Transform Data)

If you need to transform the data format:

1. Add **Set** node after Webhook
2. Map fields:
   - `phone` ← `{{ $json.phone_e164 }}`
   - `message` ← `{{ $json.message.body }}`
   - `contact_id` ← `{{ $json.contact_id }}`

### 2.4 Add WhatsApp Node (Meta API)

**Option A: Using Meta WhatsApp Business API**

1. Add **HTTP Request** node
2. Configure:
   - **Method:** POST
   - **URL:** `https://graph.facebook.com/v18.0/{{WABA_PHONE_NUMBER_ID}}/messages`
   - **Authentication:** Generic Credential Type → Bearer Token
   - **Token:** Your Meta Access Token
   - **Headers:**
     ```
     Content-Type: application/json
     ```
   - **Body:**
     ```json
     {
       "messaging_product": "whatsapp",
       "to": "{{ $json.phone_e164 }}",
       "type": "text",
       "text": {
         "body": "{{ $json.message.body }}"
       }
     }
     ```

**Option B: Using Twilio WhatsApp**

1. Add **Twilio** node
2. Configure:
   - **Resource:** Message
   - **Operation:** Send a Message
   - **From:** Your Twilio WhatsApp number (e.g., `whatsapp:+14155238886`)
   - **To:** `{{ "whatsapp:" + $json.phone_e164 }}`
   - **Message:** `{{ $json.message.body }}`

### 2.5 Add Update Message Status Node (Optional)

To update message status back to CRM:

1. Add **HTTP Request** node after WhatsApp node
2. Configure:
   - **Method:** POST
   - **URL:** `https://your-crm-domain.com/api/messages/status` (if you create this endpoint)
   - **Body:**
     ```json
     {
       "message_id": "{{ $json.contact_id }}",
       "status": "sent",
       "provider_message_id": "{{ $json('HTTP Request').body.messages[0].id }}"
     }
     ```

### 2.6 Add Respond to Webhook Node

1. Add **Respond to Webhook** node at the end
2. Configure:
   - **Response Body:**
     ```json
     {
       "success": true,
       "message_id": "{{ $json('HTTP Request').body.messages[0].id }}"
     }
     ```

### 2.7 Save and Activate Workflow

1. Click **Save**
2. Toggle **Active** switch to enable the workflow
3. The webhook URL is now active and ready to receive requests

---

## Step 3: Create n8n Workflow for Receiving Messages

This workflow receives messages from WhatsApp and forwards them to your CRM.

### 3.1 Create New Workflow

1. Name it: "WhatsApp Receive Message"

### 3.2 Add Webhook Node (From WhatsApp Provider)

**For Meta WhatsApp:**

1. Add **Webhook** node
2. Configure:
   - **HTTP Method:** POST
   - **Path:** `/webhook/whatsapp-inbound`
   - **Response Mode:** Respond to Webhook

### 3.3 Add Code Node (Extract Data)

Add **Code** node to extract message data:

```javascript
// Extract message from Meta webhook payload
const entry = items[0].json.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;
const message = value?.messages?.[0];
const contact = value?.contacts?.[0];

if (!message) {
  return [{
    json: {
      error: 'No message found'
    }
  }];
}

return [{
  json: {
    from: message.from,
    body: message.text?.body || '',
    message_id: message.id,
    timestamp: message.timestamp,
    contact_name: contact?.profile?.name || ''
  }
}];
```

### 3.4 Add HTTP Request Node (Forward to CRM)

1. Add **HTTP Request** node
2. Configure:
   - **Method:** POST
   - **URL:** `https://your-crm-domain.com/api/whatsapp/webhook`
   - **Headers:**
     ```
     Content-Type: application/json
     ```
   - **Body:**
     ```json
     {
       "from": "{{ $json.from }}",
       "body": "{{ $json.body }}",
       "message_id": "{{ $json.message_id }}",
       "timestamp": "{{ $json.timestamp }}"
     }
     ```

### 3.5 Add Respond to Webhook Node

1. Add **Respond to Webhook** node
2. Configure:
   - **Response Code:** 200
   - **Response Body:**
     ```json
     {
       "success": true
     }
     ```

### 3.6 Configure WhatsApp Provider Webhook

**For Meta WhatsApp Business API:**

1. Go to Meta Business Manager
2. Navigate to WhatsApp → Configuration
3. Add webhook URL: `https://your-n8n-instance.com/webhook/whatsapp-inbound`
4. Add webhook verify token
5. Subscribe to `messages` events

---

## Step 4: Create n8n Workflow for Message Status Updates

This workflow handles delivery/read status updates from WhatsApp.

### 4.1 Create New Workflow

1. Name it: "WhatsApp Status Updates"

### 4.2 Add Webhook Node

1. Add **Webhook** node
2. Configure:
   - **HTTP Method:** POST
   - **Path:** `/webhook/whatsapp-status`

### 4.3 Add Code Node (Extract Status)

```javascript
const entry = items[0].json.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;
const status = value?.statuses?.[0];

if (!status) {
  return [];
}

return [{
  json: {
    message_id: status.id,
    status: status.status, // sent, delivered, read, failed
    recipient_id: status.recipient_id,
    timestamp: status.timestamp
  }
}];
```

### 4.4 Add HTTP Request Node (Update CRM)

1. Add **HTTP Request** node
2. Configure:
   - **Method:** PATCH (or POST if endpoint doesn't exist)
   - **URL:** `https://your-crm-domain.com/api/messages/status-update`
   - **Body:**
     ```json
     {
       "provider_message_id": "{{ $json.message_id }}",
       "status": "{{ $json.status }}"
     }
     ```

---

## Step 5: Complete n8n Workflow Examples

### Example 1: Simple Send Message Workflow

```
[Webhook] → [HTTP Request (Meta API)] → [Respond to Webhook]
```

**Webhook receives:**
```json
{
  "action": "send_message",
  "contact_id": "uuid",
  "phone_e164": "+85212345678",
  "message": {
    "body": "Hello!"
  }
}
```

**Sends to Meta:**
```json
{
  "messaging_product": "whatsapp",
  "to": "+85212345678",
  "type": "text",
  "text": {
    "body": "Hello!"
  }
}
```

### Example 2: Send with Template

If your CRM sends template messages:

**Webhook receives:**
```json
{
  "action": "send_message",
  "contact_id": "uuid",
  "phone_e164": "+85212345678",
  "message": {
    "template_name": "hello_world",
    "template_language": "en_US",
    "template_variables": ["John"]
  }
}
```

**Transform in n8n (Code node):**
```javascript
const templateName = items[0].json.message.template_name;
const language = items[0].json.message.template_language;
const variables = items[0].json.message.template_variables || [];

return [{
  json: {
    messaging_product: "whatsapp",
    to: items[0].json.phone_e164,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: language
      },
      components: variables.length > 0 ? [{
        type: "body",
        parameters: variables.map(v => ({
          type: "text",
          text: v
        }))
      }] : []
    }
  }
}];
```

---

## Step 6: Environment Variables in n8n

Set these credentials in n8n:

1. Go to **Credentials** → **New**
2. Create credentials:

**For Meta WhatsApp:**
- **Name:** Meta WhatsApp Access Token
- **Type:** Generic Credential Type
- **Access Token:** Your Meta WhatsApp Business API Access Token

**For Twilio:**
- **Name:** Twilio Account
- **Type:** Twilio
- **Account SID:** Your Twilio Account SID
- **Auth Token:** Your Twilio Auth Token

---

## Step 7: Testing the Integration

### 7.1 Test Send Message

1. Go to your CRM → Messages page
2. Select a contact
3. Type a message and click Send
4. Check n8n workflow execution logs
5. Verify message appears in WhatsApp

### 7.2 Test Receive Message

1. Send a message to your WhatsApp Business number
2. Check n8n workflow execution logs
3. Verify message appears in CRM messages page

### 7.3 Test Status Updates

1. Send a message from CRM
2. Check delivery status in WhatsApp
3. Verify status updates in n8n logs
4. (If implemented) Check status in CRM database

---

## Step 8: Error Handling

### 8.1 Add Error Handling in n8n

1. Add **IF** node after WhatsApp send
2. Check if request was successful
3. Add **HTTP Request** node for error notification
4. Send error to CRM or logging service

**Example Error Handling:**
```
[HTTP Request (WhatsApp)] → [IF (Success?)] 
                              ├─ Yes → [Respond Success]
                              └─ No → [Notify Error] → [Respond Error]
```

### 8.2 Common Error Scenarios

**Error: Invalid phone number**
- Solution: Validate phone format in n8n before sending

**Error: Template not found**
- Solution: Check template name and language match Meta

**Error: Rate limit exceeded**
- Solution: Add retry logic or queue messages

**Error: Unauthorized**
- Solution: Check access token is valid and not expired

---

## Step 9: Advanced Features

### 9.1 Message Queuing

For bulk sending:

1. Add **Queue** node after Webhook
2. Process messages one at a time
3. Add delays to respect rate limits

### 9.2 Message Templates

1. Store templates in n8n database
2. Map template names from CRM
3. Use Code node to construct template payload

### 9.3 Analytics

1. Add **Postgres** node to log all messages
2. Track send/receive rates
3. Monitor error rates
4. Generate reports

---

## Step 10: Security Best Practices

### 10.1 Webhook Authentication

**Option 1: Header Authentication**
1. In CRM Settings, add webhook secret
2. In n8n Webhook node, check for header:
   ```
   X-Webhook-Secret: your-secret
   ```
3. Add IF node to validate secret

**Option 2: API Key**
1. Add API key to n8n credentials
2. Validate in webhook node
3. Reject if invalid

### 10.2 HTTPS Only

- Always use HTTPS for webhook URLs
- Never expose n8n on HTTP in production
- Use reverse proxy with SSL certificate

### 10.3 Rate Limiting

- Add rate limiting in n8n
- Prevent abuse of webhook endpoints
- Monitor for suspicious activity

---

## Troubleshooting

### Issue: Messages not sending

**Check:**
1. Is n8n workflow active?
2. Is webhook URL correct in CRM settings?
3. Check n8n execution logs for errors
4. Verify WhatsApp API credentials are valid

### Issue: Messages not receiving

**Check:**
1. Is webhook configured in Meta/Twilio?
2. Is n8n webhook URL accessible from internet?
3. Check webhook verification token matches
4. Check n8n execution logs

### Issue: Status not updating

**Check:**
1. Is status webhook configured in WhatsApp provider?
2. Is CRM status update endpoint working?
3. Check message IDs match between systems

---

## Summary

You've set up:
✅ n8n webhook URL in CRM settings
✅ Workflow for sending messages from CRM to WhatsApp
✅ Workflow for receiving messages from WhatsApp to CRM
✅ Workflow for status updates
✅ Error handling and security

Your n8n integration is now complete! 🎉

