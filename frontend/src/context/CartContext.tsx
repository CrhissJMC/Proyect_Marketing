import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, api } from "../lib/api";
import type { Address, CartView, ShippingMethod } from "../lib/types";

const CART_KEY = "apu.cartId";
const COUPON_KEY = "apu.coupon";

export interface Toast {
  id: number;
  title: string;
  detail: string;
  slug?: string;
}

interface CartState {
  cart: CartView | null;
  count: number;
  loading: boolean;
  coupon: string | null;
  toast: Toast | null;
  dismissToast: () => void;
  refresh: () => Promise<CartView | null>;
  add: (variantId: string, quantity: number, label: { name: string; variant: string; slug?: string }) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => Promise<void>;
  quote: (input: { shippingMethod?: ShippingMethod; address?: Address; email?: string }) => Promise<CartView>;
  reset: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartId, setCartId] = useState<string | null>(() => localStorage.getItem(CART_KEY));
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState<string | null>(() => localStorage.getItem(COUPON_KEY));
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const couponRef = useRef(coupon);
  couponRef.current = coupon;

  const saveId = (id: string | null) => {
    if (id) localStorage.setItem(CART_KEY, id);
    else localStorage.removeItem(CART_KEY);
    setCartId(id);
  };
  const saveCoupon = (code: string | null) => {
    if (code) localStorage.setItem(COUPON_KEY, code);
    else localStorage.removeItem(COUPON_KEY);
    setCoupon(code);
  };

  const create = useCallback(async () => {
    const c = await api<CartView>("/cart", { method: "POST" });
    saveId(c.cartId);
    setCart(c);
    return c;
  }, []);

  /** Devuelve el id de un carrito válido, creándolo si hace falta. */
  const ensureId = useCallback(async () => {
    if (cartId) return cartId;
    return (await create()).cartId;
  }, [cartId, create]);

  const fetchCart = useCallback(
    async (id: string) => {
      const q = couponRef.current ? `?coupon=${encodeURIComponent(couponRef.current)}` : "";
      try {
        const c = await api<CartView>(`/cart/${id}${q}`);
        if (c.couponError && couponRef.current) saveCoupon(null);
        setCart(c);
        return c;
      } catch (e) {
        // Carrito inexistente o de otra cuenta: empezar uno nuevo.
        if (e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 400)) return create();
        throw e;
      }
    },
    [create],
  );

  const refresh = useCallback(async () => {
    if (!cartId) {
      setCart(null);
      setLoading(false);
      return null;
    }
    try {
      return await fetchCart(cartId);
    } finally {
      setLoading(false);
    }
  }, [cartId, fetchCart]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Al iniciar sesión, el carrito de invitado pasa a la cuenta; al cerrar, se empieza otro.
  useEffect(() => {
    const onLogin = async () => {
      const id = localStorage.getItem(CART_KEY);
      if (!id) return;
      try {
        setCart(await api<CartView>(`/cart/${id}/claim`, { method: "POST" }));
      } catch {
        saveId(null);
        setCart(null);
      }
    };
    const onLogout = () => {
      saveId(null);
      saveCoupon(null);
      setCart(null);
    };
    window.addEventListener("apu:login", onLogin);
    window.addEventListener("apu:logout", onLogout);
    return () => {
      window.removeEventListener("apu:login", onLogin);
      window.removeEventListener("apu:logout", onLogout);
    };
  }, []);

  const showToast = (t: Omit<Toast, "id">) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...t, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  };

  const value = useMemo<CartState>(
    () => ({
      cart,
      count: cart?.summary.itemCount ?? 0,
      loading,
      coupon,
      toast,
      dismissToast: () => setToast(null),
      refresh,
      async add(variantId, quantity, label) {
        let id = await ensureId();
        try {
          await api(`/cart/${id}/items`, { method: "POST", body: { variantId, quantity } });
        } catch (e) {
          if (e instanceof ApiError && (e.status === 403 || (e.status === 404 && e.message.includes("Carrito")))) {
            id = (await create()).cartId;
            await api(`/cart/${id}/items`, { method: "POST", body: { variantId, quantity } });
          } else throw e;
        }
        await fetchCart(id);
        showToast({ title: "Agregado al carrito", detail: `${quantity}× ${label.name} · ${label.variant}`, slug: label.slug });
      },
      async setQuantity(variantId, quantity) {
        const id = await ensureId();
        await api(`/cart/${id}/items/${variantId}`, { method: "PATCH", body: { quantity } });
        await fetchCart(id);
      },
      async remove(variantId) {
        const id = await ensureId();
        await api(`/cart/${id}/items/${variantId}`, { method: "DELETE" });
        await fetchCart(id);
      },
      async applyCoupon(code) {
        const id = await ensureId();
        const c = await api<CartView>(`/cart/${id}?coupon=${encodeURIComponent(code.trim().toUpperCase())}`);
        if (c.couponError) return c.couponError;
        saveCoupon(c.coupon?.code ?? null);
        setCart(c);
        return null;
      },
      async removeCoupon() {
        saveCoupon(null);
        couponRef.current = null;
        if (cartId) await fetchCart(cartId);
      },
      async quote(input) {
        const id = await ensureId();
        const c = await api<CartView>(`/cart/${id}/quote`, {
          method: "POST",
          body: { ...input, couponCode: couponRef.current ?? undefined },
        });
        setCart(c);
        return c;
      },
      reset() {
        saveCoupon(null);
        couponRef.current = null;
        if (cartId) void fetchCart(cartId);
      },
    }),
    [cart, loading, coupon, toast, refresh, ensureId, fetchCart, create, cartId],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart fuera de CartProvider");
  return ctx;
}
