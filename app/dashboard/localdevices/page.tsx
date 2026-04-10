"use client";

import { useState } from "react";
import {
  Copy, Check, ChevronRight, Wifi, Terminal,
  Plus, ExternalLink, Info,
} from "lucide-react";
import Link from "next/link";

type DeviceType = "pizero2w" | "pi3" | "pi45" | "linux" | "macos";

const DEVICES: { id: DeviceType; label: string; arch: string; os: string; user: string }[] = [
  { id: "pizero2w", label: "Pi Zero 2W", arch: "ARMv6 / ARMv7", os: "Raspberry Pi OS Lite", user: "pi" },
  { id: "pi3",      label: "Pi 3",       arch: "ARMv8 32-bit",  os: "Raspberry Pi OS",      user: "pi" },
  { id: "pi45",     label: "Pi 4 / 5",   arch: "ARM64",         os: "Raspberry Pi OS 64-bit", user: "pi" },
  { id: "linux",    label: "Linux Server / Laptop", arch: "amd64 / arm64", os: "Ubuntu / Debian", user: "ubuntu" },
  { id: "macos",    label: "macOS",      arch: "arm64 / x86_64", os: "macOS 12+",            user: "your-username" },
];

function CopyBlock({ cmd, note }: { cmd: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2 rounded-lg bg-black border border-neutral-800 overflow-hidden">
      <div className="flex items-start justify-between gap-2 p-3">
        <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed flex-1">{cmd}</pre>
        <button
          onClick={copy}
          className="shrink-0 p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition mt-0.5"
          title="Copy"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
      {note && <p className="px-3 pb-2 text-xs text-neutral-500">{note}</p>}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-neutral-300">{n}</span>
        </div>
        <div className="flex-1 w-px bg-neutral-800 mt-2" />
      </div>
      <div className="pb-8 flex-1 min-w-0">
        <p className="font-semibold text-white text-sm mb-1">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default function LocalDevicesPage() {
  const [device, setDevice] = useState<DeviceType>("pi45");
  const dev = DEVICES.find((d) => d.id === device)!;

  const isMac  = device === "macos";
  const isPi   = device !== "linux" && device !== "macos";
  const isLinux = device === "linux";

  const tailscaleInstall = isMac
    ? "brew install tailscale"
    : "curl -fsSL https://tailscale.com/install.sh | sh";

  const tailscaleUp = isMac
    ? "sudo tailscale up"
    : "sudo tailscale up";

  const sshEnable = isMac
    ? "# On macOS:\n# System Settings → General → Sharing → enable Remote Login"
    : isPi
    ? "sudo systemctl enable ssh\nsudo systemctl start ssh"
    : "sudo apt install -y openssh-server\nsudo systemctl enable ssh\nsudo systemctl start ssh";

  const getIP = "tailscale ip -4";

  return (
    <div className="text-white max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-neutral-500 text-sm mb-3">
          <Wifi size={14} />
          <span>Tailscale mesh VPN</span>
        </div>
        <h1 className="text-2xl font-bold">Connect a Local Device</h1>
        <p className="text-neutral-400 text-sm mt-1.5 leading-relaxed">
          Connect Raspberry Pis, laptops, or any local machine to FleetOPS using{" "}
          <span className="text-white font-medium">Tailscale</span> — a free WireGuard-based mesh VPN.
          Once connected, the device appears as a normal server: SSH terminal and metrics work out of the box.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-8 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-400 leading-relaxed">
          <span className="text-white font-medium">How it works: </span>
          Tailscale assigns every device a stable private IP in the{" "}
          <code className="text-green-400 font-mono text-xs">100.x.x.x</code> range.
          Install Tailscale on your Pi/machine and on the host running FleetOPS,
          then register the device&apos;s Tailscale IP as a server. No port forwarding, no firewall rules.
        </div>
      </div>

      {/* Device selector */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Select Device Type</p>
        <div className="flex flex-wrap gap-2">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                device === d.id
                  ? "bg-white text-black border-white"
                  : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:text-white"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-neutral-500">
          <span>Arch: <span className="text-neutral-300">{dev.arch}</span></span>
          <span>OS: <span className="text-neutral-300">{dev.os}</span></span>
          <span>Default user: <span className="font-mono text-neutral-300">{dev.user}</span></span>
        </div>
      </div>

      {/* Steps */}
      <div>
        {/* Step 1 — SSH */}
        <Step n={1} title="Enable SSH on the device">
          <p className="text-sm text-neutral-400 mb-1">
            {isMac
              ? "Enable Remote Login in macOS System Settings."
              : isPi
              ? "Enable the SSH daemon on Raspberry Pi OS."
              : "Install and start the OpenSSH server."}
          </p>
          {isMac ? (
            <div className="mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-400">
              System Settings → General → Sharing → toggle <span className="text-white">Remote Login</span> on
            </div>
          ) : (
            <CopyBlock cmd={sshEnable} />
          )}
          {isPi && (
            <p className="text-xs text-neutral-500 mt-2">
              On a fresh Pi OS install you can also create an empty <code className="font-mono text-neutral-400">ssh</code> file on the boot partition to enable SSH at first boot.
            </p>
          )}
        </Step>

        {/* Step 2 — Install Tailscale on device */}
        <Step n={2} title={`Install Tailscale on the ${dev.label}`}>
          <p className="text-sm text-neutral-400 mb-1">
            {isMac
              ? "Install via Homebrew (or download from tailscale.com)."
              : "The official install script detects your architecture automatically. Works on Pi Zero 2W (ARMv6), Pi 3/4/5 (ARM64), and any Debian/Ubuntu system."}
          </p>
          <CopyBlock
            cmd={tailscaleInstall}
            note={isMac ? undefined : "Supports armv6l, armv7l, arm64, amd64 — detected automatically"}
          />
          <div className="mt-3">
            <p className="text-sm text-neutral-400 mb-1">Then authenticate to your Tailnet:</p>
            <CopyBlock
              cmd={tailscaleUp}
              note="Opens a browser link — paste it on any machine to approve the device"
            />
          </div>
          <div className="mt-3">
            <p className="text-sm text-neutral-400 mb-1">Get the device&apos;s Tailscale IP:</p>
            <CopyBlock
              cmd={getIP}
              note="This is the IP you will register in FleetOPS — stable across reboots"
            />
          </div>
        </Step>

        {/* Step 3 — Tailscale on FleetOPS host */}
        <Step n={3} title="Install Tailscale on the FleetOPS host (one-time)">
          <p className="text-sm text-neutral-400 mb-1">
            The machine running FleetOPS also needs to join the same Tailnet.
            Skip if already done.
          </p>
          <CopyBlock
            cmd={"# On the FleetOPS host machine:\ncurl -fsSL https://tailscale.com/install.sh | sh\nsudo tailscale up"}
            note="Use the same Tailscale account — both devices must be in the same Tailnet"
          />
          <p className="text-xs text-neutral-500 mt-2">
            On macOS (if FleetOPS runs on your Mac):{" "}
            <code className="font-mono text-neutral-400">brew install tailscale && sudo tailscale up</code>
          </p>
        </Step>

        {/* Step 4 — Copy public key */}
        <Step n={4} title="Copy your FleetOPS public key to the device">
          <p className="text-sm text-neutral-400 mb-1">
            Go to SSH Keys, generate or copy your public key, then authorise it on the device.
          </p>
          <div className="mt-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-400">
            Run this on the <span className="text-white">{dev.label}</span> (replace{" "}
            <code className="font-mono text-neutral-300">YOUR_PUBLIC_KEY</code> with the key from FleetOPS):
          </div>
          <CopyBlock
            cmd={`mkdir -p ~/.ssh && echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`}
            note={`FleetOPS SSH Keys page has a one-line install command for each key`}
          />
          <Link
            href="/dashboard/sshkeys"
            className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-400 hover:text-blue-300 transition"
          >
            <ExternalLink size={13} /> Open SSH Keys page
          </Link>
        </Step>

        {/* Step 5 — Register in FleetOPS */}
        <Step n={5} title="Add the device to FleetOPS">
          <p className="text-sm text-neutral-400 mb-1">
            Now register the device. Use the Tailscale IP (
            <code className="font-mono text-green-400 text-xs">100.x.x.x</code>
            ) as the host.
          </p>
          <div className="mt-3 bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <span className="text-neutral-500">Host</span>
              <code className="font-mono text-green-400">100.x.x.x (from tailscale ip -4)</code>
              <span className="text-neutral-500">Port</span>
              <code className="font-mono text-neutral-300">22</code>
              <span className="text-neutral-500">Username</span>
              <code className="font-mono text-neutral-300">{dev.user}</code>
              <span className="text-neutral-500">SSH Key</span>
              <span className="text-neutral-300">Select the key you just authorised</span>
            </div>
          </div>
          <Link
            href="/dashboard/remoteservers"
            className="mt-4 inline-flex items-center gap-2 bg-white text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
          >
            <Plus size={14} /> Add Server in Remote Servers
          </Link>
        </Step>

        {/* Done */}
        <div className="flex gap-4">
          <div className="w-7 h-7 rounded-full bg-green-900/40 border border-green-800 flex items-center justify-center shrink-0">
            <Check size={13} className="text-green-400" />
          </div>
          <div className="pb-4">
            <p className="font-semibold text-white text-sm">Done</p>
            <p className="text-sm text-neutral-400 mt-0.5">
              Your {dev.label} now shows up in Remote Servers. SSH terminal and metrics work exactly like any cloud server.
              The Tailscale IP stays stable across reboots and network changes.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dashboard/remoteservers"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-300 border border-neutral-700 px-3 py-1.5 rounded-lg hover:border-neutral-500 hover:text-white transition"
              >
                <Terminal size={13} /> Remote Servers
              </Link>
              <Link
                href="/dashboard/monitor"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-300 border border-neutral-700 px-3 py-1.5 rounded-lg hover:border-neutral-500 hover:text-white transition"
              >
                <ChevronRight size={13} /> Monitor Device
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-4 border-t border-neutral-800 pt-8 space-y-3">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Tips</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              title: "Pi Zero 2W low memory",
              body: "Use Raspberry Pi OS Lite (no desktop). Tailscale uses ~30MB RAM on idle — fine for the Pi Zero 2W's 512MB.",
            },
            {
              title: "Headless Pi setup",
              body: "Create a wpa_supplicant.conf and empty ssh file on the boot partition before first boot to get SSH + WiFi without a monitor.",
            },
            {
              title: "Tailscale stays connected",
              body: "Tailscale auto-starts on boot via systemd. Your FleetOPS connection survives router reboots and IP changes.",
            },
            {
              title: "Multiple devices",
              body: "Repeat steps 1–2 on each device. Step 3 (FleetOPS host) is one-time only. Each device gets its own 100.x.x.x IP.",
            },
          ].map((tip) => (
            <div key={tip.title} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <p className="text-sm font-medium text-white mb-1">{tip.title}</p>
              <p className="text-xs text-neutral-500 leading-relaxed">{tip.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
