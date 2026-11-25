/**
 * Prueba de punta a punta del backend contra una API en ejecución.
 * Uso: API_URL=http://localhost:4000/api ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run smoke
 */
const API = process.env.API_URL ?? "http://localhost:4000/api";
let passed = 0;

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: Json = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function check(condition: unknown, label: string, detail?: unknown): asserts condition {
  if (!condition) {
    console.error(`✗ ${label}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${label}`);
}

async function expectStatus(p: Promise<{ status: number; data: Json }>, status: number, label: string) {
  const r = await p;
  check(r.status === status, `${label} (HTTP ${r.status})`, r.data);
  return r.data;
}

const uid = Date.now().toString().slice(-6);
const customer = (n: string) => ({
  fullName: `Cliente Prueba ${n}`,
  email: `cliente.${n}.${uid}@apu-demo.test`,
  phone: "987654321",
  docType: "DNI",
  docNumber: "12345678",
});
const jaenAddress = {
  recipient: "Cliente Prueba",
  phone: "987654321",
  line1: "Jr. San Martín 123",
  reference: "Frente a la plaza",
  district: "Jaén",
  province: "Jaén",
  department: "Cajamarca",
};
const limaAddress = { ...jaenAddress, line1: "Av. Arequipa 1000", district: "Lince", province: "Lima", department: "Lima" };

async function variantOf(slug: string, index = 0) {
  const d = await expectStatus(call("GET", `/products/${slug}`), 200, `Detalle de producto ${slug}`);
  return d.product.variants[index];
}

async function newCart(items: { variantId: string; quantity: number }[], headers: Record<string, string> = {}) {
  const cart = await expectStatus(call("POST", "/cart", undefined, headers), 201, "Crear carrito");
  for (const it of items) await expectStatus(call("POST", `/cart/${cart.cartId}/items`, it, headers), 201, "Agregar al carrito");
  return cart.cartId as string;
}

async function main() {
  console.log(`\n── Probando ${API}\n`);

  // ── Tienda y catálogo
  await expectStatus(call("GET", "/health"), 200, "Salud de la API y base de datos");
  const store = await expectStatus(call("GET", "/store"), 200, "Información de la tienda");
  check(store.disclaimer.includes("Prototipo"), "Aviso de prototipo académico presente");
  await expectStatus(call("GET", "/store/payment-simulator"), 200, "Datos de prueba del simulador");
  await expectStatus(call("GET", "/store/promotions"), 200, "Promociones vigentes");
  const cats = await expectStatus(call("GET", "/categories"), 200, "Categorías");
  check(cats.categories.length >= 7, "7 categorías cargadas");
  const list = await expectStatus(call("GET", "/products?line=EMPACADO&sort=price_asc"), 200, "Listado de café empacado");
  check(list.products.every((p: Json) => p.line === "EMPACADO"), "Filtro por línea funciona");
  const search = await expectStatus(call("GET", "/products?q=capuchino"), 200, "Búsqueda");
  check(search.products.some((p: Json) => p.slug === "capuchino"), "La búsqueda encuentra el capuchino");

  const capu16 = await variantOf("capuchino", 1);
  const keke = await variantOf("keke-de-cafe");
  const classic = await variantOf("cafe-apu-classic");
  const gourmet = await variantOf("cafe-apu-gourmet");
  const kekeStockBefore = keke.stock as number;

  // ── Carrito y reglas de envío
  const cartId = await newCart([
    { variantId: capu16.id, quantity: 2 },
    { variantId: keke.id, quantity: 1 },
  ]);
  const cart = await expectStatus(call("GET", `/cart/${cartId}`), 200, "Ver carrito");
  check(cart.summary.subtotal === 27, "Subtotal = 2×11 + 5 = S/ 27", cart.summary);
  const national = cart.shippingOptions.find((o: Json) => o.method === "NATIONAL");
  check(!national.available, "Envío nacional bloqueado para bebidas y postres", national);
  const q1 = await expectStatus(
    call("POST", `/cart/${cartId}/quote`, { couponCode: "APUINFLUYE", shippingMethod: "DELIVERY_LOCAL", address: jaenAddress }),
    200,
    "Cotizar con cupón y delivery",
  );
  check(q1.coupon?.discount === 2.7, "APUINFLUYE aplica 10 % (S/ 2.70)", q1.coupon ?? q1.couponError);
  check(q1.summary.total === 28.3, "Total = 27 − 2.70 + 4 = S/ 28.30", q1.summary);
  const q2 = await expectStatus(
    call("POST", `/cart/${cartId}/quote`, { shippingMethod: "DELIVERY_LOCAL", address: limaAddress }),
    200,
    "Cotizar delivery fuera de Jaén",
  );
  check(q2.shipping && !q2.shipping.available, "Delivery local rechaza direcciones fuera de Jaén");
  const q3 = await expectStatus(call("GET", `/cart/${cartId}?coupon=NOEXISTE`), 200, "Cupón inválido en carrito");
  check(q3.couponError, "El carrito informa el cupón inválido sin fallar");
  await expectStatus(call("POST", `/cart/${cartId}/items`, { variantId: keke.id, quantity: 999 }), 400, "Límite de cantidad por producto");

  // ── Checkout de invitado con tarjeta
  const checkout = await expectStatus(
    call("POST", "/orders", {
      cartId,
      customer: customer("a"),
      shippingMethod: "DELIVERY_LOCAL",
      address: jaenAddress,
      paymentMethod: "CARD",
      couponCode: "APUINFLUYE",
      source: "INFLUENCER",
      acceptTerms: true,
    }),
    201,
    "Checkout de invitado (delivery + tarjeta)",
  );
  const code = checkout.order.code as string;
  const token = { "X-Order-Token": checkout.orderToken as string };
  check(checkout.order.status === "PENDING_PAYMENT", `Pedido ${code} pendiente de pago`);
  check(checkout.nextStep.type === "PAY_ONLINE", "Siguiente paso: pagar en línea");
  const emptyCart = await expectStatus(call("GET", `/cart/${cartId}`), 200, "Carrito tras el checkout");
  check(emptyCart.items.length === 0, "El carrito se vacía tras confirmar");
  await expectStatus(call("GET", `/orders/${code}`), 404, "Sin token no se ve el pedido de otro");
  await expectStatus(
    call("POST", "/orders", { cartId, customer: customer("a"), shippingMethod: "PICKUP", paymentMethod: "CARD", acceptTerms: true }),
    400,
    "No se puede pagar dos veces el mismo carrito vacío",
  );

  const kekeAfter = await variantOf("keke-de-cafe");
  check(kekeAfter.stock === kekeStockBefore - 1, "El stock del keke se descontó al confirmar");

  const card = (number: string) => ({
    method: "CARD",
    card: { number, holderName: "CLIENTE PRUEBA", expMonth: 12, expYear: new Date().getFullYear() + 2, cvv: "123" },
  });
  const declined = await expectStatus(call("POST", `/orders/${code}/payments`, card("4000000000000002"), token), 402, "Tarjeta rechazada");
  check(declined.payment.code === "INSUFFICIENT_FUNDS", "Motivo: fondos insuficientes");
  await expectStatus(call("POST", `/orders/${code}/payments`, card("4111111111111112"), token), 402, "Número de tarjeta inválido (Luhn)");
  const idem = { ...token, "Idempotency-Key": `pago-${uid}` };
  const paid = await expectStatus(call("POST", `/orders/${code}/payments`, card("4111 1111 1111 1111"), idem), 201, "Tarjeta aprobada");
  check(paid.order.status === "CONFIRMED" && paid.order.payment.status === "PAID", "Pedido confirmado y pagado");
  check(/^B001-\d{8}$/.test(paid.order.receipt.number), `Boleta emitida ${paid.order.receipt.number}`);
  check(paid.payment.cardLast4 === "1111" && !JSON.stringify(paid).includes("4111111111111111"), "Solo se guardan los últimos 4 dígitos");
  const replay = await expectStatus(call("POST", `/orders/${code}/payments`, card("4111111111111111"), idem), 200, "Reintento con la misma Idempotency-Key");
  check(replay.replayed === true, "No se cobra dos veces");
  await expectStatus(call("POST", `/orders/${code}/payments`, card("5555555555554444"), token), 409, "Un pedido pagado no admite otro pago");

  // ── Gestión del pedido (personal de la tienda)
  const login = await expectStatus(
    call("POST", "/auth/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
    200,
    "Inicio de sesión del administrador",
  );
  const adminH = { Authorization: `Bearer ${login.token}` };
  await expectStatus(call("GET", "/admin/dashboard"), 401, "El panel exige sesión");
  await expectStatus(
    call("PATCH", `/admin/orders/${code}/status`, { status: "DELIVERED" }, adminH),
    400,
    "No se puede saltar de confirmado a entregado",
  );
  for (const s of ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]) {
    await expectStatus(call("PATCH", `/admin/orders/${code}/status`, { status: s }, adminH), 200, `Estado → ${s}`);
  }
  const tracked = await expectStatus(call("GET", `/orders/track?code=${code}&email=${customer("a").email}`), 200, "Seguimiento público");
  check(tracked.timeline.length === 5, "Línea de tiempo con 5 estados", tracked.timeline);

  // ── Posventa
  const delivered = await expectStatus(call("GET", `/orders/${code}`, undefined, token), 200, "Pedido entregado");
  const kekeItem = delivered.order.items.find((i: Json) => i.sku === keke.sku);
  await expectStatus(
    call("POST", `/orders/${code}/reviews`, { reviews: [{ productSlug: "capuchino", rating: 5, comment: "Excelente capuchino" }] }, token),
    201,
    "Reseña de compra verificada",
  );
  await expectStatus(
    call("POST", `/orders/${code}/returns`, { type: "REFUND", reason: "NO_LO_QUIERO", description: "Ya no lo quiero, gracias", items: [{ orderItemId: kekeItem.id, quantity: 1 }] }, token),
    400,
    "Perecibles no se devuelven por desistimiento",
  );
  const ret = await expectStatus(
    call("POST", `/orders/${code}/returns`, { type: "REFUND", reason: "MAL_ESTADO", description: "El keke llegó aplastado y frío", items: [{ orderItemId: kekeItem.id, quantity: 1 }] }, token),
    201,
    "Solicitud de devolución por mal estado",
  );
  const resolved = await expectStatus(
    call("PATCH", `/admin/returns/${ret.return.code}`, { status: "APPROVED", resolution: "Se reembolsa el keke al mismo medio de pago" }, adminH),
    200,
    "Devolución aprobada",
  );
  check(resolved.return.refund === 5, "Reembolso simulado de S/ 5.00", resolved.return);
  const afterRefund = await expectStatus(call("GET", `/orders/${code}`, undefined, token), 200, "Pedido tras el reembolso");
  check(afterRefund.order.payment.status === "PARTIALLY_REFUNDED", "Pago parcialmente reembolsado");

  // ── Cliente registrado: envío nacional con Yape y factura
  const reg = await expectStatus(
    call("POST", "/auth/register", { ...customer("b"), password: "Pausa2026", acceptPrivacy: true }),
    201,
    "Registro de cliente",
  );
  check(reg.user.marketingConsent === false, "El consentimiento de publicidad no viene marcado por defecto");
  const userH = { Authorization: `Bearer ${reg.token}` };
  await expectStatus(call("POST", "/auth/register", { ...customer("b"), password: "Pausa2026", acceptPrivacy: true }), 400, "Correo duplicado");
  await expectStatus(call("POST", "/auth/register", { ...customer("c"), password: "Pausa2026" }), 400, "Registro sin aceptar privacidad");
  const cart2 = await newCart(
    [
      { variantId: classic.id, quantity: 2 },
      { variantId: gourmet.id, quantity: 1 },
    ],
    userH,
  );
  await expectStatus(call("GET", `/cart/${cart2}`), 403, "Carrito de otra cuenta protegido");
  const order2 = await expectStatus(
    call(
      "POST",
      "/orders",
      {
        cartId: cart2,
        customer: customer("b"),
        shippingMethod: "NATIONAL",
        address: limaAddress,
        paymentMethod: "YAPE",
        receiptType: "FACTURA",
        ruc: "20123456789",
        businessName: "Empresa de Prueba S.A.C.",
        source: "INSTAGRAM",
        acceptTerms: true,
        marketingConsent: true,
      },
      userH,
    ),
    201,
    "Checkout envío nacional con factura",
  );
  const code2 = order2.order.code as string;
  check(order2.order.summary.shipping === 12, "Envío nacional S/ 12.00 (subtotal 87 < 100)", order2.order.summary);
  const badYape = await expectStatus(
    call("POST", `/orders/${code2}/payments`, { method: "YAPE", phone: "987654321", approvalCode: "000000" }, userH),
    402,
    "Yape rechazado",
  );
  check(badYape.order.status === "PENDING_PAYMENT", "Tras el rechazo se puede reintentar");
  const yape = await expectStatus(
    call("POST", `/orders/${code2}/payments`, { method: "YAPE", phone: "987654321", approvalCode: "482913" }, userH),
    201,
    "Yape aprobado",
  );
  check(/^F001-\d{8}$/.test(yape.order.receipt.number), `Factura emitida ${yape.order.receipt.number}`);
  await expectStatus(call("PATCH", `/admin/orders/${code2}/status`, { status: "PREPARING" }, adminH), 200, "Envío nacional → preparación");
  await expectStatus(call("PATCH", `/admin/orders/${code2}/status`, { status: "SHIPPED" }, adminH), 400, "Envío exige agencia y guía");
  await expectStatus(
    call("PATCH", `/admin/orders/${code2}/status`, { status: "SHIPPED", carrier: "Olva Courier", trackingNumber: "OLV-123456" }, adminH),
    200,
    "Pedido enviado por agencia",
  );
  const myOrders = await expectStatus(call("GET", "/me/orders", undefined, userH), 200, "Historial de pedidos del cliente");
  check(myOrders.orders.some((o: Json) => o.code === code2), "El pedido aparece en Mis pedidos");

  // ── Contra entrega y cancelación (devuelve stock)
  const classicBefore = (await variantOf("cafe-apu-classic")).stock as number;
  const cart3 = await newCart([
    { variantId: keke.id, quantity: 2 },
    { variantId: classic.id, quantity: 1 },
    { variantId: capu16.id, quantity: 1 },
  ]);
  const order3 = await expectStatus(
    call("POST", "/orders", { cartId: cart3, customer: customer("c"), shippingMethod: "DELIVERY_LOCAL", address: jaenAddress, paymentMethod: "CASH_ON_DELIVERY", acceptTerms: true }),
    201,
    "Checkout contra entrega",
  );
  check(order3.order.status === "CONFIRMED", "Contra entrega se confirma sin pago previo");
  await expectStatus(
    call("POST", "/orders", { cartId: cart3, customer: customer("c"), shippingMethod: "NATIONAL", address: limaAddress, paymentMethod: "CASH_ON_DELIVERY", acceptTerms: true }),
    400,
    "Contra entrega no disponible en envío nacional",
  );
  check((await variantOf("cafe-apu-classic")).stock === classicBefore - 1, "Stock reservado por el pedido contra entrega");
  await expectStatus(
    call("POST", `/orders/${order3.order.code}/cancel`, { reason: "Me equivoqué de dirección" }, { "X-Order-Token": order3.orderToken }),
    200,
    "Cliente cancela su pedido",
  );
  check((await variantOf("cafe-apu-classic")).stock === classicBefore, "La cancelación devolvió el stock");

  // ── Sin sobreventa: dos clientes por la última unidad
  const cheese = await variantOf("cheesecake-maracuya");
  await expectStatus(call("POST", `/admin/variants/${cheese.id}/stock`, { type: "ADJUSTMENT", setTo: 1, reason: "Prueba de concurrencia" }, adminH), 200, "Dejar 1 cheesecake");
  const [ca, cb] = [await newCart([{ variantId: cheese.id, quantity: 1 }]), await newCart([{ variantId: cheese.id, quantity: 1 }])];
  const race = await Promise.all(
    [ca, cb].map((c, i) =>
      call("POST", "/orders", { cartId: c, customer: customer(`r${i}`), shippingMethod: "PICKUP", paymentMethod: "PAY_AT_STORE", acceptTerms: true }),
    ),
  );
  const statuses = race.map((r) => r.status).sort();
  check(statuses[0] === 201 && statuses[1] === 409, `Compra simultánea: una gana, otra recibe agotado (${statuses.join(", ")})`, race.map((r) => r.data));
  await expectStatus(call("POST", "/admin/inventory/daily-reset", {}, adminH), 200, "Reposición diaria de postres");

  // ── Datos personales
  await expectStatus(call("PATCH", "/me/consents", { marketingConsent: false }, userH), 200, "Revocar consentimiento de publicidad");
  const exp = await expectStatus(call("GET", "/me/data-export", undefined, userH), 200, "Descarga de datos personales");
  check(!JSON.stringify(exp).includes("passwordHash"), "La exportación no incluye la contraseña");

  // ── Libro de Reclamaciones y B2B
  const lr = await expectStatus(
    call("POST", "/complaints", {
      type: "RECLAMO",
      consumerName: "Cliente Prueba",
      docType: "DNI",
      docNumber: "12345678",
      email: customer("a").email,
      phone: "987654321",
      address: "Jr. San Martín 123, Jaén",
      goodType: "PRODUCTO",
      goodDescription: "Keke de café",
      amount: 5,
      orderCode: code,
      detail: "El producto llegó en mal estado y frío al domicilio.",
      consumerRequest: "Solicito la devolución del importe.",
      acceptTerms: true,
    }),
    201,
    "Registro en el Libro de Reclamaciones",
  );
  check(/^LR-\d{4}-\d{6}$/.test(lr.complaint.code), `Hoja de reclamación ${lr.complaint.code}`);
  await expectStatus(
    call("PATCH", `/admin/complaints/${lr.complaint.code}`, { status: "ANSWERED", response: "Se reembolsó el importe el mismo día." }, adminH),
    200,
    "Respuesta al reclamo",
  );
  const quote = await expectStatus(
    call("POST", "/corporate-quotes", {
      companyName: "Municipalidad de Prueba",
      ruc: "20123456789",
      contactName: "Responsable de Logística",
      email: `compras.${uid}@apu-demo.test`,
      phone: "976543210",
      requestType: "COFFEE_BREAK",
      items: [{ description: "Coffee break para 40 personas", quantity: 40 }],
      eventDate: new Date(Date.now() + 10 * 86400000).toISOString(),
    }),
    201,
    "Solicitud de cotización B2B",
  );
  await expectStatus(
    call("PATCH", `/admin/quotes/${quote.quote.code}`, { status: "QUOTED", quotedAmount: 720 }, adminH),
    200,
    "Cotización enviada",
  );

  // ── Panel
  const dash = await expectStatus(call("GET", "/admin/dashboard", undefined, adminH), 200, "Panel de métricas");
  check(dash.sales.paidOrders >= 2, "El panel registra ventas pagadas", dash.sales);
  check(dash.attribution.byCoupon.some((c: Json) => c.code === "APUINFLUYE"), "Atribución por cupón (APUINFLUYE)");
  await expectStatus(call("GET", "/admin/dashboard", undefined, userH), 403, "Un cliente no accede al panel");

  console.log(`\n${passed} verificaciones correctas ✔\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
