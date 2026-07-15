export default function Home() {
  return (
    <div className="landing">
      <h1 className="display" style={{ color: "var(--jajf-dark)", fontSize: 32, margin: 0 }}>
        JAJF Fundraising Dashboard
      </h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: 380 }}>
        Choose a view to continue. You'll be asked for the shared password for that group.
      </p>
      <div>
        <a href="/team">Team view</a>
        <a href="/board">Board view</a>
      </div>
    </div>
  );
}
