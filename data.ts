import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST() {
  revalidatePath("/team");
  revalidatePath("/board");
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
