-- Remove anonymous insert policy now that waitlist submissions
-- go through the join-waitlist edge function (which uses the service role key).
DROP POLICY IF EXISTS "Allow anonymous inserts" ON waitlist;
