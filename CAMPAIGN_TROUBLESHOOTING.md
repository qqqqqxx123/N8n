# Campaign Page Troubleshooting Guide

## Issue: "No contacts found in [Segment] segment"

### Root Causes:

1. **Scores Not Computed** (Most Common)
   - Contacts must have scores computed before they appear in segments
   - **Solution**: Go to the Contacts page and click "Compute All Scores" button
   - Scores are stored in the `scores` table with segment assignments (hot/warm/cold)

2. **Contacts Not Opted-In**
   - Only contacts with `opt_in_status=true` appear in campaigns
   - By default, imported contacts have `opt_in_status=false`
   - **Solution**: 
     - Update contacts manually in the database
     - Or set `opt_in_status=TRUE` in your CSV import
     - Or contacts will auto-opt-in when they send a WhatsApp message (inbound)

3. **No Contacts Match Segment Criteria**
   - Hot: Score ≥ 60
   - Warm: Score 35-59
   - Cold: Score < 35
   - If no contacts meet these criteria, segments will be empty

### How to Fix:

1. **Compute Scores First**:
   ```
   1. Go to Contacts page (/contacts)
   2. Click "Compute All Scores" button
   3. Wait for the success message
   4. Go back to Campaigns page
   ```

2. **Check Opt-In Status**:
   - In Contacts page, check if contacts have opt_in_status=true
   - If not, you can:
     - Update via database directly
     - Import CSV with opt_in_status column set to TRUE
     - Wait for inbound WhatsApp messages (auto-opts-in)

3. **Verify Contacts Exist**:
   - Check Contacts page to see if you have any contacts
   - If no contacts, import them via Upload page

## Issue: Filters Not Working

### What Was Fixed:

1. **Filter State Management**: Filters now properly reset when segment changes
2. **Filter Payload**: Empty/undefined values are now excluded from filter payload
3. **Preview Counts**: Counts now update correctly when filters are applied
4. **Error Messages**: Better error messages explain why filters return no results

### How Filters Work:

1. **Apply Filters**: Click "Apply" button after setting filters
2. **Clear Filters**: Click "Clear Filters" to reset all filters
3. **Filter Types**:
   - Minimum Score: Filter by minimum score value
   - Purchase Recency: Filter by last purchase date
   - Birthday Window: Filter contacts with birthdays within X days
   - Spend Range: Filter by total spend (min/max)
   - Interest Type: Filter by engagement/wedding/fashion/other

### Troubleshooting Filters:

- **Filters return 0 results**: 
  - Check that your filter criteria aren't too restrictive
  - Try removing filters one by one to identify the issue
  - Remember: filters are AND conditions (all must match)

- **Filters don't update counts**:
  - Make sure to click "Apply" button after changing filters
  - Counts update automatically after applying filters

## Quick Checklist:

Before sending campaigns, ensure:

- [ ] Contacts have been imported (Upload page)
- [ ] Scores have been computed (Contacts page → "Compute All Scores")
- [ ] Contacts have opt_in_status=true (check Contacts page)
- [ ] At least one contact exists in your target segment
- [ ] WhatsApp templates are configured (Settings page)
- [ ] n8n webhook URL is configured (Settings page)

## Understanding Segments:

### Hot Segment (Score ≥ 60)
- High-value, engaged contacts
- Recent interactions
- High spend or high intent

### Warm Segment (Score 35-59)
- Moderate engagement
- Some purchase history or interest
- Potential for conversion

### Cold Segment (Score < 35)
- Low engagement
- No recent activity
- May need re-engagement campaigns

## Scoring Factors:

Contacts get points for:
- Recent inquiry/visit (7d): +35 points
- Recent inquiry/visit (30d): +20 points
- Engagement interest: +25 points
- Wedding interest: +20 points
- High spend (≥$10k): +20 points
- Mid spend ($5k-$10k): +12 points
- Low spend (>$0): +6 points
- Ring size known: +10 points
- Appointment booked: +12 points
- And more...

## Still Having Issues?

1. **Check Browser Console**: Look for JavaScript errors
2. **Check Network Tab**: See if API calls are failing
3. **Check Database**: Verify contacts and scores exist in Supabase
4. **Check Logs**: Look at server logs for errors

## Common Error Messages:

- **"No contacts found in [Segment] segment"**
  → Compute scores first (Contacts page)

- **"Contacts found but none are sendable"**
  → Contacts need opt_in_status=true

- **"Failed to fetch contact counts"**
  → Check network connection and API endpoints

- **"n8n webhook URL not configured"**
  → Go to Settings page and configure webhook URL


