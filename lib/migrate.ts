import db from "./db";

export function ensureMigrations() {
  // Check if "description" exists in remote_servers
  const columns = db.prepare("PRAGMA table_info(remote_servers)").all();
  const hasDescription = columns.some((c: any) => c.name === "description");

  if (!hasDescription) {
    console.log("🛠️ Adding missing column 'description' to remote_servers...");
    db.prepare("ALTER TABLE remote_servers ADD COLUMN description TEXT").run();
  }
}
