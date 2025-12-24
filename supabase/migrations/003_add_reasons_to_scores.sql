-- Add reasons column to scores table
ALTER TABLE scores ADD COLUMN IF NOT EXISTS reasons TEXT[] DEFAULT '{}';





