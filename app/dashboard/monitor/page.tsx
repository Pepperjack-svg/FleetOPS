"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface MonitorData {
  cpuUsage: string;
  memory: { used: string; total: string };
  disk: { used: string; total: string };
  networkIO: { rx: string; tx: string };
  hostname: string;
  platform: string;
  uptime: number;
}

export default function MonitorPage() {
  const [stats, setStats] = useState<MonitorData | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  async function fetchData() {
    const res = await fetch("/api/monitor");
    const data = await res.json();
    setStats(data);

    setHistory((prev) => {
      const updated = [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          cpu: +data.cpuUsage,
          mem: +data.memory.used,
          disk: +data.disk.used,
          netIn: +data.networkIO.rx,
          netOut: +data.networkIO.tx,
        },
      ];
      return updated.slice(-25);
    });
  }

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  if (!stats)
    return <p className="text-gray-400 text-center animate-pulse">Loading monitor...</p>;

  return (
    <div className="space-y-6 text-white">
      <h1 className="text-2xl font-semibold mb-2">Monitoring</h1>
      <p className="text-sm text-gray-400 mb-4">
        Host: {stats.hostname} | Platform: {stats.platform} | Uptime:{" "}
        {Math.floor(stats.uptime / 60)}m
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MonitorCard
          title="CPU Usage"
          subtitle={`Used: ${stats.cpuUsage}%`}
          percent={parseFloat(stats.cpuUsage)}
          data={history}
          dataKey="cpu"
          color="#6366f1"
          unit="%"
        />
        <MonitorCard
          title="Memory Usage"
          subtitle={`Used: ${stats.memory.used} / ${stats.memory.total} GiB`}
          percent={(parseFloat(stats.memory.used) / parseFloat(stats.memory.total)) * 100}
          data={history}
          dataKey="mem"
          color="#10b981"
          unit="GiB"
        />
        <MonitorCard
          title="Disk Space"
          subtitle={`Used: ${stats.disk.used} / ${stats.disk.total} GB`}
          percent={(parseFloat(stats.disk.used) / parseFloat(stats.disk.total)) * 100}
          data={history}
          dataKey="disk"
          color="#a855f7"
          unit="GB"
        />
        <MonitorCard
          title="Network I/O"
          subtitle={`In ${stats.networkIO.rx} MB / Out ${stats.networkIO.tx} MB`}
          percent={0} // optional, static look for now
          data={history}
          dataKey="netIn"
          secondaryKey="netOut"
          color="#0ea5e9"
          secondaryColor="#84cc16"
          unit="MB"
        />
      </div>
    </div>
  );
}

// ==========================
// MonitorCard with Progress Bar + Wave Chart
// ==========================
function MonitorCard({
  title,
  subtitle,
  percent,
  data,
  dataKey,
  color,
  unit,
  secondaryKey,
  secondaryColor,
}: {
  title: string;
  subtitle: string;
  percent: number;
  data: any[];
  dataKey: string;
  color: string;
  unit: string;
  secondaryKey?: string;
  secondaryColor?: string;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-md">
      <h2 className="text-sm text-gray-300 mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-2">{subtitle}</p>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-neutral-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Wave Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
              {secondaryKey && (
                <linearGradient id={`color${secondaryKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.05} />
                </linearGradient>
              )}
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              labelFormatter={(value) => `Time: ${value}`}
              formatter={(value) => [`${value}${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#color${dataKey})`}
              strokeWidth={2}
              dot={false}
            />
            {secondaryKey && (
              <Area
                type="monotone"
                dataKey={secondaryKey}
                stroke={secondaryColor}
                fillOpacity={1}
                fill={`url(#color${secondaryKey})`}
                strokeWidth={2}
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
