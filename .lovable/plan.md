# Multi-step client booking flow

Today `/app` shows the map and the booking sheet on top of each other. We'll break the client journey into discrete routes, each on its own page, so the user moves forward step by step.

## New route structure

```text
/auth                       (exists) login / signup
/app/service                NEW  choose category (plumber, electrician, phone tech, …)
/app/describe               NEW  describe the problem (text + optional photos)
/app/find                   NEW  full-screen map of nearby fundis + "Request" button
/app                        existing — becomes a redirector that sends the user
                                 to the right step based on their state
```

All `/app/*` routes are gated: if the user isn't logged in, redirect to `/auth`.

## Per-page contents

**`/app/service` — Choose a category**
- Grid of service cards (plumber, electrician, phone technician, …) sourced from `SERVICE_META` in `src/lib/geo.ts`.
- Tapping a card stores the choice and routes to `/app/describe`.

**`/app/describe` — Describe the problem**
- Shows the selected service at the top with a "Change" link back to `/app/service`.
- Textarea for the problem description (required, short min length).
- Optional photo upload (reuses existing photo helpers in `src/lib/jobPhotos.ts`).
- "Continue" button routes to `/app/find`.
- "Back" returns to `/app/service`.

**`/app/find` — Map + request**
- Full-screen `LiveMap` showing the user and all available fundis for the chosen service (existing behaviour).
- Bottom card (not a draggable sheet) shows: service, problem summary, nearest fundi count, and a primary "Request fundi" button.
- Submitting creates the job (same logic that's in `BookingSheet` today) and then routes into the existing active-job tracking UI.
- If an active job already exists, this page shows the live tracking view instead of the request card.

**`/app` — Smart redirector**
- No category chosen → `/app/service`
- Category chosen, no description → `/app/describe`
- Both chosen, no active job → `/app/find`
- Active job exists → `/app/find` (tracking mode)

## State sharing between steps

A tiny client store (Zustand or a React context in `src/lib/bookingFlow.ts`) holds:
- `service: ServiceKey | null`
- `description: string`
- `photoUrls: string[]`

Persisted to `sessionStorage` so a refresh mid-flow doesn't lose progress. Cleared after a job is successfully created.

## Files to add / change

- Add `src/lib/bookingFlow.ts` — flow store + helpers.
- Add `src/routes/app.service.tsx` — category picker.
- Add `src/routes/app.describe.tsx` — problem description + photos.
- Add `src/routes/app.find.tsx` — map + request card (extracts job-creation logic from `BookingSheet`).
- Edit `src/routes/app.tsx` — becomes the redirector / fundi-home shell (the fundi side stays as-is).
- Edit `src/components/LiveMap.tsx` — accept a prop for "request mode" so the embedded `BookingSheet` isn't auto-mounted on `/app/find` (the new bottom card replaces it).
- Keep the fundi role's existing `/app` view (FundiLivePanel) untouched — only the client flow changes.

## Out of scope

- No backend / schema changes.
- No changes to admin routes.
- No changes to the fundi-side experience.
- Lightbox / drawer work from prior turns is untouched.

After you approve, I'll implement and verify the build.