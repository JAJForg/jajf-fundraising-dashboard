import { NextRequest, NextResponse } from "next/server";
import { signValue } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { role, password } = await req.json();

  const expected =
    role === "team"
      ? process.env.TEAM_PASSWORD
      : role === "board"
      ? process.env.BOARD_PASSWORD
      : null;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const signed = await signValue(role);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("jajf_session", signed, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
