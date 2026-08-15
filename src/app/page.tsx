export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ bloqueado?: string }>;
}) {
  const { bloqueado } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">Ventas y Stock</h1>
      {bloqueado ? (
        <p className="text-sm text-red-600">
          El acceso de esta tienda está suspendido. Contacta al administrador
          de la plataforma.
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          Usa el link de login de tu tienda para entrar.
        </p>
      )}
    </main>
  );
}
