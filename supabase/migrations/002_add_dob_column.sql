-- Add DOB column to contacts table if it doesn't exist
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS DOB DATE NULL;





