import si from "systeminformation";
import os from "os";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth";

interface Stats {
  cpuUsage: string;
  memory: { used: string; total: string };
  disk: { used: string; total: string };
  networkIO: { rx: string; tx: string; unit: string };
  hostname: string;
  platform: string;
  uptime: number;
}

let cachedStats: Stats | null = null;
let prevNet: { rx: number; tx: number; ts: number } | null = null;

async function collectStats() {
  try {
    const [cpu, mem, fsList, netList] = await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: 0 })),
      si.mem().catch(() => ({ active: 0, available: 0, total: 1, used: 0 })),
      si.fsSize().catch(() => [] as Awaited<ReturnType<typeof si.fsSize>>),
      si.networkStats("*").catch(() => [] as Awaited<ReturnType<typeof si.networkStats>>),
    ]);

    // Memory: use si's own "used" (total - available), accurate on all OSes
    const memUsed = mem.total - mem.available;

    // Disk: pick the largest real filesystem (skip tmpfs, squashfs, etc.)
    const realFs = (Array.isArray(fsList) ? fsList : []).filter(
      (f) => f.size > 0 && !["tmpfs", "squashfs", "devtmpfs", "overlay", "udev"].includes(f.type ?? "")
    );
    const mainFs = realFs.sort((a, b) => b.size - a.size)[0] ?? { used: 0, size: 1 };

    // Network: compute KB/s delta from previous sample
    const allNet = Array.isArray(netList) ? netList : [];
    const totalRx = allNet.reduce((s, n) => s + (n.rx_bytes ?? 0), 0);
    const totalTx = allNet.reduce((s, n) => s + (n.tx_bytes ?? 0), 0);
    const now = Date.now();
    let rxRate = 0, txRate = 0;
    if (prevNet) {
      const dt = (now - prevNet.ts) / 1000; // seconds
      if (dt > 0) {
        rxRate = Math.max(0, (totalRx - prevNet.rx) / dt);
        txRate = Math.max(0, (totalTx - prevNet.tx) / dt);
      }
    }
    prevNet = { rx: totalRx, tx: totalTx, ts: now };

    // Format network: auto-scale to KB/s or MB/s
    const fmtNet = (bps: number) => {
      if (bps >= 1024 * 1024) return (bps / 1024 / 1024).toFixed(2);
      return (bps / 1024).toFixed(1);
    };
    const netUnit = (rxRate >= 1024 * 1024 || txRate >= 1024 * 1024) ? "MB/s" : "KB/s";

    cachedStats = {
      cpuUsage: (cpu.currentLoad ?? 0).toFixed(1),
      memory: {
        used: (memUsed / 1024 / 1024 / 1024).toFixed(2),
        total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
      },
      disk: {
        used: (mainFs.used / 1024 / 1024 / 1024).toFixed(1),
        total: (mainFs.size / 1024 / 1024 / 1024).toFixed(1),
      },
      networkIO: {
        rx: fmtNet(rxRate),
        tx: fmtNet(txRate),
        unit: netUnit,
      },
      hostname: os.hostname(),
      platform: `${os.type()} ${os.arch()}`,
      uptime: os.uptime(),
    };
  } catch (e) {
    console.error("[monitor/local] collect error:", e);
  }
}

// Warm up immediately, then refresh every 3s
collectStats();
setInterval(collectStats, 3000);

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token || !validateSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!cachedStats) await collectStats();
  return NextResponse.json(cachedStats);
}
