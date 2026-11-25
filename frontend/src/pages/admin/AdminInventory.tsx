import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { dateTime, soles } from "../../lib/format";
import { Alert, PageLoader, Spinner, errorMessage, useAsync } from "../../components/ui";

interface AdminVariant { id: string; sku: string; name: string; price: number; trackStock: boolean; stock: number; dailyStock: number | null; lowStockThreshold: number; isActive: boolean }
interface AdminProduct { id: string; slug: string; name: string; line: string; isActive: boolean; variants: AdminVariant[] }
interface Movement { id: string; sku: string; product: string; type: string; quantity: number; stockAfter: number; reason: string | null; orderCode?: string; createdAt: string }

const TYPE: Record<string, string> = { INITIAL: "Inicial", RESTOCK: "Reposición", SALE: "Venta", RELEASE: "Liberado", ADJUSTMENT: "Ajuste", DAILY_RESET: "Reposición diaria", RETURN: "Devolución" };

function StockRow({ p, v, onSaved }: { p: AdminProduct; v: AdminVariant; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(v.stock));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cap = v.dailyStock ?? Math.max(v.stock, v.lowStockThreshold * 4, 1);
  const pct = Math.min(100, (v.stock / cap) * 100);
  const state = v.stock === 0 ? { t: "Agotado", bg: "#FDECEA", fg: "#7A1E12", c: "var(--error)" } : v.stock <= v.lowStockThreshold ? { t: "Stock bajo", bg: "#FFF1E6", fg: "#8F3B0F", c: "var(--naranja)" } : { t: "Disponible", bg: "#E3F1E6", fg: "#1F5130", c: "var(--espresso)" };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/variants/${v.id}/stock`, { method: "POST", body: { type: Number(value) > v.stock ? "RESTOCK" : "ADJUSTMENT", setTo: Number(value), reason: "Ajuste desde el panel" } });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td style={{ fontFamily: "monospace", fontSize: 13 }}>{v.sku}</td>
      <td>{p.name} <span className="muted">· {v.name}</span></td>
      <td className="muted">{p.line === "CAFETERIA" ? "Cafetería" : "Empacado"}{v.dailyStock != null ? " · diario" : ""}</td>
      <td style={{ width: 230 }}>
        <div className="row" style={{ alignItems: "center", gap: 10, flexWrap: "nowrap" }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--borde-suave)", overflow: "hidden" }}>
            <motion.div style={{ height: "100%", background: state.c }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
          </div>
          <span style={{ width: 60, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v.stock}{v.dailyStock != null ? ` / ${v.dailyStock}` : ""}</span>
        </div>
      </td>
      <td><span className="badge" style={{ background: state.bg, color: state.fg }}>{state.t}</span></td>
      <td className="price">{soles(v.price)}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        {editing ? (
          <span className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
            <input aria-label={`Nuevo stock de ${v.sku}`} type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 70, height: 36, border: "1px solid var(--borde)", borderRadius: 8, padding: "0 8px" }} />
            <button type="button" className="btn btn-dark btn-sm" style={{ minHeight: 36 }} onClick={save} disabled={busy}>{busy ? <Spinner /> : "Guardar"}</button>
          </span>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 36 }} onClick={() => setEditing(true)}>Ajustar</button>
        )}
        {err && <div className="tiny" style={{ color: "var(--error)" }}>{err}</div>}
      </td>
    </tr>
  );
}

export function AdminInventory() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, m] = await Promise.all([
      api<{ products: AdminProduct[] }>("/admin/products"),
      api<{ movements: Movement[] }>("/admin/inventory/movements?pageSize=15"),
    ]);
    return { products: p.products, movements: m.movements };
  }, []);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <Alert>{error ?? "Sin datos"}</Alert>;

  const rows = data.products.flatMap((p) => p.variants.filter((v) => v.trackStock).map((v) => ({ p, v }))).filter(({ v }) => !onlyLow || v.stock <= v.lowStockThreshold);

  const dailyReset = async () => {
    const r = await api<{ resetVariants: number }>("/admin/inventory/daily-reset", { method: "POST", body: {} });
    setResetMsg(`Producción del día repuesta en ${r.resetVariants} productos.`);
    void reload();
  };

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h2" style={{ fontSize: 34 }}>Inventario</h1>
          <span className="small muted">Las bebidas se preparan al momento y no llevan stock. Los postres se reponen solos a las 6:00 a. m.</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <label className="check" style={{ alignItems: "center" }}><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />Solo stock bajo</label>
          <button type="button" className="btn btn-outline btn-sm" onClick={dailyReset}>Reponer producción del día</button>
        </div>
      </div>
      {resetMsg && <Alert kind="ok">{resetMsg}</Alert>}
      <section className="admin-card table-wrap">
        <table className="table" style={{ minWidth: 820, fontSize: 14 }}>
          <thead><tr><th>SKU</th><th>Producto</th><th>Línea</th><th>Stock</th><th>Estado</th><th>Precio</th><th><span className="sr-only">Acción</span></th></tr></thead>
          <tbody>{rows.map(({ p, v }) => <StockRow key={v.id} p={p} v={v} onSaved={() => void reload()} />)}</tbody>
        </table>
      </section>
      <section className="admin-card stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Últimos movimientos</h2>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 700, fontSize: 14 }}>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th style={{ textAlign: "right" }}>Cantidad</th><th style={{ textAlign: "right" }}>Stock</th><th>Detalle</th></tr></thead>
            <tbody>
              {data.movements.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{dateTime(m.createdAt)}</td>
                  <td>{m.product}</td>
                  <td>{TYPE[m.type] ?? m.type}</td>
                  <td style={{ textAlign: "right", color: m.quantity < 0 ? "var(--error)" : "var(--ok)", fontWeight: 600 }}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                  <td style={{ textAlign: "right" }}>{m.stockAfter}</td>
                  <td className="muted">{m.orderCode ?? m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
