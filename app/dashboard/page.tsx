"use client";

import { useState, useEffect } from "react";
import {
  LayoutGrid, List, Activity, Terminal as TerminalIcon,
  Server, Monitor, Wifi, HardDrive, AlertCircle, Loader2,
} from "lucide-react";
import SSHConsole from "@/components/Terminal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemoteServer {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  status?: string;
  ssh_key_name?: string | null;
  ssh_key_id?: number | null;
  description?: string;
}

interface LiveStats {
  cpu: number;
  ram: number;
  diskUsed: number;
  diskTotal: number;
  cpuHist: number[];
  ramHist: number[];
  state: "loading" | "live" | "error";
  hostname?: string;
}

type ViewMode = "grid" | "list";

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div style={{ height: 26 }} className="w-full" />;
  const W = 200, H = 26;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (Math.max(0, Math.min(100, v)) / 100) * (H - 4) - 2;
    return [x, y] as [number, number];
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 26 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Inline bar (list view) ───────────────────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-14 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Disk bar ─────────────────────────────────────────────────────────────────

function DiskBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const color = pct > 90 ? "#f87171" : pct > 70 ? "#fb923c" : "#4b5563";
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1 text-neutral-500">
          <HardDrive size={10} />
          <span className="text-[10px]">Storage</span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">
          {used.toFixed(1)} / {total.toFixed(1)} GB
        </span>
      </div>
      <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status?: string }) {
  const map: Record<string, string> = {
    connected: "bg-green-400",
    disconnected: "bg-neutral-500",
    error: "bg-red-400",
    auth_failed: "bg-red-400",
    no_key: "bg-yellow-400",
    pending: "bg-blue-400",
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status ?? ""] ?? "bg-neutral-500"}`} />
  );
}

// ─── Stat row (grid) ─────────────────────────────────────────────────────────

function StatRow({
  label, value, color, hist,
}: {
  label: string; value: number; color: string; hist: number[];
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[11px] text-neutral-500">{label}</span>
        <span className="text-[11px] font-mono font-semibold" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <Sparkline data={hist} color={color} />
    </div>
  );
}

// ─── Stat overlay for loading / error ────────────────────────────────────────

function StatsOverlay({ state }: { state: "loading" | "error" }) {
  return state === "loading" ? (
    <div className="flex items-center gap-1.5 text-neutral-600 text-xs py-2 justify-center">
      <Loader2 size={11} className="animate-spin" /> Connecting…
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-red-500 text-xs py-2 justify-center">
      <AlertCircle size={11} /> Unable to fetch stats
    </div>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useHostStats(): LiveStats {
  const [s, setS] = useState<LiveStats>({
    cpu: 0, ram: 0, diskUsed: 0, diskTotal: 0,
    cpuHist: [], ramHist: [], state: "loading",
  });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/monitor");
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!alive) return;
        const cpu = parseFloat(d.cpuUsage) || 0;
        const ramUsed = parseFloat(d.memory?.used) || 0;
        const ramTotal = parseFloat(d.memory?.total) || 1;
        const ram = (ramUsed / ramTotal) * 100;
        setS((p) => ({
          cpu, ram,
          diskUsed: parseFloat(d.disk?.used) || 0,
          diskTotal: parseFloat(d.disk?.total) || 1,
          cpuHist: [...p.cpuHist.slice(-19), cpu],
          ramHist: [...p.ramHist.slice(-19), ram],
          state: "live",
          hostname: d.hostname,
        }));
      } catch {
        if (alive) setS((p) => ({ ...p, state: "error" }));
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return s;
}

function useRemoteStats(serverId: number, delayMs = 0): LiveStats {
  const [s, setS] = useState<LiveStats>({
    cpu: 0, ram: 0, diskUsed: 0, diskTotal: 0,
    cpuHist: [], ramHist: [], state: "loading",
  });

  useEffect(() => {
    let alive = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/monitor/remote?serverId=${serverId}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!alive) return;
        const cpu = parseFloat(d.cpuUsage) || 0;
        const ramUsed = parseFloat(d.memory?.used) || 0;
        const ramTotal = parseFloat(d.memory?.total) || 1;
        const ram = (ramUsed / ramTotal) * 100;
        setS((p) => ({
          cpu, ram,
          diskUsed: parseFloat(d.disk?.used) || 0,
          diskTotal: parseFloat(d.disk?.total) || 1,
          cpuHist: [...p.cpuHist.slice(-19), cpu],
          ramHist: [...p.ramHist.slice(-19), ram],
          state: "live",
        }));
      } catch {
        if (alive) setS((p) => ({ ...p, state: "error" }));
      }
    };

    const delay = setTimeout(() => {
      tick();
      interval = setInterval(tick, 8000);
    }, delayMs);

    return () => {
      alive = false;
      clearTimeout(delay);
      if (interval) clearInterval(interval);
    };
  }, [serverId, delayMs]);

  return s;
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function GridCard({
  title, subtitle, badge, stats, isTailscale, serverForTerminal,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  stats: LiveStats;
  isTailscale?: boolean;
  serverForTerminal?: RemoteServer;
}) {
  const [termOpen, setTermOpen] = useState(false);
  const monitorHref = serverForTerminal
    ? `/dashboard/monitor?serverId=${serverForTerminal.id}`
    : "/dashboard/monitor";

  return (
    <div className={`bg-neutral-900 border rounded-xl flex flex-col transition-colors ${
      termOpen ? "border-neutral-600" : "border-neutral-800 hover:border-neutral-700"
    }`}>
      {/* Header */}
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-neutral-800 border border-neutral-700/60 flex items-center justify-center shrink-0">
              {serverForTerminal
                ? <Server size={12} className="text-blue-400" />
                : <Monitor size={12} className="text-emerald-400" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-white text-xs truncate">{title}</p>
                {isTailscale && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded-full bg-purple-900/40 border border-purple-800/60 text-purple-400">
                    <Wifi size={7} /> TS
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-500 font-mono truncate">{subtitle}</p>
            </div>
          </div>
          {stats.state === "live" && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 pb-2 flex-1">
        {stats.state !== "live" ? (
          <StatsOverlay state={stats.state} />
        ) : (
          <div className="space-y-1.5">
            <StatRow label="CPU" value={stats.cpu} color="#60a5fa" hist={stats.cpuHist} />
            <StatRow label="RAM" value={stats.ram} color="#a78bfa" hist={stats.ramHist} />
          </div>
        )}
      </div>

      {/* Disk */}
      <div className="px-3 pb-3 border-t border-neutral-800/60 pt-2.5">
        {stats.state === "live" ? (
          <DiskBar used={stats.diskUsed} total={stats.diskTotal} />
        ) : (
          <div className="h-5" />
        )}
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex gap-1.5">
        <a
          href={monitorHref}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition font-medium"
        >
          <Activity size={11} /> Monitor
        </a>
        {serverForTerminal ? (
          <button
            onClick={() => setTermOpen((v) => !v)}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md font-medium transition ${
              termOpen
                ? "bg-red-950/50 border border-red-800/60 text-red-400 hover:bg-red-950"
                : "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white"
            }`}
          >
            <TerminalIcon size={11} />
            {termOpen ? "Close" : "Terminal"}
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md border border-neutral-800 text-neutral-700 cursor-default">
            <TerminalIcon size={11} /> Local
          </div>
        )}
      </div>

      {/* Terminal panel */}
      {termOpen && serverForTerminal && (
        <div className="px-3 pb-3">
          <SSHConsole server={serverForTerminal} onClose={() => setTermOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({
  title, subtitle, stats, isTailscale, serverStatus, serverForTerminal,
}: {
  title: string;
  subtitle: string;
  stats: LiveStats;
  isTailscale?: boolean;
  serverStatus?: string;
  serverForTerminal?: RemoteServer;
}) {
  const [termOpen, setTermOpen] = useState(false);
  const monitorHref = serverForTerminal
    ? `/dashboard/monitor?serverId=${serverForTerminal.id}`
    : "/dashboard/monitor";

  return (
    <div className={`bg-neutral-900 border rounded-xl transition-colors ${
      termOpen ? "border-neutral-600" : "border-neutral-800 hover:border-neutral-700"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
        {/* Icon + name */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-48">
          <div className="w-7 h-7 rounded-md bg-neutral-800 border border-neutral-700/60 flex items-center justify-center shrink-0">
            {serverForTerminal
              ? <Server size={13} className="text-blue-400" />
              : <Monitor size={13} className="text-emerald-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <StatusDot status={serverStatus} />
              <p className="text-sm font-semibold text-white truncate">{title}</p>
              {isTailscale && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded-full bg-purple-900/40 border border-purple-800/60 text-purple-400">
                  <Wifi size={8} /> TS
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 font-mono truncate">{subtitle}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {stats.state === "live" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 w-8">CPU</span>
                <MiniBar pct={stats.cpu} color="#60a5fa" />
                <span className="text-xs font-mono text-blue-400 w-10">{stats.cpu.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 w-8">RAM</span>
                <MiniBar pct={stats.ram} color="#a78bfa" />
                <span className="text-xs font-mono text-purple-400 w-10">{stats.ram.toFixed(1)}%</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 font-mono">
                <HardDrive size={11} />
                <span className="text-neutral-400">{stats.diskUsed.toFixed(1)}</span>
                <span>/</span>
                <span>{stats.diskTotal.toFixed(1)} GB</span>
              </div>
            </>
          ) : stats.state === "loading" ? (
            <div className="flex items-center gap-1.5 text-neutral-600 text-xs">
              <Loader2 size={11} className="animate-spin" /> Connecting…
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-red-500 text-xs">
              <AlertCircle size={11} /> Offline
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <a
            href={monitorHref}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition"
          >
            <Activity size={11} /> Monitor
          </a>
          {serverForTerminal && (
            <button
              onClick={() => setTermOpen((v) => !v)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition ${
                termOpen
                  ? "bg-red-950/50 border border-red-800/60 text-red-400"
                  : "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white"
              }`}
            >
              <TerminalIcon size={11} />
              {termOpen ? "Close" : "Terminal"}
            </button>
          )}
        </div>
      </div>

      {/* Terminal panel */}
      {termOpen && serverForTerminal && (
        <div className="px-3 pb-3 border-t border-neutral-800">
          <SSHConsole server={serverForTerminal} onClose={() => setTermOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ─── Host card wrappers ───────────────────────────────────────────────────────

function HostGridCard() {
  const stats = useHostStats();
  return (
    <GridCard
      title={stats.hostname ?? "This Host"}
      subtitle="FleetOPS host machine"
      stats={stats}
    />
  );
}

function HostListRow() {
  const stats = useHostStats();
  return (
    <ListRow
      title={stats.hostname ?? "This Host"}
      subtitle="FleetOPS host machine"
      stats={stats}
    />
  );
}

// ─── Remote server card wrappers ──────────────────────────────────────────────

function RemoteGridCard({ server, index }: { server: RemoteServer; index: number }) {
  const stats = useRemoteStats(server.id, index * 400);
  return (
    <GridCard
      title={server.name}
      subtitle={`${server.username}@${server.host}:${server.port || 22}`}
      stats={stats}
      isTailscale={/^100\./.test(server.host)}
      serverForTerminal={server}
    />
  );
}

function RemoteListRow({ server, index }: { server: RemoteServer; index: number }) {
  const stats = useRemoteStats(server.id, index * 400);
  return (
    <ListRow
      title={server.name}
      subtitle={`${server.username}@${server.host}:${server.port || 22}`}
      stats={stats}
      isTailscale={/^100\./.test(server.host)}
      serverStatus={server.status}
      serverForTerminal={server}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [servers, setServers] = useState<RemoteServer[]>([]);
  const [view, setView] = useState<ViewMode>("grid");

  // Persist view preference
  useEffect(() => {
    const saved = localStorage.getItem("dashboard-view");
    if (saved === "list" || saved === "grid") setView(saved as ViewMode);
  }, []);

  const setViewAndSave = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("dashboard-view", v);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/servers");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setServers(data);
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const total = servers.length + 1; // +1 for host

  return (
    <div className="text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Fleet Dashboard</h1>
          <p className="text-neutral-500 text-sm mt-0.5">
            {total} device{total !== 1 ? "s" : ""} · live metrics
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setViewAndSave("grid")}
            title="Grid view"
            className={`p-1.5 rounded-md transition ${
              view === "grid"
                ? "bg-neutral-700 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewAndSave("list")}
            title="List view"
            className={`p-1.5 rounded-md transition ${
              view === "list"
                ? "bg-neutral-700 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <HostGridCard />
          {servers.map((srv, i) => (
            <RemoteGridCard key={srv.id} server={srv} index={i} />
          ))}
          {servers.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3 border border-dashed border-neutral-800 rounded-xl py-12 text-center">
              <Server size={28} className="text-neutral-700 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">
                No remote servers yet.{" "}
                <a href="/dashboard/remoteservers" className="text-blue-400 hover:underline">Add one</a>
                {" "}or{" "}
                <a href="/dashboard/localdevices" className="text-purple-400 hover:underline">connect a local device</a>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-2">
          <HostListRow />
          {servers.map((srv, i) => (
            <RemoteListRow key={srv.id} server={srv} index={i} />
          ))}
          {servers.length === 0 && (
            <div className="border border-dashed border-neutral-800 rounded-xl py-12 text-center">
              <Server size={28} className="text-neutral-700 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">
                No remote servers yet.{" "}
                <a href="/dashboard/remoteservers" className="text-blue-400 hover:underline">Add one</a>
                {" "}or{" "}
                <a href="/dashboard/localdevices" className="text-purple-400 hover:underline">connect a local device</a>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
