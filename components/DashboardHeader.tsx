"use client";

import { usePathname } from "next/navigation";

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/monitor": "Monitoring",
  "/dashboard/remoteservers": "Remote Servers",
  "/dashboard/sshkeys": "SSH Keys",
};

export default function DashboardHeader() {
  const pathname = usePathname();
  const name = PAGE_NAMES[pathname] ?? "Dashboard";

  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-950 flex items-center px-6 shrink-0">
      <span className="text-sm text-gray-400">FleetOPS</span>
      <span className="mx-2 text-gray-700">/</span>
      <span className="text-sm text-white font-medium">{name}</span>
    </header>
  );
}
