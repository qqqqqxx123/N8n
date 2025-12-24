# How to Fix "No Contacts Found" Issue

## Problem
You have scores computed (contacts are in segments), but the campaign page shows "No contacts found" because contacts don't have `opt_in_status=true`.

## Solution: Update Opt-In Status

### Option 1: Update via Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard
2. Navigate to **Table Editor** → **contacts** table
3. You'll see a column `opt_in_status` (boolean)
4. For each contact you want to send campaigns to:
   - Click on the `opt_in_status` cell
   - Change from `false` to `true`
   - Press Enter to save

### Option 2: Bulk Update via SQL (Fastest for Many Contacts)

1. Go to Supabase Dashboard → **SQL Editor**
2. Run one of these SQL commands:

**Update ALL contacts to opted-in:**
```sql
UPDATE contacts 
SET opt_in_status = true,
    opt_in_timestamp = NOW(),
    opt_in_source = 'manual_update'
WHERE opt_in_status = false;
```

**Update only contacts in a specific segment (e.g., Hot):**
```sql
UPDATE contacts 
SET opt_in_status = true,
    opt_in_timestamp = NOW(),
    opt_in_source = 'manual_update'
WHERE id IN (
  SELECT contact_id 
  FROM scores 
  WHERE segment = 'hot'
)
AND opt_in_status = false;
```

**Update only contacts in Warm segment:**
```sql
UPDATE contacts 
SET opt_in_status = true,
    opt_in_timestamp = NOW(),
    opt_in_source = 'manual_update'
WHERE id IN (
  SELECT contact_id 
  FROM scores 
  WHERE segment = 'warm'
)
AND opt_in_status = false;
```

**Update only contacts in Cold segment:**
```sql
UPDATE contacts 
SET opt_in_status = true,
    opt_in_timestamp = NOW(),
    opt_in_source = 'manual_update'
WHERE id IN (
  SELECT contact_id 
  FROM scores 
  WHERE segment = 'cold'
)
AND opt_in_status = false;
```

### Option 3: Update via CSV Import

1. Export your contacts to CSV
2. Add a column `opt_in_status` with value `TRUE` for all rows
3. Re-import the CSV (the system will update existing contacts)

### Option 4: Update Specific Contacts

If you only want to opt-in specific contacts:

```sql
UPDATE contacts 
SET opt_in_status = true,
    opt_in_timestamp = NOW(),
    opt_in_source = 'manual_update'
WHERE phone_e164 IN ('+85291234567', '+85265498521', '+85225121213');
-- Replace with actual phone numbers
```

## Verify the Fix

After updating:

1. Go back to your Campaigns page
2. Select a segment (Hot/Warm/Cold)
3. You should now see contact counts instead of "No contacts found"
4. The message will show: "X of Y contacts in [Segment] segment are sendable"

## Why This Happens

- By default, imported contacts have `opt_in_status=false` for compliance
- WhatsApp campaigns require explicit opt-in (`opt_in_status=true`)
- This ensures you only send to contacts who have consented
- Contacts automatically opt-in when they send you a WhatsApp message (inbound)

## Best Practices

1. **Set opt_in_status during CSV import**: Include `opt_in_status=TRUE` in your CSV
2. **Bulk update after import**: Use SQL to update all contacts at once
3. **Track opt-in source**: The system records `opt_in_source` and `opt_in_timestamp`
4. **Respect opt-outs**: Never manually set `opt_in_status=false` contacts back to `true` without consent

## Check Current Status

To see how many contacts are opted-in per segment:

```sql
SELECT 
  s.segment,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN c.opt_in_status = true THEN 1 END) as opted_in,
  COUNT(CASE WHEN c.opt_in_status = false THEN 1 END) as not_opted_in
FROM scores s
JOIN contacts c ON s.contact_id = c.id
GROUP BY s.segment
ORDER BY s.segment;
```

This will show you:
- Total contacts per segment
- How many are opted-in (sendable)
- How many are not opted-in (need update)


