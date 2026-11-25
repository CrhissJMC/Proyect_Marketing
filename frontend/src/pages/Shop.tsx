import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import type { Category, Product } from "../lib/types";
import { Alert, ProductCard, SkeletonGrid, useAsync } from "../components/ui";
import { IconShield, IconStore, IconTruck } from "../components/Icons";

const LINES = [
  { id: "", label: "Todo" },
  { id: "EMPACADO", label: "Café empacado" },
  { id: "CAFETERIA", label: "Cafetería" },
];

export function Shop() {
  const [params, setParams] = useSearchParams();
  const line = params.get("line") ?? "EMPACADO";
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "featured";
  const [maxPrice, setMaxPrice] = useState(60);
  const [presentation, setPresentation] = useState<{ molido: boolean; grano: boolean }>({ molido: false, grano: false });
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [organic, setOrganic] = useState(false);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "line") next.delete("category");
    setParams(next, { replace: true });
  };

  const { data: categories } = useAsync(() => api<{ categories: Category[] }>("/categories").then((r) => r.categories), []);
  const qs = new URLSearchParams({ pageSize: "100", sort });
  if (q) qs.set("q", q);
  else {
    if (line && !category) qs.set("line", line);
    if (category) qs.set("category", category);
  }
  const { data, loading, error } = useAsync(() => api<{ products: Product[] }>(`/products?${qs}`).then((r) => r.products), [qs.toString()]);

  const products = useMemo(() => {
    return (data ?? []).filter((p) => {
      if ((p.priceFrom ?? 0) > maxPrice) return false;
      if (onlyAvailable && !p.available) return false;
      if (organic && !p.tags.includes("organico")) return false;
      if (presentation.molido || presentation.grano) {
        const names = p.variants.map((v) => v.name.toLowerCase()).join(" ");
        const ok = (presentation.molido && names.includes("molido")) || (presentation.grano && names.includes("grano"));
        if (!ok) return false;
      }
      return true;
    });
  }, [data, maxPrice, onlyAvailable, organic, presentation]);

  const visibleCategories = (categories ?? []).filter((c) => !line || c.line === line);
  const clear = () => {
    setParams(new URLSearchParams({ line }), { replace: true });
    setMaxPrice(60);
    setPresentation({ molido: false, grano: false });
    setOnlyAvailable(false);
    setOrganic(false);
  };

  return (
    <>
      <section className="bg-hueso">
        <div className="container stack" style={{ padding: "36px 32px 40px", gap: 14 }}>
          <nav aria-label="Ruta" className="small muted"><Link to="/" style={{ color: "var(--muted)" }}>Inicio</Link> / <span aria-current="page" style={{ color: "var(--espresso)" }}>Tienda</span></nav>
          <h1 className="h1">{q ? `Resultados para «${q}»` : "Tienda"}</h1>
          <p className="lead" style={{ maxWidth: 640 }}>Café APU de Jaén para llevar a casa y lo mejor de nuestra carta para recoger o recibir en Jaén.</p>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <span className="chip chip-white"><IconTruck size={18} /> Envío nacional S/ 12 · gratis desde S/ 100</span>
            <span className="chip chip-white"><IconStore size={18} /> Recojo gratis en Pasaje Bracamoros 137</span>
            <span className="chip chip-white"><IconShield size={18} /> Pago seguro con tarjeta, Yape o Plin</span>
          </div>
        </div>
      </section>

      <div className="container" style={{ padding: "36px 32px 80px", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
        <aside aria-label="Filtros" className="stack" style={{ flex: "1 1 250px", maxWidth: 300, minWidth: 0, gap: 14 }}>
          <section className="stack" style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 18, gap: 4 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Colecciones</h2>
            {visibleCategories.map((c) => {
              const active = c.slug === category;
              return (
                <button key={c.slug} type="button" aria-pressed={active} onClick={() => set("category", active ? "" : c.slug)}
                  style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", margin: "0 -10px", border: 0, borderRadius: 8, background: active ? "var(--hueso)" : "none", color: active ? "var(--espresso)" : "var(--marron)", fontWeight: active ? 600 : 400, fontSize: 15, cursor: "pointer", textAlign: "left" }}>
                  <span>{c.name}</span><span className="muted">{c.productCount}</span>
                </button>
              );
            })}
          </section>
          <section className="stack" style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 18, gap: 10 }}>
            <label htmlFor="price" style={{ fontSize: 16, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>Precio máximo <span className="price">S/ {maxPrice}</span></label>
            <input id="price" type="range" min={3} max={60} step={1} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} style={{ accentColor: "var(--espresso)", width: "100%" }} />
          </section>
          <section className="stack" style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 18, gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Presentación</h2>
            <label className="check"><input type="checkbox" checked={presentation.molido} onChange={(e) => setPresentation((p) => ({ ...p, molido: e.target.checked }))} />Molido</label>
            <label className="check"><input type="checkbox" checked={presentation.grano} onChange={(e) => setPresentation((p) => ({ ...p, grano: e.target.checked }))} />En grano</label>
          </section>
          <section className="stack" style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 18, gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Más filtros</h2>
            <label className="check"><input type="checkbox" checked={organic} onChange={(e) => setOrganic(e.target.checked)} />Orgánico</label>
            <label className="check"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />Solo disponibles hoy</label>
          </section>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Limpiar filtros</button>
        </aside>

        <div className="stack" style={{ flex: "999 1 560px", minWidth: 0, gap: 24 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 14 }}>
            <div className="seg" role="group" aria-label="Línea de productos">
              {LINES.map((l) => (
                <button key={l.id} type="button" aria-pressed={line === l.id && !q} onClick={() => { const n = new URLSearchParams(); if (l.id) n.set("line", l.id); else n.set("line", ""); setParams(n, { replace: true }); }}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="row" style={{ alignItems: "center", gap: 14 }}>
              <span className="muted" aria-live="polite">{products.length} productos</span>
              <label className="row" style={{ alignItems: "center", gap: 8 }}>
                Ordenar
                <select value={sort} onChange={(e) => set("sort", e.target.value)} style={{ height: 44, border: "1px solid var(--borde)", borderRadius: 10, padding: "0 12px", font: "400 15px var(--sans)", background: "#fff" }}>
                  <option value="featured">Destacados</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                  <option value="name">Nombre</option>
                </select>
              </label>
            </div>
          </div>

          {error && <Alert>{error}</Alert>}
          {loading ? <SkeletonGrid n={6} /> : products.length === 0 ? (
            <div className="panel-soft stack" style={{ gap: 10, alignItems: "flex-start" }}>
              <strong>No encontramos productos con esos filtros.</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={clear}>Limpiar filtros</button>
            </div>
          ) : (
            <motion.div layout className="grid-auto">
              <AnimatePresence mode="popLayout">
                {products.map((p) => (
                  <motion.div key={p.slug} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.25 }}>
                    <ProductCard product={p} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
