import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import db from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";

async function auth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  return token && validateSession(token);
}

// POST — enable agent mode, create token
export async function POST(req: NextRequest) {
  if (!await auth()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serverId } = await req.json();
  const server = db.prepare("SELECT id FROM remote_servers WHERE id = ?").get(serverId);
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const token = randomBytes(32).toString("hex");
  db.prepare("UPDATE remote_servers SET agent_token = ?, agent_mode = 1 WHERE id = ?").run(token, serverId);

  return NextResponse.json({ token });
}

// DELETE — disable agent mode, revoke token
export async function DELETE(req: NextRequest) {
  if (!await auth()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serverId } = await req.json();
  db.prepare("UPDATE remote_servers SET agent_token = NULL, agent_mode = 0 WHERE id = ?").run(serverId);

  return NextResponse.json({ ok: true });
}
