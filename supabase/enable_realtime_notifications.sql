-- Run in Supabase SQL Editor so the client dashboard receives postgres_changes events.
-- Without this, the browser may show Realtime CHANNEL_ERROR or receive no INSERT/UPDATE payloads.

alter publication supabase_realtime add table public.accidents;
alter publication supabase_realtime add table public.tampering_incidents;

-- If you see "already member of publication", the table was already added — safe to ignore.
