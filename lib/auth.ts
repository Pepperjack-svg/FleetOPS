import db from "./db";
import bcrypt from "bcryptjs";

export function verifyUser(email: string, password: string) {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as { password: string } | undefined;
  if (!user) return false;
  const valid = bcrypt.compareSync(password, user.password);
  return valid ? user : false;
}
