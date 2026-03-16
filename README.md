# FleetOPS

An open-source SSH fleet management platform. Manage, monitor, and terminal into remote servers from a single web dashboard.

## Features

- **SSH Terminal** — Full xterm.js terminal in the browser, streamed over WebSocket
- **Remote Monitoring** — Real-time CPU, memory, disk, and network stats from remote servers via SSH
- **SSH Key Management** — Generate ED25519 keypairs or import existing keys; assign per server
- **Remote Servers** — Add and manage multiple servers with connection status tracking
- **Authentication** — Session-based login with bcrypt password hashing

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** SQLite via `better-sqlite3` (zero config, file-based)
- **SSH:** `ssh2` library with persistent connection caching for fast polling
- **Terminal:** `xterm.js` over WebSocket (custom Node.js server)
- **UI:** Tailwind CSS v4, Recharts, Lucide icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
git clone https://github.com/your-username/FleetOPS.git
cd FleetOPS
npm install
```

### Run (development)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first launch you will be prompted to create an admin account.

### Run (production)

```bash
npm run build
npm start
```

## Adding a Server

1. Go to **SSH Keys** and generate or import an ED25519 keypair.
2. Copy the public key and add it to `~/.ssh/authorized_keys` on the target server:

```bash
# Run this on the target server as the user FleetOPS will connect as (e.g. pi, ubuntu, root)
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA... fleetops' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

> Make sure you add the key for the correct user. If FleetOPS connects as `pi`, the key must be in `/home/pi/.ssh/authorized_keys`, not `/root/.ssh/authorized_keys`.

3. Go to **Remote Servers**, click **Add Server**, and assign the SSH key.
4. Click **Terminal** to open a live shell, or **Monitor** to view system stats.

## Project Structure

```
FleetOPS/
├── app/
│   ├── api/
│   │   ├── login/          # POST login
│   │   ├── logout/         # POST/GET logout (GET clears cookie + redirects)
│   │   ├── monitor/        # GET local stats (systeminformation)
│   │   │   └── remote/     # GET remote stats via SSH
│   │   ├── register/       # POST register first user
│   │   ├── servers/        # CRUD remote servers
│   │   │   └── test/       # POST test SSH connection
│   │   ├── ssh/connect/    # POST one-shot SSH auth test
│   │   └── sshkeys/        # CRUD SSH keys + key generation
│   └── dashboard/
│       ├── monitor/        # Monitoring page
│       ├── remoteservers/  # Servers list + inline terminal
│       └── sshkeys/        # SSH key management
├── components/
│   ├── Sidebar.tsx
│   └── Terminal.tsx        # xterm.js WebSocket terminal
├── lib/
│   ├── auth.ts             # Session management
│   └── db.ts               # SQLite schema + migrations
├── server.js               # Custom Node.js server (WebSocket + SSH)
└── middleware.ts            # Route protection
```

## License

MIT
