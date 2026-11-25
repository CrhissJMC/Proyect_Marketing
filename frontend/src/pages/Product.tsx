import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { artFor } from "../lib/art";
import { date, soles } from "../lib/format";
import type { Product } from "../lib/types";
import { useCart } from "../context/CartContext";
import { ProductArt } from "../components/ProductArt";
import { Alert, PageLoader, ProductCard, Reveal, Spinner, Stars, useAsync } from "../components/ui";
import { IconCheck, IconReturn, IconStore, IconTruck } from "../components/Icons";

interface Review { id: string; authorName: string; rating: number; comment: string | null; createdAt: string }

const SPEC_LABELS: Record<string, string> = {
  variedades: "Variedades",
  origen: "Origen",
  altitud: "Altitud",
  notas: "Notas",
  puntajeEnTaza: "Puntaje en taza",
  certificaciones: "Certificaciones",
  productor: "Productor",
};

export function ProductPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { data, loading, error } = useAsync(
    () => Promise.all([
      api<{ product: Product; related: Product[] }>(`/products/${slug}`),
      api<{ reviews: Review[] }>(`/products/${slug}/reviews?pageSize=10`),
    ]).then(([p, r]) => ({ ...p, reviews: r.reviews })),
    [slug],
  );
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setVariantId(data.product.variants.find((v) => v.available)?.id ?? data.product.variants[0]?.id ?? null);
    setQty(1);
    setState("idle");
  }, [data]);

  if (loading) return <PageLoader />;
  if (error || !data) return <div className="container section"><Alert>{error ?? "Producto no encontrado"}</Alert><Link to="/tienda" className="btn btn-outline" style={{ marginTop: 16 }}>Volver a la tienda</Link></div>;

  const { product, related, reviews } = data;
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const art = artFor(product.slug, product.category?.slug);
  const maxQty = Math.min(20, variant?.stock ?? 20);
  const specs = Object.entries(product.attributes ?? {}).filter(([k]) => SPEC_LABELS[k]);
  const rating = product.rating;

  const addToCart = async (goToCheckout = false) => {
    if (!variant) return;
    setState("busy");
    setAddError(null);
    try {
      await add(variant.id, qty, { name: product.name, variant: variant.name, slug: product.slug });
      if (goToCheckout) navigate("/carrito");
      else {
        setState("done");
        setTimeout(() => setState("idle"), 2000);
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "No se pudo agregar");
      setState("idle");
    }
  };

  return (
    <>
      <div className="container" style={{ paddingTop: 28 }}>
        <nav aria-label="Ruta" className="small muted">
          <Link to="/" style={{ color: "var(--muted)" }}>Inicio</Link> / <Link to={product.line === "CAFETERIA" ? "/cafeteria" : "/tienda"} style={{ color: "var(--muted)" }}>{product.line === "CAFETERIA" ? "Cafetería" : "Tienda"}</Link>
          {product.category && <> / <Link to={`/tienda?category=${product.category.slug}&line=${product.line}`} style={{ color: "var(--muted)" }}>{product.category.name}</Link></>}
          {" / "}<span aria-current="page" style={{ color: "var(--espresso)" }}>{product.name}</span>
        </nav>
      </div>

      <section className="container" style={{ padding: "28px 32px 64px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "flex-start" }}>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} style={{ flex: "1 1 480px", minWidth: 0, height: 540, borderRadius: 28, overflow: "hidden", position: "relative" }}>
          <ProductArt kind={art.kind} bg={art.tint} label={art.label} labelBg={art.labelBg} title={product.name} />
          <span className={`chip ${product.line === "EMPACADO" ? "chip-dark" : "chip-white"}`} style={{ position: "absolute", top: 20, left: 20 }}>
            {product.line === "EMPACADO" ? "Envío a todo el Perú" : "Solo en Jaén · recojo o delivery"}
          </span>
        </motion.div>

        <div className="stack" style={{ flex: "1 1 420px", minWidth: 0, gap: 20 }}>
          {product.tags.length > 0 && (
            <div className="row" style={{ gap: 8 }}>
              {product.tags.filter((t) => !["cafe", "empacado"].includes(t)).slice(0, 4).map((t) => <span key={t} className="chip" style={{ textTransform: "capitalize" }}>{t}</span>)}
            </div>
          )}
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="h1">{product.name}</h1>
            <div className="row small" style={{ alignItems: "center", gap: 10, color: "var(--marron)" }}>
              {rating?.average ? <><Stars value={rating.average} /> <a href="#resenas" style={{ color: "var(--marron)" }}>{rating.average} · {rating.count} {rating.count === 1 ? "reseña verificada" : "reseñas verificadas"}</a></> : <span className="muted">Aún sin reseñas</span>}
            </div>
          </div>
          <p className="lead" style={{ fontSize: 17 }}>{product.description}</p>
          <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
            <AnimatePresence mode="wait">
              <motion.span key={variant?.id} className="price" style={{ fontSize: 34 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{soles(variant?.price)}</motion.span>
            </AnimatePresence>
            <span className="small muted">{variant?.name} · IGV incluido</span>
          </div>

          {product.variants.length > 1 && (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{product.line === "EMPACADO" ? "¿Grano entero o molido?" : "Elige el tamaño"}</legend>
              <div className="row" style={{ gap: 10 }} role="radiogroup">
                {product.variants.map((v) => (
                  <button key={v.id} type="button" role="radio" aria-checked={v.id === variant?.id} disabled={!v.available} onClick={() => { setVariantId(v.id); setQty(1); }}
                    className="option" style={{ minWidth: 150 }}>
                    <span className="t">{v.name}</span>
                    <span className="d">{v.available ? v.availabilityLabel : "Agotado"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {variant && !variant.available && <Alert kind="warn">Esta presentación está agotada por hoy.</Alert>}
          {addError && <Alert>{addError}</Alert>}

          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <div className="qty" aria-label="Cantidad">
              <button type="button" aria-label="Quitar uno" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>−</button>
              <span aria-live="polite">{qty}</span>
              <button type="button" aria-label="Agregar uno" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}>+</button>
            </div>
            <button type="button" className="btn btn-primary" style={{ flex: "1 1 220px", minHeight: 54, background: state === "done" ? "var(--ok)" : undefined }} disabled={!variant?.available || state === "busy"} onClick={() => addToCart()}>
              {state === "busy" ? <Spinner /> : state === "done" ? <><IconCheck /> Agregado al carrito</> : `Agregar al carrito · ${soles((variant?.price ?? 0) * qty)}`}
            </button>
          </div>
          <button type="button" className="btn btn-outline" disabled={!variant?.available || state === "busy"} onClick={() => addToCart(true)}>Comprar ahora</button>

          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: "18px 0 0", borderTop: "1px solid var(--borde-suave)", gap: 12, fontSize: 15, color: "var(--marron)" }}>
            {product.line === "EMPACADO" ? (
              <>
                <li className="row" style={{ gap: 12, flexWrap: "nowrap" }}><IconTruck /><span><strong style={{ color: "var(--espresso)" }}>Envío nacional S/ 12.00</strong> · gratis desde S/ 100 · de 2 a 5 días hábiles</span></li>
                <li className="row" style={{ gap: 12, flexWrap: "nowrap" }}><IconStore /><span><strong style={{ color: "var(--espresso)" }}>Recojo gratis</strong> en Pasaje Bracamoros 137, Jaén</span></li>
                <li className="row" style={{ gap: 12, flexWrap: "nowrap" }}><IconReturn /><span><strong style={{ color: "var(--espresso)" }}>Devolución en 7 días</strong> si el empaque está cerrado</span></li>
              </>
            ) : (
              <>
                <li className="row" style={{ gap: 12, flexWrap: "nowrap" }}><IconStore /><span><strong style={{ color: "var(--espresso)" }}>Recojo gratis</strong> · listo en 15 a 20 min</span></li>
                <li className="row" style={{ gap: 12, flexWrap: "nowrap" }}><IconTruck /><span><strong style={{ color: "var(--espresso)" }}>Delivery en Jaén S/ 4.00</strong> · 30 a 45 min</span></li>
                <li className="row" style={{ gap: 12, flexWrap: "nowrap" }}><IconReturn /><span>¿Llegó en mal estado? Repórtalo dentro de 2 horas y lo reponemos</span></li>
              </>
            )}
          </ul>
        </div>
      </section>

      {specs.length > 0 && (
        <section className="bg-hueso">
          <div className="container row" style={{ padding: "64px 32px", gap: 48 }}>
            <Reveal className="stack" style={{ flex: "1 1 460px", gap: 16 }}>
              <h2 className="h2" style={{ fontSize: 34 }}>Del grano a tu taza</h2>
              <p className="lead" style={{ fontSize: 17, lineHeight: 1.7 }}>Nace en fincas de Jaén y San Ignacio. Las familias de la Cooperativa CENFROCAFE seleccionan la cereza madura, la lavan y la fermentan lentamente antes de secarla bajo sombra.</p>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>Recomendado para</h3>
              <div className="row" style={{ gap: 8 }}>
                {["Cafetera de filtro", "Prensa francesa", "Pasado en tela", "Moka italiana"].map((m) => <span key={m} className="chip chip-white">{m}</span>)}
              </div>
            </Reveal>
            <Reveal y={40} style={{ flex: "1 1 420px", background: "#fff", border: "2px solid var(--espresso)", borderRadius: 4, padding: "24px 26px" }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 800, paddingBottom: 10, borderBottom: "8px solid var(--espresso)" }}>Ficha técnica</h2>
              <dl style={{ margin: 0 }}>
                {specs.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #D8C6B0", fontSize: 15 }}>
                    <dt style={{ fontWeight: 600 }}>{SPEC_LABELS[k]}</dt>
                    <dd style={{ margin: 0, textAlign: "right", color: "var(--marron)" }}>{Array.isArray(v) ? v.join(", ") : v}</dd>
                  </div>
                ))}
              </dl>
              <p className="tiny muted" style={{ marginTop: 10 }}>Fuente: catálogo de la Cooperativa CENFROCAFE.</p>
            </Reveal>
          </div>
        </section>
      )}

      <section id="resenas" className="container" style={{ padding: "64px 32px", display: "flex", flexWrap: "wrap", gap: 48 }}>
        <div className="stack" style={{ flex: "1 1 280px", gap: 12 }}>
          <h2 className="h2" style={{ fontSize: 34 }}>Reseñas</h2>
          {rating?.average ? <><span style={{ fontSize: 56, fontWeight: 600, lineHeight: 1 }}>{rating.average}</span><Stars value={rating.average} size={20} /></> : null}
          <span className="muted">Solo pueden opinar quienes recibieron su pedido.</span>
        </div>
        <div className="stack" style={{ flex: "999 1 520px" }}>
          {reviews.length === 0 ? <p className="muted">Este producto aún no tiene reseñas. ¡Sé el primero en opinar después de tu compra!</p> : reviews.map((r) => (
            <article key={r.id} className="stack" style={{ padding: "22px 0", borderBottom: "1px solid var(--borde-suave)", gap: 8 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{r.authorName} <span className="small muted" style={{ fontWeight: 400 }}>· Compra verificada · {date(r.createdAt)}</span></span>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p style={{ lineHeight: 1.6, color: "var(--marron)" }}>{r.comment}</p>}
            </article>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="container stack" style={{ padding: "0 32px 80px", gap: 24 }}>
          <h2 className="h2" style={{ fontSize: 30 }}>También te puede gustar</h2>
          <div className="grid-auto">{related.map((p) => <ProductCard key={p.slug} product={p} compact />)}</div>
        </section>
      )}
    </>
  );
}
