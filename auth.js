/* =====================================================================
   Casapark · área logada
   Login com e-mail e senha + verificação em duas etapas obrigatória.
   As regras de acesso de verdade ficam no banco (RLS): este arquivo só
   conduz o login e carrega os dados que o banco permite ver.
   ===================================================================== */
"use strict";
(function(){
  // impede que o sistema seja aberto dentro de outro site (clickjacking)
  if(window.top !== window.self){ document.documentElement.innerHTML = ""; return; }

  const CFG = window.CASAPARK_CONFIG || {};
  const $p = s => document.querySelector(s);
  const escP = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const portao = $p("#portao"), caixa = $p("#portao-caixa");
  const INATIVIDADE_MIN = 30;

  if(!CFG.supabaseUrl || !CFG.supabaseAnonKey || /COLE_AQUI/.test(CFG.supabaseUrl + CFG.supabaseAnonKey)){
    tela("Configuração pendente", `<p class="sec">Preencha o arquivo <b>config.js</b> com o endereço e a chave pública do seu projeto Supabase.</p>`); return;
  }
  // tipo de link que trouxe a pessoa até aqui (convite ou recuperação de senha) — lido antes do Supabase consumir o endereço
  const tipoLink = (new URLSearchParams(location.hash.slice(1)).get("type")) || (new URLSearchParams(location.search).get("type")) || "";
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit"}});

  // BI de redes: os números do Windsor.ai vêm da função segura "redes-bi" (a chave da API fica no servidor)
  window.__WINDSOR__ = async input => {
    const r = await sb.functions.invoke("redes-bi", {body: input});
    if(r.error){
      let e = {code: "upstream_error", message: "O servidor não respondeu."};
      try { const j = await r.error.context.json(); if(j && j.erro) e = j.erro; } catch(_){}
      throw e;
    }
    const d = r.data || {};
    if(d.erro) throw d.erro;
    return {linhas: Array.isArray(d.data) ? d.data : [], storedAt: d.em || Date.now()};
  };
  window.__SB__ = sb;

  /* ---------- telas do portão ---------- */
  function tela(titulo, corpo){
    caixa.innerHTML = `<div class="portao-logo"><span class="logo-cp" role="img" aria-label="Casapark"></span><span class="rotulo">Marketing · gestão</span></div><h1>${escP(titulo)}</h1>${corpo}<p class="portao-erro" id="portao-erro" role="alert"></p>`;
    portao.hidden = false; document.body.classList.add("bloqueado");
    const f = caixa.querySelector("input"); if(f) f.focus();
  }
  const erro = msg => { const e = $p("#portao-erro"); if(e) e.textContent = msg || ""; };
  const ocupado = (form, sim) => form.querySelectorAll("button,input").forEach(x => { x.disabled = sim; });
  const traduz = e => {
    const m = (e && (e.message || e.error_description)) || "";
    if(/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if(/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    if(/Invalid TOTP|invalid.*code|expired/i.test(m)) return "Código inválido ou expirado. Confira o horário do celular e tente o código novo.";
    if(/Password should|weak|pwned|leaked/i.test(m)) return "Senha fraca ou já exposta em vazamentos. Use uma senha longa e única.";
    if(/banned|User is banned/i.test(m)) return "Este acesso foi desativado por um administrador.";
    if(/Email not confirmed/i.test(m)) return "Confirme o e-mail pelo link do convite antes de entrar.";
    return "Não foi possível concluir. Tente novamente.";
  };
  const senhaForte = s => s.length >= 12 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);

  function telaLogin(){
    tela("Entrar", `<form id="f-login" class="portao-form" autocomplete="on">
      <label><span class="rotulo">E-mail</span><input type="email" name="email" autocomplete="username" required maxlength="254"></label>
      <label><span class="rotulo">Senha</span><input type="password" name="senha" autocomplete="current-password" required maxlength="128"></label>
      <button class="btn primario" type="submit">Entrar</button>
      <button class="btn texto" type="button" id="esqueci">Esqueci a senha</button></form>`);
    $p("#esqueci").onclick = telaEsqueci;
    $p("#f-login").onsubmit = async ev => {
      ev.preventDefault(); const f = new FormData(ev.target); ocupado(ev.target, true); erro("");
      const {error} = await sb.auth.signInWithPassword({email: String(f.get("email")).trim(), password: String(f.get("senha"))});
      ocupado(ev.target, false);
      if(error) return erro(traduz(error));
      seguir();
    };
  }
  function telaEsqueci(){
    tela("Recuperar acesso", `<form id="f-esq" class="portao-form"><p class="sec">Enviaremos um link para criar uma nova senha. A verificação em duas etapas continua valendo.</p>
      <label><span class="rotulo">E-mail</span><input type="email" name="email" required maxlength="254"></label>
      <button class="btn primario" type="submit">Enviar link</button><button class="btn texto" type="button" id="voltar">Voltar</button></form>`);
    $p("#voltar").onclick = telaLogin;
    $p("#f-esq").onsubmit = async ev => {
      ev.preventDefault(); const f = new FormData(ev.target); ocupado(ev.target, true);
      await sb.auth.resetPasswordForEmail(String(f.get("email")).trim(), {redirectTo: location.origin + location.pathname});
      // resposta sempre igual, exista ou não a conta (não revela quem tem acesso)
      tela("Verifique seu e-mail", `<p class="sec">Se este e-mail tiver acesso, você vai receber um link em instantes. Ele vale por pouco tempo.</p><button class="btn" id="voltar">Voltar ao login</button>`);
      $p("#voltar").onclick = telaLogin;
    };
  }
  function telaNovaSenha(convite){
    tela(convite ? "Bem-vinda! Crie sua senha" : "Crie uma nova senha", `<form id="f-senha" class="portao-form">
      <p class="sec">Use pelo menos 12 caracteres, com letra maiúscula, minúscula e número. Uma frase longa funciona bem.</p>
      <label><span class="rotulo">Nova senha</span><input type="password" name="s1" autocomplete="new-password" required minlength="12" maxlength="128"></label>
      <label><span class="rotulo">Repita a senha</span><input type="password" name="s2" autocomplete="new-password" required minlength="12" maxlength="128"></label>
      <button class="btn primario" type="submit">Salvar senha</button></form>`);
    $p("#f-senha").onsubmit = async ev => {
      ev.preventDefault(); const f = new FormData(ev.target); const s1 = String(f.get("s1")), s2 = String(f.get("s2"));
      if(s1 !== s2) return erro("As senhas não são iguais.");
      if(!senhaForte(s1)) return erro("A senha precisa de 12+ caracteres, com maiúscula, minúscula e número.");
      ocupado(ev.target, true);
      const {error} = await sb.auth.updateUser({password: s1});
      ocupado(ev.target, false);
      if(error) return erro(traduz(error));
      history.replaceState(null, "", location.pathname);
      seguir();
    };
  }
  async function telaCadastroMfa(){
    // remove cadastros incompletos anteriores antes de criar um novo
    const {data: lf} = await sb.auth.mfa.listFactors();
    for(const f of (lf && lf.all || []).filter(f => f.status !== "verified")) await sb.auth.mfa.unenroll({factorId: f.id});
    const {data, error} = await sb.auth.mfa.enroll({factorType: "totp", friendlyName: "Celular " + new Date().toLocaleDateString("pt-BR")});
    if(error) return tela("Erro", `<p class="sec">${escP(traduz(error))}</p>`);
    tela("Ative a verificação em duas etapas", `<form id="f-mfa" class="portao-form">
      <p class="sec">É obrigatória para todos. Abra um app autenticador (Google Authenticator, Microsoft Authenticator ou o app Senhas do iPhone) e escaneie o código:</p>
      <img class="portao-qr" src="${escP(data.totp.qr_code)}" alt="Código QR da verificação em duas etapas">
      <details><summary class="peq sec">Não consegue escanear? Digite a chave</summary><code class="portao-chave">${escP(data.totp.secret)}</code></details>
      <label><span class="rotulo">Código de 6 dígitos do app</span><input name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      <button class="btn primario" type="submit">Confirmar</button></form>`);
    $p("#f-mfa").onsubmit = async ev => {
      ev.preventDefault(); const codigo = String(new FormData(ev.target).get("codigo")).trim(); ocupado(ev.target, true);
      const {error: e2} = await sb.auth.mfa.challengeAndVerify({factorId: data.id, code: codigo});
      ocupado(ev.target, false);
      if(e2) return erro(traduz(e2));
      seguir();
    };
  }
  function telaCodigoMfa(factorId){
    tela("Verificação em duas etapas", `<form id="f-cod" class="portao-form"><p class="sec">Digite o código de 6 dígitos do seu app autenticador.</p>
      <label><span class="rotulo">Código</span><input name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      <button class="btn primario" type="submit">Verificar</button><button class="btn texto" type="button" id="sair">Usar outra conta</button>
      <p class="peq sec">Perdeu o celular? Peça a um administrador para redefinir sua verificação.</p></form>`);
    $p("#sair").onclick = () => sair();
    $p("#f-cod").onsubmit = async ev => {
      ev.preventDefault(); const codigo = String(new FormData(ev.target).get("codigo")).trim(); ocupado(ev.target, true);
      const {error} = await sb.auth.mfa.challengeAndVerify({factorId, code: codigo});
      ocupado(ev.target, false);
      if(error) return erro(traduz(error));
      seguir();
    };
  }

  /* ---------- fluxo ---------- */
  let iniciado = false;
  async function seguir(){
    const {data: {session}} = await sb.auth.getSession();
    if(!session) return telaLogin();
    if(tipoLink === "invite" || tipoLink === "recovery"){
      if(!sessionStorage.getItem("casapark.senha-definida")){ sessionStorage.setItem("casapark.senha-definida", "1"); return telaNovaSenha(tipoLink === "invite"); }
    }
    const {data: aal} = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal.currentLevel !== "aal2"){
      const {data: lf} = await sb.auth.mfa.listFactors();
      const totp = (lf && lf.totp || []).find(f => f.status === "verified");
      return totp ? telaCodigoMfa(totp.id) : telaCadastroMfa();
    }
    if(iniciado) return;
    tela("Carregando…", `<p class="sec">Buscando os dados do Casapark com segurança.</p>`);
    const {data: perfil} = await sb.from("perfis").select("user_id, empresa_id, nome, email, papel, ativo").eq("user_id", session.user.id).maybeSingle();
    if(!perfil || !perfil.ativo){ await sb.auth.signOut(); return tela("Acesso não liberado", `<p class="sec">Sua conta existe, mas não está ativa nesta empresa. Fale com um administrador.</p><button class="btn" id="voltar">Voltar</button>`), $p("#voltar").onclick = telaLogin; }
    window.PERFIL = perfil;
    sb.rpc("registrar_acesso").then(() => {}, () => {});
    try { await carregarDados(perfil); } catch(e){ return tela("Erro ao carregar", `<p class="sec">${escP(e.message || "Tente recarregar a página.")}</p>`); }
    iniciado = true;
    await carregarScript("app.js"); await carregarScript("admin.js"); await carregarScript("demandas.js");
    sessionStorage.removeItem("casapark.senha-definida");
    portao.hidden = true; document.body.classList.remove("bloqueado");
    document.body.classList.add("papel-" + perfil.papel);
    vigiarInatividade(); sincronizar();
  }
  const carregarScript = src => new Promise((ok, falha) => { const s = document.createElement("script"); s.src = src + "?v=" + (CFG.versao || "1"); s.onload = ok; s.onerror = () => falha(new Error("Falha ao carregar " + src)); document.body.appendChild(s); });

  async function sair(todos){
    try { await sb.auth.signOut({scope: todos ? "global" : "local"}); } catch(e){}
    try { Object.keys(localStorage).filter(k => k.startsWith("casapark.")).forEach(k => localStorage.removeItem(k)); } catch(e){}
    location.replace(location.pathname);
  }
  window.CASAPARK_SAIR = sair;

  function vigiarInatividade(){
    let t; const reinicia = () => { clearTimeout(t); t = setTimeout(() => sair(), INATIVIDADE_MIN * 60e3); };
    ["click","keydown","mousemove","touchstart","scroll"].forEach(ev => addEventListener(ev, reinicia, {passive: true}));
    reinicia();
  }
  sb.auth.onAuthStateChange((ev) => { if(ev === "SIGNED_OUT" && iniciado) location.replace(location.pathname); });

  /* ---------- dados ---------- */
  const TIPOS = {status: "status", resp: "resp", respT: "respT", demandas: "demanda"};
  const cache = {status: {}, resp: {}, respT: {}, demanda: {}};
  let assinatura = "";

  async function carregarDados(perfil){
    const {data: arqs, error} = await sb.from("arquivos").select("nome, conteudo, versao, atualizado_em");
    if(error) throw error;
    const meta = arqs.find(a => a.nome === "_meta.json");
    let D = {}; try { D = meta ? JSON.parse(meta.conteudo) : {}; } catch(e){ D = {}; }
    D.arquivos = Object.fromEntries(arqs.filter(a => a.nome.endsWith(".csv")).map(a => [a.nome, a.conteudo]));
    const ult = arqs.reduce((m, a) => a.atualizado_em > m ? a.atualizado_em : m, "");
    D.gerado_em = ult ? new Date(ult).toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"}) : "";
    juntarAgendaGoogle(D, await buscarGoogle());
    window.__DADOS__ = D;
    assinatura = arqs.map(a => a.nome + a.versao).sort().join("|");
    await carregarAjustes();
  }
  /* ---------- Google Agenda → calendário do sistema ----------
     O Google manda nas datas: o que mudar lá aparece aqui. As planilhas de calendário (se carregadas)
     só dão a classificação e o ID que liga o item às tarefas. Itens futuros apagados no Google somem daqui. */
  const CAT_AGENDA = {"Casapark Prime": "Casapark Prime", "Espaço Casa": "Espaço Casa / Arquitetos", "Eventos externos": "Agenda externa"};
  const FMT_AGENDA = {"Espaço Casa": "Talk", "Eventos externos": "Mercado"};
  const AGENDA_CSV = {"casapark": "Agenda Casapark", "agenda casapark": "Agenda Casapark", "casapark prime": "Casapark Prime", "espaco casa": "Espaço Casa", "eventos externos": "Eventos externos"};
  const PALAVRAS_FRACAS = new Set(["casapark","evento","eventos","talk","talks","visita","reuniao","semana","casa","prime","campanha","exposicao","feira","mensal","definir","tema","palestrante","confirmar"]);
  const semAcento = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const palavras = t => semAcento(t).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !PALAVRAS_FRACAS.has(w));
  function linhasCSV(txt){
    const L = []; let campo = "", linha = [], q = false; txt = String(txt || "").replace(/^﻿/, "");
    for(let i = 0; i < txt.length; i++){ const c = txt[i];
      if(q){ if(c === '"'){ if(txt[i+1] === '"'){ campo += '"'; i++; } else q = false; } else campo += c; }
      else if(c === '"') q = true; else if(c === ";"){ linha.push(campo); campo = ""; }
      else if(c === "\n" || c === "\r"){ if(c === "\r" && txt[i+1] === "\n") i++; linha.push(campo); campo = ""; L.push(linha); linha = []; }
      else campo += c; }
    if(campo || linha.length){ linha.push(campo); L.push(linha); }
    return L.filter(l => l.some(x => x !== ""));
  }
  const dataBR = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
  const isoDeBR = br => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : (br || "").slice(0, 10); };
  const campoCSV = v => { v = String(v ?? ""); return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); };
  const distDias = (a, b) => Math.round((Date.parse(a + "T12:00:00") - Date.parse(b + "T12:00:00")) / 864e5);
  const hashId = t => { let h = 2166136261; for(const c of String(t)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

  // mesma limpeza de nomes do casapark.py (para achar o nome no dicionário de padronização)
  function limparNome(bruto){
    let s = String(bruto || "").trim().replace(/°/g, "º"), hora = "";
    s = s.replace(/^\[\s*prov(?:ável|avel)?\s*\]\s*[-–:]?\s*|^prov(?:ável|avel)?\s*[-–:]\s*/i, "").replace(/\s*\[prov\]\s*$/i, "");
    s = s.replace(/^\[espaço casa\]\s*[-–]\s*/i, "");
    const m = /^(\d{1,2})h(\d{2})?\s*[-–]?\s*/.exec(s);
    if(m){ hora = String(m[1]).padStart(2, "0") + ":" + (m[2] || "00"); s = s.slice(m[0].length); }
    s = s.replace(/^\d{1,2}\s*e\s*\d{1,2}\/\d{2}\s*\|\s*/, "").replace(/\s*[-–]\s*$/, "").replace(/\s+/g, " ").trim();
    return {nome: s, hora};
  }
  const chave = t => limparNome(t).nome.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  function formatoPorTitulo(t){
    const s = semAcento(t);
    if(/fechamento/.test(s)) return "Fechamento";
    if(/briefing/.test(s)) return "Briefing";
    if(/viagem/.test(s)) return "Viagem";
    if(/reuniao|alinhamento|treinamento/.test(s)) return "Reunião";
    if(/talk|palestra|hacks|visita guiada|workshop|aula/.test(s)) return "Talk";
    if(/gravacao|producao|video|fotos?\b|ensaio/.test(s)) return "Produção";
    if(/montagem|acabamento|decoracao/.test(s)) return "Montagem";
    if(/feira|vintage|panela|cinematerna|motim|fuga/.test(s)) return "Feira";
    return "";
  }

  // feriados e datas comerciais (mesma regra do casapark.py), usados só nos anos sem planilha de calendário
  function pascoa(ano){
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = (h + l - 7 * m + 114) % 31 + 1;
    return isoLocal(new Date(ano, mes - 1, dia, 12));
  }
  const enesimo = (ano, mes, diaSemana, n) => { const d = new Date(ano, mes - 1, 1, 12); d.setDate(1 + (diaSemana - d.getDay() + 7) % 7 + 7 * (n - 1)); return isoLocal(d); };
  function linhasRegra(ano){
    const p = pascoa(ano), dt = (m, d) => `${ano}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const L = [
      [dt(1, 1), "Confraternização Universal", "Feriado"], [somaDias(p, -48), "Carnaval (segunda)", "Feriado"],
      [somaDias(p, -47), "Carnaval (terça)", "Feriado"], [somaDias(p, -46), "Quarta-feira de Cinzas", "Ponto facultativo"],
      [somaDias(p, -2), "Sexta-feira Santa", "Feriado"], [dt(4, 21), "Tiradentes e aniversário de Brasília", "Feriado"],
      [dt(5, 1), "Dia do Trabalho", "Feriado"], [enesimo(ano, 5, 0, 2), "Dia das Mães", "Data comercial"],
      [somaDias(p, 60), "Corpus Christi", "Feriado"], [dt(6, 12), "Dia dos Namorados", "Data comercial"],
      [enesimo(ano, 8, 0, 2), "Dia dos Pais", "Data comercial"], [dt(9, 7), "Independência do Brasil", "Feriado"],
      [dt(10, 12), "Nossa Senhora Aparecida e Dia das Crianças", "Feriado"], [dt(11, 2), "Finados", "Feriado"],
      [dt(11, 15), "Proclamação da República", "Feriado"], [dt(11, 20), "Dia da Consciência Negra", "Feriado"],
      [somaDias(enesimo(ano, 11, 4, 4), 1), "Black Friday", "Data comercial"], [dt(11, 30), "Dia do Evangélico (DF)", "Feriado"],
      [dt(12, 25), "Natal", "Feriado"],
    ].sort((x, y) => x[0].localeCompare(y[0]));
    const linhas = L.map(([d, nome, fmt], k) => [`F${ano}-${k + 1}`, dataBR(d), dataBR(d), "", nome, "Feriado", fmt, "", "anual", "calendário oficial", "", "confirmada", "", "", "", "", ""]);
    linhas.push([`C${ano}-1`, dataBR(dt(1, 1)), dataBR(dt(6, 30)), "", "Ciclo de pontuação Prime – 1º semestre", "Casapark Prime", "Ciclo", "", "semestral", "1º semestre", "", "a confirmar", "", "", "", "", ""]);
    linhas.push([`C${ano}-2`, dataBR(dt(7, 1)), dataBR(dt(12, 31)), "", "Ciclo de pontuação Prime – 2º semestre", "Casapark Prime", "Ciclo", "", "semestral", "2º semestre", "", "a confirmar", "", "", "", "", ""]);
    return linhas.map(l => l.map(campoCSV).join(";"));
  }

  window.AGENDA_GOOGLE = {estado: "não configurada", avisos: [], total: 0, iguais: 0};
  let assinaturaGoogle = "", googleEm = 0;
  async function buscarGoogle(){
    googleEm = Date.now();
    try { const r = await sb.functions.invoke("agenda-google", {body: {}}); return (r.error || !r.data) ? null : r.data; } catch(e){ return null; }
  }
  function juntarAgendaGoogle(D, g){
    if(!g){ window.AGENDA_GOOGLE = {estado: "indisponível", avisos: [], total: 0, iguais: 0}; return; }
    const {eventos = [], avisos = [], configuradas = []} = g;
    const lidas = g.lidas || configuradas.filter(n => !avisos.some(a => a.startsWith(n + ":")));
    assinaturaGoogle = JSON.stringify(eventos);
    if(!configuradas.length){ window.AGENDA_GOOGLE = {estado: "não configurada", avisos, total: 0, iguais: 0}; return; }

    // dicionário de padronização (opcional, carregado como planilha)
    const dic = {};
    if(D.arquivos["dicionario_padronizacao.csv"]){
      const L = linhasCSV(D.arquivos["dicionario_padronizacao.csv"]), c = L[0] || [], ix = n => c.indexOf(n);
      L.slice(1).forEach(l => { const k = chave(l[ix("nome_original")]); if(k && !dic[k]) dic[k] = {item: l[ix("nome_padronizado")], formato: l[ix("formato")], categoria: l[ix("categoria")], campanha: l[ix("campanha")], fornecedor: l[ix("fornecedor")], lojas: l[ix("lojas")], acao: l[ix("acao")]}; });
    }
    const evs = eventos.map(ev => {
      const t = ev.tags || {}, p = dic[chave(ev.titulo)], ln = limparNome(ev.titulo);
      if(p && p.acao === "remover") return null;
      const item = (p && p.item) || (ln.nome ? ln.nome[0].toUpperCase() + ln.nome.slice(1) : ev.titulo);
      return {...ev, t, item, hora: ev.hora || ln.hora,
        cat: t.categoria || (p && p.categoria) || CAT_AGENDA[ev.agenda] || "Evento próprio",
        fmt: t.formato || (p && p.formato) || formatoPorTitulo(ev.titulo) || FMT_AGENDA[ev.agenda] || "Evento",
        campanha: t.campanha || (p && p.campanha) || "", fornecedor: t.fornecedor || (p && p.fornecedor) || "",
        lojas: t.lojas || (p && p.lojas) || "", resp: t.responsavel || "",
        w: [...new Set([...palavras(item), ...palavras(ev.titulo)])], usado: false};
    }).filter(Boolean);

    const hoje = isoLocal(new Date()), limite = somaDias(hoje, 440);
    let iguais = 0, atualizados = 0, removidos = 0;
    const anosCSV = new Set();
    Object.keys(D.arquivos).filter(n => /^calendario_casapark_\d{4}\.csv$/.test(n)).forEach(nome => {
      anosCSV.add(nome.slice(20, 24));
      const L = linhasCSV(D.arquivos[nome]); const cab = L[0] || []; const ix = n => cab.indexOf(n);
      const iI = ix("Início"), iF = ix("Fim"), iH = ix("Hora"), iN = ix("Item"), iA = ix("Agenda"), iS = ix("Status da data"), iID = ix("ID"), iC = ix("Categoria"), iFo = ix("Formato");
      const manter = [cab];
      L.slice(1).forEach(l => {
        if(l[iC] === "Feriado" || l[iFo] === "Ciclo"){ manter.push(l); return; }
        const ini = isoDeBR(l[iI]), fim = isoDeBR(l[iF] || l[iI]), w = palavras(l[iN]);
        let ev = evs.find(e => !e.usado && e.t.idSistema && e.t.idSistema === l[iID]);
        if(!ev && w.length){
          const nomeCSV = semAcento(l[iN]).trim();
          // mesma palavra-chave e mesmas datas (ou até 3 dias de diferença); mesmo nome exato: até 31 dias (evento remarcado)
          const cand = evs.filter(e => !e.usado && e.w.some(p => w.includes(p)) && ((e.inicio <= fim && e.fim >= ini) || Math.abs(distDias(e.inicio, ini)) <= (semAcento(e.item).trim() === nomeCSV && e.rec === "pontual" ? 31 : 3)));
          cand.sort((a, b) => Math.abs(distDias(a.inicio, ini)) - Math.abs(distDias(b.inicio, ini)));
          ev = cand[0];
        }
        const origem = AGENDA_CSV[semAcento(l[iA]).trim()];
        if(ev){
          ev.usado = true; iguais++;
          if(ev.inicio !== ini || ev.fim !== fim || (ev.hora && ev.hora !== l[iH])){ l[iI] = dataBR(ev.inicio); l[iF] = dataBR(ev.fim); if(ev.hora && iH >= 0) l[iH] = ev.hora; atualizados++; }
          if(iS >= 0) l[iS] = ev.status;
          if(iA >= 0) l[iA] = "Google · " + ev.agenda;
          manter.push(l); return;
        }
        // veio de uma agenda do Google que foi lida, a data ainda não passou e o evento não está mais lá: foi apagado
        if(origem && lidas.includes(origem) && ini >= hoje && ini <= limite){ removidos++; return; }
        manter.push(l);
      });
      D.arquivos[nome] = manter.map(l => l.map(campoCSV).join(";")).join("\r\n");
    });

    const cab = ["ID","Início","Fim","Hora","Item","Categoria","Formato","Campanha","Recorrência","Regra de data","Referência ano anterior","Status da data","Responsável","Fornecedor","Lojas participantes","Agenda","Observações"];
    const linhas = evs.filter(e => !e.usado).map(e => ["G-" + hashId(e.id), dataBR(e.inicio), dataBR(e.fim), e.hora || "", e.item, e.cat, e.fmt, e.campanha, e.rec || "pontual", "", "", e.status || "confirmada", e.resp, e.fornecedor, e.lojas, "Google · " + e.agenda, e.local || ""].map(campoCSV).join(";"));
    const total = linhas.length;
    const anos = new Set([hoje.slice(0, 4), somaDias(hoje, 365).slice(0, 4), ...eventos.map(e => e.inicio.slice(0, 4))]);
    [...anos].sort().forEach(a => { if(!anosCSV.has(a)) linhas.push(...linhasRegra(+a)); });
    D.arquivos["calendario_google.csv"] = [cab.join(";"), ...linhas].join("\r\n");
    window.AGENDA_GOOGLE = {estado: "conectada", avisos, total, iguais, atualizados, removidos, agendas: configuradas, lidas};
    if(avisos.length) console.warn("Agenda Google:", avisos.join(" | "));
  }

  async function carregarAjustes(){
    const {data, error} = await sb.from("ajustes").select("tipo, item_id, valor");
    if(error) throw error;
    Object.keys(cache).forEach(k => { cache[k] = {}; });
    data.forEach(r => { if(cache[r.tipo]) cache[r.tipo][r.item_id] = r.valor; });
  }
  const assinaturaAjustes = () => JSON.stringify(cache);

  // ponte com o "armazenamento" do painel: estas chaves passam a ser compartilhadas pela equipe
  let fila = Promise.resolve();
  const avisarErro = e => { (window.toast || alert)(window.PERFIL && window.PERFIL.papel === "leitor" ? "Seu perfil é de leitura: alterações não são salvas." : "Não foi possível salvar. Recarregando os dados…"); sincronizar(true); };
  window.__COMPARTILHADO__ = {
    tem: k => k in TIPOS || k === "planilhas",
    get(k, d){
      if(k === "planilhas") return d;
      const t = TIPOS[k];
      if(k === "demandas") return Object.values(cache.demanda).map(x => ({...x}));
      return {...cache[t]};
    },
    set(k, v){
      if(k === "planilhas") return salvarPlanilhas(v);
      const t = TIPOS[k], novo = {};
      if(k === "demandas") (v || []).forEach(d => { if(d && d.id_tarefa) novo[String(d.id_tarefa).slice(0, 200)] = d; });
      else Object.entries(v || {}).forEach(([id, val]) => { novo[String(id).slice(0, 200)] = val; });
      const antigo = cache[t]; cache[t] = novo;
      const ups = Object.keys(novo).filter(id => JSON.stringify(novo[id]) !== JSON.stringify(antigo[id])).map(id => ({empresa_id: window.PERFIL.empresa_id, tipo: t, item_id: id, valor: novo[id]}));
      const dels = Object.keys(antigo).filter(id => !(id in novo));
      fila = fila.then(async () => {
        if(ups.length){ const {error} = await sb.from("ajustes").upsert(ups); if(error) throw error; }
        if(dels.length){ const {error} = await sb.from("ajustes").delete().eq("tipo", t).in("item_id", dels); if(error) throw error; }
      }).catch(avisarErro);
    },
    del(k){
      if(k === "planilhas") return;
      const t = TIPOS[k]; const ids = Object.keys(cache[t]); cache[t] = {};
      if(!ids.length) return;
      fila = fila.then(async () => { const {error} = await sb.from("ajustes").delete().eq("tipo", t); if(error) throw error; }).catch(avisarErro);
    },
  };
  function salvarPlanilhas(v){
    const novos = (v && v.arquivos) || {}; const D = window.__DADOS__;
    const mud = Object.entries(novos).filter(([n, txt]) => /^[a-z0-9_.-]{1,80}$/.test(n) && D.arquivos[n] !== txt);
    mud.forEach(([n, txt]) => { D.arquivos[n] = txt; });
    if(!mud.length) return;
    fila = fila.then(async () => {
      const {error} = await sb.from("arquivos").upsert(mud.map(([nome, conteudo]) => ({empresa_id: window.PERFIL.empresa_id, nome, conteudo})));
      if(error) throw error;
      if(window.toast) toast(`${mud.length} planilha(s) salva(s) para toda a equipe`);
      setTimeout(() => sincronizar(true), 300);   // junta de novo com a Agenda do Google
    }).catch(avisarErro);
  }

  // traz as mudanças feitas pelo resto da equipe
  let sincronizando = false;
  async function sincronizar(forcar){
    if(sincronizando) return; sincronizando = true;
    try {
      const {data: arqs} = await sb.from("arquivos").select("nome, versao");
      const nova = (arqs || []).map(a => a.nome + a.versao).sort().join("|");
      let mudouGoogle = false;
      if(!forcar && Date.now() - googleEm > 5 * 60e3){ const g = await buscarGoogle(); mudouGoogle = !!g && JSON.stringify(g.eventos || []) !== assinaturaGoogle; }
      if(forcar || mudouGoogle || (arqs && nova !== assinatura)){ await carregarDados(window.PERFIL); if(typeof iniciar === "function") iniciar(); }
      else { const antes = assinaturaAjustes(); await carregarAjustes(); if(assinaturaAjustes() !== antes && typeof recarregar === "function") recarregar(); }
    } catch(e){}
    sincronizando = false;
  }
  setInterval(() => { if(iniciado && document.visibilityState === "visible") sincronizar(); }, 60e3);
  addEventListener("focus", () => { if(iniciado) sincronizar(); });

  seguir();
})();
