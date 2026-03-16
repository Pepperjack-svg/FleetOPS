"use client";

import { useState, useEffect } from "react";
import { User, Eye, EyeOff, Save } from "lucide-react";

const AVATARS = [
  "👤", "🧑‍💻", "👩‍💻", "🧑‍🚀", "👨‍🔬", "👩‍🔬",
  "🧑‍🎨", "👨‍💼", "👩‍💼", "🧙", "🥷", "🤖",
];

export default function ProfilePage() {
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [email, setEmail]           = useState("");
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [avatar, setAvatar]         = useState("");
  const [showCurr, setShowCurr]     = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setFirstName(d.first_name ?? "");
        setLastName(d.last_name ?? "");
        setEmail(d.email ?? "");
        setAvatar(d.avatar ?? "");
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const body: any = { firstName, lastName, email, avatar };
    if (newPw) { body.currentPassword = currentPw; body.newPassword = newPw; }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMsg({ type: "error", text: data.error ?? "Failed to save" });
    } else {
      setMsg({ type: "success", text: "Profile updated successfully" });
      setCurrentPw("");
      setNewPw("");
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase() || "A";

  return (
    <div className="max-w-2xl text-white">
      <form onSubmit={handleSave}>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <User size={18} className="text-neutral-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Account</h2>
                <p className="text-xs text-neutral-500">Change the details of your profile here.</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
              />
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurr ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Current Password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
                <button type="button" onClick={() => setShowCurr((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300" tabIndex={-1}>
                  {showCurr ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="New password (leave blank to keep current)"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300" tabIndex={-1}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-2">Avatar</label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Initials option */}
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${avatar === "" ? "ring-2 ring-white bg-neutral-600" : "bg-neutral-700 hover:bg-neutral-600"}`}
                >
                  {initials}
                </button>

                {/* Emoji avatars */}
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all
                      ${avatar === emoji ? "ring-2 ring-white bg-neutral-700" : "bg-neutral-800 hover:bg-neutral-700"}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {msg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${
                msg.type === "success"
                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                  : "text-red-400 bg-red-500/10 border-red-500/20"
              }`}>
                {msg.text}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
