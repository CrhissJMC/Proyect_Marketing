import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { date, soles } from "../lib/format";
import type { OrderStatus, User } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { Alert, PageLoader, Spinner, StatusBadge, errorMessage, useAsync } from "../components/ui";

interface OrderRow { code: string; status: OrderStatus; total: number; itemCount: number; preview: string[]; createdAt: string }

export function Account() {
  const { user, loading, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const { data: orders, loading: loadingOrders } = useAsync(
    () => (user ? api<{ orders: OrderRow[] }>("/me/orders?pageSize=20").then((r) => r.orders) : Promise.resolve([])),
    [user?.id],
  );
  const [profile, setProfile] = useState<{ fullName: string; phone: string; docNumber: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deletePwd, setDeletePwd] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/acceso?next=/mi-cuenta" replace />;
  const p = profile ?? { fullName: user.fullName, phone: user.phone ?? "", docNumber: user.docNumber ?? "" };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const toggleConsent = () => run("consent", async () => {
    const r = await api<{ user: User }>("/me/consents", { method: "PATCH", body: { marketingConsent: !user.marketingConsent } });
    setUser(r.user);
    setMsg({ ok: true, text: r.user.marketingConsent ? "Autorizaste recibir promociones." : "Ya no te enviaremos promociones." });
  });

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    void run("profile", async () => {
      const body: Record<string, string> = { fullName: p.fullName };
      if (p.phone) body.phone = p.phone.replace(/\s/g, "");
      if (p.docNumber) Object.assign(body, { docType: "DNI", docNumber: p.docNumber });
      const r = await api<{ user: User }>("/me", { method: "PATCH", body });
      setUser(r.user);
      setProfile(null);
      setMsg({ ok: true, text: "Datos actualizados." });
    });
  };

  const exportData = () => run("export", async () => {
    const data = await api<unknown>("/me/data-export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mis-datos-apu.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ ok: true, text: "Descargamos tus datos en un archivo JSON." });
  });

  const deleteAccount = (e: FormEvent) => {
    e.preventDefault();
    void run("delete", async () => {
      await api("/me", { method: "DELETE", body: { password: deletePwd } });
      logout();
      navigate("/", { replace: true });
    });
  };

  return (
    <div className="bg-soft">
      <div className="container split" style={{ padding: "40px 32px 80px" }}>
        <nav aria-label="Mi cuenta" className="panel stack" style={{ flex: "1 1 240px", maxWidth: 280, padding: 20, gap: 4 }}>
          <div className="row" style={{ gap: 12, alignItems: "center", padding: "6px 8px 16px", borderBottom: "1px solid var(--borde-suave)", marginBottom: 8, flexWrap: "nowrap" }}>
            <span style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--espresso)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--serif)", fontWeight: 700, fontSize: 20, flex: "none" }}>{user.fullName[0]}</span>
            <span className="stack" style={{ minWidth: 0 }}><strong style={{ fontWeight: 600 }}>{user.fullName}</strong><span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span></span>
          </div>
          {[["#pedidos", "Mis pedidos"], ["#datos", "Mis datos"], ["#privacidad", "Privacidad y datos"]].map(([h, l]) => (
            <a key={h} href={h} style={{ padding: "12px 14px", borderRadius: 12, color: "var(--espresso)", textDecoration: "none" }}>{l}</a>
          ))}
          <button type="button" onClick={() => { logout(); navigate("/"); }} style={{ padding: "12px 14px", borderRadius: 12, color: "var(--muted)", background: "none", border: 0, textAlign: "left", cursor: "pointer", fontSize: 16, marginTop: 8 }}>Cerrar sesión</button>
        </nav>

        <div className="main stack" style={{ gap: 28 }}>
          {msg && <Alert kind={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}

          <section id="pedidos" className="panel stack" style={{ gap: 18 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h1 className="h2" style={{ fontSize: 34 }}>Mis pedidos</h1>
              <Link to="/tienda" style={{ fontWeight: 500, textDecoration: "none" }}>Hacer un pedido →</Link>
            </div>
            {loadingOrders ? <div className="skeleton" style={{ height: 160 }} /> : !orders?.length ? <p className="muted">Aún no tienes pedidos.</p> : (
              <div className="table-wrap">
                <table className="table" style={{ minWidth: 640 }}>
                  <thead><tr><th>Pedido</th><th>Fecha</th><th>Productos</th><th>Estado</th><th style={{ textAlign: "right" }}>Total</th><th><span className="sr-only">Acción</span></th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.code}>
                        <td style={{ fontWeight: 600 }}>{o.code}</td>
                        <td className="muted">{date(o.createdAt)}</td>
                        <td style={{ color: "var(--marron)" }}>{o.preview.join(", ")}{o.itemCount > o.preview.length ? "…" : ""}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td className="price" style={{ textAlign: "right" }}>{soles(o.total)}</td>
                        <td style={{ textAlign: "right" }}><Link to={o.status === "PENDING_PAYMENT" ? `/pago/${o.code}` : `/pedido/${o.code}`}>{o.status === "PENDING_PAYMENT" ? "Pagar" : "Ver"}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <form id="datos" onSubmit={saveProfile} className="panel stack" style={{ gap: 16 }}>
            <h2 className="h3" style={{ fontSize: 26 }}>Mis datos</h2>
            <div className="form-grid">
              <label className="field">Nombre completo<input value={p.fullName} onChange={(e) => setProfile({ ...p, fullName: e.target.value })} /></label>
              <label className="field">Celular<input value={p.phone} onChange={(e) => setProfile({ ...p, phone: e.target.value })} placeholder="9XX XXX XXX" /></label>
              <label className="field">DNI<input value={p.docNumber} onChange={(e) => setProfile({ ...p, docNumber: e.target.value })} inputMode="numeric" /></label>
              <label className="field">Correo<input value={user.email} disabled /></label>
            </div>
            <button type="submit" className="btn btn-dark" style={{ alignSelf: "flex-start" }} disabled={!profile || busy === "profile"}>{busy === "profile" ? <Spinner /> : "Guardar cambios"}</button>
          </form>

          <section id="privacidad" className="panel stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 6 }}>
              <h2 className="h3" style={{ fontSize: 26 }}>Privacidad y datos</h2>
              <p className="small" style={{ color: "var(--marron)" }}>Tus derechos según la Ley N.° 29733 y su Reglamento (D.S. N.° 016-2024-JUS).</p>
            </div>
            <div className="row panel-soft" style={{ justifyContent: "space-between", alignItems: "center", gap: 16, padding: 18 }}>
              <div className="stack" style={{ flex: "1 1 320px", gap: 4 }}>
                <strong>Promociones por correo</strong>
                <span className="small" style={{ color: "var(--marron)" }}>{user.marketingConsent ? "Autorizado. Puedes retirarlo cuando quieras." : "No autorizado. Solo te escribiremos sobre tus pedidos."}</span>
              </div>
              <button type="button" role="switch" aria-checked={user.marketingConsent} aria-label="Promociones por correo" onClick={toggleConsent} disabled={busy === "consent"}
                style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "none", minHeight: 44, cursor: "pointer", fontSize: 14 }}>
                {user.marketingConsent ? "Activado" : "Desactivado"}
                <span style={{ width: 52, height: 30, borderRadius: 999, background: user.marketingConsent ? "var(--naranja)" : "#C9B8A4", position: "relative", transition: "background .2s" }}>
                  <span style={{ position: "absolute", top: 3, left: user.marketingConsent ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </span>
              </button>
            </div>
            <div className="grid-fit" style={{ ["--min" as string]: "240px", gap: 14 }}>
              <div className="stack" style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 18, gap: 8 }}>
                <strong>Acceso</strong>
                <span className="small" style={{ color: "var(--marron)", flex: 1 }}>Descarga todos tus datos personales en un archivo.</span>
                <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={exportData} disabled={busy === "export"}>{busy === "export" ? <Spinner /> : "Descargar mis datos"}</button>
              </div>
              <div className="stack" style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 18, gap: 8 }}>
                <strong>Rectificación</strong>
                <span className="small" style={{ color: "var(--marron)", flex: 1 }}>Corrige tu nombre, celular o documento.</span>
                <a href="#datos" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Editar mis datos</a>
              </div>
              <div className="stack" style={{ border: "1px solid #E6A49A", borderRadius: 14, padding: 18, gap: 8, background: "#FFF8F6" }}>
                <strong style={{ color: "#7A1E12" }}>Cancelación</strong>
                <span className="small" style={{ color: "var(--marron)", flex: 1 }}>Elimina tu cuenta. Conservamos solo los comprobantes exigidos por ley, sin tus datos de contacto.</span>
                {!showDelete ? (
                  <button type="button" className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowDelete(true)}>Eliminar mi cuenta</button>
                ) : (
                  <form onSubmit={deleteAccount} className="stack" style={{ gap: 8 }}>
                    <label className="field">Confirma con tu contraseña<input type="password" required value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} autoComplete="current-password" /></label>
                    <div className="row" style={{ gap: 8 }}>
                      <button type="submit" className="btn btn-danger btn-sm" disabled={busy === "delete"}>{busy === "delete" ? <Spinner /> : "Eliminar definitivamente"}</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDelete(false)}>Cancelar</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
