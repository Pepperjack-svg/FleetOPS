"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react";

export default function RemoteServersPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [sshKeys, setSshKeys] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editServer, setEditServer] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    host: "",
    port: 22,
    username: "",
    ssh_key_id: "",
  });

  // ✅ Safe fetch with error handling
  const fetchServers = async () => {
    try {
      const res = await fetch("/api/servers");
      if (!res.ok) {
        console.error("Fetch failed:", res.status);
        setServers([]);
        return;
      }
      const data = await res.json();
      setServers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
      setServers([]);
    }
  };

  // Fetch SSH keys
  const fetchSSHKeys = async () => {
    try {
      const res = await fetch("/api/sshkeys");
      if (!res.ok) return;
      const data = await res.json();
      setSshKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("SSH Key fetch error:", err);
      setSshKeys([]);
    }
  };

  useEffect(() => {
    fetchServers();
    fetchSSHKeys();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this server?")) return;
    try {
      await fetch("/api/servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchServers();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleEdit = (server: any) => {
    setEditServer(server);
    setForm({
      name: server.name,
      description: server.description,
      host: server.host,
      port: server.port,
      username: server.username,
      ssh_key_id: server.ssh_key_id || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const method = editServer ? "PUT" : "POST";
    try {
      const res = await fetch("/api/servers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errMsg = await res.text();
        console.error("Server save failed:", errMsg);
        return;
      }

      setShowModal(false);
      setEditServer(null);
      setForm({
        name: "",
        description: "",
        host: "",
        port: 22,
        username: "",
        ssh_key_id: "",
      });
      fetchServers();
    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  return (
    <div className="text-white p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        🖥️ Servers
      </h2>
      <p className="text-gray-400 mb-4">
        Add servers to deploy your applications remotely.
      </p>

      {/* Server Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-gray-400 border-b border-neutral-800">
            <tr>
              <th className="py-3 px-4 text-left">Name</th>
              <th className="py-3 px-4 text-left">IP Address</th>
              <th className="py-3 px-4 text-left">Port</th>
              <th className="py-3 px-4 text-left">Username</th>
              <th className="py-3 px-4 text-left">SSH Key</th>
              <th className="py-3 px-4 text-left">Created</th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.length > 0 ? (
              servers.map((srv) => (
                <tr
                  key={srv.id}
                  className="border-t border-neutral-800 hover:bg-neutral-800/40"
                >
                  <td className="py-3 px-4">{srv.name}</td>
                  <td className="py-3 px-4">
                    <span className="bg-neutral-800 px-2 py-1 rounded-lg">
                      {srv.host}
                    </span>
                  </td>
                  <td className="py-3 px-4">{srv.port}</td>
                  <td className="py-3 px-4">{srv.username}</td>
                  <td className="py-3 px-4">
                    {srv.ssh_key_name || (
                      <span className="text-gray-500">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {new Date(srv.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleEdit(srv)}
                      className="text-blue-400 border-neutral-700 hover:bg-neutral-800"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(srv.id)}
                      className="text-red-400 border-neutral-700 hover:bg-neutral-800"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  No servers added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={() => {
            setEditServer(null);
            setForm({
              name: "",
              description: "",
              host: "",
              port: 22,
              username: "",
              ssh_key_id: "",
            });
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
        >
          <PlusCircle size={16} /> Create Server
        </Button>
      </div>

      {/* Modal for Add/Edit Server */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-[400px]">
            <h3 className="text-lg font-semibold mb-3">
              {editServer ? "Edit Server" : "Create Server"}
            </h3>

            <div className="space-y-3">
              <input
                className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded-lg text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded-lg text-sm"
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <input
                className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded-lg text-sm"
                placeholder="Host (IP or Domain)"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />

              <div className="flex gap-3">
                <input
                  className="w-1/2 bg-neutral-800 border border-neutral-700 p-2 rounded-lg text-sm"
                  placeholder="Port"
                  value={form.port}
                  onChange={(e) =>
                    setForm({ ...form, port: Number(e.target.value) })
                  }
                />
                <input
                  className="w-1/2 bg-neutral-800 border border-neutral-700 p-2 rounded-lg text-sm"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </div>

              {/* SSH Key Dropdown */}
              <select
                className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded-lg text-sm text-gray-300"
                value={form.ssh_key_id}
                onChange={(e) =>
                  setForm({ ...form, ssh_key_id: e.target.value })
                }
              >
                <option value="">Select SSH Key (optional)</option>
                {sshKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="border-neutral-700 text-gray-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {editServer ? "Save Changes" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
