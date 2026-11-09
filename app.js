"use strict";

/* =====================================================================
   Dashboard de marketing do Casapark
   Nenhuma data fica no código: tudo vem dos CSV (calendário, base, lojas,
   fornecedores). Prazos de checklist = data do item ± regra (D-60, F+7…).
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DIA = 86400000;
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MES_C = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const SEMANA = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
const SEM_C = ["dom","seg","ter","qua","qui","sex","sáb"];
const FASES = ["60 dias","30 dias","15 dias","7 dias","Dia D","Pós-evento"];
const FORMATOS_EVENTO = ["Evento","Talk","Feira","Viagem","Montagem"];
const CATS = {
  "Campanha":                 {cor:"#FF9500"},
  "Evento próprio":           {cor:"#30B0C7"},
  "Rotina":                   {cor:"#8E8E93"},
  "Casapark Prime":           {cor:"#AF52DE"},
  "Espaço Casa / Arquitetos": {cor:"#34C759"},
  "Agenda externa":           {cor:"#636366", ext:true},
};
const ABAS = [
  {id:"geral", nome:"Visão geral", ico:"i-geral", sub:"O que precisa ser feito hoje e nesta semana."},
  {id:"calendario", nome:"Calendário", ico:"i-cal", sub:"O ano em uma tela, montado a partir das datas de início e fim."},
  {id:"eventos", nome:"Eventos", ico:"i-evento", sub:"Ficha de cada evento e checklist por fase, com prazos calculados pela data do evento."},
  {id:"campanhas", nome:"Campanhas", ico:"i-campanha", sub:"As seis campanhas do ano: etapa atual e entregas por status."},
  {id:"redes", nome:"Redes sociais", ico:"i-redes", sub:"Calendário editorial do mês: conteúdo de rotina e de campanha."},
  {id:"prime", nome:"Casapark Prime", ico:"i-prime", sub:"Ciclo semestral de pontuação, fechamentos mensais e viagens."},
  {id:"lojas", nome:"Lojas", ico:"i-lojas", sub:"Lojas do Casapark, com busca e filtros por segmento e piso."},
  {id:"fornecedores", nome:"Fornecedores e entregas", ico:"i-forn", sub:"Quem entrega o quê, e quando."},
];

/* ---------- datas ---------- */
function lerData(s){
  s = (s || "").trim(); if(!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if(m){ let a = +m[3]; if(a < 100) a += 2000; return new Date(a, +m[2]-1, +m[1]); }
  return null;
}
const somar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dif = (a, b) => Math.round((b - a) / DIA);
const chaveD = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const dd = n => String(n).padStart(2, "0");
const fData = d => d ? dd(d.getDate()) + "/" + dd(d.getMonth()+1) : "";
const fDataA = d => d ? fData(d) + "/" + d.getFullYear() : "";
const fSem = d => d ? SEM_C[d.getDay()] + ", " + fData(d) : "";
const fPeriodo = (a, b) => (!b || +a === +b) ? fSem(a) : fData(a) + " a " + fData(b) + (a.getFullYear() !== b.getFullYear() ? "/" + b.getFullYear() : "");
function semanaISO(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return [t.getUTCFullYear(), Math.ceil(((t - a) / DIA + 1) / 7)];
}
const inicioSemana = d => somar(d, -((d.getDay() + 6) % 7));
function quando(d){
  const n = dif(HOJE, d);
  if(n === 0) return "hoje";
  if(n === 1) return "amanhã";
  if(n === -1) return "ontem";
  if(n < 0) return "há " + (-n) + " dias";
  if(n < 7) return "na " + SEMANA[d.getDay()] + " (" + fData(d) + ")";
  return "em " + n + " dias (" + fData(d) + ")";
}
const plural = (n, s, p) => n + " " + (n === 1 ? s : (p || s + "s"));

const params = new URLSearchParams(location.search);
const HOJE = (() => { const p = lerData(params.get("hoje")); if(p) return p; const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()); })();

/* ---------- CSV ---------- */
function lerCSV(texto){
  texto = texto.replace(/^﻿/, "");
  const primeira = texto.slice(0, texto.indexOf("\n") + 1 || texto.length);
  const sep = (primeira.split(";").length >= primeira.split(",").length) ? ";" : ",";
  const linhas = []; let campo = "", linha = [], aspas = false;
  for(let i = 0; i < texto.length; i++){
    const c = texto[i];
    if(aspas){
      if(c === '"'){ if(texto[i+1] === '"'){ campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if(c === '"') aspas = true;
    else if(c === sep){ linha.push(campo); campo = ""; }
    else if(c === "\n" || c === "\r"){
      if(c === "\r" && texto[i+1] === "\n") i++;
      linha.push(campo); campo = ""; if(linha.some(x => x !== "")) linhas.push(linha); linha = [];
    } else campo += c;
  }
  if(campo !== "" || linha.length){ linha.push(campo); if(linha.some(x => x !== "")) linhas.push(linha); }
  if(!linhas.length) return [];
  const cab = linhas[0].map(h => h.trim());
  return linhas.slice(1).map(l => Object.fromEntries(cab.map((h, i) => [h, (l[i] || "").trim()])));
}
function gerarCSV(campos, linhas){
  const q = v => { v = String(v ?? ""); return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return "﻿" + [campos.join(";"), ...linhas.map(l => campos.map(c => q(l[c])).join(";"))].join("\r\n") + "\r\n";
}

/* ---------- armazenamento local (marcações e demandas) ---------- */
// chaves compartilhadas (status, responsáveis, demandas, planilhas) vão para o banco; o resto fica neste navegador
const _C = () => window.__COMPARTILHADO__;
const LS = {
  get(k, d){ if(_C() && _C().tem(k)) return _C().get(k, d); try{ return JSON.parse(localStorage.getItem("casapark." + k)) ?? d; }catch(e){ return d; } },
  set(k, v){ if(_C() && _C().tem(k)) return _C().set(k, v); try{ localStorage.setItem("casapark." + k, JSON.stringify(v)); }catch(e){} },
  del(k){ if(_C() && _C().tem(k)) return _C().del(k); try{ localStorage.removeItem("casapark." + k); }catch(e){} },
};

/* ---------- modelo de dados ---------- */
let D = null;          // carga embutida
let M = null;          // modelo montado
const S = {            // estado da interface
  aba: new URLSearchParams(location.search).get("aba") || LS.get("aba", "geral"),
  pessoa: LS.get("pessoa", "todos"),
  cal: {ano: null, visao: new URLSearchParams(location.search).get("visao") || "anual", mes: null, cats: new Set(Object.keys(CATS)), tipo: "todos"},
  ev: {filtro: "proximos", rec: "todos", sel: null},
  camp: {ano: null},
  redes: {ano: null, mes: null},
  prime: {ano: null},
  lojas: {q: "", seg: "", piso: "", pend: false},
};

function prazoPorRegra(regra, ini, fim){
  const r = (regra || "").toUpperCase().replace(/\s/g, "");
  if(r === "M") return somar(ini, Math.floor(dif(ini, fim) / 2));
  const m = /^([DF])([+-]?\d+)?$/.exec(r);
  if(!m) return null;
  return somar(m[1] === "D" ? ini : fim, parseInt(m[2] || "0", 10));
}
function fasePorRegra(regra){
  const r = (regra || "").toUpperCase().replace(/\s/g, "");
  if(r === "M") return "Dia D";
  if(r.startsWith("F")) return r.startsWith("F-") ? "Dia D" : "Pós-evento";
  const m = /^D([+-]?\d+)?$/.exec(r); const n = m ? -parseInt(m[1] || "0", 10) : 0;
  if(n >= 60) return "60 dias"; if(n >= 30) return "30 dias"; if(n >= 15) return "15 dias";
  if(n >= 1) return "7 dias"; return n === 0 ? "Dia D" : "Pós-evento";
}

function montar(arquivos, fonte){
  const itens = [], porId = {};
  const nomesCal = Object.keys(arquivos).filter(n => /^calendario_(casapark_\d{4}|google)\.csv$/.test(n)).sort();
  let semId = 0;
  for(const n of nomesCal){
    for(const r of lerCSV(arquivos[n])){
      const ini = lerData(r["Início"]); if(!ini) continue;
      const it = {
        id: r.ID || ("novo-" + (++semId)), ini, fim: lerData(r.Fim) || ini, hora: r.Hora || "",
        nome: r.Item || "(sem nome)", cat: r.Categoria || "Evento próprio", formato: r.Formato || "Evento",
        campanha: r.Campanha || "", rec: r["Recorrência"] || "", regra: r["Regra de data"] || "",
        ref: r["Referência ano anterior"] || "", statusData: (r["Status da data"] || "a confirmar").toLowerCase(),
        resp: r["Responsável"] || "", forn: r.Fornecedor || "", lojas: r["Lojas participantes"] || "",
        agenda: r.Agenda || "", obs: r["Observações"] || "", arquivo: n, tarefas: [],
      };
      if(it.fim < it.ini) it.fim = it.ini;
      itens.push(it); porId[it.id] = it;
    }
  }
  itens.sort((a, b) => a.ini - b.ini || a.nome.localeCompare(b.nome));
  const feriados = {};
  itens.filter(i => i.cat === "Feriado").forEach(i => { feriados[chaveD(i.ini)] = i; });

  const ovr = LS.get("status", {});
  const tarefas = [];
  const comTarefas = new Set();
  const base = arquivos["base_gestao.csv"] ? lerCSV(arquivos["base_gestao.csv"]) : [];
  const novaTarefa = (r, it) => {
    const regra = r.prazo_regra || "";
    let prazo = (it && regra) ? prazoPorRegra(regra, it.ini, it.fim) : null;
    if(!prazo) prazo = lerData(r.prazo);
    const t = {
      idt: r.id_tarefa, it, idItem: r.id_item || "", tipo: r.tipo_tarefa || "checklist",
      fase: regra ? fasePorRegra(regra) : (r.fase || ""), etapa: r.etapa || "", area: r.area || "",
      tarefa: r.tarefa || "", regra, prazo, resp: r.responsavel || (it ? it.resp : ""),
      forn: r.fornecedor || "", status: (r.status_tarefa || "a fazer").toLowerCase(), origem: r.origem || "",
      solicitante: r.solicitante || "", horas: r.horas_gastas || "", obs: r.observacoes || "",
      nomeItem: it ? it.nome : (r.item || ""),
    };
    t.statusBase = t.status;
    if(ovr[t.idt]) t.status = ovr[t.idt];
    if(it && it.statusData === "cancelada" && t.status !== "concluída") t.status = "cancelada";
    tarefas.push(t); if(it) it.tarefas.push(t);
    return t;
  };
  for(const r of base){
    const it = porId[r.id_item];
    if(r.id_item && !it) continue;        // item saiu do calendário
    if(it) comTarefas.add(it.id);
    novaTarefa(r, it);
  }
  // itens novos no calendário (ainda sem linhas na base): tarefas pelos mesmos modelos do script
  const modelos = (D && D.modelos) || {};
  for(const it of itens){
    if(comTarefas.has(it.id) || it.cat === "Feriado" || it.fim < HOJE) continue;
    let mod = (modelos[it.formato] || []).slice();
    if(it.formato === "Campanha" && it.campanha === "Natal") mod = mod.concat((D && D.natal_extra) || []);
    for(const [cod, area, regra, tarefa, tipo, forn] of mod){
      const etapa = (it.formato === "Campanha" || tipo === "etapa" || tipo === "peça") ? area : "";
      const t = novaTarefa({id_tarefa: it.id + "-" + cod, id_item: it.id, tipo_tarefa: tipo, area, etapa,
        tarefa: tarefa || it.nome, prazo_regra: regra, fornecedor: forn || it.forn, status_tarefa: "a fazer",
        origem: "modelo padrão (gerado no painel)"}, it);
      t.virtual = true;
    }
  }
  // demandas fora do radar registradas neste navegador
  for(const d of LS.get("demandas", [])){
    if(tarefas.some(t => t.idt === d.id_tarefa)) continue;
    novaTarefa(d, null).local = true;
  }
  // responsáveis editados no painel: por item (vale para todas as tarefas dele) e por demanda
  const respItem = LS.get("resp", {}), respTar = LS.get("respT", {});
  itens.forEach(it => {
    if(respItem[it.id] !== undefined){ it.resp = respItem[it.id]; it.tarefas.forEach(t => { t.resp = it.resp; }); }
    else if(!it.resp){
      const c = {}; it.tarefas.forEach(t => { if(t.resp) c[t.resp] = (c[t.resp] || 0) + 1; });
      const mais = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; if(mais) it.resp = mais[0];
    }
  });
  tarefas.forEach(t => { if(respTar[t.idt] !== undefined) t.resp = respTar[t.idt]; });
  tarefas.forEach(t => {
    t.aberta = t.tipo !== "registro" && ["a fazer", "em andamento", "a verificar"].includes(t.status);
    t.atrasada = t.aberta && t.prazo && t.prazo < HOJE && !(t.it && t.it.formato === "Ciclo" && t.status === "a verificar");
    t.dias = t.prazo ? dif(HOJE, t.prazo) : null;
  });
  itens.forEach(it => it.tarefas.sort((a, b) => (a.prazo || 0) - (b.prazo || 0)));

  const lojas = arquivos["lojas_casapark.csv"] ? lerCSV(arquivos["lojas_casapark.csv"]) : [];
  const fornecedores = arquivos["fornecedores_casapark.csv"] ? lerCSV(arquivos["fornecedores_casapark.csv"]) : [];
  const anos = [...new Set(itens.filter(i => i.cat !== "Feriado").map(i => i.ini.getFullYear()))].sort();
  const equipe = arquivos["equipe_casapark.csv"] ? lerCSV(arquivos["equipe_casapark.csv"]).map(r => r.Nome).filter(Boolean) : [];
  M = {itens, porId, tarefas, feriados, lojas, fornecedores, anos, fonte, nomesCal, equipe,
       etapas: (D && D.etapas_campanha) || ["Briefing","Aprovação","Criação da agência","Desdobramentos da designer","Mídia","Veiculação","Relatório"],
       campanhasAno: (D && D.campanhas_do_ano) || ["1º Liquidecora","Institucional 1","2º Liquidecora","Institucional 2","Black Week","Natal"]};
  const anoPadrao = M.anos.includes(HOJE.getFullYear() + 1) && HOJE.getMonth() >= 9 ? HOJE.getFullYear() + 1 : HOJE.getFullYear();
  const pMes = /^(\d{4})-(\d{2})$/.exec(params.get("mes") || "");
  if(pMes && S.cal.ano === null){ S.cal.ano = +pMes[1]; S.cal.mes = +pMes[2] - 1; }
  S.cal.ano ??= M.anos.includes(2027) ? 2027 : anoPadrao;
  S.cal.mes ??= HOJE.getMonth();
  S.camp.ano ??= anoPadrao;
  S.redes.ano ??= HOJE.getFullYear(); S.redes.mes ??= HOJE.getMonth();
  S.prime.ano ??= anoPadrao;
}

/* ---------- utilidades de domínio ---------- */
const naoUtil = d => d.getDay() === 0 || d.getDay() === 6 || (M.feriados[chaveD(d)] && M.feriados[chaveD(d)].formato === "Feriado");
function proximoUtil(d){ while(naoUtil(d)) d = somar(d, 1); return d; }
function utilAnterior(d){ while(naoUtil(d)) d = somar(d, -1); return d; }
function situacao(t){
  if(t.status === "concluída") return {cls:"ok", txt:"Concluída", o:5};
  if(t.status === "cancelada") return {cls:"neutro", txt:"Cancelada", o:6};
  if(t.atrasada) return t.status === "a verificar" ? {cls:"atraso", txt:"Vencida · sem registro", o:0} : {cls:"atraso", txt:"Atrasada", o:0};
  if(t.dias !== null && t.dias === 0) return {cls:"atencao", txt:"Vence hoje", o:1};
  if(t.dias !== null && t.dias <= 3) return {cls:"atencao", txt:"Vence em " + plural(t.dias, "dia"), o:2};
  if(t.status === "em andamento") return {cls:"confirmar", txt:"Em andamento", o:3};
  if(t.status === "a verificar") return {cls:"confirmar", txt:"A verificar", o:3};
  return {cls:"neutro", txt:"A fazer", o:4};
}
function seletorResp(valor, attrs){
  const nomes = [...new Set([...M.equipe, ...(valor ? [valor] : [])])];
  return `<select class="sel-resp" ${attrs} aria-label="Responsável"><option value="">A definir</option>${nomes.map(n => `<option ${n === valor ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
}
const pill = (cls, txt) => `<span class="pill ${cls}">${esc(txt)}</span>`;
const pillT = t => { const s = situacao(t); return pill(s.cls, s.txt); };
function pillData(it){
  const m = {"confirmada":["ok","Data confirmada"], "a confirmar":["confirmar","Data a confirmar"], "adiada":["atencao","Adiada"], "cancelada":["neutro cancelado","Cancelada"]};
  const [c, t] = m[it.statusData] || ["neutro", it.statusData];
  return pill(c, t);
}
function corCat(cat){ return (CATS[cat] || {cor:"#8E8E93"}).cor; }
function rgba(hex, a){ const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; }
const estiloCat = cat => `background:${rgba(corCat(cat), cat === "Agenda externa" ? .06 : .12)};border-left-color:${corCat(cat)}`;
const tipoCat = cat => `<span class="tipo"><i style="background:${corCat(cat)}"></i>${esc(cat)}</span>`;
const icone = (id, cls = "") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const alerta = txt => txt ? `<p class="alerta">${icone("i-info", "p")}<span>${txt}</span></p>` : "";
const ehEvento = it => FORMATOS_EVENTO.includes(it.formato) && it.cat !== "Feriado";
const recNome = it => ({anual:"Fixo · anual", mensal:"Fixo · mensal", semestral:"Fixo · semestral", pontual:"Pontual"}[it.rec] || "Pontual");
const ehFixo = it => ["anual","mensal","semestral"].includes(it.rec);
function progresso(it){
  const ts = it.tarefas.filter(t => t.status !== "cancelada" && t.tipo !== "registro");
  if(!ts.length){
    const r = it.tarefas.find(t => t.tipo === "registro");
    return r ? {feitas: r.status === "concluída" ? 1 : 0, total: 1, pct: r.status === "concluída" ? 100 : 0, atrasadas: 0, hist: true} : {feitas:0,total:0,pct:0,atrasadas:0};
  }
  const feitas = ts.filter(t => t.status === "concluída").length;
  return {feitas, total: ts.length, pct: Math.round(100 * feitas / ts.length), atrasadas: ts.filter(t => t.atrasada).length};
}
const barraProg = (p, cls = "") => `<div class="progresso"><div class="barra ${cls}" role="img" aria-label="${p.pct}% concluído"><i style="width:${p.pct}%"></i></div><span class="tab peq">${p.pct}%</span></div>`;
const abertas = () => M.tarefas.filter(t => t.aberta && t.prazo);
const doResp = t => S.pessoa === "todos" || (S.pessoa === "sem" ? !t.resp : t.resp === S.pessoa);
function itensNoPeriodo(a, b, filtro = () => true){ return M.itens.filter(i => i.cat !== "Feriado" && i.ini <= b && i.fim >= a && filtro(i)); }
function proximoBriefing(desde){ return M.itens.find(i => i.formato === "Briefing" && i.ini >= desde && i.statusData !== "cancelada"); }
function avisoDiaUtil(it){
  if(!naoUtil(it.ini)) return "";
  const f = M.feriados[chaveD(it.ini)];
  const motivo = f && f.formato === "Feriado" ? f.nome : SEMANA[it.ini.getDay()];
  return `cai em ${motivo}: envie até ${fSem(utilAnterior(it.ini))}`;
}

/* campanhas: agrupa o item principal com os itens ligados (Mostra, Saldão, reuniões) */
function campanhas(ano){
  const principais = M.itens.filter(i => i.formato === "Campanha" && i.ini.getFullYear() === ano);
  return M.campanhasAno.map(nome => {
    const it = principais.find(i => i.campanha === nome);
    if(!it) return {nome, it: null};
    const ligados = M.itens.filter(i => i !== it && i.campanha === nome && Math.abs(dif(it.ini, i.ini)) < 120);
    return {nome, it, ligados, ...estadoCampanha(it)};
  });
}
function estadoCampanha(it){
  const etapas = M.etapas.map(nome => {
    const ts = it.tarefas.filter(t => t.etapa === nome && t.status !== "cancelada");
    const prazo = ts.filter(t => t.tipo === "etapa")[0]?.prazo || ts[0]?.prazo || null;
    const feitas = ts.filter(t => t.status === "concluída").length;
    return {nome, ts, prazo, feitas, completa: ts.length > 0 && feitas === ts.length, atrasada: ts.some(t => t.atrasada)};
  });
  let real = etapas.findIndex(e => !e.completa);
  if(real === -1) real = etapas.length;
  let previsto;
  if(HOJE > it.fim) previsto = 6; else if(HOJE >= it.ini) previsto = 5;
  else { previsto = etapas.findIndex(e => e.prazo && e.prazo >= HOJE); if(previsto === -1) previsto = 5; }
  const pecas = it.tarefas.filter(t => t.tipo === "peça");
  const cont = {concluida:0, andamento:0, fazer:0, atrasada:0, cancelada:0};
  pecas.forEach(t => {
    if(t.status === "cancelada") cont.cancelada++;
    else if(t.status === "concluída") cont.concluida++;
    else if(t.atrasada) cont.atrasada++;
    else if(t.status === "em andamento") cont.andamento++;
    else cont.fazer++;
  });
  return {etapas, real, previsto, pecas, cont};
}
const nomeEtapa = (c, i) => i >= M.etapas.length ? "Concluída" : M.etapas[i];

/* =====================================================================
   VISÃO GERAL
   ===================================================================== */
function acoesUrgentes(){
  const c = [];
  const ab = abertas().filter(doResp);
  // 1. itens com tarefas vencidas, mais próximos primeiro
  const grupos = {};
  ab.filter(t => t.atrasada && !(t.it && t.it.formato === "Ciclo")).forEach(t => { const k = t.it ? t.it.id : t.idt; (grupos[k] ||= []).push(t); });
  for(const k in grupos){
    const ts = grupos[k].sort((a, b) => a.prazo - b.prazo); const it = ts[0].it;
    if(!it){ ts.forEach(t => c.push({tipo:"fora", score: 980, txt:`A demanda <b>${esc(t.tarefa)}</b>, pedida por ${esc(t.solicitante || "alguém sem nome registrado")}, venceu ${quando(t.prazo)}.`, alvo: null})); continue; }
    const dItem = dif(HOJE, it.ini);
    const semReg = ts.every(t => t.status === "a verificar");
    const acontece = dItem > 0 ? `acontece ${quando(it.ini)}` : (HOJE <= it.fim ? "está acontecendo agora" : "já terminou");
    c.push({tipo:"vencidas", score: (dItem < 0 ? 600 : 1000 - Math.min(dItem, 60) * 8) + ts.length * 3, alvo: it.id,
      txt: `<b>${esc(it.nome)}</b> ${acontece} e tem ${plural(ts.length, "tarefa vencida", "tarefas vencidas")}${semReg ? " sem registro de conclusão" : ""}. ${semReg ? "Confirme o que já foi feito e marque; depois, comece" : "Comece"} por “${esc(ts[0].tarefa)}”.`});
  }
  // 2. vence hoje ou nos próximos 2 dias
  const breve = ab.filter(t => !t.atrasada && t.dias >= 0 && t.dias <= 2);
  if(breve.length){
    const nomes = breve.slice(0, 2).map(t => `“${esc(t.tarefa)}” (${esc(t.nomeItem)})`).join(" e ");
    c.push({tipo:"breve", score: 970, alvo: breve[0].it?.id, txt: `${plural(breve.length, "tarefa vence", "tarefas vencem")} até ${fSem(somar(HOJE, 2))}: ${nomes}${breve.length > 2 ? " e outras" : ""}.`});
  }
  // 3. briefing mensal à agência nos próximos 7 dias
  const br = proximoBriefing(HOJE);
  if(br && dif(HOJE, br.ini) <= 7){
    const aviso = avisoDiaUtil(br);
    c.push({tipo:"briefing", score: 960 - dif(HOJE, br.ini), alvo: br.id, txt: `O <b>${esc(br.nome.toLowerCase())}</b> vence ${quando(br.ini)}${aviso ? " e " + aviso : ""}.`});
  }
  // 4. datas a confirmar nos próximos 30 dias
  const ac = itensNoPeriodo(HOJE, somar(HOJE, 30), i => i.statusData === "a confirmar" && i.ini >= HOJE && i.formato !== "Ciclo");
  ac.slice(0, 3).forEach(i => c.push({tipo:"confirmar", score: 900 - dif(HOJE, i.ini) * 4, alvo: i.id, txt: `Confirmar a data de <b>${esc(i.nome)}</b> (${fSem(i.ini)}): faltam ${plural(dif(HOJE, i.ini), "dia")} e o item ainda está como “a confirmar”.`}));
  // 5. itens dos próximos 14 dias sem responsável
  const sr = itensNoPeriodo(HOJE, somar(HOJE, 14), i => i.formato !== "Ciclo" && i.tarefas.some(t => t.aberta && !t.resp));
  if(sr.length && S.pessoa === "todos") c.push({tipo:"resp", score: 880, alvo: sr[0].id, txt: `${plural(sr.length, "item", "itens")} dos próximos 14 dias ${sr.length === 1 ? "está" : "estão"} sem responsável: ${sr.slice(0, 3).map(i => esc(i.nome)).join(", ")}${sr.length > 3 ? "…" : ""}. Defina quem cuida de cada um no calendário.`});
  c.sort((a, b) => b.score - a.score);
  const escolhidas = [], porTipo = {};
  for(const x of c){ if((porTipo[x.tipo] || 0) >= 2) continue; porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1; escolhidas.push(x); if(escolhidas.length === 3) break; }
  return escolhidas;
}

function liTarefa(t, opts = {}){
  const s = situacao(t);
  const meta = [];
  if(opts.item !== false && t.nomeItem) meta.push(t.it ? `<button class="link-item" data-item="${esc(t.it.id)}">${esc(t.nomeItem)}</button>` : esc(t.nomeItem));
  if(t.area && opts.area !== false) meta.push(esc(t.area));
  meta.push(t.resp ? esc(t.resp) : `<span class="atencao">sem responsável</span>`);
  if(t.forn && opts.forn !== false) meta.push(esc(t.forn));
  return `<li class="${t.status === "concluída" ? "feita" : ""}">
    <label class="alvo" title="Marcar como concluída"><input type="checkbox" class="marcar" data-t="${esc(t.idt)}" ${t.status === "concluída" ? "checked" : ""} aria-label="Concluir: ${esc(t.tarefa)}"></label>
    <div><div class="t-nome">${esc(t.tarefa)}</div><div class="t-meta">${meta.join(" · ")}</div></div>
    <div class="t-dir"><span class="tab peq">${t.prazo ? fSem(t.prazo) : "sem prazo"}</span>${pill(s.cls, s.txt)}</div></li>`;
}

function vGeral(){
  const acoes = acoesUrgentes();
  const ab = abertas().filter(doResp);
  const ordemItem = t => !t.it ? t.prazo : (t.it.ini >= HOJE ? t.it.ini : somar(HOJE, 3650));   // o que ainda vai acontecer vem primeiro
  const venc = ab.filter(t => t.atrasada).sort((a, b) => ordemItem(a) - ordemItem(b) || a.prazo - b.prazo);
  const hoje = ab.filter(t => t.dias === 0);
  const semana = ab.filter(t => t.dias > 0 && t.dias <= 7).sort((a, b) => a.prazo - b.prazo);
  const ac30 = itensNoPeriodo(HOJE, somar(HOJE, 30), i => i.statusData === "a confirmar" && i.ini >= HOJE && i.formato !== "Ciclo");
  const pessoas = [...new Set([...M.equipe, ...M.tarefas.map(t => t.resp).filter(Boolean).sort()])];

  const grupo = (titulo, lista, chave, limite = 6) => {
    if(!lista.length) return "";
    const aberto = LS.get("expandir-" + chave, false);
    const mostrar = aberto ? lista : lista.slice(0, limite);
    return `<div class="grupo-t"><div class="linha entre"><span class="rotulo">${titulo} · ${lista.length}</span>${lista.length > limite ? `<button class="btn texto" data-expandir="${chave}">${aberto ? "Mostrar menos" : "Ver todas"}</button>` : ""}</div>
      <ul class="lista-t">${mostrar.map(t => liTarefa(t)).join("")}</ul></div>`;
  };
  // alerta da lista
  let aLista;
  if(venc.length){
    const itensV = [...new Set(venc.map(t => t.nomeItem))];
    const semReg = venc.filter(t => t.status === "a verificar").length;
    aLista = `${plural(venc.length, "tarefa vencida", "tarefas vencidas")} em ${plural(itensV.length, "item", "itens")}` + (semReg ? `; ${semReg} delas nunca tiveram registro de conclusão, então vale primeiro marcar o que já foi feito.` : ".") + ` Nesta semana vencem mais ${semana.length + hoje.length}.`;
  } else aLista = semana.length ? `Nada vencido. ${plural(semana.length, "tarefa vence", "tarefas vencem")} nos próximos 7 dias.` : "Nada vencido e nada vencendo nos próximos 7 dias.";

  // faixa de 14 dias
  const dias = [...Array(14)].map((_, i) => somar(HOJE, i));
  const it14 = itensNoPeriodo(HOJE, somar(HOJE, 13), i => i.formato !== "Ciclo");
  const faixa = dias.map(d => {
    const doDia = it14.filter(i => i.ini <= d && i.fim >= d && (+i.ini === +d || +d === +HOJE || d.getDay() === 1 || dif(i.ini, i.fim) < 7));
    const f = M.feriados[chaveD(d)];
    return `<div class="d ${d.getDay() % 6 === 0 ? "fds" : ""} ${+d === +HOJE ? "hoje-d" : ""}">
      <div><span class="rotulo">${SEM_C[d.getDay()]}</span><div class="dn">${fData(d)}</div>${f ? `<span class="peq sec">${esc(f.nome)}</span>` : ""}</div>
      <div>${doDia.map(i => `<button class="chip ${CATS[i.cat]?.ext ? "ext" : ""} ${i.statusData === "a confirmar" ? "pend" : ""}" style="${estiloCat(i.cat)}" data-item="${esc(i.id)}" title="${esc(i.nome)} · ${esc(fPeriodo(i.ini, i.fim))}${i.statusData === "a confirmar" ? " · data a confirmar" : ""}">${esc(i.nome)}</button>`).join("")}</div></div>`;
  }).join("");
  const proprios14 = it14.filter(i => i.cat !== "Agenda externa" && i.ini >= HOJE);
  const conf14 = proprios14.filter(i => i.statusData === "a confirmar");
  const semResp14 = proprios14.filter(i => !i.resp);
  const a14 = proprios14.length ? `${plural(proprios14.length, "item começa", "itens começam")} nos próximos 14 dias` + (conf14.length ? `, ${conf14.length} com data a confirmar` : "") + (semResp14.length ? `; ${semResp14.length === proprios14.length ? "nenhum tem" : semResp14.length + " não têm"} responsável no calendário.` : ".") : "Nenhum item começa nos próximos 14 dias.";

  // campanha no ar e próximo evento
  const noAr = M.itens.filter(i => i.formato === "Campanha" && i.ini <= HOJE && i.fim >= HOJE);
  const proxCamp = M.itens.filter(i => i.formato === "Campanha" && i.ini > HOJE)[0];
  const blocoCamp = it => { const e = estadoCampanha(it); return `<button class="link-item h2" data-item="${esc(it.id)}" style="font-size:17px">${esc(it.nome)}</button>
      <p class="sec" style="margin:4px 0 8px">${fPeriodo(it.ini, it.fim)} · ${HOJE >= it.ini ? "termina " + quando(it.fim) : "começa " + quando(it.ini)}</p>
      <p style="margin:0">Etapa: <b>${nomeEtapa(e, e.real)}</b>${e.real < e.previsto ? ` <span class="atraso">· atrás do cronograma (deveria estar em ${M.etapas[e.previsto]})</span>` : ""}</p>`; };
  let campHtml, aCamp;
  if(noAr.length){ campHtml = noAr.map(blocoCamp).join(`<hr class="fina">`); aCamp = `${noAr.length > 1 ? "Há " + noAr.length + " campanhas no ar ao mesmo tempo: as peças disputam a mesma designer e o mesmo feed." : "Uma campanha no ar."}${proxCamp ? " A próxima, " + esc(proxCamp.nome) + ", começa " + quando(proxCamp.ini) + "." : ""}`; }
  else if(proxCamp){ campHtml = `<p class="sec" style="margin:0 0 8px">Nenhuma campanha no ar hoje. Próxima:</p>` + blocoCamp(proxCamp); const e = estadoCampanha(proxCamp); aCamp = e.real < e.previsto ? `${esc(proxCamp.nome)} está atrás do cronograma: as etapas até ${M.etapas[e.previsto - 1] || "o briefing"} já deveriam estar concluídas.` : `${esc(proxCamp.nome)} está em dia com o cronograma.`; }
  else { campHtml = `<p class="vazio">Nenhuma campanha cadastrada no calendário.</p>`; aCamp = ""; }

  const proxEv = M.itens.filter(i => ehEvento(i) && i.ini >= HOJE && i.statusData !== "cancelada")[0];
  let evHtml = `<p class="vazio">Nenhum evento à frente no calendário.</p>`, aEv = "";
  if(proxEv){
    const p = progresso(proxEv); const prox = proxEv.tarefas.find(t => t.aberta);
    evHtml = `<button class="link-item h2" data-item="${esc(proxEv.id)}" style="font-size:17px">${esc(proxEv.nome)}</button>
      <p class="sec" style="margin:4px 0 8px">${fPeriodo(proxEv.ini, proxEv.fim)} · ${quando(proxEv.ini)}</p>${pillData(proxEv)}
      <div style="margin-top:16px">${barraProg(p, p.atrasadas ? "alerta-b" : "")}</div>`;
    aEv = p.atrasadas ? `${plural(p.atrasadas, "tarefa", "tarefas")} do checklist já ${p.atrasadas === 1 ? "venceu" : "venceram"}${prox ? "; a próxima é “" + esc(prox.tarefa) + "”" : ""}.` : (prox ? `Checklist em dia; a próxima tarefa é “${esc(prox.tarefa)}” (${fSem(prox.prazo)}).` : "Checklist completo.");
  }

  // fora do radar
  const fora = M.tarefas.filter(t => t.origem === "fora do radar").sort((a, b) => (a.prazo || 0) - (b.prazo || 0));
  const foraAb = fora.filter(t => t.aberta);
  const horas = fora.reduce((s, t) => s + (parseFloat(String(t.horas).replace(",", ".")) || 0), 0);
  const aFora = fora.length ? `${plural(foraAb.length, "demanda aberta", "demandas abertas")} fora do calendário${foraAb.filter(t => t.atrasada).length ? ", " + foraAb.filter(t => t.atrasada).length + " vencida(s)" : ""}. Já consumiram ${String(horas).replace(".", ",")} h registradas.` : "Nenhuma demanda fora do calendário registrada. Registre cada pedido que chegar fora do planejado: é isso que mostra à gerência o tempo que ele consome.";

  return `<div class="grade vista">
    <section class="cartao c12" aria-labelledby="h-agir">
      <div class="cab"><h2 id="h-agir">Onde agir agora</h2>
        <label class="linha peq nao-imprimir"><span class="rotulo">Ver como</span>
          <select id="pessoa"><option value="todos">Toda a equipe</option><option value="sem" ${S.pessoa === "sem" ? "selected" : ""}>Sem responsável</option>${pessoas.map(p => `<option ${S.pessoa === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label></div>
      ${acoes.length ? `<ol class="agir">${acoes.map(a => `<li><p>${a.txt}</p>${a.alvo ? `<button class="btn" data-item="${esc(a.alvo)}">Abrir ${icone("i-seta", "p")}</button>` : "<span></span>"}</li>`).join("")}</ol>` : `<p class="vazio">Nada urgente. Bom momento para adiantar as tarefas das próximas semanas.</p>`}
      <div class="indicadores">
        <div><div class="rotulo">Vencidas</div><div class="num ${venc.length ? "atraso" : ""}">${venc.length}</div><div class="peq sec">${venc.length ? "tarefas com prazo passado" : "nenhuma tarefa vencida"}</div></div>
        <div><div class="rotulo">Vencem em 7 dias</div><div class="num">${hoje.length + semana.length}</div><div class="peq sec">${hoje.length ? plural(hoje.length, "vence", "vencem") + " hoje" : "nenhuma vence hoje"}</div></div>
        <div><div class="rotulo">Datas a confirmar · 30 dias</div><div class="num ${ac30.length ? "confirmar" : ""}">${ac30.length}</div><div class="peq sec">itens do calendário</div></div>
      </div>
    </section>
    <section class="cartao c8" aria-labelledby="h-lista">
      <div class="cab"><h2 id="h-lista">Tarefas: vencidas e desta semana</h2><span class="peq sec">Marque a caixa quando concluir</span></div>
      ${grupo("Vencidas", venc, "venc")}${grupo("Hoje", hoje, "hoje")}${grupo("Próximos 7 dias", semana, "semana")}
      ${!venc.length && !hoje.length && !semana.length ? `<p class="vazio">Nenhuma tarefa ${S.pessoa === "todos" ? "" : "desta pessoa "}para os próximos 7 dias.</p>` : ""}
      ${alerta(aLista)}
    </section>
    <div class="c4 pilha">
      <section class="cartao" aria-labelledby="h-camp"><div class="cab"><h2 id="h-camp">Campanha</h2><span class="rotulo">${noAr.length ? "no ar" : "a seguir"}</span></div>${campHtml}${alerta(aCamp)}</section>
      <section class="cartao" aria-labelledby="h-ev"><div class="cab"><h2 id="h-ev">Próximo evento</h2></div>${evHtml}${alerta(aEv)}</section>
    </div>
    <section class="cartao c12" aria-labelledby="h-14">
      <div class="cab"><h2 id="h-14">Próximos 14 dias</h2>${legendaCats(false)}</div>
      <div class="faixa">${faixa}</div>
      ${alerta(a14)}
    </section>
    <section class="cartao c12" aria-labelledby="h-fora">
      <div class="cab"><h2 id="h-fora">Fora do radar</h2><button class="btn" id="nova-demanda">${icone("i-mais", "p")}Registrar demanda</button></div>
      ${fora.length ? `<div class="rolar"><table><thead><tr><th>Demanda</th><th>Quem pediu</th><th>Responsável</th><th>Prazo</th><th>Horas</th><th>Status</th></tr></thead><tbody>
        ${fora.map(t => `<tr><td>${esc(t.tarefa)}${t.obs ? `<div class="peq sec">${esc(t.obs)}</div>` : ""}</td><td>${esc(t.solicitante || "—")}</td><td>${seletorResp(t.resp, `data-resp-tarefa="${esc(t.idt)}"`)}</td><td class="tab">${t.prazo ? fSem(t.prazo) : "—"}</td><td class="tab">${esc(t.horas || "—")}</td><td>${pillT(t)}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="vazio">Nada registrado ainda.</p>`}
      ${alerta(aFora)}
    </section>
  </div>`;
}

function legendaCats(interativa){
  return `<div class="legenda" ${interativa ? 'role="group" aria-label="Filtrar por tipo"' : ""}>${Object.keys(CATS).map(c => interativa
    ? `<button data-cat="${esc(c)}" aria-pressed="${S.cal.cats.has(c)}"><i style="background:${CATS[c].cor}"></i>${esc(c)}</button>`
    : `<span class="tipo"><i style="background:${CATS[c].cor}"></i>${esc(c)}</span>`).join("")}${interativa ? `<span class="tipo"><i class="fer"></i>Feriado</span>` : ""}</div>`;
}

/* =====================================================================
   CALENDÁRIO
   ===================================================================== */
const TIPOS_ANALITICOS = [
  ["todos","Todos os itens"], ["promo","Campanha promocional (1º e 2º Liquidecora)"], ["inst","Institucional 1 e 2"],
  ["bw","Black Week"], ["natal","Natal"], ["fixo","Eventos fixos"], ["pontual","Eventos pontuais"], ["prime","Marcos do Casapark Prime"],
];
function tipoAnalitico(i, t){
  switch(t){
    case "todos": return true;
    case "promo": return /Liquidecora/.test(i.campanha);
    case "inst": return /^Institucional/.test(i.campanha);
    case "bw": return i.campanha === "Black Week";
    case "natal": return i.campanha === "Natal";
    case "fixo": return ehEvento(i) && i.cat !== "Campanha" && ehFixo(i);
    case "pontual": return ehEvento(i) && i.cat !== "Campanha" && !ehFixo(i);
    case "prime": return i.cat === "Casapark Prime" && ["Fechamento","Ciclo","Viagem","Evento"].includes(i.formato);
  }
  return true;
}
function itensCal(a, b){ return itensNoPeriodo(a, b, i => S.cal.cats.has(i.cat) && tipoAnalitico(i, S.cal.tipo) && (i.formato !== "Ciclo" || S.cal.tipo === "prime")); }

function vCalendario(){
  const ano = S.cal.ano;
  const anos = M.anos.filter(a => a >= 2026);
  const filtros = `<div class="filtros">
    <div class="segmentado" role="group" aria-label="Ano">${anos.map(a => `<button data-cal-ano="${a}" aria-pressed="${a === ano}">${a}${a < HOJE.getFullYear() ? " · histórico" : ""}</button>`).join("")}</div>
    <div class="segmentado" role="group" aria-label="Visão"><button data-cal-visao="anual" aria-pressed="${S.cal.visao === "anual"}">Anual</button><button data-cal-visao="mensal" aria-pressed="${S.cal.visao === "mensal"}">Mensal</button></div>
    <select id="cal-tipo" aria-label="Tipo de item">${TIPOS_ANALITICOS.map(([v, n]) => `<option value="${v}" ${S.cal.tipo === v ? "selected" : ""}>${n}</option>`).join("")}</select>
  </div>`;
  const corpo = S.cal.visao === "anual" ? calAnual(ano) : calMensal(ano, S.cal.mes);
  return `<div class="vista">${filtros}
    <section class="cartao" style="margin-bottom:24px"><div class="cab"><h2>${S.cal.visao === "anual" ? "Ano de " + ano : MESES[S.cal.mes][0].toUpperCase() + MESES[S.cal.mes].slice(1) + " de " + ano}</h2>${S.cal.visao === "mensal" ? `<div class="linha nao-imprimir"><button class="btn" data-cal-mes="-1" aria-label="Mês anterior">${icone("i-esq", "p")}</button><button class="btn" data-cal-mes="1" aria-label="Próximo mês">${icone("i-dir", "p")}</button></div>` : ""}</div>
      <div class="nao-imprimir" style="margin-bottom:16px">${legendaCats(true)}</div>${corpo}</section>
    ${S.cal.visao === "anual" ? analiseAno(ano) : ""}</div>`;
}

function calAnual(ano){
  const cab = `<div class="ano-cab"><span></span>${[...Array(31)].map((_, i) => `<span>${i + 1}</span>`).join("")}</div>`;
  const meses = [...Array(12)].map((_, m) => {
    const ini = new Date(ano, m, 1), fim = new Date(ano, m + 1, 0), nd = fim.getDate();
    const its = itensCal(ini, fim).sort((a, b) => a.ini - b.ini || dif(b.ini, b.fim) - dif(a.ini, a.fim));
    const faixas = [];
    const barras = its.map(i => {
      const a = i.ini < ini ? 1 : i.ini.getDate(), b = i.fim > fim ? nd : i.fim.getDate();
      const bv = Math.min(Math.max(b, a + 4), 31);           // espaço visual para o nome
      let f = faixas.findIndex(x => x < a); if(f === -1){ f = faixas.length; faixas.push(0); } faixas[f] = bv;
      const fr = ((b - a + 1) / (bv - a + 1)).toFixed(3);
      return `<button class="barra-item ${CATS[i.cat]?.ext ? "ext" : ""} ${i.ini < ini ? "continua" : ""}" style="grid-column:${a + 1}/${bv + 2};grid-row:${f + 1};--f:${fr};--bg:${rgba(corCat(i.cat), i.cat === "Agenda externa" ? .06 : .12)};border-left-color:${corCat(i.cat)}" data-item="${esc(i.id)}" title="${esc(i.nome)} · ${esc(fPeriodo(i.ini, i.fim))}${i.statusData !== "confirmada" ? " · " + i.statusData : ""}">${esc(i.nome)}</button>`;
    }).join("");
    const linhas = Math.max(faixas.length, 1);
    const fundos = [...Array(31)].map((_, d) => {
      const dia = new Date(ano, m, d + 1); const fora = d + 1 > nd;
      const f = !fora && M.feriados[chaveD(dia)];
      const cls = fora ? "fora" : (f && f.formato !== "Data comercial" ? "feriado" : (dia.getDay() % 6 === 0 ? "fds" : ""));
      return `<div class="fundo ${cls} ${!fora && +dia === +HOJE ? "hoje-col" : ""}" style="grid-column:${d + 2}" ${f ? `title="${esc(f.nome)}"` : ""}></div>`;
    }).join("");
    return `<div class="ano-mes" style="grid-template-rows:repeat(${linhas},22px)"><div class="m-nome">${MES_C[m]}</div>${fundos}${barras}</div>`;
  }).join("");
  return `<div class="ano">${cab}${meses}</div><p class="peq sec" style="margin:16px 0 0">Faixas sombreadas: fins de semana. Hachura: feriado. Borda tracejada: agenda externa. Passe o mouse para ver o nome completo e clique para abrir a ficha.</p>`;
}

function calMensal(ano, mes){
  const ini = new Date(ano, mes, 1), fim = new Date(ano, mes + 1, 0);
  const g0 = inicioSemana(ini);
  const semanas = Math.ceil((dif(g0, fim) + 1) / 7);
  const its = itensCal(ini, fim);
  const longos = its.filter(i => dif(i.ini, i.fim) >= 7);
  const curtos = its.filter(i => dif(i.ini, i.fim) < 7);
  const cel = [...Array(semanas * 7)].map((_, k) => {
    const d = somar(g0, k); const fora = d.getMonth() !== mes;
    const f = M.feriados[chaveD(d)];
    const doDia = fora ? [] : curtos.filter(i => i.ini <= d && i.fim >= d);
    const max = 4;
    return `<div class="cel ${fora ? "outro" : ""} ${d.getDay() % 6 === 0 ? "fds" : ""} ${f && f.formato !== "Data comercial" && !fora ? "feriado" : ""} ${+d === +HOJE ? "hoje-d" : ""}">
      <span class="dn">${d.getDate()}</span>${f && !fora ? `<span class="fer-nome">${esc(f.nome)}</span>` : ""}
      ${doDia.slice(0, max).map(i => `<button class="chip ${CATS[i.cat]?.ext ? "ext" : ""} ${i.statusData === "a confirmar" ? "pend" : ""}" style="${estiloCat(i.cat)}" data-item="${esc(i.id)}" title="${esc(i.nome)}${i.hora ? " · " + i.hora : ""}">${i.hora ? `<span class="tab">${esc(i.hora)}</span> ` : ""}${esc(i.nome)}</button>`).join("")}
      ${doDia.length > max ? `<button class="btn texto peq" data-dia="${chaveD(d)}">+${doDia.length - max} itens</button>` : ""}</div>`;
  }).join("");
  return `${longos.length ? `<div class="no-ar"><span class="rotulo">Em andamento no mês</span>${longos.map(i => `<button class="chip" style="${estiloCat(i.cat)};white-space:normal" data-item="${esc(i.id)}">${esc(i.nome)} · ${fPeriodo(i.ini, i.fim)}</button>`).join("")}</div>` : ""}
    <div class="mes-grade">${["seg","ter","qua","qui","sex","sáb","dom"].map(s => `<div class="ds rotulo">${s}</div>`).join("")}${cel}</div>
    <p class="peq sec nao-imprimir" style="margin:16px 0 0">Itens com contorno: data a confirmar. Para imprimir em A4 horizontal, use o botão Imprimir.</p>`;
}

function cargaSemanal(ano){
  const sem = {};
  M.tarefas.filter(t => t.prazo && t.status !== "cancelada" && t.tipo !== "registro" && t.prazo.getFullYear() >= ano - 1).forEach(t => {
    const [a, w] = semanaISO(t.prazo); if(a !== ano) return;
    (sem[w] ||= {n: 0, itens: {}}).n++;
    sem[w].itens[t.nomeItem] = (sem[w].itens[t.nomeItem] || 0) + 1;
  });
  const total = semanaISO(new Date(ano, 11, 28))[1];
  return [...Array(total)].map((_, i) => ({w: i + 1, ...(sem[i + 1] || {n: 0, itens: {}})}));
}
function segundaDaSemana(ano, w){ const j4 = new Date(ano, 0, 4); return somar(inicioSemana(j4), (w - 1) * 7); }

function sobreposicoes(ano){
  const grandes = M.itens.filter(i => i.ini.getFullYear() === ano && i.statusData !== "cancelada" && (["Campanha","Ação de campanha","Evento","Viagem","Feira"].includes(i.formato)) && i.cat !== "Feriado");
  const pares = [];
  for(let a = 0; a < grandes.length; a++) for(let b = a + 1; b < grandes.length; b++){
    const x = grandes[a], y = grandes[b];
    if(!(x.ini <= y.fim && y.ini <= x.fim)) continue;
    if(x.campanha && x.campanha === y.campanha) continue;
    if(x.nome.split(" – ")[0] === y.nome.split(" – ")[0]) continue;
    const ambasCamp = x.formato === "Campanha" && y.formato === "Campanha";
    const umaCamp = (x.formato === "Campanha") !== (y.formato === "Campanha");
    if(umaCamp && !["Viagem"].includes((x.formato === "Campanha" ? y : x).formato)) continue; // evento dentro de campanha é normal
    const ini = x.ini > y.ini ? x.ini : y.ini, fim = x.fim < y.fim ? x.fim : y.fim;
    pares.push({x, y, ini, fim, dias: dif(ini, fim) + 1, peso: ambasCamp ? 3 : 1});
  }
  return pares.sort((a, b) => a.ini - b.ini);
}

function analiseAno(ano){
  const sem = cargaSemanal(ano);
  const max = Math.max(10, ...sem.map(s => s.n));
  const ord = [...sem].sort((a, b) => b.n - a.n);
  const picos = new Set(ord.slice(0, 5).filter(s => s.n > 0).map(s => s.w));
  const media = sem.reduce((s, x) => s + x.n, 0) / sem.length;
  const W = 960, H = 200, pe = 24, esq = 32, larg = (W - esq) / sem.length;
  const y = v => H - pe - (v / max) * (H - pe - 16);
  const passo = max > 30 ? 10 : 5;
  const grades = [...Array(Math.floor(max / passo) + 1)].map((_, i) => i * passo).map(v => `<line x1="${esq}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#E5E5EA"/><text x="${esq - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#86868B">${v}</text>`).join("");
  const [aH, wH] = semanaISO(HOJE);
  const meses = [...Array(12)].map((_, m) => { const w = semanaISO(new Date(ano, m, 1))[1]; const wx = (semanaISO(new Date(ano, m, 1))[0] !== ano) ? 1 : w; return `<text x="${esq + (wx - 1) * larg}" y="${H - 6}" font-size="11" fill="#86868B">${MES_C[m]}</text>`; }).join("");
  const barras = sem.map((s, i) => {
    const x = esq + i * larg + 1, h = H - pe - y(s.n), w = Math.max(larg - 2, 2);
    return `${s.n ? `<rect x="${x}" y="${y(s.n)}" width="${w}" height="${h}" rx="2" fill="${picos.has(s.w) ? "#007AFF" : "#C7C7CC"}"/>` : ""}
      ${ano === aH && s.w === wH ? `<line x1="${x + w / 2}" x2="${x + w / 2}" y1="8" y2="${H - pe}" stroke="#1D1D1F" stroke-dasharray="2 3"/><text x="${x + w / 2 + 4}" y="14" font-size="11" fill="#1D1D1F">hoje</text>` : ""}
      <rect class="alvo-semana" data-w="${s.w}" x="${esq + i * larg}" y="0" width="${larg}" height="${H - pe}" fill="transparent"/>`;
  }).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tarefas com prazo por semana em ${ano}">${grades}${meses}${barras}</svg>`;
  const top = ord.slice(0, 5).filter(s => s.n);
  const topHtml = top.map(s => { const seg = segundaDaSemana(ano, s.w); const its = Object.entries(s.itens).sort((a, b) => b[1] - a[1]); return `<tr><td class="tab">Semana ${s.w}<div class="peq sec">${fData(seg)} a ${fData(somar(seg, 6))}</div></td><td class="tab">${s.n}</td><td>${its.slice(0, 4).map(([n, q]) => `${esc(n)} <span class="sec">(${q})</span>`).join(", ")}${its.length > 4 ? ` <span class="sec">e mais ${its.length - 4}</span>` : ""}</td></tr>`; }).join("");
  const sob = sobreposicoes(ano);
  const sobHtml = sob.length ? sob.map(p => `<tr><td class="tab">${fPeriodo(p.ini, p.fim)}</td><td><button class="link-item" data-item="${esc(p.x.id)}">${esc(p.x.nome)}</button> <span class="sec">×</span> <button class="link-item" data-item="${esc(p.y.id)}">${esc(p.y.nome)}</button></td><td>${p.peso === 3 ? pill("atencao", "Duas campanhas") : pill("neutro", plural(p.dias, "dia"))}</td></tr>`).join("") : "";
  const conf = conflitosRegra(ano);
  const pior = top[0];
  const aCarga = pior ? `A semana ${pior.w} (${fData(segundaDaSemana(ano, pior.w))}) concentra ${pior.n} prazos, ${(pior.n / Math.max(media, 1)).toFixed(1).replace(".", ",")} vezes a média de ${media.toFixed(0)} por semana. ${Object.keys(pior.itens).length} itens disputam a equipe nessa semana: é o maior risco de gargalo do ano.` : "Sem tarefas com prazo neste ano.";
  return `<div class="grade">
    <section class="cartao c12" aria-labelledby="h-carga"><div class="cab"><h2 id="h-carga">Carga de prazos por semana</h2><span class="peq sec">Barras em madeira: as cinco semanas mais carregadas</span></div>
      <div class="grafico" id="grafico-carga">${svg}<div class="dica" id="dica"></div></div>
      <div class="rolar" style="margin-top:16px"><table><thead><tr><th>Semana</th><th>Prazos</th><th>Itens que concentram</th></tr></thead><tbody>${topHtml}</tbody></table></div>
      ${alerta(aCarga)}</section>
    <section class="cartao c7" aria-labelledby="h-sob"><div class="cab"><h2 id="h-sob">Sobreposição de entregas</h2></div>
      ${sob.length ? `<div class="rolar"><table><thead><tr><th>Quando</th><th>O que se sobrepõe</th><th></th></tr></thead><tbody>${sobHtml}</tbody></table></div>` : `<p class="vazio">Nenhuma sobreposição entre campanhas e eventos grandes.</p>`}
      ${alerta(sob.filter(p => p.peso === 3).length ? `${sob.filter(p => p.peso === 3).map(p => esc(p.x.nome) + " e " + esc(p.y.nome)).join("; ")} ficam no ar juntas: planeje as peças das duas no mesmo briefing.` : (sob.length ? "As sobreposições são entre eventos, sem duas campanhas ao mesmo tempo." : ""))}</section>
    <section class="cartao c5" aria-labelledby="h-conf"><div class="cab"><h2 id="h-conf">Datas que quebram a regra</h2></div>
      ${conf.length ? `<ul class="lista-t">${conf.map(c => `<li style="grid-template-columns:minmax(0,1fr) auto"><div><button class="link-item t-nome" data-item="${esc(c.it.id)}">${esc(c.it.nome)}</button><div class="t-meta">${esc(c.txt)}</div></div><span class="tab peq">${fSem(c.it.ini)}</span></li>`).join("")}</ul>` : `<p class="vazio">Todas as rotinas seguem a regra.</p>`}
      ${alerta(conf.length ? `${plural(conf.length, "data precisa", "datas precisam")} de decisão antes de virar “confirmada”.` : "")}</section>
  </div>`;
}

function conflitosRegra(ano){
  const r = [];
  M.itens.filter(i => i.ini.getFullYear() === ano && i.statusData !== "cancelada").forEach(i => {
    if(i.formato === "Briefing" && naoUtil(i.ini)) r.push({it: i, txt: "o dia 10 " + avisoDiaUtil(i)});
    if(i.formato === "Fechamento"){ const esperado = proximoUtil(new Date(i.ini.getFullYear(), i.ini.getMonth(), 5)); if(+esperado !== +i.ini) r.push({it: i, txt: `pela regra (dia 5 ou próximo dia útil) seria ${fSem(esperado)}`}); }
    if(i.nome === "Casa Vintage"){
      const s = new Date(i.ini.getFullYear(), i.ini.getMonth(), 1); while(s.getDay() !== 6) s.setDate(s.getDate() + 1);
      if(+s !== +i.ini) r.push({it: i, txt: `o primeiro fim de semana do mês é ${fData(s)}–${fData(somar(s, 1))}`});
      const f = M.feriados[chaveD(i.ini)] || M.feriados[chaveD(i.fim)];
      if(f && f.formato === "Feriado") r.push({it: i, txt: `cai no feriado de ${f.nome}: confirmar com o organizador`});
    }
  });
  return r;
}

/* =====================================================================
   EVENTOS
   ===================================================================== */
function listaEventos(){
  let evs = M.itens.filter(ehEvento);
  if(S.ev.filtro === "proximos") evs = evs.filter(i => i.fim >= HOJE);
  else evs = evs.filter(i => i.ini.getFullYear() === +S.ev.filtro);
  if(S.ev.rec === "fixos") evs = evs.filter(ehFixo); else if(S.ev.rec === "pontuais") evs = evs.filter(i => !ehFixo(i));
  return evs;
}
function vEventos(){
  const evs = listaEventos();
  if(!S.ev.sel || !evs.some(e => e.id === S.ev.sel)) S.ev.sel = (evs.find(e => e.fim >= HOJE) || evs[0] || {}).id;
  const sel = M.porId[S.ev.sel];
  const anos = M.anos.filter(a => a >= 2026);
  // etapas que mais ficam para trás (todas as tarefas de evento com prazo já passado)
  const passadas = M.tarefas.filter(t => t.it && ehEvento(t.it) && t.prazo && t.prazo < HOJE && t.tipo !== "registro" && t.status !== "cancelada");
  const porArea = {};
  passadas.forEach(t => { const a = porArea[t.area] ||= {total: 0, abertas: 0}; a.total++; if(t.aberta) a.abertas++; });
  const areas = Object.entries(porArea).map(([n, v]) => ({n, ...v, pct: Math.round(100 * v.abertas / v.total)})).sort((a, b) => b.pct - a.pct || b.abertas - a.abertas);
  const comAtraso = M.itens.filter(i => ehEvento(i) && i.fim >= somar(HOJE, -14) && i.tarefas.some(t => t.atrasada));
  const lista = evs.map(e => { const p = progresso(e); return `<li><button data-ev="${esc(e.id)}" aria-current="${e.id === S.ev.sel}">
      <span class="data-bloco">${fData(e.ini)}<small>${SEM_C[e.ini.getDay()]} · ${e.ini.getFullYear()}</small></span>
      <span style="min-width:0"><span style="display:block;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.nome)}</span><span class="peq sec">${recNome(e)}${e.statusData !== "confirmada" ? " · " + esc(e.statusData) : ""}</span></span>
      <span style="width:96px">${p.atrasadas ? `<span class="pill atraso" style="margin-bottom:4px">${p.atrasadas} vencida${p.atrasadas > 1 ? "s" : ""}</span>` : ""}${barraProg(p)}</span></button></li>`; }).join("");
  return `<div class="vista"><div class="filtros">
      <div class="segmentado" role="group" aria-label="Período"><button data-ev-filtro="proximos" aria-pressed="${S.ev.filtro === "proximos"}">Próximos</button>${anos.map(a => `<button data-ev-filtro="${a}" aria-pressed="${S.ev.filtro === String(a)}">${a}</button>`).join("")}</div>
      <div class="segmentado" role="group" aria-label="Recorrência"><button data-ev-rec="todos" aria-pressed="${S.ev.rec === "todos"}">Todos</button><button data-ev-rec="fixos" aria-pressed="${S.ev.rec === "fixos"}">Fixos</button><button data-ev-rec="pontuais" aria-pressed="${S.ev.rec === "pontuais"}">Pontuais</button></div>
    </div>
    <div class="grade">
      <section class="cartao c5" aria-labelledby="h-lev"><div class="cab"><h2 id="h-lev">${plural(evs.length, "evento")}</h2></div><ul class="lista-ev">${lista || `<li class="vazio">Nenhum evento neste filtro.</li>`}</ul>
        ${alerta(comAtraso.length ? `${plural(comAtraso.length, "evento está", "eventos estão")} com tarefas vencidas: ${comAtraso.slice(0, 4).map(i => esc(i.nome)).join(", ")}${comAtraso.length > 4 ? "…" : ""}.` : "Nenhum evento com tarefa vencida.")}</section>
      <section class="cartao c7" aria-live="polite">${sel ? ficha(sel) : `<p class="vazio">Escolha um evento.</p>`}</section>
      <section class="cartao c12" aria-labelledby="h-esq"><div class="cab"><h2 id="h-esq">Etapas que mais ficam para trás</h2><span class="peq sec">Tarefas de evento com prazo já passado, por área</span></div>
        ${areas.length ? `<div class="rolar"><table><thead><tr><th>Área</th><th>Prazos passados</th><th>Sem conclusão</th><th style="width:30%">Proporção</th></tr></thead><tbody>${areas.map(a => `<tr><td>${esc(a.n)}</td><td class="tab">${a.total}</td><td class="tab">${a.abertas}</td><td>${barraProg({pct: a.pct}, "alerta-b")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="vazio">Ainda não há prazos passados para comparar.</p>`}
        ${alerta(areas.length ? `${esc(areas[0].n)} é a área que mais fica sem registro (${areas[0].pct}% dos prazos passados). Na base de 2026, alvarás e segurança, relatório final e envio de fotos nunca aparecem como tarefa: são as etapas com mais chance de serem esquecidas.` : "")}</section>
    </div></div>`;
}

function ficha(it, completa){
  const p = progresso(it);
  const lojas = it.lojas ? it.lojas.split("|").map(s => s.trim()).filter(Boolean) : [];
  const forn = [...new Set([...(it.forn ? it.forn.split("|") : []), ...it.tarefas.map(t => t.forn)].map(s => (s || "").trim()).filter(Boolean))];
  const ts = it.tarefas.filter(t => t.tipo !== "registro");
  let corpo = "";
  if(it.formato === "Campanha" && completa !== false){
    corpo = fichaCampanha(it);
  } else if(ts.length){
    corpo = FASES.map(f => {
      const doFase = ts.filter(t => t.fase === f);
      if(!doFase.length) return "";
      const pf = progresso({tarefas: doFase});
      const prazoF = doFase[0].prazo;
      return `<div class="fase"><div class="fase-cab"><h3>${f === "Dia D" || f === "Pós-evento" ? f : f + " antes"} <span class="peq sec tab" style="font-weight:400">· ${prazoF ? fSem(prazoF) : ""}</span></h3>${barraProg(pf, pf.atrasadas ? "alerta-b" : "").replace(/<span class="tab peq">.*?<\/span>/, "")}<span class="tab peq" style="text-align:right">${pf.pct}%</span></div>
        <ul class="chk">${doFase.map(t => liTarefa(t, {item: false})).join("")}</ul></div>`;
    }).join("");
  } else {
    const r = it.tarefas.find(t => t.tipo === "registro");
    corpo = `<p class="vazio">${r ? "Item do histórico: registrado como " + esc(r.status) + "." : "Este tipo de item não tem checklist."}</p>`;
  }
  const dItem = dif(HOJE, it.ini);
  const qd = dItem > 0 ? "faltam " + plural(dItem, "dia") : (HOJE <= it.fim ? "acontecendo" : "realizado");
  const proxAberta = ts.find(t => t.aberta);
  let aF;
  if(p.atrasadas) aF = `${plural(p.atrasadas, "tarefa vencida", "tarefas vencidas")}${dItem > 0 ? ` a ${plural(dItem, "dia")} do evento` : ""}. A mais antiga: “${esc(ts.find(t => t.atrasada).tarefa)}”.`;
  else if(proxAberta) aF = `Em dia. Próxima tarefa: “${esc(proxAberta.tarefa)}”, ${quando(proxAberta.prazo)}.`;
  else aF = ts.length ? "Checklist concluído." : "";
  if(!it.resp && ts.some(t => t.aberta)) aF += " Falta definir o responsável no calendário.";
  if(it.statusData === "a confirmar" && dItem > 0) aF += ` A data ainda está a confirmar${dItem <= 60 ? " e os prazos de 60 e 30 dias dependem dela" : ""}.`;
  return `<div class="cab" style="margin-bottom:8px"><div><span class="rotulo">${esc(it.formato)} · ${recNome(it)}</span><h2 style="margin-top:4px">${esc(it.nome)}</h2></div>${pillData(it)}</div>
    <p class="sec" style="margin:0">${fPeriodo(it.ini, it.fim)}${it.hora ? " · " + esc(it.hora) : ""} · ${qd}</p>
    <dl class="fatos">
      <div><dt>Tipo</dt><dd>${tipoCat(it.cat)}</dd></div>
      ${it.campanha ? `<div><dt>Campanha</dt><dd>${esc(it.campanha)}</dd></div>` : ""}
      <div><dt>Responsável</dt><dd>${seletorResp(it.resp, `data-resp-item="${esc(it.id)}"`)}<div class="peq sec" style="margin-top:4px">vale para todas as tarefas deste item</div></dd></div>
      <div><dt>Fornecedores</dt><dd>${forn.length ? forn.map(esc).join(", ") : "—"}</dd></div>
      <div><dt>Lojas participantes</dt><dd>${lojas.length ? lojas.map(esc).join(", ") : "—"}</dd></div>
      <div><dt>Regra da data</dt><dd>${esc(it.regra || "data definida pela equipe")}${it.ref ? `<div class="peq sec">ano anterior: ${esc(it.ref)}</div>` : ""}</dd></div>
      ${ts.length ? `<div><dt>Checklist</dt><dd>${p.feitas} de ${p.total} · ${barraProg(p)}</dd></div>` : ""}
    </dl>
    ${it.obs ? `<p class="peq sec" style="margin:16px 0 0">Observação: ${esc(it.obs)}</p>` : ""}
    ${corpo}${alerta(aF)}`;
}

/* =====================================================================
   CAMPANHAS
   ===================================================================== */
function fichaCampanha(it){
  const e = estadoCampanha(it);
  const ligados = M.itens.filter(i => i !== it && i.campanha === it.campanha && Math.abs(dif(it.ini, i.ini)) < 120);
  return `${e.etapas.map((et, k) => `<div class="fase"><div class="fase-cab"><h3>${k + 1}. ${et.nome} <span class="peq sec tab" style="font-weight:400">· ${et.prazo ? "até " + fSem(et.prazo) : ""}</span></h3>${barraProg(progresso({tarefas: et.ts}), et.atrasada ? "alerta-b" : "").replace(/<span class="tab peq">.*?<\/span>/, "")}<span class="tab peq" style="text-align:right">${progresso({tarefas: et.ts}).pct}%</span></div>
    <ul class="chk">${et.ts.map(t => liTarefa(t, {item: false, area: false})).join("")}</ul></div>`).join("")}
    ${ligados.length ? `<div class="fase"><div class="fase-cab"><h3>Itens ligados à campanha</h3><span></span><span></span></div><ul class="chk">${ligados.map(i => `<li style="grid-template-columns:minmax(0,1fr) auto"><button class="link-item" data-item="${esc(i.id)}">${esc(i.nome)}</button><span class="tab peq">${fPeriodo(i.ini, i.fim)}</span></li>`).join("")}</ul></div>` : ""}`;
}
function cartaoCampanha(c){
  if(!c.it) return `<section class="cartao c4"><span class="rotulo">Campanha</span><h3 style="margin:4px 0 8px">${esc(c.nome)}</h3><p class="vazio">Não está no calendário deste ano.</p>${alerta("Inclua a campanha no calendário para gerar etapas e entregas.")}</section>`;
  const {it, etapas, real, previsto, cont, pecas} = c;
  const totalP = pecas.length - cont.cancelada;
  const segs = [["concluida","#34C759","concluídas"],["andamento","#5AC8FA","em andamento"],["fazer","#E5E5EA","a fazer"],["atrasada","#FF3B30","atrasadas"]];
  const d = dif(HOJE, it.ini);
  const fase = HOJE > it.fim ? "encerrada" : HOJE >= it.ini ? "no ar" : "em preparação";
  const proxT = it.tarefas.filter(t => t.aberta).sort((a, b) => a.prazo - b.prazo)[0];
  let aC;
  if(cont.atrasada) aC = `${plural(cont.atrasada, "entrega vencida", "entregas vencidas")}${d > 0 ? ` a ${plural(d, "dia")} do lançamento` : ""}; a etapa real (${nomeEtapa(c, real)}) está atrás da prevista (${M.etapas[previsto]}).`;
  else if(real < previsto) aC = `Atrás do cronograma: deveria estar em ${M.etapas[previsto]}.`;
  else if(proxT) aC = `Em dia. Próximo passo: “${esc(proxT.tarefa)}”, ${quando(proxT.prazo)}.`;
  else aC = "Todas as etapas concluídas.";
  if(it.statusData === "a confirmar" && d > 0) aC += " As datas ainda estão a confirmar.";
  return `<section class="cartao c4"><div class="cab" style="margin-bottom:8px"><span class="rotulo">${fase}</span>${pillData(it)}</div>
    <h3><button class="link-item" data-item="${esc(it.id)}" style="font:inherit">${esc(c.nome)}</button></h3>
    <p class="sec peq" style="margin:4px 0 0">${fPeriodo(it.ini, it.fim)} · ${d > 0 ? "começa " + quando(it.ini) : fase === "no ar" ? "termina " + quando(it.fim) : "terminou"}</p>
    <div class="etapas" role="img" aria-label="Etapa atual: ${nomeEtapa(c, real)}">${etapas.map((et, k) => `<span class="${k < real ? "feita" : k === real ? (et.atrasada ? "atrasada" : "atual") : ""}" title="${et.nome}: ${k < real ? "concluída" : k === real ? "atual" : "a seguir"}"></span>`).join("")}</div>
    <p style="margin:0">Etapa atual: <b>${nomeEtapa(c, real)}</b>${real < previsto ? ` <span class="atraso peq">· atrasada</span>` : ""}</p>
    <hr class="fina"><span class="rotulo">Entregas · ${totalP}</span>
    <div class="empilhada" role="img" aria-label="${segs.map(s => cont[s[0]] + " " + s[2]).join(", ")}">${segs.filter(s => cont[s[0]]).map(s => `<i style="flex:${cont[s[0]]};background:${s[1]}"></i>`).join("")}</div>
    <div class="contagens">${segs.map(s => `<span><b>${cont[s[0]]}</b> ${s[2]}</span>`).join("")}</div>
    ${alerta(aC)}</section>`;
}
function vCampanhas(){
  const ano = S.camp.ano;
  const cs = campanhas(ano);
  const outras = M.itens.filter(i => i.ini.getFullYear() === ano && i.cat === "Campanha" && i.formato === "Ação de campanha");
  const noAr = M.itens.filter(i => i.formato === "Campanha" && i.ini <= HOJE && i.fim >= HOJE);
  const sobre = cs.filter(c => c.it).filter((c, k, arr) => arr.some(o => o !== c && o.it.ini <= c.it.fim && c.it.ini <= o.it.fim));
  const atrasadas = cs.filter(c => c.it && c.real < c.previsto);
  const anos = M.anos.filter(a => a >= 2026);
  return `<div class="vista"><div class="filtros"><div class="segmentado" role="group" aria-label="Ano">${anos.map(a => `<button data-camp-ano="${a}" aria-pressed="${a === ano}">${a}</button>`).join("")}</div>
    <span class="sec">${noAr.length ? "No ar hoje: " + noAr.map(i => esc(i.nome) + " (" + fPeriodo(i.ini, i.fim) + ")").join(", ") : "Nenhuma campanha no ar hoje."}</span></div>
    <div class="grade">${cs.map(cartaoCampanha).join("")}
    <section class="cartao c12"><div class="cab"><h2>Leitura do ano</h2></div>
      <p style="margin:0;max-width:75ch">${atrasadas.length ? `${plural(atrasadas.length, "campanha está", "campanhas estão")} atrás do cronograma: ${atrasadas.map(c => esc(c.nome)).join(", ")}. ` : "Todas as campanhas estão em dia com o cronograma. "}${sobre.length ? `${sobre.map(c => esc(c.nome)).join(" e ")} se sobrepõem no ar: o briefing das duas deve sair junto, para a agência e a designer não produzirem em paralelo na última hora.` : ""}</p>
      ${outras.length ? `<p class="sec" style="margin:16px 0 0">Outras ações de campanha no ano (fora das seis): ${outras.map(i => `<button class="link-item" data-item="${esc(i.id)}">${esc(i.nome)}</button> (${fPeriodo(i.ini, i.fim)})`).join(", ")}.</p>` : ""}
    </section></div></div>`;
}

/* =====================================================================
   REDES SOCIAIS
   ===================================================================== */
function pautaDoMes(ano, mes){
  const ini = new Date(ano, mes, 1), fim = new Date(ano, mes + 1, 0);
  return M.tarefas.filter(t => t.tipo === "pauta" && t.prazo && t.prazo >= ini && t.prazo <= fim && t.status !== "cancelada")
    .map(t => ({t, d: t.prazo, tipo: t.it && t.it.cat === "Campanha" ? "campanha" : "rotina"})).sort((a, b) => a.d - b.d);
}
function vRedes(){
  const {ano, mes} = S.redes;
  const ini = new Date(ano, mes, 1), fim = new Date(ano, mes + 1, 0);
  const pauta = pautaDoMes(ano, mes);
  const nRot = pauta.filter(p => p.tipo === "rotina").length, nCamp = pauta.length - nRot;
  const camps = itensNoPeriodo(ini, fim, i => i.formato === "Campanha" || i.formato === "Ação de campanha");
  // briefing: o desta pauta (mês anterior) e o da próxima (neste mês)
  const brEste = M.itens.find(i => i.formato === "Briefing" && i.ini.getFullYear() === new Date(ano, mes - 1, 1).getFullYear() && i.ini.getMonth() === (mes + 11) % 12);
  const brProx = M.itens.find(i => i.formato === "Briefing" && i.ini.getFullYear() === ano && i.ini.getMonth() === mes);
  const linhaBr = (br, rot) => br ? `<div><span class="rotulo">${rot}</span><p style="margin:4px 0 0"><button class="link-item" data-item="${esc(br.id)}">${fSem(br.ini)}</button> ${br.ini < HOJE ? pill(br.tarefas.every(t => t.status === "concluída") ? "ok" : "atraso", br.tarefas.every(t => t.status === "concluída") ? "Enviado" : "Sem registro de envio") : (dif(HOJE, br.ini) <= 7 ? pill("atencao", "Vence " + quando(br.ini)) : pill("neutro", "Faltam " + plural(dif(HOJE, br.ini), "dia")))}</p>${avisoDiaUtil(br) ? `<p class="peq atencao" style="margin:4px 0 0">Atenção: ${esc(avisoDiaUtil(br))}</p>` : ""}</div>` : `<div><span class="rotulo">${rot}</span><p class="sec" style="margin:4px 0 0">Não há briefing no calendário.</p></div>`;
  // grade do mês
  const g0 = inicioSemana(ini); const semanas = Math.ceil((dif(g0, fim) + 1) / 7);
  const cel = [...Array(semanas * 7)].map((_, k) => {
    const d = somar(g0, k); const fora = d.getMonth() !== mes;
    const doDia = fora ? [] : pauta.filter(p => +p.d === +d);
    const campNoAr = fora ? [] : camps.filter(c => c.ini <= d && c.fim >= d);
    return `<div class="cel ${fora ? "outro" : ""} ${d.getDay() % 6 === 0 ? "fds" : ""} ${+d === +HOJE ? "hoje-d" : ""}"><span class="dn">${d.getDate()}</span>
      ${campNoAr.length ? `<span class="fer-nome" style="color:#FF9500">${campNoAr.map(c => esc(c.campanha || c.nome)).join(" · ")} no ar</span>` : ""}
      ${doDia.map(p => `<button class="chip pauta" style="${p.tipo === "campanha" ? estiloCat("Campanha") : estiloCat("Rotina")}" data-item="${esc(p.t.it?.id || "")}" title="${esc(p.t.tarefa)} · ${esc(p.t.nomeItem)}"><span class="rotulo" style="font-size:10px;display:block">${p.tipo}</span><span class="nome">${esc(p.t.nomeItem)}</span></button>`).join("")}</div>`;
  }).join("");
  // equilíbrio dos 12 meses
  const meses = [...Array(12)].map((_, m) => { const p = pautaDoMes(ano, m); const r = p.filter(x => x.tipo === "rotina").length; return {m, r, c: p.length - r, t: p.length}; });
  const tot = meses.map(x => x.t).filter(Boolean).sort((a, b) => a - b); const mediana = tot[Math.floor(tot.length / 2)] || 1;
  const juizo = x => {
    if(!x.t) return {cls: "neutro", txt: "Sem pauta"};
    if(x.c === 0) return {cls: "atencao", txt: "Só rotina"};
    if(x.c / x.t >= .6) return {cls: "atencao", txt: "Campanha domina"};
    if(x.t >= mediana * 1.6) return {cls: "atencao", txt: "Sobrecarga"};
    return {cls: "ok", txt: "Equilibrado"};
  };
  const desequil = meses.filter(x => juizo(x).cls === "atencao");
  const jEste = juizo({r: nRot, c: nCamp, t: pauta.length});
  const aMes = pauta.length ? `${MESES[mes][0].toUpperCase() + MESES[mes].slice(1)} tem ${plural(pauta.length, "entrada", "entradas")} de pauta: ${nRot} de rotina e ${nCamp} de campanha (${jEste.txt.toLowerCase()}).${brProx ? " A pauta de " + MESES[(mes + 1) % 12] + " precisa estar com a agência até " + fSem(brProx.ini) + "." : ""}` : "Nenhuma entrada de pauta neste mês.";
  const anosR = M.anos.filter(a => a >= 2026);
  return `<div class="vista"><div class="filtros">
      <div class="linha"><button class="btn" data-redes-mes="-1" aria-label="Mês anterior">${icone("i-esq", "p")}</button><span class="h2" style="min-width:200px;text-align:center">${MESES[mes][0].toUpperCase() + MESES[mes].slice(1)} de ${ano}</span><button class="btn" data-redes-mes="1" aria-label="Próximo mês">${icone("i-dir", "p")}</button></div>
      <div class="segmentado" role="group" aria-label="Ano">${anosR.map(a => `<button data-redes-ano="${a}" aria-pressed="${a === ano}">${a}</button>`).join("")}</div></div>
    <div class="grade">
      <section class="cartao c12"><div class="grade" style="gap:16px">
        <div class="c4">${linhaBr(brEste, "Briefing desta pauta (dia 10 do mês anterior)")}</div>
        <div class="c4">${linhaBr(brProx, "Briefing da pauta de " + MESES[(mes + 1) % 12])}</div>
        <div class="c4"><span class="rotulo">Neste mês</span><p style="margin:4px 0 0"><span class="num" style="font-size:28px">${nRot}</span> <span class="sec">rotina</span> &nbsp; <span class="num" style="font-size:28px">${nCamp}</span> <span class="sec">campanha</span></p></div>
      </div>${alerta(aMes)}</section>
      <section class="cartao c8"><div class="cab"><h2>Calendário editorial</h2><div class="legenda"><span class="tipo"><i style="background:#8E8E93"></i>Rotina</span><span class="tipo"><i style="background:#FF9500"></i>Campanha</span></div></div>
        <div class="mes-grade">${["seg","ter","qua","qui","sex","sáb","dom"].map(s => `<div class="ds rotulo">${s}</div>`).join("")}${cel}</div>
        <p class="peq sec" style="margin:16px 0 0">A pauta sai do calendário: cada evento gera posts de divulgação e lembrete; cada campanha gera teaser, lançamento, reforço, última semana e encerramento. Clique para abrir o item.</p></section>
      <section class="cartao c4"><div class="cab"><h2>Equilíbrio do ano</h2></div>
        <ul class="equilibrio">${meses.map(x => { const j = juizo(x); return `<li><span>${MES_C[x.m]}</span><span><span class="empilhada" style="margin:0" role="img" aria-label="${x.r} rotina, ${x.c} campanha">${x.r ? `<i style="flex:${x.r};background:#8E8E93"></i>` : ""}${x.c ? `<i style="flex:${x.c};background:#FF9500"></i>` : ""}${!x.t ? `<i style="flex:1;background:#E5E5EA"></i>` : ""}</span><span class="peq sec tab">${x.r} rotina · ${x.c} campanha</span></span><span class="peq ${j.cls}" style="text-align:right">${j.txt}</span></li>`; }).join("")}</ul>
        ${alerta(desequil.length ? `${desequil.map(x => MES_C[x.m]).join(", ")} ${desequil.length === 1 ? "está desequilibrado" : "estão desequilibrados"}. ${desequil.some(x => x.c === 0) ? "Meses sem campanha pedem uma pauta de rotina mais forte (lojas, Prime, Espaço Casa) para o feed não esfriar." : ""}` : "Rotina e campanha estão equilibradas em todos os meses.")}</section>
    </div></div>`;
}

/* =====================================================================
   CASAPARK PRIME
   ===================================================================== */
function vPrime(){
  const ano = S.prime.ano;
  const ini = new Date(ano, 0, 1), fim = new Date(ano, 11, 31);
  const its = itensNoPeriodo(ini, fim, i => i.cat === "Casapark Prime");
  const ciclos = its.filter(i => i.formato === "Ciclo");
  const fech = its.filter(i => i.formato === "Fechamento" && i.ini.getFullYear() === ano);
  const viagens = its.filter(i => i.formato === "Viagem" && i.ini.getFullYear() === ano);
  const outros = its.filter(i => !["Ciclo","Fechamento","Viagem","Reunião"].includes(i.formato) && i.ini.getFullYear() === ano);
  const pos = d => (100 * dif(ini, d) / 365).toFixed(2) + "%";
  const larg = (a, b) => Math.max(100 * (dif(a, b) + 1) / 365, .6).toFixed(2) + "%";
  const lt = `<div class="linha-tempo">${[...Array(12)].map((_, m) => `<div class="lt-mes" style="left:${pos(new Date(ano, m, 1))}">${MES_C[m]}</div>`).join("")}
    ${ciclos.map(c => `<div class="lt-faixa" style="top:24px;left:${pos(c.ini < ini ? ini : c.ini)};width:${larg(c.ini < ini ? ini : c.ini, c.fim > fim ? fim : c.fim)}" title="${esc(c.nome)} · ${esc(c.statusData)}">${esc(c.nome.replace("Ciclo de pontuação Prime – ", "Ciclo "))}${c.statusData === "a confirmar" ? " · a confirmar" : ""}</div>`).join("")}
    ${fech.map(f => `<button class="lt-marco" style="top:60px;left:${pos(f.ini)}" data-item="${esc(f.id)}" title="Fechamento ${fSem(f.ini)}" aria-label="Fechamento ${fSem(f.ini)}"></button>`).join("")}
    <span class="peq sec" style="position:absolute;top:92px;left:0">Fechamentos mensais</span>
    ${viagens.map(v => `<button class="lt-viagem" style="top:120px;left:${pos(v.ini)}" data-item="${esc(v.id)}" title="${esc(v.nome)}">${esc(v.nome.replace(" – Casapark Prime", "").replace("Viagem ", ""))}</button>`).join("")}</div>`;
  const linhasF = fech.map(f => {
    const esperado = proximoUtil(new Date(ano, f.ini.getMonth(), 5));
    const ok = +esperado === +f.ini;
    const p = progresso(f);
    return `<tr class="clicavel" data-item="${esc(f.id)}"><td>${MESES[f.ini.getMonth()]}</td><td class="tab">${fSem(f.ini)}</td><td>${ok ? pill("ok", "Na regra") : pill("atencao", "Regra: " + fSem(esperado))}</td><td>${pillData(f)}</td><td>${f.ini < HOJE && !p.hist && p.pct < 100 ? pill("atraso", p.feitas + " de " + p.total) : `<span class="tab peq">${p.hist ? (p.pct ? "registrado" : "a verificar") : p.feitas + " de " + p.total}</span>`}</td></tr>`;
  }).join("");
  const proxF = fech.find(f => f.ini >= HOJE);
  const conflitoViagem = viagens.map(v => ({v, f: fech.find(f => f.ini >= v.ini && f.ini <= v.fim)})).filter(x => x.f);
  const cicloAtual = ciclos.find(c => c.ini <= HOJE && c.fim >= HOJE);
  const aPrime = [
    cicloAtual ? `Estamos no ${cicloAtual.nome.replace("Ciclo de pontuação Prime – ", "")} do ciclo, que fecha ${quando(cicloAtual.fim)}.` : "",
    proxF ? `Próximo fechamento: ${fSem(proxF.ini)}.` : "",
    conflitoViagem.length ? `${conflitoViagem.map(x => "O fechamento de " + fData(x.f.ini) + " cai durante a " + x.v.nome.replace(" – Casapark Prime", "")).join("; ")}: alguém precisa ficar responsável por ele em Brasília.` : "",
    ciclos.some(c => c.statusData === "a confirmar") ? "As datas do ciclo semestral são uma regra assumida (jan–jun e jul–dez) e precisam ser confirmadas." : "",
  ].filter(Boolean).join(" ");
  const anos = M.anos.filter(a => a >= 2026);
  return `<div class="vista"><div class="filtros"><div class="segmentado" role="group" aria-label="Ano">${anos.map(a => `<button data-prime-ano="${a}" aria-pressed="${a === ano}">${a}</button>`).join("")}</div></div>
    <div class="grade">
      <section class="cartao c12"><div class="cab"><h2>Ciclo de ${ano}</h2><span class="peq sec">Semestres de pontuação, fechamentos e viagens</span></div>${lt}${alerta(aPrime)}</section>
      <section class="cartao c7"><div class="cab"><h2>Fechamentos mensais</h2><span class="peq sec">Regra: dia 5 ou próximo dia útil</span></div>
        <div class="rolar"><table><thead><tr><th>Mês</th><th>Data</th><th>Regra</th><th>Data</th><th>Tarefas</th></tr></thead><tbody>${linhasF}</tbody></table></div>
        ${alerta(fech.filter(f => +proximoUtil(new Date(ano, f.ini.getMonth(), 5)) !== +f.ini).length ? `${plural(fech.filter(f => +proximoUtil(new Date(ano, f.ini.getMonth(), 5)) !== +f.ini).length, "fechamento saiu", "fechamentos saíram")} da regra do dia 5.` : "Todos os fechamentos seguem a regra do dia 5.")}</section>
      <section class="cartao c5"><div class="cab"><h2>Viagens</h2></div>
        ${viagens.length ? `<ul class="lista-t">${viagens.map(v => { const p = progresso(v); return `<li style="grid-template-columns:minmax(0,1fr) 120px"><div><button class="link-item t-nome" data-item="${esc(v.id)}">${esc(v.nome.replace(" – Casapark Prime", ""))}</button><div class="t-meta">${fPeriodo(v.ini, v.fim)} · ${v.ini > HOJE ? quando(v.ini) : "realizada"}${p.atrasadas ? ` · <span class="atraso">${p.atrasadas} vencida(s)</span>` : ""}</div></div>${barraProg(p)}</li>`; }).join("")}</ul>` : `<p class="vazio">Nenhuma viagem no calendário.</p>`}
        ${alerta(viagens.filter(v => v.ini > HOJE)[0] ? (() => { const v = viagens.filter(v => v.ini > HOJE)[0]; const t = v.tarefas.find(t => t.aberta); return `A próxima viagem é ${esc(v.nome.replace(" – Casapark Prime", ""))}, ${quando(v.ini)}.${t ? " Próxima tarefa: “" + esc(t.tarefa) + "” (" + fSem(t.prazo) + ")." : ""}`; })() : "")}</section>
      <section class="cartao c12"><div class="cab"><h2>Outros marcos do Prime</h2></div>
        ${outros.length ? `<div class="rolar"><table><thead><tr><th>Data</th><th>Marco</th><th>Status da data</th><th>Checklist</th></tr></thead><tbody>${outros.map(o => `<tr class="clicavel" data-item="${esc(o.id)}"><td class="tab">${fPeriodo(o.ini, o.fim)}</td><td>${esc(o.nome)}</td><td>${pillData(o)}</td><td style="width:180px">${barraProg(progresso(o))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="vazio">Nada mais no calendário.</p>`}</section>
    </div></div>`;
}

/* =====================================================================
   LOJAS
   ===================================================================== */
function vLojas(){
  const q = S.lojas.q.toLowerCase();
  const segs = [...new Set(M.lojas.map(l => l.Segmento))].sort();
  const pisos = [...new Set(M.lojas.map(l => l.Piso))].sort();
  const evPorLoja = {};
  M.itens.forEach(i => (i.lojas || "").split("|").map(s => s.trim()).filter(Boolean).forEach(l => (evPorLoja[l] ||= []).push(i)));
  const lista = M.lojas.filter(l => (!q || Object.values(l).join(" ").toLowerCase().includes(q)) && (!S.lojas.seg || l.Segmento === S.lojas.seg) && (!S.lojas.piso || l.Piso === S.lojas.piso) && (!S.lojas.pend || l["Observações"]));
  const pend = M.lojas.filter(l => l["Observações"]).length;
  const linhas = lista.map(l => { const evs = evPorLoja[l.Loja] || []; return `<tr><td><b style="font-weight:500">${esc(l.Loja)}</b></td><td>${esc(l.Segmento)}</td><td>${esc(l["Localização"])}</td><td>${esc(l.Piso)}</td><td class="tab peq">${esc(l.Telefones || "—")}</td><td class="peq">${esc(l["Horário"] || "—")}</td><td class="peq">${evs.length ? evs.slice(-3).map(i => `<button class="link-item" data-item="${esc(i.id)}">${esc(i.nome)}</button>`).join("<br>") : "—"}</td><td>${l["Observações"] ? `<span class="pill atencao" title="${esc(l["Observações"])}">Revisar</span><div class="peq sec" style="margin-top:4px;max-width:260px">${esc(l["Observações"])}</div>` : pill("ok", "OK")}</td></tr>`; }).join("");
  const comEvento = M.lojas.filter(l => evPorLoja[l.Loja]).length;
  return `<div class="vista"><div class="filtros">
      <label class="linha"><span class="sr" style="position:absolute;left:-9999px">Buscar loja</span><input type="search" id="lojas-q" placeholder="Buscar loja, segmento, telefone…" value="${esc(S.lojas.q)}" style="min-width:280px"></label>
      <select id="lojas-seg" aria-label="Segmento"><option value="">Todos os segmentos</option>${segs.map(s => `<option ${S.lojas.seg === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select id="lojas-piso" aria-label="Piso"><option value="">Todos os pisos</option>${pisos.map(s => `<option ${S.lojas.piso === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <label class="linha"><span class="alvo" style="min-width:32px"><input type="checkbox" class="marcar" id="lojas-pend" ${S.lojas.pend ? "checked" : ""}></span>Só cadastros a revisar</label>
    </div>
    <section class="cartao"><div class="cab"><h2>${plural(lista.length, "loja")}</h2><span class="peq sec">de ${M.lojas.length} no cadastro</span></div>
      <div class="rolar"><table><thead><tr><th>Loja</th><th>Segmento</th><th>Local</th><th>Piso</th><th>Telefones</th><th>Horário</th><th>Últimos eventos</th><th>Cadastro</th></tr></thead><tbody>${linhas || `<tr><td colspan="8" class="vazio">Nenhuma loja com esses filtros.</td></tr>`}</tbody></table></div>
      ${alerta(`${pend} de ${M.lojas.length} lojas têm cadastro a revisar (telefone sem DDD ou sem o 9, número de loja repetido, piso ou horário em branco). Só ${comEvento} lojas aparecem pelo nome em algum evento do calendário: as demais não foram envolvidas em ação própria em 2026.`)}</section></div>`;
}

/* =====================================================================
   FORNECEDORES
   ===================================================================== */
function vFornecedores(){
  const nomes = [...new Set([...M.fornecedores.map(f => f.Fornecedor), ...M.tarefas.flatMap(t => (t.forn || "").split("|").map(s => s.trim()))].filter(Boolean))];
  const info = Object.fromEntries(M.fornecedores.map(f => [f.Fornecedor, f]));
  const tsDe = n => M.tarefas.filter(t => (t.forn || "").split("|").map(s => s.trim()).includes(n) && t.status !== "cancelada" && t.tipo !== "registro");
  const linhas = nomes.map(n => {
    const ts = tsDe(n); const ab = ts.filter(t => t.aberta);
    const v = ab.filter(t => t.atrasada); const prox30 = ab.filter(t => t.dias >= 0 && t.dias <= 30);
    const prox = ab.filter(t => t.dias >= 0).sort((a, b) => a.prazo - b.prazo)[0];
    return {n, i: info[n] || {}, v, prox30, prox, total: ts.length};
  }).sort((a, b) => b.v.length - a.v.length || b.prox30.length - a.prox30.length);
  const tab = linhas.map(l => `<tr><td><b style="font-weight:500">${esc(l.n)}</b><div class="peq sec">${esc(l.i.Papel || "papel a confirmar")}</div></td><td class="peq">${esc(l.i.Entrega || "")}${l.i["Observações"] ? `<div class="sec">${esc(l.i["Observações"])}</div>` : ""}</td><td class="tab">${l.prox30.length}</td><td>${l.v.length ? pill("atraso", l.v.length + " vencida" + (l.v.length > 1 ? "s" : "")) : pill("ok", "Nenhuma")}</td><td class="peq">${l.prox ? `${fSem(l.prox.prazo)}<div class="sec">${esc(l.prox.tarefa)} · ${esc(l.prox.nomeItem)}</div>` : "—"}</td></tr>`).join("");
  // entregas das próximas 6 semanas por semana
  const lim = somar(HOJE, 42);
  const ent = M.tarefas.filter(t => t.forn && t.aberta && t.prazo && t.prazo <= lim && t.tipo !== "registro").sort((a, b) => a.prazo - b.prazo);
  const porSem = {};
  ent.forEach(t => { const k = t.atrasada ? "vencidas" : chaveD(inicioSemana(t.prazo)); (porSem[k] ||= []).push(t); });
  const blocos = Object.entries(porSem).map(([k, ts]) => `<div class="grupo-t"><span class="rotulo">${k === "vencidas" ? "Vencidas" : "Semana de " + fData(lerData(k))} · ${ts.length}</span><ul class="lista-t">${ts.slice(0, 12).map(t => liTarefa(t)).join("")}</ul>${ts.length > 12 ? `<p class="peq sec">e mais ${ts.length - 12}</p>` : ""}</div>`).join("");
  const agencia = linhas.find(l => /^Agência \(/.test(l.n));
  const pior = linhas[0];
  return `<div class="vista grade">
    <section class="cartao c12"><div class="cab"><h2>Fornecedores</h2><span class="peq sec">Cadastro em fornecedores_casapark.csv</span></div>
      <div class="rolar"><table><thead><tr><th>Fornecedor</th><th>O que entrega</th><th>Entregas em 30 dias</th><th>Vencidas</th><th>Próximo prazo</th></tr></thead><tbody>${tab}</tbody></table></div>
      ${alerta(`${pior && pior.v.length ? esc(pior.n) + " concentra " + plural(pior.v.length, "entrega vencida", "entregas vencidas") + ". " : ""}${agencia ? "A agência recebe " + plural(agencia.prox30.length, "entrega", "entregas") + " nos próximos 30 dias e ainda não tem nome no cadastro." : ""}`)}</section>
    <section class="cartao c12"><div class="cab"><h2>Prazos das próximas seis semanas</h2></div>${blocos || `<p class="vazio">Nenhuma entrega de fornecedor nas próximas seis semanas.</p>`}</section></div>`;
}

/* =====================================================================
   Navegação, eventos de interface, carga e exportação
   ===================================================================== */
const VISTAS = {geral: vGeral, calendario: vCalendario, eventos: vEventos, campanhas: vCampanhas, redes: vRedes, prime: vPrime, lojas: vLojas, fornecedores: vFornecedores};
function render(){
  const aba = ABAS.find(a => a.id === S.aba) || ABAS[0];
  $("#titulo").textContent = aba.nome; $("#subtitulo").textContent = aba.sub;
  $$("#nav button").forEach(b => b.setAttribute("aria-current", b.dataset.aba === aba.id ? "page" : "false"));
  try { $("#conteudo").innerHTML = VISTAS[aba.id](); }
  catch(e){ console.error(e); $("#conteudo").innerHTML = `<section class="cartao"><h2>Não foi possível montar esta aba</h2><p class="sec">${esc(e.message)}</p><p class="sec">Confira se os CSV estão no formato do CLAUDE.md.</p></section>`; }
  avisoLocal();
  if(aba.id === "calendario" && S.cal.visao === "anual") ligarGrafico();
}
function avisoLocal(){ const el0 = $("#aviso-local"); if(window.__COMPARTILHADO__){ el0.hidden = true; return; }
  const ovr = LS.get("status", {}); const dem = LS.get("demandas", []);
  const n = Object.keys(ovr).length + dem.length + Object.keys(LS.get("resp", {})).length + Object.keys(LS.get("respT", {})).length;
  const el = $("#aviso-local");
  el.hidden = !n;
  if(n) el.innerHTML = `<span><b>${plural(n, "alteração feita", "alterações feitas")}</b> (tarefas marcadas, responsáveis ou demandas novas). Para não perder, exporte a base e substitua o arquivo base_gestao.csv na pasta.</span><button class="btn primario" data-acao="exportar">${icone("i-download", "p")}Exportar base_gestao.csv</button>`;
}
function ligarGrafico(){
  const g = $("#grafico-carga"); if(!g) return;
  const dica = $("#dica"); const sem = cargaSemanal(S.cal.ano);
  g.addEventListener("mousemove", ev => {
    const r = ev.target.closest(".alvo-semana");
    if(!r){ dica.classList.remove("ver"); return; }
    const s = sem[+r.dataset.w - 1]; const seg = segundaDaSemana(S.cal.ano, s.w);
    const its = Object.entries(s.itens).sort((a, b) => b[1] - a[1]);
    dica.innerHTML = `<b>Semana ${s.w}</b> · ${fData(seg)} a ${fData(somar(seg, 6))}<br>${plural(s.n, "prazo")}${its.length ? "<br>" + its.slice(0, 5).map(([n, q]) => `${esc(n)} (${q})`).join("<br>") : ""}`;
    const box = g.getBoundingClientRect();
    dica.style.left = Math.min(ev.clientX - box.left + 12, box.width - 330) + "px"; dica.style.top = (ev.clientY - box.top + 12) + "px";
    dica.classList.add("ver");
  });
  g.addEventListener("mouseleave", () => dica.classList.remove("ver"));
}
function abrirItem(id){
  const it = M.porId[id]; if(!it) return;
  if(S.aba === "eventos" && ehEvento(it)){ S.ev.sel = id; render(); return; }
  $("#dlg-corpo").innerHTML = ficha(it);
  const d = $("#dlg"); d.dataset.aberto = id; if(!d.open) d.showModal();
}
function marcarTarefa(idt, feito){
  const t = M.tarefas.find(x => x.idt === idt); if(!t) return;
  const ovr = LS.get("status", {});
  if(t.local){
    const dem = LS.get("demandas", []); const d = dem.find(x => x.id_tarefa === idt); if(d){ d.status_tarefa = feito ? "concluída" : "a fazer"; LS.set("demandas", dem); }
  } else {
    const alvo = feito ? "concluída" : (t.statusBase === "concluída" ? "a fazer" : t.statusBase);
    if(alvo === t.statusBase) delete ovr[idt]; else ovr[idt] = alvo;
  }
  LS.set("status", ovr);
  recarregar();
  if($("#dlg").open){ const atual = M.porId[t.idItem]; if(atual) $("#dlg-corpo").innerHTML = ficha(atual); }
}
function mudarResp(chave, id, valor){
  const m = LS.get(chave, {}); m[id] = valor; LS.set(chave, m);
  const d = $("#dlg"); const aberto = d.open ? d.dataset.aberto : null;
  recarregar();
  if(aberto && M.porId[aberto]) $("#dlg-corpo").innerHTML = ficha(M.porId[aberto]);
}
function formDemanda(){
  $("#dlg-corpo").innerHTML = `<h2 class="h2" style="margin-bottom:8px">Registrar demanda fora do calendário</h2><p class="sec" style="margin:0 0 24px">Tudo o que chega sem estar planejado: pedido da diretoria, de lojista, ação de última hora.</p>
    <form class="campos" id="f-dem">
      <label class="larga"><span class="rotulo">O que foi pedido</span><input type="text" name="tarefa" required></label>
      <label><span class="rotulo">Quem pediu</span><input type="text" name="solicitante" required></label>
      <label><span class="rotulo">Prazo</span><input type="date" name="prazo" required></label>
      <label><span class="rotulo">Horas gastas (estimativa)</span><input type="number" name="horas" min="0" step="0.5"></label>
      <label><span class="rotulo">Status</span><select name="status_tarefa"><option>a fazer</option><option>em andamento</option><option>concluída</option></select></label>
      <label><span class="rotulo">Responsável</span><select name="responsavel"><option value="">A definir</option>${M.equipe.map(n => `<option>${esc(n)}</option>`).join("")}</select></label>
      <label class="larga"><span class="rotulo">Observação</span><input type="text" name="observacoes"></label>
      <div class="larga linha"><button class="btn primario" type="submit">Registrar</button><button class="btn" type="button" data-fechar>Cancelar</button></div>
    </form>`;
  $("#dlg").dataset.aberto = ""; $("#dlg").showModal();
  $("#f-dem").addEventListener("submit", ev => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const p = lerData(f.get("prazo"));
    const dem = LS.get("demandas", []);
    dem.push({id_tarefa: "FR-" + Date.now().toString(36), tipo_tarefa: "demanda", area: "Fora do radar", tarefa: f.get("tarefa"), solicitante: f.get("solicitante"),
      prazo: p ? fDataA(p) : "", horas_gastas: f.get("horas"), status_tarefa: f.get("status_tarefa"), responsavel: f.get("responsavel"), observacoes: f.get("observacoes"), origem: "fora do radar"});
    LS.set("demandas", dem); $("#dlg").close(); recarregar();
  });
}
const CAMPOS_BASE = ["id_tarefa","id_item","ano","item","categoria","formato","campanha","recorrencia","data_inicio","data_fim","status_data","tipo_tarefa","fase","etapa","area","tarefa","prazo_regra","prazo","responsavel","fornecedor","lojas_participantes","status_tarefa","origem","solicitante","horas_gastas","observacoes"];
function exportar(){
  const linhas = M.tarefas.map(t => { const it = t.it; return {
    id_tarefa: t.idt, id_item: it ? it.id : "", ano: it ? it.ini.getFullYear() : (t.prazo ? t.prazo.getFullYear() : ""), item: it ? it.nome : "", categoria: it ? it.cat : "",
    formato: it ? it.formato : "", campanha: it ? it.campanha : "", recorrencia: it ? it.rec : "", data_inicio: it ? fDataA(it.ini) : "", data_fim: it ? fDataA(it.fim) : "",
    status_data: it ? it.statusData : "", tipo_tarefa: t.tipo, fase: t.fase, etapa: t.etapa, area: t.area, tarefa: t.tarefa, prazo_regra: t.regra, prazo: fDataA(t.prazo),
    responsavel: t.resp, fornecedor: t.forn, lojas_participantes: it ? it.lojas : "", status_tarefa: t.status, origem: t.origem.replace(" (gerado no painel)", ""), solicitante: t.solicitante, horas_gastas: t.horas, observacoes: t.obs}; });
  const blob = new Blob([gerarCSV(CAMPOS_BASE, linhas)], {type: "text/csv;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "base_gestao.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function carregarArquivos(files){
  const novos = {}; const erros = [];
  for(const f of files){
    const txt = await f.text(); const linhas = lerCSV(txt); const cab = linhas[0] ? Object.keys(linhas[0]) : [];
    if(cab.includes("nome_original") && cab.includes("nome_padronizado")) novos["dicionario_padronizacao.csv"] = txt;
    else if(cab.includes("id_tarefa")) novos["base_gestao.csv"] = txt;
    else if(cab.includes("Loja")) novos["lojas_casapark.csv"] = txt;
    else if(cab.length === 1 && cab[0] === "Nome") novos["equipe_casapark.csv"] = txt;
    else if(cab.includes("Fornecedor") && cab.includes("Papel")) novos["fornecedores_casapark.csv"] = txt;
    else if(cab.includes("ID") && cab.includes("Início") && cab.includes("Item")){
      let nome = (/calendario_casapark_\d{4}\.csv$/.exec(f.name) || [])[0];
      if(!nome){ const anos = linhas.map(l => (lerData(l["Início"]) || {getFullYear: () => 0}).getFullYear()); const freq = {}; anos.forEach(a => freq[a] = (freq[a] || 0) + 1); nome = "calendario_casapark_" + Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] + ".csv"; }
      novos[nome] = txt;
    } else erros.push(f.name);
  }
  if(erros.length) alert("Não reconheci: " + erros.join(", ") + ".\nUse os CSV padronizados (veja o CLAUDE.md). O rascunho bruto precisa passar pelo script antes.");
  if(!Object.keys(novos).length) return;
  if(novos["base_gestao.csv"]){ LS.del("status"); LS.del("demandas"); LS.del("resp"); LS.del("respT"); }
  const atual = LS.get("planilhas", null);
  LS.set("planilhas", {quando: new Date().toLocaleString("pt-BR"), arquivos: {...(atual ? atual.arquivos : {}), ...novos}});
  iniciar();
}
let ARQUIVOS = {}, FONTE = "";
function recarregar(){ montar(ARQUIVOS, FONTE); render(); }
async function iniciar(){
  D = JSON.parse(JSON.stringify(window.__DADOS__ || {}));
  ARQUIVOS = {...(D.arquivos || {})};
  FONTE = D.gerado_em ? "Dados embutidos em " + D.gerado_em : "Sem dados embutidos";
  // servido por http (ex.: python3 -m http.server): lê os CSV direto da pasta
  if(false){   // na versão com login os dados vêm do banco
    const nomes = new Set([...Object.keys(ARQUIVOS), "base_gestao.csv", "lojas_casapark.csv", "fornecedores_casapark.csv", "equipe_casapark.csv",
      ...[-1, 0, 1, 2].map(k => "calendario_casapark_" + (HOJE.getFullYear() + k) + ".csv")]);
    let lidos = 0;
    await Promise.all([...nomes].map(async n => { try { const r = await fetch(n, {cache: "no-store"}); if(r.ok){ ARQUIVOS[n] = await r.text(); lidos++; } } catch(e){} }));
    if(lidos) FONTE = "Lendo os CSV da pasta (" + new Date().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) + ")";
  }
  const pl = LS.get("planilhas", null);
  if(pl){ Object.assign(ARQUIVOS, pl.arquivos); FONTE = "Planilhas carregadas em " + pl.quando; }
  montar(ARQUIVOS, FONTE);
  $("#fonte-dados").innerHTML = `<span class="rotulo">Fonte</span><div style="margin-top:4px">${esc(FONTE)}</div>${pl ? `<button class="btn texto" style="padding:8px 0" data-acao="limpar-planilhas">Voltar aos dados do arquivo</button>` : ""}`;
  render();
}

/* =====================================================================
   v3 · Painel, Quadro (kanban), Linha do tempo, busca ⌘K e tema
   ===================================================================== */
ABAS.find(a => a.id === "geral").nome = "Hoje";
ABAS.push(
  {id:"painel", nome:"Painel", ico:"i-painel", sub:"O pulso do marketing: números, ritmo, campanhas e equipe."},
  {id:"kanban", nome:"Quadro", ico:"i-kanban", sub:"Arraste as tarefas entre as colunas para mudar o status."},
  {id:"timeline", nome:"Linha do tempo", ico:"i-timeline", sub:"Campanhas e eventos lado a lado, com o progresso de cada um."},
);
const ORDEM_ABAS = ["painel","geral","kanban","timeline","calendario","eventos","campanhas","redes","prime","lojas","fornecedores"];
const GRUPO_ABA = {painel:"Visão", geral:"Visão", kanban:"Planejamento", timeline:"Planejamento", calendario:"Planejamento", eventos:"Planejamento", campanhas:"Planejamento", redes:"Planejamento", prime:"Planejamento", lojas:"Cadastros", fornecedores:"Cadastros"};
ABAS.sort((a, b) => ORDEM_ABAS.indexOf(a.id) - ORDEM_ABAS.indexOf(b.id));
ABAS.forEach(a => { a.grupo = GRUPO_ABA[a.id]; });
if(!params.get("aba") && LS.get("aba", null) === null) S.aba = "painel";
VISTAS.painel = vPainel; VISTAS.kanban = vKanban; VISTAS.timeline = vTimeline;
S.kb = {janela: LS.get("kb-janela", "30"), q: ""};
S.tl = {meses: LS.get("tl-meses", 6), off: 0, rot: false};

function navHTML(){
  let g = null;
  return ABAS.map(a => { const cab = a.grupo !== g ? `<div class="nav-grupo">${esc(a.grupo)}</div>` : ""; g = a.grupo;
    return cab + `<button data-aba="${a.id}">${icone(a.ico)}<span>${esc(a.nome)}</span></button>`; }).join("");
}

/* ---------- utilidades visuais ---------- */
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iniciais = n => (n || "?").split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
const CORES_AV = ["#007AFF","#AF52DE","#FF9500","#34C759","#FF2D55","#30B0C7","#5856D6","#FF3B30"];
function corAv(n){ let h = 0; for(const c of (n || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES_AV[h % CORES_AV.length]; }
const avatar = (n, cls = "") => n ? `<span class="av ${cls}" style="background:${corAv(n)}" title="${esc(n)}">${esc(iniciais(n))}</span>` : `<span class="av vazio ${cls}" title="Sem responsável">?</span>`;
const sem0 = () => inicioSemana(HOJE);
function janelaSem(de, ate){ const r = []; for(let k = de; k <= ate; k++){ const a = somar(sem0(), 7 * k); r.push({k, a, b: somar(a, 6)}); } return r; }
const naSem = (t, s) => t.prazo && t.prazo >= s.a && t.prazo <= s.b;
let _gid = 0;
function spark(vals, cor){
  const W = 120, H = 40, max = Math.max(1, ...vals), n = vals.length;
  const pts = vals.map((v, i) => [i * (W / (n - 1)), H - 3 - (v / max) * (H - 8)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const id = "gs" + (++_gid);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".3"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs><path class="area" d="${d} L${W} ${H} L0 ${H}Z" fill="url(#${id})"/><path class="traco" pathLength="100" d="${d}" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function anel(pct, cor){
  const R = 25, C = 2 * Math.PI * R;
  return `<svg viewBox="0 0 60 60" class="anel" role="img" aria-label="${pct}% concluído"><circle r="${R}" cx="30" cy="30" class="trilho-svg" fill="none" stroke-width="6"/>${pct > 0 ? `<circle class="arco" r="${R}" cx="30" cy="30" fill="none" stroke="${cor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C * pct / 100).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 30 30)"/>` : ""}<text x="30" y="35" text-anchor="middle" class="anel-t">${pct}%</text></svg>`;
}
function donut(segs, centro, sub){
  const R = 74, C = 2 * Math.PI * R, tot = segs.reduce((s, x) => s + x.v, 0) || 1; let acc = 0;
  const arcos = segs.filter(s => s.v).map(s => { const len = C * s.v / tot; const el = `<circle class="arco" r="${R}" cx="100" cy="100" fill="none" stroke="${s.cor}" stroke-width="22" stroke-dasharray="${Math.max(len - 2, .5).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 100 100)"><title>${esc(s.n)}: ${s.v}</title></circle>`; acc += len; return el; }).join("");
  return `<div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="${segs.map(s => s.n + " " + s.v).join(", ")}"><circle r="${R}" cx="100" cy="100" fill="none" class="trilho-svg" stroke-width="22"/>${arcos}</svg><div class="donut-c"><b><span class="contar" data-v="${centro}">${centro}</span>%</b><span>${sub}</span></div></div>
    <ul class="leg-lista">${segs.map(s => `<li><i style="background:${s.cor}"></i><span>${esc(s.n)}</span><b>${s.v}</b></li>`).join("")}</ul>`;
}
function toast(msg){
  const c = $("#toasts"); if(!c) return;
  const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status");
  el.innerHTML = `${icone("i-check", "p")}<span>${esc(msg)}</span>`; c.appendChild(el);
  setTimeout(() => { el.classList.add("sai"); setTimeout(() => el.remove(), 300); }, 2600);
}
function contar(){
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$(".contar").forEach(el => {
    const v = +el.dataset.v || 0; if(reduz || !v){ el.textContent = v; return; }
    const t0 = performance.now(), dur = 800;
    const passo = now => { const p = Math.min(1, (now - t0) / dur); el.textContent = Math.round(v * (1 - Math.pow(1 - p, 3))); if(p < 1) requestAnimationFrame(passo); };
    el.textContent = "0"; requestAnimationFrame(passo);
  });
}
function definirStatus(idt, st){
  const t = M.tarefas.find(x => x.idt === idt); if(!t || t.status === st) return;
  if(t.local){ const dem = LS.get("demandas", []); const d = dem.find(x => x.id_tarefa === idt); if(d){ d.status_tarefa = st; LS.set("demandas", dem); } }
  else { const ovr = LS.get("status", {}); if(st === t.statusBase) delete ovr[idt]; else ovr[idt] = st; LS.set("status", ovr); }
  recarregar();
  toast(`${t.tarefa} → ${st}`);
  const d = $("#dlg"); if(d.open && d.dataset.tarefa === idt) abrirTarefa(idt);
}
function abrirTarefa(idt){
  const t = M.tarefas.find(x => x.idt === idt); if(!t) return;
  const sts = [["a fazer","A fazer"],["em andamento","Em andamento"],["a verificar","A verificar"],["concluída","Concluída"]];
  $("#dlg-corpo").innerHTML = `<span class="rotulo">${esc(t.area || t.tipo)}${t.fase ? " · " + esc(t.fase) : ""}</span>
    <h2 class="h2" style="margin:6px 48px 8px 0;font-size:24px">${esc(t.tarefa)}</h2>
    <p class="sec" style="margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${t.it ? `<button class="link-item" data-item="${esc(t.it.id)}">${esc(t.nomeItem)}</button>` : esc(t.nomeItem || "Demanda fora do radar")} ${pillT(t)}</p>
    <div class="segmentado" style="margin-top:24px" role="group" aria-label="Status">${sts.map(([v, n]) => `<button data-kstatus="${v}" data-kt-id="${esc(idt)}" aria-pressed="${t.status === v}">${n}</button>`).join("")}</div>
    <dl class="fatos">
      <div><dt>Prazo</dt><dd>${t.prazo ? fSem(t.prazo) + " · " + quando(t.prazo) : "sem prazo"}</dd></div>
      <div><dt>Responsável</dt><dd>${seletorResp(t.resp, `data-resp-tarefa="${esc(idt)}"`)}</dd></div>
      <div><dt>Fornecedor</dt><dd>${esc(t.forn || "—")}</dd></div>
      <div><dt>Regra do prazo</dt><dd>${esc(t.regra || "data fixa")}</dd></div>
      ${t.solicitante ? `<div><dt>Quem pediu</dt><dd>${esc(t.solicitante)}</dd></div>` : ""}
      ${t.horas ? `<div><dt>Horas</dt><dd>${esc(t.horas)}</dd></div>` : ""}
    </dl>${t.obs ? `<p class="peq sec" style="margin:16px 0 0">${esc(t.obs)}</p>` : ""}`;
  const d = $("#dlg"); d.dataset.aberto = ""; d.dataset.tarefa = idt; if(!d.open) d.showModal();
}
function abrirDia(k){
  const dia = lerData(k);
  const l = M.tarefas.filter(t => t.prazo && chaveD(t.prazo) === k && t.tipo !== "registro" && t.status !== "cancelada" && doResp(t));
  $("#dlg-corpo").innerHTML = `<span class="rotulo">Prazos do dia</span><h2 class="h2" style="margin:6px 48px 20px 0;font-size:24px">${fSem(dia)} · ${plural(l.length, "tarefa")}</h2>
    <div class="lista-k">${l.map(t => `<button class="lk" data-kt="${esc(t.idt)}"><span class="lk-c" style="background:${corCat(t.it?.cat)}"></span><span><b>${esc(t.tarefa)}</b><small>${esc(t.nomeItem)}</small></span>${pillT(t)}${avatar(t.resp)}</button>`).join("") || `<p class="vazio">Nenhum prazo neste dia.</p>`}</div>`;
  const d = $("#dlg"); d.dataset.aberto = ""; d.dataset.tarefa = ""; if(!d.open) d.showModal();
}
function irPara(id){ S.aba = id; LS.set("aba", id); if($("#dlg").open) $("#dlg").close(); render(); window.scrollTo({top: 0}); }

/* =====================================================================
   PAINEL
   ===================================================================== */
function vPainel(){
  const ano = HOJE.getFullYear();
  const ts = M.tarefas.filter(t => t.tipo !== "registro" && t.status !== "cancelada" && doResp(t));
  const ab = ts.filter(t => t.aberta), venc = ab.filter(t => t.atrasada);
  const sem7 = ab.filter(t => t.dias >= 0 && t.dias <= 7).length;
  const doAno = ts.filter(t => t.prazo && t.prazo.getFullYear() === ano);
  const feitasAno = doAno.filter(t => t.status === "concluída").length;
  const pctAno = doAno.length ? Math.round(100 * feitasAno / doAno.length) : 0;
  const its30 = itensNoPeriodo(HOJE, somar(HOJE, 30), i => i.formato !== "Ciclo" && i.ini >= HOJE);
  const conf30 = its30.filter(i => i.statusData === "a confirmar").length;
  const hr = new Date().getHours(); const saud = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  const pessoas = [...new Set([...M.equipe, ...M.tarefas.map(t => t.resp).filter(Boolean).sort()])];
  const proxCamp = M.itens.find(i => i.formato === "Campanha" && i.ini > HOJE);
  const noAr = M.itens.filter(i => i.formato === "Campanha" && i.ini <= HOJE && i.fim >= HOJE);
  const resumo = `${venc.length ? `<b>${plural(venc.length, "tarefa vencida", "tarefas vencidas")}</b> pedem atenção` : "<b>Nada vencido</b>"}, ${plural(sem7, "vence", "vencem")} nos próximos 7 dias${noAr.length ? ` e <b>${esc(noAr[0].nome)}</b> está no ar` : (proxCamp ? `. <b>${esc(proxCamp.nome)}</b> começa ${quando(proxCamp.ini)}` : "")}.`;
  const nomePessoa = S.pessoa !== "todos" && S.pessoa !== "sem" ? ", " + esc(S.pessoa.split(" ")[0]) : "";

  const hero = `<section class="hero"><div><span class="hero-eyebrow"><span class="logo-cp" role="img" aria-label="Casapark"></span>Marketing</span><h2>${saud}${nomePessoa}.</h2><p>${resumo}</p>
      <div class="linha"><button class="btn" data-aba="kanban">${icone("i-kanban", "p")}Abrir quadro</button><button class="btn vidro" id="nova-demanda">${icone("i-mais", "p")}Registrar demanda</button><button class="btn vidro" data-k-abrir>${icone("i-busca", "p")}Buscar</button></div></div>
    <div class="hero-lado"><label>Ver como <select id="pessoa"><option value="todos">Toda a equipe</option><option value="sem" ${S.pessoa === "sem" ? "selected" : ""}>Sem responsável</option>${pessoas.map(p => `<option ${S.pessoa === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
      <div class="hero-data"><b>${HOJE.getDate()}</b><span>${MESES[HOJE.getMonth()]}<br>${SEMANA[HOJE.getDay()]} · semana ${semanaISO(HOJE)[1]}</span></div></div></section>`;

  // KPIs
  const passadas = janelaSem(-11, 0), futuras = janelaSem(0, 11);
  const kpis = [
    {l:"Tarefas abertas", v:ab.length, s:`${plural(sem7, "vence", "vencem")} em 7 dias`, ic:"i-check", cor:"#007AFF", vals: janelaSem(-6, 9).map(s => ab.filter(t => naSem(t, s)).length), alvo:"kanban"},
    {l:"Vencidas", v:venc.length, s: ab.length ? `${Math.round(100 * venc.length / ab.length)}% das abertas` : "nenhuma aberta", ic:"i-alerta", cor:"#FF3B30", vals: passadas.map(s => venc.filter(t => naSem(t, s)).length), alvo:"geral"},
    {l:"Concluídas em " + ano, v:feitasAno, s:`${pctAno}% das tarefas do ano`, ic:"i-trofeu", cor:"#34C759", vals: passadas.map(s => ts.filter(t => t.status === "concluída" && naSem(t, s)).length), alvo:"kanban"},
    {l:"Itens em 30 dias", v:its30.length, s: conf30 ? `${conf30} com data a confirmar` : "todas as datas confirmadas", ic:"i-cal", cor:"#AF52DE", vals: futuras.map(s => M.itens.filter(i => i.cat !== "Feriado" && i.formato !== "Ciclo" && i.ini >= s.a && i.ini <= s.b).length), alvo:"timeline"},
  ];
  const kpiHtml = kpis.map(k => `<section class="cartao kpi c3" style="--c:${k.cor}"><div class="kpi-cab"><span class="kpi-ico">${icone(k.ic, "p")}</span><span class="rotulo">${esc(k.l)}</span><button class="btn texto peq" style="margin-left:auto;padding:4px" data-aba="${k.alvo}" aria-label="Abrir">${icone("i-dir", "p")}</button></div>
    <div class="num contar" data-v="${k.v}">${k.v}</div><div class="peq sec">${k.s}</div>${spark(k.vals, k.cor)}</section>`).join("");

  // ritmo semanal
  const wk = janelaSem(-4, 7);
  const dados = wk.map(s => { const l = ts.filter(t => naSem(t, s)); return {s, f: l.filter(t => t.status === "concluída").length, a: l.filter(t => t.aberta && !t.atrasada).length, v: l.filter(t => t.atrasada).length}; });
  const mx = Math.max(5, ...dados.map(d => d.f + d.a + d.v));
  const passo = mx > 40 ? 20 : mx > 20 ? 10 : 5, topo = Math.ceil(mx / passo) * passo;
  const W = 760, H = 250, pb = 30, pt = 10, esq = 30, bw = (W - esq) / dados.length;
  const y = v => H - pb - (v / topo) * (H - pb - pt);
  const grades = [...Array(topo / passo + 1)].map((_, i) => i * passo).map(v => `<line class="grade-l" x1="${esq}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${esq - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const barras = dados.map((d, k) => {
    const x = esq + k * bw + bw * .2, w = bw * .6; let base = 0;
    const seg = [[d.f, "#34C759", "concluídas"], [d.a, "#007AFF", "abertas no prazo"], [d.v, "#FF3B30", "atrasadas"]].filter(s => s[0]).map(([v, cor, n], j, arr) => {
      const y1 = y(base + v), h = y(base) - y1; base += v;
      return `<rect class="cresce" style="animation-delay:${k * 35}ms" x="${x}" y="${y1}" width="${w}" height="${Math.max(h - 1.5, 1)}" rx="${j === arr.length - 1 ? 5 : 1.5}" fill="${cor}"><title>${v} ${n}</title></rect>`; }).join("");
    const atual = d.s.k === 0;
    return `${seg}<text class="eixo ${atual ? "forte" : ""}" x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${atual ? "esta sem." : fData(d.s.a)}</text>`;
  }).join("");
  const svgRitmo = `<svg class="svg-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tarefas por semana">${grades}${barras}</svg>`;
  const piorF = dados.filter(d => d.s.k >= 0).sort((a, b) => (b.a + b.v) - (a.a + a.v))[0];
  const aRitmo = piorF && (piorF.a + piorF.v) ? `A semana de ${fData(piorF.s.a)} é a mais carregada à frente, com ${plural(piorF.a + piorF.v, "prazo aberto", "prazos abertos")}.${dados.filter(d => d.s.k < 0).reduce((s, d) => s + d.v, 0) ? ` Nas últimas 4 semanas ficaram ${plural(dados.filter(d => d.s.k < 0).reduce((s, d) => s + d.v, 0), "tarefa", "tarefas")} sem conclusão.` : ""}` : "Nenhum prazo aberto nas próximas semanas.";

  // status do ano
  const cnt = {feita:0, and:0, ver:0, fazer:0, atr:0};
  doAno.forEach(t => { if(t.status === "concluída") cnt.feita++; else if(t.atrasada) cnt.atr++; else if(t.status === "em andamento") cnt.and++; else if(t.status === "a verificar") cnt.ver++; else cnt.fazer++; });
  const donutHtml = donut([{n:"Concluídas", v:cnt.feita, cor:"#34C759"}, {n:"Em andamento", v:cnt.and, cor:"#007AFF"}, {n:"A verificar", v:cnt.ver, cor:"#5856D6"}, {n:"A fazer", v:cnt.fazer, cor:"#AEAEB2"}, {n:"Atrasadas", v:cnt.atr, cor:"#FF3B30"}], pctAno, "concluído em " + ano);

  // campanhas
  const cs = campanhas(ano);
  const campHtml = cs.map(c => {
    if(!c.it) return `<div class="camp-c" style="cursor:default"><span class="vazio-c">${anel(0, "#AEAEB2")}</span><span><b>${esc(c.nome)}</b><small>fora do calendário</small></span></div>`;
    const p = progresso(c.it); const atras = c.real < c.previsto && HOJE <= c.it.fim; const fim = HOJE > c.it.fim;
    const cor = fim ? "#34C759" : atras ? "#FF3B30" : "#007AFF";
    return `<button class="camp-c" data-item="${esc(c.it.id)}">${anel(p.pct, cor)}<span style="min-width:0"><b>${esc(c.nome)}</b><small>${fim ? "encerrada" : HOJE >= c.it.ini ? "no ar · termina " + fData(c.it.fim) : fPeriodo(c.it.ini, c.it.fim)}</small><small class="${atras ? "atraso" : ""}">${atras ? "atrás: " : "etapa: "}${esc(nomeEtapa(c, c.real))}</small></span></button>`;
  }).join("");
  const atrasCamp = cs.filter(c => c.it && c.real < c.previsto && HOJE <= c.it.fim);

  // carga da equipe (sempre a equipe toda)
  const abTodas = M.tarefas.filter(t => t.aberta && t.tipo !== "registro");
  const linhasC = [...M.equipe.map(n => ({n, l: abTodas.filter(t => t.resp === n)})), {n: "", l: abTodas.filter(t => !t.resp)}];
  const mxC = Math.max(1, ...linhasC.map(x => x.l.length));
  const cargaHtml = linhasC.map(x => { const v = x.l.filter(t => t.atrasada).length, s7 = x.l.filter(t => t.dias >= 0 && t.dias <= 7).length; const chave = x.n || "sem";
    return `<li><button data-k-pessoa="${esc(chave)}" aria-pressed="${S.pessoa === chave}">${avatar(x.n, "g")}<span style="min-width:0"><b>${esc(x.n || "Sem responsável")}</b><span class="cbar"><i style="width:${100 * (x.l.length - v) / mxC}%;background:#007AFF"></i><i style="width:${100 * v / mxC}%;background:#FF3B30"></i></span></span><span class="n"><b>${x.l.length}</b>${v ? `<span class="atraso">${v} vencidas</span>` : `${s7} na semana`}</span></button></li>`; }).join("");
  const semDono = linhasC[linhasC.length - 1].l.length;
  const aCarga = semDono ? `${semDono} de ${abTodas.length} tarefas abertas (${Math.round(100 * semDono / Math.max(abTodas.length, 1))}%) ainda não têm responsável. Clique numa pessoa para ver o painel dela.` : "Todas as tarefas abertas têm responsável.";

  // mapa de prazos
  const contDia = {}; ts.forEach(t => { if(t.prazo && t.prazo.getFullYear() === ano){ const k = chaveD(t.prazo); contDia[k] = (contDia[k] || 0) + 1; } });
  const d0 = new Date(ano, 0, 1), pad = (d0.getDay() + 6) % 7, ndias = dif(d0, new Date(ano, 11, 31)) + 1, ncol = Math.ceil((pad + ndias) / 7);
  let cel = "<i class=\"hv\"></i>".repeat(pad);
  for(let k = 0; k < ndias; k++){ const d = somar(d0, k), ch = chaveD(d), n = contDia[ch] || 0; const lv = !n ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
    cel += `<i class="h${lv} ${+d === +HOJE ? "hj" : ""}" ${n ? `data-k-dia="${ch}"` : ""} title="${fSem(d)}: ${plural(n, "prazo")}"></i>`; }
  const mesesH = [...Array(12)].map((_, m) => `<span style="grid-column:${Math.floor((pad + dif(d0, new Date(ano, m, 1))) / 7) + 1}">${MES_C[m]}</span>`).join("");
  const diaPico = Object.entries(contDia).sort((a, b) => b[1] - a[1])[0];
  const heatHtml = `<div class="heat-w"><div class="heat-meses" style="grid-template-columns:repeat(${ncol},1fr)">${mesesH}</div><div class="heat" style="grid-template-columns:repeat(${ncol},1fr)">${cel}</div></div>
    <div class="heat-leg">menos <i style="background:var(--suave)"></i><i class="h1" style="background:color-mix(in srgb,var(--madeira) 22%,var(--suave))"></i><i style="background:color-mix(in srgb,var(--madeira) 45%,var(--suave))"></i><i style="background:color-mix(in srgb,var(--madeira) 72%,var(--suave))"></i><i style="background:var(--madeira)"></i> mais</div>`;

  // próximos eventos
  const evs = M.itens.filter(i => ehEvento(i) && i.fim >= HOJE && i.statusData !== "cancelada").slice(0, 5);
  const evHtml = evs.map(i => { const d = dif(HOJE, i.ini); const p = progresso(i); const agora = d <= 0;
    return `<li><button class="evp" data-item="${esc(i.id)}"><span class="evp-dias ${agora ? "agora" : ""}"><span><b>${agora ? "•" : d}</b><br><small>${agora ? "agora" : d === 1 ? "dia" : "dias"}</small></span></span><span style="min-width:0"><b class="t">${esc(i.nome)}</b><small class="s">${fPeriodo(i.ini, i.fim)} · ${recNome(i)}${p.atrasadas ? ` · <span class="atraso">${p.atrasadas} vencidas</span>` : ""}</small>${barraProg(p, p.atrasadas ? "alerta-b" : "")}</span>${avatar(i.resp)}</button></li>`; }).join("");

  return `<div class="grade vista">${hero}${kpiHtml}
    <section class="cartao c8"><div class="cab"><h2>Ritmo semanal</h2><div class="legenda-g"><span><i style="background:#34C759"></i>Concluídas</span><span><i style="background:#007AFF"></i>Abertas no prazo</span><span><i style="background:#FF3B30"></i>Atrasadas</span></div></div>${svgRitmo}${alerta(aRitmo)}</section>
    <section class="cartao c4"><div class="cab"><h2>Status de ${ano}</h2><span class="peq sec">${plural(doAno.length, "tarefa")}</span></div>${donutHtml}</section>
    <section class="cartao c7"><div class="cab"><h2>Campanhas de ${ano}</h2><button class="btn texto" data-aba="campanhas">Ver todas ${icone("i-dir", "p")}</button></div><div class="camp-g">${campHtml}</div>
      ${alerta(atrasCamp.length ? `${atrasCamp.map(c => esc(c.nome)).join(" e ")} ${atrasCamp.length === 1 ? "está" : "estão"} atrás do cronograma de etapas.` : "Todas as campanhas em andamento estão no cronograma.")}</section>
    <section class="cartao c5"><div class="cab"><h2>Carga da equipe</h2>${S.pessoa !== "todos" ? `<button class="btn texto" data-k-pessoa="todos">Ver todos</button>` : `<span class="peq sec">tarefas abertas</span>`}</div><ul class="carga">${cargaHtml}</ul>${alerta(aCarga)}</section>
    <section class="cartao c8"><div class="cab"><h2>Mapa de prazos de ${ano}</h2><span class="peq sec">Clique num dia para ver as tarefas</span></div>${heatHtml}${alerta(diaPico ? `O dia mais carregado do ano é ${fSem(lerData(diaPico[0]))}, com ${plural(diaPico[1], "prazo")}.` : "")}</section>
    <section class="cartao c4"><div class="cab"><h2>Próximos eventos</h2><button class="btn texto" data-aba="eventos">${icone("i-dir", "p")}</button></div>${evHtml ? `<ul class="evp-l">${evHtml}</ul>` : `<p class="vazio">Nenhum evento à frente.</p>`}</section>
  </div>`;
}

/* =====================================================================
   QUADRO (KANBAN)
   ===================================================================== */
const KCOLS = [["fazer","A fazer","a fazer","#AEAEB2"],["andamento","Em andamento","em andamento","#007AFF"],["verificar","A verificar","a verificar","#5856D6"],["feito","Concluída","concluída","#34C759"]];
const KCOL_ST = Object.fromEntries(KCOLS.map(c => [c[0], c[2]]));
const colDe = t => t.status === "concluída" ? "feito" : t.status === "em andamento" ? "andamento" : t.status === "a verificar" ? "verificar" : "fazer";
function vKanban(){
  const lim = S.kb.janela === "tudo" ? null : somar(HOJE, +S.kb.janela);
  const q = norm(S.kb.q);
  let ts = M.tarefas.filter(t => t.tipo !== "registro" && t.status !== "cancelada" && doResp(t) && t.prazo);
  ts = ts.filter(t => t.status === "concluída" ? (t.prazo >= somar(HOJE, -21) && (!lim || t.prazo <= lim)) : (t.atrasada || !lim || t.prazo <= lim));
  if(q) ts = ts.filter(t => norm(t.tarefa + " " + t.nomeItem + " " + t.resp + " " + t.forn + " " + t.area).includes(q));
  const pessoas = [...new Set([...M.equipe, ...M.tarefas.map(t => t.resp).filter(Boolean).sort()])];
  const cols = KCOLS.map(([id, nome, st, cor]) => {
    const l = ts.filter(t => colDe(t) === id).sort((a, b) => id === "feito" ? b.prazo - a.prazo : (b.atrasada - a.atrasada) || a.prazo - b.prazo);
    const max = 60;
    const cards = l.slice(0, max).map((t, k) => `<article class="kcard" draggable="true" tabindex="0" data-kt="${esc(t.idt)}" style="--c:${corCat(t.it?.cat)};animation-delay:${Math.min(k, 12) * 20}ms" aria-label="${esc(t.tarefa)}">
        <div class="kc-item">${t.it ? `<button class="link-item" data-item="${esc(t.it.id)}">${esc(t.nomeItem)}</button>` : esc(t.nomeItem || "Fora do radar")}${t.area ? " · " + esc(t.area) : ""}</div>
        <div class="kc-nome">${esc(t.tarefa)}</div>
        <div class="kc-pe"><span>${pillT(t)}<span class="tab peq sec">${fSem(t.prazo)}</span></span>${avatar(t.resp)}</div></article>`).join("");
    return `<section class="kcol" data-kcol="${id}" aria-label="${nome}"><header><i style="background:${cor}"></i>${nome}<span>${l.length}</span></header>
      <div class="kcol-corpo">${cards || `<div class="kvazio">Arraste tarefas para cá</div>`}${l.length > max ? `<div class="kmais">e mais ${l.length - max}</div>` : ""}</div></section>`;
  }).join("");
  const abertasK = ts.filter(t => t.aberta), vK = abertasK.filter(t => t.atrasada).length, fK = ts.filter(t => t.status === "concluída").length;
  return `<div class="vista"><div class="filtros">
      <div class="segmentado" role="group" aria-label="Janela">${[["14","14 dias"],["30","30 dias"],["90","90 dias"],["tudo","Tudo"]].map(([v, n]) => `<button data-kb-janela="${v}" aria-pressed="${S.kb.janela === v}">${n}</button>`).join("")}</div>
      <input type="search" id="kb-q" placeholder="Filtrar tarefas, itens, pessoas…" value="${esc(S.kb.q)}" style="min-width:260px">
      <select id="pessoa" aria-label="Responsável"><option value="todos">Toda a equipe</option><option value="sem" ${S.pessoa === "sem" ? "selected" : ""}>Sem responsável</option>${pessoas.map(p => `<option ${S.pessoa === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
    </div>
    <div class="kresumo"><div><span class="rotulo">No quadro</span><b>${ts.length}</b></div><div><span class="rotulo">Atrasadas</span><b class="${vK ? "atraso" : ""}">${vK}</b></div><div><span class="rotulo">Concluídas</span><b class="ok">${fK}</b></div><div style="flex:1;min-width:220px"><span class="rotulo">Progresso da janela</span><div style="margin-top:10px">${barraProg({pct: ts.length ? Math.round(100 * fK / ts.length) : 0})}</div></div></div>
    <div class="kquadro">${cols}</div>
    <p class="peq sec" style="margin:16px 0 0">Arraste um cartão para outra coluna ou clique nele para mudar status e responsável. As mudanças são salvas para toda a equipe na hora.</p></div>`;
}

/* =====================================================================
   LINHA DO TEMPO
   ===================================================================== */
const GRANDES = ["Campanha","Ação de campanha","Evento","Talk","Feira","Viagem","Montagem","Mercado"];
function vTimeline(){
  const m = S.tl.meses;
  const ini = m === 12 ? new Date(HOJE.getFullYear() + S.tl.off, 0, 1) : new Date(HOJE.getFullYear(), HOJE.getMonth() - (m === 3 ? 0 : 1) + S.tl.off * m, 1);
  const fim = new Date(ini.getFullYear(), ini.getMonth() + m, 0);
  const tot = dif(ini, fim) + 1;
  const pos = d => Math.max(0, Math.min(100, 100 * dif(ini, d) / tot));
  const its = itensNoPeriodo(ini, fim, i => S.cal.cats.has(i.cat) && i.statusData !== "cancelada" && (S.tl.rot ? i.formato !== "Ciclo" : GRANDES.includes(i.formato)));
  const grupos = Object.keys(CATS).map(c => ({c, its: its.filter(i => i.cat === c).sort((a, b) => a.ini - b.ini)})).filter(g => g.its.length);
  const meses = [...Array(m)].map((_, k) => { const d = new Date(ini.getFullYear(), ini.getMonth() + k, 1); return {d, l: pos(d), w: 100 * new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() / tot}; });
  const hojeP = HOJE >= ini && HOJE <= fim ? pos(HOJE) + 50 / tot : null;
  const cab = `<div class="tl-cab"><div class="tl-cab-nome rotulo">${plural(its.length, "item", "itens")}</div><div class="tl-cab-meses">${meses.map((x, k) => `<span style="left:${x.l}%;width:${x.w}%">${(s => s[0].toUpperCase() + s.slice(1))(m === 12 ? MES_C[x.d.getMonth()] : MESES[x.d.getMonth()])}${(k === 0 || x.d.getMonth() === 0) && m !== 12 ? " " + x.d.getFullYear() : ""}</span>`).join("")}</div></div>`;
  const grade = `<div class="tl-grade" aria-hidden="true">${meses.map(x => `<i style="left:${x.l}%"></i>`).join("")}${hojeP !== null ? `<b class="tl-hoje" style="left:${hojeP}%"><span>hoje</span></b>` : ""}</div>`;
  let k = 0;
  const linhas = grupos.map(g => `<div class="tl-grupo">${tipoCat(g.c)}<span class="peq sec">${g.its.length}</span></div>` + g.its.map(i => {
    const a = i.ini < ini ? ini : i.ini, b = i.fim > fim ? fim : i.fim;
    const l = pos(a), w = Math.max(100 * (dif(a, b) + 1) / tot, .9);
    const p = progresso(i), cor = corCat(i.cat), atraso = p.atrasadas ? ` · ${p.atrasadas} vencidas` : "";
    const barra = dif(i.ini, i.fim) === 0
      ? `<button class="tl-marco" style="left:calc(${l + 50 / tot}% - 7px);--c:${cor}" data-item="${esc(i.id)}" title="${esc(i.nome)} · ${fSem(i.ini)}${atraso}" aria-label="${esc(i.nome)}"></button><span class="tl-rot" style="left:calc(${l + 50 / tot}% + 14px)">${esc(i.nome)}</span>`
      : `<button class="tl-barra ${i.statusData === "a confirmar" ? "pend" : ""}" style="left:${l}%;width:${w}%;--c:${cor};animation-delay:${Math.min(k++, 30) * 18}ms" data-item="${esc(i.id)}" title="${esc(i.nome)} · ${esc(fPeriodo(i.ini, i.fim))}${p.total ? " · " + p.pct + "% concluído" : ""}${atraso}${i.statusData === "a confirmar" ? " · data a confirmar" : ""}"><i style="width:${p.total ? p.pct : 0}%"></i><span>${esc(i.nome)}${p.total ? ` · ${p.pct}%` : ""}</span></button>`;
    return `<div class="tl-linha"><button class="tl-nome" data-item="${esc(i.id)}"><span>${esc(i.nome)}</span><small>${fPeriodo(i.ini, i.fim)}${i.statusData === "a confirmar" ? " · a confirmar" : ""}</small></button><div class="tl-pista">${barra}</div></div>`;
  }).join("")).join("");
  const conf = its.filter(i => i.statusData === "a confirmar").length;
  const campJuntas = its.filter(i => i.formato === "Campanha");
  const sob = campJuntas.filter((x, a) => campJuntas.some((y, b) => b > a && x.ini <= y.fim && y.ini <= x.fim)).length;
  const aTl = `${plural(its.length, "item", "itens")} no período${conf ? `, ${conf} com data a confirmar (barras hachuradas)` : ""}.${sob ? " Há campanhas que se sobrepõem no ar: planeje as peças juntas." : ""} A parte mais escura de cada barra é o checklist já concluído.`;
  return `<div class="vista"><div class="filtros">
      <div class="segmentado" role="group" aria-label="Período">${[[3,"3 meses"],[6,"6 meses"],[12,"Ano"]].map(([v, n]) => `<button data-tl-meses="${v}" aria-pressed="${m === v}">${n}</button>`).join("")}</div>
      <div class="linha" style="gap:8px"><button class="btn icone" data-tl-off="-1" aria-label="Período anterior">${icone("i-esq", "p")}</button><span class="h2 tl-periodo">${MES_C[ini.getMonth()]} ${ini.getFullYear()} – ${MES_C[fim.getMonth()]} ${fim.getFullYear()}</span><button class="btn icone" data-tl-off="1" aria-label="Próximo período">${icone("i-dir", "p")}</button><button class="btn" data-tl-hoje>Hoje</button></div>
      <label class="linha" style="gap:4px"><span class="alvo"><input type="checkbox" class="marcar" id="tl-rot" ${S.tl.rot ? "checked" : ""}></span>Incluir rotinas</label>
    </div>
    <section class="cartao"><div class="nao-imprimir" style="margin-bottom:16px">${legendaCats(true)}</div>
      <div class="rolar"><div class="tl">${cab}<div class="tl-corpo">${grade}${linhas || `<p class="vazio" style="padding:32px 0">Nenhum item neste período com esses filtros.</p>`}</div></div></div>${alerta(aTl)}</section></div>`;
}

/* =====================================================================
   BUSCA RÁPIDA (⌘K)
   ===================================================================== */
const CMD = {lista: [], sel: 0};
function abrirCmdk(){ const c = $("#cmdk"); if(!c.hidden) return; if($("#dlg").open) $("#dlg").close(); c.hidden = false; const i = $("#cmdk-q"); i.value = ""; filtrarCmdk(""); setTimeout(() => i.focus(), 20); }
function fecharCmdk(){ $("#cmdk").hidden = true; }
function filtrarCmdk(q){
  const n = norm(q), bate = s => !n || norm(s).includes(n), r = [];
  if(n){
    M.itens.filter(i => i.cat !== "Feriado" && bate(i.nome + " " + i.campanha + " " + i.formato)).sort((a, b) => (a.fim < HOJE) - (b.fim < HOJE) || a.ini - b.ini).slice(0, 7)
      .forEach(i => r.push({g:"Itens do calendário", t:i.nome, s:fPeriodo(i.ini, i.fim) + " · " + i.cat, cor:corCat(i.cat), f:() => abrirItem(i.id)}));
    M.tarefas.filter(t => t.aberta && bate(t.tarefa + " " + t.nomeItem + " " + t.resp)).sort((a, b) => (a.prazo || 0) - (b.prazo || 0)).slice(0, 6)
      .forEach(t => r.push({g:"Tarefas abertas", t:t.tarefa, s:(t.nomeItem || "Fora do radar") + (t.prazo ? " · " + fSem(t.prazo) : "") + (t.resp ? " · " + t.resp : ""), ic:"i-check", f:() => abrirTarefa(t.idt)}));
    M.lojas.filter(l => bate(l.Loja + " " + l.Segmento)).slice(0, 4).forEach(l => r.push({g:"Lojas", t:l.Loja, s:l.Segmento + " · " + l.Piso, ic:"i-lojas", f:() => { S.lojas.q = l.Loja; irPara("lojas"); }}));
  }
  ABAS.forEach(a => { if(bate(a.nome + " " + a.sub)) r.push({g:"Ir para", t:a.nome, s:a.sub, ic:a.ico, f:() => irPara(a.id)}); });
  [{t:"Registrar demanda fora do radar", ic:"i-mais", f:() => formDemanda()}, {t:"Alternar tema claro / escuro", ic:"i-lua", f:() => alternarTema()}, {t:"Exportar base_gestao.csv", ic:"i-download", f:() => exportar()}, {t:"Imprimir esta tela", ic:"i-printer", f:() => window.print()}]
    .forEach(a => { if(bate(a.t)) r.push({g:"Ações", ...a}); });
  if(!n) M.itens.filter(i => i.cat !== "Feriado" && i.formato !== "Ciclo" && i.ini >= HOJE).slice(0, 5).forEach(i => r.push({g:"Em breve", t:i.nome, s:fPeriodo(i.ini, i.fim) + " · " + quando(i.ini), cor:corCat(i.cat), f:() => abrirItem(i.id)}));
  CMD.lista = r; CMD.sel = 0; desenharCmdk();
}
function desenharCmdk(){
  let g = null;
  $("#cmdk-res").innerHTML = CMD.lista.length ? CMD.lista.map((x, k) => { const cab = x.g !== g ? `<li class="cmdk-g" role="presentation">${esc(x.g)}</li>` : ""; g = x.g;
    return cab + `<li role="option" class="cmdk-op" data-cmd="${k}" aria-selected="${k === CMD.sel}">${x.cor ? `<i class="cmdk-pt" style="background:${x.cor}"></i>` : icone(x.ic || "i-seta", "p")}<span><b>${esc(x.t)}</b>${x.s ? `<small>${esc(x.s)}</small>` : ""}</span>${k === CMD.sel ? "<kbd>↵</kbd>" : ""}</li>`; }).join("")
    : `<li class="cmdk-vazio">Nada encontrado para “${esc($("#cmdk-q").value)}”.</li>`;
  const s = $(".cmdk-op[aria-selected=\"true\"]"); if(s) s.scrollIntoView({block: "nearest"});
}
function executarCmdk(k){ const x = CMD.lista[k]; if(!x) return; fecharCmdk(); x.f(); }

/* =====================================================================
   TEMA
   ===================================================================== */
const escuroAgora = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
function aplicarTema(){
  const t = LS.get("tema", null);
  if(t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const b = $("#tema-btn"); if(b) b.innerHTML = icone(escuroAgora() ? "i-sol" : "i-lua", "p");
}
function alternarTema(){ LS.set("tema", escuroAgora() ? "light" : "dark"); aplicarTema(); toast(escuroAgora() ? "Tema escuro ativado" : "Tema claro ativado"); }

/* ---------- render com pós-processamento ---------- */
const _renderBase = render;
render = function(){
  _renderBase();
  const aba = ABAS.find(a => a.id === S.aba) || ABAS[0];
  $("main").dataset.aba = aba.id;
  const mg = $("#migalha-aba"); if(mg) mg.textContent = aba.nome;
  contar();
};

/* ---------- eventos da v3 ---------- */
document.addEventListener("click", ev => {
  if(ev.target.closest("[data-item]")) return;     // abrir ficha: tratado pelo painel principal
  const b = ev.target.closest("[data-k-abrir],[data-kstatus],[data-kt],[data-kb-janela],[data-tl-meses],[data-tl-off],[data-tl-hoje],[data-k-pessoa],[data-k-dia],[data-cmd],#tema-btn,#cmdk");
  if(!b) return;
  const ds = b.dataset;
  if(b.id === "cmdk"){ if(ev.target === b) fecharCmdk(); return; }
  if(ds.kAbrir !== undefined) abrirCmdk();
  else if(ds.cmd !== undefined) executarCmdk(+ds.cmd);
  else if(ds.kstatus) definirStatus(ds.ktId, ds.kstatus);
  else if(ds.kt) abrirTarefa(ds.kt);
  else if(ds.kbJanela){ S.kb.janela = ds.kbJanela; LS.set("kb-janela", S.kb.janela); render(); }
  else if(ds.tlMeses){ S.tl.meses = +ds.tlMeses; S.tl.off = 0; LS.set("tl-meses", S.tl.meses); render(); }
  else if(ds.tlOff){ S.tl.off += +ds.tlOff; render(); }
  else if(ds.tlHoje !== undefined){ S.tl.off = 0; render(); }
  else if(ds.kPessoa){ S.pessoa = (S.pessoa === ds.kPessoa && ds.kPessoa !== "todos") ? "todos" : ds.kPessoa; LS.set("pessoa", S.pessoa); render(); }
  else if(ds.kDia) abrirDia(ds.kDia);
  else if(b.id === "tema-btn") alternarTema();
});
document.addEventListener("change", ev => { if(ev.target.id === "tl-rot"){ S.tl.rot = ev.target.checked; render(); } });
document.addEventListener("input", ev => {
  const t = ev.target;
  if(t.id === "kb-q"){ S.kb.q = t.value; const p = t.selectionStart; render(); const el = $("#kb-q"); el.focus(); el.setSelectionRange(p, p); }
  else if(t.id === "cmdk-q") filtrarCmdk(t.value);
});
document.addEventListener("mousemove", ev => { const o = ev.target.closest && ev.target.closest(".cmdk-op"); if(o && +o.dataset.cmd !== CMD.sel){ CMD.sel = +o.dataset.cmd; desenharCmdk(); } });
document.addEventListener("keydown", ev => {
  const aberto = !$("#cmdk").hidden;
  if((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k"){ ev.preventDefault(); aberto ? fecharCmdk() : abrirCmdk(); return; }
  if(!aberto){
    const ae = document.activeElement;
    if(ev.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(ae.tagName) && !$("#dlg").open){ ev.preventDefault(); abrirCmdk(); }
    else if(ev.key === "Enter" && ae.classList && ae.classList.contains("kcard")){ ev.preventDefault(); abrirTarefa(ae.dataset.kt); }
    return;
  }
  if(ev.key === "Escape"){ ev.preventDefault(); fecharCmdk(); }
  else if(ev.key === "ArrowDown"){ ev.preventDefault(); CMD.sel = Math.min(CMD.sel + 1, CMD.lista.length - 1); desenharCmdk(); }
  else if(ev.key === "ArrowUp"){ ev.preventDefault(); CMD.sel = Math.max(CMD.sel - 1, 0); desenharCmdk(); }
  else if(ev.key === "Enter"){ ev.preventDefault(); executarCmdk(CMD.sel); }
});
/* arrastar e soltar no quadro */
document.addEventListener("dragstart", ev => { const c = ev.target.closest && ev.target.closest(".kcard"); if(!c) return; ev.dataTransfer.setData("text/plain", c.dataset.kt); ev.dataTransfer.effectAllowed = "move"; requestAnimationFrame(() => c.classList.add("arrastando")); });
document.addEventListener("dragend", ev => { const c = ev.target.closest && ev.target.closest(".kcard"); if(c) c.classList.remove("arrastando"); $$(".kcol.sobre").forEach(x => x.classList.remove("sobre")); });
document.addEventListener("dragover", ev => { const col = ev.target.closest && ev.target.closest(".kcol"); if(!col) return; ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; $$(".kcol.sobre").forEach(x => { if(x !== col) x.classList.remove("sobre"); }); col.classList.add("sobre"); });
document.addEventListener("drop", ev => { const col = ev.target.closest && ev.target.closest(".kcol"); if(!col) return; ev.preventDefault(); col.classList.remove("sobre"); const idt = ev.dataTransfer.getData("text/plain"); if(idt) definirStatus(idt, KCOL_ST[col.dataset.kcol]); });
$("#dlg").addEventListener("close", () => { $("#dlg").dataset.tarefa = ""; });
if(!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $$("kbd.atalho").forEach(k => { k.textContent = "Ctrl K"; });
aplicarTema();
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", aplicarTema); } catch(e){}


/* =====================================================================
   BI DE REDES · dados ao vivo do Windsor.ai (conector do Claude)
   Nenhum dado das redes fica salvo na página: tudo vem do conector de
   quem está vendo, com a credencial da própria pessoa.
   ===================================================================== */
const WINDSOR = "Windsor.ai";
ABAS.find(a => a.id === "redes").nome = "Pauta das redes";
ABAS.push({id:"bi", nome:"BI de redes", ico:"i-bi", sub:"Instagram, Facebook, Google Ads e Meta Ads ao vivo pelo Windsor.ai, cruzados com o calendário."});
ORDEM_ABAS.splice(2, 0, "bi");
GRUPO_ABA.bi = "Visão";
ABAS.sort((a, b) => ORDEM_ABAS.indexOf(a.id) - ORDEM_ABAS.indexOf(b.id));
ABAS.forEach(a => { a.grupo = GRUPO_ABA[a.id]; });
VISTAS.bi = vBI;

const BI = {dias: LS.get("bi-dias", 30), fonte: LS.get("bi-fonte", "instagram"), estado: "ocioso", erro: null, conta: null, posts: null, seg: null, quando: null, chave: null, ord: "engaj", src: {}};
const FONTES_BI = [
  {id:"instagram", nome:"Instagram"},
  {id:"google_ads", nome:"Google Ads"},
  {id:"facebook", nome:"Meta Ads"},
  {id:"facebook_organic", nome:"Facebook"},
];
if(!FONTES_BI.some(f => f.id === BI.fonte)) BI.fonte = "instagram";
const espera = ms => new Promise(r => setTimeout(r, ms));
const fmtN = n => (n == null || isNaN(n)) ? "—" : Math.round(n).toLocaleString("pt-BR");
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " mi" : n >= 1e4 ? Math.round(n / 1e3) + " mil" : fmtN(n);
const fmtP = (n, c = 1) => (n == null || !isFinite(n)) ? "—" : (n * 100).toFixed(c).replace(".", ",") + "%";
const fmtR = (n, c = 2) => (n == null || !isFinite(n)) ? "—" : "R$ " + n.toLocaleString("pt-BR", {minimumFractionDigits: c, maximumFractionDigits: c});
const fmtRk = n => (n == null || !isFinite(n)) ? "—" : n >= 1e4 ? "R$ " + fmtK(n) : fmtR(n, n >= 1000 ? 0 : 2);
const dataISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const horaBSB = ts => { const d = new Date(ts); return isNaN(d) ? null : new Date(d.getTime() - 3 * 3600e3); };   // America/Sao_Paulo (UTC−3)

// No sistema com login os dados vêm da função segura do servidor (window.__WINDSOR__).
// Na versão aberta dentro do Claude, vêm do conector Windsor.ai de quem está vendo.
async function windsorMCP(mcp, input){
  // o Windsor pode responder "pending" enquanto monta o relatório: repete a mesma chamada
  for(let i = 0; i < 8; i++){
    const r = await mcp.callTool(WINDSOR, "get_data", input, {cache: {staleTime: 5 * 60e3, gcTime: 24 * 3600e3}});
    const p = r.payload || {};
    if(p.status && p.status !== "done"){ await espera(Math.min((p.poll_after_seconds || 10) * 1000, 30000)); continue; }
    return {linhas: Array.isArray(p.data) ? p.data : [], storedAt: r.cache ? r.cache.storedAt : Date.now()};
  }
  throw {code: "pendente", message: "O Windsor ainda está gerando o relatório."};
}
async function acessoDados(forcar){
  if(typeof window.__WINDSOR__ === "function") return input => window.__WINDSOR__({...input, forcar: !!forcar});
  let mcp = null;
  try { mcp = window.claude && await window.claude.use("mcp"); } catch(e){ mcp = null; }
  if(!mcp) return null;
  if(forcar){ try { await mcp.invalidate(WINDSOR, "get_data"); } catch(e){} }
  return input => windsorMCP(mcp, input);
}
// tenta os campos completos; se o Windsor recusar algum campo, tenta o conjunto mínimo
async function comReserva(get, input, minimo){
  try { return await get(input); }
  catch(e){ if(!minimo || ["sem_chave","sessao","mfa","inativo","server_not_connected","needs_reauth","approval_required","consent_required","not_in_manifest","blocked_by_policy"].includes(e && e.code)) throw e; return await get({...input, fields: minimo}); }
}
const st = id => (BI.src[id] ||= {estado: "ocioso"});

async function carregarBI(forcar, silencioso){
  const fonte = BI.fonte, n = BI.dias, chave = fonte + "|" + n, s = st(fonte);
  if(!forcar && s.chave === chave && ["pronto","carregando","erro","sem-mcp","vazio"].includes(s.estado)) return;
  if(s.estado === "carregando" && s.chave === chave) return;
  const tinha = s.estado === "pronto" && s.chave === chave;
  s.chave = chave; s.erro = null;
  if(silencioso && tinha) s.atualizando = true; else s.estado = "carregando";
  if(S.aba === "bi") render();
  const get = await acessoDados(forcar);
  if(!get){ s.estado = "sem-mcp"; s.atualizando = false; if(S.aba === "bi") render(); return; }
  try {
    let dados;
    if(fonte === "instagram"){
      // o Instagram só entrega seguidores por dia dos últimos 30 dias: essa série vem numa consulta à parte
      const [conta, posts, seg, novos] = await Promise.all([
        get({connector: "instagram", date_preset: `last_${n * 2}d`, fields: ["date","reach","views","accounts_engaged","total_interactions","likes","comments","saves","shares","profile_links_taps"]}),
        get({connector: "instagram", date_preset: `last_${Math.max(n, 30)}d`, fields: ["media_id","timestamp","media_type","media_product_type","media_caption","media_permalink","media_reach","media_views","media_engagement","media_saved","media_shares","media_like_count","media_comments_count"]}),
        get({connector: "instagram", date_preset: "last_7d", fields: ["followers_count","media_count","username"]}),
        get({connector: "instagram", date_preset: "last_30d", fields: ["date","follower_count_1d"]}).catch(() => ({linhas: []})),
      ]);
      const segDia = Object.fromEntries(novos.linhas.map(r => [String(r.date).slice(0, 10), r.follower_count_1d]));
      dados = {conta: conta.linhas.map(r => ({...r, follower_count_1d: segDia[String(r.date).slice(0, 10)], d: dataISO(r.date)})).filter(r => r.d).sort((a, b) => a.d - b.d),
        posts: posts.linhas.filter(p => p.media_product_type !== "AD").map(p => ({...p, t: horaBSB(p.timestamp)})).filter(p => p.t).sort((a, b) => b.t - a.t),
        seg: seg.linhas[0] || null, quando: Math.min(conta.storedAt, posts.storedAt), vazio: !conta.linhas.length && !posts.linhas.length};
    } else if(fonte === "google_ads"){
      const [dia, disp] = await Promise.all([
        get({connector: "google_ads", date_preset: `last_${n * 2}d`, fields: ["date","campaign","campaign_status","advertising_channel_type","impressions","clicks","spend","conversions"]}),
        get({connector: "google_ads", date_preset: `last_${n}d`, fields: ["device","impressions","clicks","spend","conversions"]}),
      ]);
      dados = {linhas: dia.linhas.map(r => ({...r, d: dataISO(r.date)})).filter(r => r.d), seg: disp.linhas, quando: dia.storedAt, vazio: !dia.linhas.length};
    } else if(fonte === "facebook"){
      const dia = await comReserva(get, {connector: "facebook", date_preset: `last_${n * 2}d`, fields: ["date","campaign","campaign_status","impressions","reach","clicks","spend"]}, ["date","campaign","impressions","clicks","spend"]);
      dados = {linhas: dia.linhas.map(r => ({...r, d: dataISO(r.date)})).filter(r => r.d), seg: null, quando: dia.storedAt, vazio: !dia.linhas.length};
    } else {
      const [dia, posts] = await Promise.all([
        comReserva(get, {connector: "facebook_organic", date_preset: `last_${n * 2}d`, fields: ["date","page_follows","page_daily_follows","page_impressions","page_total_media_view_unique","page_post_engagements","page_views_total"]}, ["date","page_impressions","page_post_engagements"]),
        comReserva(get, {connector: "facebook_organic", date_preset: `last_${Math.max(n, 30)}d`, fields: ["post_id","post_created_time","post_message","permalink_url","post_impressions","post_reactions_no_shares","post_comments_total","post_activity_by_action_type_share","post_clicks"]}, ["post_id","post_created_time","post_message","permalink_url","post_impressions"]).catch(() => ({linhas: [], storedAt: Date.now()})),
      ]);
      dados = {conta: dia.linhas.map(r => ({...r, d: dataISO(r.date)})).filter(r => r.d).sort((a, b) => a.d - b.d),
        posts: posts.linhas.map(p => ({...p, t: horaBSB(p.post_created_time)})).filter(p => p.t).sort((a, b) => b.t - a.t), quando: dia.storedAt, vazio: !dia.linhas.length};
    }
    if(s.chave !== chave) return;
    Object.assign(s, dados, {estado: dados.vazio ? "vazio" : "pronto", atualizando: false, quando: dados.quando || Date.now()});
    if(fonte === "instagram"){ BI.conta = dados.conta; BI.posts = dados.posts; BI.seg = dados.seg; BI.quando = s.quando; }
  } catch(e){
    if(s.chave !== chave) return;
    s.atualizando = false;
    const naoConectado = e && (["permission_denied","not_found"].includes(e.code) || /no .* accounts? (are )?configured|not connected/i.test(e.message || ""));
    if(naoConectado){ s.estado = "vazio"; }
    else if(tinha){ s.erroSilencioso = e; }   // mantém os números anteriores na tela
    else { s.estado = "erro"; s.erro = e || {code: "upstream_error"}; }
  }
  if(S.aba === "bi") render();
}
// atualização automática enquanto a aba está aberta
setInterval(() => { if(S.aba === "bi" && document.visibilityState === "visible" && st(BI.fonte).estado === "pronto") carregarBI(true, true); }, 5 * 60e3);
function mensagemErro(e){
  const c = e && e.code;
  const m = {
    server_not_connected: ["O conector Windsor.ai não está ligado para você.", "Adicione o Windsor.ai em claude.ai → Configurações → Conectores e recarregue esta página."],
    needs_reauth: ["A conexão com o Windsor.ai expirou.", "Reconecte o Windsor.ai em claude.ai → Configurações → Conectores."],
    selection_required: ["Há mais de um conector Windsor.ai na sua conta.", "Escolha qual usar no aviso do Claude e recarregue."],
    not_in_manifest: ["O acesso ao Windsor.ai foi recusado para este painel.", "Ative o Windsor.ai no menu de permissões do artefato para ver os dados."],
    approval_required: ["Falta permitir que este painel consulte o Windsor.ai.", "Clique em Permitir acesso e confirme no aviso do Claude."],
    consent_required: ["Falta permitir que este painel consulte o Windsor.ai.", "Clique em Permitir acesso e confirme no aviso do Claude."],
    blocked_by_policy: ["A sua organização bloqueou este conector.", "Fale com o administrador da conta Claude."],
    tool_error: ["O Windsor.ai respondeu com um erro.", (e && e.message) || ""],
    pendente: ["O Windsor ainda está montando o relatório.", "Tente atualizar em um minuto."],
    sem_chave: ["Falta ligar o sistema ao Windsor.ai.", "A administradora precisa cadastrar a chave da API do Windsor no Supabase (segredo WINDSOR_API_KEY)."],
    authentication_error: ["A chave da API do Windsor foi recusada.", "Confira o segredo WINDSOR_API_KEY no Supabase: ela pode ter sido trocada no Windsor."],
    rate_limit_exceeded: ["O Windsor pediu uma pausa nas consultas.", "Tente atualizar em alguns minutos."],
    mfa: ["Confirme a verificação em duas etapas.", "Saia e entre de novo no sistema."],
    sessao: ["Sua sessão expirou.", "Saia e entre de novo no sistema."],
  }[c] || ["Não foi possível falar com o Windsor.ai agora.", "Tente atualizar daqui a pouco."];
  return {titulo: m[0], dica: m[1], permitir: c === "approval_required" || c === "consent_required" || c === "pendente" || (e && e.retryable)};
}

/* ---------- gráficos do BI ---------- */
const CFG_IG = {v: {k: "views", nome: "visualizações", cor: "#007AFF"}, a: {k: "reach", nome: "contas alcançadas", cor: "#AF52DE"}};
function graficoDiario(linhas, ini, fim, cfg = CFG_IG){
  const fv = cfg.v.f || fmtK;
  const W = 960, H = 280, pb = 30, pt = 34, esq = 44;
  const dias = dif(ini, fim) + 1, bw = (W - esq) / dias;
  const mapa = Object.fromEntries(linhas.map(r => [chaveD(r.d), r]));
  const serie = [...Array(dias)].map((_, k) => { const d = somar(ini, k), r = mapa[chaveD(d)] || {}; return {d, r, v: +r[cfg.v.k] || 0, a: cfg.a ? (+r[cfg.a.k] || 0) : 0}; });
  const mx = Math.max(10, ...serie.map(s => s.v)); const passo = Math.pow(10, Math.floor(Math.log10(mx))) * (mx / Math.pow(10, Math.floor(Math.log10(mx))) > 5 ? 2 : 1); const topo = Math.ceil(mx / passo) * passo;
  const y = v => H - pb - (v / topo) * (H - pb - pt), x = k => esq + k * bw + bw / 2;
  const grades = [...Array(Math.round(topo / passo) + 1)].map((_, i) => i * passo).map(v => `<line class="grade-l" x1="${esq}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${esq - 8}" y="${y(v) + 4}" text-anchor="end">${fv(v)}</text>`).join("");
  const linha = k => serie.map((s, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(s[k]).toFixed(1)).join(" ");
  const area = `${linha("v")} L${x(dias - 1)} ${H - pb} L${x(0)} ${H - pb}Z`;
  // faixas das campanhas e eventos do calendário
  const its = itensNoPeriodo(ini, fim, i => ["Campanha","Evento","Talk","Feira"].includes(i.formato) && i.statusData !== "cancelada" && i.cat !== "Agenda externa").slice(0, 10);
  let fila = [];
  const faixas = its.map(i => { const a = i.ini < ini ? ini : i.ini, b = i.fim > fim ? fim : i.fim; const x1 = esq + dif(ini, a) * bw, x2 = esq + (dif(ini, b) + 1) * bw;
    let lin = fila.findIndex(v => v < x1); if(lin === -1){ lin = fila.length; fila.push(0); } fila[lin] = x2 + 60; if(lin > 1) return "";
    const cor = corCat(i.cat);
    return `<rect x="${x1}" y="${pt}" width="${Math.max(x2 - x1, 3)}" height="${H - pb - pt}" fill="${cor}" opacity=".07"/><rect x="${x1}" y="${4 + lin * 14}" width="${Math.max(x2 - x1, 3)}" height="3" rx="1.5" fill="${cor}"/><text x="${x1 + 2}" y="${15 + lin * 14}" class="eixo" style="fill:${cor};font-weight:600">${esc(i.nome.length > 28 ? i.nome.slice(0, 27) + "…" : i.nome)}</text>`; }).join("");
  const marcas = serie.map((s, k) => (k % Math.ceil(dias / 8) === 0) ? `<text class="eixo" x="${x(k)}" y="${H - 10}" text-anchor="middle">${fData(s.d)}</text>` : "").join("");
  const alvos = serie.map((s, k) => `<rect x="${esq + k * bw}" y="${pt}" width="${bw}" height="${H - pb - pt}" fill="transparent"><title>${cfg.dica ? cfg.dica(s) : `${fSem(s.d)}: ${fmtN(s.v)} ${cfg.v.nome}${cfg.a ? ` · ${fmtN(s.a)} ${cfg.a.nome}` : ""}`}</title></rect>`).join("");
  const id = "gbi" + (++_gid);
  return `<svg class="svg-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.v.nome)} por dia"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cfg.v.cor}" stop-opacity=".28"/><stop offset="1" stop-color="${cfg.v.cor}" stop-opacity="0"/></linearGradient></defs>
    ${grades}${faixas}<path class="area" d="${area}" fill="url(#${id})"/><path class="traco" pathLength="100" d="${linha("v")}" fill="none" stroke="${cfg.v.cor}" stroke-width="2.4" stroke-linejoin="round"/>${cfg.a ? `<path class="traco" pathLength="100" d="${linha("a")}" fill="none" stroke="${cfg.a.cor}" stroke-width="2" stroke-linejoin="round"/>` : ""}${marcas}${alvos}</svg>`;
}

/* ---------- a aba ---------- */
function vBI(){
  setTimeout(() => carregarBI(false), 0);
  const n = BI.dias, s = st(BI.fonte), ocupado = s.estado === "carregando" || s.atualizando;
  const pont = f => { const e = st(f.id).estado; return e === "pronto" ? "on" : e === "vazio" ? "off" : ""; };
  const fontes = `<div class="segmentado bi-src" role="group" aria-label="Rede">${FONTES_BI.map(f => `<button data-bi-fonte="${f.id}" aria-pressed="${BI.fonte === f.id}"><i class="bi-pt ${pont(f)}"></i>${f.nome}</button>`).join("")}</div>`;
  const quando = s.quando ? new Date(s.quando).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) : "";
  const topo = `<div class="filtros">${fontes}
      <div class="segmentado" role="group" aria-label="Período">${[[7,"7 dias"],[30,"30 dias"],[90,"90 dias"]].map(([v, t]) => `<button data-bi-dias="${v}" aria-pressed="${n === v}">${t}</button>`).join("")}</div>
      <button class="btn" data-bi-atualizar ${ocupado ? "disabled" : ""}>${icone("i-atualizar", "p")}${s.atualizando ? "Atualizando…" : "Atualizar"}</button>
      <span class="peq sec">${s.estado === "pronto" ? `Windsor.ai · dados de ${quando} · atualiza sozinho a cada 5 min${s.erroSilencioso ? " · última tentativa falhou" : ""}` : ""}</span></div>`;
  const nomeF = FONTES_BI.find(f => f.id === BI.fonte).nome;

  if(s.estado === "sem-mcp") return `<div class="vista">${topo}<section class="cartao bi-vazio">${icone("i-bi")}<h2>O BI de redes não está disponível aqui</h2><p class="sec">Abra o sistema do Casapark com login, ou o painel publicado no Claude com o conector Windsor.ai ligado.</p></section></div>`;
  if(s.estado === "erro"){ const m = mensagemErro(s.erro); return `<div class="vista">${topo}<section class="cartao bi-vazio">${icone("i-alerta")}<h2>${esc(m.titulo)}</h2><p class="sec">${esc(m.dica)}</p>${m.permitir ? `<button class="btn primario" data-bi-atualizar>Tentar de novo</button>` : ""}</section></div>`; }
  if(s.estado === "vazio") return `<div class="vista">${topo}<section class="cartao bi-vazio">${icone("i-bi")}<h2>${esc(nomeF)} ainda não está conectado</h2><p class="sec">Nenhum dado de ${esc(nomeF)} chegou do Windsor.ai neste período. Conecte a conta em windsor.ai (Conectores → ${esc(nomeF)}) com um perfil que tenha acesso a ela; os números aparecem aqui sozinhos em seguida.</p><button class="btn" data-bi-atualizar>Verificar de novo</button></section></div>`;
  if(s.estado !== "pronto"){
    const esq = `<div class="bi-esq">${[1,2,3,4].map(() => `<div class="cartao c3 sk"><i></i><i></i><i></i></div>`).join("")}<div class="cartao c12 sk alto"><i></i></div></div>`;
    return `<div class="vista">${topo}<p class="peq sec" style="margin:-8px 0 16px">Buscando os dados de ${esc(nomeF)} no Windsor.ai…</p>${esq}</div>`;
  }
  if(BI.fonte === "google_ads" || BI.fonte === "facebook") return vAds(topo, s);
  if(BI.fonte === "facebook_organic") return vPagina(topo, s);

  // períodos
  const fim = somar(HOJE, -1), ini = somar(fim, -(n - 1)), iniAnt = somar(ini, -n), fimAnt = somar(ini, -1);
  const no = (r, a, b) => r.d >= a && r.d <= b;
  const atual = BI.conta.filter(r => no(r, ini, fim)), ant = BI.conta.filter(r => no(r, iniAnt, fimAnt));
  const soma = (l, k) => l.reduce((s, r) => s + (+r[k] || 0), 0);
  const media = (l, k) => l.length ? soma(l, k) / l.length : null;
  const varr = (a, b) => (b ? (a - b) / b : null);
  const engA = soma(atual, "accounts_engaged") / Math.max(soma(atual, "reach"), 1), engB = soma(ant, "accounts_engaged") / Math.max(soma(ant, "reach"), 1);
  const segs = BI.seg ? +BI.seg.followers_count : null;
  const novos = soma(atual.filter(r => dif(r.d, HOJE) <= 30), "follower_count_1d");
  const delta = v => v == null ? `<span class="sec">sem comparação</span>` : `<span class="bi-delta ${v >= 0 ? "sobe" : "desce"}">${v >= 0 ? "▲" : "▼"} ${fmtP(Math.abs(v), 0)}</span> <span class="sec">vs. ${n} dias antes</span>`;
  const serie = k => atual.map(r => +r[k] || 0);
  const kpis = [
    {l:"Seguidores", v:segs, f:fmtK, s: novos ? `<span class="bi-delta sobe">+${fmtN(novos)}</span> <span class="sec">novos ${n > 30 ? "nos últimos 30 dias" : "no período"}</span>` : "", cor:"#007AFF", ic:"i-pessoas", vals: serie("follower_count_1d")},
    {l:"Alcance médio por dia", v:media(atual, "reach"), f:fmtK, s: delta(varr(media(atual, "reach"), media(ant, "reach"))), cor:"#AF52DE", ic:"i-alcance", vals: serie("reach")},
    {l:"Visualizações", v:soma(atual, "views"), f:fmtK, s: delta(varr(soma(atual, "views"), soma(ant, "views"))), cor:"#30B0C7", ic:"i-olho", vals: serie("views")},
    {l:"Interações", v:soma(atual, "total_interactions"), f:fmtK, s: delta(varr(soma(atual, "total_interactions"), soma(ant, "total_interactions"))), cor:"#FF9500", ic:"i-coracao", vals: serie("total_interactions")},
  ];
  const kpiHtml = kpis.map(k => `<section class="cartao kpi c3" style="--c:${k.cor}"><div class="kpi-cab"><span class="kpi-ico">${icone(k.ic, "p")}</span><span class="rotulo">${esc(k.l)}</span></div><div class="num">${k.f(k.v)}</div><div class="peq">${k.s}</div>${k.vals.length > 1 ? spark(k.vals, k.cor) : ""}</section>`).join("");

  // posts do período
  const posts = BI.posts.filter(p => p.t >= ini && p.t <= somar(fim, 1));
  const taxa = p => (+p.media_engagement || 0) / Math.max(+p.media_reach || 0, 1);
  const ordem = {engaj: (a, b) => taxa(b) - taxa(a), alcance: (a, b) => (+b.media_reach || 0) - (+a.media_reach || 0), recentes: (a, b) => b.t - a.t}[BI.ord];
  const nomeFmt = p => ({CAROUSEL_ALBUM:"Carrossel", IMAGE:"Foto", VIDEO:"Vídeo", REEL:"Reels"})[p.media_type] || p.media_type;
  const corFmt = {Carrossel:"#007AFF", Foto:"#FF9500", "Vídeo":"#AF52DE", Reels:"#FF2D55"};
  const medTaxa = posts.length ? posts.reduce((s, p) => s + taxa(p), 0) / posts.length : 0;
  const linhasP = [...posts].sort(ordem).slice(0, 12).map((p, k) => { const tx = taxa(p), f = nomeFmt(p);
    return `<tr><td class="tab sec">${k + 1}</td><td><div class="bi-leg">${esc((p.media_caption || "(sem legenda)").replace(/\s+/g, " ").slice(0, 110))}${(p.media_caption || "").length > 110 ? "…" : ""}</div><div class="peq sec"><span class="bi-fmt" style="--c:${corFmt[f] || "#8E8E93"}">${f}</span> ${fSem(p.t)} · ${String(p.t.getHours()).padStart(2, "0")}h · ${fmtN(p.media_saved)} salvos · ${fmtN(p.media_shares)} compart.${p.media_permalink ? ` · <a class="link-item" href="${esc(p.media_permalink)}" target="_blank" rel="noopener">abrir post</a>` : ""}</div></td>
      <td class="tab">${fmtN(p.media_reach)}</td><td class="tab">${fmtN(p.media_views)}</td><td class="tab">${fmtN(p.media_engagement)}</td>
      <td style="min-width:120px"><div class="progresso"><div class="barra"><i style="width:${Math.min(100, tx / Math.max(medTaxa * 2, .0001) * 100)}%;background:${tx >= medTaxa ? "#34C759" : "#AEAEB2"}"></i></div><span class="tab peq">${fmtP(tx)}</span></div></td></tr>`; }).join("");

  // formatos
  const porFmt = {}; posts.forEach(p => { const f = nomeFmt(p); (porFmt[f] ||= []).push(p); });
  const fmts = Object.entries(porFmt).map(([f, l]) => ({f, n: l.length, tx: l.reduce((s, p) => s + taxa(p), 0) / l.length, alc: l.reduce((s, p) => s + (+p.media_reach || 0), 0) / l.length})).sort((a, b) => b.tx - a.tx);
  const mxTx = Math.max(.0001, ...fmts.map(x => x.tx));
  const fmtHtml = fmts.map(x => `<li><span class="bi-fmt" style="--c:${corFmt[x.f] || "#8E8E93"}">${x.f}</span><span><span class="cbar" style="margin:0 0 6px"><i style="width:${100 * x.tx / mxTx}%;background:${corFmt[x.f] || "#8E8E93"}"></i></span><small class="peq sec">${plural(x.n, "post")} · ${fmtK(x.alc)} de alcance médio</small></span><b class="n">${fmtP(x.tx)}</b></li>`).join("");

  // dia × horário (horário de Brasília)
  const faixasH = [["Manhã", 6, 12], ["Tarde", 12, 18], ["Noite", 18, 24]];
  const grade = {}; posts.forEach(p => { const d = (p.t.getDay() + 6) % 7, h = faixasH.findIndex(([, a, b]) => p.t.getHours() >= a && p.t.getHours() < b); if(h < 0) return; const k = d + "-" + h; (grade[k] ||= []).push(taxa(p)); });
  const vals = Object.values(grade).map(l => l.reduce((s, v) => s + v, 0) / l.length); const mxG = Math.max(.0001, ...vals);
  const melhor = Object.entries(grade).map(([k, l]) => ({k, v: l.reduce((s, v) => s + v, 0) / l.length, n: l.length})).sort((a, b) => b.v - a.v)[0];
  const SEMI = ["seg","ter","qua","qui","sex","sáb","dom"];
  const heatDH = `<div class="bi-dh"><span></span>${SEMI.map(s => `<span class="rotulo">${s}</span>`).join("")}${faixasH.map(([nm], h) => `<span class="rotulo">${nm}</span>` + SEMI.map((_, d) => { const l = grade[d + "-" + h]; const v = l ? l.reduce((s, x) => s + x, 0) / l.length : null;
      return `<i style="${v != null ? `background:color-mix(in srgb,#34C759 ${Math.round(18 + 82 * v / mxG)}%,var(--suave))` : ""}" title="${SEMI[d]} · ${nm}: ${l ? l.length + " post(s), engajamento médio " + fmtP(v) : "sem posts"}">${l ? l.length : ""}</i>`; }).join("")).join("")}</div>`;

  // campanhas e eventos do calendário × posts
  const PARAR = new Set(["casapark","exposicao","evento","eventos","campanha","talk","visita","feira","semana","mostra","montagem","lancamento","premiacao","decoracao","acabamentos","sabado","domingo","brasilia","prime","viagem"]);
  const palavras = nome => norm(nome).split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !PARAR.has(w));
  const itsP = itensNoPeriodo(somar(ini, -14), somar(fim, 7), i => ["Campanha","Ação de campanha","Evento","Talk","Feira","Mercado"].includes(i.formato) && i.cat !== "Agenda externa" && i.statusData !== "cancelada");
  const cruz = itsP.map(i => { const ws = palavras(i.nome + " " + (i.campanha || "")); if(!ws.length) return null;
    const ps = BI.posts.filter(p => p.t >= somar(i.ini, -21) && p.t <= somar(i.fim, 1) && ws.some(w => norm(p.media_caption).includes(w)));
    if(!ps.length) return null;
    return {i, ps, alc: ps.reduce((s, p) => s + (+p.media_reach || 0), 0), eng: ps.reduce((s, p) => s + (+p.media_engagement || 0), 0), tx: ps.reduce((s, p) => s + taxa(p), 0) / ps.length}; }).filter(Boolean).sort((a, b) => b.alc - a.alc);
  const cruzHtml = cruz.length ? `<div class="camp-g">${cruz.slice(0, 6).map(c => `<button class="camp-c" data-item="${esc(c.i.id)}" style="align-items:flex-start;flex-direction:column;gap:6px"><span class="tipo"><i style="background:${corCat(c.i.cat)}"></i>${esc(c.i.formato)} · ${fPeriodo(c.i.ini, c.i.fim)}</span><b>${esc(c.i.nome)}</b><span class="bi-mini"><span><b>${c.ps.length}</b>posts</span><span><b>${fmtK(c.alc)}</b>alcance</span><span><b class="${c.tx >= medTaxa ? "ok" : ""}">${fmtP(c.tx)}</b>engaj.</span></span></button>`).join("")}</div>`
    : `<p class="vazio">Nenhum post do período cita uma campanha ou evento do calendário pelo nome.</p>`;

  // leituras
  const melhorDia = atual.slice().sort((a, b) => (+b.views || 0) - (+a.views || 0))[0];
  const aGraf = melhorDia ? `O pico do período foi ${fSem(melhorDia.d)}, com ${fmtN(melhorDia.views)} visualizações. As faixas coloridas no topo são campanhas e eventos do calendário: compare o volume antes, durante e depois de cada um.` : "";
  const topF = fmts[0], aFmt = topF && fmts.length > 1 ? `${topF.f} tem o maior engajamento médio (${fmtP(topF.tx)} das contas alcançadas interagem), contra ${fmtP(fmts[fmts.length - 1].tx)} de ${fmts[fmts.length - 1].f.toLowerCase()}.` : (topF ? `Todos os posts do período são ${topF.f.toLowerCase()}.` : "");
  const aDH = melhor ? `Melhor combinação até aqui: ${["segunda","terça","quarta","quinta","sexta","sábado","domingo"][+melhor.k.split("-")[0]]} à ${faixasH[+melhor.k.split("-")[1]][0].toLowerCase()} (${fmtP(melhor.v)} de engajamento médio${melhor.n === 1 ? ", com só 1 post — ainda é uma pista, não uma regra" : ", em " + melhor.n + " posts"}).` : "";
  const aCruz = cruz.length ? `${esc(cruz[0].i.nome)} foi o tema que mais alcançou pessoas no período (${fmtK(cruz[0].alc)} em ${plural(cruz[0].ps.length, "post")}). Os posts são ligados pelo nome do item que aparece na legenda.` : "";

  return `<div class="vista">${topo}<div class="grade">${kpiHtml}
    <section class="cartao c12"><div class="cab"><h2>Visualizações e alcance por dia</h2><div class="legenda-g"><span><i style="background:#007AFF"></i>Visualizações</span><span><i style="background:#AF52DE"></i>Contas alcançadas</span></div></div>${graficoDiario(atual, ini, fim)}${alerta(aGraf)}</section>
    <section class="cartao c8"><div class="cab"><h2>Posts do período</h2><div class="segmentado" role="group" aria-label="Ordenar">${[["engaj","Engajamento"],["alcance","Alcance"],["recentes","Recentes"]].map(([v, t]) => `<button data-bi-ord="${v}" aria-pressed="${BI.ord === v}">${t}</button>`).join("")}</div></div>
      ${posts.length ? `<div class="rolar"><table><thead><tr><th>#</th><th>Post</th><th>Alcance</th><th>Visualiz.</th><th>Interações</th><th>Engajamento</th></tr></thead><tbody>${linhasP}</tbody></table></div>` : `<p class="vazio">Nenhum post publicado no período.</p>`}
      ${alerta(posts.length ? `${plural(posts.length, "post publicado", "posts publicados")} no período, com engajamento médio de ${fmtP(medTaxa)} (interações ÷ contas alcançadas). Barra verde: acima da média.` : "")}</section>
    <div class="c4 pilha">
      <section class="cartao"><div class="cab"><h2>Por formato</h2></div>${fmts.length ? `<ul class="carga bi-fmts">${fmtHtml}</ul>` : `<p class="vazio">Sem posts.</p>`}${alerta(aFmt)}</section>
      <section class="cartao"><div class="cab"><h2>Dia × horário</h2><span class="peq sec">nº de posts · cor = engajamento</span></div>${heatDH}${alerta(aDH)}</section>
    </div>
    <section class="cartao c12"><div class="cab"><h2>Campanhas e eventos nas redes</h2><span class="peq sec">posts ligados aos itens do calendário</span></div>${cruzHtml}${alerta(aCruz)}</section>
  </div>
  <p class="peq sec" style="margin:16px 0 0">Dados do Instagram @${esc((BI.seg && BI.seg.username) || "casapark")} via Windsor.ai. A Meta pode levar até 48 h para consolidar os números da conta; os dos posts chegam antes. As outras redes ficam nos botões do topo.</p></div>`;
}

/* ---------- Google Ads e Meta Ads ---------- */
const CANAL = {SEARCH: "Pesquisa", DISPLAY: "Display", PERFORMANCE_MAX: "Performance Max", DEMAND_GEN: "Demand Gen", VIDEO: "YouTube", SHOPPING: "Shopping", MULTI_CHANNEL: "Várias redes", SMART: "Inteligente", LOCAL: "Local", DISCOVERY: "Discovery"};
const DISP = {MOBILE: "Celular", DESKTOP: "Computador", TABLET: "Tablet", CONNECTED_TV: "TV", OTHER: "Outros", UNKNOWN: "Outros"};
const SITU = {ENABLED: "Ativa", ACTIVE: "Ativa", PAUSED: "Pausada", REMOVED: "Removida", DELETED: "Removida", ARCHIVED: "Arquivada"};
function deltaBI(v, n, menorMelhor){
  if(v == null || !isFinite(v)) return `<span class="sec">sem comparação</span>`;
  const bom = menorMelhor ? v <= 0 : v >= 0;
  return `<span class="bi-delta ${bom ? "sobe" : "desce"}">${v >= 0 ? "▲" : "▼"} ${fmtP(Math.abs(v), 0)}</span> <span class="sec">vs. ${n} dias antes</span>`;
}
const varBI = (a, b) => (b ? (a - b) / b : null);
function kpiCard(k){
  return `<section class="cartao kpi c3" style="--c:${k.cor}"><div class="kpi-cab"><span class="kpi-ico">${icone(k.ic, "p")}</span><span class="rotulo">${esc(k.l)}</span></div><div class="num">${k.v}</div><div class="peq">${k.s || ""}</div>${k.vals && k.vals.length > 1 ? spark(k.vals, k.cor) : ""}</section>`;
}
function vAds(topo, s){
  const google = BI.fonte === "google_ads", n = BI.dias, cor = google ? "#007AFF" : "#5856D6";
  const fim = HOJE, ini = somar(fim, -(n - 1)), iniAnt = somar(ini, -n), fimAnt = somar(ini, -1);
  const no = (r, a, b) => r.d >= a && r.d <= b;
  const atual = s.linhas.filter(r => no(r, ini, fim)), ant = s.linhas.filter(r => no(r, iniAnt, fimAnt));
  const tot = l => l.reduce((t, r) => { t.imp += +r.impressions || 0; t.cli += +r.clicks || 0; t.inv += +r.spend || 0; t.conv += +r.conversions || 0; return t; }, {imp: 0, cli: 0, inv: 0, conv: 0});
  const A = tot(atual), B = tot(ant);
  const porDia = {};
  atual.forEach(r => { const o = porDia[chaveD(r.d)] ||= {d: r.d, spend: 0, clicks: 0, impressions: 0, conversions: 0}; o.spend += +r.spend || 0; o.clicks += +r.clicks || 0; o.impressions += +r.impressions || 0; o.conversions += +r.conversions || 0; });
  const dias = Object.values(porDia).sort((a, b) => a.d - b.d), serie = k => dias.map(o => o[k]);
  const ctr = t => t.imp ? t.cli / t.imp : null, cpc = t => t.cli ? t.inv / t.cli : null, cpm = t => t.imp ? t.inv / t.imp * 1000 : null;

  const kpis = [
    {l: "Investimento", v: fmtRk(A.inv), s: deltaBI(varBI(A.inv, B.inv), n), cor: cor, ic: "i-painel", vals: serie("spend")},
    {l: "Cliques", v: fmtK(A.cli), s: `${deltaBI(varBI(A.cli, B.cli), n)}<br><span class="sec">${fmtK(A.imp)} impressões</span>`, cor: "#AF52DE", ic: "i-alcance", vals: serie("clicks")},
    {l: "CTR", v: fmtP(ctr(A), 2), s: `${deltaBI(varBI(ctr(A), ctr(B)), n)}<br><span class="sec">CPC médio ${fmtR(cpc(A))}</span>`, cor: "#30B0C7", ic: "i-olho"},
    google
      ? {l: "Conversões", v: fmtN(A.conv), s: A.conv ? `<span class="sec">${fmtR(A.inv / A.conv)} por conversão · taxa ${fmtP(A.cli ? A.conv / A.cli : null, 2)}</span>` : `<span class="sec">nenhuma registrada no período</span>`, cor: "#34C759", ic: "i-check", vals: serie("conversions")}
      : {l: "CPM", v: fmtR(cpm(A)), s: `${deltaBI(varBI(cpm(A), cpm(B)), n, true)}<br><span class="sec">custo por mil impressões</span>`, cor: "#FF9500", ic: "i-coracao"},
  ].map(kpiCard).join("");

  // campanhas
  const camp = {};
  atual.forEach(r => { const c = camp[r.campaign || "(sem nome)"] ||= {nome: r.campaign || "(sem nome)", tipo: r.advertising_channel_type, situ: r.campaign_status, imp: 0, cli: 0, inv: 0, conv: 0}; c.imp += +r.impressions || 0; c.cli += +r.clicks || 0; c.inv += +r.spend || 0; c.conv += +r.conversions || 0; if(r.campaign_status) c.situ = r.campaign_status; });
  const camps = Object.values(camp).filter(c => c.imp || c.inv).sort((a, b) => b.inv - a.inv);
  const mxInv = Math.max(.01, ...camps.map(c => c.inv));
  const linhasC = camps.map(c => `<tr><td style="min-width:210px"><b>${esc(c.nome)}</b><div class="peq sec">${[google && c.tipo ? (CANAL[c.tipo] || c.tipo) : "", c.situ ? (SITU[c.situ] || c.situ) : ""].filter(Boolean).join(" · ")}</div></td>
      <td class="tab">${fmtN(c.imp)}</td><td class="tab">${fmtN(c.cli)}</td><td class="tab">${fmtP(ctr(c), 2)}</td>
      <td style="min-width:130px"><div class="progresso"><div class="barra"><i style="width:${100 * c.inv / mxInv}%;background:${cor}"></i></div><span class="tab peq">${fmtR(c.inv)}</span></div></td>
      <td class="tab">${fmtR(cpc(c))}</td>${google ? `<td class="tab">${fmtN(c.conv)}${c.conv ? `<div class="peq sec">${fmtR(c.inv / c.conv)} cada</div>` : ""}</td>` : `<td class="tab">${fmtR(cpm(c))}</td>`}</tr>`).join("");
  const tabela = camps.length ? `<div class="rolar"><table><thead><tr><th>Campanha</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Investimento</th><th>CPC</th><th>${google ? "Conversões" : "CPM"}</th></tr></thead><tbody>${linhasC}</tbody></table></div>` : `<p class="vazio">Nenhuma campanha com veiculação no período.</p>`;

  // dispositivos (Google Ads)
  let dispHtml = "";
  if(google && s.seg && s.seg.length){
    const ag = {}; s.seg.forEach(r => { const k = DISP[r.device] || r.device || "Outros"; const o = ag[k] ||= {k, cli: 0, inv: 0}; o.cli += +r.clicks || 0; o.inv += +r.spend || 0; });
    const l = Object.values(ag).sort((a, b) => b.cli - a.cli), tc = Math.max(1, l.reduce((t, o) => t + o.cli, 0)), ti = Math.max(.01, l.reduce((t, o) => t + o.inv, 0));
    dispHtml = `<section class="cartao c4"><div class="cab"><h2>Por dispositivo</h2><span class="peq sec">cliques · investimento</span></div><ul class="carga bi-fmts">${l.map(o => `<li><span class="bi-fmt" style="--c:${cor}">${esc(o.k)}</span><span><span class="cbar" style="margin:0 0 6px"><i style="width:${100 * o.cli / tc}%;background:${cor}"></i></span><small class="peq sec">${fmtR(o.inv)} · ${fmtP(o.inv / ti, 0)} do investimento</small></span><b class="n">${fmtP(o.cli / tc, 0)}</b></li>`).join("")}</ul>${alerta(l[0] ? `${l[0].k} traz ${fmtP(l[0].cli / tc, 0)} dos cliques.` : "")}</section>`;
  }

  // leituras
  const topo1 = camps[0];
  const aCamp = topo1 ? `${esc(topo1.nome)} concentra ${fmtP(topo1.inv / Math.max(A.inv, .01), 0)} do investimento do período${camps.length > 1 ? `; a de menor CPC é ${esc([...camps].filter(c => c.cli).sort((a, b) => cpc(a) - cpc(b))[0].nome)} (${fmtR(cpc([...camps].filter(c => c.cli).sort((a, b) => cpc(a) - cpc(b))[0]))} por clique)` : ""}.` : "";
  const aConv = google && A.inv > 0 && A.conv < 5 ? "Quase nenhuma conversão registrada. Isso costuma indicar que as conversões (clique em “Como chegar”, WhatsApp, ligação, formulário) não estão configuradas no Google Ads, e não que as campanhas vão mal." : "";
  const pico = [...dias].sort((a, b) => b.clicks - a.clicks)[0];
  const aGraf = pico ? `Dia com mais cliques: ${fSem(pico.d)} (${fmtN(pico.clicks)} cliques, ${fmtR(pico.spend)} investidos). As faixas no topo são campanhas e eventos do calendário.` : "";
  const cfg = {v: {k: "spend", nome: "investido", cor, f: v => "R$ " + fmtK(v)}, a: null, dica: x => `${fSem(x.d)}: ${fmtR(x.v)} investidos · ${fmtN(x.r.clicks)} cliques · ${fmtN(x.r.impressions)} impressões${google ? ` · ${fmtN(x.r.conversions)} conversões` : ""}`};

  return `<div class="vista">${topo}<div class="grade">${kpis}
    <section class="cartao c12"><div class="cab"><h2>Investimento por dia</h2><div class="legenda-g"><span><i style="background:${cor}"></i>Investimento (passe o mouse para ver cliques)</span></div></div>${graficoDiario(dias, ini, fim, cfg)}${alerta(aGraf)}</section>
    <section class="cartao ${dispHtml ? "c8" : "c12"}"><div class="cab"><h2>Campanhas</h2><span class="peq sec">${plural(camps.length, "campanha")} com veiculação</span></div>${tabela}${alerta([aCamp, aConv].filter(Boolean).join(" "))}</section>
    ${dispHtml}
  </div>
  <p class="peq sec" style="margin:16px 0 0">Dados de ${google ? "Google Ads" : "Meta Ads (Facebook e Instagram)"} via Windsor.ai, incluindo hoje. As plataformas consolidam os números com algumas horas de atraso, e o Windsor renova os últimos dias conforme o plano contratado.</p></div>`;
}

/* ---------- Página do Facebook ---------- */
function vPagina(topo, s){
  const n = BI.dias, cor = "#1877F2";
  const fim = somar(HOJE, -1), ini = somar(fim, -(n - 1)), iniAnt = somar(ini, -n), fimAnt = somar(ini, -1);
  const no = (r, a, b) => r.d >= a && r.d <= b;
  const atual = s.conta.filter(r => no(r, ini, fim)), ant = s.conta.filter(r => no(r, iniAnt, fimAnt));
  const soma = (l, k) => l.reduce((t, r) => t + (+r[k] || 0), 0), serie = k => atual.map(r => +r[k] || 0);
  const ult = [...s.conta].reverse().find(r => r.page_follows != null && r.page_follows !== "");
  const kpis = [
    {l: "Seguidores", v: ult ? fmtK(+ult.page_follows) : "—", s: soma(atual, "page_daily_follows") ? `<span class="bi-delta sobe">+${fmtN(soma(atual, "page_daily_follows"))}</span> <span class="sec">novos no período</span>` : "", cor, ic: "i-pessoas", vals: serie("page_daily_follows")},
    {l: "Impressões", v: fmtK(soma(atual, "page_impressions")), s: deltaBI(varBI(soma(atual, "page_impressions"), soma(ant, "page_impressions")), n), cor: "#AF52DE", ic: "i-olho", vals: serie("page_impressions")},
    {l: "Engajamentos", v: fmtK(soma(atual, "page_post_engagements")), s: deltaBI(varBI(soma(atual, "page_post_engagements"), soma(ant, "page_post_engagements")), n), cor: "#FF9500", ic: "i-coracao", vals: serie("page_post_engagements")},
    {l: "Visitas à página", v: fmtK(soma(atual, "page_views_total")), s: deltaBI(varBI(soma(atual, "page_views_total"), soma(ant, "page_views_total")), n), cor: "#30B0C7", ic: "i-alcance", vals: serie("page_views_total")},
  ].map(kpiCard).join("");
  const posts = (s.posts || []).filter(p => p.t >= ini && p.t <= somar(fim, 1));
  const eng = p => (+p.post_reactions_no_shares || 0) + (+p.post_comments_total || 0) + (+p.post_activity_by_action_type_share || 0);
  const linhasP = [...posts].sort((a, b) => eng(b) - eng(a)).slice(0, 12).map((p, k) => `<tr><td class="tab sec">${k + 1}</td><td><div class="bi-leg">${esc((p.post_message || "(sem texto)").replace(/\s+/g, " ").slice(0, 110))}${(p.post_message || "").length > 110 ? "…" : ""}</div><div class="peq sec">${fSem(p.t)}${p.permalink_url ? ` · <a class="link-item" href="${esc(p.permalink_url)}" target="_blank" rel="noopener">abrir post</a>` : ""}</div></td>
    <td class="tab">${fmtN(p.post_impressions)}</td><td class="tab">${fmtN(p.post_reactions_no_shares)}</td><td class="tab">${fmtN(p.post_comments_total)}</td><td class="tab">${fmtN(p.post_activity_by_action_type_share)}</td><td class="tab">${fmtN(p.post_clicks)}</td></tr>`).join("");
  const pico = [...atual].sort((a, b) => (+b.page_impressions || 0) - (+a.page_impressions || 0))[0];
  const cfg = {v: {k: "page_impressions", nome: "impressões", cor}, a: {k: "page_post_engagements", nome: "engajamentos", cor: "#FF9500"}};
  return `<div class="vista">${topo}<div class="grade">${kpis}
    <section class="cartao c12"><div class="cab"><h2>Impressões e engajamentos por dia</h2><div class="legenda-g"><span><i style="background:${cor}"></i>Impressões</span><span><i style="background:#FF9500"></i>Engajamentos</span></div></div>${graficoDiario(atual, ini, fim, cfg)}${alerta(pico ? `Pico do período: ${fSem(pico.d)}, com ${fmtN(pico.page_impressions)} impressões.` : "")}</section>
    <section class="cartao c12"><div class="cab"><h2>Posts do período</h2><span class="peq sec">ordenados por reações + comentários + compartilhamentos</span></div>
      ${posts.length ? `<div class="rolar"><table><thead><tr><th>#</th><th>Post</th><th>Impressões</th><th>Reações</th><th>Coment.</th><th>Compart.</th><th>Cliques</th></tr></thead><tbody>${linhasP}</tbody></table></div>` : `<p class="vazio">Nenhum post da página no período.</p>`}</section>
  </div>
  <p class="peq sec" style="margin:16px 0 0">Dados da página do Facebook via Windsor.ai. A Meta pode levar até 48 h para consolidar os números da página.</p></div>`;
}

document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-bi-dias],[data-bi-atualizar],[data-bi-ord],[data-bi-fonte]"); if(!b) return;
  if(b.dataset.biFonte){ BI.fonte = b.dataset.biFonte; LS.set("bi-fonte", BI.fonte); render(); }
  else if(b.dataset.biDias){ BI.dias = +b.dataset.biDias; LS.set("bi-dias", BI.dias); render(); }
  else if(b.dataset.biAtualizar !== undefined){ carregarBI(true); }
  else if(b.dataset.biOrd){ BI.ord = b.dataset.biOrd; render(); }
});

/* cabeçalho fixo */
$("#nav").innerHTML = navHTML();
$("#data-hoje").textContent = SEMANA[HOJE.getDay()] + ", " + HOJE.getDate() + " de " + MESES[HOJE.getMonth()] + " de " + HOJE.getFullYear();
$("#semana-hoje").textContent = "Hoje · semana " + semanaISO(HOJE)[1];

document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-aba],[data-item],[data-ev],[data-ev-filtro],[data-ev-rec],[data-cal-ano],[data-cal-visao],[data-cal-mes],[data-cat],[data-camp-ano],[data-redes-mes],[data-redes-ano],[data-prime-ano],[data-expandir],[data-fechar],[data-acao],[data-dia],#nova-demanda,#exportar");
  if(!b) return;
  const ds = b.dataset;
  if(ds.aba){ S.aba = ds.aba; LS.set("aba", S.aba); render(); window.scrollTo({top: 0}); }
  else if(ds.fechar !== undefined) $("#dlg").close();
  else if(ds.item !== undefined){ if(ds.item) abrirItem(ds.item); }
  else if(ds.ev){ S.ev.sel = ds.ev; render(); }
  else if(ds.evFiltro){ S.ev.filtro = ds.evFiltro; S.ev.sel = null; render(); }
  else if(ds.evRec){ S.ev.rec = ds.evRec; render(); }
  else if(ds.calAno){ S.cal.ano = +ds.calAno; render(); }
  else if(ds.calVisao){ S.cal.visao = ds.calVisao; render(); }
  else if(ds.calMes){ let m = S.cal.mes + +ds.calMes, a = S.cal.ano; if(m < 0){ m = 11; a--; } if(m > 11){ m = 0; a++; } S.cal.mes = m; S.cal.ano = a; render(); }
  else if(ds.cat){ S.cal.cats.has(ds.cat) ? S.cal.cats.delete(ds.cat) : S.cal.cats.add(ds.cat); render(); }
  else if(ds.campAno){ S.camp.ano = +ds.campAno; render(); }
  else if(ds.redesMes){ let m = S.redes.mes + +ds.redesMes, a = S.redes.ano; if(m < 0){ m = 11; a--; } if(m > 11){ m = 0; a++; } S.redes.mes = m; S.redes.ano = a; render(); }
  else if(ds.redesAno){ S.redes.ano = +ds.redesAno; render(); }
  else if(ds.primeAno){ S.prime.ano = +ds.primeAno; render(); }
  else if(ds.expandir){ LS.set("expandir-" + ds.expandir, !LS.get("expandir-" + ds.expandir, false)); render(); }
  else if(ds.dia){ const d = lerData(ds.dia); S.cal.visao = "mensal"; const its = itensCal(d, d); $("#dlg-corpo").innerHTML = `<h2 class="h2">${fSem(d)}</h2>${its.map(i => `<button class="chip" style="${estiloCat(i.cat)};margin-top:8px;font-size:14px;padding:8px" data-item="${esc(i.id)}">${esc(i.nome)}</button>`).join("")}`; $("#dlg").showModal(); }
  else if(b.id === "nova-demanda") formDemanda();
  else if(b.id === "exportar" || ds.acao === "exportar") exportar();
  else if(ds.acao === "limpar-planilhas"){ LS.del("planilhas"); iniciar(); }
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if(t.matches(".marcar[data-t]")) marcarTarefa(t.dataset.t, t.checked);
  else if(t.matches("[data-resp-item]")) mudarResp("resp", t.dataset.respItem, t.value);
  else if(t.matches("[data-resp-tarefa]")) mudarResp("respT", t.dataset.respTarefa, t.value);
  else if(t.id === "pessoa"){ S.pessoa = t.value; LS.set("pessoa", S.pessoa); render(); }
  else if(t.id === "cal-tipo"){ S.cal.tipo = t.value; render(); }
  else if(t.id === "lojas-seg"){ S.lojas.seg = t.value; render(); }
  else if(t.id === "lojas-piso"){ S.lojas.piso = t.value; render(); }
  else if(t.id === "lojas-pend"){ S.lojas.pend = t.checked; render(); }
  else if(t.id === "arquivo" && t.files.length){ carregarArquivos([...t.files]); t.value = ""; }
});
document.addEventListener("input", ev => {
  if(ev.target.id === "lojas-q"){ S.lojas.q = ev.target.value; const pos = ev.target.selectionStart; render(); const el = $("#lojas-q"); el.focus(); el.setSelectionRange(pos, pos); }
});
$("#dlg").addEventListener("click", ev => { if(ev.target === $("#dlg")) $("#dlg").close(); });
window.addEventListener("error", ev => { const c = $("#conteudo"); if(c && !c.innerHTML) c.innerHTML = `<p class="cartao">Erro ao abrir o painel: ${esc(ev.message)}</p>`; });
iniciar();
