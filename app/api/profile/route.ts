import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

async function getUser(req?: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return validateSession(token);
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = db
    .prepare("SELECT id, email, first_name, last_name, avatar FROM users WHERE id = ?")
    .get(user.id) as any;

  return NextResponse.json(row ?? { error: "Not found" });
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, email, currentPassword, newPassword, avatar } = body;

  // If changing password, verify current password first
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    const row = db.prepare("SELECT password FROM users WHERE id = ?").get(user.id) as any;
    const valid = bcrypt.compareSync(currentPassword, row.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    const hash = bcrypt.hashSync(newPassword, 12);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, user.id);
  }

  // Update profile fields
  if (firstName !== undefined || lastName !== undefined || email !== undefined || avatar !== undefined) {
    const updates: string[] = [];
    const values: any[] = [];

    if (firstName !== undefined) { updates.push("first_name = ?"); values.push(firstName.trim()); }
    if (lastName !== undefined)  { updates.push("last_name = ?");  values.push(lastName.trim()); }
    if (avatar !== undefined)    { updates.push("avatar = ?");     values.push(avatar); }
    if (email !== undefined && email.trim()) {
      // Check uniqueness
      const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email.trim().toLowerCase(), user.id);
      if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      updates.push("email = ?");
      values.push(email.trim().toLowerCase());
    }

    if (updates.length > 0) {
      values.push(user.id);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }
  }

  const updated = db
    .prepare("SELECT id, email, first_name, last_name, avatar FROM users WHERE id = ?")
    .get(user.id) as any;

  return NextResponse.json(updated);
}
