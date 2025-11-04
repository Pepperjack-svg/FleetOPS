import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "db");
const dbPath = path.join(dbDir, "fleetops.db");

// ✅ Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// ✅ Create users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )
`).run();

// ✅ Seed admin user if not exists
const existing = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@fleetops.com");
if (!existing) {
  const hash = bcrypt.hashSync("superpasswd", 10);
  db.prepare("INSERT INTO users (email, password) VALUES (?, ?)").run("admin@fleetops.com", hash);
  console.log("✅ Admin user created: admin@fleetops.com / superpasswd");
}

export default db;
// SSH Keys table
db.prepare(`
  CREATE TABLE IF NOT EXISTS ssh_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    private_key TEXT,
    public_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Remote Servers table
db.prepare(`
  CREATE TABLE IF NOT EXISTS remote_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    host TEXT,
    username TEXT,
    port INTEGER DEFAULT 22,
    ssh_key_id INTEGER,
    FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS ssh_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    private_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();
