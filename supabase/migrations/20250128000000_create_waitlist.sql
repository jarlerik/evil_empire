-- Create waitlist table for getpeaktrack.com beta signups
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    training_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for waitlist signups from landing page)
CREATE POLICY "Allow anonymous inserts" ON waitlist
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow authenticated users to read all waitlist entries (for admin purposes)
CREATE POLICY "Allow authenticated read" ON waitlist
    FOR SELECT
    TO authenticated
    USING (true);

-- Create index on email for faster duplicate checking
CREATE INDEX IF NOT EXISTS waitlist_email_idx ON waitlist(email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON waitlist(created_at DESC);
