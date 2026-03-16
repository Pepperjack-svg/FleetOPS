// Custom Next.js server with WebSocket support for SSH terminal streaming
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

function getDb(readonly = false) {
  const Database = require("better-sqlite3");
  const dbPath = path.join(process.cwd(), "db", "fleetops.db");
  return new Database(dbPath, { readonly });
}

function getKeyForServer(server) {
  if (!server || !server.ssh_key_id) return null;
  try {
    const db = getDb(true);
    const row = db.prepare("SELECT private_key FROM ssh_keys WHERE id = ?").get(server.ssh_key_id);
    db.close();
    return row?.private_key || null;
  } catch {
    return null;
  }
}

function updateServerStatus(serverId, status) {
  try {
    const db = getDb(false);
    db.prepare("UPDATE remote_servers SET status = ? WHERE id = ?").run(
      status,
      serverId
    );
    db.close();
  } catch {}
}

function validateSession(token) {
  try {
    const db = getDb(true);
    const session = db
      .prepare(
        `SELECT u.id, u.email FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
      )
      .get(token);
    db.close();
    return session || null;
  } catch {
    return null;
  }
}

function getServerById(serverId) {
  try {
    const db = getDb(true);
    const server = db
      .prepare("SELECT * FROM remote_servers WHERE id = ?")
      .get(serverId);
    db.close();
    return server || null;
  } catch {
    return null;
  }
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

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req, context) => {
    const { server } = context;
    const appPrivateKey = getKeyForServer(server);

    const conn = new Client();
    let sshStream = null;
    let sshReady = false;

    const connectSSH = () => {
      if (!appPrivateKey) {
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              "No SSH key assigned to this server. Go to Remote Servers to assign a key.",
          })
        );
        ws.close();
        return;
      }

      conn.connect({
        host: server.host,
        port: server.port || 22,
        username: server.username,
        privateKey: appPrivateKey,
        readyTimeout: 20000,
      });
    };

    conn.on("ready", () => {
      sshReady = true;
      updateServerStatus(server.id, "connected");
      ws.send(
        JSON.stringify({
          type: "status",
          status: "connected",
          message: `Connected to ${server.name} (${server.host})`,
        })
      );

      conn.shell({ term: "xterm-256color", cols: 220, rows: 50 }, (err, stream) => {
        if (err) {
          ws.send(
            JSON.stringify({ type: "error", message: `Shell error: ${err.message}` })
          );
          ws.close();
          return;
        }

        sshStream = stream;

        stream.on("data", (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "data", data: data.toString("base64") }));
          }
        });

        stream.stderr.on("data", (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "data", data: data.toString("base64") }));
          }
        });

        stream.on("close", () => {
          ws.send(
            JSON.stringify({ type: "status", status: "closed", message: "SSH session ended" })
          );
          ws.close();
          conn.end();
        });
      });
    });

    conn.on("error", (err) => {
      const msg = err.message || "";
      let friendly = `SSH error: ${msg}`;
      if (msg.includes("authentication methods failed") || msg.includes("auth")) {
        friendly =
          `SSH key authentication failed for ${server.username}@${server.host}. ` +
          `Ensure the key's public key is in /home/${server.username}/.ssh/authorized_keys ` +
          `(not /root/.ssh/authorized_keys). Copy the public key from the SSH Keys page.`;
      } else if (msg.includes("ECONNREFUSED")) {
        friendly = `Connection refused on ${server.host}:${server.port || 22}. Is SSH running?`;
      } else if (msg.includes("ETIMEDOUT") || msg.includes("timed out")) {
        friendly = `Connection to ${server.host} timed out. Check network connectivity.`;
      }
      ws.send(JSON.stringify({ type: "error", message: friendly }));
      ws.close();
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "resize" && sshStream) {
          sshStream.setWindow(msg.rows, msg.cols, 0, 0);
          return;
        }

        if (msg.type === "data" && sshStream) {
          sshStream.write(Buffer.from(msg.data, "base64"));
          return;
        }
      } catch {
        if (sshStream) sshStream.write(raw.toString());
      }
    });

    ws.on("close", () => {
      if (sshStream) sshStream.end();
      conn.end();
      updateServerStatus(server.id, "disconnected");
    });

    connectSSH();
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url, true);

    if (parsedUrl.pathname !== "/api/ws/terminal") {
      return;
    }

    console.log("[WS UPGRADE] Request to /api/ws/terminal received");
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies["session"];

    if (!sessionToken) {
      console.log("[WS UPGRADE] No session token found in cookies.");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const user = validateSession(sessionToken);
    if (!user) {
      console.log("[WS UPGRADE] Invalid session token.");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const serverId = parsedUrl.query.serverId;
    if (!serverId) {
      console.log("[WS UPGRADE] No serverId query param.");
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const server = getServerById(serverId);
    if (!server) {
      console.log("[WS UPGRADE] Server not found for id:", serverId);
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    console.log("[WS UPGRADE] Session valid, handing over to wss...");
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { server, user });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> FleetOPS ready on http://${hostname}:${port}`);
    console.log(
      `> WebSocket terminal at ws://${hostname}:${port}/api/ws/terminal`
    );
  });
});
