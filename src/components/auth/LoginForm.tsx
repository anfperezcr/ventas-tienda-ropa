"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ slug }: { slug?: string }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, usuario, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }
      router.push(data.rol === "super_admin" ? "/super-admin" : "/dashboard");
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-neutral-200 p-6"
    >
      <h1 className="text-lg font-semibold">Ingresar</h1>
      <label className="flex flex-col gap-1 text-sm">
        Usuario
        <input
          type="text"
          inputMode="text"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          type="password"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={cargando}
        className="rounded-lg bg-[var(--brand-600)] px-4 py-3 text-lg font-medium text-white disabled:opacity-60"
      >
        {cargando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
