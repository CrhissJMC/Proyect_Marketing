export type ArtKind = "cup" | "mug" | "frappe" | "bag" | "cake" | "empanada" | "kit";

export interface Art {
  kind: ArtKind;
  tint: string;
  label?: string;
  labelBg?: string;
}

const TINTS = ["#F3D9C6", "#EADBC8", "#F6E7D8", "#E9DCCF", "#F1E3D3", "#EFE4D6", "#F5EFE6"];

const BY_SLUG: Record<string, Omit<Art, "tint"> & { tint?: string }> = {
  capuchino: { kind: "cup", tint: "#F3D9C6" },
  "desayuno-apu": { kind: "cup" },
  "frappe-cafe": { kind: "frappe", tint: "#EADBC8" },
  "frappe-moca": { kind: "frappe" },
  "cold-brew": { kind: "frappe" },
  "jugo-natural": { kind: "frappe" },
  "cafe-apu-classic": { kind: "bag", label: "CLASSIC", labelBg: "#5C3A24", tint: "#F5EFE6" },
  "cafe-apu-espresso": { kind: "bag", label: "ESPRESSO", labelBg: "#141110", tint: "#EFE4D6" },
  "cafe-apu-gourmet": { kind: "bag", label: "GOURMET", labelBg: "#B84E17", tint: "#F3D9C6" },
  "kit-regalo-apu": { kind: "kit", tint: "#EADBC8" },
  "taza-apu": { kind: "mug" },
  empanada: { kind: "empanada" },
  "sandwich-pollo": { kind: "empanada" },
  espresso: { kind: "mug" },
  americano: { kind: "mug" },
  latte: { kind: "mug" },
  mocaccino: { kind: "mug" },
  "cafe-pasado": { kind: "mug" },
  "chocolate-caliente": { kind: "mug" },
  infusion: { kind: "mug" },
  affogato: { kind: "frappe" },
  "keke-de-cafe": { kind: "cake" },
  "flan-de-cafe": { kind: "cake" },
  "torta-de-chocolate": { kind: "cake", tint: "#F1E3D3" },
  "cheesecake-maracuya": { kind: "cake" },
  alfajor: { kind: "cake" },
};

const BY_CATEGORY: Record<string, ArtKind> = {
  "cafes-calientes": "mug",
  "cafes-frios": "frappe",
  "sin-cafe": "mug",
  postres: "cake",
  salados: "empanada",
  "cafe-empacado": "bag",
  accesorios: "mug",
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

const SKU_PREFIX: Record<string, string> = {
  ESP: "espresso", AME: "americano", CAP: "capuchino", LAT: "latte", MOC: "mocaccino", PAS: "cafe-pasado",
  FRA: "frappe-cafe", FRM: "frappe-moca", CBR: "cold-brew", AFF: "affogato", CHO: "chocolate-caliente",
  INF: "infusion", JUG: "jugo-natural", KEK: "keke-de-cafe", FLA: "flan-de-cafe", TCH: "torta-de-chocolate",
  CHE: "cheesecake-maracuya", ALF: "alfajor", SPO: "sandwich-pollo", EMP: "empanada", DES: "desayuno-apu",
  "APU-CLA": "cafe-apu-classic", "APU-ESP": "cafe-apu-espresso", "APU-GOU": "cafe-apu-gourmet", "ACC-TAZ": "taza-apu", KIT: "kit-regalo-apu",
};

/** Ilustración a partir del SKU (los pedidos guardan SKU, no el slug). */
export function slugForSku(sku: string) {
  const key = Object.keys(SKU_PREFIX).sort((a, b) => b.length - a.length).find((k) => sku.startsWith(k));
  return key ? SKU_PREFIX[key] : sku.toLowerCase();
}

export function artForSku(sku: string): Art {
  return artFor(slugForSku(sku));
}

/** Ilustración provisional del producto (hasta contar con fotografías reales). */
export function artFor(slug: string, categorySlug?: string): Art {
  const base = BY_SLUG[slug];
  const tint = base?.tint ?? TINTS[hash(slug) % TINTS.length];
  if (base) return { ...base, tint };
  return { kind: BY_CATEGORY[categorySlug ?? ""] ?? "mug", tint };
}
