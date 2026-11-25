import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { api } from "../lib/api";
import { soles } from "../lib/format";
import type { Product, Promotion } from "../lib/types";
import type { ArtKind } from "../lib/art";
import { ProductArt } from "../components/ProductArt";
import { ProductCard, Reveal, SkeletonGrid, useAsync } from "../components/ui";
import { IconArrow, IconBean, IconHands, IconLeaf, IconMountain } from "../components/Icons";

const DRINKS: { slug: string; name: string; art: ArtKind; tint: string; desc: string; ingredients: string[] }[] = [
  { slug: "capuchino", name: "capuchino", art: "cup", tint: "#F3D9C6", desc: "El protagonista de cada pausa: espresso de café de Jaén, leche vaporizada y una espuma sedosa con arte latte.", ingredients: ["Espresso APU", "Leche vaporizada", "Espuma de leche", "Arte latte"] },
  { slug: "latte", name: "latte", art: "mug", tint: "#EADBC8", desc: "Más leche, más suave. Un espresso APU con abundante leche vaporizada para una pausa larga.", ingredients: ["Espresso APU", "Leche vaporizada", "Capa fina de espuma"] },
  { slug: "frappe-cafe", name: "frappé", art: "frappe", tint: "#F1DCC9", desc: "Helado y cremoso, con café de verdad. Café APU batido con hielo y leche, coronado con crema.", ingredients: ["Café APU", "Hielo", "Leche", "Crema batida"] },
  { slug: "mocaccino", name: "mocaccino", art: "mug", tint: "#E6D3C0", desc: "Café y chocolate en equilibrio: espresso, chocolate y leche vaporizada, terminado con cacao.", ingredients: ["Espresso APU", "Chocolate", "Leche vaporizada", "Cacao"] },
  { slug: "cold-brew", name: "cold brew", art: "frappe", tint: "#EFE1D2", desc: "Café APU macerado en frío durante 16 horas: suave, naturalmente dulce y con poca acidez.", ingredients: ["Café APU", "Agua fría", "Hielo"] },
];

const FAVORITES = ["capuchino", "frappe-cafe", "latte", "mocaccino", "torta-de-chocolate", "desayuno-apu"];

const STEPS = [
  { n: "01", t: "Elige", d: "Bebidas y postres de la cafetería, o café APU empacado para llevar a casa." },
  { n: "02", t: "Paga seguro", d: "Tarjeta, Yape, Plin, efectivo contra entrega o pago al recoger." },
  { n: "03", t: "Lo preparamos", d: "Te avisamos en cada estado: confirmado, en preparación y en camino." },
  { n: "04", t: "Recíbelo", d: "Recojo en tienda, delivery en Jaén o envío nacional por agencia." },
];

const PROMO_CHANNEL: Record<string, string> = {
  PAUSAAPU: "Tu pausa tiene sabor a APU",
  APUINFLUYE: "Creadores de contenido",
  MIRACHA300: "#MiMomentoAPU",
};

export function Home() {
  const [drinkIdx, setDrinkIdx] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const { data: products, loading } = useAsync(() => api<{ products: Product[] }>("/products?pageSize=100").then((r) => r.products), []);
  const { data: promos } = useAsync(() => api<{ promotions: Promotion[] }>("/store/promotions").then((r) => r.promotions), []);
  const { scrollY } = useScroll();
  const beansY = useTransform(scrollY, [0, 600], [0, -90]);

  const bySlug = useMemo(() => new Map((products ?? []).map((p) => [p.slug, p])), [products]);
  const drink = DRINKS[drinkIdx];
  const drinkProduct = bySlug.get(drink.slug);
  const favorites = FAVORITES.map((s) => bySlug.get(s)).filter((p): p is Product => !!p);
  const bags = (products ?? []).filter((p) => p.category?.slug === "cafe-empacado");
  const classic = bySlug.get("cafe-apu-classic");
  const specs = classic?.attributes
    ? Object.entries({
        Variedades: classic.attributes.variedades,
        Origen: classic.attributes.origen,
        Altitud: classic.attributes.altitud,
        Notas: classic.attributes.notas,
        "Puntaje en taza": classic.attributes.puntajeEnTaza,
        Certificaciones: classic.attributes.certificaciones,
      }).filter(([, v]) => v)
    : [];

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* el portapapeles puede no estar disponible */
    }
    setCopied(code);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <>
      {/* HERO */}
      <section className="bg-hueso" style={{ position: "relative", overflow: "hidden" }}>
        <div className="container" style={{ padding: "56px 32px 72px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
          <div className="stack" style={{ flex: "1 1 460px", minWidth: 0, gap: 22 }}>
            <span className="eyebrow">Café de altura · Jaén, Cajamarca</span>
            <AnimatePresence mode="wait">
              <motion.h1 key={drink.name} className="display" style={{ fontSize: "clamp(60px, 9vw, 128px)" }}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
                {drink.name}
                <sup style={{ fontSize: ".26em", color: "var(--naranja)", letterSpacing: ".05em", marginLeft: 6, verticalAlign: "top", position: "relative", top: ".5em" }}>APU</sup>
              </motion.h1>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p key={drink.slug} className="lead" style={{ maxWidth: 470 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {drink.desc}
              </motion.p>
            </AnimatePresence>
            <div className="stack" style={{ gap: 10 }}>
              <span className="small" style={{ fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>Ingredientes</span>
              <div className="row" style={{ gap: 8 }}>
                {drink.ingredients.map((ing, i) => (
                  <motion.span key={drink.slug + ing} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}
                    style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #D8C6B0", background: "#fff", fontSize: 14, color: "var(--marron)" }}>
                    {ing}
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="row" style={{ gap: 18 }}>
              {[
                { icon: <IconLeaf />, t: "Orgánico" },
                { icon: <IconHands />, t: "Comercio Justo" },
                { icon: <IconMountain />, t: "+1 700 m s. n. m." },
                { icon: <IconBean />, t: "Notas frutales" },
              ].map((a) => (
                <div key={a.t} className="row" style={{ alignItems: "center", gap: 10, color: "var(--marron)" }}>
                  <span style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--caramelo)", display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</span>
                  <span className="small" style={{ maxWidth: 90, lineHeight: 1.2 }}>{a.t}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 14, alignItems: "center" }}>
              <Link to={drinkProduct ? `/producto/${drink.slug}` : "/cafeteria"} className="btn btn-primary" style={{ minHeight: 54 }}>
                Pídelo ahora{drinkProduct ? ` · ${soles(drinkProduct.priceFrom)}` : ""} <IconArrow />
              </Link>
              <Link to="/cafeteria" className="btn btn-outline" style={{ minHeight: 54 }}>Ver la carta completa</Link>
            </div>
          </div>

          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", justifyContent: "center", position: "relative", minHeight: 460 }}>
            <motion.div animate={{ background: drink.tint }} transition={{ duration: 0.5 }}
              style={{ position: "absolute", width: 420, height: 420, maxWidth: "90%", borderRadius: "50%", top: "50%", left: "50%", x: "-50%", y: "-50%" }} />
            <motion.svg width="120" height="120" viewBox="0 0 120 120" aria-hidden style={{ position: "absolute", top: 10, right: 24, y: beansY }}>
              <g fill="#5C3A24"><ellipse cx="30" cy="30" rx="12" ry="17" transform="rotate(-30 30 30)" /><ellipse cx="88" cy="70" rx="10" ry="14" transform="rotate(25 88 70)" /></g>
            </motion.svg>
            <AnimatePresence mode="wait">
              <motion.div key={drink.slug} style={{ position: "relative", width: 400, maxWidth: "100%", height: 460 }}
                initial={{ opacity: 0, rotate: -12, scale: 0.85, y: 30 }} animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }} exit={{ opacity: 0, rotate: 12, scale: 0.9, y: -20 }}
                transition={{ type: "spring", stiffness: 160, damping: 18 }}>
                <ProductArt kind={drink.art} title={drink.name} />
              </motion.div>
            </AnimatePresence>
          </div>

          <nav aria-label="Bebidas destacadas" className="stack" style={{ flex: "0 1 170px", gap: 6 }}>
            {DRINKS.map((d, i) => {
              const active = i === drinkIdx;
              return (
                <button key={d.slug} type="button" aria-pressed={active} onClick={() => setDrinkIdx(i)}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, padding: "6px 0", minHeight: 44, fontFamily: "var(--serif)", fontSize: active ? 22 : 20, fontWeight: active ? 700 : 400, color: active ? "var(--naranja)" : "var(--muted)", cursor: "pointer", textAlign: "left" }}>
                  <motion.span animate={{ width: active ? 22 : 0 }} style={{ height: 2, background: "var(--naranja)", display: "block" }} />
                  {d.name}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* FRANJA */}
      <div className="bg-black" style={{ padding: "26px 0", overflow: "hidden" }}>
        <motion.div className="container" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ display: "flex", flexWrap: "wrap", gap: "14px 40px", justifyContent: "center", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22 }}>
          {["Del grano a la taza", "Café orgánico", "Comercio Justo", "+2 800 familias productoras", "Cooperativa CENFROCAFE"].map((t, i, arr) => (
            <span key={t} style={{ display: "flex", gap: 40 }}>{t}{i < arr.length - 1 && <span aria-hidden style={{ color: "var(--caramelo)" }}>✦</span>}</span>
          ))}
        </motion.div>
      </div>

      {/* TU PAUSA */}
      <section className="section">
        <div className="container-narrow stack" style={{ gap: 56 }}>
          <Reveal className="stack" style={{ textAlign: "center", alignItems: "center", gap: 14 }}>
            <h2 className="h2" style={{ textTransform: "uppercase" }}>Tu pausa tiene sabor a APU</h2>
            <p className="lead muted" style={{ maxWidth: 620 }}>Café de productores de Jaén y San Ignacio, preparado al momento en Pasaje Bracamoros 137.</p>
          </Reveal>
          <div className="grid-fit" style={{ ["--min" as string]: "260px", gap: 40, alignItems: "center" }}>
            <div className="stack" style={{ gap: 48 }}>
              <Reveal><h3 style={{ fontSize: 20, fontWeight: 600 }}>Café de origen</h3><p className="muted" style={{ lineHeight: 1.6, marginTop: 8 }}>Caturra, Bourbon y Typica cultivados a más de 1 700 m s. n. m. por familias de la cooperativa.</p></Reveal>
              <Reveal delay={0.1}><h3 style={{ fontSize: 20, fontWeight: 600 }}>Baristas de Jaén</h3><p className="muted" style={{ lineHeight: 1.6, marginTop: 8 }}>Hijos de productores formados como baristas y tostadores preparan cada taza.</p></Reveal>
            </div>
            <Reveal y={40}>
              <div style={{ height: 380, borderRadius: "50% 50% 24px 24px", overflow: "hidden" }}>
                <ProductArt kind="mug" bg="var(--hueso)" />
              </div>
            </Reveal>
            <div className="stack" style={{ gap: 48 }}>
              <Reveal delay={0.15}><h3 style={{ fontSize: 20, fontWeight: 600 }}>Recojo o delivery</h3><p className="muted" style={{ lineHeight: 1.6, marginTop: 8 }}>Pide en línea y recógelo en 15 a 20 minutos, o recíbelo en 30 a 45 minutos en Jaén.</p></Reveal>
              <Reveal delay={0.25}><h3 style={{ fontSize: 20, fontWeight: 600 }}>APU a todo el Perú</h3><p className="muted" style={{ lineHeight: 1.6, marginTop: 8 }}>Café Classic, Espresso y Gourmet con envío nacional; gratis desde S/ 100.</p></Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* FAVORITOS */}
      <section style={{ padding: "0 0 88px" }}>
        <div className="container stack" style={{ gap: 32 }}>
          <Reveal className="row" style={{ justifyContent: "space-between", alignItems: "end", gap: 12 }}>
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Preparados al momento</span>
              <h2 className="h2">Favoritos de la carta</h2>
            </div>
            <Link to="/cafeteria" style={{ fontWeight: 500, textDecoration: "none" }}>Ver toda la carta →</Link>
          </Reveal>
          {loading ? <SkeletonGrid n={6} /> : (
            <div className="grid-auto" style={{ ["--min" as string]: "200px" }}>
              {favorites.map((p, i) => <Reveal key={p.slug} delay={i * 0.06}><ProductCard product={p} compact /></Reveal>)}
            </div>
          )}
        </div>
      </section>

      {/* LLEVA APU A CASA */}
      <section className="section bg-hueso">
        <div className="container row" style={{ gap: 48, alignItems: "center" }}>
          <div className="stack" style={{ flex: "1 1 560px", minWidth: 0, gap: 28 }}>
            <Reveal className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">Envío a todo el Perú</span>
              <h2 className="h2">Lleva APU a casa</h2>
              <p className="lead" style={{ maxWidth: 520 }}>El mismo café de la cafetería, en presentaciones de 250 g molido o en grano.</p>
            </Reveal>
            <div className="grid-fit" style={{ ["--min" as string]: "180px", gap: 18 }}>
              {bags.map((p, i) => <Reveal key={p.slug} delay={i * 0.08}><ProductCard product={p} compact /></Reveal>)}
            </div>
          </div>
          {specs.length > 0 && (
            <Reveal y={40} style={{ flex: "1 1 360px", minWidth: 0 }}>
              <aside style={{ background: "#fff", border: "2px solid var(--espresso)", borderRadius: 4, padding: "26px 28px" }}>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 800 }}>¿Qué hace bueno a nuestro café?</h3>
                <span className="small muted" style={{ display: "block", padding: "4px 0 10px", borderBottom: "8px solid var(--espresso)" }}>Ficha técnica · Café APU Classic</span>
                <dl style={{ margin: 0 }}>
                  {specs.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #D8C6B0", fontSize: 15 }}>
                      <dt style={{ fontWeight: 600 }}>{k}</dt>
                      <dd style={{ margin: 0, textAlign: "right", color: "var(--marron)" }}>{Array.isArray(v) ? v.join(", ") : v}</dd>
                    </div>
                  ))}
                </dl>
                <span className="tiny muted" style={{ display: "block", paddingTop: 8 }}>Fuente: catálogo de la Cooperativa CENFROCAFE.</span>
                <Link to="/producto/cafe-apu-classic" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>Comprar APU Classic · {soles(classic?.priceFrom)}</Link>
              </aside>
            </Reveal>
          )}
        </div>
      </section>

      {/* PASOS */}
      <section className="section">
        <div className="container-narrow stack" style={{ gap: 44 }}>
          <Reveal><h2 className="h2" style={{ textAlign: "center" }}>Tu pedido en cuatro pasos</h2></Reveal>
          <ol className="grid-fit" style={{ listStyle: "none", margin: 0, padding: 0, ["--min" as string]: "220px" }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <li className="panel-soft stack" style={{ gap: 10, height: "100%" }}>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 800, color: "var(--naranja)", lineHeight: 1 }}>{s.n}</span>
                  <h3 style={{ fontSize: 19, fontWeight: 600 }}>{s.t}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--marron)" }}>{s.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* PROMOCIONES */}
      {promos && promos.length > 0 && (
        <section style={{ paddingBottom: 88 }}>
          <div className="container-narrow stack" style={{ gap: 28 }}>
            <Reveal><h2 className="h2">Promociones vigentes</h2></Reveal>
            <div className="grid-fit" style={{ ["--min" as string]: "280px" }}>
              {promos.map((p, i) => (
                <Reveal key={p.code} delay={i * 0.08}>
                  <div className="stack" style={{ border: "2px dashed var(--caramelo)", borderRadius: 18, padding: 24, gap: 10, background: "#FFFBF6", height: "100%" }}>
                    <span className="tiny" style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--cobre)" }}>{PROMO_CHANNEL[p.code] ?? "Promoción"}</span>
                    <p style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 500, flex: 1 }}>{p.description}</p>
                    {(p.minSubtotal || p.requiresLogin) && (
                      <span className="small muted">{p.minSubtotal ? `Compra mínima ${soles(p.minSubtotal)}. ` : ""}{p.requiresLogin ? "Requiere cuenta." : ""}</span>
                    )}
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 6 }}>
                      <code className="code-pill" style={{ fontSize: 18 }}>{p.code}</code>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(p.code)} aria-live="polite">{copied === p.code ? "¡Copiado!" : "Copiar código"}</button>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* B2B */}
      <section className="bg-black">
        <div className="container row" style={{ padding: "72px 32px", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
          <Reveal className="stack" style={{ flex: "1 1 520px", gap: 12 }}>
            <span className="eyebrow" style={{ color: "var(--caramelo)" }}>APU para empresas</span>
            <h2 className="h2" style={{ color: "#fff" }}>¿Coffee break para tu equipo o evento?</h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--arena)", maxWidth: 560 }}>Cotiza café APU para reuniones, regalos corporativos o abastecimiento de oficina. Emitimos factura y respondemos en 48 horas.</p>
          </Reveal>
          <Link to="/empresas" className="btn btn-primary" style={{ minHeight: 54 }}>Solicitar cotización</Link>
        </div>
      </section>
    </>
  );
}
