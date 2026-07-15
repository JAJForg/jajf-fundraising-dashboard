import { NextRequest, NextResponse } from "next/server";
import { verifyValue } from "@/lib/auth";

function htmlPage(body: string, ok: boolean) {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Blackbaud connection</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #faf8f3; color: #1f2a1c; padding: 48px 24px; max-width: 640px; margin: 0 auto; }
  h1 { color: ${ok ? "#2d5a27" : "#a34b3d"}; font-size: 22px; }
  .box { background: white; border: 1px solid #e4e0d4; border-radius: 10px; padding: 20px; margin: 16px 0; word-break: break-all; font-family: monospace; font-size: 13px; }
  .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b6b54; margin-bottom: 6px; }
  a { color: #2d5a27; }
  button { background: #1a3510; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
</style>
</head>
<body>${body}</body>
</html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stateCookie = req.cookies.get("bb_oauth_state")?.value;

  if (error) {
    return htmlPage(`<h1>Connection cancelled</h1><p>Blackbaud reported: ${error}</p><p><a href="/admin">Back to admin</a></p>`, false);
  }

  if (!code || !state || !stateCookie) {
    return htmlPage(`<h1>Something went wrong</h1><p>Missing code or state. Try connecting again from the admin page.</p><p><a href="/admin">Back to admin</a></p>`, false);
  }

  const verifiedState = await verifyValue(stateCookie);
  if (verifiedState !== state) {
    return htmlPage(`<h1>Security check failed</h1><p>The state parameter didn't match. This can happen if the link sat open too long — try connecting again.</p><p><a href="/admin">Back to admin</a></p>`, false);
  }

  const clientId = process.env.BLACKBAUD_CLIENT_ID || "";
  const clientSecret = process.env.BLACKBAUD_CLIENT_SECRET || "";
  const redirectUri = process.env.BLACKBAUD_REDIRECT_URI || "";

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://oauth2.sky.blackbaud.com/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    return htmlPage(
      `<h1>Token exchange failed</h1><p>Blackbaud returned an error:</p><div class="box">${detail}</div><p><a href="/admin">Back to admin</a></p>`,
      false
    );
  }

  const tokenData = await tokenRes.json();

  const res = htmlPage(
    `<h1>Connected to Raiser's Edge NXT</h1>
     <p>Copy this refresh token into Vercel's environment variables as <code>BLACKBAUD_REFRESH_TOKEN</code>, then redeploy. This is shown only once — if you lose it, just reconnect from the admin page.</p>
     <div class="label">BLACKBAUD_REFRESH_TOKEN</div>
     <div class="box">${tokenData.refresh_token}</div>
     <p>Once that's saved in Vercel and redeployed, <strong>/team</strong> and <strong>/board</strong> will automatically switch from sample data to live data — no other changes needed.</p>
     <p><a href="/admin">Back to admin</a></p>`,
    true
  );
  res.cookies.delete("bb_oauth_state");
  return res;
}
