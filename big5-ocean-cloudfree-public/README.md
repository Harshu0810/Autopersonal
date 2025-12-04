# OCEAN — Public Profiles + Share Links

This package adds:
- Public profiles at `/u/:handle` (shows shared predictions only)
- Public results at `/result/:id` (anyone with link can view)
- Dashboard controls to **share/unshare** predictions and **set your handle**
- RLS updates: anon reads of `profiles (is_public=true)` and `predictions (share=true)`

## Setup
1) In Supabase, run `supabase/schema.sql` (extends tables + policies).
2) Deploy/update Cloudflare Pages as before (React app only; API unchanged).
3) In the app (logged-in):
   - Set your **public handle** and toggle **profile visibility**.
   - Share results from **Dashboard → Your recent predictions** (Share button).
   - Copy profile link: `https://YOUR_DOMAIN/u/yourhandle`.

## Notes
- `public_id` is a random 9-byte base64 for unguessable links.
- Anonymous visitors can view shared content only; private stays private.
