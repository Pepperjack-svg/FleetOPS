import db from "./db";

export interface AgentMetrics {
  cpu: number;       // percent 0-100
  ramUsed: number;   // GB
  ramTotal: number;  // GB
  diskUsed: number;  // GB
  diskTotal: number; // GB
  rxRate: number;    // KB/s
  txRate: number;    // KB/s
  hostname: string;
  lastSeen: number;  // ms timestamp
}

// Per-server previous network sample for rate calculation
const prevNet = new Map<number, { rx: number; tx: number; ts: number }>();

export function pushMetrics(serverId: number, data: {
  cpu: number;
  ramUsedKB: number;
  ramTotalKB: number;
  diskUsedKB: number;
  diskTotalKB: number;
  rxBytes: number;
  txBytes: number;
  hostname?: string;
}): void {
  const now = Date.now();

  // Network rate (KB/s)
  let rxRate = 0, txRate = 0;
  const prev = prevNet.get(serverId);
  if (prev && now > prev.ts) {
    const dt = (now - prev.ts) / 1000;
    rxRate = Math.max(0, (data.rxBytes - prev.rx) / dt / 1024);
    txRate = Math.max(0, (data.txBytes - prev.tx) / dt / 1024);
  }
  prevNet.set(serverId, { rx: data.rxBytes, tx: data.txBytes, ts: now });

  // Persist to DB so metrics survive FleetOPS restarts
  db.prepare(`
    INSERT INTO agent_metrics
      (server_id, cpu, ram_used, ram_total, disk_used, disk_total, rx_rate, tx_rate, hostname, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(server_id) DO UPDATE SET
      cpu=excluded.cpu, ram_used=excluded.ram_used, ram_total=excluded.ram_total,
      disk_used=excluded.disk_used, disk_total=excluded.disk_total,
      rx_rate=excluded.rx_rate, tx_rate=excluded.tx_rate,
      hostname=excluded.hostname, last_seen=excluded.last_seen
  `).run(
    serverId,
    data.cpu,
    data.ramUsedKB / 1024 / 1024,   // KB → GB
    data.ramTotalKB / 1024 / 1024,
    data.diskUsedKB / 1024 / 1024,
    data.diskTotalKB / 1024 / 1024,
    rxRate,
    txRate,
    data.hostname ?? "",
    now,
  );
}

export function getMetrics(serverId: number): AgentMetrics | null {
  const row = db.prepare("SELECT * FROM agent_metrics WHERE server_id = ?").get(serverId) as any;
  if (!row) return null;
  return {
    cpu: row.cpu,
    ramUsed: row.ram_used,
    ramTotal: row.ram_total,
    diskUsed: row.disk_used,
    diskTotal: row.disk_total,
    rxRate: row.rx_rate,
    txRate: row.tx_rate,
    hostname: row.hostname,
    lastSeen: row.last_seen,
  };
}

// Agent is considered online if it sent a heartbeat in the last 30 seconds
export function isOnline(serverId: number): boolean {
  const m = getMetrics(serverId);
  return !!m && Date.now() - m.lastSeen < 30_000;
}
