import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { animate, motion, useInView } from "framer-motion";
import { Alert, Reveal } from "../components/ui";

function CountUp({ to, prefix = "" }: { to: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{prefix}{v.toLocaleString("es-PE")}</span>;
}

const STATS = [
  { n: 2800, prefix: "+", l: "familias productoras" },
  { n: 124, l: "asociaciones de base" },
  { n: 11, l: "redes cafetaleras" },
  { n: 3, l: "provincias: Jaén, San Ignacio y Bagua" },
];

const JOURNEY = [
  { n: "01", t: "Productor", d: "Familias de Jaén y San Ignacio cultivan Caturra, Bourbon y Typica en altura." },
  { n: "02", t: "Cosecha y beneficio", d: "Cereza seleccionada, lavada y fermentada lentamente; secado bajo sombra." },
  { n: "03", t: "Tostado", d: "La cooperativa tuesta y empaca con su marca APU." },
  { n: "04", t: "Preparación", d: "Baristas, hijos de productores, preparan cada taza en Jaén." },
  { n: "05", t: "Tu pausa", d: "En la cafetería, en tu casa o en tu oficina." },
];

const TIMELINE = [
  { y: "1999", d: "Nace CENFROCAFE, cooperativa que agrupa a familias cafetaleras del norte del Perú." },
  { y: "[Año]", d: "La cooperativa registra marcas propias, entre ellas APU, como parte de su industrialización." },
  { y: "[Año]", d: "Abre la Cafetería APU en Pasaje Bracamoros 137, en el centro de Jaén." },
  { y: "2026", d: "APU abre su tienda virtual: pedidos en línea en Jaén y café empacado a todo el Perú." },
];

const POLICIES = [
  { title: "Términos y condiciones", body: "Precios en soles con IGV incluido. Los pedidos con pago en línea se reservan 15 minutos; si no se paga, el pedido se cancela y el stock se libera. Sin suscripciones automáticas ni opciones preseleccionadas (D. Leg. N.° 1729). Este sitio es un prototipo académico: no se procesan pedidos ni pagos reales." },
  { title: "Envíos y entregas", body: "Recojo gratis en Pasaje Bracamoros 137 (15 a 20 min). Delivery en la zona urbana de Jaén S/ 4.00, pedido mínimo S/ 15.00 (30 a 45 min). Envío nacional solo de café empacado y artículos: S/ 12.00, gratis desde S/ 100 (2 a 5 días hábiles). Las bebidas y postres no se envían fuera de Jaén para conservar su calidad e inocuidad." },
  { title: "Cambios y devoluciones", body: "Bebidas y postres: repórtalo dentro de las 2 horas posteriores a la entrega si llegó en mal estado o no corresponde al pedido; lo reponemos o devolvemos el importe. Café empacado y artículos: 7 días desde la entrega con el empaque cerrado; si llegó dañado, lo cambiamos. Los reembolsos se realizan por el mismo medio de pago." },
  { title: "Política de privacidad", body: "Tratamos tus datos conforme a la Ley N.° 29733 y su Reglamento (D.S. N.° 016-2024-JUS), solo para gestionar tu pedido, el comprobante y la posventa. Solo enviamos promociones si lo autorizas; la casilla nunca viene marcada. No almacenamos el número completo de tu tarjeta ni el código de seguridad. Desde Mi cuenta puedes descargar tus datos, rectificarlos, retirar tu consentimiento o eliminar tu cuenta." },
];

export function About() {
  const [sent, setSent] = useState(false);
  const send = (e: FormEvent) => {
    e.preventDefault();
    setSent(true); // Simulado: el prototipo no envía mensajes.
  };

  return (
    <>
      <section className="row">
        <div className="stack" style={{ flex: "1 1 520px", padding: "80px 32px 80px max(32px, calc((100% - 1280px) / 2 + 32px))", justifyContent: "center", gap: 18 }}>
          <span className="eyebrow">Comercio Justo y cultura cafetalera</span>
          <motion.h1 className="display" style={{ fontSize: "clamp(42px, 5vw, 68px)", textTransform: "uppercase" }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Del grano<br />a la taza</motion.h1>
          <p className="lead" style={{ fontSize: 19, maxWidth: 500 }}>APU es la marca de las familias productoras de la Cooperativa CENFROCAFE. En nuestra cafetería de Jaén servimos el café que ellas cultivan.</p>
          <div className="row" style={{ gap: 12 }}>
            <Link to="/tienda" className="btn btn-primary" style={{ borderRadius: 0, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 14 }}>Prueba nuestro café</Link>
            <a href="#contacto" className="btn btn-outline" style={{ borderRadius: 0, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 14 }}>Visítanos</a>
          </div>
        </div>
        <div className="bg-dark" style={{ flex: "1 1 520px", minHeight: 520, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <svg viewBox="0 0 400 300" role="img" aria-label="Ilustración: montañas de Jaén con plantas de café" style={{ width: "90%", maxWidth: 560 }}>
            <motion.path d="M0 260 L90 130 L150 200 L230 90 L310 190 L360 150 L400 200 L400 300 L0 300 Z" fill="#3B2418" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1 }} />
            <motion.path d="M0 280 L120 190 L200 250 L290 170 L400 260 L400 300 L0 300 Z" fill="#5C3A24" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, delay: 0.2 }} />
            <motion.circle cx="320" cy="70" r="26" fill="#D7A77A" initial={{ cy: 140, opacity: 0 }} animate={{ cy: 70, opacity: 1 }} transition={{ duration: 1.4, delay: 0.4 }} />
            <g fill="#7A4E30"><ellipse cx="90" cy="250" rx="30" ry="14" /><ellipse cx="190" cy="268" rx="36" ry="14" /><ellipse cx="300" cy="256" rx="30" ry="12" /></g>
            <g fill="#B84E17"><circle cx="80" cy="244" r="4" /><circle cx="96" cy="248" r="4" /><circle cx="186" cy="262" r="4" /><circle cx="200" cy="266" r="4" /><circle cx="296" cy="252" r="4" /></g>
          </svg>
        </div>
      </section>

      <section style={{ background: "#E8E1D6" }}>
        <div className="container-narrow grid-fit" style={{ padding: "72px 32px", ["--min" as string]: "200px", gap: 28, textAlign: "center" }}>
          {STATS.map((s) => (
            <div key={s.l} className="stack" style={{ gap: 6 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 54, fontWeight: 800 }}><CountUp to={s.n} prefix={s.prefix} /></span>
              <span style={{ color: "var(--marron)" }}>{s.l}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container-narrow stack" style={{ padding: "80px 32px", gap: 36 }}>
        <Reveal className="stack" style={{ textAlign: "center", alignItems: "center", gap: 8 }}>
          <span className="eyebrow">El recorrido</span>
          <h2 className="h2">Del productor a tu pausa</h2>
        </Reveal>
        <ol className="grid-fit" style={{ listStyle: "none", margin: 0, padding: 0, ["--min" as string]: "190px", gap: 0 }}>
          {JOURNEY.map((j, i) => (
            <Reveal key={j.n} delay={i * 0.12}>
              <li className="stack" style={{ gap: 10, padding: "0 16px", borderLeft: "2px solid #D8C6B0" }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 34, fontWeight: 800, color: "var(--naranja)" }}>{j.n}</span>
                <strong style={{ fontSize: 18, fontWeight: 600 }}>{j.t}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.55, color: "var(--marron)" }}>{j.d}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="bg-hueso">
        <div className="container-narrow stack" style={{ padding: "72px 32px", gap: 28 }}>
          <h2 className="h2">Nuestra historia</h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {TIMELINE.map((t, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <li style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 24, padding: "20px 0", borderBottom: "1px solid #D8C6B0" }}>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 700, color: "var(--cobre)" }}>{t.y}</span>
                  <span style={{ fontSize: 17, lineHeight: 1.6 }}>{t.d}</span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="contacto" className="container row" style={{ padding: "80px 32px", gap: 40, scrollMarginTop: 100 }}>
        <div className="stack" style={{ flex: "1 1 380px", gap: 18 }}>
          <h2 className="h2">Contáctanos</h2>
          <dl className="stack" style={{ margin: 0, gap: 16 }}>
            {[
              ["Dirección", "Pasaje Bracamoros N.° 137, Jaén, Cajamarca"],
              ["Horario (referencial)", "Lunes a viernes 7:00 a. m. – 9:00 p. m. · Sábado y domingo 8:00 a. m. – 9:00 p. m."],
              ["WhatsApp", "+51 900 000 000 (número de demostración)"],
              ["Correo", "atencion@apu-demo.test"],
            ].map(([k, v]) => (
              <div key={k}><dt className="tiny muted" style={{ letterSpacing: ".12em", textTransform: "uppercase" }}>{k}</dt><dd style={{ margin: "4px 0 0" }}>{v}</dd></div>
            ))}
          </dl>
          <iframe title="Mapa de ubicación de Cafetería APU" src="https://www.openstreetmap.org/export/embed.html?bbox=-78.815%2C-5.715%2C-78.795%2C-5.700&layer=mapnik" style={{ width: "100%", height: 240, border: "1px solid var(--borde)", borderRadius: 18 }} loading="lazy" />
        </div>
        <form onSubmit={send} className="bg-soft stack" style={{ flex: "1 1 460px", border: "1px solid var(--borde)", borderRadius: 22, padding: 28, gap: 14 }}>
          <h3 style={{ fontSize: 22, fontWeight: 600 }}>Escríbenos</h3>
          {sent ? <Alert kind="ok">¡Gracias! Te responderemos pronto. (Mensaje simulado en el prototipo.)</Alert> : (
            <>
              <label className="field">Nombre<input required /></label>
              <label className="field">Correo<input type="email" required /></label>
              <label className="field">Asunto<select><option>Consulta sobre un pedido</option><option>Productos y precios</option><option>Empresas y eventos</option><option>Otro</option></select></label>
              <label className="field">Mensaje<textarea required /></label>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Enviar mensaje</button>
            </>
          )}
        </form>
      </section>

      <section id="politicas" className="container-narrow stack" style={{ padding: "0 32px 80px", gap: 10, scrollMarginTop: 100 }}>
        <h2 className="h2" style={{ fontSize: 30, marginBottom: 8 }}>Políticas</h2>
        {POLICIES.map((p) => (
          <details key={p.title} style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: "16px 20px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 17, minHeight: 28 }}>{p.title}</summary>
            <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: "var(--marron)" }}>{p.body}</p>
          </details>
        ))}
      </section>
    </>
  );
}
