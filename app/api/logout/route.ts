import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (sessionToken) {
    deleteSession(sessionToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}

// Used by dashboard layout to clear an invalid/expired session and redirect to login
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (sessionToken) {
    try { deleteSession(sessionToken); } catch {}
  }

  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.delete("session");
  return response;
}
