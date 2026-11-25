import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError, orderHeaders } from "../lib/api";
import { slugForSku } from "../lib/art";
import { dateTime } from "../lib/format";
import type { Order, OrderStatus } from "../lib/types";
import { Alert, Spinner, StatusBadge } from "../components/ui";

interface Track {
  code: string;
  status: OrderStatus;
  statusLabel: string;
  shippingMethod: string;
  estimatedTime: string;
  carrier: string | null;
  trackingNumber: string | null;
  timeline: { status: OrderStatus; label: string; note: string | null; at: string }[];
}

function ReviewForm({ order }: { order: Order }) {
  const products = Array.from(new Map(order.items.map((i) => [slugForSku(i.sku), i])).entries());
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const reviews = Object.entries(ratings).map(([productSlug, rating]) => ({ productSlug, rating, comment: comment.trim() || undefined }));
    if (!reviews.length) return setError("Califica al menos un producto");
    setState("busy");
    setError(null);
    try {
      await api(`/orders/${order.code}/reviews`, { method: "POST", body: { reviews }, headers: orderHeaders(order.code) });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar");
      setState("idle");
    }
  };

  if (state === "done") return <Alert kind="ok">¡Gracias por tu opinión! Ya aparece como compra verificada.</Alert>;
  return (
    <form onSubmit={send} className="panel-soft stack" style={{ gap: 14 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600 }}>¿Qué tal tu pausa?</h2>
      <p className="small" style={{ color: "var(--marron)" }}>Tu opinión aparece como compra verificada.</p>
      {products.map(([slug, item]) => (
        <div key={slug} className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 14px", borderRadius: 12, background: "#fff" }}>
          <span>{item.productName}</span>
          <span role="radiogroup" aria-label={`Calificación de ${item.productName}`} className="row" style={{ gap: 0 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.button key={n} type="button" role="radio" aria-checked={ratings[slug] === n} aria-label={`${n} estrellas`} whileTap={{ scale: 1.4 }}
                onClick={() => setRatings((r) => ({ ...r, [slug]: n }))}
                style={{ width: 36, height: 44, border: 0, background: "none", fontSize: 26, cursor: "pointer", color: (ratings[slug] ?? 0) >= n ? "var(--naranja)" : "#D8C6B0" }}>★</motion.button>
            ))}
          </span>
        </div>
      ))}
      <label className="field">Comentario (opcional)<textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} /></label>
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn btn-dark" style={{ alignSelf: "flex-start" }} disabled={state === "busy"}>{state === "busy" ? <Spinner /> : "Publicar opinión"}</button>
    </form>
  );
}

function ReturnForm({ order }: { order: Order }) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("MAL_ESTADO");
  const [type, setType] = useState<"REPLACEMENT" | "REFUND">("REPLACEMENT");
  const [description, setDescription] = useState("");
  const [sealed, setSealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const hasPackaged = order.items.some((i) => !i.perishable);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const items = Object.entries(selected).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!items.length) return setResult({ ok: false, msg: "Selecciona al menos un producto" });
    setBusy(true);
    setResult(null);
    try {
      const r = await api<{ return: { code: string }; message: string }>(`/orders/${order.code}/returns`, {
        method: "POST",
        body: { type, reason, description, productSealed: sealed, items },
        headers: orderHeaders(order.code),
      });
      setResult({ ok: true, msg: `Solicitud ${r.return.code} registrada. ${r.message}` });
    } catch (err) {
      const fe = err instanceof ApiError ? Object.values(err.fieldErrors) : [];
      setResult({ ok: false, msg: fe.length ? fe.join(". ") : err instanceof Error ? err.message : "No se pudo registrar" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={send} className="panel stack" style={{ gap: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600 }}>¿Algo no salió bien?</h2>
      <div className="row small" style={{ gap: 10 }}>
        <span style={{ padding: "8px 12px", borderRadius: 10, background: "#FFF4EC", color: "var(--naranja-osc)" }}><strong>Bebidas y postres:</strong> hasta 2 h después de la entrega</span>
        <span style={{ padding: "8px 12px", borderRadius: 10, background: "var(--hueso)", color: "var(--marron)" }}><strong>Café empacado:</strong> 7 días, empaque cerrado</span>
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
        <legend className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Productos</legend>
        {order.items.map((i) => (
          <label key={i.id} className="check" style={{ alignItems: "center", minHeight: 36 }}>
            <input type="checkbox" checked={!!selected[i.id]} onChange={(e) => setSelected((s) => ({ ...s, [i.id]: e.target.checked ? i.quantity : 0 }))} />
            {i.productName} ({i.variantName}) × {i.quantity}
          </label>
        ))}
      </fieldset>
      <div className="form-grid">
        <label className="field">Motivo
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="MAL_ESTADO">Llegó en mal estado</option>
            <option value="PRODUCTO_EQUIVOCADO">Producto equivocado</option>
            <option value="INCOMPLETO">Pedido incompleto</option>
            <option value="DANADO_EN_ENVIO">Dañado en el envío</option>
            <option value="NO_LO_QUIERO">Ya no lo quiero (solo empacados cerrados)</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className="field">¿Qué prefieres?
          <select value={type} onChange={(e) => setType(e.target.value as "REPLACEMENT" | "REFUND")}>
            <option value="REPLACEMENT">Reposición del producto</option>
            <option value="REFUND">Reembolso al mismo medio de pago</option>
          </select>
        </label>
      </div>
      {hasPackaged && <label className="check"><input type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} />El empaque del café está cerrado</label>}
      <label className="field">Cuéntanos qué pasó<textarea required minLength={10} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mínimo 10 caracteres" /></label>
      {result && <Alert kind={result.ok ? "ok" : "error"}>{result.msg}</Alert>}
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Enviar solicitud"}</button>
        <span className="small muted">Respondemos en menos de 24 horas.</span>
      </div>
      <p className="tiny muted">Si no estás conforme con la respuesta, puedes registrar un reclamo en el <Link to="/reclamaciones">Libro de Reclamaciones</Link>.</p>
    </form>
  );
}

export function Tracking() {
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [track, setTrack] = useState<Track | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (c: string, m: string) => {
    if (!c || !m) return;
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const t = await api<Track>(`/orders/track?code=${encodeURIComponent(c.trim().toUpperCase())}&email=${encodeURIComponent(m.trim())}`);
      setTrack(t);
      try {
        // Detalle completo solo si este dispositivo hizo la compra o la cuenta es la dueña.
        setOrder((await api<{ order: Order }>(`/orders/${t.code}`, { headers: orderHeaders(t.code) })).order);
      } catch {
        setOrder(null);
      }
    } catch (e) {
      setTrack(null);
      setError(e instanceof ApiError && e.status === 404 ? "No encontramos un pedido con ese código y correo." : e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void search(params.get("code") ?? "", params.get("email") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setParams({ code, email }, { replace: true });
    void search(code, email);
  };

  const delivered = track?.status === "DELIVERED";

  return (
    <>
      <section className="bg-hueso">
        <div className="container-narrow row" style={{ padding: "44px 32px", gap: 28, alignItems: "flex-end", justifyContent: "space-between" }}>
          <div className="stack" style={{ flex: "1 1 360px", gap: 10 }}>
            <h1 className="h1">Sigue tu pedido</h1>
            <p className="lead" style={{ fontSize: 17 }}>Ingresa el código que te enviamos y el correo de la compra.</p>
          </div>
          <form onSubmit={submit} className="row" style={{ flex: "1 1 520px", gap: 10, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 180px" }}>Código de pedido<input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="APU-2026-000001" /></label>
            <label className="field" style={{ flex: "1 1 220px" }}>Correo electrónico<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? <Spinner /> : "Buscar"}</button>
          </form>
        </div>
      </section>

      <div className="container-narrow" style={{ padding: "44px 32px 80px" }}>
        {error && <Alert>{error}</Alert>}
        <AnimatePresence mode="wait">
          {track && (
            <motion.div key={track.code} className="split" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <section className="side panel stack" style={{ gap: 18, maxWidth: "none", flex: "1 1 420px" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <h2 style={{ fontSize: 22, fontWeight: 600 }}>{track.code}</h2>
                  <StatusBadge status={track.status} />
                </div>
                <span style={{ color: "var(--marron)" }}>{track.shippingMethod} · {track.estimatedTime}</span>
                {track.trackingNumber && <span className="small">Agencia <strong>{track.carrier}</strong> · guía <strong>{track.trackingNumber}</strong></span>}
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {track.timeline.map((t, i) => (
                    <motion.li key={t.at + t.status} className="row" style={{ gap: 16, flexWrap: "nowrap" }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}>
                      <div className="stack" style={{ alignItems: "center" }}>
                        <span style={{ width: 16, height: 16, borderRadius: "50%", background: i === track.timeline.length - 1 ? "var(--naranja)" : "var(--espresso)", marginTop: 4, flex: "none" }} />
                        {i < track.timeline.length - 1 && <motion.span style={{ width: 2, flex: 1, minHeight: 32, background: "var(--espresso)", originY: 0 }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.15 + 0.1 }} />}
                      </div>
                      <div className="stack" style={{ gap: 2, paddingBottom: 18 }}>
                        <span style={{ fontWeight: 600 }}>{t.label}</span>
                        <span className="small muted">{dateTime(t.at)}</span>
                        {t.note && <span className="small" style={{ color: "var(--marron)" }}>{t.note}</span>}
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </section>

              <div className="main stack" style={{ gap: 24 }}>
                {order && delivered && <ReviewForm order={order} />}
                {order && delivered && <ReturnForm order={order} />}
                {order && !delivered && track.status !== "CANCELLED" && (
                  <div className="panel-soft stack" style={{ gap: 10 }}>
                    <strong>Tu pedido está en curso</strong>
                    <span className="small" style={{ color: "var(--marron)" }}>Cuando lo recibas podrás calificarlo o reportar cualquier problema desde aquí.</span>
                    <Link to={`/pedido/${order.code}`} className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Ver detalle del pedido</Link>
                  </div>
                )}
                {!order && (
                  <div className="panel-soft stack" style={{ gap: 10 }}>
                    <strong>¿Necesitas posventa?</strong>
                    <span className="small" style={{ color: "var(--marron)" }}>Para calificar o solicitar una devolución, abre esta página desde el dispositivo donde compraste o <Link to="/acceso">inicia sesión</Link> con la cuenta del pedido.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!track && !error && !busy && <p className="muted">Encontrarás el código en la confirmación de tu compra (por ejemplo, APU-2026-000001).</p>}
      </div>
    </>
  );
}
