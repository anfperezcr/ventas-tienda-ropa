"use client";

import { useEffect, useState } from "react";
import {
  registrarVenta,
  type RegistrarVentaInput,
  type RegistrarVentaResult,
  type MetodoPago,
} from "@/lib/ventas/actions";
import { buscarClientePorTelefono } from "@/lib/clientes/actions";
import type { Producto } from "@/lib/productos/data";
import {
  listarProductosCache,
  encolarVentaPendiente,
  EVENTO_CATALOGO_ACTUALIZADO,
} from "@/lib/offline/db";
import { generarClientRef } from "@/lib/offline/clientRef";
import { iniciales } from "@/lib/iniciales";

type ItemCarrito = {
  productoId: number;
  nombre: string;
  talla: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
};

type FilaPago = { metodo: MetodoPago; monto: number };

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "nequi", etiqueta: "Nequi" },
  { valor: "daviplata", etiqueta: "Daviplata" },
];

const COLOR_METODO: Record<MetodoPago, string> = {
  efectivo: "bg-green-500",
  nequi: "bg-purple-500",
  daviplata: "bg-red-500",
};

function formatCOP(valor: number): string {
  return `$${valor.toLocaleString("es-CO")}`;
}

// El cambio siempre se entrega en efectivo (CLAUDE.md §2 -- nequi/daviplata
// son transferencias, no hay forma física de "devolver" ahí). Antes de
// enviar la venta se descuenta el cambio de la(s) fila(s) de efectivo, así
// la suma de pagos que llega a registrar_venta sigue cuadrando exacto con
// el total -- ese invariante (0005_clientes_ventas.sql) no se toca.
function netearCambioEnEfectivo(pagosOriginal: FilaPago[], cambio: number): FilaPago[] {
  if (cambio <= 0) return pagosOriginal;
  let restante = cambio;
  return pagosOriginal.map((p) => {
    if (p.metodo !== "efectivo" || restante <= 0) return p;
    const descuento = Math.min(p.monto, restante);
    restante -= descuento;
    return { ...p, monto: p.monto - descuento };
  });
}

function TituloPaso({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-600)] text-xs font-semibold text-white">
        {numero}
      </span>
      {children}
    </span>
  );
}

function TarjetaProducto({ producto, onAgregar }: { producto: Producto; onAgregar: () => void }) {
  return (
    <button
      onClick={onAgregar}
      disabled={producto.stock <= 0}
      className="flex flex-col items-start gap-2 rounded-xl border border-neutral-200 p-3 text-left disabled:opacity-40"
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-lg text-sm font-semibold"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand-600) 12%, white)",
          color: "var(--brand-600)",
        }}
      >
        {iniciales(producto.nombre)}
      </div>
      <span className="font-medium">{producto.nombre}</span>
      <span className="text-xs text-neutral-500">
        Talla {producto.talla} · stock {producto.stock}
      </span>
      <span className="font-medium">${producto.precio.toLocaleString("es-CO")}</span>
    </button>
  );
}

export function VentaForm({
  localId,
  productos: productosIniciales,
  tenantId,
}: {
  localId: number;
  productos: Producto[];
  tenantId: string;
}) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [pagos, setPagos] = useState<FilaPago[]>([{ metodo: "efectivo", monto: 0 }]);
  const [telefono, setTelefono] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [busqueda, setBusqueda] = useState<
    "idle" | "buscando" | "encontrado" | "no-encontrado" | "sin-conexion"
  >("idle");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    idVentaPublico: string | null;
    total: number;
    pendiente: boolean;
  } | null>(null);

  // El shell de esta página puede venir del cache del service worker sin
  // red -- en ese caso `productosIniciales` (render server-side de la
  // última vez que hubo conexión) puede estar desactualizado. En cuanto
  // el cache local de IndexedDB tiene algo, lo reemplaza.
  useEffect(() => {
    let cancelado = false;

    async function cargarDesdeCache() {
      const disponibles = await listarProductosCache(tenantId, localId);
      if (cancelado || disponibles.length === 0) return;
      setProductos(disponibles);
    }

    cargarDesdeCache();
    window.addEventListener(EVENTO_CATALOGO_ACTUALIZADO, cargarDesdeCache);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_CATALOGO_ACTUALIZADO, cargarDesdeCache);
    };
  }, [tenantId, localId]);

  const categorias = Array.from(new Set(productos.map((p) => p.categoriaNombre))).sort();
  const productosFiltrados = productos.filter(
    (p) =>
      (categoriaFiltro === null || p.categoriaNombre === categoriaFiltro) &&
      (busquedaProducto.trim() === "" ||
        p.nombre.toLowerCase().includes(busquedaProducto.trim().toLowerCase()))
  );

  const total = carrito.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);
  const totalPagos = pagos.reduce((sum, p) => sum + p.monto, 0);
  const efectivoTotal = pagos
    .filter((p) => p.metodo === "efectivo")
    .reduce((sum, p) => sum + p.monto, 0);
  const diferencia = totalPagos - total;
  const faltante = diferencia < 0 ? -diferencia : 0;
  const cambio = diferencia > 0 ? diferencia : 0;
  // Si el cambio es mayor al efectivo recibido no hay de dónde netearlo
  // (ej. todo pagado por Nequi de más) -- caso borde no cubierto por el
  // ticket original, bloqueado explícitamente en vez de enviar una venta
  // con pagos que no cuadran contra el total.
  const cambioCubierto = cambio === 0 || efectivoTotal >= cambio;

  function agregarAlCarrito(p: Producto) {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.productoId === p.id);
      if (existente) {
        if (existente.cantidad >= p.stock) return prev;
        return prev.map((i) =>
          i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      if (p.stock <= 0) return prev;
      return [
        ...prev,
        {
          productoId: p.id,
          nombre: p.nombre,
          talla: p.talla,
          precioUnitario: p.precio,
          cantidad: 1,
          stockDisponible: p.stock,
        },
      ];
    });
  }

  function cambiarCantidad(productoId: number, delta: number) {
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.productoId === productoId
            ? { ...i, cantidad: Math.min(i.stockDisponible, Math.max(0, i.cantidad + delta)) }
            : i
        )
        .filter((i) => i.cantidad > 0)
    );
  }

  function actualizarPago(index: number, cambio: Partial<FilaPago>) {
    setPagos((prev) => prev.map((p, i) => (i === index ? { ...p, ...cambio } : p)));
  }

  function seleccionarMetodoUnico(metodo: MetodoPago) {
    setPagos((prev) => [{ metodo, monto: total }, ...prev.slice(1)]);
  }

  function agregarFilaPago() {
    const usados = new Set(pagos.map((p) => p.metodo));
    const disponible = METODOS.find((m) => !usados.has(m.valor))?.valor ?? "efectivo";
    setPagos((prev) => [...prev, { metodo: disponible, monto: 0 }]);
  }

  async function buscarCliente() {
    if (!telefono.trim()) {
      setBusqueda("idle");
      return;
    }
    setBusqueda("buscando");
    try {
      const res = await buscarClientePorTelefono(telefono.trim());
      if (res.encontrado) {
        setNombreCliente(res.nombre ?? "");
        setBusqueda("encontrado");
      } else {
        setNombreCliente("");
        setBusqueda("no-encontrado");
      }
    } catch {
      // Sin conexión -- no bloquea la venta (mismo criterio que si el
      // teléfono se hubiera dejado vacío). La resolución real de
      // cliente pasa igual dentro de registrarVenta cuando sincronice.
      setBusqueda("sin-conexion");
    }
  }

  const clienteListo =
    !telefono.trim() ||
    busqueda === "encontrado" ||
    busqueda === "sin-conexion" ||
    (busqueda === "no-encontrado" && nombreCliente.trim().length > 0);
  const puedeCobrar =
    carrito.length > 0 &&
    total > 0 &&
    diferencia >= 0 &&
    cambioCubierto &&
    clienteListo &&
    !enviando;

  async function confirmarVenta() {
    setEnviando(true);
    setError(null);

    const input: RegistrarVentaInput = {
      localId,
      clienteTelefono: telefono.trim() || null,
      clienteNombre: nombreCliente.trim() || null,
      items: carrito.map((i) => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
      })),
      pagos: netearCambioEnEfectivo(pagos, cambio),
      clientRef: generarClientRef(),
    };

    // Sin conexión: ni se intenta -- directo a la cola. Ahorra el
    // round-trip garantizado a fallar y evita la espera del timeout.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await encolarVentaPendiente(tenantId, input.clientRef!, input, total);
      setResultado({ idVentaPublico: null, total, pendiente: true });
      setEnviando(false);
      return;
    }

    try {
      const res: RegistrarVentaResult = await registrarVenta(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResultado({ idVentaPublico: res.idVentaPublico, total, pendiente: false });
    } catch {
      // Server Action inalcanzable (falla de red durante el intento, no
      // detectada por navigator.onLine de antemano) -- se encola igual en
      // vez de perder la venta. No hay decremento optimista de stock acá
      // (deliberado, ver Fase 7 plan): el carrito ya limitó cantidades
      // contra el último stock cacheado, y registrar_venta re-valida al
      // sincronizar.
      await encolarVentaPendiente(tenantId, input.clientRef!, input, total);
      setResultado({ idVentaPublico: null, total, pendiente: true });
    } finally {
      setEnviando(false);
    }
  }

  function nuevaVenta() {
    setCarrito([]);
    setPagos([{ metodo: "efectivo", monto: 0 }]);
    setTelefono("");
    setNombreCliente("");
    setBusqueda("idle");
    setResultado(null);
    setError(null);
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 p-6 text-center">
        <h1 className="text-xl font-semibold">
          {resultado.pendiente ? "Venta guardada" : "Venta registrada"}
        </h1>
        {resultado.pendiente ? (
          <p className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            Sin conexión — se sincronizará sola apenas vuelva la señal.
          </p>
        ) : (
          <p className="text-sm text-neutral-500">Ticket #{resultado.idVentaPublico}</p>
        )}
        <p className="text-lg font-medium">Total: ${resultado.total.toLocaleString("es-CO")}</p>
        <button
          onClick={nuevaVenta}
          className="rounded-lg bg-[var(--brand-600)] px-4 py-3 text-lg font-medium text-white"
        >
          Nueva venta
        </button>
      </div>
    );
  }

  const primerPago: FilaPago = pagos[0] ?? { metodo: "efectivo", monto: 0 };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
      {/* Columna izquierda: cliente + catálogo */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-2">
            <TituloPaso numero={1}>Cliente (opcional)</TituloPaso>
          </div>
          <div className="flex gap-2">
            <input
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value);
                setBusqueda("idle");
              }}
              placeholder="Teléfono"
              className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            />
            <button
              onClick={buscarCliente}
              className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            >
              {busqueda === "buscando" ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {busqueda === "encontrado" && (
            <p className="mt-2 text-sm text-green-700">Cliente: {nombreCliente}</p>
          )}
          {busqueda === "no-encontrado" && (
            <input
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              placeholder="Nombre del cliente nuevo"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            />
          )}
          {busqueda === "sin-conexion" && (
            <p className="mt-2 text-sm text-yellow-700">
              No se pudo verificar (sin conexión) — se resuelve solo al sincronizar.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-3">
            <TituloPaso numero={2}>Selecciona productos</TituloPaso>
          </div>
          <input
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            placeholder="Buscar producto por nombre"
            className="mb-3 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => setCategoriaFiltro(null)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                categoriaFiltro === null
                  ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                  : "border-neutral-300"
              }`}
            >
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setCategoriaFiltro(c)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  categoriaFiltro === c
                    ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                    : "border-neutral-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {productosFiltrados.map((p) => (
              <TarjetaProducto key={p.id} producto={p} onAgregar={() => agregarAlCarrito(p)} />
            ))}
            {productosFiltrados.length === 0 && (
              <p className="col-span-full text-sm text-neutral-500">
                {productos.length === 0
                  ? "No hay productos activos en este local."
                  : "No se encontraron productos con ese filtro."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Columna derecha: carrito + pago + confirmar, fija al hacer scroll */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <TituloPaso numero={3}>Carrito</TituloPaso>
            {carrito.length > 0 && (
              <button onClick={() => setCarrito([])} className="text-sm text-red-600">
                Vaciar carrito
              </button>
            )}
          </div>
          {carrito.length === 0 && <p className="text-sm text-neutral-500">Vacío</p>}
          {carrito.map((i) => (
            <div key={i.productoId} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>
                {i.nombre} · Talla {i.talla}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cambiarCantidad(i.productoId, -1)}
                  className="rounded-lg border border-neutral-300 px-2"
                >
                  -
                </button>
                <span>{i.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(i.productoId, 1)}
                  className="rounded-lg border border-neutral-300 px-2"
                >
                  +
                </button>
                <span className="w-20 text-right">
                  ${(i.cantidad * i.precioUnitario).toLocaleString("es-CO")}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-2 text-right font-semibold">
            Total: ${total.toLocaleString("es-CO")}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <TituloPaso numero={4}>Pago</TituloPaso>
            <div className="text-right">
              <div className="text-xs text-neutral-500">Total a pagar</div>
              <div className="text-lg font-semibold">{formatCOP(total)}</div>
            </div>
          </div>

          <p className="mb-2 text-xs font-medium text-neutral-500">Métodos de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.valor}
                onClick={() => seleccionarMetodoUnico(m.valor)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-medium ${
                  primerPago.metodo === m.valor
                    ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                    : "border-neutral-300"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_METODO[m.valor]}`} />
                {m.etiqueta}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            value={primerPago.monto || ""}
            onChange={(e) => actualizarPago(0, { monto: Number(e.target.value) })}
            className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          />

          {pagos.slice(1).map((pago, i) => {
            const index = i + 1;
            return (
              <div key={index} className="mt-2 flex items-center gap-2">
                <select
                  value={pago.metodo}
                  onChange={(e) => actualizarPago(index, { metodo: e.target.value as MetodoPago })}
                  className="rounded-lg border border-neutral-300 px-2 py-2"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={pago.monto || ""}
                  onChange={(e) => actualizarPago(index, { monto: Number(e.target.value) })}
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
                />
                <button
                  onClick={() => setPagos((prev) => prev.filter((_, i2) => i2 !== index))}
                  className="rounded-lg border border-neutral-300 px-2 py-2"
                >
                  Quitar
                </button>
              </div>
            );
          })}
          <button onClick={agregarFilaPago} className="mt-2 text-sm text-[var(--brand-600)]">
            + Agregar otro método
          </button>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
            <span className="text-neutral-500">Total pagado</span>
            <span className="font-medium">{formatCOP(totalPagos)}</span>
          </div>

          {total > 0 && (
            <div
              className={`mt-3 rounded-xl border p-3 ${
                faltante > 0 || !cambioCubierto
                  ? "border-amber-300 bg-amber-50"
                  : "border-green-300 bg-green-50"
              }`}
            >
              {faltante > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800">Falta por pagar</span>
                  <span className="text-lg font-semibold text-amber-800">{formatCOP(faltante)}</span>
                </div>
              ) : !cambioCubierto ? (
                <p className="text-sm font-medium text-amber-800">
                  El cambio ({formatCOP(cambio)}) debe cubrirse con efectivo — ajusta el monto en
                  efectivo.
                </p>
              ) : cambio > 0 ? (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">💵 Cambio a devolver</span>
                    <span className="text-xl font-bold text-green-800">{formatCOP(cambio)}</span>
                  </div>
                  <p className="text-xs text-green-700">en efectivo</p>
                </div>
              ) : (
                <p className="text-sm font-medium text-green-800">✓ Pago completo</p>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={confirmarVenta}
            disabled={!puedeCobrar}
            className="mt-3 w-full rounded-lg bg-[var(--brand-600)] px-4 py-4 text-lg font-medium text-white disabled:opacity-40"
          >
            {enviando ? "Confirmando..." : "Confirmar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
