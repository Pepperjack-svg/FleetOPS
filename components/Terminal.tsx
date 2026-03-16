"use client";

import { useEffect, useRef, useState } from "react";
import "xterm/css/xterm.css";

interface TerminalProps {
  server: { id: number; name: string; host: string; port?: number; username?: string };
  onClose?: () => void;
}

export default function SSHConsole({ server, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "error" | "disconnected">("connecting");
  const [statusMsg, setStatusMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    let term: any = null;
    let ws: WebSocket | null = null;
    let cancelled = false; // true when this effect instance is cleaned up

    const init = async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");

      // React StrictMode fires cleanup before this resolves on first mount.
      // Bail out so only the second (kept) mount initializes the terminal.
      if (cancelled) return;

      // Clear any stale xterm canvas left by a previous instance in the same div
      if (terminalRef.current) terminalRef.current.innerHTML = "";

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
        theme: {
          background: "#0a0a0a",
          foreground: "#00ff99",
          cursor: "#00ff99",
          selectionBackground: "#00ff9944",
        },
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);

      // Wait for layout so fitAddon calculates correct cols/rows
      requestAnimationFrame(() => {
        if (!cancelled) fitAddon.fit();
      });

      const resizeObserver = new ResizeObserver(() => {
        if (!cancelled) fitAddon.fit();
      });
      if (terminalRef.current) resizeObserver.observe(terminalRef.current);

      term.writeln(
        `\x1b[33mConnecting to ${server.name} (${server.host}:${server.port || 22})...\x1b[0m`
      );

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(
        `${protocol}//${window.location.host}/api/ws/terminal?serverId=${server.id}`
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "data") {
            const binary = atob(msg.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            term.write(bytes);
          } else if (msg.type === "status") {
            if (msg.status === "connected") {
              setStatus("connected");
              setStatusMsg(msg.message || "");
            } else if (msg.status === "closed") {
              setStatus("disconnected");
              setStatusMsg("Session closed");
              term.writeln("\r\n\x1b[31mSSH session closed.\x1b[0m");
            }
          } else if (msg.type === "error") {
            setStatus("error");
            setStatusMsg(msg.message || "Connection error");
            term.writeln(`\r\n\x1b[31mError: ${msg.message}\x1b[0m`);
          }
        } catch {
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        if (!cancelled) setStatus("disconnected");
      };

      ws.onerror = () => {
        if (!cancelled) {
          setStatus("error");
          setStatusMsg("WebSocket connection failed");
          term.writeln("\r\n\x1b[31mWebSocket connection failed.\x1b[0m");
        }
      };

      term.onData((data: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const bytes = new TextEncoder().encode(data);
          let binary = "";
          bytes.forEach((b) => { binary += String.fromCharCode(b); });
          ws.send(JSON.stringify({ type: "data", data: btoa(binary) }));
        }
      });

      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    };

    init();

    return () => {
      cancelled = true;
      if (ws) ws.close();
      if (term) term.dispose();
      wsRef.current = null;
    };
  }, [server.id]);

  const statusColor = {
    connecting: "bg-blue-400 animate-pulse",
    connected: "bg-green-400",
    error: "bg-red-400",
    disconnected: "bg-neutral-500",
  }[status];

  return (
    <div className="w-full border border-neutral-700 rounded-lg bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400 font-mono">
            {server.username ? `${server.username}@` : ""}
            {server.host}:{server.port || 22}
          </span>
          <span className="text-xs text-gray-600">— {server.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {statusMsg && (
            <span className="text-xs text-gray-600 max-w-48 truncate">{statusMsg}</span>
          )}
          {status === "error" && (
            <a
              href="/dashboard/sshkeys"
              className="text-xs text-yellow-400 hover:underline"
            >
              SSH Keys →
            </a>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-neutral-700"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="h-80 p-1" />
    </div>
  );
}
