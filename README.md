# Nimba Stay

A small front-desk screen for Nimba Nature Cure: find free rooms for a date range, then book a guest.
A room can never be booked twice for the same night.

Stack: Next.js 14 (App Router) + TypeScript, data in a JSON file, tests with Vitest.

## How to run

```bash
npm install
npm run dev        
npm test           
```

Data lives in `data/db.json`. It is created automatically on first run with 8 seed rooms
(room 103 is in maintenance). Delete the file to reset everything.

## API

| Endpoint | What it does |
|---|---|
| `GET /api/availability?checkIn=&checkOut=&category=` | Free rooms for the whole stay, with `nights` and `totalPrice`. `category` is optional (Standard / Deluxe / Suite). |
| `POST /api/bookings` | Body: `{roomId, guestName, phone, checkIn, checkOut}`. `201` on success. |
| `GET /api/bookings` | Active (non-cancelled) bookings (added, see below). |
| `PATCH /api/bookings/:id` | Cancels a booking (added, see below). |

Errors are `{ "error": "message" }`:
- `400` check-out not after check-in, invalid date, phone not exactly 10 digits, missing name/room, unknown category, bad JSON
- `409` clash with an existing booking, or room in maintenance
- `404` unknown room / booking

## How double-booking is prevented

- A stay is `[checkIn, checkOut)`: the check-out day is not a night stayed. Two stays clash only if
  `existing.checkIn < new.checkOut && new.checkIn < existing.checkOut`. So a guest leaving on 20 Nov
  does not block a guest arriving on 20 Nov.
- Cancelled bookings are skipped in the check. Rooms with status `maintenance` are never listed and cannot be booked.
- The booking flow (read file, check clash, write file) runs in one synchronous block with no `await`
  in between, and the file is replaced atomically (write temp file, rename). Two simultaneous requests
  cannot interleave. Verified with 10 parallel requests for the same room: one `201`, nine `409`.
- The server re-checks everything at booking time, so a stale screen cannot cause a double booking.
  If the screen is stale, the user sees the 409 error and the free-room list refreshes.

## What I added (and why)

1. **Bookings list + Cancel button** (cancelled bookings disappear from the list; they stay in the data file) (`GET /api/bookings`, `PATCH /api/bookings/:id`). The brief has a rule
   about cancelled bookings, but no way to cancel one. Front desk needs it when a guest changes plans.
2. **Required guest name** (400 if empty). A booking without a name is useless at the desk.
3. **Auto-refresh after a 409** so staff immediately see which rooms are really free.
4. **Reset button** next to Search clears dates, category, results and messages.
5. **Date pickers can't select past days** (UI only; the API does not reject past dates, so back-entering is still possible via API).

## What works / what doesn't

Works: availability search with category filter and total price, booking with all validations,
the three clash rules, cancel, error display on screen, 11 automated tests.

Limitations (deliberate, for a 1-hour build):
- JSON file storage is safe for one server process. For several server instances, use a real database
  (e.g. Postgres/SQLite with a transaction or unique constraint).
- No login, no editing of bookings (cancel and rebook instead), no payment handling.
- Prices are a flat per-night rate per room, in INR. No seasonal pricing.
- No time zones: dates are plain calendar days (YYYY-MM-DD).

## Tools used

- Next.js, TypeScript, Vitest, curl for manual API checks.
