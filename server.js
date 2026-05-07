// FleetOPS — custom Next.js server with WebSocket SSH terminal
// Terminal architecture: one ssh2 Client per server, shared across all sessions.
// One TCP connection + one auth handshake per server — fail2ban can never trigger.
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { Client } = require("ssh2");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── DB helpers ────────────────────────────────────────────────────────────────

function getDb(readonly = false) {
  const Database = require("better-sqlite3");
  const dbPath = path.join(process.cwd(), "db", "fleetops.db");
  return new Database(dbPath, { readonly });
}

function getKeyForServer(server) {
  if (!server?.ssh_key_id) return null;
  try {
    const db = getDb(true);
    const row = db.prepare("SELECT private_key FROM ssh_keys WHERE id = ?").get(server.ssh_key_id);
    db.close();
    return row?.private_key || null;
  } catch { return null; }
}

function updateServerStatus(serverId, status) {
  try {
    const db = getDb(false);
    db.prepare("UPDATE remote_servers SET status = ? WHERE id = ?").run(status, serverId);
    db.close();
  } catch {}
}

function validateSession(token) {
  try {
    const db = getDb(true);
    const session = db.prepare(
      `SELECT u.id, u.email FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
    ).get(token);
    db.close();
    return session || null;
  } catch { return null; }
}

function getServerById(serverId) {
  try {
    const db = getDb(true);
    const server = db.prepare("SELECT * FROM remote_servers WHERE id = ?").get(serverId);
    db.close();
    return server || null;
  } catch { return null; }
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=")];
    })
  );
}

function friendlySSHError(err, server) {
  const msg = err?.message || "";
  if (msg.includes("authentication methods failed") || msg.includes("auth")) {
    return `Auth failed for ${server.username}@${server.host}. ` +
      `Make sure the FleetOPS public key is in ~/.ssh/authorized_keys on the server.`;
  }
  if (msg.includes("ECONNREFUSED")) return `Connection refused on ${server.host}:${server.port || 22}. Is SSH running?`;
  if (msg.includes("ETIMEDOUT") || msg.includes("timed out")) return `Connection to ${server.host} timed out.`;
  if (msg.includes("EHOSTUNREACH")) return `Host ${server.host} is unreachable. Check the IP and network.`;
  return `SSH error: ${msg}`;
}

// ── SSH connection pool ───────────────────────────────────────────────────────
// One persistent ssh2 Client per server — shared across all terminal sessions.
// Sessions open shell CHANNELS on the existing connection.
// Result: one TCP handshake + one auth per server. fail2ban-proof.

/**
 * @type {Map<number, {
 *   client: import("ssh2").Client,
 *   ready: boolean,
 *   activeSessions: number,
 *   pendingResolvers: Array<{resolve: Function, reject: Function}>
 * }>}
 */
const sshPool = new Map();

function getPooledConn(server, privateKey) {
  return new Promise((resolve, reject) => {
    const existing = sshPool.get(server.id);

    // Reuse live connection — open another channel, zero auth cost
    if (existing?.ready) {
      return resolve(existing.client);
    }

    // Already connecting — queue behind the in-flight auth
    if (existing && !existing.ready) {
      existing.pendingResolvers.push({ resolve, reject });
      return;
    }

    // No connection — create one
    if (!privateKey) {
      return reject(new Error("No SSH key assigned to this server."));
    }

    const conn = new Client();
    const entry = { client: conn, ready: false, activeSessions: 0, pendingResolvers: [{ resolve, reject }] };
    sshPool.set(server.id, entry);

    conn.on("ready", () => {
      entry.ready = true;
      updateServerStatus(server.id, "connected");
      // Resolve all waiters
      for (const { resolve: res } of entry.pendingResolvers) res(conn);
      entry.pendingResolvers = [];
    });

    conn.on("error", (err) => {
      entry.ready = false;
      sshPool.delete(server.id);
      for (const { reject: rej } of entry.pendingResolvers) rej(err);
      entry.pendingResolvers = [];
      // Status will be updated per-session on error send
    });

    conn.on("close", () => {
      entry.ready = false;
      sshPool.delete(server.id);
      if (entry.activeSessions === 0) {
        updateServerStatus(server.id, "disconnected");
      }
    });

    conn.connect({
      host: server.host,
      port: server.port || 22,
      username: server.username,
      privateKey,
      readyTimeout: 20000,
      keepaliveInterval: 30000,  // ping every 30s — keeps connection alive indefinitely
      keepaliveCountMax: 5,      // 5 missed pings before dropping (2.5 min grace)
    });
  });
}

// Evict a server's connection from pool (e.g. after auth failure)
function evictPool(serverId) {
  const entry = sshPool.get(serverId);
  if (entry) {
    try { entry.client.end(); } catch {}
    sshPool.delete(serverId);
  }
}

// ── WebSocket terminal handler ────────────────────────────────────────────────

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (ws, _req, context) => {
    const { server } = context;
    const privateKey = getKeyForServer(server);
    let stream = null;
    let poolEntry = null;

    const send = (type, payload) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type, ...payload }));
      }
    };

    if (!privateKey) {
      send("error", { message: "No SSH key assigned. Go to Remote Servers → assign an SSH key first." });
      ws.close();
      return;
    }

    send("status", { status: "connecting", message: `Connecting to ${server.name}…` });

    let conn;
    try {
      conn = await getPooledConn(server, privateKey);
      poolEntry = sshPool.get(server.id);
      if (poolEntry) poolEntry.activeSessions++;
    } catch (err) {
      send("error", { message: friendlySSHError(err, server) });
      ws.close();
      return;
    }

    // Open a shell channel on the shared connection
    conn.shell({ term: "xterm-256color", cols: 120, rows: 40 }, (err, s) => {
      if (err) {
        send("error", { message: `Shell error: ${err.message}` });
        ws.close();
        return;
      }

      stream = s;
      send("status", { status: "connected", message: `Connected to ${server.name} (${server.host})` });

      stream.on("data", (data) => {
        send("data", { data: data.toString("base64") });
      });

      stream.stderr.on("data", (data) => {
        send("data", { data: data.toString("base64") });
      });

      stream.on("close", () => {
        send("status", { status: "closed", message: "Shell session ended" });
        ws.close();
      });
    });

    // Browser → server
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "resize" && stream) {
          stream.setWindow(msg.rows, msg.cols, 0, 0);
        } else if (msg.type === "data" && stream) {
          stream.write(Buffer.from(msg.data, "base64"));
        }
      } catch {
        if (stream) stream.write(raw.toString());
      }
    });

    // Browser disconnected
    ws.on("close", () => {
      if (stream) { try { stream.end(); } catch {} stream = null; }
      if (poolEntry) {
        poolEntry.activeSessions = Math.max(0, poolEntry.activeSessions - 1);
        // Don't close the underlying SSH connection — keep it alive for future sessions.
        // keepaliveInterval in conn.connect() maintains the TCP connection automatically.
      }
    });
  });

  // ── HTTP upgrade handler ──────────────────────────────────────────────────

  httpServer.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname !== "/api/ws/terminal") return;

    const cookies = parseCookies(req.headers.cookie);
    const user = validateSession(cookies["session"]);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const serverId = parsedUrl.query.serverId;
    if (!serverId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const server = getServerById(serverId);
    if (!server) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { server, user });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> FleetOPS ready on http://${hostname}:${port}`);
    console.log(`> WebSocket terminal: ws://${hostname}:${port}/api/ws/terminal`);
    console.log(`> SSH pool: one connection per server, shared across all sessions`);
  });
});
