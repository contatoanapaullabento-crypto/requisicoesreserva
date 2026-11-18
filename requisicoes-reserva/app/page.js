"use client";
import { useState, useMemo } from "react";
import { DEPARTAMENTOS, CENTROS_CUSTO, LIMITE_ANEXOS_BYTES } from "../lib/dados";

const hoje = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
};
const novoItem = () => ({ id: Math.random().toString(36).slice(2), descricao: "", quantidade: "", link: "" });
const fmtTam = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

export default function Page() {
  const [nome, setNome] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [dataSolicitacao, setDataSolicitacao] = useState(hoje());
  const [dataLimite, setDataLimite] = useState("");
  const [itens, setItens] = useState([novoItem()]);
  const [centroCusto, setCentroCusto] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [arquivos, setArquivos] = useState([]);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [protocolo, setProtocolo] = useState("");

  const totalBytes = useMemo(() => arquivos.reduce((s, f) => s + f.size, 0), [arquivos]);

  const setItem = (id, campo, valor) =>
    setItens((l) => l.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));

  function addArquivos(lista) {
    const novos = [...arquivos, ...Array.from(lista)];
    setArquivos(novos);
    setErros((e) => ({ ...e, arquivos: undefined }));
  }

  function validar() {
    const e = {};
    if (!nome.trim()) e.nome = "Informe seu nome.";
    if (!departamento) e.departamento = "Escolha seu departamento.";
    if (!dataSolicitacao) e.dataSolicitacao = "Informe a data da solicitação.";
    if (!dataLimite) e.dataLimite = "Informe a data limite de entrega.";
    else if (dataSolicitacao && dataLimite < dataSolicitacao) e.dataLimite = "A data limite não pode ser anterior à solicitação.";
    itens.forEach((i) => {
      const m = {};
      if (!i.descricao.trim()) m.descricao = "Descreva o item ou serviço.";
      if (!(Number(i.quantidade) > 0)) m.quantidade = "Informe a quantidade.";
      if (i.link.trim() && !/^https?:\/\/\S+\.\S+/i.test(i.link.trim())) m.link = "Use um link completo, começando com https://";
      if (Object.keys(m).length) e["item_" + i.id] = m;
    });
    if (!centroCusto) e.centroCusto = "Escolha o centro de custos.";
    if (!justificativa.trim()) e.justificativa = "Explique o motivo da compra.";
    if (totalBytes > LIMITE_ANEXOS_BYTES) e.arquivos = `Os anexos somam ${fmtTam(totalBytes)}. O limite é 4 MB no total.`;
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev) {
    ev.preventDefault();
    setErroGeral("");
    if (!validar()) {
      setTimeout(() => document.querySelector(".err, .msg")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append(
        "dados",
        JSON.stringify({
          nome, departamento, dataSolicitacao, dataLimite, centroCusto, justificativa,
          itens: itens.map(({ descricao, quantidade, link }) => ({ descricao, quantidade, link })),
        })
      );
      arquivos.forEach((f) => fd.append("arquivos", f));
      const r = await fetch("/api/enviar", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível enviar agora.");
      setProtocolo(j.protocolo);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErroGeral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setNome(""); setDepartamento(""); setDataSolicitacao(hoje()); setDataLimite("");
    setItens([novoItem()]); setCentroCusto(""); setJustificativa(""); setArquivos([]);
    setErros({}); setProtocolo("");
  }

  const cls = (k) => (erros[k] ? "err" : "");
  const Msg = ({ k }) => (erros[k] ? <div className="msg">{erros[k]}</div> : null);

  return (
    <>
      <header className="hero">
        <div className="hero-in">
          <div className="brand">Reserva Beach Club</div>
          <h1>Requisição de compras</h1>
          <p>Precisa de um item ou serviço? Preencha abaixo e o time de Suprimentos recebe a solicitação na hora.</p>
        </div>
      </header>

      <main>
        {protocolo ? (
          <div className="card done">
            <div className="check">✓</div>
            <h2>Requisição enviada</h2>
            <p className="sub">O time de Suprimentos já recebeu o seu pedido por e-mail.</p>
            <div className="proto">Protocolo {protocolo}</div>
            <div><button className="ghost" onClick={reiniciar}>Fazer nova requisição</button></div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            {erroGeral && <div className="alert">{erroGeral}</div>}

            <section className="card">
              <span className="step">01</span>
              <h2>Quem está solicitando</h2>
              <p className="sub">Para o time de Suprimentos saber a quem retornar.</p>
              <div className="grid">
                <div>
                  <label htmlFor="nome">Nome completo</label>
                  <input id="nome" className={cls("nome")} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" />
                  <Msg k="nome" />
                </div>
                <div>
                  <label htmlFor="dep">Departamento</label>
                  <select id="dep" className={cls("departamento")} value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
                    <option value="">Selecione…</option>
                    {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <Msg k="departamento" />
                </div>
                <div>
                  <label htmlFor="ds">Data da solicitação</label>
                  <input id="ds" type="date" className={cls("dataSolicitacao")} value={dataSolicitacao} onChange={(e) => setDataSolicitacao(e.target.value)} />
                  <Msg k="dataSolicitacao" />
                </div>
                <div>
                  <label htmlFor="dl">Data limite de entrega</label>
                  <input id="dl" type="date" min={dataSolicitacao} className={cls("dataLimite")} value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
                  <Msg k="dataLimite" />
                </div>
              </div>
            </section>

            <section className="card">
              <span className="step">02</span>
              <h2>O que você precisa</h2>
              <p className="sub">Adicione quantos itens ou serviços forem necessários. Se já souber o modelo exato, cole um link de referência.</p>

              {itens.map((it, idx) => {
                const m = erros["item_" + it.id] || {};
                return (
                  <div className="item" key={it.id}>
                    <div className="item-head">
                      <span className="item-n">Item {idx + 1}</span>
                      {itens.length > 1 && (
                        <button type="button" className="rm" onClick={() => setItens((l) => l.filter((x) => x.id !== it.id))}>Remover</button>
                      )}
                    </div>
                    <div className="item-grid">
                      <div>
                        <label>Descrição do item ou serviço</label>
                        <input className={m.descricao ? "err" : ""} value={it.descricao} onChange={(e) => setItem(it.id, "descricao", e.target.value)} placeholder="Ex.: Microfone sem fio de lapela" />
                        {m.descricao && <div className="msg">{m.descricao}</div>}
                      </div>
                      <div>
                        <label>Quantidade</label>
                        <input type="number" min="1" inputMode="numeric" className={m.quantidade ? "err" : ""} value={it.quantidade} onChange={(e) => setItem(it.id, "quantidade", e.target.value)} placeholder="1" />
                        {m.quantidade && <div className="msg">{m.quantidade}</div>}
                      </div>
                      <div className="link">
                        <label>Link de referência <span className="opt">(opcional)</span></label>
                        <input type="url" className={m.link ? "err" : ""} value={it.link} onChange={(e) => setItem(it.id, "link", e.target.value)} placeholder="https://…" />
                        {m.link && <div className="msg">{m.link}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="add" onClick={() => setItens((l) => [...l, novoItem()])}>+ Adicionar outro item</button>
            </section>

            <section className="card">
              <span className="step">03</span>
              <h2>Custo e justificativa</h2>
              <p className="sub">Informações para aprovação e lançamento financeiro.</p>
              <div className="grid">
                <div className="full">
                  <label htmlFor="cc">Centro de custos</label>
                  <select id="cc" className={cls("centroCusto")} value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)}>
                    <option value="">Selecione…</option>
                    {CENTROS_CUSTO.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <Msg k="centroCusto" />
                </div>
                <div className="full">
                  <label htmlFor="just">Justificativa da compra</label>
                  <textarea id="just" className={cls("justificativa")} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que essa compra é necessária? Onde será utilizada?" />
                  <Msg k="justificativa" />
                </div>
              </div>
            </section>

            <section className="card">
              <span className="step">04</span>
              <h2>Orçamento ou cotação</h2>
              <p className="sub">Anexe o que já tiver em mãos. PDF, imagem, Word ou Excel, até 4 MB no total.</p>
              <label className="drop">
                Clique para anexar arquivos
                <small>ou arraste até aqui</small>
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => { addArquivos(e.target.files); e.target.value = ""; }} />
              </label>
              {arquivos.length > 0 && (
                <ul className="files">
                  {arquivos.map((f, i) => (
                    <li key={f.name + i}>
                      <span>{f.name}<em>{fmtTam(f.size)}</em></span>
                      <button type="button" className="rm" onClick={() => setArquivos((l) => l.filter((_, j) => j !== i))}>Remover</button>
                    </li>
                  ))}
                </ul>
              )}
              <Msg k="arquivos" />
            </section>

            <button className="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar requisição"}</button>
          </form>
        )}
      </main>
      <footer>RESERVA BEACH CLUB · SUPRIMENTOS</footer>
    </>
  );
}
