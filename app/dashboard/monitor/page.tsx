"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart, Area, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardValue, CardDescription, CardContent } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, MemoryStick, Network, Server } from "lucide-react";

interface MonitorData {
  cpuUsage: string;
  memory: { used: string; total: string };
  disk: { used: string; total: string };
  networkIO?: { rx: string; tx: string; unit: string };
  hostname: string;
  platform?: string;
  uptime: number;
  serverName?: string;
  gpu?: { utilization: string; memUsed: string; memTotal: string } | null;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({
  title, icon, value, description, percent, color,
  history, dataKey, unit, secondaryKey, secondaryColor,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  description: string;
  percent: number;
  color: string;
  history: any[];
  dataKey: string;
  unit: string;
  secondaryKey?: string;
  secondaryColor?: string;
}) {
  const pct = Math.min(Math.max(percent, 0), 100);
  const barColor = pct > 85 ? "#ef4444" : pct > 65 ? "#f59e0b" : color;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            {icon}
            <CardTitle className="text-gray-400 font-medium">{title}</CardTitle>
          </div>
          {percent > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
              pct > 85 ? "bg-red-900/40 text-red-400" :
              pct > 65 ? "bg-yellow-900/40 text-yellow-400" :
              "bg-neutral-800 text-gray-400"
            }`}>
              {pct.toFixed(1)}%
            </span>
          )}
        </div>
        <CardValue style={{ color }}>{value}</CardValue>
        <CardDescription>{description}</CardDescription>
        {percent > 0 && (
          <div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
                {secondaryKey && (
                  <linearGradient id={`fill-${secondaryKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.02} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}${unit}`}
                width={38}
              />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(val: any) => [`${val}${unit}`, title]}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
                fill={`url(#fill-${dataKey})`} dot={false} />
              {secondaryKey && (
                <Area type="monotone" dataKey={secondaryKey} stroke={secondaryColor} strokeWidth={1.5}
                  fill={`url(#fill-${secondaryKey})`} dot={false} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="h-4 w-24 bg-neutral-800 rounded animate-pulse" />
        <div className="h-8 w-32 bg-neutral-800 rounded animate-pulse mt-2" />
        <div className="h-3 w-48 bg-neutral-800 rounded animate-pulse mt-1" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[160px] bg-neutral-800/40 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

function MonitorContent() {
  const searchParams = useSearchParams();
  const serverId = searchParams.get("serverId");

  const [servers, setServers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(serverId);
  const [stats, setStats] = useState<MonitorData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    fetch("/api/servers").then((r) => r.json()).then((d) => setServers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setHistory([]);
    setStats(null);
    setError(null);
    setLive(false);
  }, [selectedId]);

  async function fetchData() {
    try {
      const url = selectedId ? `/api/monitor/remote?serverId=${selectedId}` : "/api/monitor";
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { setError(data.error); setLive(false); return; }
      setError(null);
      setLive(true);
      setStats(data);
      setHistory((prev) => {
        const point = {
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
          cpu: parseFloat(data.cpuUsage) || 0,
          mem: parseFloat(data.memory?.used) || 0,
          memPct: data.memory ? (parseFloat(data.memory.used) / parseFloat(data.memory.total)) * 100 : 0,
          disk: parseFloat(data.disk?.used) || 0,
          diskPct: data.disk ? (parseFloat(data.disk.used) / parseFloat(data.disk.total)) * 100 : 0,
          netIn: parseFloat(data.networkIO?.rx) || 0,
          netOut: parseFloat(data.networkIO?.tx) || 0,
        };
        return [...prev, point].slice(-30);
      });
    } catch {
      setError("Failed to fetch stats");
      setLive(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, selectedId ? 8000 : 4000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const memPct = stats ? (parseFloat(stats.memory.used) / parseFloat(stats.memory.total)) * 100 : 0;
  const diskPct = stats ? (parseFloat(stats.disk.used) / parseFloat(stats.disk.total)) * 100 : 0;

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Monitoring</h1>
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            live ? "border-green-800 bg-green-900/20 text-green-400" : "border-neutral-700 bg-neutral-800/50 text-gray-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-green-400 animate-pulse" : "bg-neutral-500"}`} />
            {live ? "Live" : "Connecting..."}
          </div>
        </div>
        <select
          value={selectedId || ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="bg-neutral-800 border border-neutral-700 text-sm rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-neutral-500"
        >
          <option value="">Local Server</option>
          {servers.map((srv) => (
            <option key={srv.id} value={String(srv.id)}>{srv.name} ({srv.host})</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          <p className="font-medium mb-1">Connection Error</p>
          <p className="text-red-400/80">{error}</p>
          {error.includes("authorized_keys") && (
            <a href="/dashboard/sshkeys" className="inline-block mt-2 text-blue-400 hover:underline text-xs">
              Go to SSH Keys to copy the public key →
            </a>
          )}
        </div>
      )}

      {/* Status bar */}
      {stats && (
        <div className="flex items-center gap-6 text-sm text-gray-500 bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 flex-wrap">
          <span className="flex items-center gap-1.5"><Server size={13} /> <span className="text-gray-300">{stats.hostname}</span></span>
          {stats.platform && <span className="flex items-center gap-1.5"><Activity size={13} /> <span className="text-gray-300">{stats.platform}</span></span>}
          <span>Uptime: <span className="text-gray-300">{formatUptime(stats.uptime)}</span></span>
          {stats.serverName && <span className="text-green-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Remote: {stats.serverName}</span>}
        </div>
      )}

      {/* Skeleton */}
      {!stats && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <StatCard
            title="CPU" icon={<Cpu size={14} />}
            value={`${stats.cpuUsage}%`} description="Current processor utilization"
            percent={parseFloat(stats.cpuUsage)} color="#6366f1"
            history={history} dataKey="cpu" unit="%"
          />
          <StatCard
            title="Memory" icon={<MemoryStick size={14} />}
            value={`${stats.memory.used} GiB`}
            description={`${stats.memory.used} used of ${stats.memory.total} GiB total`}
            percent={memPct} color="#10b981"
            history={history} dataKey="memPct" unit="%"
          />
          <StatCard
            title="Disk" icon={<HardDrive size={14} />}
            value={`${stats.disk.used} GB`}
            description={`${stats.disk.used} used of ${stats.disk.total} GB total`}
            percent={diskPct} color="#a855f7"
            history={history} dataKey="diskPct" unit="%"
          />
          {stats.networkIO && (
            <StatCard
              title="Network I/O" icon={<Network size={14} />}
              value={`↓ ${stats.networkIO.rx} ${stats.networkIO.unit}`}
              description={`↑ ${stats.networkIO.tx} ${stats.networkIO.unit} outbound`}
              percent={0} color="#0ea5e9"
              history={history} dataKey="netIn" unit={` ${stats.networkIO.unit}`}
              secondaryKey="netOut" secondaryColor="#84cc16"
            />
          )}
          {stats.gpu && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity size={14} />
                  <CardTitle className="text-gray-400 font-medium">GPU</CardTitle>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-gray-400 font-mono">
                    {stats.gpu.utilization}%
                  </span>
                </div>
                <CardValue style={{ color: "#f59e0b" }}>{stats.gpu.utilization}%</CardValue>
                <CardDescription>VRAM: {stats.gpu.memUsed} / {stats.gpu.memTotal} MiB</CardDescription>
                <div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all duration-700"
                    style={{ width: `${Math.min(parseFloat(stats.gpu.utilization), 100)}%` }} />
                </div>
              </CardHeader>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1,2,3,4].map(i => <div key={i} className="h-64 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    }>
      <MonitorContent />
    </Suspense>
  );
}
