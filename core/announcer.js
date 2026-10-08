/* Gonflette Party : le présentateur (fonction de test, isolée ici).
   Synthèse vocale du navigateur (speechSynthesis), voix française si possible, ton de gala de catch :
   présentation des combattants sur l'écran « C'est parti », « 3, 2, 1, GO ! », annonce du vainqueur, « ça gonfle ! ».
   - Bouton « 🎙️ » dans la barre du haut : activé par défaut seulement si une voix française existe ; choix mémorisé
     sur l'appareil (localStorage « gonflette-mc »).
   - iOS : la parole doit d'abord être déclenchée par un geste → on « amorce » avec un énoncé muet au premier toucher.
   - Jamais deux annonces en même temps : une nouvelle scène coupe la précédente ; les chiffres du décompte sont
     sautés si la présentation n'est pas finie (le « GO ! » passe toujours).
   - Pour le désactiver complètement : retirer <script src="core/announcer.js"> de index.html (rien d'autre n'en dépend). */
(() => {
"use strict";
const G = window.GONFLETTE = window.GONFLETTE || {};
const K = G.kit;
const S = window.speechSynthesis, U = window.SpeechSynthesisUtterance;
if (!K || !S || !U) return;

const KEY = "gonflette-mc";
let voice = null, pref = K.store.get(KEY), primed = false, speaking = false, endAt = 0, gen = 0, btn = null;
const log = [];
const on = () => pref === "1" || (pref == null && !!voice);
function pickVoice() {
  let vs = []; try { vs = S.getVoices() || []; } catch (e) {}
  const fr = vs.filter(v => /^fr(-|_|$)/i.test(v.lang || ""));
  voice = fr.find(v => /fr[-_]FR/i.test(v.lang) && /google|thomas|amélie|amelie|audrey|daniel/i.test(v.name)) || fr.find(v => /fr[-_]FR/i.test(v.lang)) || fr[0] || null;
  syncBtn();
}
pickVoice();
try { S.addEventListener ? S.addEventListener("voiceschanged", pickVoice) : (S.onvoiceschanged = pickVoice); } catch (e) {}

// Étire la dernière voyelle d'un pseudo : « Mehdi » → « Mehdiiii » (effet speaker de gala).
function stretch(name) {
  const n = String(name || "").trim().slice(0, 14);
  const m = n.match(/^(.*?)([aeiouyéèêàâîôûAEIOUYÉÈÊÀÂÎÔÛ])([^aeiouyéèêàâîôûAEIOUYÉÈÊÀÂÎÔÛ]*)$/);
  if (!m) return n;
  const v = m[2].toLowerCase();
  return m[1] + m[2] + v + v + v + m[3];
}
/* say([{t, rate, pitch}...], {cut, low}) : une « scène » = une suite de phrases enchaînées.
   cut : coupe ce qui est en cours. low : seulement si rien n'est en cours (sinon ignoré). */
function say(parts, o = {}) {
  if (!on()) return false;
  if (o.low && (speaking || S.speaking) && Date.now() < endAt) return false;
  const my = ++gen;
  try { if (o.cut || S.speaking || S.pending) S.cancel(); } catch (e) {}
  speaking = true;
  let est = 0;
  parts.forEach((p, i) => {
    const u = new U(p.t);
    u.lang = "fr-FR"; if (voice) u.voice = voice;
    u.rate = p.rate || 1; u.pitch = p.pitch || 1; u.volume = 1;
    est += (p.t.length * 75) / (p.rate || 1) + 250;
    if (i === parts.length - 1) { u.onend = u.onerror = () => { if (gen === my) speaking = false; }; }
    try { S.speak(u); } catch (e) {}
  });
  endAt = Date.now() + est;
  log.push(parts.map(p => p.t).join(" | ")); if (log.length > 40) log.shift();
  return true;
}
// iOS / Safari : premier énoncé (muet) déclenché par un geste
function prime() {
  if (primed) return; primed = true;
  try { const u = new U(" "); u.volume = 0; u.lang = "fr-FR"; S.speak(u); } catch (e) {}
}
K.on("unlock", prime);

/* ---------- scènes ---------- */
const announced = new Set();
K.on("chosen", d => {
  if (!d || !d.M || announced.has(d.M.mid)) return;
  announced.add(d.M.mid);
  const M = d.M, g = d.game || {name: "la partie"}, nm = k => (M.ro[k] && M.ro[k].p) || "?";
  let parts;
  if (M.tm && M.tn) {
    parts = [{t: g.name + " !", rate: .9, pitch: .7}, {t: `${M.tn[0]}… contre… ${M.tn[1]} !`, rate: .85, pitch: 1.15}];
  } else if (M.pl.length === 2 && d.place === "ring") {
    parts = [{t: "Dans le coin rouge…", rate: .9, pitch: .6}, {t: stretch(nm(M.pl[0])) + " !", rate: .7, pitch: 1.35},
      {t: "Dans le coin bleu…", rate: .9, pitch: .6}, {t: stretch(nm(M.pl[1])) + " !", rate: .7, pitch: 1.35}];
  } else if (M.pl.length === 2) {
    parts = [{t: g.name + " !", rate: .9, pitch: .7}, {t: `${stretch(nm(M.pl[0]))}… contre… ${stretch(nm(M.pl[1]))} !`, rate: .8, pitch: 1.2}];
  } else {
    const ns = M.pl.map(nm), list = ns.slice(0, -1).join(", ") + " et " + ns[ns.length - 1];
    parts = [{t: d.place === "ring" ? "Mesdames et messieurs…" : "C'est parti pour…", rate: .9, pitch: .65}, {t: g.name + " !", rate: .8, pitch: 1.2}, {t: "Avec " + list + " !", rate: 1, pitch: 1.05}];
  }
  say(parts, {cut: true});
});
K.on("count", k => {
  if (k === "go") say([{t: "GO !", rate: 1.1, pitch: 1.4}], {cut: true});
  else if (/^[123]$/.test(k)) say([{t: k, rate: 1.1, pitch: 1.1}], {low: true});
});
K.on("results", d => {
  if (!d || !d.mine || d.int) return;
  const parts = [];
  if (d.team) parts.push({t: "Victoire de…", rate: .85, pitch: .6}, {t: d.team + " !", rate: .75, pitch: 1.3});
  else if (d.winners && d.winners.length === 1) parts.push({t: "Et le vainqueur est…", rate: .8, pitch: .6}, {t: stretch(d.winners[0]) + " !", rate: .7, pitch: 1.4});
  else if (d.winners && d.winners.length > 1) parts.push({t: "Victoire partagée !", rate: .85, pitch: 1.1});
  else parts.push({t: "Match nul ! Personne ne gonfle… enfin presque.", rate: .9, pitch: .9});
  if (d.up > 0) parts.push({t: d.tierUp ? `Ça gonfle ! Nouveau palier : ${d.tierUp} !` : `Ça gonfle ! Niveau ${d.level} !`, rate: .9, pitch: 1.25});
  setTimeout(() => say(parts, {cut: true}), d.fromGame === false ? 200 : 1000);
});
K.on("game:start", () => { try { if (S.speaking) S.cancel(); } catch (e) {} speaking = false; });

/* ---------- bouton 🎙️ ---------- */
function syncBtn() {
  if (!btn) return;
  const v = on();
  btn.textContent = v ? "🎙️" : "🎙️✕";
  btn.setAttribute("aria-pressed", String(v));
  btn.title = (v ? "Présentateur activé" : "Présentateur coupé") + (voice ? "" : " (pas de voix française sur cet appareil)");
  btn.setAttribute("aria-label", "Présentateur : " + (v ? "activé" : "coupé"));
}
function addButton() {
  const tools = document.querySelector(".topbar .tools"); if (!tools || tools.querySelector("[data-gk-mc]")) return;
  btn = document.createElement("button");
  btn.type = "button"; btn.className = "chip gk-chip"; btn.setAttribute("data-gk-mc", "");
  btn.addEventListener("click", () => {
    pref = on() ? "0" : "1"; K.store.set(KEY, pref); syncBtn();
    if (on()) { prime(); say([{t: "Le présentateur est dans la place !", rate: 1, pitch: 1.2}], {cut: true}); } else { try { S.cancel(); } catch (e) {} }
  });
  const ref = tools.querySelector("[data-gk-mute]") || document.getElementById("wallet");
  tools.insertBefore(btn, ref ? ref.nextSibling : null);
  syncBtn();
}
addButton();

G.announcer = {say, stretch, on, voice: () => (voice ? voice.name + " (" + voice.lang + ")" : null), log: () => log.slice()};
})();
