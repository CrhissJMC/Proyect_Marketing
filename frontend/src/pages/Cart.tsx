import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { artFor } from "../lib/art";
import { soles } from "../lib/format";
import type { ShippingMethod } from "../lib/types";
import { useCart } from "../context/CartContext";
import { ProductArt } from "../components/ProductArt";
import { Alert, PageLoader, Spinner, Steps } from "../components/ui";
import { IconCheck, IconInfo, IconLock, IconTrash } from "../components/Icons";

export const SHIP_KEY = "apu.shipping";

export function Cart() {
  const { cart, loading, setQuantity, remove, applyCoupon, removeCoupon, coupon, refresh } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [ship, setShip] = useState<ShippingMethod>(() => (sessionStorage.getItem(SHIP_KEY) as ShippingMethod) || "PICKUP");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const options = cart?.shippingOptions ?? [];
  const selected = options.find((o) => o.method === ship);
  // Si la entrega elegida ya no aplica (por ejemplo, nacional con postres), se pasa a recojo.
  useEffect(() => {
    if (selected && !selected.available) {
      const first = options.find((o) => o.available);
      if (first) setShip(first.method);
    }
  }, [selected, options]);
  useEffect(() => sessionStorage.setItem(SHIP_KEY, ship), [ship]);

  if (loading && !cart) return <PageLoader />;
  const items = cart?.items ?? [];
  const hasPerishable = items.some((i) => i.perishable);
  const shipCost = selected?.available ? selected.cost : 0;
  const total = (cart?.summary.subtotal ?? 0) - (cart?.summary.discount ?? 0) + shipCost;
  const national = options.find((o) => o.method === "NATIONAL");
  const merch = (cart?.summary.subtotal ?? 0) - (cart?.summary.discount ?? 0);

  const change = async (variantId: string, quantity: number) => {
    setBusy(variantId);
    setError(null);
    try {
      if (quantity <= 0) await remove(variantId);
      else await setQuantity(variantId, quantity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  };

  const submitCoupon = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy("coupon");
    setCouponMsg(null);
    try {
      const err = await applyCoupon(code);
      setCouponMsg(err);
      if (!err) setCode("");
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container section stack" style={{ alignItems: "center", textAlign: "center", gap: 18 }}>
        <div style={{ width: 200, height: 200 }}><ProductArt kind="cup" /></div>
        <h1 className="h1">Tu carrito está vacío</h1>
        <p className="lead">Elige tu bebida favorita o lleva café APU a casa.</p>
        <div className="row" style={{ gap: 12, justifyContent: "center" }}>
          <Link to="/cafeteria" className="btn btn-primary">Ver la carta</Link>
          <Link to="/tienda" className="btn btn-outline">Café empacado</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container stack" style={{ paddingTop: 36, gap: 22 }}>
        <Steps current={0} />
        <h1 className="h1">Tu carrito <span style={{ fontFamily: "var(--sans)", fontWeight: 400, fontSize: 20, color: "var(--muted)" }}>· {cart?.summary.itemCount} productos</span></h1>
      </div>

      <div className="container split" style={{ padding: "24px 32px 80px" }}>
        <div className="main stack" style={{ gap: 18 }}>
          {hasPerishable && (
            <Alert kind="warn">Tu carrito tiene bebidas o postres: puedes elegir <strong>recojo en tienda</strong> o <strong>delivery en Jaén</strong>. El envío nacional solo está disponible para café empacado.</Alert>
          )}
          {cart?.warnings.map((w) => <Alert key={w} kind="error">{w}</Alert>)}
          {error && <Alert>{error}</Alert>}

          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <AnimatePresence initial={false}>
              {items.map((i) => {
                const art = artFor(i.productSlug);
                return (
                  <motion.li key={i.variantId} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, x: -40 }} transition={{ duration: 0.3 }}
                    style={{ borderBottom: "1px solid var(--borde-suave)", overflow: "hidden" }}>
                    <div className="row" style={{ gap: 16, alignItems: "center", padding: "18px 0" }}>
                      <Link to={`/producto/${i.productSlug}`} style={{ width: 92, height: 92, flex: "none", borderRadius: 16, overflow: "hidden" }} aria-label={`Ver ${i.productName}`}>
                        <ProductArt kind={art.kind} bg={art.tint} label={art.label} labelBg={art.labelBg} steam={false} />
                      </Link>
                      <div className="stack" style={{ flex: "1 1 200px", gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 17, fontWeight: 500 }}>{i.productName}</span>
                        <span className="small muted">{i.variantName} · {soles(i.unitPrice)} c/u</span>
                        <span className="tiny" style={{ color: i.available ? "var(--cobre)" : "var(--error)" }}>{i.perishable ? "Preparado en Jaén" : "Envío a todo el Perú"}{!i.available ? ` · ${i.availabilityLabel}` : ""}</span>
                      </div>
                      <div className="qty" aria-label={`Cantidad de ${i.productName}`}>
                        <button type="button" aria-label="Quitar uno" disabled={busy === i.variantId} onClick={() => change(i.variantId, i.quantity - 1)}>−</button>
                        <span>{busy === i.variantId ? <Spinner /> : i.quantity}</span>
                        <button type="button" aria-label="Agregar uno" disabled={busy === i.variantId || i.quantity >= 20} onClick={() => change(i.variantId, i.quantity + 1)}>+</button>
                      </div>
                      <span className="price" style={{ width: 100, textAlign: "right", fontSize: 17 }}>{soles(i.lineTotal)}</span>
                      <button type="button" aria-label={`Eliminar ${i.productName}`} onClick={() => change(i.variantId, 0)} disabled={busy === i.variantId}
                        style={{ width: 44, height: 44, border: 0, background: "none", color: "var(--muted)", cursor: "pointer", borderRadius: "50%" }}>
                        <IconTrash />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          <Link to="/tienda" style={{ fontWeight: 500, textDecoration: "none" }}>← Seguir comprando</Link>
        </div>

        <aside aria-label="Resumen del pedido" className="side panel-soft stack" style={{ gap: 18, position: "sticky", top: 96 }}>
          <h2 className="h3" style={{ fontSize: 26 }}>Resumen</h2>

          {cart?.coupon ? (
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#fff" }}>
              <span className="row small" style={{ alignItems: "center", gap: 8, color: "var(--ok)" }}><IconCheck size={16} /><span><strong>{cart.coupon.code}</strong> · {cart.coupon.description}</span></span>
              <button type="button" className="link-btn small" onClick={() => removeCoupon()}>Quitar</button>
            </div>
          ) : (
            <form onSubmit={submitCoupon} className="stack" style={{ gap: 8 }}>
              <label htmlFor="cupon" className="small" style={{ fontWeight: 600 }}>¿Tienes un cupón?</label>
              <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input id="cupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PAUSAAPU"
                  style={{ flex: 1, minWidth: 0, height: 46, border: "1px solid #D8C6B0", borderRadius: 10, padding: "0 14px", font: "400 15px var(--sans)", letterSpacing: ".08em" }} />
                <button type="submit" className="btn btn-dark btn-sm" style={{ minHeight: 46, borderRadius: 10 }} disabled={busy === "coupon"}>{busy === "coupon" ? <Spinner /> : "Aplicar"}</button>
              </div>
              {couponMsg && <span className="small" style={{ color: "var(--error)" }}>{couponMsg}</span>}
              {coupon && !cart?.coupon && <span className="small muted">El cupón {coupon} ya no aplica a este carrito.</span>}
            </form>
          )}

          <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
            <legend className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Entrega</legend>
            <div className="stack" style={{ gap: 8 }} role="radiogroup">
              {options.map((o) => (
                <button key={o.method} type="button" role="radio" aria-checked={o.method === ship} disabled={!o.available} onClick={() => setShip(o.method)} className="option" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: 1 }} className="stack">
                    <span className="t">{o.label}</span>
                    <span className="d">{o.available ? o.estimatedTime : o.problems[0]}</span>
                  </span>
                  <span className="price">{o.cost === 0 ? "Gratis" : soles(o.cost)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {ship === "NATIONAL" && national?.available && !national.freeShippingApplied && merch < 100 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="small">Te faltan <strong>{soles(100 - merch)}</strong> para el envío gratis</span>
              <div style={{ height: 8, borderRadius: 4, background: "#fff", overflow: "hidden" }}>
                <motion.div style={{ height: "100%", background: "var(--naranja)" }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, merch)}%` }} />
              </div>
            </div>
          )}

          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{soles(cart?.summary.subtotal)}</dd></div>
            {!!cart?.summary.discount && <div className="discount"><dt>Descuento {cart.coupon?.code}</dt><dd>− {soles(cart.summary.discount)}</dd></div>}
            <div><dt>Entrega</dt><dd>{shipCost === 0 ? "Gratis" : soles(shipCost)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{soles(total)}</dd></div>
            <span className="tiny muted" style={{ textAlign: "right" }}>Precios con IGV incluido</span>
          </dl>
          {selected && !selected.available && <span className="small row" style={{ gap: 6, color: "var(--error)" }}><IconInfo size={16} />{selected.problems.join(". ")}</span>}
          <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 54 }} disabled={!selected?.available || items.some((i) => !i.available)} onClick={() => navigate("/checkout")}>
            Continuar con mis datos
          </button>
          <span className="row small" style={{ justifyContent: "center", alignItems: "center", gap: 8, color: "var(--marron)" }}><IconLock size={16} /> Compra protegida · sin cobros ocultos</span>
        </aside>
      </div>
    </>
  );
}
