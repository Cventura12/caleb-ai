"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OwnerLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Redirect to the originally-requested path, or /owner as default.
        const params = new URLSearchParams(window.location.search);
        router.push(params.get("next") ?? "/owner");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          res.status === 429
            ? "Too many attempts — try again in a few minutes."
            : (data.error as string | undefined) ?? "Something went wrong"
        );
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-[320px]">
        <h1 className="font-serif text-2xl text-ink mb-8 text-center tracking-tight">
          Owner login
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            className="w-full border border-line rounded-lg px-4 py-3 text-sm text-ink bg-bg outline-none focus:border-gray-2 placeholder:text-gray-2 transition-colors"
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-navy text-white rounded-lg py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {error && (
            <p className="text-red-500 text-sm text-center pt-1">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
