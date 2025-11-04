import { Home, Activity, Server, Key, Bell, User } from "lucide-react";
import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="h-screen w-64 bg-neutral-900 text-gray-300 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="p-4 text-xl font-bold flex items-center gap-2">
          <Server size={20} />
          FleetOps
        </div>

        {/* Navigation */}
        <nav className="px-2">
          {/* Home Section */}
          <p className="text-xs text-gray-500 px-2 mt-2">HOME</p>
          <Link href="/dashboard">
            <div className="px-3 py-2 mt-1 rounded hover:bg-neutral-800 flex items-center gap-2">
              <Home size={16} />
              Dashboard
            </div>
          </Link>
          <Link href="/dashboard/monitor">
            <div className="px-3 py-2 mt-1 rounded hover:bg-neutral-800 flex items-center gap-2">
              <Activity size={16} />
              Monitor
            </div>
          </Link>

          {/* Settings Section */}
          <p className="text-xs text-gray-500 px-2 mt-4">SETTINGS</p>
          <Link href="/dashboard/remoteservers">
            <div className="px-3 py-2 mt-1 rounded hover:bg-neutral-800 flex items-center gap-2">
              <Server size={16} />
              Remote Servers
            </div>
          </Link>
          <Link href="/dashboard/sshkeys">
            <div className="px-3 py-2 mt-1 rounded hover:bg-neutral-800 flex items-center gap-2">
              <Key size={16} />
              SSH Keys
            </div>
          </Link>
          <Link href="/dashboard/notifications">
            <div className="px-3 py-2 mt-1 rounded hover:bg-neutral-800 flex items-center gap-2">
              <Bell size={16} />
              Notifications
            </div>
          </Link>
          <Link href="/dashboard/profile">
            <div className="px-3 py-2 mt-1 rounded hover:bg-neutral-800 flex items-center gap-2">
              <User size={16} />
              Profile
            </div>
          </Link>
        </nav>
      </div>

      {/* Account Section */}
      <div className="p-4 border-t border-neutral-800 text-sm">
        <p className="font-semibold">Account</p>
        <p className="text-gray-400">admin@fleetops.com</p>
      </div>
    </div>
  );
}
