import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../../lib/api";
import { dateTime, soles } from "../../lib/format";
import type { OrderStatus, ShippingMethod } from "../../lib/types";
import { Alert, Spinner, STATUS_LABELS, errorMessage, useAsync } from "../../components/ui";

interface Row {
  code: string;
  status: OrderStatus;
  customerName: string;
  shippingMethod: ShippingMethod;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  items: string[];
  createdAt: string;
}

const SHIP: Record<ShippingMethod, { label: string; bg: string; fg: string }> = {
  PICKUP: { label: "Recojo", bg: "#F5EFE6", fg: "#5C3A24" },
  DELIVERY_LOCAL: { label: "Delivery", bg: "#FFF1E6", fg: "#8F3B0F" },
  NATIONAL: { label: "Nacional", bg: "#E8EEF8", fg: "#23406E" },
};
const PAY: Record<string, string> = { CARD: "Tarjeta", YAPE: "Yape", PLIN: "Plin", CASH_ON_DELIVERY: "Contra entrega", PAY_AT_STORE: "Pago en tienda" };

function nextOf(r: Row): OrderStatus | null {
  switch (r.status) {
    case "CONFIRMED": return "PREPARING";
    case "PREPARING": return r.shippingMethod === "PICKUP" ? "READY_FOR_PICKUP" : r.shippingMethod === "DELIVERY_LOCAL" ? "OUT_FOR_DELIVERY" : "SHIPPED";
    case "READY_FOR_PICKUP": case "OUT_FOR_DELIVERY": case "SHIPPED": return "DELIVERED";
    default: return null;
  }
}

const COLUMNS: { title: string; statuses: OrderStatus[] }[] = [
  { title: "Pendientes de pago", statuses: ["PENDING_PAYMENT"] },
  { title: "Confirmados", statuses: ["CONFIRMED"] },
  { title: "En preparación", statuses: ["PREPARING"] },
  { title: "Listos / en camino", statuses: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "SHIPPED"] },
  { title: "Entregados", statuses: ["DELIVERED"] },
];

function OrderCard({ r, onDone }: { r: Row; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState<{ carrier: string; trackingNumber: string } | null>(null);
  const next = nextOf(r);

  const advance = async () => {
    if (!next) return;
    if (next === "SHIPPED" && !shipForm) return setShipForm({ carrier: "Olva Courier", trackingNumber: "" });
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/orders/${r.code}/status`, { method: "PATCH", body: { status: next, ...(next === "SHIPPED" ? shipForm : {}) } });
      onDone();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = window.prompt("Motivo de la cancelación", "Sin stock de un producto");
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/orders/${r.code}/cancel`, { method: "POST", body: { reason } });
      onDone();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="stack" style={{ background: "#fff", borderRadius: 14, padding: 14, gap: 8, boxShadow: "0 1px 3px rgba(43,26,18,.08)" }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong className="small">{r.code}</strong>
        <span className="tiny" style={{ padding: "3px 8px", borderRadius: 999, background: SHIP[r.shippingMethod].bg, color: SHIP[r.shippingMethod].fg }}>{SHIP[r.shippingMethod].label}</span>
      </div>
      <span className="small">{r.customerName}</span>
      <span className="small" style={{ lineHeight: 1.45, color: "var(--marron)" }}>{r.items.join(", ")}</span>
      <div className="row small" style={{ justifyContent: "space-between", color: "var(--marron)" }}>
        <span>{PAY[r.paymentMethod]} {r.paymentStatus === "PAID" ? "✓" : r.paymentStatus === "PENDING" ? "· pendiente" : r.paymentStatus === "REFUNDED" ? "· reembolsado" : r.paymentStatus === "PARTIALLY_REFUNDED" ? "· reembolso parcial" : "· fallido"}</span>
        <strong style={{ color: "var(--espresso)" }}>{soles(r.total)}</strong>
      </div>
      <span className="tiny muted">{dateTime(r.createdAt)}{r.status !== "CONFIRMED" && r.status !== "PENDING_PAYMENT" && r.status !== "PREPARING" && r.status !== "DELIVERED" ? ` · ${STATUS_LABELS[r.status]}` : ""}</span>
      {shipForm && (
        <div className="stack" style={{ gap: 6 }}>
          <input aria-label="Agencia" value={shipForm.carrier} onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })} style={{ height: 36, border: "1px solid var(--borde)", borderRadius: 8, padding: "0 10px" }} />
          <input aria-label="Número de guía" placeholder="N.° de guía" value={shipForm.trackingNumber} onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })} style={{ height: 36, border: "1px solid var(--borde)", borderRadius: 8, padding: "0 10px" }} />
        </div>
      )}
      {err && <span className="tiny" style={{ color: "var(--error)" }}>{err}</span>}
      {next && (
        <button type="button" className="btn btn-dark btn-sm" style={{ borderRadius: 10 }} onClick={advance} disabled={busy}>
          {busy ? <Spinner /> : `Pasar a ${STATUS_LABELS[next].toLowerCase()}`}
        </button>
      )}
      {(r.status === "CONFIRMED" || r.status === "PREPARING" || r.status === "PENDING_PAYMENT") && (
        <button type="button" className="link-btn tiny" style={{ color: "var(--error)", alignSelf: "flex-start" }} onClick={cancel} disabled={busy}>Cancelar pedido</button>
      )}
    </motion.article>
  );
}

export function AdminOrders() {
  const [q, setQ] = useState("");
  const [ship, setShip] = useState("");
  const { data, loading, error, reload } = useAsync(() => {
    const p = new URLSearchParams({ pageSize: "100", status: "PENDING_PAYMENT,CONFIRMED,PREPARING,READY_FOR_PICKUP,OUT_FOR_DELIVERY,SHIPPED,DELIVERED" });
    if (q) p.set("q", q);
    if (ship) p.set("shippingMethod", ship);
    return api<{ orders: Row[] }>(`/admin/orders?${p}`).then((r) => r.orders);
  }, [q, ship]);

  // Actualización automática cada 20 s (nuevos pedidos).
  useEffect(() => {
    const id = setInterval(() => void reload(), 20000);
    return () => clearInterval(id);
  }, [reload]);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 className="h2" style={{ fontSize: 34 }}>Pedidos</h1>
        <div className="row" style={{ gap: 8 }}>
          <input aria-label="Buscar pedido" placeholder="Código, cliente o correo" value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 44, borderRadius: 999, border: "1px solid #D8C6B0", padding: "0 16px", font: "400 14px var(--sans)", width: 240 }} />
          <select aria-label="Tipo de entrega" value={ship} onChange={(e) => setShip(e.target.value)} style={{ height: 44, borderRadius: 999, border: "1px solid #D8C6B0", padding: "0 14px", font: "400 14px var(--sans)", background: "#fff" }}>
            <option value="">Todas las entregas</option><option value="PICKUP">Recojo</option><option value="DELIVERY_LOCAL">Delivery Jaén</option><option value="NATIONAL">Envío nacional</option>
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()}>{loading ? <Spinner /> : "Actualizar"}</button>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, alignItems: "start" }}>
        {COLUMNS.map((c) => {
          const rows = (data ?? []).filter((r) => c.statuses.includes(r.status)).slice(0, c.statuses[0] === "DELIVERED" ? 8 : 50);
          return (
            <section key={c.title} className="stack" style={{ background: "#EFE8DE", borderRadius: 18, padding: 14, gap: 12 }}>
              <h2 className="row" style={{ fontSize: 15, fontWeight: 600, justifyContent: "space-between", padding: "4px 6px" }}>{c.title}<span style={{ color: "var(--marron)" }}>{rows.length}</span></h2>
              <AnimatePresence mode="popLayout">
                {rows.map((r) => <OrderCard key={r.code} r={r} onDone={() => void reload()} />)}
              </AnimatePresence>
              {rows.length === 0 && <span className="small muted" style={{ padding: "0 6px" }}>Sin pedidos</span>}
            </section>
          );
        })}
      </div>
    </>
  );
}
