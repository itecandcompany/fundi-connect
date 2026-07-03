# UX Improvement Pass

You picked all four areas, so I'll do one focused polish pass touching each without changing business logic.

## 1. Client booking flow

- `/app/service`: larger, tap-friendly cards with icons, service description, and haptic-style press animation. Show a progress indicator (1/3, 2/3, 3/3) across service → describe → find.
- `/app/describe`: sticky "Continue" bar at the bottom on mobile, character counter, photo thumbnails with remove button, autosave to the flow store as user types.
- `/app/find`: cleaner bottom card with service icon + short summary chip, prominent "Request fundi" CTA, and a soft skeleton while nearby fundis load. Cancel/back link goes to `/app/describe` instead of losing state.

## 2. Fundi dashboard

- Availability toggle becomes a large pill at the top with live status ("Online — visible to clients" / "Offline").
- Incoming request list: each card shows distance, service, short problem summary, and quick "View" — quoting/accept flow opens in a sheet instead of inline noise.
- Active-job panel gets clear stage chips (Accepted → On the way → Arrived → In progress) with the current stage highlighted.
- Empty state ("No requests yet") with an illustration/emoji and a hint about staying online.

## 3. Onboarding & auth

- `/auth`: split into two clear tabs (Sign in / Create account), role picker as two big cards ("I need a fundi" vs "I am a fundi"), inline error messages instead of toast-only.
- `/fundi/setup`: turn into a 3-step mini-wizard (trade → rate & bio → location permission) with a progress bar. Disable "Finish" until required fields are valid.
- First-run tip on `/app/service` for brand new clients (dismissable).

## 4. Global polish

- Consistent page transitions using framer-motion (fade + subtle slide on route change) — respects `prefers-reduced-motion`.
- Standard loading skeletons instead of "Loading…" text on `/app`, `/app/find`, admin routes.
- Global toast styling: success/info/error variants tied to design tokens, positioned top-center on mobile.
- Bottom safe-area padding on all sticky CTAs so nothing sits under the iOS home indicator.
- Add lightweight top nav breadcrumbs on `/app/*` (Service › Describe › Find) so users know where they are.

## Out of scope

- No schema changes.
- No changes to admin drawer/lightbox (already polished).
- No changes to real-time / broadcast / offline queue logic.
- No new features — pure UX/presentation.

Approve and I'll implement in one pass and verify the build.
