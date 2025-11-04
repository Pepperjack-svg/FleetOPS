"use client";

import { useEffect, useState } from "react";
import { Key, Pencil, Trash2 } from "lucide-react";

export default function SSHKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editKey, setEditKey] = useState<any | null>(null);

  // Fetch all keys
  async function fetchKeys() {
    const res = await fetch("/api/sshkeys");
    const data = await res.json();
    setKeys(data);
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  // Create or Edit Key
  async function handleSaveKey(e: any) {
    e.preventDefault();
    const form = new FormData(e.target);
    const name = form.get("name");
    const privateKey = form.get("privateKey");

    const method = editKey ? "PUT" : "POST";
    const body = editKey
      ? JSON.stringify({ id: editKey.id, name, privateKey })
      : JSON.stringify({ name, privateKey });

    await fetch("/api/sshkeys", {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });

    setShowModal(false);
    setEditKey(null);
    fetchKeys();
  }

  // Delete Key
  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this SSH key?")) return;

    await fetch("/api/sshkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchKeys();
  }

  return (
    <div className="text-white">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Key size={18} /> SSH Keys
        </h2>
        <p className="text-gray-400 mb-4">
          Manage SSH Keys used to connect to your remote servers.
        </p>

        {/* If no keys */}
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Key className="mb-3" size={26} />
            <p className="mb-3">You don’t have any SSH keys yet.</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-black px-4 py-2 rounded-md font-medium"
            >
              + Add SSH Key
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-black px-4 py-2 rounded-md font-medium mb-4"
            >
              + Add SSH Key
            </button>

            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{key.name}</h3>
                    <p className="text-xs text-gray-400 break-all mt-1">
                      {key.private_key.slice(0, 40)}...
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditKey(key);
                        setShowModal(true);
                      }}
                      className="text-blue-400 hover:text-blue-500"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="text-red-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-[450px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editKey ? "Edit SSH Key" : "Add SSH Key"}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditKey(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div>
                <label className="text-sm">Name</label>
                <input
                  name="name"
                  defaultValue={editKey?.name || ""}
                  placeholder="Server Access Key"
                  required
                  className="w-full p-2 mt-1 bg-neutral-800 rounded"
                />
              </div>

              <div>
                <label className="text-sm">Private Key</label>
                <textarea
                  name="privateKey"
                  defaultValue={editKey?.private_key || ""}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  required
                  className="w-full p-2 mt-1 bg-neutral-800 rounded h-32"
                />
              </div>

              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 w-full py-2 rounded font-medium"
              >
                {editKey ? "Save Changes" : "Create Key"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
