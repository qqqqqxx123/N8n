# n8n WhatsApp Campaign - Quick Start Guide

## Quick Setup (5 Steps)

### 1. Get Your WhatsApp Business API Credentials
- **Phone Number ID**: From Meta Business Manager > WhatsApp > API Setup
- **Access Token**: Generate from Meta Business Manager (permanent token recommended)
- **Template Name**: Your approved WhatsApp template name

### 2. Import Workflow to n8n
1. Open n8n
2. Click **"Import from File"**
3. Select `n8n-whatsapp-campaign-workflow.json`
4. The workflow will be imported with all nodes configured

### 3. Configure Credentials in n8n
1. In the **"Send WhatsApp Message"** node, click on credentials
2. Create new **"Header Auth"** credential:
   - **Name**: `Authorization`
   - **Value**: `Bearer YOUR_ACCESS_TOKEN`
3. Set environment variable `WHATSAPP_PHONE_NUMBER_ID` to your Phone Number ID
   - Or replace `{{ $env.WHATSAPP_PHONE_NUMBER_ID }}` in the HTTP Request URL with your actual Phone Number ID

### 4. Update Template Structure (if needed)
1. Open **"Send WhatsApp Message"** node
2. Update the JSON body to match your WhatsApp template:
   - Change `template_name` to your actual template name
   - Adjust `components[0].parameters` array based on your template variables
   - Update language code if needed (default: `en`)

### 5. Activate and Connect
1. **Activate** the workflow in n8n
2. Copy the webhook URL (shown in the Webhook node)
3. Go to your Ring CRM Portal → Settings
4. Paste the webhook URL in **"n8n Webhook URL"**
5. Optionally set a **"Webhook Secret"** for security
6. Save settings

## Test Your Setup

1. Go to your portal's Campaigns page
2. Select a segment (Hot/Warm/Cold)
3. Choose a template
4. Click **"Send Campaign"**
5. Check n8n executions to see if messages were sent

## What the Workflow Does

1. **Receives webhook** from your portal with campaign data
2. **Parses data** to extract contacts and template info
3. **Splits into batches** (10 contacts per batch) to avoid rate limits
4. **Sends WhatsApp message** to each contact using the template
5. **Logs success/errors** for monitoring
6. **Responds** to your portal with status

## Payload Structure

Your portal sends this data to n8n:

```json
{
  "campaign_type": "whatsapp",
  "segment": "hot",
  "template_name": "your_template_name",
  "contacts": [
    {
      "id": "uuid",
      "phone_e164": "+1234567890",
      "full_name": "John Doe"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Template not found" | Verify template name matches exactly (case-sensitive) |
| "Invalid phone number" | Phone numbers are already in E.164 format from portal |
| "Rate limit exceeded" | Reduce batch size in "Split In Batches" node |
| "Authentication failed" | Check access token is valid and has WhatsApp permissions |
| Webhook not receiving | Ensure workflow is activated and URL is correct |

## Next Steps

- See `N8N_WHATSAPP_SETUP.md` for detailed configuration
- Monitor executions in n8n to track delivery
- Adjust batch size based on your API tier limits
- Set up error notifications if needed

## Support

For detailed instructions, troubleshooting, and advanced features, see:
- **Full Guide**: `N8N_WHATSAPP_SETUP.md`
- **Workflow File**: `n8n-whatsapp-campaign-workflow.json`


