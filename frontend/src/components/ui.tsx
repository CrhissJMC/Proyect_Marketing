import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, type MotionStyle } from "framer-motion";
import { ApiError } from "../lib/api";
import { artFor } from "../lib/art";
import { soles } from "../lib/format";
import type { OrderStatus, Product } from "../lib/types";
import { useCart } from "../context/CartContext";
import { ProductArt } from "./ProductArt";
import { IconCheck, IconInfo, IconPlus, IconX } from "./Icons";

/** Carga datos asíncronos con estado de carga y error. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void run();
  }, [run]);
  return { data, error, loading, reload: run, setData };
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error inesperado");
export const fieldErrors = (e: unknown) => (e instanceof ApiError ? e.fieldErrors : {});

/** Aparición suave al entrar en pantalla. */
export function Reveal({ children, delay = 0, y = 24, className, style }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: MotionStyle }) {
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "warn" | "ok" | "info"; children: ReactNode }) {
  const Icon = kind === "ok" ? IconCheck : kind === "error" ? IconX : IconInfo;
  return (
    <motion.div role={kind === "error" ? "alert" : "status"} className={`alert alert-${kind}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
      <Icon size={20} />
      <div>{children}</div>
    </motion.div>
  );
}

export function PageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="container section" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--muted)" }} role="status">
      <span className="spinner" /> {label}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  READY_FOR_PICKUP: "Listo para recoger",
  OUT_FOR_DELIVERY: "En camino",
  SHIPPED: "Enviado por agencia",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span aria-label={`${value} de 5 estrellas`} style={{ color: "var(--naranja)", letterSpacing: 2, fontSize: size }}>
      {"★".repeat(full)}
      <span style={{ color: "#D8C6B0" }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

const STEPS = ["Carrito", "Datos y entrega", "Pago", "Confirmación"];
export function Steps({ current }: { current: number }) {
  return (
    <ol className="steps" aria-label="Pasos de compra">
      {STEPS.map((s, i) => {
        const cls = i < current ? "done" : i === current ? "current" : "";
        return (
          <li key={s} className={cls} aria-current={i === current ? "step" : undefined}>
            <span className="dot">{i < current ? "✓" : i + 1}</span>
            {s}
            {i < STEPS.length - 1 && (
              <span className="bar" aria-hidden>
                {i < current && <motion.span style={{ position: "absolute", inset: 0, background: "var(--espresso)" }} initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.1 * i }} />}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Tarjeta de producto del catálogo con botón para agregar la primera variante disponible. */
export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { add } = useCart();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const art = artFor(product.slug, product.category?.slug);
  const variant = product.variants.find((v) => v.available);
  const badge = !product.available
    ? { text: "Agotado", cls: "chip-white" }
    : variant?.stock != null && variant.stock <= 5
      ? { text: variant.availabilityLabel, cls: "chip-orange" }
      : product.line === "CAFETERIA"
        ? { text: "Solo Jaén", cls: "chip-white" }
        : product.tags.includes("organico")
          ? { text: "Orgánico", cls: "chip-dark" }
          : null;

  const onAdd = async () => {
    if (!variant) return;
    setState("busy");
    try {
      await add(variant.id, 1, { name: product.name, variant: variant.name, slug: product.slug });
      setState("done");
      setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2200);
    }
  };

  return (
    <article className="card lift" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Link to={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`} style={{ display: "block", position: "relative", height: compact ? 190 : 230 }}>
        <ProductArt kind={art.kind} bg={art.tint} label={art.label} labelBg={art.labelBg} steam={false} title={product.name} />
        {badge && <span className={`chip ${badge.cls}`} style={{ position: "absolute", top: 12, left: 12 }}>{badge.text}</span>}
      </Link>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {!compact && product.category && <span className="tiny" style={{ letterSpacing: ".12em", textTransform: "uppercase", color: "var(--cobre)" }}>{product.category.name}</span>}
        <h3 style={{ fontSize: 17, fontWeight: 500 }}>
          <Link to={`/producto/${product.slug}`} style={{ color: "var(--espresso)", textDecoration: "none" }}>{product.name}</Link>
        </h3>
        <span className="small muted">{product.variants.length > 1 ? product.variants.map((v) => v.name).join(" · ") : product.shortDescription}</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 10, gap: 10 }}>
          <span className="price" style={{ fontSize: 18 }}>{product.variants.length > 1 ? "Desde " : ""}{soles(product.priceFrom)}</span>
          <button type="button" className="icon-btn" onClick={onAdd} disabled={!variant || state === "busy"} aria-label={`Agregar ${product.name} al carrito`} style={state === "done" ? { background: "var(--ok)" } : state === "error" ? { background: "var(--error)" } : undefined}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={state} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} style={{ display: "flex" }}>
                {state === "busy" ? <Spinner /> : state === "done" ? <IconCheck /> : state === "error" ? <IconX size={18} /> : <IconPlus />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </article>
  );
}

export function SkeletonGrid({ n = 6, h = 330 }: { n?: number; h?: number }) {
  return (
    <div className="grid-auto">
      {Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: h }} />)}
    </div>
  );
}

/** Aviso flotante al agregar productos al carrito. */
export function CartToast() {
  const { toast, dismissToast } = useCart();
  return (
    <AnimatePresence>
      {toast && (
        <motion.div key={toast.id} className="toast" role="status" initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }} transition={{ type: "spring", stiffness: 380, damping: 28 }}>
          {toast.slug && (
            <div style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", flex: "none" }}>
              {(() => { const a = artFor(toast.slug); return <ProductArt kind={a.kind} bg={a.tint} label={a.label} labelBg={a.labelBg} steam={false} />; })()}
            </div>
          )}
          <div className="stack" style={{ gap: 2 }}>
            <strong style={{ fontWeight: 600 }}>{toast.title}</strong>
            <span className="small" style={{ color: "var(--arena)" }}>{toast.detail}</span>
            <Link to="/carrito" onClick={dismissToast} className="small">Ver carrito →</Link>
          </div>
          <button type="button" onClick={dismissToast} aria-label="Cerrar aviso" style={{ background: "none", border: 0, color: "#fff", cursor: "pointer", width: 36, height: 36 }}>×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
