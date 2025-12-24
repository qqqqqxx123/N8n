# Ring CRM Portal

A CRM-style web portal for a ring/jewelry company, built with Next.js 14, TypeScript, TailwindCSS, and Supabase. The portal enables admins to upload customer CSVs, manage contacts, segment leads (Hot/Warm/Cold), and trigger n8n automations for lead scoring and WhatsApp messaging.

## Features

- **CSV Import**: Upload and map CSV files to import customer contacts
- **Contact Management**: View, search, and filter contacts with segment-based organization
- **Lead Scoring**: Rule-based scoring system that automatically segments contacts (Hot/Warm/Cold)
- **Campaign Management**: Send WhatsApp campaigns to segments with opt-in compliance
- **WhatsApp Integration**: Webhook endpoint for receiving inbound messages
- **n8n Integration**: Trigger automations via webhooks for scoring and messaging

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod
- **CSV Parsing**: PapaParse
- **HTTP Client**: Axios

## Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account and project
- n8n instance (optional, for automation triggers)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   ```bash
   supabase/migrations/001_initial_schema.sql
   ```
3. Copy your Supabase URL and anon key from Project Settings > API

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: n8n Webhook (can be configured in Settings page)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/...
N8N_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Run Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of supabase/migrations/001_initial_schema.sql
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/                    # API route handlers
│   │   ├── csv/                # CSV import endpoints
│   │   ├── contacts/           # Contact CRUD endpoints
│   │   ├── campaigns/          # Campaign management
│   │   ├── scoring/            # Lead scoring
│   │   ├── settings/           # Settings management
│   │   ├── n8n/                # n8n webhook triggers
│   │   └── whatsapp/           # WhatsApp webhook
│   ├── contacts/               # Contact pages
│   ├── campaigns/              # Campaign page
│   ├── settings/               # Settings page
│   ├── upload/                 # CSV upload page
│   └── layout.tsx              # Root layout
├── components/                 # Reusable React components
│   ├── csv-uploader.tsx
│   ├── column-mapper.tsx
│   ├── contacts-table.tsx
│   └── segment-tabs.tsx
├── lib/
│   ├── supabase/              # Supabase client setup
│   ├── types/                 # TypeScript types
│   └── utils/                 # Utility functions
└── supabase/
    └── migrations/            # Database migrations
```

## Database Schema

### Contacts Table
Stores customer contact information with opt-in status and consent tracking.

### Events Table
Tracks all contact events (CSV imports, purchases, inquiries, WhatsApp messages).

### Scores Table
Stores computed lead scores and segments (hot/warm/cold).

### Messages Table
Logs all WhatsApp messages (inbound and outbound) with status tracking.

### Settings Table
Stores configuration for n8n webhooks, WhatsApp templates, and scoring weights.

## Compliance Features

### Opt-In Management
- **No auto-send**: WhatsApp messages are only sent to contacts with `opt_in_status === true`
- **Consent tracking**: Stores `opt_in_status`, `opt_in_timestamp`, and `opt_in_source`
- **Opt-out handling**: Contacts with `opt_in_status=false` are suppressed from campaigns

### WhatsApp Template Requirements
- Outbound messages outside a 24-hour inbound window must use approved templates
- Templates are configured in the Settings page
- Campaign system enforces template usage for compliance

## Lead Scoring Rules

The scoring system uses configurable weights (defaults shown):

- **+30 points**: Inquiry/visit in last 7 days
- **+20 points**: Interest type is 'engagement' or 'wedding'
- **+15 points**: Total spend ≥ $10,000
- **+10 points**: Ring size is known (in events meta)
- **-25 points**: Last purchase within 60 days
- **-100 points**: Opt-out status

### Segments
- **Hot**: Score ≥ 60
- **Warm**: Score 35-59
- **Cold**: Score < 35

## API Endpoints

### CSV Import
- `POST /api/csv/import` - Import CSV data with column mapping

### Contacts
- `GET /api/contacts` - List contacts with filters
- `GET /api/contacts/[id]` - Get contact details
- `GET /api/contacts/[id]/score` - Get contact score
- `GET /api/contacts/[id]/events` - Get contact events
- `GET /api/contacts/[id]/messages` - Get contact messages

### Campaigns
- `GET /api/campaigns/eligible-count` - Count eligible contacts for segment
- `POST /api/campaigns/trigger` - Trigger campaign to segment

### Scoring
- `POST /api/scoring/run` - Recompute scores for contacts

### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Update settings
- `GET /api/settings/templates` - Get WhatsApp templates

### n8n Integration
- `POST /api/n8n/import-trigger` - Trigger n8n webhook after CSV import

### WhatsApp
- `POST /api/whatsapp/webhook` - Receive inbound WhatsApp messages

## Usage Guide

### 1. Upload CSV
1. Navigate to `/upload`
2. Drag and drop or select a CSV file
3. Map CSV columns to contact fields
4. Review preview and validation errors
5. Click "Import CSV"

### 2. View Contacts
1. Navigate to `/contacts`
2. Use search and filters to find contacts
3. Switch between segment tabs (Hot/Warm/Cold)
4. Click on a contact to view details

### 3. Send Campaign
1. Navigate to `/campaigns`
2. Select a segment (Hot/Warm/Cold)
3. Choose a WhatsApp template
4. Review eligible contact count
5. Click "Send Campaign"

### 4. Configure Settings
1. Navigate to `/settings`
2. Set n8n webhook URL and secret
3. Add WhatsApp templates
4. Adjust scoring weights
5. Save settings

## n8n Integration

The portal triggers n8n webhooks for:
- **CSV Import**: After successful import, sends contact data to n8n
- **Campaigns**: Sends campaign payload with eligible contacts

Webhook payloads include contact information and metadata for automation workflows.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `N8N_WEBHOOK_URL` | n8n webhook URL (can be set in UI) | No |
| `N8N_WEBHOOK_SECRET` | n8n webhook secret (can be set in UI) | No |

## Troubleshooting

### Database Connection Issues
- Verify Supabase credentials in `.env.local`
- Check that migrations have been run
- Ensure Supabase project is active

### CSV Import Errors
- Check phone number format (will be normalized to E.164)
- Ensure required fields are mapped
- Review validation errors in the preview

### Campaign Not Sending
- Verify n8n webhook URL is configured
- Check that contacts have `opt_in_status=true`
- Ensure template is selected

## License

This project is proprietary software for internal use.

## Support

For issues or questions, contact the development team.






