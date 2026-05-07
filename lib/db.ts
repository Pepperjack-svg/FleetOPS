import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "db");
const dbPath = path.join(dbDir, "fleetops.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Sessions table
db.prepare(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

// SSH Keys table
db.prepare(`
  CREATE TABLE IF NOT EXISTS ssh_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    private_key TEXT NOT NULL,
    public_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Remote Servers table
db.prepare(`
  CREATE TABLE IF NOT EXISTS remote_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    host TEXT NOT NULL,
    username TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    ssh_key_id INTEGER,
    status TEXT DEFAULT 'unknown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(id)
  )
`).run();

// Profile columns migration
const userCols = db.prepare("PRAGMA table_info(users)").all() as any[];
if (!userCols.some((c: any) => c.name === "first_name")) {
  db.prepare("ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT ''").run();
}
if (!userCols.some((c: any) => c.name === "last_name")) {
  db.prepare("ALTER TABLE users ADD COLUMN last_name TEXT DEFAULT ''").run();
}
if (!userCols.some((c: any) => c.name === "avatar")) {
  db.prepare("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''").run();
}
if (!userCols.some((c: any) => c.name === "photo")) {
  db.prepare("ALTER TABLE users ADD COLUMN photo TEXT DEFAULT ''").run();
}

// Agent metrics table — stores latest pushed stats per server
db.prepare(`
  CREATE TABLE IF NOT EXISTS agent_metrics (
    server_id INTEGER PRIMARY KEY,
    cpu       REAL DEFAULT 0,
    ram_used  REAL DEFAULT 0,
    ram_total REAL DEFAULT 1,
    disk_used REAL DEFAULT 0,
    disk_total REAL DEFAULT 1,
    rx_rate   REAL DEFAULT 0,
    tx_rate   REAL DEFAULT 0,
    hostname  TEXT DEFAULT '',
    last_seen INTEGER DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES remote_servers(id) ON DELETE CASCADE
  )
`).run();

// Migrations for existing databases
const serverCols = db.prepare("PRAGMA table_info(remote_servers)").all() as any[];
if (!serverCols.some((c: any) => c.name === "status")) {
  db.prepare("ALTER TABLE remote_servers ADD COLUMN status TEXT DEFAULT 'unknown'").run();
}
if (!serverCols.some((c: any) => c.name === "description")) {
  db.prepare("ALTER TABLE remote_servers ADD COLUMN description TEXT").run();
}
if (!serverCols.some((c: any) => c.name === "agent_token")) {
  db.prepare("ALTER TABLE remote_servers ADD COLUMN agent_token TEXT").run();
}
if (!serverCols.some((c: any) => c.name === "agent_mode")) {
  db.prepare("ALTER TABLE remote_servers ADD COLUMN agent_mode INTEGER DEFAULT 0").run();
}
if (!serverCols.some((c: any) => c.name === "created_at")) {
  db.prepare("ALTER TABLE remote_servers ADD COLUMN created_at DATETIME").run();
  db.prepare("UPDATE remote_servers SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL").run();
}

const keyCols = db.prepare("PRAGMA table_info(ssh_keys)").all() as any[];
if (!keyCols.some((c: any) => c.name === "description")) {
  db.prepare("ALTER TABLE ssh_keys ADD COLUMN description TEXT").run();
}
if (!keyCols.some((c: any) => c.name === "public_key")) {
  db.prepare("ALTER TABLE ssh_keys ADD COLUMN public_key TEXT").run();
}

// Add type column to ssh_keys
if (!keyCols.some((c: any) => c.name === "type")) {
  db.prepare("ALTER TABLE ssh_keys ADD COLUMN type TEXT DEFAULT 'ed25519'").run();
}

export default db;
