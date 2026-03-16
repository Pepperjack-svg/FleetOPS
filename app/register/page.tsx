"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/register")
      .then((r) => r.json())
      .then((data) => { if (data.hasUsers) router.push("/login"); });
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(data.error || "Registration failed");
    }
  };

  const strength = password.length === 0 ? 0
    : password.length < 8 ? 1
    : password.length < 12 ? 2
    : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-green-500"][strength];

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center mb-4">
            <img src="/favicon.ico" alt="FleetOPS" className="w-8 h-8 rounded-md" style={{ filter: "invert(1)" }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FleetOPS</h1>
          <p className="text-neutral-500 text-sm mt-1">Create your admin account</p>
        </div>

        {/* First-time notice */}
        <div className="flex items-start gap-2.5 bg-green-500/5 border border-green-500/20 rounded-lg px-3.5 py-3 mb-4">
          <ShieldCheck size={15} className="text-green-400 mt-0.5 shrink-0" />
          <p className="text-xs text-neutral-400 leading-relaxed">
            This is a one-time setup. The first account created becomes the admin with full access.
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-xl p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-neutral-800/80 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : "bg-neutral-700"}`} />
                    ))}
                  </div>
                  <span className={`text-[10px] font-medium ${strength === 1 ? "text-red-400" : strength === 2 ? "text-yellow-400" : "text-green-400"}`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <>Create admin account <ArrowRight size={14} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-neutral-700 text-xs mt-6">
          Open-source SSH fleet management
        </p>
      </div>
    </div>
  );
}
