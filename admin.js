/* =====================================================================
   Casapark · conta, gestão de usuários e auditoria
   A interface esconde o que cada perfil não pode fazer, mas quem decide
   de verdade é o banco (RLS) e a função segura admin-usuarios.
   ===================================================================== */
"use strict";
const SB = window.__SB__, EU = window.PERFIL;
const NOME_PAPEL = {admin: "Administrador", editor: "Editor", leitor: "Leitor"};
const DESC_PAPEL = {admin: "Tudo, inclusive usuários e versões", editor: "Edita dados, planilhas e status", leitor: "Só visualiza"};

/* ---------- conta (todos) ---------- */
(function(){
  const lugar = document.querySelector(".barra-topo .linha");
  const b = document.createElement("div"); b.className = "conta";
  b.innerHTML = `<button class="conta-btn" type="button" aria-haspopup="true" aria-expanded="false">${avatar(EU.nome, "")}<span><b>${esc(EU.nome)}</b><small>${NOME_PAPEL[EU.papel]}</small></span></button>
    <div class="conta-menu" hidden><div class="peq sec" style="padding:8px 12px">${esc(EU.email)}</div>
      <button type="button" data-conta="sair">Sair</button><button type="button" data-conta="sair-todos">Sair de todos os dispositivos</button></div>`;
  lugar.appendChild(b);
  const menu = b.querySelector(".conta-menu"), btn = b.querySelector(".conta-btn");
  btn.onclick = () => { menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
  document.addEventListener("click", ev => { if(!b.contains(ev.target)) menu.hidden = true; });
  b.querySelector('[data-conta="sair"]').onclick = () => CASAPARK_SAIR(false);
  b.querySelector('[data-conta="sair-todos"]').onclick = () => CASAPARK_SAIR(true);
  // o botão imprimir não usa mais código embutido no HTML (bloqueado pela política de segurança)
  const imp = document.querySelector("[data-imprimir]"); if(imp) imp.onclick = () => window.print();
  if(EU.papel === "leitor"){
    $$('#arquivo').forEach(i => { i.disabled = true; i.closest("label").hidden = true; });
  }
})();

/* ---------- abas de administração ---------- */
if(EU.papel === "admin"){
  ABAS.push(
    {id:"usuarios", nome:"Usuários", ico:"i-pessoas", sub:"Convide pessoas, defina o que cada uma pode fazer e desative acessos."},
    {id:"auditoria", nome:"Auditoria", ico:"i-escudo", sub:"Quem mudou o quê e quando. Versões anteriores das planilhas podem ser restauradas."},
  );
  ORDEM_ABAS.push("usuarios", "auditoria");
  GRUPO_ABA.usuarios = "Administração"; GRUPO_ABA.auditoria = "Administração";
  ABAS.sort((a, b) => ORDEM_ABAS.indexOf(a.id) - ORDEM_ABAS.indexOf(b.id));
  ABAS.forEach(a => { a.grupo = GRUPO_ABA[a.id]; });
  VISTAS.usuarios = vUsuarios; VISTAS.auditoria = vAuditoria;
  $("#nav").innerHTML = navHTML();
}
const ADM = {perfis: null, aud: null, versoes: null, carregando: false, filtro: ""};

async function chamarFuncao(corpo){
  const {data, error} = await SB.functions.invoke("admin-usuarios", {body: corpo});
  if(error){ let msg = "Não foi possível concluir."; try { const j = await error.context.json(); msg = j.erro || msg; } catch(e){} throw new Error(msg); }
  return data;
}
async function carregarPerfis(){
  const {data, error} = await SB.from("perfis").select("user_id, nome, email, papel, ativo, criado_em, ultimo_acesso").order("nome");
  if(error) throw error; ADM.perfis = data;
}
async function carregarAuditoria(){
  const [a, v] = await Promise.all([
    SB.from("auditoria").select("id, user_id, quando, tabela, acao, chave, antes, depois").order("quando", {ascending: false}).limit(300),
    SB.from("arquivos_historico").select("id, nome, versao, salvo_por, salvo_em").order("salvo_em", {ascending: false}).limit(100),
  ]);
  if(a.error) throw a.error; if(v.error) throw v.error;
  ADM.aud = a.data; ADM.versoes = v.data;
  if(!ADM.perfis) await carregarPerfis();
}
const nomeDe = id => { const p = (ADM.perfis || []).find(x => x.user_id === id); return p ? p.nome : (id ? "Usuário removido" : "Sistema"); };
const quandoTxt = s => s ? new Date(s).toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit"}) : "—";

function vUsuarios(){
  if(!ADM.perfis){ if(!ADM.carregando){ ADM.carregando = true; carregarPerfis().catch(e => toast(e.message)).finally(() => { ADM.carregando = false; render(); }); } return `<p class="vazio">Carregando usuários…</p>`; }
  const ativos = ADM.perfis.filter(p => p.ativo), admins = ativos.filter(p => p.papel === "admin").length;
  const linhas = ADM.perfis.map(p => { const eu = p.user_id === EU.user_id;
    return `<tr class="${p.ativo ? "" : "inativo"}"><td><div class="linha" style="gap:12px;flex-wrap:nowrap">${avatar(p.nome, "g")}<div><b style="font-weight:600">${esc(p.nome)}</b>${eu ? ` <span class="pill sem-ponto neutro">você</span>` : ""}<div class="peq sec">${esc(p.email)}</div></div></div></td>
      <td><select data-adm-papel="${esc(p.user_id)}" ${eu || !p.ativo ? "disabled" : ""} aria-label="Perfil de ${esc(p.nome)}">${Object.keys(NOME_PAPEL).map(k => `<option value="${k}" ${p.papel === k ? "selected" : ""}>${NOME_PAPEL[k]}</option>`).join("")}</select></td>
      <td>${p.ativo ? pill("ok", "Ativo") : pill("neutro", "Desativado")}</td>
      <td class="peq sec tab">${quandoTxt(p.ultimo_acesso)}</td>
      <td style="text-align:right;white-space:nowrap">${eu ? "" : `<button class="btn texto" data-adm-2fa="${esc(p.user_id)}">Redefinir 2FA</button><button class="btn texto ${p.ativo ? "atraso" : ""}" data-adm-ativo="${esc(p.user_id)}" data-ativo="${p.ativo}">${p.ativo ? "Desativar" : "Reativar"}</button>`}</td></tr>`; }).join("");
  return `<div class="vista grade">
    <section class="cartao c8"><div class="cab"><h2>Equipe com acesso</h2><span class="peq sec">${plural(ativos.length, "pessoa ativa", "pessoas ativas")} · ${plural(admins, "administrador", "administradores")}</span></div>
      <div class="rolar"><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Situação</th><th>Último acesso</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
      ${alerta(admins < 2 ? "Há só um administrador. Recomendo ter dois, para que alguém consiga redefinir acessos se o celular ou a senha de um deles se perder." : "Desativar alguém corta o acesso na hora, em todos os dispositivos. O histórico do que a pessoa fez continua na auditoria.")}</section>
    <div class="c4 pilha">
      <section class="cartao"><div class="cab"><h2>Convidar pessoa</h2></div>
        <form id="f-convite" class="campos" style="grid-template-columns:1fr">
          <label><span class="rotulo">Nome</span><input type="text" name="nome" required maxlength="120"></label>
          <label><span class="rotulo">E-mail</span><input type="email" name="email" required maxlength="254"></label>
          <label><span class="rotulo">Perfil</span><select name="papel">${["leitor","editor","admin"].map(k => `<option value="${k}">${NOME_PAPEL[k]} · ${DESC_PAPEL[k]}</option>`).join("")}</select></label>
          <button class="btn primario" type="submit">${icone("i-mais", "p")}Enviar convite</button></form>
        ${alerta("A pessoa recebe um e-mail, cria a própria senha e ativa a verificação em duas etapas no primeiro acesso.")}</section>
      <section class="cartao"><div class="cab"><h2>O que cada perfil pode fazer</h2></div><ul class="leg-lista">${Object.keys(NOME_PAPEL).map(k => `<li><span><b>${NOME_PAPEL[k]}</b><div class="peq sec">${DESC_PAPEL[k]}</div></span></li>`).join("")}</ul></section>
    </div></div>`;
}

const ROT_ACAO = {INSERT: "criou", UPDATE: "alterou", DELETE: "apagou", CONVITE: "convidou", DESATIVAR: "desativou", REATIVAR: "reativou", REDEFINIR_2FA: "redefiniu o 2FA de"};
const ROT_TAB = {ajustes: "ajuste", arquivos: "planilha", perfis: "perfil", usuarios: "usuário"};
function resumoAud(a){
  if(a.tabela === "ajustes"){ const [t, id] = (a.chave || "").split(/:(.*)/); const v = a.depois && a.depois.valor; const rot = {status: "status da tarefa", resp: "responsável do item", respT: "responsável da tarefa", demanda: "demanda"}[t] || t;
    return `${rot} <span class="sec">${esc(id)}</span>${v != null && typeof v !== "object" ? ` → <b>${esc(v || "a definir")}</b>` : ""}`; }
  if(a.tabela === "arquivos") return `${esc(a.chave)}${a.depois ? ` <span class="sec">v${esc(a.depois.versao)}</span>` : ""}`;
  if(a.tabela === "perfis" && a.antes && a.depois){ const m = ["papel","ativo","nome"].filter(k => JSON.stringify(a.antes[k]) !== JSON.stringify(a.depois[k])).map(k => `${k}: ${esc(a.antes[k])} → <b>${esc(a.depois[k])}</b>`); return `${esc(a.chave)} <span class="sec">${m.join(", ")}</span>`; }
  return esc(a.chave || "");
}
function vAuditoria(){
  if(!ADM.aud){ if(!ADM.carregando){ ADM.carregando = true; carregarAuditoria().catch(e => toast(e.message)).finally(() => { ADM.carregando = false; render(); }); } return `<p class="vazio">Carregando auditoria…</p>`; }
  const q = norm(ADM.filtro);
  const lista = ADM.aud.filter(a => !q || norm(nomeDe(a.user_id) + " " + a.chave + " " + a.tabela + " " + a.acao).includes(q));
  const linhas = lista.slice(0, 200).map(a => `<tr><td class="peq sec tab" style="white-space:nowrap">${quandoTxt(a.quando)}</td><td><div class="linha" style="gap:8px;flex-wrap:nowrap">${avatar(nomeDe(a.user_id))}${esc(nomeDe(a.user_id))}</div></td><td>${ROT_ACAO[a.acao] || esc(a.acao)} ${ROT_TAB[a.tabela] || esc(a.tabela)}</td><td class="peq">${resumoAud(a)}</td></tr>`).join("");
  const versoes = ADM.versoes.slice(0, 30).map(v => `<li><span><b>${esc(v.nome)}</b> <span class="sec">v${v.versao}</span><div class="peq sec">substituída · salva por ${esc(nomeDe(v.salvo_por))} em ${quandoTxt(v.salvo_em)}</div></span><button class="btn texto" data-adm-restaurar="${esc(v.nome)}" data-versao="${v.versao}">Restaurar</button></li>`).join("");
  return `<div class="vista grade">
    <section class="cartao c8"><div class="cab"><h2>Registro de alterações</h2><input type="search" id="adm-q" placeholder="Filtrar por pessoa, item, planilha…" value="${esc(ADM.filtro)}" style="min-width:240px"></div>
      ${lista.length ? `<div class="rolar"><table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${linhas}</tbody></table></div>` : `<p class="vazio">Nada registrado ainda.</p>`}
      ${alerta("Este registro não pode ser editado nem apagado por ninguém, nem por administradores.")}</section>
    <section class="cartao c4"><div class="cab"><h2>Versões das planilhas</h2></div>${versoes ? `<ul class="leg-lista adm-versoes">${versoes}</ul>` : `<p class="vazio">Ainda não há versões anteriores.</p>`}
      ${alerta("Restaurar cria uma versão nova com o conteúdo antigo; nada é perdido.")}</section></div>`;
}

document.addEventListener("change", async ev => {
  const t = ev.target;
  if(t.dataset.admPapel){
    const p = ADM.perfis.find(x => x.user_id === t.dataset.admPapel); const novo = t.value;
    if(!confirm(`Mudar ${p.nome} para ${NOME_PAPEL[novo]}?`)){ t.value = p.papel; return; }
    const {error} = await SB.from("perfis").update({papel: novo}).eq("user_id", p.user_id);
    if(error){ toast(/administrador ativo/.test(error.message) ? "A empresa precisa de pelo menos um administrador ativo." : "Não foi possível mudar o perfil."); t.value = p.papel; return; }
    p.papel = novo; toast(`${p.nome} agora é ${NOME_PAPEL[novo]}`); render();
  }
});
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-adm-ativo],[data-adm-2fa],[data-adm-restaurar]"); if(!b) return;
  try {
    if(b.dataset.admAtivo){ const p = ADM.perfis.find(x => x.user_id === b.dataset.admAtivo); const desativar = b.dataset.ativo === "true";
      if(!confirm(desativar ? `Desativar ${p.nome}? O acesso é cortado na hora.` : `Reativar ${p.nome}?`)) return;
      b.disabled = true; await chamarFuncao({acao: desativar ? "desativar" : "reativar", user_id: p.user_id}); toast(desativar ? `${p.nome} desativada` : `${p.nome} reativada`); await carregarPerfis(); render(); }
    else if(b.dataset.adm2fa){ const p = ADM.perfis.find(x => x.user_id === b.dataset.adm2fa);
      if(!confirm(`Redefinir a verificação em duas etapas de ${p.nome}? No próximo acesso ela vai cadastrar um novo app autenticador.`)) return;
      b.disabled = true; await chamarFuncao({acao: "redefinir_2fa", user_id: p.user_id}); toast("Verificação redefinida"); b.disabled = false; }
    else if(b.dataset.admRestaurar){ const nome = b.dataset.admRestaurar, v = +b.dataset.versao;
      if(!confirm(`Restaurar ${nome} para a versão ${v}? A versão atual continua guardada no histórico.`)) return;
      b.disabled = true; const {error} = await SB.rpc("restaurar_versao", {p_nome: nome, p_versao: v}); if(error) throw new Error("Não foi possível restaurar.");
      toast(`${nome} restaurada para a v${v}`); location.reload(); }
  } catch(e){ toast(e.message); b.disabled = false; }
});
document.addEventListener("submit", async ev => {
  if(ev.target.id !== "f-convite") return; ev.preventDefault();
  const f = new FormData(ev.target); const btn = ev.target.querySelector("button"); btn.disabled = true;
  try { await chamarFuncao({acao: "convidar", nome: String(f.get("nome")).trim(), email: String(f.get("email")).trim(), papel: f.get("papel")}); toast("Convite enviado"); ev.target.reset(); await carregarPerfis(); render(); }
  catch(e){ toast(e.message); }
  btn.disabled = false;
});
document.addEventListener("input", ev => { if(ev.target.id === "adm-q"){ ADM.filtro = ev.target.value; const p = ev.target.selectionStart; render(); const el = $("#adm-q"); el.focus(); el.setSelectionRange(p, p); } });
render();
