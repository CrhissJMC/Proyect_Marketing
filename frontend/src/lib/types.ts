export type Line = "CAFETERIA" | "EMPACADO";
export type ShippingMethod = "PICKUP" | "DELIVERY_LOCAL" | "NATIONAL";
export type PaymentMethod = "CARD" | "YAPE" | "PLIN" | "CASH_ON_DELIVERY" | "PAY_AT_STORE";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface Variant {
  id: string;
  sku: string;
  name: string;
  price: number;
  priceCents: number;
  available: boolean;
  stock: number | null;
  availabilityLabel: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  line: Line;
  perishable: boolean;
  imageUrl: string | null;
  tags: string[];
  attributes: Record<string, string | string[]> | null;
  isFeatured: boolean;
  category?: { slug: string; name: string };
  priceFrom: number | null;
  available: boolean;
  variants: Variant[];
  rating?: { average: number | null; count: number };
}

export interface Category {
  slug: string;
  name: string;
  description: string | null;
  line: Line;
  productCount: number;
}

export interface CartItem {
  variantId: string;
  sku: string;
  productSlug: string;
  productName: string;
  variantName: string;
  line: Line;
  perishable: boolean;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
  availabilityLabel: string;
}

export interface ShippingOption {
  method: ShippingMethod;
  label: string;
  estimatedTime: string;
  cost: number;
  costCents: number;
  freeShippingApplied: boolean;
  available: boolean;
  problems: string[];
  paymentMethods: PaymentMethod[];
}

export interface CartView {
  cartId: string;
  items: CartItem[];
  summary: {
    itemCount: number;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    currency: string;
    taxNote: string;
  };
  coupon: { code: string; description: string; discount: number } | null;
  couponError: string | null;
  shipping: ShippingOption | null;
  shippingOptions: ShippingOption[];
  warnings: string[];
}

export interface Address {
  recipient: string;
  phone: string;
  line1: string;
  reference?: string;
  district: string;
  province: string;
  department: string;
}

export interface PaymentAttempt {
  id: string;
  method: PaymentMethod;
  methodLabel: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "REFUNDED" | "CANCELLED";
  amount: number;
  reference: string;
  cardBrand: string | null;
  cardLast4: string | null;
  walletPhone: string | null;
  failureMessage: string | null;
  createdAt: string;
}

export interface Order {
  code: string;
  status: OrderStatus;
  statusLabel: string;
  nextStatuses: OrderStatus[];
  customer: { name: string; email: string; phone: string; docType: string; docNumber: string };
  shipping: {
    method: ShippingMethod;
    label: string;
    estimatedTime: string;
    address: Address | null;
    carrier: string | null;
    trackingNumber: string | null;
  };
  payment: {
    method: PaymentMethod;
    methodLabel: string;
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
    expiresAt: string | null;
    attempts: PaymentAttempt[];
  };
  receipt: { type: "BOLETA" | "FACTURA"; number: string | null; businessName: string | null };
  items: {
    id: string;
    sku: string;
    productName: string;
    variantName: string;
    line: Line;
    perishable: boolean;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  summary: { subtotal: number; discount: number; shipping: number; total: number; refunded: number; couponCode: string | null };
  notes: string | null;
  timeline: { status: OrderStatus; label: string; note: string | null; at: string }[];
  createdAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface NextStep {
  type: "PAY_ONLINE" | "NONE";
  message: string;
  expiresAt?: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  docType: string | null;
  docNumber: string | null;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  marketingConsent: boolean;
  createdAt: string;
}

export interface Promotion {
  code: string;
  description: string;
  type: string;
  product: { slug: string; name: string } | null;
  schedule: string | null;
  minSubtotal: number | null;
  requiresLogin: boolean;
}
