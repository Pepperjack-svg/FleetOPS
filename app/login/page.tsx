"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) router.push("/dashboard");
    else setError("Invalid credentials");
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      <div className="w-1/2 flex flex-col justify-between bg-neutral-900 p-12">
        <h1 className="text-2xl font-semibold">FleetOps</h1>
        <p className="text-gray-400 text-sm">
          “The Open Source alternative to Netlify, Vercel, Heroku.”
        </p>
      </div>

      <div className="w-1/2 flex flex-col justify-center items-center bg-black">
        <form
          onSubmit={handleLogin}
          className="w-80 bg-neutral-900 p-6 rounded-xl border border-neutral-800"
        >
          <h2 className="text-xl font-semibold mb-4 text-center">Sign in</h2>
          <p className="text-center text-gray-400 mb-6 text-sm">
            Enter your email and password to sign in
          </p>

          <div className="mb-4">
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@fleetops.com"
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 focus:outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            type="submit"
            className="w-full py-2 bg-white text-black rounded font-semibold hover:bg-gray-300 transition"
          >
            Login
          </button>

          <p className="text-right text-sm text-gray-500 mt-2">
            Lost your password?
          </p>
        </form>
      </div>
    </div>
  );
}
