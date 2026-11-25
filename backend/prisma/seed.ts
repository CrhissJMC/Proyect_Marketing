/**
 * Datos iniciales de la tienda (idempotente: se puede ejecutar varias veces).
 * PRECIOS REFERENCIALES: el café empacado toma como referencia precios publicados
 * por tiendas en línea; las bebidas y postres se estimaron según un ticket promedio de S/ 16.
 */
import { PrismaClient, type ProductLine, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { slug: "cafes-calientes", name: "Cafés calientes", line: "CAFETERIA", sortOrder: 1, description: "Preparados al momento con café APU de Jaén." },
  { slug: "cafes-frios", name: "Cafés fríos", line: "CAFETERIA", sortOrder: 2, description: "Frappés y bebidas heladas a base de café." },
  { slug: "sin-cafe", name: "Bebidas sin café", line: "CAFETERIA", sortOrder: 3, description: "Chocolates, infusiones y jugos." },
  { slug: "postres", name: "Postres y tortas", line: "CAFETERIA", sortOrder: 4, description: "Producción del día. Stock limitado." },
  { slug: "salados", name: "Salados y desayunos", line: "CAFETERIA", sortOrder: 5, description: "Para acompañar tu pausa." },
  { slug: "cafe-empacado", name: "Café APU empacado", line: "EMPACADO", sortOrder: 6, description: "Café orgánico de Jaén y San Ignacio con envío a todo el Perú." },
  { slug: "accesorios", name: "Accesorios y regalos", line: "EMPACADO", sortOrder: 7, description: "Para disfrutar APU en casa." },
] as const;

type V = { sku: string; name: string; price: number; trackStock?: boolean; stock?: number; dailyStock?: number; lowStockThreshold?: number };
type P = {
  slug: string;
  name: string;
  category: string;
  line: ProductLine;
  perishable: boolean;
  shortDescription: string;
  description: string;
  tags: string[];
  featured?: boolean;
  attributes?: Prisma.InputJsonValue;
  variants: V[];
};

const drink = (sku: string, name: string, price: number): V => ({ sku, name, price, trackStock: false });
const dessert = (sku: string, name: string, price: number, daily: number): V => ({
  sku, name, price, trackStock: true, stock: daily, dailyStock: daily, lowStockThreshold: 3,
});

const products: P[] = [
  // ── Cafés calientes
  {
    slug: "espresso", name: "Espresso", category: "cafes-calientes", line: "CAFETERIA", perishable: true,
    shortDescription: "Intenso y aromático, extraído al momento.",
    description: "Shot de café APU de Jaén con crema densa y notas a frutos secos.",
    tags: ["cafe", "espresso", "caliente"],
    variants: [drink("ESP-SIM", "Simple", 6), drink("ESP-DOB", "Doble", 8)],
  },
  {
    slug: "americano", name: "Americano", category: "cafes-calientes", line: "CAFETERIA", perishable: true,
    shortDescription: "Espresso alargado con agua caliente.",
    description: "Suave y equilibrado, ideal para acompañar el desayuno.",
    tags: ["cafe", "americano", "caliente"],
    variants: [drink("AME-12", "12 oz", 7), drink("AME-16", "16 oz", 9)],
  },
  {
    slug: "capuchino", name: "Capuchino APU", category: "cafes-calientes", line: "CAFETERIA", perishable: true, featured: true,
    shortDescription: "Nuestro clásico: espresso, leche vaporizada y espuma.",
    description: "El protagonista de «Tu pausa tiene sabor a APU». Espresso de café de Jaén con leche cremosa y arte latte.",
    tags: ["cafe", "capuchino", "caliente", "favorito"],
    variants: [drink("CAP-12", "12 oz", 9), drink("CAP-16", "16 oz", 11)],
  },
  {
    slug: "latte", name: "Café latte", category: "cafes-calientes", line: "CAFETERIA", perishable: true,
    shortDescription: "Más leche, más suave.",
    description: "Espresso con abundante leche vaporizada y una fina capa de espuma.",
    tags: ["cafe", "latte", "caliente"],
    variants: [drink("LAT-12", "12 oz", 10), drink("LAT-16", "16 oz", 12)],
  },
  {
    slug: "mocaccino", name: "Mocaccino", category: "cafes-calientes", line: "CAFETERIA", perishable: true,
    shortDescription: "Café, chocolate y leche.",
    description: "Espresso con chocolate y leche vaporizada, coronado con cacao.",
    tags: ["cafe", "chocolate", "caliente"],
    variants: [drink("MOC-12", "12 oz", 11)],
  },
  {
    slug: "cafe-pasado", name: "Café pasado APU", category: "cafes-calientes", line: "CAFETERIA", perishable: true,
    shortDescription: "Filtrado tradicional, como en casa.",
    description: "Café APU pasado en filtro de tela, al estilo de las fincas de Jaén.",
    tags: ["cafe", "filtrado", "caliente"],
    variants: [drink("PAS-TAZ", "Taza", 6)],
  },
  // ── Cafés fríos
  {
    slug: "frappe-cafe", name: "Frappé de café", category: "cafes-frios", line: "CAFETERIA", perishable: true, featured: true,
    shortDescription: "Helado, cremoso y con café de verdad.",
    description: "Café APU batido con hielo y leche, con crema batida. ¿Frappé o capuchino?",
    tags: ["cafe", "frappe", "frio", "favorito"],
    variants: [drink("FRA-16", "16 oz", 13)],
  },
  {
    slug: "frappe-moca", name: "Frappé moca", category: "cafes-frios", line: "CAFETERIA", perishable: true,
    shortDescription: "Frappé con chocolate.",
    description: "Café, chocolate y hielo batidos, con crema y sirope de chocolate.",
    tags: ["cafe", "frappe", "chocolate", "frio"],
    variants: [drink("FRM-16", "16 oz", 14)],
  },
  {
    slug: "cold-brew", name: "Cold brew", category: "cafes-frios", line: "CAFETERIA", perishable: true,
    shortDescription: "Extracción en frío por 16 horas.",
    description: "Café APU macerado en frío: suave, dulce y con poca acidez.",
    tags: ["cafe", "frio", "cold brew"],
    variants: [drink("CBR-12", "12 oz", 10)],
  },
  {
    slug: "affogato", name: "Affogato", category: "cafes-frios", line: "CAFETERIA", perishable: true,
    shortDescription: "Helado de vainilla bañado en espresso.",
    description: "Una bola de helado de vainilla con un shot de espresso caliente.",
    tags: ["cafe", "postre", "helado"],
    variants: [drink("AFF-UNI", "Unidad", 12)],
  },
  // ── Sin café
  {
    slug: "chocolate-caliente", name: "Chocolate caliente", category: "sin-cafe", line: "CAFETERIA", perishable: true,
    shortDescription: "Cacao espeso y cremoso.",
    description: "Chocolate de taza preparado con leche.",
    tags: ["chocolate", "caliente", "sin cafe"],
    variants: [drink("CHO-12", "12 oz", 9)],
  },
  {
    slug: "infusion", name: "Infusión", category: "sin-cafe", line: "CAFETERIA", perishable: true,
    shortDescription: "Manzanilla, anís o hierba luisa.",
    description: "Infusiones naturales para una pausa ligera.",
    tags: ["infusion", "caliente", "sin cafe"],
    variants: [drink("INF-TAZ", "Taza", 5)],
  },
  {
    slug: "jugo-natural", name: "Jugo natural", category: "sin-cafe", line: "CAFETERIA", perishable: true,
    shortDescription: "Fruta de estación.",
    description: "Jugo de papaya, piña o naranja según disponibilidad.",
    tags: ["jugo", "frio", "sin cafe"],
    variants: [drink("JUG-16", "16 oz", 9)],
  },
  // ── Postres (stock diario)
  {
    slug: "keke-de-cafe", name: "Keke de café", category: "postres", line: "CAFETERIA", perishable: true,
    shortDescription: "Esponjoso, con café APU.",
    description: "Tajada de keke casero preparado con café de Jaén.",
    tags: ["postre", "keke", "cafe"],
    variants: [dessert("KEK-TAJ", "Tajada", 5, 20)],
  },
  {
    slug: "flan-de-cafe", name: "Flan de café", category: "postres", line: "CAFETERIA", perishable: true,
    shortDescription: "Cremoso, con caramelo.",
    description: "Flan tradicional con un toque de café APU.",
    tags: ["postre", "flan", "cafe"],
    variants: [dessert("FLA-POR", "Porción", 7, 12)],
  },
  {
    slug: "torta-de-chocolate", name: "Torta de chocolate", category: "postres", line: "CAFETERIA", perishable: true, featured: true,
    shortDescription: "Húmeda y con fudge.",
    description: "Tajada de torta de chocolate con cobertura de fudge.",
    tags: ["postre", "torta", "chocolate"],
    variants: [dessert("TCH-TAJ", "Tajada", 10, 10)],
  },
  {
    slug: "cheesecake-maracuya", name: "Cheesecake de maracuyá", category: "postres", line: "CAFETERIA", perishable: true,
    shortDescription: "Fresco y cítrico.",
    description: "Cheesecake horneado con coulis de maracuyá.",
    tags: ["postre", "cheesecake", "maracuya"],
    variants: [dessert("CHE-TAJ", "Tajada", 11, 8)],
  },
  {
    slug: "alfajor", name: "Alfajor de manjar", category: "postres", line: "CAFETERIA", perishable: true,
    shortDescription: "Suave, relleno de manjar blanco.",
    description: "Alfajor artesanal espolvoreado con azúcar en polvo.",
    tags: ["postre", "alfajor"],
    variants: [dessert("ALF-UNI", "Unidad", 3, 30)],
  },
  // ── Salados
  {
    slug: "sandwich-pollo", name: "Sándwich de pollo", category: "salados", line: "CAFETERIA", perishable: true,
    shortDescription: "Pollo deshilachado, lechuga y tomate.",
    description: "En pan ciabatta, con mayonesa de la casa.",
    tags: ["salado", "sandwich"],
    variants: [dessert("SPO-UNI", "Unidad", 12, 15)],
  },
  {
    slug: "empanada", name: "Empanada de carne", category: "salados", line: "CAFETERIA", perishable: true,
    shortDescription: "Horneada, rellena de carne.",
    description: "Empanada de masa hojaldrada con relleno de carne, huevo y aceituna.",
    tags: ["salado", "empanada"],
    variants: [dessert("EMP-UNI", "Unidad", 6, 20)],
  },
  {
    slug: "desayuno-apu", name: "Desayuno APU", category: "salados", line: "CAFETERIA", perishable: true, featured: true,
    shortDescription: "Café o capuchino + sándwich + jugo.",
    description: "Combo para empezar el día: capuchino 12 oz o americano, sándwich de pollo y jugo natural.",
    tags: ["desayuno", "combo"],
    variants: [dessert("DES-COM", "Combo", 18, 15)],
  },
  // ── Café empacado (información técnica del APU Classic: catálogo de CENFROCAFE)
  {
    slug: "cafe-apu-classic", name: "Café APU Classic", category: "cafe-empacado", line: "EMPACADO", perishable: false, featured: true,
    shortDescription: "Orgánico y de Comercio Justo, con notas frutales.",
    description:
      "Café de especialidad de productores de Jaén y San Ignacio. Cereza seleccionada y lavada, fermentación prolongada a baja temperatura y secado bajo sombra. Empacado en bolsas de alta densidad.",
    tags: ["cafe", "empacado", "organico", "comercio justo"],
    attributes: {
      variedades: ["Caturra", "Bourbon", "Typica"],
      origen: "Jaén y San Ignacio, Cajamarca",
      altitud: "Más de 1 700 m s. n. m.",
      notas: "Frutales",
      puntajeEnTaza: "84-85",
      certificaciones: ["Orgánico", "Comercio Justo"],
      productor: "Cooperativa CENFROCAFE",
    },
    variants: [
      { sku: "APU-CLA-250M", name: "250 g molido", price: 27.5, stock: 40, lowStockThreshold: 8 },
      { sku: "APU-CLA-250G", name: "250 g en grano", price: 27.5, stock: 30, lowStockThreshold: 8 },
    ],
  },
  {
    slug: "cafe-apu-espresso", name: "Café APU Espresso", category: "cafe-empacado", line: "EMPACADO", perishable: false,
    shortDescription: "Tueste pensado para espresso y moka.",
    description: "Café orgánico de Jaén y San Ignacio con perfil intenso, ideal para cafetera espresso o moka italiana.",
    tags: ["cafe", "empacado", "organico", "espresso"],
    attributes: { origen: "Jaén y San Ignacio, Cajamarca", certificaciones: ["Orgánico"], productor: "Cooperativa CENFROCAFE" },
    variants: [{ sku: "APU-ESP-250M", name: "250 g molido", price: 27.5, stock: 35, lowStockThreshold: 8 }],
  },
  {
    slug: "cafe-apu-gourmet", name: "Café APU Gourmet", category: "cafe-empacado", line: "EMPACADO", perishable: false, featured: true,
    shortDescription: "La selección especial de APU.",
    description: "Café de especialidad seleccionado de productores asociados de Jaén y San Ignacio.",
    tags: ["cafe", "empacado", "gourmet"],
    attributes: { origen: "Jaén y San Ignacio, Cajamarca", productor: "Cooperativa CENFROCAFE" },
    variants: [
      { sku: "APU-GOU-250G", name: "250 g en grano", price: 32, stock: 25, lowStockThreshold: 6 },
      { sku: "APU-GOU-250M", name: "250 g molido", price: 32, stock: 25, lowStockThreshold: 6 },
    ],
  },
  // ── Accesorios
  {
    slug: "taza-apu", name: "Taza APU", category: "accesorios", line: "EMPACADO", perishable: false,
    shortDescription: "Taza de cerámica de 350 ml.",
    description: "Taza con el lema «Tu pausa tiene sabor a APU».",
    tags: ["taza", "regalo", "accesorio"],
    variants: [{ sku: "ACC-TAZ-350", name: "350 ml", price: 25, stock: 20, lowStockThreshold: 5 }],
  },
  {
    slug: "kit-regalo-apu", name: "Kit regalo APU", category: "accesorios", line: "EMPACADO", perishable: false,
    shortDescription: "APU Classic 250 g + taza APU.",
    description: "Caja de regalo con un café APU Classic de 250 g y una taza APU.",
    tags: ["regalo", "kit", "cafe"],
    variants: [{ sku: "KIT-CLA-TAZ", name: "Kit", price: 49, stock: 15, lowStockThreshold: 4 }],
  },
];

async function main() {
  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, line: c.line, sortOrder: c.sortOrder },
    });
    categoryIds.set(c.slug, cat.id);
  }

  for (const p of products) {
    const data = {
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      line: p.line,
      categoryId: categoryIds.get(p.category)!,
      tags: p.tags,
      attributes: p.attributes,
      perishable: p.perishable,
      isFeatured: p.featured ?? false,
    };
    const product = await prisma.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });
    for (const [i, v] of p.variants.entries()) {
      const existing = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
      const base = {
        name: v.name,
        priceCents: Math.round(v.price * 100),
        trackStock: v.trackStock ?? true,
        dailyStock: v.dailyStock ?? null,
        lowStockThreshold: v.lowStockThreshold ?? 5,
        sortOrder: i,
      };
      if (existing) {
        // No se sobrescribe el stock existente al volver a ejecutar el seed.
        await prisma.productVariant.update({ where: { id: existing.id }, data: base });
      } else {
        const created = await prisma.productVariant.create({
          data: { ...base, sku: v.sku, productId: product.id, stock: v.stock ?? 0 },
        });
        if (created.trackStock && created.stock > 0) {
          await prisma.inventoryMovement.create({
            data: { variantId: created.id, type: "INITIAL", quantity: created.stock, stockAfter: created.stock, reason: "Stock inicial (seed)" },
          });
        }
      }
    }
  }

  const capuchino = await prisma.product.findUniqueOrThrow({ where: { slug: "capuchino" } });
  const coupons: Prisma.CouponUncheckedCreateInput[] = [
    {
      code: "PAUSAAPU",
      description: "2x1 en capuchinos por la tarde (3:00 p. m. a 7:00 p. m.)",
      type: "BUY_X_GET_Y",
      buyQty: 1,
      getQty: 1,
      productId: capuchino.id,
      hourFrom: 15,
      hourTo: 19,
      channel: "MARKETING_CONTENIDOS",
    },
    {
      code: "APUINFLUYE",
      description: "10 % de descuento por la colaboración con creadores de contenido",
      type: "PERCENT",
      value: 10,
      minSubtotalCents: 2000,
      perCustomerLimit: 1,
      channel: "INFLUENCER",
    },
    {
      code: "MIRACHA300",
      description: "#MiMomentoAPU: un capuchino gratis por tu racha de más de 300 días",
      type: "FREE_ITEM",
      productId: capuchino.id,
      perCustomerLimit: 1,
      requiresLogin: true,
      maxUses: 200,
      channel: "EMAIL_MARKETING",
    },
  ];
  for (const c of coupons) {
    const { code, ...rest } = c;
    await prisma.coupon.upsert({ where: { code }, create: c, update: rest });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const exists = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
    if (!exists) {
      await prisma.user.create({
        data: {
          email: adminEmail.toLowerCase(),
          passwordHash: await bcrypt.hash(adminPassword, 10),
          fullName: "Administración APU",
          role: "ADMIN",
          privacyAcceptedAt: new Date(),
          privacyPolicyVersion: "2026-11",
        },
      });
      console.log(`Usuario administrador creado: ${adminEmail}`);
    }
  }

  const [p, v, c] = await Promise.all([prisma.product.count(), prisma.productVariant.count(), prisma.coupon.count()]);
  console.log(`Seed listo: ${p} productos, ${v} variantes, ${c} cupones.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
