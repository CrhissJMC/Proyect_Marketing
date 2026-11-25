import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError } from "../lib/api";
import type { ArtKind } from "../lib/art";
import { ProductArt } from "../components/ProductArt";
import { Alert, Reveal, Spinner } from "../components/ui";

const SERVICES: { title: string; desc: string; art: ArtKind; tint: string; type: string }[] = [
  { title: "Coffee break", desc: "Café preparado, postres y salados para reuniones, capacitaciones y eventos en Jaén.", art: "cup", tint: "#F3D9C6", type: "COFFEE_BREAK" },
  { title: "Café por volumen", desc: "APU Classic, Espresso y Gourmet para cafeterías, hoteles y restaurantes.", art: "bag", tint: "#F5EFE6", type: "CAFE_VOLUMEN" },
  { title: "Regalos corporativos", desc: "Kits con café APU y taza para clientes, colaboradores o fin de año.", art: "kit", tint: "#EADBC8", type: "REGALOS_CORPORATIVOS" },
  { title: "Abastecimiento de oficina", desc: "Entregas mensuales de café empacado con precio fijo.", art: "mug", tint: "#F6E7D8", type: "ABASTECIMIENTO_OFICINA" },
];

const STEPS = [
  { n: "01", t: "Envía tu solicitud", d: "Cuéntanos qué necesitas, cuántas personas y la fecha." },
  { n: "02", t: "Recibe la cotización", d: "En 48 horas, con precios por volumen y vigencia de 15 días." },
  { n: "03", t: "Confirma y paga", d: "Transferencia o tarjeta; emitimos factura electrónica." },
  { n: "04", t: "Entregamos", d: "En tu oficina o evento en Jaén, o envío nacional del café empacado." },
];

export function Business() {
  const [form, setForm] = useState({ companyName: "", ruc: "", contactName: "", email: "", phone: "", requestType: "COFFEE_BREAK", eventDate: "", deliveryAddress: "", notes: "" });
  const [items, setItems] = useState([{ description: "", quantity: 10 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setErrors({});
    try {
      const r = await api<{ quote: { code: string }; message: string }>("/corporate-quotes", {
        method: "POST",
        body: {
          ...form,
          phone: form.phone.replace(/\s/g, ""),
          eventDate: form.eventDate || undefined,
          deliveryAddress: form.deliveryAddress || undefined,
          notes: form.notes || undefined,
          items: items.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity) })),
        },
      });
      setResult({ ok: true, text: `Solicitud ${r.quote.code} recibida. ${r.message}` });
      setForm((f) => ({ ...f, notes: "" }));
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setResult({ ok: false, text: err instanceof ApiError && Object.keys(err.fieldErrors).length ? "Revisa los campos marcados." : err instanceof Error ? err.message : "Error" });
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`field${errors[k] ? " has-error" : ""}`}>{label}<input value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />{errors[k] && <span className="err">{errors[k]}</span>}</label>
  );

  return (
    <>
      <section className="bg-hueso">
        <div className="container row" style={{ padding: "64px 32px", gap: 40, alignItems: "center" }}>
          <div className="stack" style={{ flex: "1 1 520px", gap: 18 }}>
            <span className="eyebrow">APU para empresas e instituciones</span>
            <h1 className="display" style={{ fontSize: "clamp(40px, 5vw, 66px)" }}>Café de Jaén para tu equipo</h1>
            <p className="lead" style={{ maxWidth: 540 }}>Coffee breaks, café APU por volumen y regalos corporativos con factura electrónica. Cotización en 48 horas.</p>
            <div className="row" style={{ gap: 12 }}>
              <a href="#cotizar" className="btn btn-primary">Solicitar cotización</a>
              <a href="#servicios" className="btn btn-outline">Ver servicios</a>
            </div>
          </div>
          <motion.div style={{ flex: "1 1 380px", height: 380, borderRadius: 28, overflow: "hidden" }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
            <ProductArt kind="kit" bg="#EADBC8" />
          </motion.div>
        </div>
      </section>

      <section id="servicios" className="container stack" style={{ padding: "72px 32px", gap: 32 }}>
        <Reveal><h2 className="h2">¿Qué necesitas?</h2></Reveal>
        <div className="grid-fit" style={{ ["--min" as string]: "240px", gap: 18 }}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <button type="button" onClick={() => { set("requestType", s.type); document.getElementById("cotizar")?.scrollIntoView({ behavior: "smooth" }); }}
                className="card lift stack" style={{ padding: 24, gap: 12, textAlign: "left", cursor: "pointer", width: "100%", height: "100%", font: "inherit", color: "inherit" }}>
                <div style={{ height: 150, borderRadius: 14, overflow: "hidden" }}><ProductArt kind={s.art} bg={s.tint} steam={false} /></div>
                <h3 style={{ fontSize: 20, fontWeight: 600 }}>{s.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--marron)" }}>{s.desc}</p>
                <span className="small" style={{ color: "var(--naranja)", fontWeight: 500 }}>Cotizar →</span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-dark">
        <div className="container grid-fit" style={{ padding: "56px 32px", ["--min" as string]: "220px", gap: 28 }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1} className="stack" style={{ gap: 8 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 40, fontWeight: 800, color: "#D7A77A" }}>{s.n}</span>
              <strong style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{s.t}</strong>
              <span style={{ fontSize: 15, lineHeight: 1.55, color: "var(--arena)" }}>{s.d}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="cotizar" className="container-narrow split" style={{ padding: "72px 32px 88px", scrollMarginTop: 100 }}>
        <div className="stack" style={{ flex: "1 1 320px", gap: 14 }}>
          <h2 className="h2">Solicita tu cotización</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--marron)" }}>Te enviaremos la propuesta con precios por volumen, la vigencia de la cotización y las condiciones de entrega.</p>
          <ul className="stack" style={{ listStyle: "none", margin: "6px 0 0", padding: 0, gap: 10 }}>
            <li>✓ Factura electrónica con RUC</li>
            <li>✓ Respuesta en 48 horas</li>
            <li>✓ Entrega en Jaén o envío nacional del café empacado</li>
          </ul>
        </div>
        <form onSubmit={submit} className="main stack bg-soft" style={{ border: "1px solid var(--borde)", borderRadius: 22, padding: 28, gap: 16 }}>
          <div className="form-grid">
            {field("companyName", "Razón social *", { required: true })}
            {field("ruc", "RUC *", { required: true, inputMode: "numeric", placeholder: "11 dígitos" })}
            {field("contactName", "Persona de contacto *", { required: true })}
            {field("email", "Correo *", { required: true, type: "email" })}
            {field("phone", "Celular *", { required: true, type: "tel", placeholder: "9XX XXX XXX" })}
            <label className="field">Tipo de pedido *
              <select value={form.requestType} onChange={(e) => set("requestType", e.target.value)}>
                {SERVICES.map((s) => <option key={s.type} value={s.type}>{s.title}</option>)}
              </select>
            </label>
          </div>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
            <legend className="small" style={{ marginBottom: 8 }}>Detalle *</legend>
            <AnimatePresence initial={false}>
              {items.map((it, i) => (
                <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 44px", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <input aria-label={`Descripción del ítem ${i + 1}`} required value={it.description} placeholder="Ej.: coffee break para 40 personas" onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                    style={{ height: 46, border: "1px solid #9A8A7E", borderRadius: 10, padding: "0 14px", font: "400 15px var(--sans)" }} />
                  <input aria-label={`Cantidad del ítem ${i + 1}`} type="number" min={1} max={10000} required value={it.quantity} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))}
                    style={{ height: 46, border: "1px solid #9A8A7E", borderRadius: 10, padding: "0 14px", font: "400 15px var(--sans)" }} />
                  <button type="button" aria-label={`Quitar ítem ${i + 1}`} disabled={items.length === 1} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                    style={{ width: 44, height: 44, border: 0, background: "none", color: "var(--muted)", fontSize: 22, cursor: "pointer" }}>×</button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button type="button" onClick={() => setItems((xs) => [...xs, { description: "", quantity: 10 }])} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", borderStyle: "dashed" }} disabled={items.length >= 30}>+ Agregar ítem</button>
          </fieldset>
          <div className="form-grid">
            {field("eventDate", "Fecha del evento", { type: "date" })}
            {field("deliveryAddress", "Lugar de entrega", { placeholder: "Dirección en Jaén" })}
            <label className="field full">Comentarios<textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} /></label>
          </div>
          {result && <Alert kind={result.ok ? "ok" : "error"}>{result.text}</Alert>}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="small muted" style={{ maxWidth: 420 }}>Usaremos estos datos solo para responder tu solicitud (Ley N.° 29733).</span>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Enviar solicitud"}</button>
          </div>
        </form>
      </section>
    </>
  );
}
