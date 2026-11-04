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
    sb.rpc("registrar_acesso");
    try { await carregarDados(perfil); } catch(e){ return tela("Erro ao carregar", `<p class="sec">${escP(e.message || "Tente recarregar a página.")}</p>`); }
    iniciado = true;
    await carregarScript("app.js"); await carregarScript("admin.js");
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
    window.__DADOS__ = D;
    assinatura = arqs.map(a => a.nome + a.versao).sort().join("|");
    await carregarAjustes();
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
    }).catch(avisarErro);
  }

  // traz as mudanças feitas pelo resto da equipe
  let sincronizando = false;
  async function sincronizar(forcar){
    if(sincronizando) return; sincronizando = true;
    try {
      const {data: arqs} = await sb.from("arquivos").select("nome, versao");
      const nova = (arqs || []).map(a => a.nome + a.versao).sort().join("|");
      if(forcar || (arqs && nova !== assinatura)){ await carregarDados(window.PERFIL); if(typeof iniciar === "function") iniciar(); }
      else { const antes = assinaturaAjustes(); await carregarAjustes(); if(assinaturaAjustes() !== antes && typeof recarregar === "function") recarregar(); }
    } catch(e){}
    sincronizando = false;
  }
  setInterval(() => { if(iniciado && document.visibilityState === "visible") sincronizar(); }, 60e3);
  addEventListener("focus", () => { if(iniciado) sincronizar(); });

  seguir();
})();
