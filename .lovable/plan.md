
## Goal
Transform FundiFast into a Bolt-like ride-hailing experience adapted for fundi services, with a new custom-quote workflow: client describes the problem (with photos), fundis chat to negotiate price, admin can set base problems/prices, and platform deducts 10% per completed job.

## Scope (this round)

### 1. Client experience — Bolt-style booking
- Full-screen LiveMap stays as background; replace top filter strip with a draggable **bottom sheet** that morphs through stages:
  1. **Idle** — service picker (chips), "Where's the problem?" input, photo attach, problem description, "Request fundi" CTA.
  2. **Searching** — pulsing radar animation around user pin, "Finding nearby fundis…", cancel button.
  3. **Quotes incoming** — list of fundis with photo, name, rating, distance, ETA, their proposed price, "Chat" + "Accept" actions.
  4. **Accepted / On the way / Arrived / In progress** — fundi card (avatar, name, rating, vehicle/tools, ETA, distance), call + chat + cancel.
  5. **Completed** — fare breakdown (agreed price − 10% platform fee shown to fundi side; client just sees total), rate stars + review.

### 2. Fundi experience — Bolt-driver style
- Online/offline toggle (large, top of screen).
- Incoming request modal with **countdown timer** (15s) showing client photo, problem description, photos, distance, suggested price → Accept / Reject / Counter-offer.
- Active job sheet mirroring client stages with quick actions (Navigate, Call, Chat, Arrived, Start, Complete).
- Earnings preview chip (today + this week, after 10% commission).

### 3. Custom-quote + chat
- New `job_messages` table (job_id, sender_id, body, created_at) with realtime + RLS for participants.
- New `job_quotes` table (job_id, fundi_id, price, note, status: pending/accepted/declined).
- Job lifecycle adds `quoting` status before `accepted`.
- In-app chat drawer accessible from active job and from quote cards.

### 4. Photos / attachments
- New public `job-photos` storage bucket; client can attach up to 5 photos when posting job; fundi sees them in incoming request.

### 5. Admin: base problems & suggested prices
- New `problem_templates` table (service, title, description, suggested_price, active). Admin role only can insert/update.
- Client booking sheet shows quick-pick problem chips populated from this table for the chosen service.
- Fundi sees template price as a starting suggestion in counter-offer.

### 6. Commission (10%)
- Already in `transactions`. On `completed` status transition, write transaction row: amount = agreed price, commission = 10%, fundi_earnings = 90%. Show fundi earnings + commission breakdown on completion screen.

## Visual direction
FundiFast-branded Bolt-style: dark map, brand-primary accent buttons, pure-white rounded sheets with shadow-elegant, large rounded CTAs, generous padding, system-style typography pairing already in use. New tokens for sheet shadow + radar pulse animation in `src/styles.css`.

## File plan
- `supabase/migrations/...` — add `job_messages`, `job_quotes`, `problem_templates`, `job_photos` columns on `jobs` (text[] of URLs), storage bucket + policies, extend `job_status` enum with `quoting`.
- `src/components/booking/BookingSheet.tsx` — client bottom sheet with all stages.
- `src/components/booking/RadarPulse.tsx` — search animation overlay.
- `src/components/booking/QuoteList.tsx`, `FundiCard.tsx`, `RatingDialog.tsx`.
- `src/components/chat/JobChat.tsx` — realtime chat drawer.
- `src/components/fundi/IncomingRequestModal.tsx`, `FundiOnlineToggle.tsx`, `EarningsChip.tsx`, restructured `FundiLivePanel.tsx`.
- `src/components/admin/ProblemTemplatesAdmin.tsx` + `src/routes/admin.tsx` (admin-only route guarded by `has_role`).
- Refactor `src/components/LiveMap.tsx` to expose minimal map and let `BookingSheet` drive interaction.
- `src/lib/bookingStore.ts` — small Zustand-free reducer hook for booking state.
- `src/styles.css` — radar keyframes, sheet shadow token.

## Out of scope (this round, can follow up)
- Real Google Distance Matrix integration (keeping current OSRM + Haversine ETA).
- Push notifications beyond existing browser API.
- Payments / payouts.
- Map style swap to dark tiles (can do next iteration).

## Notes
- Quietly fix the SSR `window is not defined` error encountered on `/app` while restructuring map/sheet components (guard browser-only code).
- Keep existing realtime subscriptions (`jobs`, `job_locations`) intact and extend them for `job_messages` + `job_quotes`.
