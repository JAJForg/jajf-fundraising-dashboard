import { NextRequest, NextResponse } from "next/server";
import { signValue, randomState } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const clientId = process.env.BLACKBAUD_CLIENT_ID;
  const redirectUri = process.env.BLACKBAUD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new NextResponse(
      "Missing BLACKBAUD_CLIENT_ID or BLACKBAUD_REDIRECT_URI environment variables. Add these in Vercel (Settings → Environment Variables) and redeploy before connecting.",
      { status: 500 }
    );
  }

  const state = randomState();
  const signedState = await signValue(state);

  const authorizeUrl = new URL("https://oauth2.sky.blackbaud.com/authorization");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("bb_oauth_state", signedState, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes — this is a short-lived handshake
    path: "/",
  });
  return res;
}
