import { NextResponse } from "next/server";
import db from "@/lib/db";
import { ensureMigrations } from "@/lib/migrate";

ensureMigrations(); // 🧠 runs automatically once

export async function GET() {
  try {
    const servers = db.prepare(`
      SELECT rs.*, sk.name AS ssh_key_name
      FROM remote_servers rs
      LEFT JOIN ssh_keys sk ON rs.ssh_key_id = sk.id
    `).all();
    return NextResponse.json(servers);
  } catch (err: any) {
    console.error("GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, host, username, port, ssh_key_id } = await req.json();

    db.prepare(
      `INSERT INTO remote_servers (name, description, host, username, port, ssh_key_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, description, host, username, port, ssh_key_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    db.prepare("DELETE FROM remote_servers WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
