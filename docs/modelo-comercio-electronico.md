# Modelo de comercio electrónico — Cafetería APU

Decisiones de negocio que implementa la tienda virtual. Todos los valores son **referenciales** (prototipo académico) y se configuran en [`backend/src/config/store.ts`](../backend/src/config/store.ts).

## 1. Contexto

Cafetería APU (Pasaje Bracamoros N.° 137, Jaén) es una marca de la cooperativa CENFROCAFE, que reúne a más de 2 800 familias productoras de Jaén, San Ignacio y Bagua. La tienda virtual continúa el trabajo de las unidades anteriores del proyecto integrador:

| Unidad | Hallazgo | Respuesta de la tienda |
|---|---|---|
| I. Análisis del entorno | El FODA identifica como oportunidad el «comercio y pedidos mediante canales digitales». | Canal de venta propio. |
| II. Plan integrado | El SEM y Google Search Console se postergaron por falta de una página de destino. | La tienda es esa página de destino. |
| III. Plan de medición | Las visitas al perfil subieron 44 %, pero solo el 9 % terminó en una acción. | Botón de compra directo en lugar de solo «Cómo llegar». |

## 2. Modelo: B2C con canal B2B complementario

- **B2C (principal):** venta directa al consumidor final de Jaén (18 a 35 años, estudiantes, trabajadores, familias, amantes del café y turistas).
- **B2B (complementario):** cotizaciones para empresas e instituciones: coffee break, café APU por volumen, regalos corporativos y abastecimiento de oficinas. Se emite factura con RUC.

## 3. Catálogo en dos líneas

| Línea | Productos | Cobertura | Inventario |
|---|---|---|---|
| **Cafetería** (perecible) | Cafés calientes y fríos, bebidas sin café, postres, salados | Solo Jaén (recojo o delivery) | Las bebidas se preparan al momento (sin stock). Los postres y salados tienen **stock diario** que se repone a las 6:00 a. m. |
| **Empacado** (no perecible) | Café APU Classic, Espresso y Gourmet de 250 g, accesorios y kits | Todo el Perú | Stock con alertas de nivel bajo |

## 4. Gestión de pedidos

Estados: **Pendiente de pago → Confirmado → En preparación → Listo para recoger / En camino / Enviado por agencia → Entregado** (o **Cancelado**).

- Cada cambio de estado queda en el historial del pedido, con fecha y responsable.
- El stock se **reserva al confirmar el checkout** con una actualización atómica, así que dos clientes no pueden comprar la última unidad a la vez.
- Los pedidos con pago en línea tienen **15 minutos** para pagarse. Si no, se cancelan solos y el stock se libera.
- El cliente puede cancelar mientras el pedido no esté en preparación. Si ya pagó, se le reembolsa (simulado).
- Los invitados pueden comprar sin cuenta. Reciben un token privado para consultar su pedido, y también existe un seguimiento público con código y correo.

## 5. Pagos (simulados)

| Medio | Disponible en | Funcionamiento en el simulador |
|---|---|---|
| Tarjeta de crédito o débito | Todas las entregas | Validación Luhn, vencimiento y CVV. Solo se guardan la marca y los últimos 4 dígitos |
| Yape / Plin | Todas las entregas | Celular y código de aprobación de 6 dígitos |
| Efectivo contra entrega | Delivery en Jaén | El cobro se registra al entregar |
| Pago al recoger | Recojo en tienda | El cobro se registra al entregar |

La elección de medios responde a cómo paga el comprador peruano en línea: billeteras digitales 37,6 %, débito 32,4 % y crédito 27,9 % (CAPECE, 2026). Los datos de prueba están en `GET /api/store/payment-simulator`. Los reintentos usan la cabecera `Idempotency-Key` para no cobrar dos veces. Al aprobarse el pago se emite **boleta (B001)** o **factura (F001)** con numeración correlativa.

## 6. Entrega

| Modalidad | Costo | Condiciones | Tiempo |
|---|---|---|---|
| Recojo en tienda | Gratis | — | 15 a 20 min |
| Delivery en Jaén | S/ 4.00 | Pedido mínimo de S/ 15.00; solo zona urbana de Jaén | 30 a 45 min |
| Envío nacional | S/ 12.00 (gratis desde S/ 100) | Solo productos empacados; agencia y número de guía obligatorios | 2 a 5 días hábiles |

Las bebidas y postres no se envían fuera de Jaén para conservar su calidad e inocuidad (NTS N.° 142-MINSA/2018/DIGESA).

## 7. Atención al cliente y posventa

- **Seguimiento** del pedido con línea de tiempo.
- **Devoluciones:**
  - Perecibles: se reportan dentro de las **2 horas** posteriores a la entrega, solo si el producto llegó en mal estado, equivocado o incompleto. Se repone o se reembolsa.
  - Empacados: plazo de **7 días**. Por desistimiento, el empaque debe estar cerrado; el producto cerrado vuelve al inventario.
- **Reseñas verificadas:** solo pueden opinar quienes recibieron el pedido. El personal puede moderarlas.
- **Libro de Reclamaciones virtual** (Ley N.° 29571): distingue reclamo y queja, genera una hoja numerada (LR-AAAA-NNNNNN) y fija un plazo de respuesta de 15 días hábiles, con alerta de vencimiento en el panel.
- **WhatsApp y correo de atención:** ficticios en el prototipo.

## 8. Seguridad

- Contraseñas con hash bcrypt, sesiones con JWT y roles (cliente, personal, administrador).
- Límite de intentos en el inicio de sesión, el checkout, los pagos y los formularios públicos.
- Cabeceras de seguridad (Helmet), CORS restringido y validación estricta de todas las entradas (Zod).
- Nunca se almacenan el número completo de la tarjeta ni el CVV, y los logs ocultan contraseñas, tokens y datos de pago.
- Registro de auditoría de las acciones administrativas, los pagos y las solicitudes de privacidad.
- Acceso por HTTPS mediante el túnel de Cloudflare.

## 9. Protección de datos personales (Ley N.° 29733 y D.S. N.° 016-2024-JUS)

- La aceptación de la política de privacidad es obligatoria y queda registrada con su versión y fecha.
- El consentimiento para publicidad es **opcional y viene desmarcado** (D. Leg. N.° 1729), y se puede revocar en cualquier momento.
- **Derechos ARCO:**
  - Acceso: descarga de los datos en JSON.
  - Rectificación: edición del perfil.
  - Cancelación: eliminación de la cuenta con anonimización; los comprobantes se conservan por obligación tributaria.
  - Oposición: revocación del consentimiento de publicidad.
- Solo se piden los datos necesarios para el pedido y el comprobante.

## 10. Estrategias de confianza

- Aviso visible de prototipo y precios con IGV incluido, sin cobros ocultos.
- Políticas de envío, devolución y privacidad publicadas en `GET /api/store`.
- Reseñas de compradores verificados.
- Ficha técnica real del café: variedades, altitud, puntaje en taza y certificaciones orgánica y de Comercio Justo.
- Respaldo de la cooperativa CENFROCAFE y origen del café de Jaén.
- Libro de Reclamaciones visible y canales de atención claros.

## 11. Promociones conectadas al plan de marketing

| Código | Origen en el plan | Regla |
|---|---|---|
| `PAUSAAPU` | Marketing de contenidos | 2x1 en capuchinos de 3:00 p. m. a 7:00 p. m. |
| `APUINFLUYE` | Marketing de influencers | 10 % de descuento con compra mínima de S/ 20, una vez por cliente |
| `MIRACHA300` | Email marketing #MiMomentoAPU | Un capuchino gratis, requiere cuenta, una vez por cliente |

En el checkout se pregunta «¿Cómo nos conociste?». El panel (`GET /api/admin/dashboard`) muestra las ventas por canal y por cupón, el embudo carrito → pedido → pago y el ticket promedio, en continuidad con los KPI del plan de medición de la Unidad III.
