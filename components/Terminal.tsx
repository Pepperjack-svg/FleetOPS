"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import "xterm/css/xterm.css";

// ✅ Dynamically import xterm only on the client
const XTerm = dynamic(
  async () => {
    const mod = await import("xterm");
    return mod.Terminal;
  },
  { ssr: false }
);

export default function SSHConsole({ server }: { server: any }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current || !XTerm) return;

    const term = new (XTerm as any)({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#0a0a0a",
        foreground: "#00ff99",
      },
    });

    term.open(terminalRef.current);
    term.writeln(`\x1b[1;32mConnected to ${server.name}\x1b[0m`);

    return () => term.dispose();
  }, [server]);

  return (
    <div className="w-full border border-neutral-800 rounded-lg bg-black p-2">
      <div ref={terminalRef} className="h-80" />
    </div>
  );
}
