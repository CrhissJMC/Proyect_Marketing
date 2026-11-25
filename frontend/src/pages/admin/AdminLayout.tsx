import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../../components/Icons";

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="admin">
      <nav aria-label="Administración" className="admin-nav">
        <div className="row" style={{ alignItems: "center", gap: 10, padding: "4px 10px 24px" }}>
          <Logo size={34} />
          <span className="stack" style={{ lineHeight: 1.1 }}>
            <strong style={{ fontFamily: "var(--serif)", fontSize: 20, color: "#fff", letterSpacing: ".12em" }}>APU</strong>
            <span className="tiny" style={{ letterSpacing: ".2em", color: "var(--caramelo)" }}>PANEL</span>
          </span>
        </div>
        <NavLink to="/admin" end>Métricas</NavLink>
        <NavLink to="/admin/pedidos">Pedidos</NavLink>
        <NavLink to="/admin/inventario">Inventario</NavLink>
        <NavLink to="/admin/atencion">Atención y B2B</NavLink>
        <div style={{ marginTop: "auto", paddingTop: 24 }} className="stack">
          <span className="tiny" style={{ padding: "0 14px", color: "#B8A796" }}>{user?.fullName} · {user?.role === "ADMIN" ? "Administrador" : "Personal"}</span>
          <NavLink to="/" style={{ color: "#B8A796" }}>← Ver tienda</NavLink>
          <button type="button" onClick={() => { logout(); navigate("/"); }} style={{ padding: "12px 14px", background: "none", border: 0, color: "#B8A796", textAlign: "left", cursor: "pointer", fontSize: 16 }}>Cerrar sesión</button>
        </div>
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
