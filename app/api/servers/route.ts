import { NextResponse } from "next/server";
import db from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return validateSession(token);
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const servers = db.prepare(`
      SELECT r.*, s.name as ssh_key_name, s.type as ssh_key_type
      FROM remote_servers r
      LEFT JOIN ssh_keys s ON r.ssh_key_id = s.id
      ORDER BY r.id DESC
    `).all();
    return NextResponse.json(servers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, description, host, username, port, ssh_key_id } = await req.json();
    const result = db.prepare(
      `INSERT INTO remote_servers (name, description, host, username, port, ssh_key_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(name, description || null, host, username, port || 22, ssh_key_id || null);
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, name, description, host, username, port, ssh_key_id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    db.prepare(
      `UPDATE remote_servers
       SET name = ?, description = ?, host = ?, username = ?, port = ?, ssh_key_id = ?
       WHERE id = ?`
    ).run(name, description || null, host, username, port || 22, ssh_key_id || null, id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    db.prepare("DELETE FROM remote_servers WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
