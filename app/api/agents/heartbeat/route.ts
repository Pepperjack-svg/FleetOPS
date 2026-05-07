import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { pushMetrics } from "@/lib/agentStore";

// Called by the agent running on the remote server — no session cookie, uses token auth
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-agent-token");
  if (!token) return NextResponse.json({ error: "Missing X-Agent-Token header" }, { status: 401 });

  const server = db.prepare(
    "SELECT id FROM remote_servers WHERE agent_token = ? AND agent_mode = 1"
  ).get(token) as any;
  if (!server) return NextResponse.json({ error: "Invalid or inactive token" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    cpu = 0,
    ramUsedKB = 0,
    ramTotalKB = 1,
    diskUsedKB = 0,
    diskTotalKB = 1,
    rxBytes = 0,
    txBytes = 0,
    hostname = "",
  } = body;

  pushMetrics(server.id, {
    cpu: Math.max(0, Math.min(100, Number(cpu))),
    ramUsedKB: Math.max(0, Number(ramUsedKB)),
    ramTotalKB: Math.max(1, Number(ramTotalKB)),
    diskUsedKB: Math.max(0, Number(diskUsedKB)),
    diskTotalKB: Math.max(1, Number(diskTotalKB)),
    rxBytes: Math.max(0, Number(rxBytes)),
    txBytes: Math.max(0, Number(txBytes)),
    hostname: String(hostname),
  });

  return NextResponse.json({ ok: true });
}
