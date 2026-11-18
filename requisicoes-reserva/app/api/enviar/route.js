import { Resend } from "resend";
import { DEPARTAMENTOS, CENTROS_CUSTO, LIMITE_ANEXOS_BYTES } from "../../../lib/dados";

export const runtime = "nodejs";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const br = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const erro = (msg, status = 400) => Response.json({ erro: msg }, { status });

export async function POST(req) {
  const apiKey = process.env.RESEND_API_KEY;
  const para = (process.env.SUPRIMENTOS_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!apiKey || !para.length) return erro("O envio por e-mail ainda não foi configurado. Avise o time responsável.", 500);

  let fd;
  try { fd = await req.formData(); } catch { return erro("Não foi possível ler o formulário."); }

  let d;
  try { d = JSON.parse(fd.get("dados")); } catch { return erro("Dados inválidos."); }

  const itens = Array.isArray(d.itens) ? d.itens : [];
  if (!d.nome?.trim() || !DEPARTAMENTOS.includes(d.departamento) || !CENTROS_CUSTO.includes(d.centroCusto) ||
      !d.dataSolicitacao || !d.dataLimite || !d.justificativa?.trim() || !itens.length ||
      itens.some((i) => !i.descricao?.trim() || !(Number(i.quantidade) > 0))) {
    return erro("Preencha todos os campos obrigatórios.");
  }
  if (d.dataLimite < d.dataSolicitacao) return erro("A data limite não pode ser anterior à solicitação.");

  const arquivos = fd.getAll("arquivos").filter((f) => typeof f !== "string" && f.size > 0);
  const total = arquivos.reduce((s, f) => s + f.size, 0);
  if (total > LIMITE_ANEXOS_BYTES) return erro("Os anexos passam de 4 MB no total.");

  const anexos = await Promise.all(
    arquivos.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()) }))
  );

  const agora = new Date();
  const protocolo =
    "RC-" + agora.toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  const linhas = itens
    .map(
      (i, n) => `<tr>
        <td style="padding:12px 14px;border-bottom:1px solid #EADFCB;color:#2C6E8E;font-weight:600">${n + 1}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #EADFCB">${esc(i.descricao)}${
          i.link?.trim() ? `<br><a href="${esc(i.link.trim())}" style="color:#2C6E8E;font-size:13px">Ver referência</a>` : ""
        }</td>
        <td style="padding:12px 14px;border-bottom:1px solid #EADFCB;text-align:center;font-weight:600">${esc(i.quantidade)}</td>
      </tr>`
    )
    .join("");

  const campo = (rot, val) =>
    `<td style="padding:10px 0;vertical-align:top"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6B7A88">${rot}</div><div style="font-size:15px;color:#1B2B3A;margin-top:3px">${val}</div></td>`;

  const html = `<div style="background:#FBF8F3;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E3DACA;border-radius:18px;overflow:hidden">
    <div style="background:#0E2A43;padding:28px 30px;color:#fff">
      <div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#EADFCB">Reserva Beach Club</div>
      <div style="font-family:Georgia,serif;font-size:28px;margin-top:8px">Nova requisição de compras</div>
      <div style="margin-top:6px;color:#CFE0E8;font-size:14px">Protocolo ${protocolo}</div>
    </div>
    <div style="padding:26px 30px">
      <table width="100%" cellspacing="0" cellpadding="0"><tr>${campo("Solicitante", esc(d.nome))}${campo("Departamento", esc(d.departamento))}</tr>
      <tr>${campo("Data da solicitação", br(d.dataSolicitacao))}${campo("Entrega até", `<strong>${br(d.dataLimite)}</strong>`)}</tr>
      <tr>${campo("Centro de custos", esc(d.centroCusto))}<td></td></tr></table>
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6B7A88;margin:22px 0 8px">Itens e serviços</div>
      <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #EADFCB;border-radius:12px;font-size:14.5px;color:#1B2B3A">
        <tr style="background:#F4EEE2"><th style="padding:10px 14px;text-align:left;font-size:12px">#</th><th style="padding:10px 14px;text-align:left;font-size:12px">Descrição</th><th style="padding:10px 14px;font-size:12px">Qtd.</th></tr>
        ${linhas}
      </table>
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6B7A88;margin:22px 0 8px">Justificativa</div>
      <div style="background:#F4EEE2;border-radius:12px;padding:14px 16px;font-size:14.5px;line-height:1.55;color:#1B2B3A;white-space:pre-wrap">${esc(d.justificativa)}</div>
      <div style="margin-top:20px;font-size:13px;color:#6B7A88">${
        anexos.length ? `${anexos.length} arquivo(s) em anexo: orçamento ou cotação.` : "Nenhum orçamento ou cotação foi anexado."
      }</div>
    </div></div></div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Requisições Reserva <onboarding@resend.dev>",
    to: para,
    subject: `[${protocolo}] Requisição de compras · ${d.departamento} · ${d.nome.trim()}`,
    html,
    attachments: anexos,
  });
  if (error) {
    console.error("Resend:", error);
    return erro("Não foi possível enviar o e-mail agora. Tente novamente em instantes.", 502);
  }
  return Response.json({ protocolo });
}
