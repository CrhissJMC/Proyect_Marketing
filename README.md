# Tienda virtual — Cafetería APU (Jaén)

Prototipo académico de comercio electrónico para la **Cafetería APU**, desarrollado para el curso de Marketing Digital y Comercio Electrónico (UNTRM). Toma como referencia el proyecto integrador del grupo.

> ⚠️ **Prototipo académico.** No se procesan pedidos ni pagos reales. Los precios, el horario y los datos de contacto son referenciales.

- **Modelo:** B2C con canal B2B de cotizaciones. Las decisiones del negocio están en [docs/modelo-comercio-electronico.md](docs/modelo-comercio-electronico.md).
- **Stack:** React + Vite + TypeScript + Framer Motion (web) · Node.js + Express + TypeScript (API) · PostgreSQL + Prisma · Docker · túnel de Cloudflare.

## Requisitos

- Docker Desktop

## Puesta en marcha

1. Crea el archivo de configuración:

   ```powershell
   Copy-Item .env.example .env
   ```

   Cambia `JWT_SECRET` y `ADMIN_PASSWORD` por valores propios: con el túnel activo, el panel es accesible desde internet.

2. Levanta la base de datos, la API y la tienda web:

   ```powershell
   docker compose up -d --build
   ```

   Al iniciar, la API aplica las migraciones y carga el catálogo y las promociones.

3. Abre la tienda: <http://localhost:8080>. El panel de administración está en <http://localhost:8080/admin> (con el correo y la contraseña que definas en `.env`). La API también responde directamente en <http://localhost:4000/api/health>.

### Acceso público con Cloudflare

```powershell
docker compose --profile tunnel up -d
```

```powershell
docker compose logs tunnel
```

Busca la URL `https://<algo>.trycloudflare.com` en los logs. Es un túnel rápido: no requiere cuenta y la URL cambia en cada reinicio.

### Prueba de punta a punta

Recorre el flujo completo (116 verificaciones): catálogo, carrito, cupones, checkout, pagos aprobados y rechazados, estados, devolución, factura, cancelación, concurrencia de stock, privacidad, reclamos, B2B y panel.

```powershell
docker compose exec api node dist/scripts/smoke.js
```

## Estructura

```
frontend/
  src/pages/                Inicio, Tienda, Cafetería, Producto, Carrito, Checkout, Pago,
                            Confirmación, Seguimiento, Acceso, Mi cuenta, Empresas,
                            Libro de Reclamaciones, Historia y panel de administración
  src/components/           Cabecera, pie, ilustraciones de producto y piezas de interfaz
  src/context/              Sesión y carrito
  src/lib/api.ts            Cliente de la API
  nginx.conf                Sirve la web y reenvía /api a la API
backend/
  prisma/schema.prisma      Modelo de datos
  prisma/seed.ts            Catálogo referencial, cupones y administrador
  src/config/store.ts       Decisiones de negocio: envíos, pagos, horario, políticas
  src/modules/
    catalog/                Categorías, productos, reseñas
    cart/                   Carrito (invitado o con cuenta)
    pricing/                Subtotal, cupones y costo de envío
    orders/                 Checkout, estados, cancelación y seguimiento
    payments/               Pasarela simulada (tarjeta, Yape, Plin)
    inventory/              Reserva atómica, movimientos y stock diario
    postsale/               Devoluciones y reseñas
    complaints/             Libro de Reclamaciones virtual
    b2b/                    Cotizaciones corporativas
    account/                Perfil, direcciones y derechos ARCO
    admin/                  Panel: pedidos, catálogo, stock, cupones, métricas
docs/                       Modelo de negocio
docker-compose.yml          PostgreSQL + API + túnel
```

## API

Base: `http://localhost:4000/api`. Los errores siguen el formato `{ "error": { "code", "message", "details" } }`.

### Tienda y catálogo

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/store` | Datos de la tienda, horario, envíos, medios de pago y políticas |
| GET | `/store/payment-simulator` | Tarjetas y códigos de prueba |
| GET | `/store/promotions` | Promociones vigentes |
| GET | `/categories` | Categorías |
| GET | `/products?line=&category=&q=&featured=&sort=&page=` | Catálogo con filtros |
| GET | `/products/:slug` | Detalle, variantes, disponibilidad y productos relacionados |
| GET | `/products/:slug/reviews` | Reseñas verificadas |

### Carrito

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/cart` | Crea un carrito y devuelve `cartId` |
| GET | `/cart/:id?coupon=&shipping=` | Carrito con totales y opciones de envío |
| POST | `/cart/:id/items` | Agrega un producto `{ variantId, quantity }` |
| PATCH / DELETE | `/cart/:id/items/:variantId` | Cambia la cantidad o quita el producto |
| POST | `/cart/:id/quote` | Cotización completa (cupón, envío, dirección) |
| POST | `/cart/:id/claim` | Asocia el carrito a la cuenta tras iniciar sesión |
| GET | `/cart/mine` | Último carrito de la cuenta |

### Pedidos y pagos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/orders` | Checkout. Devuelve el pedido, `orderToken` (para invitados) y `nextStep` |
| GET | `/orders/:code` | Detalle del pedido (dueño, personal o cabecera `X-Order-Token`) |
| GET | `/orders/track?code=&email=` | Seguimiento público |
| POST | `/orders/:code/payments` | Pago simulado. Admite `Idempotency-Key` |
| POST | `/orders/:code/cancel` | Cancelación (con reembolso simulado si ya se pagó) |
| POST / GET | `/orders/:code/returns` | Solicitudes de devolución |
| POST | `/orders/:code/reviews` | Reseñas de un pedido entregado |

### Cuenta

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Registro e inicio de sesión (JWT) |
| GET | `/auth/me` | Usuario actual |
| PATCH | `/me` | Rectificación del perfil |
| POST | `/me/password` | Cambio de contraseña |
| PATCH | `/me/consents` | Consentimiento de publicidad |
| GET / POST / PATCH / DELETE | `/me/addresses` | Direcciones guardadas |
| GET | `/me/orders` | Historial de pedidos |
| GET | `/me/data-export` | Descarga de los datos personales |
| DELETE | `/me` | Eliminación y anonimización de la cuenta |

### Atención

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/complaints` | Libro de Reclamaciones |
| GET | `/complaints/:code?email=` | Estado del reclamo |
| GET | `/corporate-quotes/types` | Tipos de cotización B2B |
| POST | `/corporate-quotes` | Solicitud de cotización B2B |
| GET | `/corporate-quotes/:code?email=` | Estado de la cotización |

### Administración

Rol STAFF o ADMIN. Las rutas marcadas con * requieren ADMIN.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/dashboard?from=&to=` | Ventas, embudo, atribución por canal y cupón, alertas |
| GET | `/admin/orders`, `/admin/orders/:code` | Pedidos |
| PATCH | `/admin/orders/:code/status` | Avance de estado |
| GET | `/admin/products` | Catálogo completo |
| POST / PATCH | `/admin/products`*, `/admin/variants/:id`* | Gestión del catálogo |
| POST | `/admin/variants/:id/stock` | Reposición o ajuste de stock |
| GET | `/admin/inventory/low-stock`, `/admin/inventory/movements` | Inventario |
| POST | `/admin/inventory/daily-reset` | Reposición diaria de postres |
| GET / POST / PATCH | `/admin/coupons`* | Cupones |
| GET / PATCH | `/admin/returns`, `/admin/reviews`, `/admin/complaints`, `/admin/quotes` | Posventa y B2B |
| GET | `/admin/audit-logs`* | Auditoría |

### Datos de prueba del simulador de pagos

| Tarjeta | Resultado |
|---|---|
| 4111 1111 1111 1111 | Visa aprobada |
| 5555 5555 5555 4444 | Mastercard aprobada |
| 4000 0000 0000 0002 | Rechazada: fondos insuficientes |
| 4000 0000 0000 0069 | Rechazada: tarjeta bloqueada |

Vencimiento: cualquier fecha futura. CVV: 3 dígitos (4 para Amex).

**Yape / Plin:** cualquier celular que empiece con 9 y un código de 6 dígitos. `000000` simula un rechazo y `111111` un código vencido.
