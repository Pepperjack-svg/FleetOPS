import { NextResponse } from "next/server";
import db from "@/lib/db";

// 🟢 Get all SSH Keys
export async function GET() {
  const keys = db.prepare("SELECT * FROM ssh_keys ORDER BY id DESC").all();
  return NextResponse.json(keys);
}

// 🟡 Create SSH Key
export async function POST(req: Request) {
  const { name, privateKey } = await req.json();
  if (!name || !privateKey)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  db.prepare("INSERT INTO ssh_keys (name, private_key) VALUES (?, ?)").run(
    name,
    privateKey
  );
  return NextResponse.json({ success: true });
}

// 🟣 Update SSH Key
export async function PUT(req: Request) {
  const { id, name, privateKey } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  db.prepare("UPDATE ssh_keys SET name = ?, private_key = ? WHERE id = ?").run(
    name,
    privateKey,
    id
  );
  return NextResponse.json({ success: true });
}

// 🔴 Delete SSH Key
export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  db.prepare("DELETE FROM ssh_keys WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
