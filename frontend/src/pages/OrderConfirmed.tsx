import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, orderHeaders } from "../lib/api";
import { artForSku } from "../lib/art";
import { dateTime, soles, time } from "../lib/format";
import type { Order, OrderStatus } from "../lib/types";
import { ProductArt } from "../components/ProductArt";
import { Alert, PageLoader, Spinner, StatusBadge, Steps, useAsync } from "../components/ui";
import { IconDownload } from "../components/Icons";

/** Etapas visibles según la modalidad de entrega. */
export function stagesFor(order: Order): { status: OrderStatus; label: string }[] {
  const middle: Record<string, { status: OrderStatus; label: string }> = {
    PICKUP: { status: "READY_FOR_PICKUP", label: "Listo para recoger" },
    DELIVERY_LOCAL: { status: "OUT_FOR_DELIVERY", label: "En camino" },
    NATIONAL: { status: "SHIPPED", label: "Enviado por agencia" },
  };
  return [
    { status: "CONFIRMED", label: "Confirmado" },
    { status: "PREPARING", label: "En preparación" },
    middle[order.shipping.method],
    { status: "DELIVERED", label: "Entregado" },
  ];
}

export function OrderProgress({ order }: { order: Order }) {
  const stages = stagesFor(order);
  const reached = (s: OrderStatus) => order.timeline.find((t) => t.status === s);
  const currentIdx = stages.reduce((acc, s, i) => (reached(s.status) ? i : acc), -1);
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
      {stages.map((s, i) => {
        const done = i < currentIdx;
        const now = i === currentIdx;
        const at = reached(s.status)?.at;
        return (
          <li key={s.status} className="stack" style={{ alignItems: "center", gap: 10, textAlign: "center", position: "relative" }}>
            {i < stages.length - 1 && (
              <span style={{ position: "absolute", top: 19, left: "50%", width: "100%", height: 3, background: "var(--borde)" }}>
                <motion.span style={{ display: "block", height: "100%", background: "var(--espresso)", originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: i < currentIdx ? 1 : 0 }} transition={{ duration: 0.6, delay: 0.3 + i * 0.25 }} />
              </span>
            )}
            <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 + i * 0.25 }}
              style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", background: done ? "var(--espresso)" : now ? "var(--naranja)" : "#fff", border: `2px solid ${done ? "var(--espresso)" : now ? "var(--naranja)" : "var(--caramelo)"}`, color: done || now ? "#fff" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
              {done ? "✓" : i + 1}
            </motion.span>
            <span style={{ fontSize: 15, fontWeight: done || now ? 600 : 400 }}>{s.label}</span>
            <span className="small muted">{at ? time(at) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function downloadReceipt(order: Order) {
  const rows = order.items.map((i) => `<tr><td>${i.quantity}</td><td>${i.productName} (${i.variantName})</td><td style="text-align:right">${soles(i.unitPrice)}</td><td style="text-align:right">${soles(i.lineTotal)}</td></tr>`).join("");
  const igv = order.summary.total - order.summary.total / 1.18;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${order.receipt.number}</title>
<style>body{font-family:Arial,sans-serif;color:#2B1A12;max-width:720px;margin:32px auto;padding:0 16px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:14px;text-align:left}.box{border:2px solid #2B1A12;padding:12px;text-align:center;float:right}.muted{color:#7A6A5E;font-size:12px}</style></head><body>
<div class="box"><strong>${order.receipt.type === "FACTURA" ? "FACTURA" : "BOLETA DE VENTA"} ELECTRÓNICA</strong><br>RUC [referencial]<br><strong>${order.receipt.number}</strong></div>
<h1>Cafetería APU</h1><p>Pasaje Bracamoros N.° 137, Jaén<br>Pedido ${order.code} · ${dateTime(order.paidAt ?? order.createdAt)}</p>
<p><strong>Cliente:</strong> ${order.receipt.businessName ?? order.customer.name}<br><strong>${order.customer.docType}:</strong> ${order.customer.docNumber}</p>
<table><thead><tr><th>Cant.</th><th>Descripción</th><th style="text-align:right">P. unit.</th><th style="text-align:right">Importe</th></tr></thead><tbody>${rows}</tbody></table>
<p style="text-align:right">Subtotal: ${soles(order.summary.subtotal)}<br>Descuento: − ${soles(order.summary.discount)}<br>Entrega: ${soles(order.summary.shipping)}<br>IGV (incluido): ${soles(igv)}<br><strong>Total: ${soles(order.summary.total)}</strong></p>
<p class="muted">Documento de demostración generado por un prototipo académico. No tiene validez tributaria.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${order.receipt.number ?? order.code}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OrderConfirmed() {
  const { code = "" } = useParams();
  const { data: order, loading, error, setData } = useAsync(() => api<{ order: Order }>(`/orders/${code}`, { headers: orderHeaders(code) }).then((r) => r.order), [code]);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (loading) return <PageLoader />;
  if (error || !order) return <div className="container section"><Alert>{error ?? "Pedido no encontrado"}</Alert></div>;

  const cancelled = order.status === "CANCELLED";
  const pending = order.status === "PENDING_PAYMENT";
  const card = order.payment.attempts.find((a) => a.status === "APPROVED" || a.status === "REFUNDED");
  const canCancel = order.status === "CONFIRMED" || pending;

  const cancel = async () => {
    if (!window.confirm("¿Seguro que quieres cancelar este pedido? Si ya pagaste, el reembolso (simulado) va al mismo medio de pago.")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const r = await api<{ order: Order }>(`/orders/${code}/cancel`, { method: "POST", body: { reason: "Cancelado por el cliente desde la web" }, headers: orderHeaders(code) });
      setData(r.order);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "No se pudo cancelar");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <section className="bg-hueso" style={{ position: "relative", overflow: "hidden" }}>
        {!cancelled && (
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {Array.from({ length: 14 }, (_, i) => (
              <motion.svg key={i} width="18" height="26" viewBox="0 0 18 26" style={{ position: "absolute", left: `${(i * 7.3 + 4) % 100}%`, top: -30 }}
                initial={{ y: -30, rotate: 0, opacity: 0 }} animate={{ y: 460, rotate: 220 + i * 20, opacity: [0, 1, 1, 0] }} transition={{ duration: 2.4 + (i % 4) * 0.4, delay: 0.3 + (i % 5) * 0.15, ease: "easeIn" }}>
                <ellipse cx="9" cy="13" rx="7" ry="11" fill="#8A5A33" /><path d="M7 4 q4 9 0 18" stroke="#F5EFE6" strokeWidth="1.5" fill="none" />
              </motion.svg>
            ))}
          </div>
        )}
        <div className="container stack" style={{ position: "relative", maxWidth: 860, padding: "56px 32px", alignItems: "center", gap: 16, textAlign: "center" }}>
          {!cancelled && <div style={{ alignSelf: "stretch" }}><Steps current={3} /></div>}
          <span style={{ width: 84, height: 84, borderRadius: "50%", background: cancelled ? "var(--marron)" : pending ? "#B08A00" : "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path className="draw" d={cancelled ? "M7 7l10 10M17 7L7 17" : "M5 12.5l4.5 4.5L19 7.5"} />
            </svg>
          </span>
          <h1 className="h1">{cancelled ? "Pedido cancelado" : pending ? "Falta completar el pago" : "¡Gracias! Tu pedido está confirmado"}</h1>
          <p className="lead" style={{ maxWidth: 600 }}>
            {cancelled ? order.cancelReason : pending ? "Tu pedido está reservado por unos minutos." : order.shipping.method === "PICKUP" ? "Ya estamos preparando tu pausa. Te avisaremos cuando esté listo para recoger." : order.shipping.method === "NATIONAL" ? "Prepararemos tu café y te enviaremos el número de guía de la agencia." : "Ya estamos preparando tu pedido para llevarlo a tu dirección."}
          </p>
          <div className="row" style={{ gap: 12, justifyContent: "center" }}>
            <span className="chip chip-white" style={{ fontSize: 15, padding: "10px 18px" }}>Pedido <strong>{order.code}</strong></span>
            {order.receipt.number && <span className="chip chip-white" style={{ fontSize: 15, padding: "10px 18px" }}>{order.receipt.type === "FACTURA" ? "Factura" : "Boleta"} <strong>{order.receipt.number}</strong></span>}
            <span className="chip chip-white" style={{ fontSize: 15, padding: "10px 18px" }}>{card?.cardLast4 ? <>Pagado con <strong>{card.cardBrand} •••• {card.cardLast4}</strong></> : card ? <>Pagado con <strong>{card.methodLabel}</strong></> : order.payment.methodLabel}</span>
          </div>
          {pending && <Link to={`/pago/${order.code}`} className="btn btn-primary">Completar el pago</Link>}
        </div>
      </section>

      <div className="container-narrow split" style={{ padding: "48px 32px 80px" }}>
        <div className="main stack" style={{ gap: 24 }}>
          {!cancelled && (
            <section className="panel stack" style={{ gap: 22 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <h2 style={{ fontSize: 22, fontWeight: 600 }}>Estado de tu pedido</h2>
                <StatusBadge status={order.status} />
              </div>
              <OrderProgress order={order} />
              {order.shipping.trackingNumber && <p className="small">Agencia <strong>{order.shipping.carrier}</strong> · guía <strong>{order.shipping.trackingNumber}</strong></p>}
            </section>
          )}
          <section className="panel stack" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600 }}>Productos</h2>
            {order.items.map((i) => {
              const a = artForSku(i.sku);
              return (
                <div key={i.id} className="row" style={{ gap: 14, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--borde-suave)", flexWrap: "nowrap" }}>
                  <div style={{ width: 64, height: 64, flex: "none", borderRadius: 12, overflow: "hidden" }}><ProductArt kind={a.kind} bg={a.tint} label={a.label} labelBg={a.labelBg} steam={false} /></div>
                  <span style={{ flex: 1 }}><strong style={{ fontWeight: 500 }}>{i.quantity}× {i.productName}</strong><br /><span className="small muted">{i.variantName}</span></span>
                  <span className="price">{soles(i.lineTotal)}</span>
                </div>
              );
            })}
            <dl className="totals">
              <div><dt>Subtotal</dt><dd>{soles(order.summary.subtotal)}</dd></div>
              {order.summary.discount > 0 && <div className="discount"><dt>Descuento {order.summary.couponCode}</dt><dd>− {soles(order.summary.discount)}</dd></div>}
              <div><dt>{order.shipping.label}</dt><dd>{order.summary.shipping ? soles(order.summary.shipping) : "Gratis"}</dd></div>
              {order.summary.refunded > 0 && <div className="discount"><dt>Reembolsado (simulado)</dt><dd>{soles(order.summary.refunded)}</dd></div>}
              <div className="grand"><dt>Total</dt><dd>{soles(order.summary.total)}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="side stack" style={{ gap: 16 }}>
          <div className="panel-soft stack" style={{ gap: 8, fontSize: 15, lineHeight: 1.5 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>{order.shipping.label}</h2>
            {order.shipping.address ? (
              <span>{order.shipping.address.line1}{order.shipping.address.reference ? ` (${order.shipping.address.reference})` : ""}<br />{order.shipping.address.district}, {order.shipping.address.province}</span>
            ) : <span>Pasaje Bracamoros N.° 137, Jaén</span>}
            <span className="muted">{order.shipping.estimatedTime}</span>
            {order.shipping.method === "PICKUP" && <span>Muestra el código <strong>{order.code}</strong> en caja.</span>}
          </div>
          <Link to={`/seguimiento?code=${order.code}&email=${encodeURIComponent(order.customer.email)}`} className="btn btn-primary">Seguir mi pedido</Link>
          {order.receipt.number && <button type="button" className="btn btn-outline" onClick={() => downloadReceipt(order)}><IconDownload /> Descargar {order.receipt.type === "FACTURA" ? "factura" : "boleta"}</button>}
          {canCancel && <button type="button" className="btn btn-danger" onClick={cancel} disabled={cancelling}>{cancelling ? <Spinner /> : "Cancelar pedido"}</button>}
          {cancelError && <Alert>{cancelError}</Alert>}
          <Link to="/tienda" style={{ textAlign: "center", fontWeight: 500, textDecoration: "none", padding: 10 }}>Volver a la tienda</Link>
          {!cancelled && (
            <div className="bg-dark stack" style={{ borderRadius: 20, padding: 22, gap: 8 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700, color: "#fff" }}>Comparte tu pausa</span>
              <span className="small" style={{ lineHeight: 1.5, color: "var(--arena)" }}>Sube tu foto con #TuPausaTieneSaborAPU y etiqueta a @cafeteria_apu.</span>
            </div>
          )}
          <p className="small muted" style={{ lineHeight: 1.5 }}>¿Algún problema? Usa la sección de posventa en <Link to={`/seguimiento?code=${order.code}&email=${encodeURIComponent(order.customer.email)}`}>seguimiento</Link> o el <Link to="/reclamaciones">Libro de Reclamaciones</Link>.</p>
        </aside>
      </div>
    </>
  );
}
