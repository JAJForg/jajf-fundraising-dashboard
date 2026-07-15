import { FundraisingSnapshot, Campaign, Donor, GiftLine, MonthPoint } from "./types";
import { getStoredRefreshToken, saveRefreshToken } from "./tokenStore";

const TOKEN_URL = "https://oauth2.sky.blackbaud.com/token";
const GIFT_API = "https://api.sky.blackbaud.com/gift/v1";
const CONSTITUENT_API = "https://api.sky.blackbaud.com/constituent/v1";

const FISCAL_YEAR_START_MONTH = Number(process.env.FISCAL_YEAR_START_MONTH || 10);

async function getAccessToken(): Promise<string> {
      const refreshToken = await getStoredRefreshToken();

  const res = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refreshToken,
                    client_id: process.env.BLACKBAUD_CLIENT_ID || "",
                    client_secret: process.env.BLACKBAUD_CLIENT_SECRET || "",
          }),
  });

  if (!res.ok) {
          throw new Error(`Blackbaud token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  if (data.refresh_token) {
          await saveRefreshToken(data.refresh_token);
  }

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

function fiscalYearWindow(now: Date) {
      const startMonthIdx = FISCAL_YEAR_START_MONTH - 1;
      const startYear = now.getMonth() >= startMonthIdx ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(startYear, startMonthIdx, 1);
      const end = new Date(startYear + 1, startMonthIdx, 0);
      const fyLabel = `FY${startYear + 1}`;
      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return {
              start,
              label: `${fyLabel} (${fmt(start)} - ${fmt(end)})`,
      };
}

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

  const campaignTotals = new Map<string, number>();
      for (const g of rows) {
              const name = g.campaign?.description || "General Fund";
              campaignTotals.set(name, (campaignTotals.get(name) || 0) + (g.amount?.value || 0));
      }
      const topCampaigns: Campaign[] = Array.from(campaignTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, raised]) => ({ name, raised, goal: 0 }));

  function fundName(g: any) {
          return (g.fund?.description || "").toLowerCase();
  }
      function appealName(g: any) {
              return (g.appeal?.description || "").toLowerCase();
      }
      function isCashFundGift(g: any) {
              return fundName(g).includes("cash fund");
      }
      function isGiftInKindFund(g: any) {
              return fundName(g).includes("gift-in-kind") || fundName(g).includes("gift in kind");
      }

  function isGeneralFundCash(g: any) {
          return (isCashFundGift(g) && appealName(g).includes("cash")) || g.type === "Cash";
  }
      function isGiftInKind(g: any) {
              return isGiftInKindFund(g) || g.type === "GiftInKind";
      }
      function isCashGift(g: any) {
              return isGeneralFundCash(g);
      }
      function isPledgeGift(g: any) {
              return (isCashFundGift(g) && appealName(g).includes("pledge")) || g.type === "Pledge";
      }
      function isGrantGift(g: any) {
              return (isCashFundGift(g) && appealName(g).includes("grant")) || g.type === "GrantAward";
      }

  const nameCache = new Map<string, string>();
      async function getConstituentName(constituentId: string): Promise<string> {
              if (nameCache.has(constituentId)) return nameCache.get(constituentId)!;
              try {
                        const c = await skyFetch(CONSTITUENT_API, `/constituents/${constituentId}`, accessToken);
                        const name = c.name || c.sort_name || "Unnamed constituent";
                        nameCache.set(constituentId, name);
                        return name;
              } catch {
                        return `Constituent ${constituentId}`;
              }
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
                  topIds.map(async ([constituentId, amount]) => ({
                              name: await getConstituentName(constituentId),
                              amount,
                  }))
                );
  }

  const [topDonorsGeneralCash, topDonorsGiftInKind] = await Promise.all([
          topDonorsFor(isGeneralFundCash),
          topDonorsFor(isGiftInKind),
        ]);

  async function currentMonthListFor(filter: (g: any) => boolean): Promise<GiftLine[]> {
          const filtered = rows
            .filter((g) => {
                        const d = new Date(g.date);
                        return d.getMonth() === thisMonth && d.getFullYear() === thisYear && filter(g);
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return Promise.all(
                  filtered.map(async (g) => ({
                              name: g.constituent_id ? await getConstituentName(g.constituent_id) : "Unknown constituent",
                              date: g.date,
                              amount: g.amount?.value || 0,
                  }))
                );
  }

  const [currentMonthCash, currentMonthPledges, currentMonthGrants] = await Promise.all([
          currentMonthListFor(isCashGift),
          currentMonthListFor(isPledgeGift),
          currentMonthListFor(isGrantGift),
        ]);

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
          currentMonthCash,
          currentMonthPledges,
          currentMonthGrants,
  };
}
