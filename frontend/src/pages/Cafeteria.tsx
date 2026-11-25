import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { artFor } from "../lib/art";
import { soles } from "../lib/format";
import type { Category, Product, Variant } from "../lib/types";
import { useCart } from "../context/CartContext";
import { ProductArt } from "../components/ProductArt";
import { Alert, PageLoader, Reveal, Spinner, useAsync } from "../components/ui";
import { IconCheck, IconPlus } from "../components/Icons";

interface StoreInfo {
  openNow: boolean;
  hours: { day: string; weekday: number; open: string; close: string }[];
}

function MenuRow({ product }: { product: Product }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.available)?.id ?? product.variants[0]?.id);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const variant = product.variants.find((v) => v.id === variantId) as Variant | undefined;
  const art = artFor(product.slug, product.category?.slug);

  const onAdd = async () => {
    if (!variant) return;
    setState("busy");
    setError(null);
    try {
      await add(variant.id, 1, { name: product.name, variant: variant.name, slug: product.slug });
      setState("done");
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar");
      setState("idle");
    }
  };

  return (
    <div className="row" style={{ gap: 18, alignItems: "center", padding: "14px 8px", borderBottom: "1px solid var(--borde-suave)", flexWrap: "nowrap" }}>
      <Link to={`/producto/${product.slug}`} style={{ width: 84, height: 84, flex: "none", borderRadius: 14, overflow: "hidden" }} aria-label={`Ver ${product.name}`}>
        <ProductArt kind={art.kind} bg={art.tint} steam={false} />
      </Link>
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 500 }}>{product.name}</h3>
        <p className="small muted" style={{ lineHeight: 1.45 }}>{product.shortDescription}</p>
        {product.variants.length > 1 && (
          <div className="row" style={{ gap: 6, marginTop: 4 }} role="radiogroup" aria-label={`Tamaño de ${product.name}`}>
            {product.variants.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={v.id === variantId} disabled={!v.available} onClick={() => setVariantId(v.id)}
                style={{ minHeight: 34, padding: "0 12px", borderRadius: 999, border: v.id === variantId ? "1.5px solid var(--espresso)" : "1px solid var(--borde)", background: v.id === variantId ? "var(--espresso)" : "#fff", color: v.id === variantId ? "#fff" : "var(--marron)", fontSize: 13, cursor: "pointer" }}>
                {v.name} · {soles(v.price)}
              </button>
            ))}
          </div>
        )}
        {error && <span className="small" style={{ color: "var(--error)" }}>{error}</span>}
      </div>
      <div className="stack" style={{ alignItems: "flex-end", gap: 6 }}>
        <span className="price" style={{ fontSize: 18, whiteSpace: "nowrap" }}>{soles(variant?.price)}</span>
        {variant && variant.stock != null && (
          <span className="tiny" style={{ color: variant.available ? "var(--naranja)" : "var(--muted)", fontWeight: 500 }}>{variant.availabilityLabel}</span>
        )}
      </div>
      <button type="button" className="icon-btn" onClick={onAdd} disabled={!variant?.available || state === "busy"} aria-label={`Agregar ${product.name}`}
        style={!variant?.available ? { background: "#C9B8A4", cursor: "not-allowed" } : state === "done" ? { background: "var(--ok)" } : undefined}>
        {state === "busy" ? <Spinner /> : state === "done" ? <IconCheck /> : <IconPlus />}
      </button>
    </div>
  );
}

export function Cafeteria() {
  const { cart } = useCart();
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const { data, loading, error } = useAsync(async () => {
    const [p, c, s] = await Promise.all([
      api<{ products: Product[] }>("/products?line=CAFETERIA&pageSize=100&sort=name"),
      api<{ categories: Category[] }>("/categories"),
      api<StoreInfo>("/store"),
    ]);
    return { products: p.products, categories: c.categories.filter((x) => x.line === "CAFETERIA"), store: s };
  }, []);

  const sections = useMemo(
    () => (data ? data.categories.map((c) => ({ ...c, items: data.products.filter((p) => p.category?.slug === c.slug) })).filter((s) => s.items.length) : []),
    [data],
  );
  const today = data?.store.hours.find((h) => h.weekday === new Date().getDay());
  const cafeteriaItems = (cart?.items ?? []).filter((i) => i.line === "CAFETERIA");
  const subtotal = cafeteriaItems.reduce((s, i) => s + i.lineTotal, 0);
  const ship = mode === "DELIVERY" ? 4 : 0;

  return (
    <>
      <section className="bg-dark">
        <div className="container row" style={{ padding: "48px 32px", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
          <div className="stack" style={{ flex: "1 1 480px", gap: 14 }}>
            {data && (
              <span className="row small" style={{ alignItems: "center", gap: 8, color: data.store.openNow ? "#D9F2DD" : "#F3B489" }}>
                <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ width: 10, height: 10, borderRadius: "50%", background: data.store.openNow ? "#5BC27A" : "#E08A4A", display: "block" }} />
                {data.store.openNow ? "Abierto ahora" : "Cerrado ahora"}{today ? ` · hoy de ${today.open} a ${today.close}` : ""}
              </span>
            )}
            <h1 className="h1" style={{ color: "#fff" }}>La carta de hoy</h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--arena)", maxWidth: 560 }}>Bebidas preparadas al momento y postres de producción diaria. Disponible solo en Jaén.</p>
          </div>
          <div className="stack" style={{ flex: "0 1 420px", gap: 12 }}>
            <div className="seg seg-dark" role="group" aria-label="Modalidad de entrega" style={{ display: "flex" }}>
              <button type="button" aria-pressed={mode === "PICKUP"} onClick={() => setMode("PICKUP")} style={{ flex: 1 }}>Recojo en tienda</button>
              <button type="button" aria-pressed={mode === "DELIVERY"} onClick={() => setMode("DELIVERY")} style={{ flex: 1 }}>Delivery en Jaén</button>
            </div>
            <motion.p key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 15, color: "var(--arena)", textAlign: "center" }}>
              {mode === "PICKUP" ? "Gratis · listo en 15 a 20 minutos en Pasaje Bracamoros 137." : "S/ 4.00 · 30 a 45 minutos · pedido mínimo S/ 15.00 · zona urbana de Jaén."}
            </motion.p>
          </div>
        </div>
      </section>

      {sections.length > 0 && (
        <nav aria-label="Categorías de la carta" style={{ borderBottom: "1px solid var(--borde-suave)", background: "#fff", position: "sticky", top: 76, zIndex: 10 }}>
          <div className="container row" style={{ padding: "12px 32px", gap: 10 }}>
            {sections.map((s) => (
              <a key={s.slug} href={`#${s.slug}`} className="btn btn-ghost btn-sm" style={{ minHeight: 40 }}>{s.name}</a>
            ))}
          </div>
        </nav>
      )}

      {loading ? <PageLoader label="Cargando la carta…" /> : error ? <div className="container section"><Alert>{error}</Alert></div> : (
        <div className="container" style={{ padding: "40px 32px 80px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
          <div className="stack" style={{ flex: "999 1 600px", minWidth: 0, gap: 48 }}>
            {sections.map((s) => (
              <Reveal key={s.slug}>
                <section id={s.slug} className="stack" style={{ gap: 6, scrollMarginTop: 150 }}>
                  <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottom: "2px solid var(--espresso)" }}>
                    <h2 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 700 }}>{s.name}</h2>
                    <span className="small muted">{s.description}</span>
                  </div>
                  {s.items.map((p) => <MenuRow key={p.slug} product={p} />)}
                </section>
              </Reveal>
            ))}
          </div>

          <aside aria-label="Tu pedido" className="panel-soft stack" style={{ flex: "1 1 320px", maxWidth: 380, minWidth: 0, gap: 14, position: "sticky", top: 150 }}>
            <h2 className="h3">Tu pedido</h2>
            {cafeteriaItems.length === 0 ? <p className="muted small">Agrega bebidas o postres con el botón +.</p> : cafeteriaItems.map((i) => (
              <div key={i.variantId} className="row" style={{ justifyContent: "space-between", gap: 10, fontSize: 15 }}>
                <span><strong>{i.quantity}×</strong> {i.productName} <span className="muted">{i.variantName}</span></span>
                <span className="price">{soles(i.lineTotal)}</span>
              </div>
            ))}
            <dl className="totals" style={{ borderTop: "1px dashed var(--caramelo)", paddingTop: 12 }}>
              <div><dt>Subtotal</dt><dd>{soles(subtotal)}</dd></div>
              <div className="muted"><dt>{mode === "PICKUP" ? "Recojo en tienda" : "Delivery en Jaén"}</dt><dd>{ship ? soles(ship) : "Gratis"}</dd></div>
              <div style={{ fontWeight: 600, fontSize: 18 }}><dt>Total estimado</dt><dd>{soles(subtotal + (cafeteriaItems.length ? ship : 0))}</dd></div>
            </dl>
            {mode === "DELIVERY" && subtotal > 0 && subtotal < 15 && <span className="small" style={{ color: "var(--naranja-osc)" }}>Agrega {soles(15 - subtotal)} más para delivery.</span>}
            <Link to="/carrito" className="btn btn-primary btn-block">Ir al carrito</Link>
            <p className="tiny muted" style={{ lineHeight: 1.45 }}>Las bebidas y postres no se envían fuera de Jaén para conservar su calidad.</p>
          </aside>
        </div>
      )}
    </>
  );
}
