import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconBook, IconFacebook, IconInstagram, IconTiktok, IconWhatsapp, Logo } from "./Icons";

export function Footer() {
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState(false);

  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    // Simulado: el prototipo no envía correos.
    setSent(true);
  };

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="stack" style={{ flex: "1 1 320px", gap: 12, fontSize: 15, lineHeight: 1.5 }}>
          <Link to="/" aria-label="Cafetería APU, inicio" className="stack" style={{ gap: 6, marginBottom: 8 }}>
            <Logo size={56} />
            <span style={{ fontFamily: "var(--serif)", fontWeight: 800, fontSize: 22, letterSpacing: ".18em" }}>CAFETERÍA APU</span>
          </Link>
          <span style={{ textTransform: "uppercase" }}>Marca de la Cooperativa Agraria Cafetalera CENFROCAFE</span>
          <span>RUC: [referencial]</span>
          <span>Pasaje Bracamoros N.° 137, Jaén, Cajamarca</span>
          <span className="row" style={{ alignItems: "center", gap: 10 }}>
            <IconWhatsapp /> +51 900 000 000 <span className="tiny" style={{ color: "#B8A796" }}>(demo)</span>
          </span>
          <a href="mailto:atencion@apu-demo.test" style={{ color: "#D7A77A" }}>atencion@apu-demo.test</a>
          <span>Lunes a domingo · 7:00 a. m. – 9:00 p. m.</span>
          <div className="row" style={{ gap: 6 }}>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram @cafeteria_apu" className="hbtn" style={{ color: "#D7A77A", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconInstagram /></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" style={{ color: "#D7A77A", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconFacebook /></a>
            <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok" style={{ color: "#D7A77A", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconTiktok /></a>
          </div>
        </div>

        <nav aria-label="Enlaces" className="stack" style={{ flex: "0 1 260px", gap: 10, fontSize: 16 }}>
          <h2 style={{ fontWeight: 400, fontSize: 22, marginBottom: 6 }}>Enlaces</h2>
          <Link to="/mi-cuenta">Mi cuenta</Link>
          <Link to="/tienda">Tienda</Link>
          <Link to="/cafeteria">Cafetería</Link>
          <Link to="/empresas">Empresas</Link>
          <Link to="/seguimiento">Seguir mi pedido</Link>
          <Link to="/historia#contacto">Contáctanos</Link>
          <Link to="/historia#politicas">Términos y condiciones</Link>
          <Link to="/historia#politicas">Política de envío y devoluciones</Link>
          <Link to="/historia#politicas">Política de privacidad</Link>
          <Link to="/reclamaciones" className="row" style={{ alignItems: "center", gap: 12, marginTop: 6, padding: "10px 14px", border: "1px solid var(--marron)", borderRadius: 10, width: "fit-content" }}>
            <span style={{ color: "#D7A77A" }}><IconBook /></span>
            <span style={{ fontWeight: 600, lineHeight: 1.2 }}>Libro de<br />Reclamaciones</span>
          </Link>
        </nav>

        <div className="stack" style={{ flex: "1 1 340px", gap: 28 }}>
          <form className="stack" style={{ gap: 12 }} onSubmit={subscribe}>
            <h2 style={{ fontWeight: 600, fontSize: 20 }}>Suscríbete al boletín #MiMomentoAPU</h2>
            {sent ? (
              <p style={{ color: "#D9F2DD" }}>¡Gracias! Te escribiremos solo con novedades de APU. (Simulado)</p>
            ) : (
              <>
                <label htmlFor="nl-email" className="small" style={{ color: "var(--arena)" }}>Promociones y novedades, sin spam.</label>
                <input id="nl-email" type="email" required placeholder="Tu correo electrónico"
                  style={{ height: 48, padding: "0 16px", borderRadius: 8, border: "1px solid var(--marron)", font: "400 15px var(--sans)" }} />
                <label className="check" style={{ color: "var(--arena)", fontSize: 13 }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                  Acepto recibir comunicaciones comerciales de Cafetería APU. Puedo darme de baja cuando quiera.
                </label>
                <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start", border: "2px solid #fff", letterSpacing: ".06em" }}>ENVIAR</button>
              </>
            )}
          </form>
          <div className="stack" style={{ gap: 12 }}>
            <h2 style={{ fontWeight: 600, fontSize: 20 }}>Paga con</h2>
            <div className="row" style={{ gap: 8 }}>
              <span className="pay-pill" style={{ background: "#fff", color: "#1A1F71", fontStyle: "italic", fontWeight: 700 }}>VISA</span>
              <span className="pay-pill" style={{ background: "#fff", color: "var(--espresso)" }}>Mastercard</span>
              <span className="pay-pill" style={{ background: "#fff", color: "#1F5DA8" }}>Amex</span>
              <span className="pay-pill" style={{ background: "#742284", color: "#fff" }}>Yape</span>
              <span className="pay-pill" style={{ background: "#0A7F8C", color: "#fff" }}>Plin</span>
              <span className="pay-pill" style={{ border: "1px solid var(--marron)", fontWeight: 400 }}>Contra entrega</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <h2 style={{ fontWeight: 600, fontSize: 20 }}>Certificaciones</h2>
            <div className="row" style={{ gap: 16 }}>
              <span className="cert">Café<br />orgánico</span>
              <span className="cert">Comercio<br />Justo</span>
              <span className="cert">Taza<br />84–85</span>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>© 2026 Cafetería APU · Precios en soles con IGV incluido</span>
          <span>Prototipo académico · No se procesan pedidos ni pagos reales</span>
        </div>
      </div>
    </footer>
  );
}
