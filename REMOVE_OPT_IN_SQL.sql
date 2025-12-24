-- ============================================
-- SQL Scripts to Remove Opt-In Requirement
-- ============================================

-- ============================================
-- OPTION 1: Set All Contacts to Opted-In
-- (Keeps the column but sets all to true)
-- ============================================

-- Update all contacts to opted-in
UPDATE contacts 
SET opt_in_status = true,
    opt_in_timestamp = NOW(),
    opt_in_source = 'system_update'
WHERE opt_in_status = false OR opt_in_status IS NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN opt_in_status = true THEN 1 END) as opted_in,
  COUNT(CASE WHEN opt_in_status = false THEN 1 END) as not_opted_in
FROM contacts;

-- ============================================
-- OPTION 2: Remove Opt-In Columns Completely
-- (Removes the columns from the database)
-- ============================================

-- WARNING: This will permanently remove the opt-in columns!
-- Make sure you have a backup before running this!

-- Step 1: Drop the opt_in_status column
ALTER TABLE contacts DROP COLUMN IF EXISTS opt_in_status;

-- Step 2: Drop the opt_in_timestamp column
ALTER TABLE contacts DROP COLUMN IF EXISTS opt_in_timestamp;

-- Step 3: Drop the opt_in_source column
ALTER TABLE contacts DROP COLUMN IF EXISTS opt_in_source;

-- Step 4: Verify columns are removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name LIKE 'opt_in%';

-- ============================================
-- OPTION 3: Remove Only the Check/Filter
-- (Keeps columns but removes the requirement)
-- ============================================

-- This is already done in the code changes above.
-- The columns remain in the database but are no longer used for filtering.
-- No SQL needed - the application code has been updated.

-- ============================================
-- ROLLBACK: Restore Opt-In Columns (if needed)
-- ============================================

-- If you need to restore the columns after removing them:

-- ALTER TABLE contacts 
-- ADD COLUMN opt_in_status BOOLEAN DEFAULT false,
-- ADD COLUMN opt_in_timestamp TIMESTAMPTZ NULL,
-- ADD COLUMN opt_in_source TEXT NULL;

-- ============================================
-- NOTES:
-- ============================================
-- 1. Option 1 is safest - keeps the data structure intact
-- 2. Option 2 permanently removes the columns (cannot be undone without backup)
-- 3. Option 3 is what we've implemented in code - columns exist but aren't used
-- 4. Always backup your database before running DROP COLUMN commands
-- 5. The code changes already remove the opt-in requirement, so Option 3 is complete


