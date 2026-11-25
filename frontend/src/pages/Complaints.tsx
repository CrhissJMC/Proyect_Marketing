import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError } from "../lib/api";
import { date, soles } from "../lib/format";
import { Alert, Spinner } from "../components/ui";
import { IconBook } from "../components/Icons";

interface Complaint {
  code: string;
  type: "RECLAMO" | "QUEJA";
  status: "RECEIVED" | "IN_PROGRESS" | "ANSWERED";
  goodDescription: string;
  amount: number | null;
  response: string | null;
  respondedAt: string | null;
  dueAt: string;
  createdAt: string;
}

const STATUS: Record<Complaint["status"], string> = { RECEIVED: "Recibido", IN_PROGRESS: "En atención", ANSWERED: "Respondido" };

export function Complaints() {
  const [form, setForm] = useState({
    type: "RECLAMO" as "RECLAMO" | "QUEJA",
    consumerName: "", docType: "DNI", docNumber: "", email: "", phone: "", address: "",
    isMinor: false, guardianName: "", goodType: "PRODUCTO", goodDescription: "", amount: "", orderCode: "",
    detail: "", consumerRequest: "", acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ complaint: Complaint; sheet: { note: string; emailSimulated: string } } | null>(null);
  const [lookup, setLookup] = useState({ code: "", email: "" });
  const [found, setFound] = useState<Complaint | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);
    if (!form.acceptTerms) return setErrors({ acceptTerms: "Debes declarar que la información es verdadera" });
    setBusy(true);
    try {
      const r = await api<{ complaint: Complaint; sheet: { note: string; emailSimulated: string } }>("/complaints", {
        method: "POST",
        body: {
          ...form,
          phone: form.phone.replace(/\s/g, ""),
          guardianName: form.isMinor ? form.guardianName : undefined,
          amount: form.amount ? Number(form.amount) : undefined,
          orderCode: form.orderCode || undefined,
          acceptTerms: true,
        },
      });
      setDone(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setError(err instanceof ApiError && Object.keys(err.fieldErrors).length ? "Revisa los campos marcados." : err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setFound(null);
    try {
      const r = await api<{ complaint: Complaint }>(`/complaints/${encodeURIComponent(lookup.code.trim())}?email=${encodeURIComponent(lookup.email.trim())}`);
      setFound(r.complaint);
    } catch {
      setLookupError("No encontramos una hoja con ese número y correo.");
    }
  };

  const f = (k: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => (
    <label className={`field${errors[k] ? " has-error" : ""}${full ? " full" : ""}`}>{label}
      <input value={form[k] as string} onChange={(e) => set(k, e.target.value)} {...props} />
      {errors[k] && <span className="err">{errors[k]}</span>}
    </label>
  );

  return (
    <div className="bg-soft">
      <div className="container stack" style={{ maxWidth: 980, padding: "44px 32px 80px", gap: 24 }}>
        <div className="row" style={{ gap: 20, alignItems: "center" }}>
          <span style={{ color: "var(--espresso)" }}><IconBook size={72} /></span>
          <div className="stack" style={{ flex: "1 1 400px", gap: 6 }}>
            <h1 className="h1">Libro de Reclamaciones</h1>
            <p className="small" style={{ color: "var(--marron)" }}>Conforme al Código de Protección y Defensa del Consumidor (Ley N.° 29571).</p>
          </div>
        </div>
        <div className="grid-fit panel small" style={{ ["--min" as string]: "200px", gap: 12, padding: "18px 20px" }}>
          <span><strong className="tiny muted" style={{ display: "block", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500 }}>Proveedor</strong>Cafetería APU · CENFROCAFE</span>
          <span><strong className="tiny muted" style={{ display: "block", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500 }}>RUC</strong>[referencial]</span>
          <span><strong className="tiny muted" style={{ display: "block", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 500 }}>Dirección</strong>Pasaje Bracamoros N.° 137, Jaén</span>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" className="panel stack" style={{ gap: 14, borderTop: "3px solid var(--ok)" }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <h2 className="h3">Hoja N.° {done.complaint.code} registrada</h2>
              <p style={{ lineHeight: 1.6 }}>{done.sheet.note}</p>
              <p className="small muted">{done.sheet.emailSimulated}. Plazo de respuesta: {date(done.complaint.dueAt)}.</p>
              <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} onClick={() => window.print()}>Imprimir hoja</button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} noValidate className="stack" style={{ background: "#fff", border: "1px solid var(--borde)", borderTop: "3px solid var(--naranja)", borderRadius: 4, padding: 28, gap: 28 }}>
              {error && <Alert>{error}</Alert>}
              <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
                <legend style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>1. Identificación del consumidor</legend>
                <div className="form-grid">
                  {f("consumerName", "Nombres y apellidos *", { required: true })}
                  <label className={`field${errors.docNumber ? " has-error" : ""}`}>Tipo y n.° de documento *
                    <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <select aria-label="Tipo de documento" value={form.docType} onChange={(e) => set("docType", e.target.value)} style={{ width: 110 }}><option value="DNI">DNI</option><option value="CE">CE</option><option value="PASAPORTE">Pasaporte</option><option value="RUC">RUC</option></select>
                      <input aria-label="Número de documento" value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} />
                    </span>
                    {errors.docNumber && <span className="err">{errors.docNumber}</span>}
                  </label>
                  {f("email", "Correo electrónico *", { type: "email", required: true })}
                  {f("phone", "Celular *", { type: "tel", required: true })}
                  {f("address", "Domicilio *", { required: true }, true)}
                </div>
                <label className="check" style={{ marginTop: 14, alignItems: "center" }}><input type="checkbox" checked={form.isMinor} onChange={(e) => set("isMinor", e.target.checked)} />Soy menor de edad</label>
                <AnimatePresence>{form.isMinor && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ maxWidth: 460, marginTop: 12 }}>{f("guardianName", "Nombre del padre, madre o apoderado *")}</motion.div>}</AnimatePresence>
              </fieldset>

              <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
                <legend style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>2. Identificación del bien contratado</legend>
                <div className="form-grid">
                  <label className="field">Tipo *<select value={form.goodType} onChange={(e) => set("goodType", e.target.value)}><option value="PRODUCTO">Producto</option><option value="SERVICIO">Servicio</option></select></label>
                  {f("amount", "Monto reclamado (S/)", { inputMode: "decimal" })}
                  {f("orderCode", "Código de pedido (si tienes)", { placeholder: "APU-2026-…" })}
                  {f("goodDescription", "Descripción del producto o servicio *", { required: true }, true)}
                </div>
              </fieldset>

              <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack" >
                <legend style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>3. Detalle de la reclamación</legend>
                <div className="options" role="radiogroup" aria-label="Tipo">
                  {([["RECLAMO", "Reclamo", "Disconformidad relacionada con el producto o servicio."], ["QUEJA", "Queja", "Malestar respecto a la atención, sin relación directa con el producto."]] as const).map(([v, t, d]) => (
                    <button key={v} type="button" role="radio" aria-checked={form.type === v} onClick={() => set("type", v)} className="option"><span className="t">{t}</span><span className="d">{d}</span></button>
                  ))}
                </div>
                <label className={`field${errors.detail ? " has-error" : ""}`} style={{ marginTop: 14 }}>Detalle *<textarea value={form.detail} onChange={(e) => set("detail", e.target.value)} placeholder="Describe lo ocurrido (mínimo 20 caracteres)" />{errors.detail && <span className="err">{errors.detail}</span>}</label>
                <label className={`field${errors.consumerRequest ? " has-error" : ""}`} style={{ marginTop: 14 }}>Pedido del consumidor *<textarea value={form.consumerRequest} onChange={(e) => set("consumerRequest", e.target.value)} placeholder="¿Qué solución esperas?" />{errors.consumerRequest && <span className="err">{errors.consumerRequest}</span>}</label>
              </fieldset>

              <label className="check"><input type="checkbox" checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} /><span>Declaro que la información es verdadera y acepto que se use solo para atender esta reclamación. <span className="req">*</span></span></label>
              {errors.acceptTerms && <span className="small" style={{ color: "var(--error)" }}>{errors.acceptTerms}</span>}
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span className="small" style={{ color: "var(--marron)" }}>Recibirás una copia de esta hoja en tu correo.</span>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : `Enviar ${form.type === "RECLAMO" ? "reclamo" : "queja"}`}</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="panel-soft stack small" style={{ gap: 8, lineHeight: 1.55, color: "var(--marron)" }}>
          <span>• Responderemos en un plazo máximo de <strong>15 días hábiles</strong>.</span>
          <span>• La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.</span>
        </div>

        <form onSubmit={search} className="panel stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Consulta el estado de tu hoja</h2>
          <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 200px" }}>N.° de hoja<input required value={lookup.code} onChange={(e) => setLookup((l) => ({ ...l, code: e.target.value.toUpperCase() }))} placeholder="LR-2026-000001" /></label>
            <label className="field" style={{ flex: "1 1 220px" }}>Correo<input required type="email" value={lookup.email} onChange={(e) => setLookup((l) => ({ ...l, email: e.target.value }))} /></label>
            <button type="submit" className="btn btn-dark">Consultar</button>
          </div>
          {lookupError && <Alert>{lookupError}</Alert>}
          {found && (
            <div className="stack panel-soft" style={{ gap: 6 }}>
              <strong>{found.code} · {found.type === "RECLAMO" ? "Reclamo" : "Queja"} · {STATUS[found.status]}</strong>
              <span className="small">{found.goodDescription}{found.amount != null ? ` · ${soles(found.amount)}` : ""} · registrado el {date(found.createdAt)}</span>
              {found.response ? <span><strong>Respuesta ({date(found.respondedAt)}):</strong> {found.response}</span> : <span className="small muted">Fecha límite de respuesta: {date(found.dueAt)}</span>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
