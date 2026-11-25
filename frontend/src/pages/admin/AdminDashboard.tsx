import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { soles } from "../../lib/format";
import { Alert, PageLoader, useAsync } from "../../components/ui";

interface Dashboard {
  sales: { paidOrders: number; grossRevenue: number; refunded: number; netRevenue: number; discounts: number; averageTicket: number };
  funnel: { cartsCreated: number; ordersCreated: number; ordersPaid: number; cartToOrderRate: number | null; orderToPaidRate: number | null };
  ordersByStatus: { status: string; label: string; count: number }[];
  salesByLine: { line: string; units: number; revenue: number }[];
  topProducts: { product: string; units: number; revenue: number }[];
  byPaymentMethod: { method: string; orders: number; revenue: number }[];
  byShippingMethod: { method: string; orders: number; revenue: number }[];
  attribution: { bySource: { source: string; orders: number }[]; byCoupon: { code: string; channel: string; uses: number; discount: number }[] };
  alerts: { lowStockVariants: number; openReturns: number; pendingComplaints: number; newCorporateQuotes: number };
}

const PAY: Record<string, string> = { CARD: "Tarjeta", YAPE: "Yape", PLIN: "Plin", CASH_ON_DELIVERY: "Contra entrega", PAY_AT_STORE: "Pago en tienda" };
const SOURCE: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", GOOGLE: "Google", TRIPADVISOR: "TripAdvisor", INFLUENCER: "Creador de contenido", EMAIL: "Correo", RECOMENDACION: "Recomendación", OTRO: "Otro", SIN_DATO: "Sin dato" };

function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row small" style={{ justifyContent: "space-between" }}><span>{label}</span><strong>{text}</strong></div>
      <div style={{ height: 12, borderRadius: 6, background: "var(--hueso)", overflow: "hidden" }}>
        <motion.div style={{ height: "100%", background: "var(--naranja)" }} initial={{ width: 0 }} animate={{ width: `${max ? (value / max) * 100 : 0}%` }} transition={{ duration: 0.8 }} />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useAsync(() => {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    return api<Dashboard>(`/admin/dashboard?from=${from}`);
  }, [days]);

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <Alert>{error ?? "Sin datos"}</Alert>;

  const kpis = [
    { label: "Ventas netas", value: soles(data.sales.netRevenue), sub: `${soles(data.sales.refunded)} reembolsado` },
    { label: "Pedidos pagados", value: String(data.sales.paidOrders), sub: `${data.funnel.ordersCreated} registrados` },
    { label: "Ticket promedio", value: soles(data.sales.averageTicket), sub: "Meta del plan: S/ 16" },
    { label: "Carrito → pedido", value: data.funnel.cartToOrderRate != null ? `${data.funnel.cartToOrderRate} %` : "—", sub: `${data.funnel.cartsCreated} carritos` },
  ];
  const maxLine = Math.max(...data.salesByLine.map((l) => l.revenue), 0);
  const maxPay = Math.max(...data.byPaymentMethod.map((l) => l.revenue), 0);
  const maxSource = Math.max(...data.attribution.bySource.map((s) => s.orders), 0);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h2" style={{ fontSize: 34 }}>Métricas de la tienda</h1>
          <span className="small muted">Datos reales de la base de datos · últimos {days} días</span>
        </div>
        <div className="seg" role="group" aria-label="Periodo">
          {[7, 30, 90].map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>{d} días</button>)}
        </div>
      </div>

      <div className="grid-fit" style={{ ["--min" as string]: "200px", gap: 16 }}>
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="admin-card stack" style={{ gap: 6 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <span className="small" style={{ color: "var(--marron)" }}>{k.label}</span>
            <span style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{k.value}</span>
            <span className="small muted">{k.sub}</span>
          </motion.div>
        ))}
      </div>

      <div className="row" style={{ gap: 16 }}>
        <section className="admin-card stack" style={{ flex: "1 1 340px", gap: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Embudo de conversión</h2>
          <Bar label="Carritos creados" value={data.funnel.cartsCreated} max={data.funnel.cartsCreated} text={String(data.funnel.cartsCreated)} />
          <Bar label="Pedidos registrados" value={data.funnel.ordersCreated} max={data.funnel.cartsCreated} text={String(data.funnel.ordersCreated)} />
          <Bar label="Pedidos pagados" value={data.funnel.ordersPaid} max={data.funnel.cartsCreated} text={`${data.funnel.ordersPaid} (${data.funnel.orderToPaidRate ?? 0} %)`} />
        </section>
        <section className="admin-card stack" style={{ flex: "1 1 300px", gap: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Ventas por línea</h2>
          {data.salesByLine.length === 0 && <span className="muted small">Aún sin ventas.</span>}
          {data.salesByLine.map((l) => <Bar key={l.line} label={l.line === "CAFETERIA" ? "Cafetería" : "Café empacado"} value={l.revenue} max={maxLine} text={`${soles(l.revenue)} · ${l.units} u.`} />)}
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>Medios de pago</h2>
          {data.byPaymentMethod.map((l) => <Bar key={l.method} label={PAY[l.method] ?? l.method} value={l.revenue} max={maxPay} text={`${l.orders} ped.`} />)}
        </section>
        <section className="stack bg-dark" style={{ flex: "1 1 260px", gap: 12, borderRadius: 18, padding: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>Requiere atención</h2>
          {[
            ["Productos con stock bajo", data.alerts.lowStockVariants, "/admin/inventario"],
            ["Devoluciones abiertas", data.alerts.openReturns, "/admin/atencion"],
            ["Reclamos por responder", data.alerts.pendingComplaints, "/admin/atencion"],
            ["Cotizaciones B2B nuevas", data.alerts.newCorporateQuotes, "/admin/atencion"],
          ].map(([l, n, to]) => (
            <Link key={l as string} to={to as string} className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "var(--espresso-2)", color: "var(--hueso)", textDecoration: "none" }}>
              <span className="small">{l}</span><strong style={{ fontSize: 18, color: "#F3B489" }}>{n}</strong>
            </Link>
          ))}
        </section>
      </div>

      <div className="row" style={{ gap: 16 }}>
        <section className="admin-card stack" style={{ flex: "1 1 360px", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Atribución: ¿cómo nos conocieron?</h2>
          <span className="small muted">Conecta las ventas con las estrategias del plan de marketing</span>
          {data.attribution.bySource.map((s) => <Bar key={s.source} label={SOURCE[s.source] ?? s.source} value={s.orders} max={maxSource} text={`${s.orders} ped.`} />)}
          <div className="table-wrap"><table className="table" style={{ fontSize: 14, marginTop: 8 }}>
            <thead><tr><th>Cupón</th><th>Canal</th><th style={{ textAlign: "right" }}>Usos</th><th style={{ textAlign: "right" }}>Descuento</th></tr></thead>
            <tbody>
              {data.attribution.byCoupon.length === 0 ? <tr><td colSpan={4} className="muted">Sin cupones usados en el periodo.</td></tr> : data.attribution.byCoupon.map((c) => (
                <tr key={c.code}><td><code>{c.code}</code></td><td>{c.channel}</td><td style={{ textAlign: "right" }}>{c.uses}</td><td style={{ textAlign: "right" }}>{soles(c.discount)}</td></tr>
              ))}
            </tbody>
          </table></div>
        </section>
        <section className="admin-card stack" style={{ flex: "1 1 300px", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Más vendidos</h2>
          {data.topProducts.length === 0 && <span className="muted small">Aún sin ventas.</span>}
          {data.topProducts.map((t, i) => (
            <div key={t.product} className="row small" style={{ alignItems: "center", gap: 12, flexWrap: "nowrap" }}>
              <span style={{ width: 24, fontWeight: 600, color: "var(--naranja)" }}>{i + 1}</span>
              <span style={{ flex: 1 }}>{t.product}</span>
              <span className="muted">{t.units} u. · {soles(t.revenue)}</span>
            </div>
          ))}
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>Pedidos por estado</h2>
          <div className="row" style={{ gap: 8 }}>
            {data.ordersByStatus.map((s) => <span key={s.status} className={`badge badge-${s.status}`}>{s.label}: {s.count}</span>)}
          </div>
        </section>
      </div>
    </>
  );
}
