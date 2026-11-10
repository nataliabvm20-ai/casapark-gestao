/* =====================================================================
   DEMANDAS · quadro, lista, ficha com briefing e histórico
   Os dados moram na tabela "demandas" do Supabase (mesmas regras de acesso
   do resto do sistema). Carregado depois do login, junto com app.js.
   ===================================================================== */
(function(){
"use strict";
const sb = window.__SB__;
if(!sb) return;

const ETAPAS = [["a_fazer", "A fazer", "#8E8E93"], ["fazendo", "Fazendo", "#007AFF"], ["em_aprovacao", "Em aprovação", "#FF9500"], ["feito", "Feito", "#34C759"]];
const NOME_ETAPA = Object.fromEntries(ETAPAS.map(e => [e[0], e[1]]));
const TIPOS = ["Post / carrossel", "Reels / vídeo", "Arte / impresso", "Evento / ativação", "Tráfego pago", "Comunicação direta", "Outro"];
const CATEG = ["Campanha", "Evento próprio", "Casapark Prime", "Espaço Casa / Arquitetos", "Rotina", "Agenda externa"];
const ORIGENS = {whatsapp: "WhatsApp", email: "E-mail", reuniao: "Reunião", calendario: "Calendário", planilha: "Planejamento antigo", outro: "Outro"};
const APROV = {nao_precisa: "Não precisa", aguardando: "Aguardando aprovação", aprovada: "Aprovada", ajustes: "Ajustes pedidos"};
const COR_APROV = {aguardando: "#FF9500", aprovada: "#34C759", ajustes: "#FF3B30"};
const MESES_N = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

const DM = {lista: [], modelos: {}, ok: false, erro: null, visao: LS.get("dm-visao", "quadro"), f: {q: "", cat: "", tipo: "", resp: ""}, hist: {mes: "", q: ""}, editando: null};
const podeEditar = () => window.PERFIL && window.PERFIL.papel !== "leitor";
const eAdmin = () => window.PERFIL && window.PERFIL.papel === "admin";
const dataD = s => s ? lerData(String(s).slice(0, 10)) : null;
const isoD = d => d ? chaveD(d) : null;
const inicioMes = () => new Date(HOJE.getFullYear(), HOJE.getMonth(), 1);
const concl = d => d.concluida_em ? new Date(d.concluida_em) : null;
const noQuadro = d => d.situacao === "ativa" && (d.etapa !== "feito" || (concl(d) && concl(d) >= inicioMes()));
const atrasada = d => d.etapa !== "feito" && d.prazo && dataD(d.prazo) < HOJE;
const progresso = d => { const c = d.checklist || []; return c.length ? {f: c.filter(x => x.feito).length, n: c.length} : null; };

/* ---------- dados ---------- */
async function carregar(){
  const [a, b] = await Promise.all([
    sb.from("demandas").select("*").order("prazo", {ascending: true, nullsFirst: false}),
    sb.from("modelos_briefing").select("tipo_entrega, perguntas"),
  ]);
  if(a.error){ DM.erro = a.error.message; return; }
  DM.lista = a.data || []; DM.modelos = Object.fromEntries((b.data || []).map(m => [m.tipo_entrega, m.perguntas || []]));
  DM.ok = true; DM.erro = null;
}
const redesenhar = () => { if(["demandas", "historico", "geral"].includes(S.aba) && !$("#dlg").open) render(); };
function aplicar(ev){
  const n = ev.new, o = ev.old;
  if(ev.eventType === "DELETE"){ DM.lista = DM.lista.filter(d => d.id !== o.id); }
  else { const i = DM.lista.findIndex(d => d.id === n.id); if(i >= 0) DM.lista[i] = n; else DM.lista.push(n); }
  redesenhar();
}
carregar().then(redesenhar);
sb.channel("demandas-equipe").on("postgres_changes", {event: "*", schema: "public", table: "demandas"}, aplicar).subscribe();

async function salvar(id, campos){
  const r = id ? await sb.from("demandas").update(campos).eq("id", id).select().single()
               : await sb.from("demandas").insert(campos).select().single();
  if(r.error){ toast(podeEditar() ? "Não foi possível salvar: " + r.error.message : "Seu perfil é de leitura."); return null; }
  const i = DM.lista.findIndex(d => d.id === r.data.id); if(i >= 0) DM.lista[i] = r.data; else DM.lista.push(r.data);
  return r.data;
}

/* ---------- abas no menu ---------- */
ABAS.push({id: "demandas", nome: "Demandas", ico: "i-kanban", sub: "Tudo o que a equipe tem para fazer: quadro por etapa ou lista por prazo, com briefing em cada demanda."},
          {id: "historico", nome: "Histórico", ico: "i-check", sub: "Demandas concluídas em meses anteriores, canceladas e arquivadas."});
const iK = ORDEM_ABAS.indexOf("kanban"); ORDEM_ABAS.splice(iK >= 0 ? iK : 2, iK >= 0 ? 1 : 0, "demandas", "historico");
GRUPO_ABA.demandas = "Planejamento"; GRUPO_ABA.historico = "Planejamento";
for(let i = ABAS.length - 1; i >= 0; i--) if(ABAS[i].id === "kanban") ABAS.splice(i, 1);   // o quadro antigo sai do menu
ABAS.sort((a, b) => ORDEM_ABAS.indexOf(a.id) - ORDEM_ABAS.indexOf(b.id));
ABAS.forEach(a => { a.grupo = GRUPO_ABA[a.id]; });
VISTAS.demandas = vDemandas; VISTAS.historico = vHistorico;
if(S.aba === "kanban") S.aba = "demandas";
$("#nav").innerHTML = navHTML();
// o antigo "Registrar demanda fora do radar" passa a abrir a ficha nova
try { formDemanda = () => abrirFicha(null); } catch(e){}

const st = document.createElement("style");
st.textContent = `
.dcard{background:var(--branco);border-radius:14px;padding:12px 12px 10px;box-shadow:var(--sombra);border-left:4px solid var(--c);cursor:pointer;display:flex;flex-direction:column;gap:6px;margin-bottom:10px;text-align:left;width:100%;border-top:0;border-right:0;border-bottom:0;color:var(--grafite);font:inherit}
.dcard:hover{box-shadow:var(--sombra-alta)}.dcard.arrastando{opacity:.4}
.dcard .t{font-weight:600;font-size:14px;line-height:1.3}.dcard .m{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:var(--concreto)}
.dchip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--c,#8E8E93) 14%,transparent);color:var(--c,var(--concreto));white-space:nowrap}
.dpe{display:flex;justify-content:space-between;align-items:center;gap:8px}
.datraso{color:var(--tijolo);font-weight:600}
.dprog{height:4px;border-radius:2px;background:var(--trilho);overflow:hidden}.dprog i{display:block;height:100%;background:#34C759}
.daviso{font-size:12px;color:var(--concreto);background:var(--suave);border-radius:10px;padding:8px 10px;margin-bottom:10px}
.dlista h3{font:600 15px/1.2 var(--f-titulo);margin:24px 0 8px}.dlista h3 small{color:var(--concreto);font-weight:500}
.dlin{display:grid;grid-template-columns:6px minmax(0,1fr) 140px 110px 34px;gap:12px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--branco);box-shadow:var(--sombra);margin-bottom:8px;cursor:pointer;border:0;width:100%;text-align:left;color:var(--grafite);font:inherit}
.dlin>i{align-self:stretch;border-radius:3px;background:var(--c)}
@media (max-width:760px){.dlin{grid-template-columns:6px minmax(0,1fr) 34px}.dlin .so-larga{display:none}}
.dform{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}
.dform label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--concreto)}
.dform input,.dform select,.dform textarea{font:400 15px/1.4 var(--f-texto,inherit);color:var(--grafite);background:var(--branco);border:1px solid var(--areia);border-radius:10px;padding:9px 12px;width:100%;min-width:0}
.dform textarea{min-height:64px;resize:vertical}.dform .larga{grid-column:1/-1}
.dform fieldset{grid-column:1/-1;border:0;border-top:1px solid var(--suave);padding:16px 0 0;margin:4px 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}
.dform legend{font:600 16px/1.2 var(--f-titulo);color:var(--grafite);padding:0 0 4px}
@media (max-width:640px){.dform,.dform fieldset{grid-template-columns:1fr}}
.dcheck li{display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--suave);font-size:14px}.dcheck li.feito span{text-decoration:line-through;color:var(--concreto)}
.dcheck input{width:18px;height:18px;margin-top:2px;flex:none}.dcheck small{color:var(--concreto);margin-left:auto;white-space:nowrap}
.dref{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) 36px;gap:8px;margin-bottom:8px}
.dacoes{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;position:sticky;bottom:-24px;background:var(--branco);padding:12px 0}
.papel-leitor .dcard,.papel-leitor .dlin{pointer-events:auto}`;
document.head.appendChild(st);

/* ---------- filtros ---------- */
function pessoas(){ return [...new Set([...(M.equipe || []), ...(window.PERFIL && window.PERFIL.nome ? [window.PERFIL.nome] : []), ...DM.lista.map(d => d.responsavel).filter(Boolean)])].sort((a, b) => a.localeCompare(b)); }
function filtrar(l){
  const f = DM.f, q = norm(f.q);
  return l.filter(d => (!f.cat || d.categoria === f.cat) && (!f.tipo || d.tipo_entrega === f.tipo) &&
    (!f.resp || (f.resp === "sem" ? !d.responsavel : d.responsavel === f.resp)) &&
    (!q || norm([d.titulo, d.responsavel, d.categoria, d.tipo_entrega, JSON.stringify(d.briefing || {})].join(" ")).includes(q)));
}
const sel = (id, rot, val, ops) => `<select id="${id}" aria-label="${rot}"><option value="">${rot}</option>${ops.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}" ${val === o[0] ? "selected" : ""}>${esc(o[1])}</option>` : `<option ${val === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
function barraFiltros(){
  const f = DM.f;
  return `<div class="filtros">
    <div class="segmentado" role="group" aria-label="Visão"><button data-dm-visao="quadro" aria-pressed="${DM.visao === "quadro"}">Quadro</button><button data-dm-visao="lista" aria-pressed="${DM.visao === "lista"}">Lista por prazo</button></div>
    <input type="search" id="dm-q" placeholder="Buscar demandas…" value="${esc(f.q)}" style="min-width:200px">
    ${sel("dm-cat", "Todas as categorias", f.cat, CATEG)}${sel("dm-tipo", "Todos os tipos", f.tipo, TIPOS)}
    ${sel("dm-resp", "Toda a equipe", f.resp, [["sem", "Sem responsável"], ...pessoas().map(p => [p, p])])}
    ${podeEditar() ? `<button class="btn primario" data-dm-nova style="margin-left:auto">${icone("i-mais", "p")}Nova demanda</button>` : ""}</div>`;
}

/* ---------- cartão e linha ---------- */
function cartao(d){
  const p = progresso(d), pr = dataD(d.prazo);
  return `<button class="dcard" draggable="${podeEditar()}" data-dm="${d.id}" style="--c:${corCat(d.categoria)}">
    <span class="t">${esc(d.titulo)}</span>
    <span class="m"><span class="dchip" style="--c:${corCat(d.categoria)}">${esc(d.categoria)}</span><span>${esc(d.tipo_entrega)}</span></span>
    ${p ? `<span class="dprog" title="${p.f} de ${p.n} itens do checklist"><i style="width:${100 * p.f / p.n}%"></i></span>` : ""}
    <span class="dpe"><span class="m">${pr ? `<span class="${atrasada(d) ? "datraso" : ""}">${atrasada(d) ? "venceu " : ""}${fSem(pr)}</span>` : "sem prazo"}${p ? `<span>· ${p.f}/${p.n}</span>` : ""}${COR_APROV[d.aprovacao] ? `<span class="dchip" style="--c:${COR_APROV[d.aprovacao]}">${APROV[d.aprovacao]}</span>` : ""}</span>${avatar(d.responsavel)}</span></button>`;
}
function linha(d){
  const pr = dataD(d.prazo);
  return `<button class="dlin" data-dm="${d.id}" style="--c:${corCat(d.categoria)}"><i></i>
    <span><b>${esc(d.titulo)}</b><br><span class="peq sec">${esc(d.categoria)} · ${esc(d.tipo_entrega)} · ${NOME_ETAPA[d.etapa]}</span></span>
    <span class="so-larga peq ${atrasada(d) ? "datraso" : "sec"}">${pr ? fSem(pr) : "sem prazo"}</span>
    <span class="so-larga peq sec">${COR_APROV[d.aprovacao] ? APROV[d.aprovacao] : ""}</span>${avatar(d.responsavel)}</button>`;
}

/* ---------- aba Demandas ---------- */
function vDemandas(){
  if(DM.erro) return `<div class="vista"><section class="cartao bi-vazio">${icone("i-alerta")}<h2>Não foi possível carregar as demandas</h2><p class="sec">${esc(DM.erro)}</p></section></div>`;
  if(!DM.ok) return `<div class="vista">${barraFiltros()}<p class="sec">Carregando demandas…</p></div>`;
  const l = filtrar(DM.lista.filter(noQuadro));
  const virada = HOJE.getDate() <= 7 ? DM.lista.filter(d => d.situacao === "ativa" && d.etapa === "feito" && concl(d) && concl(d) < inicioMes() && concl(d) >= new Date(HOJE.getFullYear(), HOJE.getMonth() - 1, 1)).length : 0;
  let corpo;
  if(DM.visao === "lista"){
    const fimSem = somar(inicioSemana(HOJE), 6), ab = l.filter(d => d.etapa !== "feito");
    const grupos = [["Atrasadas", ab.filter(atrasada)], ["Hoje", ab.filter(d => d.prazo && dif(HOJE, dataD(d.prazo)) === 0)],
      ["Esta semana", ab.filter(d => d.prazo && dataD(d.prazo) > HOJE && dataD(d.prazo) <= fimSem)], ["Próximas", ab.filter(d => d.prazo && dataD(d.prazo) > fimSem)],
      ["Sem prazo", ab.filter(d => !d.prazo)], ["Concluídas neste mês", l.filter(d => d.etapa === "feito")]];
    corpo = `<div class="dlista">${grupos.filter(g => g[1].length).map(([n, g]) => `<h3>${n} <small>${g.length}</small></h3>${g.sort((a, b) => (a.prazo || "9") < (b.prazo || "9") ? -1 : 1).map(linha).join("")}`).join("") || `<p class="vazio">Nenhuma demanda com esses filtros.</p>`}</div>`;
  } else {
    corpo = `<div class="kquadro">${ETAPAS.map(([id, nome, cor]) => {
      const c = l.filter(d => d.etapa === id).sort((a, b) => id === "feito" ? (b.concluida_em || "").localeCompare(a.concluida_em || "") : (a.prazo || "9999").localeCompare(b.prazo || "9999"));
      return `<section class="kcol" data-dcol="${id}" aria-label="${nome}"><header><i style="background:${cor}"></i>${nome}<span>${c.length}</span></header><div class="kcol-corpo">
        ${id === "feito" && virada ? `<div class="daviso">${plural(virada, "demanda concluída", "demandas concluídas")} em ${MESES_N[(HOJE.getMonth() + 11) % 12]} ${virada === 1 ? "foi" : "foram"} para o <button class="link-item" data-aba="historico">Histórico</button>.</div>` : ""}
        ${c.map(cartao).join("") || `<div class="kvazio">${podeEditar() ? "Arraste demandas para cá" : "Nenhuma demanda"}</div>`}</div></section>`;
    }).join("")}</div>`;
  }
  const ab = l.filter(d => d.etapa !== "feito");
  return `<div class="vista">${barraFiltros()}
    <div class="kresumo"><div><span class="rotulo">Em aberto</span><b>${ab.length}</b></div><div><span class="rotulo">Atrasadas</span><b class="${ab.filter(atrasada).length ? "atraso" : ""}">${ab.filter(atrasada).length}</b></div><div><span class="rotulo">Em aprovação</span><b>${l.filter(d => d.etapa === "em_aprovacao").length}</b></div><div><span class="rotulo">Concluídas no mês</span><b class="ok">${l.filter(d => d.etapa === "feito").length}</b></div></div>
    ${corpo}
    <p class="peq sec" style="margin:16px 0 0">${podeEditar() ? "Arraste um cartão para mudar a etapa ou clique para abrir a ficha. " : ""}No dia 1º, o que foi concluído no mês anterior vai sozinho para o Histórico. As mudanças aparecem para toda a equipe na hora.</p></div>`;
}

/* ---------- aba Histórico ---------- */
function vHistorico(){
  if(!DM.ok) return `<div class="vista"><p class="sec">Carregando…</p></div>`;
  const h = DM.lista.filter(d => !noQuadro(d));
  const mesDe = d => { const x = concl(d) || dataD(d.prazo) || new Date(d.atualizado_em); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const meses = [...new Set(h.map(mesDe))].sort().reverse();
  const q = norm(DM.hist.q);
  const l = h.filter(d => (!DM.hist.mes || mesDe(d) === DM.hist.mes) && (!q || norm(d.titulo + " " + (d.responsavel || "") + " " + d.categoria).includes(q)))
             .sort((a, b) => mesDe(b).localeCompare(mesDe(a)) || (b.concluida_em || b.prazo || "").localeCompare(a.concluida_em || a.prazo || ""));
  const nomeMes = m => { const [a, n] = m.split("-"); return MESES_N[+n - 1] + " de " + a; };
  const feitas = l.filter(d => d.etapa === "feito" && d.situacao !== "cancelada");
  const conta = k => Object.entries(feitas.reduce((o, d) => { const v = d[k] || "Sem responsável"; o[v] = (o[v] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
  const situ = d => d.situacao === "cancelada" ? "Cancelada" : d.etapa === "feito" ? "Concluída" : "Arquivada sem concluir";
  return `<div class="vista"><div class="filtros">
      <select id="dh-mes" aria-label="Mês"><option value="">Todos os meses</option>${meses.map(m => `<option value="${m}" ${DM.hist.mes === m ? "selected" : ""}>${nomeMes(m)}</option>`).join("")}</select>
      <input type="search" id="dh-q" placeholder="Buscar no histórico…" value="${esc(DM.hist.q)}" style="min-width:220px">
      <button class="btn" data-dm-exportar style="margin-left:auto">${icone("i-download", "p")}Exportar demandas</button></div>
    <div class="grade">
      <section class="cartao c4"><div class="cab"><h2>Resumo ${DM.hist.mes ? "de " + nomeMes(DM.hist.mes) : "geral"}</h2></div>
        <div class="kresumo" style="margin:0 0 12px;display:flex;flex-wrap:wrap;gap:12px"><div><span class="rotulo">Concluídas</span><b class="ok">${feitas.length}</b></div><div><span class="rotulo">Canceladas</span><b>${l.filter(d => d.situacao === "cancelada").length}</b></div></div>
        <h3 class="rotulo" style="margin:12px 0 6px">Por categoria</h3><ul class="leg-lista">${conta("categoria").map(([n, v]) => `<li><i style="background:${corCat(n)}"></i><span>${esc(n)}</span><b>${v}</b></li>`).join("") || "<li class='sec'>—</li>"}</ul>
        <h3 class="rotulo" style="margin:16px 0 6px">Por pessoa</h3><ul class="leg-lista">${conta("responsavel").map(([n, v]) => `<li><i style="background:${corAv(n)}"></i><span>${esc(n)}</span><b>${v}</b></li>`).join("") || "<li class='sec'>—</li>"}</ul></section>
      <section class="cartao c8"><div class="cab"><h2>${plural(l.length, "demanda")}</h2></div>
        ${l.length ? `<div class="rolar"><table><thead><tr><th>Demanda</th><th>Situação</th><th>Quando</th><th>Responsável</th><th></th></tr></thead><tbody>${l.slice(0, 300).map(d => `<tr><td><button class="link-item" data-dm="${d.id}"><b>${esc(d.titulo)}</b></button><div class="peq sec">${esc(d.categoria)} · ${esc(d.tipo_entrega)}</div></td><td class="peq">${situ(d)}</td><td class="tab peq">${concl(d) ? fData(concl(d)) + "/" + concl(d).getFullYear() : d.prazo ? fData(dataD(d.prazo)) + "/" + d.prazo.slice(0, 4) : "—"}</td><td>${avatar(d.responsavel)}</td><td>${podeEditar() ? `<button class="btn texto" data-dm-reabrir="${d.id}">Reabrir</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="vazio">Nada no histórico com esses filtros.</p>`}</section>
    </div></div>`;
}

/* ---------- ficha ---------- */
function abrirFicha(id, padrao){
  const d = id ? DM.lista.find(x => x.id === id) : {titulo: "", categoria: "Rotina", tipo_entrega: "Post / carrossel", etapa: "a_fazer", situacao: "ativa", responsavel: window.PERFIL && window.PERFIL.nome || "", inicio: isoD(HOJE), prazo: null, origem: "whatsapp", briefing: {}, referencias: [], checklist: [], aprovacao: "nao_precisa", aprovador: "", ...(padrao || {})};
  if(!d) return;
  DM.editando = JSON.parse(JSON.stringify(d));
  desenharFicha();
  if(!$("#dlg").open) $("#dlg").showModal();
}
function desenharFicha(){
  const d = DM.editando, ro = !podeEditar(), dis = ro ? "disabled" : "";
  const perg = DM.modelos[d.tipo_entrega] || DM.modelos["Outro"] || [];
  const op = (lista, v) => lista.map(o => Array.isArray(o) ? `<option value="${esc(o[0])}" ${v === o[0] ? "selected" : ""}>${esc(o[1])}</option>` : `<option ${v === o ? "selected" : ""}>${esc(o)}</option>`).join("");
  const itensCalOps = (M.itens || []).filter(i => i.cat !== "Feriado" && i.fim >= somar(HOJE, -30)).slice(0, 400).map(i => [i.id, `${fData(i.ini)}/${i.ini.getFullYear()} · ${i.nome}`]);
  const extras = Object.keys(d.briefing || {}).filter(k => !perg.some(p => p.k === k));
  $("#dlg-corpo").innerHTML = `<form class="dform" id="dm-form" novalidate>
    <h2 class="h2 larga" style="margin:0">${d.id ? esc(d.titulo) || "Demanda" : "Nova demanda"}</h2>
    ${d.id ? `<p class="larga peq sec" style="margin:-6px 0 0">${NOME_ETAPA[d.etapa]}${d.situacao !== "ativa" ? " · " + (d.situacao === "cancelada" ? "cancelada" : "arquivada") : ""}${d.origem ? " · origem: " + (ORIGENS[d.origem] || d.origem) : ""}</p>` : ""}
    <label class="larga">Título<input name="titulo" required maxlength="200" value="${esc(d.titulo)}" ${dis} placeholder="Ex.: Reels de lançamento do Natal"></label>
    <label>Categoria<select name="categoria" ${dis}>${op(CATEG, d.categoria)}</select></label>
    <label>Tipo de entrega<select name="tipo_entrega" data-dm-tipo ${dis}>${op(TIPOS, d.tipo_entrega)}</select></label>
    <label>Responsável<input name="responsavel" list="dm-pessoas" maxlength="80" value="${esc(d.responsavel || "")}" ${dis}><datalist id="dm-pessoas">${pessoas().map(p => `<option value="${esc(p)}">`).join("")}</datalist></label>
    <label>Etapa<select name="etapa" ${dis}>${op(ETAPAS.map(e => [e[0], e[1]]), d.etapa)}</select></label>
    <label>Início<input type="date" name="inicio" value="${esc(d.inicio || "")}" ${dis}></label>
    <label>Prazo<input type="date" name="prazo" value="${esc(d.prazo || "")}" ${dis}></label>
    <label>Origem do pedido<select name="origem" ${dis}>${op(Object.entries(ORIGENS), d.origem)}</select></label>
    <label>Evento ou campanha do calendário<select name="item_calendario" ${dis}><option value="">Nenhum</option>${op(itensCalOps, d.item_calendario || "")}${d.item_calendario && !itensCalOps.some(o => o[0] === d.item_calendario) ? `<option value="${esc(d.item_calendario)}" selected>${esc(d.item_calendario)}</option>` : ""}</select></label>
    <fieldset><legend>Briefing · ${esc(d.tipo_entrega)}</legend>
      ${perg.map(p => `<label class="${/textos|legenda|ideia|programacao|texto|mensagem|pecas/.test(p.k) ? "larga" : ""}">${esc(p.r)}<textarea name="b_${esc(p.k)}" ${dis}>${esc((d.briefing || {})[p.k] || "")}</textarea></label>`).join("")}
      ${extras.map(k => `<label class="larga">${esc(k[0].toUpperCase() + k.slice(1))}<textarea name="b_${esc(k)}" ${dis}>${esc(d.briefing[k])}</textarea></label>`).join("")}
    </fieldset>
    <fieldset><legend>Referências e anexos</legend><div class="larga" id="dm-refs">${(d.referencias || []).map((r, k) => `<div class="dref"><input data-ref-t="${k}" placeholder="Nome" value="${esc(r.titulo || "")}" ${dis}><input data-ref-u="${k}" type="url" placeholder="https://drive.google.com/…" value="${esc(r.url || "")}" ${dis}>${ro ? (r.url && /^https?:\/\//.test(r.url) ? `<a class="btn texto" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir</a>` : "") : `<button type="button" class="btn texto" data-ref-x="${k}" aria-label="Remover">✕</button>`}</div>`).join("")}
      ${ro ? "" : `<button type="button" class="btn" data-ref-add>${icone("i-mais", "p")}Adicionar link</button>`}</div></fieldset>
    <fieldset><legend>Checklist</legend><ul class="larga dcheck">${(d.checklist || []).map((c, k) => `<li class="${c.feito ? "feito" : ""}"><input type="checkbox" data-ck="${k}" ${c.feito ? "checked" : ""} ${dis}><span>${esc(c.t)}${c.area ? ` <small style="margin:0">· ${esc(c.area)}</small>` : ""}</span><small>${c.prazo ? fData(dataD(c.prazo)) : ""}</small>${ro ? "" : `<button type="button" class="btn texto" data-ck-x="${k}" aria-label="Remover" style="padding:0 4px">✕</button>`}</li>`).join("") || `<li class="sec">Nenhum item.</li>`}</ul>
      ${ro ? "" : `<div class="larga dref" style="grid-template-columns:minmax(0,1fr) 150px auto"><input id="ck-novo" placeholder="Novo item do checklist"><input id="ck-prazo" type="date"><button type="button" class="btn" data-ck-add>Adicionar</button></div>`}</fieldset>
    <fieldset><legend>Aprovação</legend>
      <label>Quem aprova<input name="aprovador" maxlength="80" list="dm-pessoas" value="${esc(d.aprovador || "")}" ${dis}></label>
      <label>Situação<select name="aprovacao" ${dis}>${op(Object.entries(APROV), d.aprovacao)}</select></label></fieldset>
    <div class="dacoes">${ro ? `<button type="button" class="btn" data-fechar>Fechar</button>` : `
      <button class="btn primario" type="submit">Salvar</button>
      ${d.id && d.etapa !== "feito" ? `<button type="button" class="btn" data-dm-concluir>${icone("i-check", "p")}Concluir</button>` : ""}
      ${d.id && d.situacao === "ativa" ? `<button type="button" class="btn texto" data-dm-cancelar>Cancelar demanda</button>` : ""}
      ${d.id && eAdmin() ? `<button type="button" class="btn texto" data-dm-excluir style="margin-left:auto;color:var(--tijolo)">Excluir</button>` : ""}
      <button type="button" class="btn texto" data-fechar>Fechar sem salvar</button>`}</div>
  </form>`;
}
// guarda o que já foi digitado antes de redesenhar a ficha (troca de tipo, links, checklist)
function lerFicha(){
  const d = DM.editando, f = $("#dm-form"); if(!f) return d;
  const fd = new FormData(f);
  ["titulo","categoria","tipo_entrega","responsavel","etapa","inicio","prazo","origem","item_calendario","aprovador","aprovacao"].forEach(k => { if(fd.has(k)) d[k] = String(fd.get(k) || "").trim(); });
  const b = {}; for(const [k, v] of fd.entries()) if(k.startsWith("b_") && String(v).trim()) b[k.slice(2)] = String(v).trim();
  d.briefing = b;
  d.referencias = (d.referencias || []).map((r, k) => ({titulo: ($(`[data-ref-t="${k}"]`) || {}).value || "", url: ($(`[data-ref-u="${k}"]`) || {}).value || ""}));
  return d;
}
function camposParaSalvar(d){
  const c = {titulo: d.titulo, categoria: d.categoria, tipo_entrega: d.tipo_entrega, responsavel: d.responsavel || null, etapa: d.etapa,
    inicio: d.inicio || null, prazo: d.prazo || null, origem: d.origem, item_calendario: d.item_calendario || null, briefing: d.briefing || {},
    referencias: (d.referencias || []).filter(r => r.url || r.titulo), checklist: d.checklist || [], aprovador: d.aprovador || null, aprovacao: d.aprovacao, situacao: d.situacao};
  if(c.inicio && c.prazo && c.prazo < c.inicio) c.inicio = c.prazo;
  return c;
}
async function salvarFicha(extra){
  const d = lerFicha(); Object.assign(d, extra || {});
  if(!d.titulo){ toast("Dê um título para a demanda."); $("#dm-form [name=titulo]").focus(); return; }
  if((d.referencias || []).some(r => r.url && !/^https?:\/\//i.test(r.url))){ toast("Os links precisam começar com https://"); return; }
  const r = await salvar(d.id, camposParaSalvar(d));
  if(r){ $("#dlg").close(); toast(d.id ? "Demanda salva" : "Demanda criada"); render(); }
}

/* ---------- arrastar entre colunas ---------- */
let arrastando = null;
document.addEventListener("dragstart", ev => { const c = ev.target.closest && ev.target.closest(".dcard"); if(!c || !podeEditar()) return; arrastando = c.dataset.dm; c.classList.add("arrastando"); ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", arrastando); });
document.addEventListener("dragend", ev => { const c = ev.target.closest && ev.target.closest(".dcard"); if(c) c.classList.remove("arrastando"); $$(".kcol.sobre").forEach(x => x.classList.remove("sobre")); });
document.addEventListener("dragover", ev => { const col = ev.target.closest && ev.target.closest("[data-dcol]"); if(!col || !arrastando) return; ev.preventDefault(); $$(".kcol.sobre").forEach(x => x !== col && x.classList.remove("sobre")); col.classList.add("sobre"); });
document.addEventListener("drop", async ev => {
  const col = ev.target.closest && ev.target.closest("[data-dcol]"); if(!col || !arrastando) return; ev.preventDefault();
  const id = arrastando; arrastando = null; col.classList.remove("sobre");
  const d = DM.lista.find(x => x.id === id); if(!d || d.etapa === col.dataset.dcol) return;
  const antes = d.etapa; d.etapa = col.dataset.dcol; render();
  const r = await salvar(id, {etapa: col.dataset.dcol});
  if(!r){ d.etapa = antes; render(); } else if(r.etapa === "feito") toast("Concluída: " + r.titulo);
});

/* ---------- cliques e campos ---------- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-dm],[data-dm-nova],[data-dm-visao],[data-dm-reabrir],[data-dm-exportar],[data-ref-add],[data-ref-x],[data-ck-add],[data-ck-x],[data-dm-concluir],[data-dm-cancelar],[data-dm-excluir]");
  if(!b) return;
  const ds = b.dataset;
  if(ds.dm !== undefined && !b.closest("form")){ ev.preventDefault(); abrirFicha(ds.dm); }
  else if(ds.dmNova !== undefined) abrirFicha(null);
  else if(ds.dmVisao){ DM.visao = ds.dmVisao; LS.set("dm-visao", DM.visao); render(); }
  else if(ds.dmReabrir){ const r = await salvar(ds.dmReabrir, {situacao: "ativa", etapa: "fazendo"}); if(r){ toast("Reaberta: " + r.titulo); render(); } }
  else if(ds.dmExportar !== undefined) exportarCSV();
  else if(ds.refAdd !== undefined){ lerFicha().referencias.push({titulo: "", url: ""}); desenharFicha(); }
  else if(ds.refX !== undefined){ lerFicha().referencias.splice(+ds.refX, 1); desenharFicha(); }
  else if(ds.ckAdd !== undefined){ const t = ($("#ck-novo").value || "").trim(); if(!t) return; const d = lerFicha(); d.checklist = [...(d.checklist || []), {id: "c" + Date.now().toString(36), t, prazo: $("#ck-prazo").value || null, feito: false}]; desenharFicha(); }
  else if(ds.ckX !== undefined){ lerFicha().checklist.splice(+ds.ckX, 1); desenharFicha(); }
  else if(ds.dmConcluir !== undefined) salvarFicha({etapa: "feito"});
  else if(ds.dmCancelar !== undefined){ if(confirm("Cancelar esta demanda? Ela vai para o Histórico e pode ser reaberta depois.")) salvarFicha({situacao: "cancelada"}); }
  else if(ds.dmExcluir !== undefined){
    if(!confirm("Excluir esta demanda de vez? Isso não pode ser desfeito (fica só o registro na Auditoria).")) return;
    const r = await sb.from("demandas").delete().eq("id", DM.editando.id);
    if(r.error) toast("Não foi possível excluir: " + r.error.message); else { DM.lista = DM.lista.filter(x => x.id !== DM.editando.id); $("#dlg").close(); render(); toast("Demanda excluída"); }
  }
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if(t.matches("[data-dm-tipo]")){ lerFicha(); desenharFicha(); }
  else if(t.matches("[data-ck]")){ const d = lerFicha(); d.checklist[+t.dataset.ck].feito = t.checked; t.closest("li").classList.toggle("feito", t.checked); }
  else if(t.id === "dm-cat"){ DM.f.cat = t.value; render(); }
  else if(t.id === "dm-tipo"){ DM.f.tipo = t.value; render(); }
  else if(t.id === "dm-resp"){ DM.f.resp = t.value; render(); }
  else if(t.id === "dh-mes"){ DM.hist.mes = t.value; render(); }
});
document.addEventListener("input", ev => {
  const t = ev.target;
  if(t.id === "dm-q" || t.id === "dh-q"){
    if(t.id === "dm-q") DM.f.q = t.value; else DM.hist.q = t.value;
    const p = t.selectionStart; render(); const el = $("#" + t.id); if(el){ el.focus(); el.setSelectionRange(p, p); }
  }
});
document.addEventListener("submit", ev => { if(ev.target.id !== "dm-form") return; ev.preventDefault(); if(podeEditar()) salvarFicha(); });

/* ---------- backup ---------- */
function exportarCSV(){
  const cab = ["titulo","categoria","tipo_entrega","etapa","situacao","responsavel","inicio","prazo","origem","item_calendario","aprovador","aprovacao","concluida_em","briefing","referencias","checklist","criado_em"];
  const cel = v => { v = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const txt = "﻿" + [cab.join(";"), ...DM.lista.map(d => cab.map(k => cel(d[k])).join(";"))].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type: "text/csv;charset=utf-8"}));
  a.download = "demandas_casapark_" + chaveD(HOJE) + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

window.DEMANDAS = {abrirFicha, lista: () => DM.lista};
render();
})();
