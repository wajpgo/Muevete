-- Enable RLS
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;

-- Allow everything for authenticated users (or anon if needed, but here we can just use true for simplicity as it's a test/demo)
CREATE POLICY "Allow all operations for trip_requests" 
ON public.trip_requests 
FOR ALL 
USING (true) 
WITH CHECK (true);
