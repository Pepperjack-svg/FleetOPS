"use client";

import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Activity, Server, Key, Network,
  ChevronLeft, ChevronRight, LogOut, User, ChevronUp, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const NAV_HOME = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/monitor", icon: Activity, label: "Monitoring", exact: false },
];

const NAV_MANAGE = [
  { href: "/dashboard/remoteservers", icon: Server, label: "Remote Servers", exact: false },
  { href: "/dashboard/sshkeys", icon: Key, label: "SSH Keys", exact: false },
  { href: "/dashboard/localdevices", icon: Network, label: "Local Devices", exact: false },
];

function NavItem({ href, icon: Icon, label, collapsed, active }: {
  href: string; icon: any; label: string; collapsed: boolean; active: boolean;
}) {
  if (collapsed) {
    return (
      <Link href={href} title={label}>
        <div className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors
          ${active ? "bg-neutral-700/80" : "hover:bg-neutral-800/70"}`}>
          <Icon size={20} strokeWidth={1.7} className={active ? "text-white" : "text-neutral-500"} />
        </div>
      </Link>
    );
  }
  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium
        ${active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"}`}>
        <Icon size={16} strokeWidth={1.8} className={active ? "text-white" : "text-neutral-500"} />
        <span>{label}</span>
      </div>
    </Link>
  );
}

export default function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState("Admin");
  const [userAvatar, setUserAvatar] = useState("");  // emoji
  const [userPhoto, setUserPhoto] = useState("");    // base64 data URL
  const [userName, setUserName] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const fetchProfile = () => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        if (d.email) setUserEmail(d.email);
        setUserAvatar(d.avatar ?? "");
        setUserPhoto(d.photo ?? "");
        const name = [d.first_name, d.last_name].filter(Boolean).join(" ");
        setUserName(name);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
    // Re-fetch when profile page saves
    window.addEventListener("profileUpdated", fetchProfile);
    return () => window.removeEventListener("profileUpdated", fetchProfile);
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = () => setCollapsed((v) => {
    localStorage.setItem("sidebar-collapsed", String(!v));
    return !v;
  });

  const handleLogout = async () => {
    setAccountOpen(false);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const initial = userName
    ? userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : userEmail.charAt(0).toUpperCase();

  const AvatarCircle = ({ size = "w-7 h-7", text = "text-xs" }: { size?: string; text?: string }) => (
    <div className={`${size} rounded-full bg-neutral-700 flex items-center justify-center ${text} font-semibold text-white shrink-0 overflow-hidden`}>
      {userPhoto
        ? <img src={userPhoto} alt="avatar" className="w-full h-full object-cover" />
        : userAvatar
        ? <span className="leading-none">{userAvatar}</span>
        : <span>{initial}</span>
      }
    </div>
  );

  /* ── ACCOUNT POPUP ── */
  const AccountPopup = () => (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-[#1a1a1a] border border-neutral-700/80 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <p className="text-sm font-semibold text-white">My Account</p>
        <p className="text-xs text-neutral-500 truncate">{userEmail}</p>
      </div>
      {/* Menu items */}
      <div className="py-1">
        <Link href="/dashboard/profile" onClick={() => setAccountOpen(false)}>
          <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800/70 transition-colors cursor-pointer">
            <User size={14} className="text-neutral-500" />
            Profile
          </div>
        </Link>
        <Link href="/dashboard/remoteservers" onClick={() => setAccountOpen(false)}>
          <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800/70 transition-colors cursor-pointer">
            <Server size={14} className="text-neutral-500" />
            Remote Serv
          </div>
        </Link>
        <Link href="/dashboard/sshkeys" onClick={() => setAccountOpen(false)}>
          <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800/70 transition-colors cursor-pointer">
            <Key size={14} className="text-neutral-500" />
            SSH Keys
          </div>
        </Link>
        <div className="h-px bg-neutral-800 my-1" />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </div>
  );

  /* ── COLLAPSED ── */
  if (collapsed) {
    return (
      <div className="w-[58px] h-[100dvh] bg-[#0f0f0f] flex flex-col items-center border-r border-neutral-800/80 shrink-0 relative overflow-visible">
        {/* Toggle */}
        <button
          onClick={toggle}
          className="hidden md:flex absolute -right-3.5 top-4 z-50 w-7 h-7 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors shadow-lg"
          title="Expand"
        >
          <ChevronRight size={13} />
        </button>

        {/* Logo icon at top */}
        <div className="pt-3 pb-2">
          <img src="/favicon.ico" alt="FleetOPS" className="w-8 h-8 rounded-md" style={{ filter: "invert(1)" }} />
        </div>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2 pt-1">
          {[...NAV_HOME, ...NAV_MANAGE].map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return <NavItem key={item.href} {...item} collapsed active={active} />;
          })}
        </nav>

        {/* Account avatar at bottom */}
        <div className="pb-3">
          <button
            title={userEmail}
            onClick={() => router.push("/dashboard/profile")}
            className="hover:opacity-80 transition-opacity"
          >
            <AvatarCircle size="w-8 h-8" />
          </button>
        </div>
      </div>
    );
  }

  /* ── EXPANDED ── */
  return (
    <div className="w-[240px] h-[100dvh] bg-[#0f0f0f] flex flex-col border-r border-neutral-800/80 shrink-0 relative overflow-visible">
      {/* Toggle */}
      <button
        onClick={toggle}
        className="hidden md:flex absolute -right-3.5 top-4 z-50 w-7 h-7 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors shadow-lg"
        title="Collapse"
      >
        <ChevronLeft size={13} />
      </button>

      {/* Logo */}
      <div className="h-14 flex items-center justify-between border-b border-neutral-800/80 px-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.ico" alt="FleetOPS" className="w-7 h-7 rounded-md" style={{ filter: "invert(1)" }} />
          <span className="font-semibold text-white text-sm tracking-tight">FleetOPS</span>
        </div>
        {/* Close button — only visible on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest px-3 mb-1.5">Home</p>
          <div className="space-y-0.5">
            {NAV_HOME.map((item) => (
              <NavItem key={item.href} {...item} collapsed={false}
                active={item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest px-3 mb-1.5">Manage</p>
          <div className="space-y-0.5">
            {NAV_MANAGE.map((item) => (
              <NavItem key={item.href} {...item} collapsed={false}
                active={pathname === item.href || pathname.startsWith(item.href + "/")} />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer — Account button with popup */}
      <div ref={accountRef} className="shrink-0 border-t border-neutral-800/80 p-2 relative">
        {accountOpen && <AccountPopup />}
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-800/60 transition-colors group"
        >
          <AvatarCircle />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[11px] text-neutral-500 leading-none mb-0.5">{userName || "Account"}</p>
            <p className="text-xs text-white font-medium truncate">{userEmail}</p>
          </div>
          <ChevronUp
            size={14}
            className={`text-neutral-500 transition-transform duration-200 ${accountOpen ? "rotate-180" : ""}`}
          />
        </button>
        <p className="text-[10px] text-neutral-700 px-3 pt-1 pb-0.5">FleetOPS v0.1.0</p>
      </div>
    </div>
  );
}
