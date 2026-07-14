# JAJF Fundraising Dashboard

A live fundraising KPI dashboard for Jack & Jill Late Stage Cancer Foundation,
pulling data from Raiser's Edge NXT via the Blackbaud SKY API. Two views:

- **/team** — full detail (YTD total, monthly trend, average gift, top campaigns)
- **/board** — summary view, same data, fewer numbers

Both are behind a simple shared password per group. The dashboard runs on
sample data out of the box, so it's fully deployable and viewable before
Blackbaud credentials are ready.

## 1. Deploy it (no Blackbaud needed yet)

1. Create a free account at [vercel.com](https://vercel.com) (sign in with GitHub is easiest).
2. Push this folder to a new GitHub repo — or, in Vercel, choose **Add New → Project → Upload** and drag this folder in directly if you'd rather not use GitHub.
3. In the Vercel project's **Settings → Environment Variables**, add at minimum:
   - `TEAM_PASSWORD` — whatever password you want the team to use
   - `BOARD_PASSWORD` — whatever password you want the board to use
   - `SESSION_SECRET` — any long random string (e.g. run `openssl rand -base64 32` locally, or just mash the keyboard)
4. Click **Deploy**. You'll get a URL like `jajf-dashboard.vercel.app`.

At this point `/team` and `/board` both work and show sample data with a
"Sample data" badge, so you can share it with the team/board right away
while Blackbaud access is being set up.

## 2. Connect live Blackbaud data

**Step A — register the app with Blackbaud**
1. Go to [developer.blackbaud.com](https://developer.blackbaud.com) and register a free application (any RE NXT admin's Blackbaud ID works to sign in).
2. Name it something like "JAJF Fundraising Dashboard."
3. For the redirect URI, enter exactly: `https://YOUR-VERCEL-URL/api/blackbaud/callback`
4. Copy the **Application ID** and **Primary application secret** it gives you.
5. In the developer portal's **My subscriptions** page, request a subscription key for SKY API — copy the Primary key.

**Step B — add credentials to Vercel**
Add these environment variables in Vercel (Settings → Environment Variables), then redeploy:
- `BLACKBAUD_CLIENT_ID` — the Application ID from step A
- `BLACKBAUD_CLIENT_SECRET` — the Primary application secret
- `BLACKBAUD_SUBSCRIPTION_KEY` — the subscription key
- `BLACKBAUD_REDIRECT_URI` — `https://YOUR-VERCEL-URL/api/blackbaud/callback` (must match step A exactly)
- `ANNUAL_GOAL` — e.g. `1000000`

**Step C — connect, the easy way**
1. Visit `https://YOUR-VERCEL-URL/admin` and log in with the team password.
2. Click **Connect Blackbaud**. You'll be sent to Blackbaud to log in and approve access, then redirected back with a refresh token shown on screen.
3. Copy that value into Vercel as `BLACKBAUD_REFRESH_TOKEN`, then redeploy one more time.

That's it — `/team` and `/board` will automatically switch from sample data to
live data (see `lib/data.ts`). If the refresh token ever stops working (Blackbaud
refresh tokens can expire after long periods of inactivity), just revisit
`/admin` and click **Connect Blackbaud** again.

## 3. How the data stays current

- Both dashboard pages cache their data for 15 minutes (`revalidate = 900` in `app/team/page.tsx` and `app/board/page.tsx`) — a good balance between freshness and not hammering the Blackbaud API.
- The **team** view has a "Refresh now" button that forces an immediate re-pull.
- To change the refresh interval, edit the `revalidate` value in those two files (in seconds).

## 4. Adjusting campaign goals

Blackbaud gift records don't carry a "goal" — only actuals. Campaign goals
are set manually. For now, edit `lib/mockData.ts` (sample data) directly;
once live data is connected, add a small goals lookup object in
`lib/blackbaud.ts` where `topCampaigns` is built, keyed by campaign name.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in at least TEAM_PASSWORD, BOARD_PASSWORD, SESSION_SECRET
npm run dev
```

Visit `http://localhost:3000`.

## Brand

Colors and type follow JAJF's established palette: deep green `#2D5A27`,
bright green `#6DB33F`, dark green `#1A3510`, with Fraunces for headlines
and Inter for body/data text (`app/globals.css`).
