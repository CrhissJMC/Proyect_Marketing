import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError, orderTokens } from "../lib/api";
import { soles } from "../lib/format";
import type { NextStep, Order, PaymentMethod, ShippingMethod } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { Alert, PageLoader, Spinner, Steps } from "../components/ui";
import { IconLock } from "../components/Icons";
import { SHIP_KEY } from "./Cart";

const PAY_LABELS: Record<PaymentMethod, { label: string; chip: string; bg: string; fg: string; info: string }> = {
  CARD: { label: "Tarjeta de crédito o débito", chip: "VISA · MC", bg: "#EFE4D6", fg: "#2B1A12", info: "Pagarás en el siguiente paso. Solo guardamos la marca y los últimos 4 dígitos de tu tarjeta." },
  YAPE: { label: "Yape", chip: "Yape", bg: "#742284", fg: "#fff", info: "En el siguiente paso ingresa tu celular y el código de aprobación de 6 dígitos de tu app Yape." },
  PLIN: { label: "Plin", chip: "Plin", bg: "#0A7F8C", fg: "#fff", info: "En el siguiente paso ingresa tu celular y el código de aprobación de tu banco." },
  CASH_ON_DELIVERY: { label: "Efectivo contra entrega", chip: "Efectivo", bg: "#EFE4D6", fg: "#2B1A12", info: "Paga en efectivo al recibir tu pedido." },
  PAY_AT_STORE: { label: "Pago al recoger en tienda", chip: "En tienda", bg: "#EFE4D6", fg: "#2B1A12", info: "Paga en caja al recoger tu pedido en Pasaje Bracamoros 137." },
};

const SOURCES = [
  ["", "Selecciona"], ["INSTAGRAM", "Instagram"], ["TIKTOK", "TikTok"], ["FACEBOOK", "Facebook"], ["GOOGLE", "Google"],
  ["TRIPADVISOR", "TripAdvisor"], ["INFLUENCER", "Un creador de contenido"], ["EMAIL", "Correo de APU"], ["RECOMENDACION", "Recomendación"], ["OTRO", "Otro"],
];

function Field({ label, name, errors, required, children, full, hint }: { label: string; name: string; errors: Record<string, string>; required?: boolean; children: ReactNode; full?: boolean; hint?: string }) {
  const err = errors[name];
  return (
    <label className={`field${err ? " has-error" : ""}${full ? " full" : ""}`}>
      <span>{label} {required && <span className="req">*</span>}</span>
      {children}
      {err ? <span className="err" role="alert">{err}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Checkout() {
  const { user } = useAuth();
  const { cart, loading, quote, coupon, reset } = useCart();
  const navigate = useNavigate();

  const [first, ...rest] = (user?.fullName ?? "").split(" ");
  const [form, setForm] = useState({
    firstName: first ?? "",
    lastName: rest.join(" "),
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    docType: user?.docType && user.docType !== "RUC" ? user.docType : "DNI",
    docNumber: user?.docType !== "RUC" ? (user?.docNumber ?? "") : "",
    receiptType: "BOLETA" as "BOLETA" | "FACTURA",
    ruc: "",
    businessName: "",
    line1: "",
    reference: "",
    district: "Jaén",
    province: "Jaén",
    department: "Cajamarca",
    notes: "",
    source: "",
    acceptTerms: false,
    marketingConsent: false,
  });
  const [ship, setShip] = useState<ShippingMethod>(() => (sessionStorage.getItem(SHIP_KEY) as ShippingMethod) || "PICKUP");
  const [pay, setPay] = useState<PaymentMethod>("YAPE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const options = cart?.shippingOptions ?? [];
  const selected = options.find((o) => o.method === ship);
  const allowedPays = (selected?.paymentMethods ?? ["CARD", "YAPE", "PLIN"]) as PaymentMethod[];
  useEffect(() => {
    if (!allowedPays.includes(pay)) setPay(allowedPays.includes("YAPE") ? "YAPE" : allowedPays[0]);
  }, [allowedPays, pay]);
  useEffect(() => {
    if (selected && !selected.available) {
      const ok = options.find((o) => o.available);
      if (ok) setShip(ok.method);
    }
  }, [selected, options]);

  const needsAddress = ship !== "PICKUP";
  const address = useMemo(
    () => needsAddress && form.line1.trim().length >= 5 && form.district.trim()
      ? { recipient: `${form.firstName} ${form.lastName}`.trim() || "Cliente", phone: form.phone || "900000000", line1: form.line1, reference: form.reference || undefined, district: form.district, province: form.province, department: form.department }
      : undefined,
    [needsAddress, form.line1, form.district, form.province, form.department, form.reference, form.firstName, form.lastName, form.phone],
  );

  // Recalcula envío y cupón cuando cambian la entrega o la dirección.
  const [quoteError, setQuoteError] = useState<string | null>(null);
  useEffect(() => {
    if (!cart?.items.length) return;
    const t = setTimeout(() => {
      quote({ shippingMethod: ship, address, email: form.email.includes("@") ? form.email : undefined })
        .then((c) => setQuoteError(c.shipping && !c.shipping.available ? c.shipping.problems.join(". ") : null))
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ship, address?.district, address?.line1, cart?.items.length]);

  if (loading && !cart) return <PageLoader />;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="container section stack" style={{ gap: 16, alignItems: "flex-start" }}>
        <h1 className="h1">No hay productos para pagar</h1>
        <Link to="/tienda" className="btn btn-primary">Ir a la tienda</Link>
      </div>
    );
  }

  const shipCost = cart.shipping?.method === ship ? cart.shipping.cost : (selected?.cost ?? 0);
  const total = cart.summary.subtotal - cart.summary.discount + shipCost;
  const igv = total - total / 1.18;
  const online = pay === "CARD" || pay === "YAPE" || pay === "PLIN";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const local: Record<string, string> = {};
    if (!form.firstName.trim()) local["customer.fullName"] = "Ingresa tus nombres";
    if (!form.acceptTerms) local.acceptTerms = "Debes aceptar los términos y la política de privacidad";
    if (needsAddress && form.line1.trim().length < 5) local["address.line1"] = "Ingresa la dirección de entrega";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        cartId: cart.cartId,
        customer: { fullName: `${form.firstName} ${form.lastName}`.trim(), email: form.email, phone: form.phone.replace(/\s/g, ""), docType: form.docType, docNumber: form.docNumber.trim() },
        shippingMethod: ship,
        address: needsAddress ? { recipient: `${form.firstName} ${form.lastName}`.trim(), phone: form.phone.replace(/\s/g, ""), line1: form.line1, reference: form.reference || undefined, district: form.district, province: form.province, department: form.department } : undefined,
        paymentMethod: pay,
        couponCode: coupon ?? undefined,
        receiptType: form.receiptType,
        ruc: form.receiptType === "FACTURA" ? form.ruc.trim() : undefined,
        businessName: form.receiptType === "FACTURA" ? form.businessName.trim() : undefined,
        notes: form.notes.trim() || undefined,
        source: form.source || undefined,
        acceptTerms: true,
        marketingConsent: form.marketingConsent,
      };
      const r = await api<{ order: Order; orderToken: string; nextStep: NextStep }>("/orders", { method: "POST", body });
      orderTokens.set(r.order.code, r.orderToken);
      reset();
      navigate(r.nextStep.type === "PAY_ONLINE" ? `/pago/${r.order.code}` : `/pedido/${r.order.code}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        setErrors(fe);
        setFormError(Object.keys(fe).length ? "Revisa los campos marcados." : err.message);
      } else setFormError("No pudimos registrar tu pedido. Intenta nuevamente.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-soft">
      <div className="container-narrow stack" style={{ paddingTop: 32, gap: 14 }}>
        <Steps current={1} />
        {!user && (
          <div className="row small" style={{ background: "#fff", boxShadow: "0 2px 10px rgba(43,26,18,.07)", padding: "16px 20px", gap: 8 }}>
            <span className="muted">¿Ya eres cliente?</span> <Link to="/acceso?next=/checkout" style={{ color: "var(--espresso)" }}>Haz clic aquí para acceder</Link>
          </div>
        )}
        {formError && <Alert>{formError}</Alert>}
      </div>

      <form onSubmit={submit} noValidate className="container-narrow split" style={{ padding: "24px 32px 80px" }}>
        <div className="main stack" style={{ background: "#fff", border: "1px solid var(--borde)", borderTop: "3px solid var(--naranja)", padding: 28, gap: 28 }}>
          <section className="stack" style={{ gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 500 }}>Tus datos</h2>
            <div className="form-grid">
              <Field label="Nombres" name="customer.fullName" errors={errors} required><input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" /></Field>
              <Field label="Apellidos" name="lastName" errors={errors} required><input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" /></Field>
              <Field label="Correo electrónico" name="customer.email" errors={errors} required><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
              <Field label="Celular" name="customer.phone" errors={errors} required hint="9 dígitos"><input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XX XXX XXX" autoComplete="tel" /></Field>
              <Field label="Tipo de documento" name="customer.docType" errors={errors} required>
                <select value={form.docType} onChange={(e) => set("docType", e.target.value)}><option value="DNI">DNI</option><option value="CE">Carné de extranjería</option><option value="PASAPORTE">Pasaporte</option></select>
              </Field>
              <Field label="Número de documento" name="customer.docNumber" errors={errors} required><input value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} inputMode="numeric" /></Field>
            </div>
          </section>

          <section className="stack" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 500 }}>Comprobante</h2>
            <div className="seg" role="radiogroup" aria-label="Tipo de comprobante" style={{ alignSelf: "flex-start" }}>
              <button type="button" aria-pressed={form.receiptType === "BOLETA"} onClick={() => set("receiptType", "BOLETA")}>Boleta</button>
              <button type="button" aria-pressed={form.receiptType === "FACTURA"} onClick={() => set("receiptType", "FACTURA")}>Factura (con RUC)</button>
            </div>
            <AnimatePresence>
              {form.receiptType === "FACTURA" && (
                <motion.div className="form-grid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                  <Field label="RUC" name="ruc" errors={errors} required><input value={form.ruc} onChange={(e) => set("ruc", e.target.value)} inputMode="numeric" placeholder="11 dígitos" /></Field>
                  <Field label="Razón social" name="businessName" errors={errors} required><input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} /></Field>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="stack" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 500 }}>Entrega</h2>
            <div className="options" role="radiogroup" aria-label="Tipo de entrega">
              {options.map((o) => (
                <button key={o.method} type="button" role="radio" aria-checked={o.method === ship} disabled={!o.available && o.method !== ship} onClick={() => setShip(o.method)} className="option">
                  <span className="t">{o.label}</span>
                  <span className="d">{o.available ? o.estimatedTime : o.problems[0]}</span>
                  <span style={{ fontWeight: 500, marginTop: 4 }}>{o.cost === 0 ? "Gratis" : soles(o.cost)}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {needsAddress ? (
                <motion.div key="addr" className="form-grid" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Field label="Dirección" name="address.line1" errors={errors} required full><input value={form.line1} onChange={(e) => set("line1", e.target.value)} placeholder="Calle, número, interior" autoComplete="street-address" /></Field>
                  <Field label="Referencia" name="address.reference" errors={errors}><input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Frente a…, color de fachada" /></Field>
                  <Field label="Distrito" name="address.district" errors={errors} required><input value={form.district} onChange={(e) => set("district", e.target.value)} /></Field>
                  <Field label="Provincia" name="address.province" errors={errors} required><input value={form.province} onChange={(e) => set("province", e.target.value)} /></Field>
                  <Field label="Departamento" name="address.department" errors={errors} required><input value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
                </motion.div>
              ) : (
                <motion.p key="pick" className="panel-soft small" style={{ padding: "12px 14px", color: "var(--marron)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Recoge en Pasaje Bracamoros N.° 137, Jaén. Te avisaremos cuando esté listo.
                </motion.p>
              )}
            </AnimatePresence>
            {quoteError && <Alert kind="warn">{quoteError}</Alert>}
          </section>

          <section className="stack" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 500 }}>Información adicional</h2>
            <Field label="Notas del pedido (opcional)" name="notes" errors={errors}><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Por ejemplo: sin azúcar, leche deslactosada" maxLength={300} /></Field>
            <Field label="¿Cómo nos conociste? (opcional)" name="source" errors={errors}>
              <select value={form.source} onChange={(e) => set("source", e.target.value)} style={{ maxWidth: 360 }}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
          </section>
        </div>

        <aside aria-label="Tu pedido" className="side stack" style={{ gap: 18 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500 }}>Tu pedido</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid var(--borde)", borderTop: "3px solid var(--naranja)", background: "#fff", fontSize: 14 }}>
            <thead>
              <tr style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--marron)", textAlign: "left" }}>
                <th scope="col" style={{ padding: "14px 16px", fontWeight: 500, borderBottom: "1px solid var(--borde)" }}>PRODUCTO</th>
                <th scope="col" style={{ padding: "14px 16px", fontWeight: 500, borderBottom: "1px solid var(--borde)" }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((i) => (
                <tr key={i.variantId}>
                  <td style={{ padding: "14px 16px", borderBottom: "1px solid var(--borde-suave)", lineHeight: 1.5 }}>{i.productName} <strong>× {i.quantity}</strong><br /><span className="muted">{i.variantName}</span></td>
                  <td className="price" style={{ padding: "14px 16px", borderBottom: "1px solid var(--borde-suave)", whiteSpace: "nowrap" }}>{soles(i.lineTotal)}</td>
                </tr>
              ))}
              <tr><td style={{ padding: "12px 16px", borderBottom: "1px solid var(--borde-suave)", fontSize: 11, letterSpacing: ".08em", color: "var(--marron)" }}>SUBTOTAL</td><td className="price" style={{ padding: "12px 16px", borderBottom: "1px solid var(--borde-suave)" }}>{soles(cart.summary.subtotal)}</td></tr>
              {cart.summary.discount > 0 && <tr><td style={{ padding: "12px 16px", borderBottom: "1px solid var(--borde-suave)", fontSize: 11, letterSpacing: ".08em", color: "var(--marron)" }}>DESCUENTO {cart.coupon?.code}</td><td className="price" style={{ padding: "12px 16px", borderBottom: "1px solid var(--borde-suave)", color: "var(--ok)" }}>− {soles(cart.summary.discount)}</td></tr>}
              <tr><td style={{ padding: "12px 16px", borderBottom: "1px solid var(--borde-suave)", fontSize: 11, letterSpacing: ".08em", color: "var(--marron)" }}>ENTREGA</td><td style={{ padding: "12px 16px", borderBottom: "1px solid var(--borde-suave)" }}>{selected?.label}: {shipCost ? soles(shipCost) : "Gratis"}</td></tr>
              <tr><td style={{ padding: "14px 16px", fontSize: 11, letterSpacing: ".08em", color: "var(--marron)" }}>TOTAL</td><td style={{ padding: "14px 16px" }}><strong style={{ fontSize: 18 }}>{soles(total)}</strong> <span className="muted">(incluye {soles(igv)} IGV)</span></td></tr>
            </tbody>
          </table>

          <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
            <legend style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>Medio de pago</legend>
            <div className="stack" style={{ gap: 8 }} role="radiogroup">
              {allowedPays.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={m === pay} onClick={() => setPay(m)} className="option" style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--espresso)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    {m === pay && <motion.span layoutId="paydot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--espresso)" }} />}
                  </span>
                  <span style={{ flex: 1 }}>{PAY_LABELS[m].label}</span>
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: PAY_LABELS[m].bg, color: PAY_LABELS[m].fg, fontWeight: 600 }}>{PAY_LABELS[m].chip}</span>
                </button>
              ))}
            </div>
            <motion.p key={pay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="small" style={{ marginTop: 10, padding: "14px 16px", background: "#F3EEE8", lineHeight: 1.5, color: "var(--marron)" }}>{PAY_LABELS[pay].info}</motion.p>
          </fieldset>

          <p className="small" style={{ lineHeight: 1.6, color: "var(--marron)" }}>Tus datos personales se usarán solo para procesar tu pedido, emitir el comprobante y atenderte en la posventa, según nuestra <Link to="/historia#politicas" style={{ color: "var(--espresso)" }}>política de privacidad</Link> (Ley N.° 29733).</p>
          <label className="check">
            <input type="checkbox" checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} />
            <span>He leído y acepto los <Link to="/historia#politicas" style={{ color: "var(--espresso)" }}>términos y condiciones</Link> y la política de privacidad <span className="req">*</span></span>
          </label>
          {errors.acceptTerms && <span className="small" style={{ color: "var(--error)" }} role="alert">{errors.acceptTerms}</span>}
          <label className="check" style={{ color: "var(--marron)" }}>
            <input type="checkbox" checked={form.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
            <span>Quiero recibir promociones de APU por correo (opcional)</span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting || !selected?.available} style={{ alignSelf: "flex-end", borderRadius: 0, letterSpacing: ".1em", fontSize: 14, fontWeight: 600, minHeight: 54, padding: "0 32px" }}>
            {submitting ? <Spinner /> : online ? "CONTINUAR AL PAGO" : "REALIZAR EL PEDIDO"}
          </button>
          <span className="row tiny muted" style={{ justifyContent: "flex-end", alignItems: "center", gap: 6 }}><IconLock size={14} /> Prototipo académico: el pago es simulado y no se realizan cargos.</span>
        </aside>
      </form>
    </div>
  );
}
