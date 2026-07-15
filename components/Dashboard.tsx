import { FundraisingSnapshot } from "@/lib/types";
import RefreshButton from "./RefreshButton";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function Dashboard({
  snapshot,
  variant,
}: {
  snapshot: FundraisingSnapshot;
  variant: "team" | "board";
}) {
  const pctToGoal = Math.min(100, Math.round((snapshot.totalRaisedYTD / snapshot.annualGoal) * 100));
  const monthDelta = snapshot.raisedThisMonth - snapshot.raisedLastMonth;
  const monthDeltaPct = snapshot.raisedLastMonth
    ? Math.round((monthDelta / snapshot.raisedLastMonth) * 100)
    : 0;
  const maxTrend = Math.max(...snapshot.monthlyTrend.map((m) => m.amount), 1);

  return (
    <div className="shell">
      <div className="masthead">
        <div>
          <h1 className="display">JAJF Fundraising</h1>
          <div className="sub">
            {variant === "team" ? "Team dashboard" : "Board summary"} · {snapshot.fiscalYearLabel}
          </div>
        </div>
        <span className={`badge ${snapshot.isLive ? "live" : ""}`}>
          {snapshot.isLive ? "Live from Raiser's Edge NXT" : "Sample data — connect Blackbaud to go live"}
        </span>
      </div>

      <div className="hero">
        <div>
          <div className="hero-label display" style={{ fontSize: 15 }}>
            Raised this fiscal year
          </div>
          <p className="hero-figure display">{money(snapshot.totalRaisedYTD)}</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pctToGoal}%` }} />
          </div>
          <div className="progress-meta">
            <span>{pctToGoal}% of annual goal</span>
            <span>Goal: {money(snapshot.annualGoal)}</span>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">This month</div>
            <div className="stat-value">{money(snapshot.raisedThisMonth)}</div>
            <div className={`stat-delta ${monthDelta >= 0 ? "up" : "down"}`}>
              {monthDelta >= 0 ? "▲" : "▼"} {Math.abs(monthDeltaPct)}% vs. last month
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monthly donors</div>
            <div className="stat-value">{snapshot.monthlyDonorCount.toLocaleString()}</div>
          </div>
          {variant === "team" && (
            <>
              <div className="stat-card">
                <div className="stat-label">Total donors, FY</div>
                <div className="stat-value">{snapshot.donorCount.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Average gift</div>
                <div className="stat-value">{money(snapshot.averageGift)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {variant === "team" && (
        <>
          <h2 className="section-title">Top donors — General Fund (cash)</h2>
          <div className="stat-card">
            {snapshot.topDonorsGeneralCash.length === 0 && (
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>No General Fund cash gifts yet this fiscal year.</p>
            )}
            {snapshot.topDonorsGeneralCash.map((d, i) => (
              <div className="campaign-row" key={d.name + i} style={{ gridTemplateColumns: "32px 1fr 110px" }}>
                <span style={{ color: "var(--ink-soft)" }}>{i + 1}</span>
                <span>{d.name}</span>
                <span style={{ textAlign: "right" }}>{money(d.amount)}</span>
              </div>
            ))}
          </div>

          <h2 className="section-title">Top donors — Gift in Kind</h2>
          <div className="stat-card">
            {snapshot.topDonorsGiftInKind.length === 0 && (
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>No Gift-in-Kind donations yet this fiscal year.</p>
            )}
            {snapshot.topDonorsGiftInKind.map((d, i) => (
              <div className="campaign-row" key={d.name + i} style={{ gridTemplateColumns: "32px 1fr 110px" }}>
                <span style={{ color: "var(--ink-soft)" }}>{i + 1}</span>
                <span>{d.name}</span>
                <span style={{ textAlign: "right" }}>{money(d.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">6-month trend</h2>
      <div className="stat-card">
        <div className="trend">
          {snapshot.monthlyTrend.map((m) => (
            <div className="trend-col" key={m.month}>
              <div
                className="trend-bar"
                style={{ height: `${Math.max(6, (m.amount / maxTrend) * 100)}%` }}
                title={money(m.amount)}
              />
              <div className="trend-month">{m.month}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="footer-row">
        <span>Last synced {new Date(snapshot.lastSynced).toLocaleString("en-US")}</span>
        {variant === "team" && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {!snapshot.isLive && <a href="/admin">Connect Blackbaud →</a>}
            <RefreshButton />
          </div>
        )}
      </div>
    </div>
  );
}
