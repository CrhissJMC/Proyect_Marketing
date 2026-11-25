import { useState } from "react";
import { api } from "../../lib/api";
import { date, soles } from "../../lib/format";
import { Alert, PageLoader, Spinner, errorMessage, useAsync } from "../../components/ui";

interface Ret { code: string; orderCode: string; customerName: string; type: string; reason: string; description: string; status: string; refund: number; resolution: string | null; createdAt: string }
interface Compl { code: string; type: string; consumerName: string; goodDescription: string; detail: string; consumerRequest: string; status: string; response: string | null; dueAt: string; overdue: boolean; createdAt: string }
interface Quote { code: string; companyName: string; ruc: string; contactName: string; email: string; requestTypeLabel: string; items: { description: string; quantity: number }[]; status: string; quotedAmount: number | null; eventDate: string | null; createdAt: string }

const RET_REASON: Record<string, string> = { MAL_ESTADO: "Mal estado", PRODUCTO_EQUIVOCADO: "Producto equivocado", INCOMPLETO: "Incompleto", DANADO_EN_ENVIO: "Dañado en envío", NO_LO_QUIERO: "Desistimiento", OTRO: "Otro" };
const STATUS: Record<string, string> = { OPEN: "Abierta", APPROVED: "Aprobada", REJECTED: "Rechazada", COMPLETED: "Completada", RECEIVED: "Recibido", IN_PROGRESS: "En atención", ANSWERED: "Respondido", NEW: "Nueva", QUOTED: "Cotizada", ACCEPTED: "Aceptada" };

function useAction(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, err, run };
}

export function AdminService() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [r, c, q] = await Promise.all([
      api<{ returns: Ret[] }>("/admin/returns?pageSize=30"),
      api<{ complaints: Compl[] }>("/admin/complaints?pageSize=30"),
      api<{ quotes: Quote[] }>("/admin/quotes?pageSize=30"),
    ]);
    return { returns: r.returns, complaints: c.complaints, quotes: q.quotes };
  }, []);
  const { busy, err, run } = useAction(() => void reload());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = (k: string) => drafts[k] ?? "";
  const setDraft = (k: string, v: string) => setDrafts((d) => ({ ...d, [k]: v }));

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <Alert>{error ?? "Sin datos"}</Alert>;

  return (
    <>
      <h1 className="h2" style={{ fontSize: 34 }}>Atención al cliente y B2B</h1>
      {err && <Alert>{err}</Alert>}

      <section className="admin-card stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Solicitudes de posventa</h2>
        {data.returns.length === 0 && <span className="muted small">No hay solicitudes.</span>}
        {data.returns.map((r) => (
          <div key={r.code} className="stack" style={{ borderTop: "1px solid var(--borde-suave)", paddingTop: 12, gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <strong>{r.code} · pedido {r.orderCode} · {r.customerName}</strong>
              <span className="badge" style={{ background: r.status === "OPEN" ? "#FFF1E6" : "var(--hueso)" }}>{STATUS[r.status]}</span>
            </div>
            <span className="small">{RET_REASON[r.reason]} · solicita {r.type === "REFUND" ? "reembolso" : "reposición"} · {date(r.createdAt)}</span>
            <span className="small" style={{ color: "var(--marron)" }}>“{r.description}”</span>
            {r.resolution && <span className="small">Resolución: {r.resolution}{r.refund ? ` · reembolso ${soles(r.refund)}` : ""}</span>}
            {r.status === "OPEN" && (
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <input aria-label="Resolución" placeholder="Resolución para el cliente" value={draft(r.code)} onChange={(e) => setDraft(r.code, e.target.value)} style={{ flex: "1 1 260px", height: 40, border: "1px solid var(--borde)", borderRadius: 10, padding: "0 12px" }} />
                <button type="button" className="btn btn-dark btn-sm" disabled={busy === r.code} onClick={() => run(r.code, () => api(`/admin/returns/${r.code}`, { method: "PATCH", body: { status: "APPROVED", resolution: draft(r.code) || "Solicitud aprobada" } }))}>{busy === r.code ? <Spinner /> : "Aprobar"}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy === r.code} onClick={() => run(r.code, () => api(`/admin/returns/${r.code}`, { method: "PATCH", body: { status: "REJECTED", resolution: draft(r.code) || "No cumple la política de devoluciones" } }))}>Rechazar</button>
              </div>
            )}
            {r.status === "APPROVED" && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => run(r.code, () => api(`/admin/returns/${r.code}`, { method: "PATCH", body: { status: "COMPLETED", resolution: r.resolution ?? "Atendida" } }))}>Marcar como completada</button>
            )}
          </div>
        ))}
      </section>

      <section className="admin-card stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Libro de Reclamaciones</h2>
        {data.complaints.length === 0 && <span className="muted small">No hay reclamos.</span>}
        {data.complaints.map((c) => (
          <div key={c.code} className="stack" style={{ borderTop: "1px solid var(--borde-suave)", paddingTop: 12, gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <strong>{c.code} · {c.type === "RECLAMO" ? "Reclamo" : "Queja"} · {c.consumerName}</strong>
              <span className="badge" style={{ background: c.overdue ? "#FDECEA" : c.status === "ANSWERED" ? "#E3F1E6" : "#FFF1E6", color: c.overdue ? "#7A1E12" : undefined }}>{c.overdue ? "Vencido" : STATUS[c.status]} · límite {date(c.dueAt)}</span>
            </div>
            <span className="small">{c.goodDescription}</span>
            <span className="small" style={{ color: "var(--marron)" }}>Detalle: {c.detail}</span>
            <span className="small" style={{ color: "var(--marron)" }}>Pide: {c.consumerRequest}</span>
            {c.response ? <span className="small"><strong>Respuesta:</strong> {c.response}</span> : (
              <div className="row" style={{ gap: 8 }}>
                <input aria-label="Respuesta al consumidor" placeholder="Respuesta al consumidor (mín. 10 caracteres)" value={draft(c.code)} onChange={(e) => setDraft(c.code, e.target.value)} style={{ flex: "1 1 300px", height: 40, border: "1px solid var(--borde)", borderRadius: 10, padding: "0 12px" }} />
                <button type="button" className="btn btn-dark btn-sm" disabled={busy === c.code || draft(c.code).length < 10} onClick={() => run(c.code, () => api(`/admin/complaints/${c.code}`, { method: "PATCH", body: { status: "ANSWERED", response: draft(c.code) } }))}>{busy === c.code ? <Spinner /> : "Responder"}</button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="admin-card stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Cotizaciones B2B</h2>
        {data.quotes.length === 0 && <span className="muted small">No hay cotizaciones.</span>}
        {data.quotes.map((q) => (
          <div key={q.code} className="stack" style={{ borderTop: "1px solid var(--borde-suave)", paddingTop: 12, gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <strong>{q.code} · {q.companyName} (RUC {q.ruc})</strong>
              <span className="badge" style={{ background: q.status === "NEW" ? "#FFF1E6" : "var(--hueso)" }}>{STATUS[q.status]}{q.quotedAmount ? ` · ${soles(q.quotedAmount)}` : ""}</span>
            </div>
            <span className="small">{q.requestTypeLabel} · {q.contactName} · {q.email}{q.eventDate ? ` · evento ${date(q.eventDate)}` : ""}</span>
            <span className="small" style={{ color: "var(--marron)" }}>{q.items.map((i) => `${i.quantity}× ${i.description}`).join(" · ")}</span>
            {q.status === "NEW" && (
              <div className="row" style={{ gap: 8 }}>
                <input aria-label="Monto cotizado" type="number" min={1} placeholder="Monto S/" value={draft(q.code)} onChange={(e) => setDraft(q.code, e.target.value)} style={{ width: 140, height: 40, border: "1px solid var(--borde)", borderRadius: 10, padding: "0 12px" }} />
                <button type="button" className="btn btn-dark btn-sm" disabled={busy === q.code || !Number(draft(q.code))} onClick={() => run(q.code, () => api(`/admin/quotes/${q.code}`, { method: "PATCH", body: { status: "QUOTED", quotedAmount: Number(draft(q.code)) } }))}>{busy === q.code ? <Spinner /> : "Enviar cotización"}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(q.code, () => api(`/admin/quotes/${q.code}`, { method: "PATCH", body: { status: "REJECTED" } }))}>Rechazar</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
