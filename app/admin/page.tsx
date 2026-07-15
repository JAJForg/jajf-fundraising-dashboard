export default function AdminPage() {
  return (
    <div className="shell">
      <div className="masthead">
        <div>
          <h1 className="display">Admin</h1>
          <div className="sub">Connect the dashboard to Raiser's Edge NXT</div>
        </div>
      </div>

      <div className="stat-card" style={{ maxWidth: 520 }}>
        <p style={{ marginTop: 0 }}>
          Before connecting, make sure these are already set in Vercel's environment
          variables: <code>BLACKBAUD_CLIENT_ID</code>, <code>BLACKBAUD_CLIENT_SECRET</code>,{" "}
          <code>BLACKBAUD_SUBSCRIPTION_KEY</code>, and <code>BLACKBAUD_REDIRECT_URI</code> (should
          match this site's <code>/api/blackbaud/callback</code> URL exactly).
        </p>
        <p>
          Clicking connect will send you to Blackbaud to log in and approve access. You'll be
          redirected back here with a refresh token to save.
        </p>
        <a href="/api/blackbaud/authorize">
          <button className="refresh-btn">Connect Blackbaud</button>
        </a>
      </div>
    </div>
  );
}
