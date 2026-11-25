const BASE = "/api";
const TOKEN_KEY = "apu.token";
const ORDER_TOKENS_KEY = "apu.orderTokens";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public body?: unknown,
  ) {
    super(message);
  }
  /** Errores de validación por campo: { "customer.email": "Correo inválido" } */
  get fieldErrors(): Record<string, string> {
    if (this.code !== "VALIDATION_ERROR" || !Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { field: string; message: string }[]).map((d) => [d.field, d.message]),
    );
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)),
};

/** Token privado de cada pedido de invitado (permite consultarlo y pagarlo). */
export const orderTokens = {
  all(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(ORDER_TOKENS_KEY) ?? "{}");
    } catch {
      return {};
    }
  },
  get(code: string) {
    return this.all()[code];
  },
  set(code: string, token: string) {
    localStorage.setItem(ORDER_TOKENS_KEY, JSON.stringify({ ...this.all(), [code]: token }));
  },
};

interface Options {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Devuelve el cuerpo aunque el estado sea de error de negocio (p. ej. 402 pago rechazado). */
  acceptStatus?: number[];
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "No pudimos conectar con la tienda. Revisa tu conexión.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (res.ok || opts.acceptStatus?.includes(res.status)) return data as T;

  const err = (data as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
  if (res.status === 401 && token && !path.startsWith("/auth/login")) tokenStore.set(null);
  throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? "Ocurrió un error inesperado", err?.details, data);
}

export const orderHeaders = (code: string): Record<string, string> => {
  const t = orderTokens.get(code);
  return t ? { "X-Order-Token": t } : {};
};
