import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { CartToast, PageLoader } from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { Home } from "./pages/Home";
import { Shop } from "./pages/Shop";
import { Cafeteria } from "./pages/Cafeteria";
import { ProductPage } from "./pages/Product";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Payment } from "./pages/Payment";
import { OrderConfirmed } from "./pages/OrderConfirmed";
import { Tracking } from "./pages/Tracking";
import { Access } from "./pages/Access";
import { Account } from "./pages/Account";
import { Business } from "./pages/Business";
import { Complaints } from "./pages/Complaints";
import { About } from "./pages/About";
import { NotFound } from "./pages/NotFound";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminOrders } from "./pages/admin/AdminOrders";
import { AdminInventory } from "./pages/admin/AdminInventory";
import { AdminService } from "./pages/admin/AdminService";

/** Desplaza al inicio (o al ancla) al cambiar de página. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 80);
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

function StoreLayout() {
  const location = useLocation();
  return (
    <>
      <a href="#contenido" className="sr-only">Saltar al contenido</a>
      <Header />
      {/* Solo animación de entrada: una salida con AnimatePresence se atascaba en opacidad 0
          cuando la página saliente se volvía a renderizar (p. ej., checkout → pago). */}
      <motion.main id="contenido" key={location.pathname} className="page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Outlet />
      </motion.main>
      <Footer />
      <CartToast />
    </>
  );
}

function RequireStaff({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/acceso?next=/admin" replace />;
  if (user.role === "CUSTOMER") return <Navigate to="/mi-cuenta" replace />;
  return children;
}

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="tienda" element={<Shop />} />
          <Route path="cafeteria" element={<Cafeteria />} />
          <Route path="producto/:slug" element={<ProductPage />} />
          <Route path="carrito" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="pago/:code" element={<Payment />} />
          <Route path="pedido/:code" element={<OrderConfirmed />} />
          <Route path="seguimiento" element={<Tracking />} />
          <Route path="acceso" element={<Access />} />
          <Route path="mi-cuenta" element={<Account />} />
          <Route path="empresas" element={<Business />} />
          <Route path="reclamaciones" element={<Complaints />} />
          <Route path="historia" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="admin" element={<RequireStaff><AdminLayout /></RequireStaff>}>
          <Route index element={<AdminDashboard />} />
          <Route path="pedidos" element={<AdminOrders />} />
          <Route path="inventario" element={<AdminInventory />} />
          <Route path="atencion" element={<AdminService />} />
        </Route>
      </Routes>
    </>
  );
}
