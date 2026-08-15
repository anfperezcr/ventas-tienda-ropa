export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="text-sm text-neutral-500">
        Esta página todavía no se había cargado con conexión. Volvé a
        intentar cuando tengas señal.
      </p>
    </main>
  );
}
