import { useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { IconCart, IconClose, IconMenu, IconSearch, IconUser, Logo } from "./Icons";

const LINKS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/tienda", label: "Tienda" },
  { to: "/cafeteria", label: "Cafetería" },
  { to: "/empresas", label: "Empresas" },
  { to: "/historia", label: "Historia" },
  { to: "/historia#contacto", label: "Contáctanos" },
];

export function Header() {
  const { count } = useCart();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearching(false);
    navigate(`/tienda?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <div className="announce">
        <div className="container">
          <span>Envío nacional gratis desde S/ 100</span>
          <span aria-hidden>·</span>
          <span>Delivery en Jaén en 30 a 45 min</span>
          <span aria-hidden>·</span>
          <span>2x1 en capuchinos de 3 a 7 p. m. con PAUSAAPU</span>
        </div>
      </div>
      <header className="site-header">
        <div className="container bar">
          <Link to="/" className="brand" aria-label="Cafetería APU, inicio" onClick={() => setOpen(false)}>
            <Logo />
            <span>
              <span className="name">APU</span>
              <span className="sub">CAFETERÍA · JAÉN</span>
            </span>
          </Link>
          <nav aria-label="Principal" className={`main-nav${open ? " open" : ""}`}>
            {LINKS.map((l) => (
              <NavLink key={l.label} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive && !l.to.includes("#") ? "active" : "")}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button type="button" className="hbtn" aria-label="Buscar" aria-expanded={searching} onClick={() => setSearching((s) => !s)}>
              <IconSearch />
            </button>
            <Link to={user ? (user.role === "CUSTOMER" ? "/mi-cuenta" : "/admin") : "/acceso"} className="hbtn" aria-label={user ? "Mi cuenta" : "Ingresar"}>
              <IconUser />
            </Link>
            <Link to="/carrito" className="hbtn" aria-label={`Carrito, ${count} productos`}>
              <IconCart />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span key={count} className="cart-count"
                    initial={{ scale: 0.4 }} animate={{ scale: [1.35, 1] }} transition={{ duration: 0.35 }}>
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            <button type="button" className="hbtn menu-toggle" aria-label="Menú" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {searching && (
            <motion.div className="search-bar" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
              <form className="container" onSubmit={submit} role="search">
                <label htmlFor="q" className="sr-only">Buscar productos</label>
                <input id="q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca capuchino, APU Classic, postres…" />
                <button type="submit" className="btn btn-primary btn-sm">Buscar</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
