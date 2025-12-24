# n8n WhatsApp Campaign Setup Guide

This guide will help you set up n8n to receive campaign webhooks from your Ring CRM Portal and send WhatsApp messages using WhatsApp Business API.

## Prerequisites

1. **n8n instance** (cloud or self-hosted)
2. **WhatsApp Business API access** with:
   - Phone Number ID
   - Access Token
   - Business Account ID (optional, for some features)
3. **WhatsApp Business Account** with approved message templates

## Step 1: Configure n8n Webhook URL in Your Portal

1. Go to your Ring CRM Portal Settings page (`/settings`)
2. Enter your n8n webhook URL (e.g., `https://your-n8n-instance.com/webhook/campaign`)
3. Optionally set a webhook secret for authentication
4. Save the settings

## Step 2: Create n8n Workflow

### 2.1 Create a New Workflow

1. In n8n, click **"New Workflow"**
2. Name it: **"WhatsApp Campaign Sender"**

### 2.2 Add Webhook Trigger Node

1. Click **"Add Node"** and search for **"Webhook"**
2. Select **"Webhook"** node
3. Configure the webhook:
   - **HTTP Method**: `POST`
   - **Path**: `campaign` (or your preferred path)
   - **Response Mode**: `Last Node` (or `When Last Node Finishes`)
   - **Authentication**: 
     - If you set a webhook secret, use **"Header Auth"** or **"Generic Credential Type"**
     - Header name: `X-Webhook-Secret`
     - Value: Your secret from settings

### 2.3 Add Code Node (Parse Webhook Data)

1. Add a **"Code"** node after the Webhook
2. Use this code to parse and prepare the data:

```javascript
// Parse incoming webhook data
const webhookData = $input.item.json;

// Extract campaign information
const campaignType = webhookData.campaign_type; // 'whatsapp'
const segment = webhookData.segment; // 'hot', 'warm', or 'cold'
const templateName = webhookData.template_name;
const contacts = webhookData.contacts || [];
const timestamp = webhookData.timestamp;

// Prepare items for loop (one item per contact)
const items = contacts.map(contact => {
  return {
    json: {
      contact_id: contact.id,
      phone_e164: contact.phone_e164,
      full_name: contact.full_name || 'Customer',
      template_name: templateName,
      segment: segment,
      campaign_timestamp: timestamp
    }
  };
});

return items;
```

### 2.4 Add Split In Batches Node (Optional - for Rate Limiting)

If you have many contacts, split them into batches to avoid rate limits:

1. Add **"Split In Batches"** node
2. Configure:
   - **Batch Size**: `10` (adjust based on your WhatsApp API rate limits)
   - **Options**: Keep default settings

### 2.5 Add HTTP Request Node (Send WhatsApp Message)

1. Add **"HTTP Request"** node
2. Configure:
   - **Method**: `POST`
   - **URL**: `https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages`
     - Replace `{PHONE_NUMBER_ID}` with your WhatsApp Business Phone Number ID
   - **Authentication**: 
     - **Type**: `Generic Credential Type`
     - **Credential**: Create a new credential with:
       - **Header Name**: `Authorization`
       - **Header Value**: `Bearer {YOUR_ACCESS_TOKEN}`
   - **Headers**:
     - `Content-Type`: `application/json`
   - **Body Content Type**: `JSON`
   - **JSON Body**:

```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $json.phone_e164 }}",
  "type": "template",
  "template": {
    "name": "{{ $json.template_name }}",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{ $json.full_name }}"
          }
        ]
      }
    ]
  }
}
```

**Note**: Adjust the template structure based on your actual WhatsApp template format. If your template has variables, add them in the `components[0].parameters` array.

### 2.6 Add Error Handling (Optional but Recommended)

1. Add **"IF"** node after HTTP Request
2. Check if request was successful:
   - **Condition**: `{{ $json.statusCode }} equals 200`
3. Add **"Set"** node for success path to log successful sends
4. Add **"Set"** node for error path to log failures

### 2.7 Add Response Node

1. Add **"Respond to Webhook"** node at the end
2. Configure:
   - **Response Code**: `200`
   - **Response Body**: 

```json
{
  "success": true,
  "message": "Campaign processed",
  "contacts_processed": "{{ $('Split In Batches').item.json.batchCount || $('Code').item.json.length }}"
}
```

## Step 3: Configure WhatsApp Business API Credentials

### Get Your Credentials

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Navigate to your WhatsApp Business App
3. Get:
   - **Phone Number ID**: Found in WhatsApp > API Setup
   - **Access Token**: Generate a permanent token (or use temporary for testing)
   - **Business Account ID**: Found in Business Settings

### Store Credentials in n8n

1. In the HTTP Request node, create credentials:
   - Go to **Credentials** section
   - Click **"Create New"**
   - Select **"Header Auth"** or use environment variables
   - Set:
     - **Name**: `Authorization`
     - **Value**: `Bearer YOUR_ACCESS_TOKEN`

## Step 4: Test Your Workflow

### Test with Sample Data

1. In n8n, click **"Execute Workflow"**
2. Use this test payload:

```json
{
  "campaign_type": "whatsapp",
  "segment": "hot",
  "template_name": "your_template_name",
  "contacts": [
    {
      "id": "test-123",
      "phone_e164": "+1234567890",
      "full_name": "Test User"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

3. Check the execution logs to ensure messages are sent correctly

## Step 5: Activate and Deploy

1. **Activate** the workflow in n8n
2. Copy the webhook URL (from the Webhook node)
3. Paste it into your Ring CRM Portal Settings page
4. Save settings

## WhatsApp Template Format

Your WhatsApp templates must be approved in Meta Business Manager. The template structure in n8n should match your approved template.

### Example Template Structure

If your template is named `welcome_message` with a variable `{{1}}` for the customer name:

```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $json.phone_e164 }}",
  "type": "template",
  "template": {
    "name": "welcome_message",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{ $json.full_name }}"
          }
        ]
      }
    ]
  }
}
```

### Template with Multiple Variables

If your template has multiple variables:

```json
{
  "template": {
    "name": "your_template_name",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{ $json.full_name }}"
          },
          {
            "type": "text",
            "text": "{{ $json.segment }}"
          }
        ]
      }
    ]
  }
}
```

## Advanced: Error Handling and Retry Logic

### Add Retry Logic

1. Add **"Retry on Fail"** node after HTTP Request
2. Configure:
   - **Max Attempts**: `3`
   - **Wait Between Attempts**: `5000` (5 seconds)

### Log Errors

1. Add **"Set"** node to capture error details:

```javascript
const error = $input.item.json.error || {};
return {
  json: {
    contact_id: $('Code').item.json.contact_id,
    phone: $('Code').item.json.phone_e164,
    error: error.message || 'Unknown error',
    status_code: $('HTTP Request').item.json.statusCode,
    timestamp: new Date().toISOString()
  }
};
```

## Rate Limiting Considerations

WhatsApp Business API has rate limits:
- **Tier 1**: 1,000 conversations per 24 hours
- **Tier 2**: 10,000 conversations per 24 hours
- **Tier 3**: 100,000 conversations per 24 hours

### Implement Rate Limiting in n8n

1. Use **"Split In Batches"** with appropriate batch size
2. Add **"Wait"** node between batches:
   - **Amount**: `1`
   - **Unit**: `seconds`
3. Monitor your API usage in Meta Business Manager

## Monitoring and Debugging

### Check Workflow Executions

1. Go to **"Executions"** in n8n
2. Review each execution to see:
   - Which contacts were processed
   - Any errors that occurred
   - Response times

### Check WhatsApp Delivery Status

WhatsApp sends delivery status webhooks. You can:
1. Create another webhook endpoint in your portal
2. Set it up in Meta Business Manager
3. Process delivery receipts in n8n

## Troubleshooting

### Common Issues

1. **"Invalid phone number format"**
   - Ensure phone numbers are in E.164 format (e.g., `+1234567890`)
   - Your portal already normalizes to E.164, so this should be handled

2. **"Template not found"**
   - Verify template name matches exactly (case-sensitive)
   - Ensure template is approved in Meta Business Manager

3. **"Rate limit exceeded"**
   - Reduce batch size
   - Add delays between batches
   - Check your WhatsApp Business API tier

4. **"Authentication failed"**
   - Verify access token is valid
   - Check token hasn't expired
   - Ensure token has WhatsApp permissions

5. **"Webhook not receiving data"**
   - Verify webhook URL in portal settings
   - Check n8n workflow is activated
   - Test webhook with a tool like Postman

## Security Best Practices

1. **Use Webhook Secret**: Always set a webhook secret in portal settings
2. **Validate Secret in n8n**: Add a check in the Code node:

```javascript
const expectedSecret = 'your-secret-here';
const receivedSecret = $input.item.json.headers['x-webhook-secret'];

if (receivedSecret !== expectedSecret) {
  throw new Error('Invalid webhook secret');
}
```

3. **Store Credentials Securely**: Use n8n credentials, not hardcoded values
4. **Use Environment Variables**: For sensitive data like access tokens

## Next Steps

1. Test with a small campaign first
2. Monitor delivery rates
3. Set up error notifications (email/Slack)
4. Consider adding delivery status tracking
5. Implement opt-out handling if needed

## Support

If you encounter issues:
1. Check n8n execution logs
2. Review WhatsApp Business API documentation
3. Verify template approval status in Meta Business Manager
4. Check your portal's campaign trigger logs


