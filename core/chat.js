/* Gonflette Party : chat rapide (phrases toutes faites), en partie et dans le lobby.
   - Bouton 💬 dans le bandeau de jeu (et dans la barre du haut du lobby) : une rangée de phrases, un toucher = envoyé.
   - Transport : présence du LOBBY (vue par tout le monde, même en partie) : presence.qc = [phrase, numéro, contexte, heure].
     contexte = "m:<id de la partie>" en jeu, "l:<lieu>" dans le lobby : seuls ceux du même contexte l'affichent
     (une autre partie qui tourne en parallèle ne voit rien). La présence de la partie appartient aux jeux : on n'y touche pas.
   - Affichage : petites bulles en haut de l'écran (sous le bandeau), 3 au plus, ~2,6 s, semi-transparentes et
     « pointer-events: none » : elles ne bloquent jamais un toucher.
   - Anti-spam : 1 message / 1,5 s et 4 / 10 s par joueur (vérifié à l'envoi ET à la réception).
   - « Couper le chat » (réglage de l'appareil) : plus aucune bulle ni son des autres.
   - Emotes (rangée du haut du sélecteur, les mêmes que la barre du lobby) : en partie, presence.qc = [id de l'emote, numéro,
     contexte, heure] et une bulle montre le perso de l'envoyeur qui fait l'emote (même anti-spam, même contexte, même « couper ») ;
     dans le lobby, le perso la fait sur le sol (G.lobby.emote → presence.po, comme la barre d'emotes).
     Les anciens clients ignorent un qc dont le 1er élément n'est pas un numéro de phrase (et les numéros qu'ils ne connaissent pas).
   Index.html fournit G.lobby.chatCtx() / hostNow() / peers() / myPeer() / pushPresence(), met G.chat.presence() dans sa
   présence et appelle G.chat.update() à chaque changement des joueurs. Les anciens clients ignorent presence.qc. */
(() => {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};
const PHRASES = ["je t'ai bien baisé", "ahahahaha", "looser", "soooorrryyy", "ah d'accooord", "6️⃣7️⃣", "battle d'aura ?"];
const I67 = 5, IAURA = 6;
const ORDER = [0, 1, 2, 3, 4, IAURA, I67]; // ordre dans le sélecteur (les numéros restent ceux des anciens clients)
const EMOTES = () => (G.avatar && G.avatar.EMOTES) || [];
const emo = id => typeof id === "string" ? EMOTES().find(e => e[0] === id) || null : null;
const EM_SHOW_MS = 3200, SHOW_MS = 2600, MAX_SHOWN = 3, GAP_MS = 1500, WIN_MS = 10000, WIN_MAX = 4, STALE_MS = 20000;
const KEY_OFF = "gonflette-chat-off";
const store = {get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }};
let off = store.get(KEY_OFF) === "1";
let mine = null, nonce = Math.floor(Math.random() * 1e6), sent = [];
const seen = new Map(), recv = new Map(); // dernier message vu par joueur / heures des derniers affichés (anti-spam à la réception)
const L = () => G.lobby || {};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const now = () => Date.now();
const clock = () => { try { return L().hostNow ? L().hostNow() : now(); } catch (e) { return now(); } };
const ctxNow = () => { try { return L().chatCtx ? L().chatCtx() : null; } catch (e) { return null; } };

/* ---------- style ---------- */
const css = `
#qc-stack{position:fixed;z-index:215;left:50%;top:calc(52px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:grid;justify-items:center;gap:4px;pointer-events:none;width:max-content;max-width:min(94vw,440px)}
.qc-b{pointer-events:none;display:flex;align-items:center;gap:6px;max-width:100%;padding:2px 11px 2px 2px;border-radius:999px;background:rgba(18,12,24,.62);border:2px solid rgba(255,255,255,.22);color:#fff;font-family:var(--f-ui,"Barlow Condensed",sans-serif);font-weight:800;font-size:.92rem;line-height:1.1;box-shadow:0 4px 12px #0006;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:qcin .26s cubic-bezier(.2,1.5,.4,1) both;opacity:.92}
.qc-b.me{border-color:#ffcc33aa}
.qc-b.out{animation:qcout .3s ease-in forwards}
.qc-b .qc-h{flex:none;width:26px;height:26px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#ffffff40,transparent 70%),#2a2233;border:2px solid #ffcc33}
.qc-b .qc-h svg{width:100%;height:100%;display:block}
.qc-b .qc-n{flex:none;color:#ffcc33;max-width:8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qc-b .qc-t{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qc-67{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.qc-67 i{display:inline-block;font-style:normal;font-size:1.15em;animation:qc67 .56s steps(1) infinite}.qc-67 i+i{animation-delay:-.28s}
.qc-67 b{font-family:var(--f-display,"Anton",Impact,sans-serif);font-weight:400;letter-spacing:.03em;color:#ffcc33;font-size:.92em}
@keyframes qc67{0%{transform:translateY(-3px)}50%{transform:translateY(3px)}}
@keyframes qcin{from{opacity:0;transform:translateY(-12px) scale(.85)}}
@keyframes qcout{to{opacity:0;transform:translateY(-8px) scale(.9)}}
.qc-btn{position:relative}
/* lobby du téléphone : la barre du haut est déjà pleine, le 💬 se met au bout de la rangée des lieux */
.qc-lob{display:none}
html.imm .topbar .qc-btn{display:none}
html.imm .qc-lob{display:grid;place-items:center;position:fixed;z-index:30;top:var(--top2);right:calc(var(--hx) + var(--sar));width:var(--row2,34px);height:var(--row2,34px);padding:0;border-radius:50%;background:var(--glass);border:2px solid var(--glass-b);color:var(--text);font-size:1.05rem;line-height:1;box-shadow:0 3px 10px #0006;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);cursor:pointer}
html.imm .qc-lob:active{transform:scale(.92)}
@media (orientation:landscape){html.imm .qc-lob{top:var(--top3)}html.imm body #scr-lobby #so-bar.on{right:calc(var(--hx) + var(--sar) + var(--row2,34px) + 6px)}}
.qc-btn.cool{opacity:.5}
.qc-btn.off::after{content:"";position:absolute;left:18%;right:18%;top:50%;height:2.5px;background:#ff5a5f;transform:rotate(-35deg);border-radius:2px}
#qc-pick{position:fixed;z-index:230;display:flex;flex-direction:column;align-items:stretch;gap:5px;padding:7px;border-radius:16px;background:rgba(22,15,30,.94);border:2px solid var(--gold,#ffcc33);box-shadow:0 10px 26px #000a;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:qcpk .18s cubic-bezier(.2,1.5,.4,1);max-width:calc(100vw - 16px)}
#qc-pick button{display:flex;align-items:center;gap:6px;min-height:36px;padding:5px 12px;border-radius:999px;border:2px solid rgba(255,255,255,.2);background:#ffffff12;color:var(--text,#fff);font:inherit;font-family:var(--f-ui,"Barlow Condensed",sans-serif);font-weight:800;font-size:.95rem;text-align:left;cursor:pointer;white-space:nowrap}
#qc-pick button:active{transform:scale(.95)}
#qc-pick button.qc-p67{justify-content:center;background:#ffcc3322;border-color:#ffcc3388}
#qc-pick .qc-x{min-height:30px;font-size:.82rem;color:var(--dim,#b9aec6);justify-content:center;border-style:dashed}
@keyframes qcpk{from{opacity:0;transform:translateY(-8px) scale(.9)}}
.qc-aura{background:linear-gradient(90deg,#c77dff,#ffd23f,#7fe7ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 4px #b14dff99)}
#qc-pick button.qc-pa{border-color:#b14dff88;background:#b14dff22}
/* emotes : bulle avec le perso entier qui fait l'emote */
.qc-b.qc-em{padding:2px 12px 2px 3px;border-radius:18px;gap:7px}
.qc-b.qc-em .qc-av{flex:none;width:62px;height:58px;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 35%,#ffffff30,transparent 70%),#2a2233;border:2px solid #ffcc33}
.qc-b.qc-em .qc-av svg{width:100%;height:100%;display:block}
.qc-b.qc-em .qc-tx{display:grid;gap:1px;min-width:0}
.qc-b.qc-em .qc-e{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.9rem}
.qc-b.qc-em .qc-w{font-family:var(--f-display,"Anton",Impact,sans-serif);font-weight:400;letter-spacing:.03em;font-size:.82rem;color:var(--qcw,#ffcc33);-webkit-text-stroke:.8px #1d1420;paint-order:stroke fill;white-space:nowrap}
#qc-pick .qc-lb{font:800 .72rem var(--f-ui,"Barlow Condensed",sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--dim,#b9aec6);padding:0 4px}
#qc-pick .qc-eg{display:grid;grid-template-columns:repeat(6,40px);gap:4px;justify-content:center}
#qc-pick .qc-eg button{display:grid;place-items:center;width:40px;height:40px;min-height:0;padding:0;border-radius:12px;font-size:1.25rem;line-height:1;justify-content:center;background:#ffcc3314;border-color:#ffcc3355}
#qc-pick .qc-eg button small{display:none}
#qc-pick .qc-eg button.e67{font-size:.72rem;letter-spacing:-.04em}
#qc-pick .qc-sep{height:1px;background:#ffffff22;margin:2px 4px}
@media (prefers-reduced-motion:reduce){.qc-b,.qc-67 i,#qc-pick{animation:none!important}}
`;
{ const s = document.createElement("style"); s.id = "qc-css"; s.textContent = css; document.head.appendChild(s); }

/* ---------- bulles ---------- */
const heads = new Map();
function headSvg(look, xp) {
  const A = G.avatar; if (!A || !look) return "";
  const k = JSON.stringify([look, xp || 0]);
  let v = heads.get(k);
  if (v == null) { try { v = A.svg(look, xp || 0, {view: "bust"}); } catch (e) { v = ""; } heads.set(k, v); if (heads.size > 40) heads.delete(heads.keys().next().value); }
  return v;
}
const emSvgs = new Map();
function emoteSvg(look, xp, id) {
  const A = G.avatar; if (!A || !look) return "";
  const k = JSON.stringify([look, xp || 0, id]);
  let v = emSvgs.get(k);
  if (v == null) { try { v = A.svg(look, xp || 0, {pose: id}); } catch (e) { v = ""; } emSvgs.set(k, v); if (emSvgs.size > 24) emSvgs.delete(emSvgs.keys().next().value); }
  return v;
}
const phraseHtml = i => i === IAURA ? `<span class="qc-aura">${esc(PHRASES[i])}</span>` : i === I67 ? `<span class="qc-67"><i>6️⃣</i><i>7️⃣</i><b>SIX… SEVEN !</b></span>` : esc(PHRASES[i]);
function stackTop() {
  const gl = document.getElementById("game-layer");
  if (gl && !gl.classList.contains("hidden")) { const t = gl.querySelector(".game-top"); return t ? t.getBoundingClientRect().bottom + 5 : 8; }
  if (document.documentElement.classList.contains("imm")) {
    let b = 0;
    for (const sel of [".topbar", ".placebar", "#so-bar.on"]) { const el = document.querySelector("#scr-lobby " + sel) || document.querySelector(sel); if (el) { const r = el.getBoundingClientRect(); if (r.height && r.top < innerHeight / 3) b = Math.max(b, r.bottom); } }
    return b + 6;
  }
  return 8;
}
function stack() {
  let s = document.getElementById("qc-stack");
  if (!s) { s = document.createElement("div"); s.id = "qc-stack"; s.setAttribute("role", "log"); s.setAttribute("aria-live", "polite"); document.body.appendChild(s); }
  return s;
}
function show(peer, i, isMe) {
  const pr = isMe ? null : peerPresence(peer);
  const prof = isMe && L().profile ? L().profile() : null;
  const look = isMe ? (L().myLook ? L().myLook() : prof && prof.look) : pr && pr.lk;
  const xp = isMe ? prof && prof.xp : pr && pr.xp;
  const name = isMe ? (prof && prof.pseudo) || "Moi" : (pr && pr.ps) || "?";
  const s = stack();
  s.style.top = Math.round(stackTop()) + "px";
  const b = document.createElement("div");
  const E = emo(i);
  b.className = "qc-b" + (isMe ? " me" : "") + (E ? " qc-em" : "");
  if (E) { // emote : le perso entier (images clés animées dans le SVG) + nom + emote
    b.style.setProperty("--qcw", E[5]);
    b.innerHTML = `<span class="qc-av">${emoteSvg(look, xp, E[0])}</span><span class="qc-tx"><span class="qc-n">${esc(name)}</span><span class="qc-e">${E[0] === "67" ? `<span class="qc-67"><i>6️⃣</i><i>7️⃣</i></span>` : E[2]} ${esc(E[1])}</span><span class="qc-w">${esc(E[4])}</span></span>`;
  } else b.innerHTML = `<span class="qc-h">${headSvg(look, xp)}</span><span class="qc-n">${esc(name)}</span><span class="qc-t">${phraseHtml(i)}</span>`;
  s.appendChild(b);
  s.querySelectorAll(".qc-b.out").forEach(x => x.remove()); // une bulle qui s'efface laisse tout de suite la place
  const live = [...s.children];
  const max = innerHeight < 780 ? 2 : MAX_SHOWN; // petit écran : 2 bulles au plus (le haut du jeu reste visible)
  for (const x of live.slice(0, Math.max(0, live.length - max))) x.remove();
  setTimeout(() => { b.classList.add("out"); setTimeout(() => b.remove(), 320); }, E ? EM_SHOW_MS : SHOW_MS);
  if (G.kit) { G.kit.sfx("pop"); if (E) G.kit.emit("qc:em", {peer, id: E[0], me: !!isMe}); else G.kit.emit("qc", {peer, i, text: PHRASES[i], me: !!isMe}); }
}
function peerPresence(k) { const ps = L().peers ? L().peers() : []; const p = ps.find(q => q.peer === k); return p && p.presence; }

/* ---------- réception ---------- */
function valid(qc) { return Array.isArray(qc) && ((Number.isInteger(qc[0]) && qc[0] >= 0 && qc[0] < PHRASES.length) || !!emo(qc[0])) && qc[1] != null; }
function update() {
  const ps = L().peers ? L().peers() : [], me = L().myPeer ? L().myPeer() : null, ctx = ctxNow(), t = now();
  for (const p of ps) {
    if (!p || p.peer === me) continue;
    const qc = p.presence && valid(p.presence.qc) ? p.presence.qc : null;
    const k = qc ? qc[1] + ":" + qc[0] + ":" + qc[2] : "";
    if (!seen.has(p.peer)) { seen.set(p.peer, k); continue; }   // message déjà ancien quand on le découvre : pas rejoué
    if (seen.get(p.peer) === k) continue;
    seen.set(p.peer, k);
    if (!qc || off || !ctx || qc[2] !== ctx) continue;
    if (typeof qc[3] === "number" && Math.abs(clock() - qc[3]) > STALE_MS) continue;
    const h = (recv.get(p.peer) || []).filter(x => t - x < WIN_MS);
    if ((h.length && t - h[h.length - 1] < GAP_MS - 300) || h.length >= WIN_MAX + 1) { recv.set(p.peer, h); continue; }
    h.push(t); recv.set(p.peer, h);
    show(p.peer, qc[0], false);
  }
}

/* ---------- envoi ---------- */
function canSend() {
  const t = now(); sent = sent.filter(x => t - x < WIN_MS);
  if (sent.length && t - sent[sent.length - 1] < GAP_MS) return sent[sent.length - 1] + GAP_MS - t;
  if (sent.length >= WIN_MAX) return sent[0] + WIN_MS - t;
  return 0;
}
function send(i) {
  if (!(i >= 0 && i < PHRASES.length) && !emo(i)) return false;
  const ctx = ctxNow(); if (!ctx) return false;
  const wait = canSend();
  if (wait > 0) { hint(wait); return false; }
  sent.push(now());
  mine = [i, ++nonce, ctx, Math.round(clock())];
  if (L().pushPresence) L().pushPresence();
  show(L().myPeer ? L().myPeer() : "me", i, true);
  if (G.kit) G.kit.haptic("light");
  syncBtns();
  setTimeout(syncBtns, GAP_MS + 30);
  if (sent.length >= WIN_MAX) setTimeout(syncBtns, sent[0] + WIN_MS - now() + 30);
  return true;
}
// emote : dans le lobby, le perso la fait sur le sol (presence.po, anti-spam des poses) ; en partie, bulle animée (presence.qc)
function sendEmote(id) {
  if (!emo(id)) return false;
  const ctx = ctxNow(); if (!ctx) return false;
  if (ctx.slice(0, 2) === "l:" && L().emote) return !!L().emote(id);
  return send(id);
}
function hint(ms) {
  const s = stack(); s.style.top = Math.round(stackTop()) + "px";
  if (s.querySelector(".qc-wait")) return;
  const b = document.createElement("div"); b.className = "qc-b me qc-wait";
  b.innerHTML = `<span class="qc-t" style="padding-left:9px">⏳ Doucement… encore ${Math.ceil(ms / 1000)} s</span>`;
  s.appendChild(b); setTimeout(() => b.remove(), 1400);
}

/* ---------- boutons 💬 + sélecteur ---------- */
const btns = [];
function syncBtns() {
  const cool = canSend() > 0;
  for (const b of btns) {
    b.classList.toggle("cool", cool); b.classList.toggle("off", off);
    b.title = off ? "Chat coupé (on peut encore envoyer)" : "Chat rapide";
  }
}
function mkBtn(cls) {
  const b = document.createElement("button");
  b.type = "button"; b.className = cls + " qc-btn"; b.textContent = "💬";
  b.setAttribute("aria-label", "Chat rapide"); b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false");
  b.addEventListener("click", e => { e.stopPropagation(); if (document.getElementById("qc-pick")) closePick(); else openPick(b); });
  btns.push(b); syncBtns();
  return b;
}
function closePick() { const p = document.getElementById("qc-pick"); if (p) p.remove(); btns.forEach(b => b.setAttribute("aria-expanded", "false")); }
function openPick(anchor) {
  closePick();
  if (!ctxNow()) return;
  const p = document.createElement("div");
  p.id = "qc-pick"; p.setAttribute("role", "menu"); p.setAttribute("aria-label", "Chat rapide");
  const ems = EMOTES();
  p.innerHTML = (ems.length ? `<div class="qc-lb">Emotes</div><div class="qc-eg">${ems.map(e => `<button type="button" role="menuitem" data-qe="${e[0]}"${e[0] === "67" ? ` class="e67"` : ""} title="${esc(e[1])}" aria-label="Emote : ${esc(e[1])}">${e[0] === "67" ? "6️⃣7️⃣" : e[2]}</button>`).join("")}</div><div class="qc-sep"></div>` : "")
    + ORDER.map(i => `<button type="button" role="menuitem" data-qc="${i}"${i === I67 ? ` class="qc-p67" aria-label="Six seven"` : i === IAURA ? ` class="qc-pa"` : ""}>${i === I67 ? phraseHtml(i) : "💬 " + phraseHtml(i)}</button>`).join("")
    + `<button type="button" class="qc-x" data-qc="mute">${off ? "🔔 Réactiver le chat" : "🔕 Couper le chat"}</button>`;
  p.addEventListener("click", e => {
    const be = e.target.closest("[data-qe]");
    if (be) { e.stopPropagation(); closePick(); sendEmote(be.dataset.qe); return; }
    const b = e.target.closest("[data-qc]"); if (!b) return;
    e.stopPropagation();
    if (b.dataset.qc === "mute") { setOff(!off); closePick(); return; }
    closePick(); send(+b.dataset.qc);
  });
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  let left = Math.min(innerWidth - w - 8, Math.max(8, r.right - w)), top = r.bottom + 6;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
  p.style.left = left + "px"; p.style.top = top + "px";
  anchor.setAttribute("aria-expanded", "true");
}
document.addEventListener("pointerdown", e => { if (document.getElementById("qc-pick") && !e.target.closest("#qc-pick,.qc-btn")) closePick(); }, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePick(); });
function setOff(v) {
  off = !!v; store.set(KEY_OFF, off ? "1" : "0"); syncBtns();
  if (off) { const s = document.getElementById("qc-stack"); if (s) s.innerHTML = ""; }
  if (G.kit) G.kit.emit("qc:off", off);
}
function addButtons() {
  const top = document.querySelector(".game-top");
  if (top && !top.querySelector(".qc-btn")) top.insertBefore(mkBtn("game-fs"), top.querySelector("#game-fs") || top.querySelector("#game-more"));
  const tools = document.querySelector(".topbar .tools");
  if (tools && !tools.querySelector(".qc-btn")) { const shop = tools.querySelector("#btn-shop"); tools.insertBefore(mkBtn("chip gk-chip"), shop ? shop.nextSibling : tools.firstChild); }
  const lob = document.getElementById("scr-lobby");
  if (lob && !lob.querySelector(".qc-lob")) lob.appendChild(mkBtn("qc-lob"));
}
addButtons();

G.chat = {PHRASES, send, sendEmote, update, presence: () => mine, muted: () => off, setMuted: setOff, close: closePick, canSend,
  debug: () => ({mine, sent: sent.slice(), off, seen: [...seen], shown: [...document.querySelectorAll("#qc-stack .qc-b:not(.out)")].map(b => b.textContent)})};
})();
