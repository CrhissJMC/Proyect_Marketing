import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError, orderHeaders } from "../lib/api";
import { soles } from "../lib/format";
import type { NextStep, Order } from "../lib/types";
import { Alert, PageLoader, Spinner, Steps, useAsync } from "../components/ui";
import { IconClock, IconLock } from "../components/Icons";

type Tab = "CARD" | "YAPE" | "PLIN";

interface PayResponse {
  payment: { status: string; code: string; message: string };
  order: Order;
  nextStep: NextStep;
}

function brandOf(n: string) {
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTERCARD";
  if (/^3[47]/.test(n)) return "AMEX";
  return "";
}

function useCountdown(expiresAt: string | null | undefined) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

export function Payment() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { data: order, loading, error } = useAsync(() => api<{ order: Order }>(`/orders/${code}`, { headers: orderHeaders(code) }).then((r) => r.order), [code]);
  const [tab, setTab] = useState<Tab>("CARD");
  const [card, setCard] = useState({ number: "", holderName: "", exp: "", cvv: "" });
  const [wallet, setWallet] = useState({ phone: "", code: ["", "", "", "", "", ""] });
  const [cvvFocus, setCvvFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const left = useCountdown(order?.payment.expiresAt);

  useEffect(() => {
    if (order && (order.payment.method === "YAPE" || order.payment.method === "PLIN")) setTab(order.payment.method);
  }, [order]);

  if (loading) return <PageLoader />;
  if (error || !order) return <div className="container section"><Alert>{error ?? "Pedido no encontrado"}</Alert></div>;
  if (order.status !== "PENDING_PAYMENT") return <Navigate to={`/pedido/${order.code}`} replace />;

  const expired = left === 0;
  const digits = card.number.replace(/\D/g, "");
  const brand = brandOf(digits);
  const shownNumber = (digits.padEnd(16, "•").match(/.{1,4}/g) ?? []).join(" ");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFail(null);
    let body: unknown;
    if (tab === "CARD") {
      const [mm, yy] = card.exp.split("/").map((x) => Number(x.trim()));
      if (!mm || !yy) return setFail("Ingresa el vencimiento como MM/AA");
      body = { method: "CARD", card: { number: digits, holderName: card.holderName.trim() || "CLIENTE", expMonth: mm, expYear: yy, cvv: card.cvv } };
    } else {
      body = { method: tab, phone: wallet.phone.replace(/\D/g, ""), approvalCode: wallet.code.join("") };
    }
    setBusy(true);
    try {
      const r = await api<PayResponse>(`/orders/${code}/payments`, {
        method: "POST",
        body,
        headers: { ...orderHeaders(code), "Idempotency-Key": crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` },
        acceptStatus: [402],
      });
      if (r.payment.status === "APPROVED") navigate(`/pedido/${code}`, { replace: true });
      else setFail(r.payment.message);
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = Object.values(err.fieldErrors);
        setFail(fe.length ? fe.join(". ") : err.message);
      } else setFail("No pudimos procesar el pago.");
    } finally {
      setBusy(false);
    }
  };

  const setCodeDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    setWallet((w) => ({ ...w, code: w.code.map((c, j) => (j === i ? d : c)) }));
    if (d && i < 5) codeRefs.current[i + 1]?.focus();
  };

  const mm = left != null ? String(Math.floor(left / 60)).padStart(2, "0") : "--";
  const ss = left != null ? String(left % 60).padStart(2, "0") : "--";

  return (
    <div className="bg-soft">
      <div className="container-narrow stack" style={{ padding: "32px 32px 80px", gap: 24 }}>
        <Steps current={2} />

        <div className="row bg-dark" style={{ justifyContent: "space-between", alignItems: "center", gap: 16, padding: "18px 22px", borderRadius: 16 }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="tiny" style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--caramelo)" }}>Pedido registrado</span>
            <span style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 700, color: "#fff" }}>{order.code}</span>
          </div>
          <div role="timer" aria-live="off" className="row" style={{ alignItems: "center", gap: 12 }}>
            <motion.span animate={left != null && left < 120 ? { scale: [1, 1.15, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }} style={{ color: left != null && left < 120 ? "#F3B489" : "var(--arena)", display: "flex" }}><IconClock size={26} /></motion.span>
            <span className="stack" style={{ lineHeight: 1.2 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</span>
              <span className="small" style={{ color: "var(--arena)" }}>para completar el pago; luego el pedido se libera</span>
            </span>
          </div>
        </div>

        {expired ? (
          <Alert>El plazo de pago terminó y el pedido se liberó. <Link to="/carrito">Vuelve a armar tu carrito</Link>.</Alert>
        ) : (
          <div className="split">
            <form onSubmit={submit} className="main panel stack" style={{ gap: 24 }}>
              <h1 className="h2" style={{ fontSize: 32 }}>Completa tu pago</h1>
              <div role="tablist" aria-label="Medio de pago" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {(["CARD", "YAPE", "PLIN"] as Tab[]).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setFail(null); }}
                    style={{ minHeight: 56, borderRadius: 14, border: tab === t ? "2px solid var(--espresso)" : "1px solid var(--borde)", background: tab === t ? "var(--espresso)" : "#fff", color: tab === t ? "#fff" : "var(--espresso)", fontSize: 16, fontWeight: 500, cursor: "pointer", transition: "all .2s" }}>
                    {t === "CARD" ? "Tarjeta" : t === "YAPE" ? "Yape" : "Plin"}
                  </button>
                ))}
              </div>

              <AnimatePresence>{fail && <Alert>{fail}<br /><span className="small">Tu pedido sigue reservado. Intenta otra vez o usa otro medio de pago.</span></Alert>}</AnimatePresence>

              <AnimatePresence mode="wait">
                {tab === "CARD" ? (
                  <motion.div key="card" className="row" style={{ gap: 28, alignItems: "flex-start" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div aria-hidden style={{ flex: "0 0 300px", maxWidth: "100%", height: 186, perspective: 900 }}>
                      <motion.div animate={{ rotateY: cvvFocus ? 180 : 0 }} transition={{ duration: 0.6 }} style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d" }}>
                        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 18, background: "var(--espresso)", color: "var(--hueso)", padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
                          <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", border: "22px solid var(--espresso-2)" }} />
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                            <span style={{ width: 40, height: 30, borderRadius: 6, background: "var(--caramelo)" }} />
                            <span style={{ fontWeight: 700, fontStyle: "italic", fontSize: 18 }}>{brand}</span>
                          </div>
                          <span style={{ fontSize: 20, letterSpacing: ".12em", fontVariantNumeric: "tabular-nums", position: "relative" }}>{shownNumber}</span>
                          <div className="row tiny" style={{ justifyContent: "space-between", letterSpacing: ".1em", position: "relative" }}>
                            <span>{(card.holderName || "NOMBRE APELLIDO").toUpperCase()}</span><span>{card.exp || "MM/AA"}</span>
                          </div>
                        </div>
                        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 18, background: "var(--espresso-2)", overflow: "hidden" }}>
                          <div style={{ height: 40, background: "#141110", marginTop: 26 }} />
                          <div style={{ margin: "18px 22px", height: 36, background: "#F5EFE6", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 12px", color: "var(--espresso)", fontStyle: "italic" }}>{card.cvv.replace(/./g, "•") || "CVV"}</div>
                        </div>
                      </motion.div>
                    </div>
                    <div className="form-grid" style={{ flex: "1 1 300px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <label className="field full">Número de tarjeta
                        <input required inputMode="numeric" autoComplete="cc-number" value={card.number} maxLength={23}
                          onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d ]/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").replace(/\s+/g, " ") }))} placeholder="4111 1111 1111 1111" />
                      </label>
                      <label className="field full">Nombre en la tarjeta<input required autoComplete="cc-name" value={card.holderName} onChange={(e) => setCard((c) => ({ ...c, holderName: e.target.value }))} /></label>
                      <label className="field">Vencimiento
                        <input required autoComplete="cc-exp" placeholder="MM/AA" maxLength={5} value={card.exp}
                          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setCard((c) => ({ ...c, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d })); }} />
                      </label>
                      <label className="field">CVV
                        <input required inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.cvv} onFocus={() => setCvvFocus(true)} onBlur={() => setCvvFocus(false)}
                          onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "") }))} />
                      </label>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="wallet" className="row" style={{ gap: 28, alignItems: "flex-start" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <ol className="panel-soft small stack" style={{ flex: "1 1 240px", margin: 0, paddingLeft: 38, gap: 10, lineHeight: 1.5, color: "var(--marron)" }}>
                      <li>Abre tu app <strong>{tab === "YAPE" ? "Yape" : "Plin"}</strong>.</li>
                      <li>Busca la opción <strong>Código de aprobación</strong>.</li>
                      <li>Ingresa aquí tu celular y el código de 6 dígitos.</li>
                    </ol>
                    <div className="stack" style={{ flex: "1 1 300px", gap: 16 }}>
                      <label className="field">Celular asociado a {tab === "YAPE" ? "Yape" : "Plin"}
                        <input required type="tel" inputMode="numeric" maxLength={11} placeholder="9XX XXX XXX" value={wallet.phone} onChange={(e) => setWallet((w) => ({ ...w, phone: e.target.value }))} />
                      </label>
                      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                        <legend className="small" style={{ marginBottom: 8 }}>Código de aprobación</legend>
                        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                          {wallet.code.map((c, i) => (
                            <input key={i} ref={(el) => { codeRefs.current[i] = el; }} aria-label={`Dígito ${i + 1}`} inputMode="numeric" maxLength={1} value={c}
                              onChange={(e) => setCodeDigit(i, e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Backspace" && !c && i > 0) codeRefs.current[i - 1]?.focus(); }}
                              style={{ width: 48, height: 56, textAlign: "center", border: "1px solid #9A8A7E", borderRadius: 10, font: "500 22px var(--sans)" }} />
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="row" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--borde-suave)", paddingTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ minHeight: 56, padding: "0 32px", fontSize: 17 }} disabled={busy}>
                  {busy ? <><Spinner /> Procesando…</> : <><IconLock /> Pagar {soles(order.summary.total)}</>}
                </button>
              </div>
            </form>

            <aside className="side stack" style={{ gap: 16 }}>
              <div className="panel stack small" style={{ gap: 10, fontSize: 15 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>Resumen</h2>
                {order.items.map((i) => <div key={i.id} className="row" style={{ justifyContent: "space-between", gap: 8 }}><span>{i.quantity}× {i.productName} {i.variantName}</span><span className="price">{soles(i.lineTotal)}</span></div>)}
                {order.summary.discount > 0 && <div className="row" style={{ justifyContent: "space-between", color: "var(--ok)" }}><span>{order.summary.couponCode}</span><span>− {soles(order.summary.discount)}</span></div>}
                <div className="row" style={{ justifyContent: "space-between" }}><span>{order.shipping.label}</span><span>{order.summary.shipping ? soles(order.summary.shipping) : "Gratis"}</span></div>
                <div className="row" style={{ justifyContent: "space-between", borderTop: "1px dashed var(--caramelo)", paddingTop: 10, fontSize: 20, fontWeight: 600 }}><span>Total</span><span>{soles(order.summary.total)}</span></div>
                <span className="small muted">Comprobante: {order.receipt.type === "FACTURA" ? "Factura" : "Boleta"} electrónica</span>
              </div>
              <div className="panel-soft stack small" style={{ gap: 8, lineHeight: 1.5 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Datos de prueba (simulador)</h2>
                <span><strong>Aprobada:</strong> 4111 1111 1111 1111</span>
                <span><strong>Fondos insuficientes:</strong> 4000 0000 0000 0002</span>
                <span><strong>Vencimiento:</strong> cualquier fecha futura · <strong>CVV:</strong> 3 dígitos</span>
                <span><strong>Yape / Plin:</strong> cualquier código de 6 dígitos; 000000 = rechazo</span>
                <span className="muted">No se realizan cargos reales. Nunca guardamos el número completo ni el CVV.</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
