import { FundraisingSnapshot } from "./types";
import { mockSnapshot } from "./mockData";
import { fetchLiveSnapshot } from "./blackbaud";

// This is the single function every page/route calls to get data.
// It automatically uses live Blackbaud data once BLACKBAUD_REFRESH_TOKEN
// is set, and falls back to mock data (with a clear "Sample data" badge
// on the dashboard) until then — so the dashboard is deployable and
// demoable on day one.
export async function getSnapshot(): Promise<FundraisingSnapshot> {
  const hasCredentials =
    !!process.env.BLACKBAUD_REFRESH_TOKEN &&
    !!process.env.BLACKBAUD_CLIENT_ID &&
    !!process.env.BLACKBAUD_SUBSCRIPTION_KEY;

  if (!hasCredentials) {
    return mockSnapshot;
  }

  try {
    return await fetchLiveSnapshot();
  } catch (err) {
    console.error("Falling back to mock data — Blackbaud fetch failed:", err);
    return { ...mockSnapshot, isLive: false };
  }
}
