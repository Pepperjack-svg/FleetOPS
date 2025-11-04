"use client";

import { useState, useEffect } from "react";
import SSHConsole from "@/components/Terminal";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // 🔄 Fetch servers (poll every 10s)
  const fetchServers = async () => {
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      setServers(data);
    } catch (err) {
      console.error("Failed to load servers", err);
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 10000);
    return () => clearInterval(interval);
  }, []);

  // 🟢 Connect handler
  const handleConnect = async (srv: any) => {
    setSelectedServer(srv);
    setShowModal(true);
  };

  const confirmConnect = async () => {
    setConnecting(true);

    try {
      const res = await fetch("/api/ssh/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: selectedServer.host,
          port: selectedServer.port,
          username: selectedServer.username,
          password,
          ssh_key_id: selectedServer.ssh_key_id,
        }),
      });

      if (res.ok) {
        alert(`✅ Connected to ${selectedServer.name}`);
        setShowModal(false);
        setPassword("");
        fetchServers();
      } else {
        const err = await res.json();
        alert(`❌ Failed: ${err.message}`);
      }
    } catch (error) {
      alert("⚠️ Connection error");
      console.error(error);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="text-white p-6">
      <h2 className="text-2xl font-bold mb-6">Connected Servers</h2>

      {servers.length === 0 ? (
        <p className="text-gray-400">No servers found.</p>
      ) : (
        servers.map((srv) => (
          <div
            key={srv.id}
            className="mb-6 border border-neutral-800 rounded-lg p-4 bg-neutral-900/60"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{srv.name}</h3>
                <p className="text-sm text-gray-400">
                  {srv.username}@{srv.host}:{srv.port}
                </p>
                <p className="text-xs text-gray-500">
                  via SSH Key: {srv.ssh_key_name || "N/A"}
                </p>
              </div>

              {srv.status === "connected" ? (
                <span className="text-green-400 text-sm font-semibold">● Connected</span>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => handleConnect(srv)}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Connect
                </Button>
              )}
            </div>

            {srv.status === "connected" && (
              <div className="mt-4">
                <SSHConsole server={srv} />
              </div>
            )}
          </div>
        ))
      )}

      {/* 🔐 Password Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-96">
            <h3 className="text-xl font-semibold mb-3">SSH Authentication</h3>
            <p className="text-gray-400 mb-4">
              Enter the SSH password for <strong>{selectedServer?.username}</strong>@
              <strong>{selectedServer?.host}</strong>
            </p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 mb-4 focus:outline-none"
              placeholder="Enter SSH password"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setPassword("");
                }}
                className="bg-neutral-800 text-gray-300 hover:bg-neutral-700"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmConnect}
                disabled={connecting || !password}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {connecting ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
