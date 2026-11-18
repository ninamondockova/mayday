# LIVE VOTE — real-time classroom voting

Scan a QR code → tap A or B → see the results live on every phone.
No app, no account, no room code to type.

Everything happens on phones — the projector shows **only the QR code**.

- **Projector** (`/s/<SESSION>`): just a big QR code and the short link under it. Double-click or press **F** for fullscreen.
- **Host panel on the teacher's phone** (`/`): passcode → live joined/voted counters, live A/B split, start/close voting,
  reveal results, new session, and the link for the projector (copy / open).
- **Participant phones** (`/v/<SESSION>`): one tap to vote, "Your vote has been counted!", "Voting is closed",
  and the animated results with the winner (or "It's a tie") once the host reveals them.
- **Stack:** React 18 + Vite, Supabase (Postgres + Realtime), `qrcode.react`, plain CSS. Deploys to Vercel.

---

## 1. How it works

```
 Phone ──rpc join_session / cast_vote──▶ Postgres functions (SECURITY DEFINER)
                                             │  validate state, block duplicates,
                                             │  update counters atomically
 Host ──rpc create_session / set_session_status (needs passcode / host secret)
                                             ▼
                                   public.sessions (1 row per session)
                                             │ Supabase Realtime (postgres_changes)
                         ┌───────────────────┴───────────────────┐
                    Host screen                          every phone
```

- **One row per session** (`public.sessions`) holds `status`, `joined_count`, `votes_a`, `votes_b`, `version`.
  Everyone subscribes to that row, so 50+ devices get updates instantly with almost no load.
- **Individual votes, participants and secrets** live in the `private` schema, which the browser can't reach at all.
- **The browser can never write tables directly.** Row Level Security allows only `SELECT` on `sessions`;
  every change goes through five Postgres functions that check everything server-side:

| Function | Who | What it checks |
|---|---|---|
| `create_session(passcode)` | host | passcode hash (stored in DB, never in frontend) → returns session id + random host secret |
| `verify_host(id, secret)` | host | secret still valid (used after a page reload) |
| `set_session_status(id, secret, status)` | host | host secret (SHA-256 hash compared in DB) |
| `join_session(id, participant_id)` | phone | session exists; registers once; returns the participant's previous vote |
| `cast_vote(id, participant_id, choice)` | phone | status is `voting`; choice is A/B; **one vote per participant** (primary key) |

- **Participant identity:** a random UUID kept in `localStorage`. Refreshing the page restores the vote from the server
  (`join_session` returns it), and the database rejects a second vote even if someone calls the API directly.
- **Reconnects:** Supabase Realtime reconnects automatically; additionally the app re-fetches when a phone wakes up,
  regains focus or comes back online, and runs a slow safety poll. A `version` counter prevents stale updates from overwriting newer ones.
- **States:** `WAITING → VOTING → CLOSED → RESULTS` (host can also reopen voting or hide results).

---

## 2. Change the question

Edit **`src/config/poll.js`**:

```js
export const POLL = {
  question: 'What should we do next?',
  questionHighlight: 'next?',   // part with the lime marker
  options: {
    A: { label: 'Survive the storm', tone: 'storm' },
    B: { label: 'Abandon the ship', tone: 'calm' },
  },
};
```

Commit/push → Vercel redeploys. Start a **new session** after changing the question.

---

## 3. Supabase setup (≈5 min)

1. Create a free project at [supabase.com](https://supabase.com) → **New project**.
2. Open **SQL Editor** → **New query** → paste the whole file
   `supabase/migrations/20261116000000_class_vote.sql` → **Run**.
   (It is safe to run again.)
3. Set your host passcode — in a new SQL query run:
   ```sql
   select private.set_host_passcode('choose-a-strong-passcode');
   ```
   Run it again any time to change the passcode. Only its SHA-256 hash is stored.
4. Check Realtime: **Database → Publications → `supabase_realtime`** should list `sessions`
   (the migration adds it automatically).
5. Copy your keys: **Project Settings → API** (or the **Connect** button):
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` public key (or the newer `sb_publishable_…` key) → `VITE_SUPABASE_ANON_KEY`

> ⚠️ Never use the `service_role` / secret key in this app. It isn't needed anywhere.

*Using the Supabase CLI instead?* `supabase link` and `supabase db push` will apply the migration from `supabase/migrations`.

---

## 4. Run locally

Requires Node 18.18+.

```bash
npm install
cp .env.example .env.local     # fill in the two Supabase values
npm run dev
```

- Host screen: http://localhost:5173
- `npm run dev` uses `--host`, so phones on the **same Wi-Fi** can open the QR link if you open the host screen via your
  computer's network IP (e.g. `http://192.168.1.20:5173`) instead of `localhost`.
  If the QR code points to `localhost`, the host screen shows a yellow warning.

---

## 5. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Framework: **Vite** (auto-detected;
   `vercel.json` is included).
3. **Environment Variables** (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_APP_URL` *(optional)* — e.g. `https://your-app.vercel.app`.
     Leave empty to use the address the host screen is opened from (recommended when you open the host screen on the
     deployed site).
4. **Deploy.** Open `https://your-app.vercel.app` on your phone, enter the passcode, then open the "Big screen" link on the projector.

`vercel.json` rewrites every path to `index.html`, so `/v/ABC123` links work on refresh.

Changed an env variable? Redeploy (Vite bakes them in at build time).

---

## 6. Run a vote in class

1. On **your phone**, open the site (e.g. `https://your-app.vercel.app`) → enter the host passcode → **Open voting room**.
2. In the **Big screen** card tap **Copy link** (or **Open ↗**) and open that `/s/…` link on the projector laptop.
   It shows only the QR code. Press **F** for fullscreen.
3. Students scan the QR code; the "Joined so far" counter on your phone goes up live.
4. **Start voting** → students' phones show the A / B buttons. Your phone shows joined vs. voted and the live split.
5. **Close voting** → students see "Voting is closed".
6. **Reveal results** → results with animated bars and the winner appear on every phone.
7. **New session** (asks for the passcode) → new room and a new QR link for the projector.

Reloading your phone resumes the same session (the host secret is kept in that browser's `localStorage`).
Don't open the host panel on the projector laptop — the host controls belong on your phone only.

## 7. Test with multiple devices

1. Deploy (or run locally on the same Wi-Fi as above).
2. Host panel on one phone, the `/s/…` QR page on a laptop; scan the QR with 2–3 more phones (iPhone Safari + Android Chrome).
3. Check:
   - The joined counter on the host phone rises with every new phone (refreshing the same phone does **not** add to it).
   - Before **Start voting**, phones show "GET READY".
   - Vote on each phone → "YOUR VOTE HAS BEEN COUNTED!", the host phone's "Voted" count updates instantly.
   - Refresh a phone that voted → still shows the confirmation, no buttons.
   - Lock a phone for a minute, unlock → it catches up with the current state.
   - Close voting → a new phone that scans now sees "VOTING IS CLOSED".
   - Reveal → percentages add up to 100 %, winner is highlighted.
4. Extra devices without phones: open the `/v/…` link in several **private/incognito windows** — each one is a new
   participant.
5. Verify in Supabase → **Table Editor**: `sessions` shows the counters; `private.votes` holds one row per voter.

### Tested before delivery
- The SQL migration was run (twice) on PostgreSQL with Supabase-style `anon`/`authenticated` roles: browser roles are
  denied all direct table writes and access to `private`; wrong passcode/host secret rejected; votes outside the
  `voting` state rejected; **60 concurrent voters + 5 simultaneous duplicate attempts** from one participant →
  counters exactly match stored votes and the duplicate was counted once.
- The UI was bundled and driven end-to-end in headless Chromium (host + several phone viewports) through all states.

---

## 8. Limits & notes

- **No accounts by design.** A determined student could open the link in a new private window to get a new anonymous id
  and vote again — that's the trade-off of "no login". The server still blocks re-voting from the same browser,
  including via direct API calls. For stricter control you'd need logins or one-time codes.
- **Capacity:** each vote is one tiny function call and one row update; Supabase's free tier handles a class of 50–200
  easily. All clients listen to a single row, so Realtime traffic stays small.
- **Fonts:** Fraunces (headlines) + DM Sans (UI) from Google Fonts (falls back to system fonts offline).
- Old sessions can be deleted in the Table Editor (`sessions`) — related secrets, participants and votes are removed
  automatically (`on delete cascade`).

---

## Project structure

```
├── index.html
├── vercel.json                 SPA rewrites for Vercel
├── .env.example
├── supabase/migrations/        database schema, RLS, functions, realtime
└── src/
    ├── config/poll.js          ← the question and answers
    ├── lib/supabase.js         client + RPC helper + friendly errors
    ├── lib/storage.js          participant id, host secret (localStorage)
    ├── lib/results.js          percentages, winner, QR URL
    ├── hooks/useLiveSession.js realtime subscription + reconnect logic
    ├── screens/HostApp.jsx     host control panel (phone)
    ├── screens/ScreenPage.jsx  projector: QR code only
    ├── screens/VotePage.jsx    participant flow
    ├── components/             QR, pills, animated numbers, result bars
    └── styles.css
```
