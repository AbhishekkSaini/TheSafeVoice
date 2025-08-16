Environment
-----------

Create a `.env.local` in `web/` with:

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

Deploy on Vercel
----------------

- Import this project on Vercel
- Add the two env vars above in Project Settings → Environment Variables
- Set build command: `npm run build`
- Set output: default


