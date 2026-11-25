import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { ProductArt } from "../components/ProductArt";
import { Alert, Spinner, errorMessage, fieldErrors } from "../components/ui";

export function Access() {
  const { user, login, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next");
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", acceptPrivacy: false, marketingConsent: false });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  if (user) return <Navigate to={next ?? (user.role === "CUSTOMER" ? "/mi-cuenta" : "/admin")} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (tab === "register" && !form.acceptPrivacy) {
      setErrors({ acceptPrivacy: "Debes aceptar la política de privacidad" });
      return;
    }
    setBusy(true);
    try {
      const u = tab === "login" ? await login(form.email, form.password) : await register(form);
      navigate(next ?? (u.role === "CUSTOMER" ? "/mi-cuenta" : "/admin"), { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const input = (name: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, hint?: string) => (
    <label className={`field${errors[name] ? " has-error" : ""}`}>
      {label}
      <input value={form[name] as string} onChange={(e) => set(name, e.target.value)} {...props} />
      {errors[name] ? <span className="err">{errors[name]}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );

  return (
    <div className="row" style={{ minHeight: 720 }}>
      <section className="bg-dark stack" style={{ flex: "1 1 480px", padding: "64px 56px", justifyContent: "space-between", gap: 32, position: "relative", overflow: "hidden" }}>
        <span aria-hidden style={{ position: "absolute", right: -40, bottom: -60, fontFamily: "var(--serif)", fontSize: 320, fontWeight: 800, color: "var(--espresso-2)", lineHeight: 1 }}>APU</span>
        <div className="stack" style={{ position: "relative", gap: 16, maxWidth: 460 }}>
          <span className="eyebrow" style={{ color: "var(--caramelo)" }}>Tu cuenta APU</span>
          <h1 className="h1" style={{ color: "#fff" }}>Tu pausa, más rápida cada vez</h1>
          <ul className="stack" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, gap: 12, color: "var(--arena)", fontSize: 16 }}>
            <li>✓ Guarda tus datos y repite pedidos</li>
            <li>✓ Sigue todos tus pedidos en un solo lugar</li>
            <li>✓ Usa promociones como #MiMomentoAPU</li>
          </ul>
        </div>
        <motion.div style={{ position: "relative", width: 240, height: 260 }} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
          <ProductArt kind="cup" />
        </motion.div>
      </section>

      <section className="bg-soft" style={{ flex: "1 1 480px", padding: "56px 32px", display: "flex", justifyContent: "center" }}>
        <div className="stack" style={{ width: "100%", maxWidth: 440, gap: 22 }}>
          <div role="tablist" aria-label="Acceso" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--borde)", position: "relative" }}>
            {(["login", "register"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(null); setErrors({}); }}
                style={{ minHeight: 52, border: 0, background: "none", fontSize: 17, fontWeight: tab === t ? 600 : 400, color: "var(--espresso)", cursor: "pointer", position: "relative" }}>
                {t === "login" ? "Ingresar" : "Crear cuenta"}
                {tab === t && <motion.span layoutId="tabline" style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 3, background: "var(--naranja)" }} />}
              </button>
            ))}
          </div>

          {error && <Alert>{error}</Alert>}
          <AnimatePresence mode="wait">
            <motion.form key={tab} onSubmit={submit} className="stack" style={{ gap: 14 }} initial={{ opacity: 0, x: tab === "login" ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: tab === "login" ? 30 : -30 }} transition={{ duration: 0.25 }}>
              {tab === "register" && input("fullName", "Nombre completo", { autoComplete: "name", required: true })}
              {input("email", "Correo electrónico", { type: "email", autoComplete: "email", required: true })}
              {tab === "register" && input("phone", "Celular (opcional)", { type: "tel", autoComplete: "tel", placeholder: "9XX XXX XXX" })}
              {input("password", "Contraseña", { type: "password", autoComplete: tab === "login" ? "current-password" : "new-password", required: true }, tab === "register" ? "Mínimo 8 caracteres, con letras y números." : undefined)}
              {tab === "register" && (
                <>
                  <label className="check"><input type="checkbox" checked={form.acceptPrivacy} onChange={(e) => set("acceptPrivacy", e.target.checked)} /><span>Acepto la <Link to="/historia#politicas">política de privacidad</Link> <span className="req">*</span></span></label>
                  {errors.acceptPrivacy && <span className="small" style={{ color: "var(--error)" }}>{errors.acceptPrivacy}</span>}
                  <label className="check" style={{ color: "var(--marron)" }}><input type="checkbox" checked={form.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} /><span>Quiero recibir promociones de APU (opcional)</span></label>
                </>
              )}
              <button type="submit" className="btn btn-primary btn-block" style={{ minHeight: 54 }} disabled={busy}>{busy ? <Spinner /> : tab === "login" ? "Ingresar" : "Crear cuenta"}</button>
            </motion.form>
          </AnimatePresence>

          <div className="row small muted" style={{ alignItems: "center", gap: 12, flexWrap: "nowrap" }}><span style={{ flex: 1, height: 1, background: "var(--borde)" }} />o<span style={{ flex: 1, height: 1, background: "var(--borde)" }} /></div>
          <Link to="/checkout" className="btn btn-outline">Continuar como invitado</Link>
          <p className="tiny muted" style={{ textAlign: "center", lineHeight: 1.5 }}>Tus datos se protegen según la Ley N.° 29733. Puedes descargarlos o eliminar tu cuenta cuando quieras.</p>
        </div>
      </section>
    </div>
  );
}
