# FundiFast

FundiFast connects you with verified plumbers, electricians, carpenters and
mechanics nearby in real time. Built with TanStack Start, React, and
Supabase.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env` with your Supabase project's credentials (Supabase
   dashboard → Project Settings → API). You need both the plain and
   `VITE_`-prefixed versions of the URL and publishable key — see the
   comments in `.env.example` for why.

   This app talks to a hosted Supabase project over the network, so an
   internet connection is required even during local development. If
   `.env` is missing or incomplete, or you have no network access,
   login/signup will fail with a "Failed to fetch" error.

4. Start the dev server:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — preview a production build locally
- `npm run lint` — run ESLint
- `npm run format` — run Prettier
