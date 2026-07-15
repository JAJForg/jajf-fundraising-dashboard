import { FundraisingSnapshot, Campaign, Donor, MonthPoint } from "./types";

const TOKEN_URL = "https://oauth2.sky.blackbaud.com/token";
const GIFT_API = "https://api.sky.blackbaud.com/gift/v1";
const CONSTITUENT_API = "https://api.sky.blackbaud.com/constituent/v1";

// JAJF's fiscal year starts October 1. Set FISCAL_YEAR_START_MONTH=1 in env
// vars if this should be a calendar-year org instead (1 = January).
const FISCAL_YEAR_START_MONTH = Number(process.env.FISCAL_YEAR_START_MONTH || 10); // 1-12

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.BLACKBAUD_REFRESH_TOKEN || "",
      client_id: process.env.BLACKBAUD_CLIENT_ID || "",
      client_secret: process.env.BLACKBAUD_CLIENT_SECRET || "",
    }),
  });

  if (!res.ok) {
    throw new Error(`Blackbaud token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  // NOTE: Blackbaud rotates the refresh token on every use. In production,
  // persist data.refresh_token somewhere durable and update
  // BLACKBAUD_REFRESH_TOKEN there, or the next sync will fail once this
  // access token expires and this refresh token has been superseded.
  return data.access_token as string;
}

async function skyFetch(baseUrl: string, path: string, accessToken: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Bb-Api-Subscription-Key": process.env.BLACKBAUD_SUBSCRIPTION_KEY || "",
    },
  });

  if (!res.ok) {
    throw new Error(`Blackbaud API error on ${path}: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function monthLabel(date: Date) {
  return date.toLocaleString("en-US", { month: "short" });
}

// Returns the start date of the current fiscal year, and a human label
// like "FY2026 (Oct 1, 2025 – Sep 30, 2026)".
function fiscalYearWindow(now: Date) {
  const startMonthIdx = FISCAL_YEAR_START_MONTH - 1; // JS months are 0-indexed
  const startYear = now.getMonth() >= startMonthIdx ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(startYear, startMonthIdx, 1);
  const end = new Date(startYear + 1, startMonthIdx, 0); // day before next FY starts
  const fyLabel = `FY${startYear + 1}`; // JAJF convention: FY named for the year it ends in
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return {
    start,
    label: `${fyLabel} (${fmt(start)} – ${fmt(end)})`,
  };
}

// A gift counts as a "monthly donor" gift if it's part of a recurring
// giving schedule. Blackbaud's gift `type` field uses "RecurringGift" for
// these — adjust here if JAJF's RE NXT setup tags them differently.
function isRecurringGift(g: any) {
  return g.type === "RecurringGift" || g.recurring_gift_schedule_id;
}

export async function fetchLiveSnapshot(): Promise<FundraisingSnapshot> {
  const accessToken = await getAccessToken();
  const now = new Date();
  const { start: fyStart, label: fiscalYearLabel } = fiscalYearWindow(now);
  const fyStartStr = fyStart.toISOString().slice(0, 10);

  const gifts = await skyFetch(GIFT_API, `/gifts?date_added_from=${fyStartStr}&limit=5000`, accessToken);
  const rows: any[] = gifts.value || [];

  const totalRaisedYTD = rows.reduce((sum, g) => sum + (g.amount?.value || 0), 0);
  const donorCount = new Set(rows.map((g) => g.constituent_id)).size;
  const averageGift = rows.length ? Math.round(totalRaisedYTD / rows.length) : 0;

  const monthlyDonorCount = new Set(
    rows.filter(isRecurringGift).map((g) => g.constituent_id)
  ).size;

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);

  const raisedThisMonth = rows
    .filter((g) => {
      const d = new Date(g.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((sum, g) => sum + (g.amount?.value || 0), 0);

  const raisedLastMonth = rows
    .filter((g) => {
      const d = new Date(g.date);
      return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    })
    .reduce((sum, g) => sum + (g.amount?.value || 0), 0);

  // Top campaigns within the fiscal year
  const campaignTotals = new Map<string, number>();
  for (const g of rows) {
    const name = g.campaign?.description || "General Fund";
    campaignTotals.set(name, (campaignTotals.get(name) || 0) + (g.amount?.value || 0));
  }
  const topCampaigns: Campaign[] = Array.from(campaignTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, raised]) => ({ name, raised, goal: 0 })); // set real goals manually if needed

  // Top donors within the fiscal year, split into two categories:
  //  - General Fund cash gifts (type "Cash", fund "General Fund")
  //  - Gift-in-Kind gifts (type "GiftInKind"), regardless of fund
  // Adjust the fund-name match below if JAJF's General Fund is labeled
  // differently in RE NXT (e.g. "Unrestricted Fund").
  function isGeneralFundCash(g: any) {
    const fundName = (g.fund?.description || "").toLowerCase();
    return g.type === "Cash" && fundName.includes("general fund");
  }
  function isGiftInKind(g: any) {
    const fundName = (g.fund?.description || "").toLowerCase();
    return g.type === "GiftInKind" || fundName.includes("gift in kind");
  }

  async function topDonorsFor(filter: (g: any) => boolean): Promise<Donor[]> {
    const totals = new Map<string, number>();
    for (const g of rows) {
      if (!g.constituent_id || !filter(g)) continue;
      totals.set(g.constituent_id, (totals.get(g.constituent_id) || 0) + (g.amount?.value || 0));
    }
    const topIds = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return Promise.all(
      topIds.map(async ([constituentId, amount]) => {
        try {
          const c = await skyFetch(CONSTITUENT_API, `/constituents/${constituentId}`, accessToken);
          return { name: c.name || c.sort_name || "Unnamed constituent", amount };
        } catch {
          return { name: `Constituent ${constituentId}`, amount };
        }
      })
    );
  }

  const [topDonorsGeneralCash, topDonorsGiftInKind] = await Promise.all([
    topDonorsFor(isGeneralFundCash),
    topDonorsFor(isGiftInKind),
  ]);

  // Last 6 calendar months, for the trend chart (independent of fiscal year)
  const monthlyTrend: MonthPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const amount = rows
      .filter((g) => {
        const gd = new Date(g.date);
        return gd.getMonth() === d.getMonth() && gd.getFullYear() === d.getFullYear();
      })
      .reduce((sum, g) => sum + (g.amount?.value || 0), 0);
    monthlyTrend.push({ month: monthLabel(d), amount });
  }

  return {
    totalRaisedYTD,
    annualGoal: Number(process.env.ANNUAL_GOAL || 1000000),
    donorCount,
    monthlyDonorCount,
    averageGift,
    raisedThisMonth,
    raisedLastMonth,
    lastSynced: new Date().toISOString(),
    isLive: true,
    fiscalYearLabel,
    topCampaigns,
    topDonorsGeneralCash,
    topDonorsGiftInKind,
    monthlyTrend,
  };
}
