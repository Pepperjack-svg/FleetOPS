import si from "systeminformation";
import os from "os";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [cpu, mem, fsList, blockIO, fsStats, networkList] = await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: 0 })),
      si.mem().catch(() => ({ active: 0, total: 1 })),
      si.fsSize().catch(() => []),
      si.disksIO().catch(() => null),
      si.fsStats().catch(() => null),
      si.networkStats().catch(() => []),
    ]);

    const fs = Array.isArray(fsList) && fsList.length > 0 ? fsList[0] : { used: 0, size: 1 };
    const network = Array.isArray(networkList) && networkList.length > 0 ? networkList[0] : { rx_bytes: 0, tx_bytes: 0 };

    // Use whichever BlockIO source is available
    const safeBlock = blockIO && (blockIO.rIO > 0 || blockIO.wIO > 0)
      ? blockIO
      : fsStats
      ? { rIO: fsStats.rx, wIO: fsStats.wx }
      : { rIO: 0, wIO: 0 };

    const data = {
      cpuUsage: cpu.currentLoad?.toFixed(2) ?? "0.00",
      memory: {
        used: (mem.active / 1024 / 1024 / 1024).toFixed(2),
        total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
      },
      disk: {
        used: (fs.used / 1024 / 1024 / 1024).toFixed(1),
        total: (fs.size / 1024 / 1024 / 1024).toFixed(1),
      },
      blockIO: {
        read: (safeBlock.rIO / 1024 / 1024).toFixed(2),
        write: (safeBlock.wIO / 1024 / 1024).toFixed(2),
      },
      networkIO: {
        rx: (network.rx_bytes / 1024 / 1024).toFixed(2),
        tx: (network.tx_bytes / 1024 / 1024).toFixed(2),
      },
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: os.uptime(),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("❌ Monitor API Error:", err);
    return NextResponse.json({ error: "Unable to fetch system stats" }, { status: 500 });
  }
}
