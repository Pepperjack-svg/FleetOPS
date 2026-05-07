import { NextRequest, NextResponse } from "next/server";
import { Client } from "ssh2";
import db from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { getMetrics, isOnline } from "@/lib/agentStore";

// ── SSH connection pool ──────────────────────────────────────────────────────
const connCache = new Map<number, Client>();

// Failure backoff — tracks consecutive auth/connect failures per server.
// After 3 failures, stop retrying for 10 minutes so we never trigger fail2ban.
const failBackoff = new Map<number, { count: number; until: number }>();

const BACKOFF_MS = [0, 30_000, 120_000, 600_000]; // 0s, 30s, 2m, 10m

function recordFailure(id: number) {
  const prev = failBackoff.get(id) ?? { count: 0, until: 0 };
  const count = prev.count + 1;
  const delay = BACKOFF_MS[Math.min(count, BACKOFF_MS.length - 1)];
  failBackoff.set(id, { count, until: Date.now() + delay });
}

function resetFailure(id: number) {
  failBackoff.delete(id);
}

function isBackedOff(id: number): boolean {
  const f = failBackoff.get(id);
  return !!f && Date.now() < f.until;
}

function evict(id: number) {
  const c = connCache.get(id);
  if (c) { try { c.end(); } catch {} connCache.delete(id); }
}

async function getConn(server: any, privateKey: string): Promise<Client> {
  const existing = connCache.get(server.id);
  if (existing) return existing;
  const conn = new Client();
  await new Promise<void>((resolve, reject) => {
    conn
      .on("ready", resolve)
      .on("error", (e) => { evict(server.id); reject(e); })
      .connect({
        host: server.host,
        port: server.port || 22,
        username: server.username,
        privateKey,
        readyTimeout: 10000,
        keepaliveInterval: 15000,
      });
  });
  conn.on("close", () => connCache.delete(server.id));
  conn.on("error", () => connCache.delete(server.id));
  connCache.set(server.id, conn);
  return conn;
}

// ── Network rate cache per server ────────────────────────────────────────────
const prevNetCache = new Map<number, { rx: number; tx: number; ts: number }>();
// Linux CPU stat cache for delta-based accuracy
const prevCpuCache = new Map<number, { idle: number; total: number }>();

// ── Remote script execution ──────────────────────────────────────────────────
async function runScript(conn: Client, script: string): Promise<string> {
  return new Promise((resolve) => {
    conn.exec("bash -s", (err, stream) => {
      if (err) return resolve("");
      let out = "";
      stream.on("data", (d: Buffer) => { out += d.toString(); });
      stream.stderr.on("data", () => {}); // suppress stderr noise
      stream.on("close", () => resolve(out));
      stream.write(script);
      stream.end();
    });
  });
}

// ── Cross-OS stat scripts ─────────────────────────────────────────────────────

/** One script that detects OS then emits tagged sections */
const DETECT_SCRIPT = `
OS=$(uname -s 2>/dev/null || echo Windows)
echo "FLEETOPS_OS=$OS"
echo "FLEETOPS_SEP"

case "$OS" in
  Linux)
    # CPU: /proc/stat line 1 — user nice sys idle iowait irq softirq steal
    head -1 /proc/stat 2>/dev/null || echo ""
    echo "FLEETOPS_SEP"
    # Memory: /proc/meminfo
    grep -E '^(MemTotal|MemAvailable|MemFree|Buffers|Cached|SwapTotal|SwapFree):' /proc/meminfo 2>/dev/null
    echo "FLEETOPS_SEP"
    # Disk: root filesystem bytes
    df -B1 / 2>/dev/null | tail -1
    echo "FLEETOPS_SEP"
    # Uptime seconds
    awk '{print $1}' /proc/uptime 2>/dev/null
    echo "FLEETOPS_SEP"
    # Network: /proc/net/dev
    cat /proc/net/dev 2>/dev/null
    echo "FLEETOPS_SEP"
    hostname
    echo "FLEETOPS_SEP"
    nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null || echo not_found
    ;;
  Darwin)
    # CPU: top -l1 gives "CPU usage: X% user, Y% sys, Z% idle"
    top -l1 -s0 -n0 2>/dev/null | grep -i 'cpu usage' | head -1 || echo ""
    echo "FLEETOPS_SEP"
    # Memory: vm_stat page counts + total physical bytes
    vm_stat 2>/dev/null
    echo "FLEETOPS_MEM_SIZE"
    sysctl -n hw.memsize 2>/dev/null || echo 0
    echo "FLEETOPS_SEP"
    # Disk: root filesystem (df -k for portability)
    df -k / 2>/dev/null | tail -1
    echo "FLEETOPS_SEP"
    # Uptime: seconds since boot via sysctl kern.boottime
    sysctl -n kern.boottime 2>/dev/null | grep -oE 'sec = [0-9]+' | awk '{print $3}'
    echo "FLEETOPS_SEP"
    # Network: netstat -ibn (interface byte totals)
    netstat -ibn 2>/dev/null
    echo "FLEETOPS_SEP"
    hostname
    echo "FLEETOPS_SEP"
    echo not_found
    ;;
  *)
    # Fallback for unknown / Windows OpenSSH (PowerShell on Windows uses different shell)
    echo unknown
    ;;
esac
`;

// Windows PowerShell script (run via powershell.exe -Command)
const WIN_SCRIPT = `powershell -NoProfile -Command "
$cpu = (Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$os = Get-WmiObject Win32_OperatingSystem
$disk = Get-WmiObject Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object -First 1
$uptime = (Get-Date) - $os.ConvertToDateTime($os.LastBootUpTime)
$net = Get-WmiObject Win32_PerfRawData_Tcpip_NetworkInterface | Select-Object -First 1
Write-Output 'FLEETOPS_WIN'
Write-Output ('CPU='+$cpu)
Write-Output ('MEM_FREE='+$os.FreePhysicalMemory)
Write-Output ('MEM_TOTAL='+$os.TotalVisibleMemorySize)
Write-Output ('DISK_FREE='+$disk.FreeSpace)
Write-Output ('DISK_SIZE='+$disk.Size)
Write-Output ('UPTIME='+[math]::Round($uptime.TotalSeconds))
Write-Output ('HOST='+$env:COMPUTERNAME)
Write-Output ('NET_RX='+$net.BytesReceivedPersec)
Write-Output ('NET_TX='+$net.BytesSentPersec)
"`;

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseProcStat(line: string): { idle: number; total: number } {
  // cpu user nice system idle iowait irq softirq steal guest guest_nice
  const nums = line.replace(/^cpu\s+/, "").trim().split(/\s+/).map(Number);
  const total = nums.reduce((a, b) => a + b, 0);
  const idle = nums[3] + (nums[4] ?? 0); // idle + iowait
  return { idle, total };
}

function parseLinux(parts: string[], serverId: number): Record<string, any> {
  const [cpuLine = "", memLines = "", diskLine = "", uptimeLine = "", netLines = "", hostnameOut = "", gpuOut = ""] = parts;

  // CPU via /proc/stat delta
  const curr = parseProcStat(cpuLine);
  const prev = prevCpuCache.get(serverId);
  let cpuUsage = "0.0";
  if (prev && curr.total > prev.total) {
    const dTotal = curr.total - prev.total;
    const dIdle = curr.idle - prev.idle;
    cpuUsage = Math.max(0, ((dTotal - dIdle) / dTotal) * 100).toFixed(1);
  }
  prevCpuCache.set(serverId, curr);

  // Memory
  const memMap: Record<string, number> = {};
  for (const line of memLines.split("\n")) {
    const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
    if (m) memMap[m[1]] = parseInt(m[2]) * 1024;
  }
  const memTotal = memMap["MemTotal"] ?? 1;
  const memAvail = memMap["MemAvailable"] ?? (memMap["MemFree"] ?? 0);
  const memUsed = memTotal - memAvail;

  // Disk
  const diskParts = diskLine.trim().split(/\s+/);
  const diskTotal = parseInt(diskParts[1]) || 1;
  const diskUsed = parseInt(diskParts[2]) || 0;

  // Uptime
  const uptime = parseFloat(uptimeLine) || 0;

  // Network (cumulative bytes, compute rate via cache)
  let totalRx = 0, totalTx = 0;
  for (const line of netLines.split("\n").slice(2)) {
    if (!line.includes(":") || line.trim().startsWith("lo:")) continue;
    const cols = line.trim().split(/\s+/);
    totalRx += parseInt(cols[1]) || 0;
    totalTx += parseInt(cols[9]) || 0;
  }

  // GPU
  let gpu = null;
  if (gpuOut && !gpuOut.includes("not_found") && !gpuOut.includes("command not found")) {
    const p = gpuOut.trim().split(",").map((s) => s.trim());
    if (p.length >= 3 && !isNaN(Number(p[0]))) {
      gpu = { utilization: p[0], memUsed: p[1], memTotal: p[2] };
    }
  }

  return {
    cpuUsage,
    memory: {
      used: (memUsed / 1024 / 1024 / 1024).toFixed(2),
      total: (memTotal / 1024 / 1024 / 1024).toFixed(2),
    },
    disk: {
      used: (diskUsed / 1024 / 1024 / 1024).toFixed(1),
      total: (diskTotal / 1024 / 1024 / 1024).toFixed(1),
    },
    uptime,
    hostname: hostnameOut.trim(),
    platform: "Linux",
    _netRaw: { rx: totalRx, tx: totalTx },
    gpu,
  };
}

function parseMacOS(parts: string[], serverId: number, serverHost: string): Record<string, any> {
  const [cpuLine = "", memBlock = "", diskLine = "", bootTimeStr = "", netLines = "", hostnameOut = ""] = parts;

  // CPU: "CPU usage: 12.0% user, 8.5% sys, 79.5% idle"
  const idleMatch = cpuLine.match(/(\d+\.?\d*)\s*%\s*idle/i);
  const cpuUsage = idleMatch ? (100 - parseFloat(idleMatch[1])).toFixed(1) : "0.0";

  // Memory: vm_stat + hw.memsize
  const vmLines = memBlock.split("\n");
  const memSizeLine = vmLines[vmLines.indexOf("FLEETOPS_MEM_SIZE") + 1] ?? "0";
  const memTotal = parseInt(memSizeLine) || 1;
  const pageSize = 4096;
  const getPages = (key: string) => {
    const line = vmLines.find((l) => l.includes(key));
    return parseInt(line?.match(/(\d+)/)?.[1] ?? "0") * pageSize;
  };
  const memFree = getPages("Pages free") + getPages("Pages speculative");
  const memUsed = memTotal - memFree;

  // Disk: df -k output (1K blocks)
  const diskParts = diskLine.trim().split(/\s+/);
  const diskTotal = (parseInt(diskParts[1]) || 0) * 1024;
  const diskUsed = (parseInt(diskParts[2]) || 0) * 1024;

  // Uptime
  const bootSec = parseInt(bootTimeStr.trim()) || 0;
  const uptime = bootSec > 0 ? (Date.now() / 1000 - bootSec) : 0;

  // Network: netstat -ibn
  let totalRx = 0, totalTx = 0;
  for (const line of netLines.split("\n")) {
    if (line.startsWith("Name") || line.includes("lo") || !line.trim()) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length >= 10 && (cols[2] === "<Link#1>" || cols[2].startsWith("<Link"))) {
      totalRx += parseInt(cols[6]) || 0;
      totalTx += parseInt(cols[9]) || 0;
    }
  }

  return {
    cpuUsage,
    memory: {
      used: (memUsed / 1024 / 1024 / 1024).toFixed(2),
      total: (memTotal / 1024 / 1024 / 1024).toFixed(2),
    },
    disk: {
      used: (diskUsed / 1024 / 1024 / 1024).toFixed(1),
      total: (diskTotal / 1024 / 1024 / 1024).toFixed(1),
    },
    uptime,
    hostname: hostnameOut.trim() || serverHost,
    platform: "macOS",
    _netRaw: { rx: totalRx, tx: totalTx },
    gpu: null,
  };
}

function parseWindows(raw: string, serverHost: string): Record<string, any> {
  const get = (key: string) => {
    const m = raw.match(new RegExp(`${key}=([\\d.]+)`));
    return m ? parseFloat(m[1]) : 0;
  };
  const memFreeKB = get("MEM_FREE");
  const memTotalKB = get("MEM_TOTAL");
  const diskFree = get("DISK_FREE");
  const diskSize = get("DISK_SIZE");
  const host = raw.match(/HOST=(\S+)/)?.[1] ?? serverHost;

  return {
    cpuUsage: get("CPU").toFixed(1),
    memory: {
      used: ((memTotalKB - memFreeKB) / 1024 / 1024).toFixed(2),
      total: (memTotalKB / 1024 / 1024).toFixed(2),
    },
    disk: {
      used: ((diskSize - diskFree) / 1024 / 1024 / 1024).toFixed(1),
      total: (diskSize / 1024 / 1024 / 1024).toFixed(1),
    },
    uptime: get("UPTIME"),
    hostname: host,
    platform: "Windows",
    _netRaw: { rx: get("NET_RX"), tx: get("NET_TX") },
    gpu: null,
  };
}

function applyNetRate(stats: Record<string, any>, serverId: number) {
  const raw = stats._netRaw as { rx: number; tx: number };
  delete stats._netRaw;
  const now = Date.now();
  const prev = prevNetCache.get(serverId);
  let rxRate = 0, txRate = 0;
  if (prev && now > prev.ts) {
    const dt = (now - prev.ts) / 1000;
    rxRate = Math.max(0, (raw.rx - prev.rx) / dt);
    txRate = Math.max(0, (raw.tx - prev.tx) / dt);
  }
  prevNetCache.set(serverId, { rx: raw.rx, tx: raw.tx, ts: now });

  const fmtNet = (bps: number) => bps >= 1024 * 1024
    ? (bps / 1024 / 1024).toFixed(2)
    : (bps / 1024).toFixed(1);
  const unit = (rxRate >= 1024 * 1024 || txRate >= 1024 * 1024) ? "MB/s" : "KB/s";
  stats.networkIO = { rx: fmtNet(rxRate), tx: fmtNet(txRate), unit };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken || !validateSession(sessionToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serverId = req.nextUrl.searchParams.get("serverId");
  if (!serverId) return NextResponse.json({ error: "serverId required" }, { status: 400 });

  const server = db.prepare("SELECT * FROM remote_servers WHERE id = ?").get(serverId) as any;
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const keyRow = db.prepare("SELECT private_key FROM ssh_keys WHERE id = ?").get(server.ssh_key_id) as any;
  if (!keyRow) {
    return NextResponse.json(
      { error: "No SSH key assigned to this server. Go to Remote Servers to assign a key." },
      { status: 400 }
    );
  }

  const sid = parseInt(serverId);

  // ── Agent mode: serve pushed metrics, never SSH ───────────────────────────
  if (server.agent_mode === 1) {
    const m = getMetrics(sid);
    if (!m) {
      return NextResponse.json(
        { error: "Agent not yet connected. Run the install command on the server." },
        { status: 503 }
      );
    }
    const online = isOnline(sid);
    const fmtNet = (kbs: number) => kbs >= 1024 ? (kbs / 1024).toFixed(2) : kbs.toFixed(1);
    const netUnit = (m.rxRate >= 1024 || m.txRate >= 1024) ? "MB/s" : "KB/s";
    return NextResponse.json({
      cpuUsage: m.cpu.toFixed(1),
      memory: {
        used: m.ramUsed.toFixed(2),
        total: m.ramTotal.toFixed(2),
      },
      disk: {
        used: m.diskUsed.toFixed(1),
        total: m.diskTotal.toFixed(1),
      },
      networkIO: {
        rx: fmtNet(m.rxRate),
        tx: fmtNet(m.txRate),
        unit: netUnit,
      },
      hostname: m.hostname,
      serverName: server.name,
      serverHost: server.host,
      agentMode: true,
      agentOnline: online,
      agentLastSeen: m.lastSeen,
    });
  }

  // ── Backoff guard — stop hammering a server that keeps rejecting auth ─────
  // Prevents triggering fail2ban on the remote host.
  if (isBackedOff(sid)) {
    const f = failBackoff.get(sid)!;
    const secsLeft = Math.ceil((f.until - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Connection paused after repeated failures. Retrying in ${secsLeft}s. Check SSH key and username.` },
      { status: 503 }
    );
  }

  try {
    const conn = await getConn(server, keyRow.private_key);

    // First try Unix script; if output says "Windows" or shell fails, try PowerShell
    let raw = await runScript(conn, DETECT_SCRIPT);

    let stats: Record<string, any>;

    if (raw.includes("FLEETOPS_WIN") || (!raw.includes("FLEETOPS_OS") && !raw.trim())) {
      // Windows via PowerShell
      const winRaw = await new Promise<string>((resolve) => {
        conn.exec(WIN_SCRIPT, (err, stream) => {
          if (err) return resolve("");
          let out = "";
          stream.on("data", (d: Buffer) => { out += d.toString(); });
          stream.stderr.on("data", () => {});
          stream.on("close", () => resolve(out));
        });
      });
      stats = parseWindows(winRaw, server.host);
    } else {
      const osMatch = raw.match(/FLEETOPS_OS=(\S+)/);
      const detectedOS = osMatch?.[1] ?? "Linux";
      // Remove the OS header line then split by separator
      const body = raw.replace(/FLEETOPS_OS=\S+\s*\n?/, "");
      // parts[0] is always "" (before first separator) — skip it with slice(1)
      const parts = body.split("FLEETOPS_SEP").map((s) => s.trim()).slice(1);

      if (detectedOS === "Darwin") {
        stats = parseMacOS(parts, sid, server.host);
      } else {
        // Linux (default for FreeBSD etc. too — /proc/stat based)
        stats = parseLinux(parts, sid);
      }
    }

    applyNetRate(stats, sid);
    resetFailure(sid); // successful poll — clear any backoff
    return NextResponse.json({ ...stats, serverName: server.name, serverHost: server.host });
  } catch (err: any) {
    evict(sid);
    recordFailure(sid); // increment backoff counter
    const msg: string = err.message || "SSH connection failed";
    let friendly = msg;
    if (msg.includes("authentication methods failed") || msg.includes("auth")) {
      friendly = `SSH key authentication failed for ${server.username}@${server.host}. Make sure the public key is in ~/.ssh/authorized_keys on the server. Copy it from the SSH Keys page.`;
    } else if (msg.includes("ECONNREFUSED")) {
      friendly = `Connection refused on ${server.host}:${server.port || 22}. Check the host/port and that SSH is running.`;
    } else if (msg.includes("ETIMEDOUT") || msg.includes("timed out")) {
      friendly = `Connection to ${server.host} timed out. Check network connectivity.`;
    }
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
