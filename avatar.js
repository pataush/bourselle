/* Bourselle — mon avatar : un personnage à composer, des initiales à motif, ou une photo.
 * Gardé dans les réglages (donc sur tous les appareils) : settings.avatar = { char: {…} } | { ini: {…} } | { img: "data:image/jpeg…" }
 * (l'ancien { emo, bg } reste affiché). La photo est réduite à 160 px avant d'être enregistrée (quelques Ko). */
let avUid = 0;
const AV_HS = [["court", "Court"], ["long", "Long"], ["boucle", "Bouclé"], ["chignon", "Chignon"], ["meche", "Mèche"], ["rase", "Rasé"]];
const AV_SKIN = ["#f6d7bf", "#f1c7a5", "#dba47a", "#c98e62", "#9c6644", "#6b4429"];
const AV_HAIR = ["#2a1d16", "#5b3a24", "#a5673f", "#d9a441", "#c8553d", "#9aa0a6"];
const AV_BGS = ["#cfe8d9", "#fbe0d2", "#e6ddf6", "#d9e8fb", "#f6e7b8", "#1f6b4b"];
const AV_SHIRT = ["#1f6b4b", "#c8553d", "#3b3f73", "#e0a84a", "#7a3b6b", "#1d5f86"];
const AV_DUO = [["#1f6b4b", "#2e8a5b", "#fff"], ["#c8553d", "#d96a52", "#fff"], ["#3b3f73", "#4c518f", "#f2d27a"], ["#f6e7b8", "#efd9a0", "#8a6d1f"], ["#7a3b6b", "#924a81", "#f2d27a"], ["#d9e8fb", "#bcd3f3", "#1d5f86"], ["#fbe0d2", "#f6c9b9", "#c8553d"]];
const AV_CHAR0 = { bg: "#cfe8d9", skin: "#f1c7a5", hair: "#2a1d16", hs: "court", face: "oval", glasses: false, beard: false, shirt: "#1f6b4b" };
function avChar(o) {
  o = Object.assign({ bg: "#cfe8d9", skin: "#f1c7a5", hair: "#3b2a20", hs: "court", face: "oval", glasses: false, beard: false, shirt: "#1f6b4b" }, o || {});
  const id = "avc" + (++avUid);
  const F = { oval: [20, 23], rond: [22, 22], long: [18, 25] }[o.face];
  const dk = h => { const n = parseInt(h.slice(1), 16); const f = v => Math.round(v * .8).toString(16).padStart(2, "0"); return "#" + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };
  let back = "", top = "";
  if (o.hs === "long") { back = `<path d="M27 45 Q26 19 50 19 Q74 19 73 45 L76 82 Q62 86 50 86 Q38 86 24 82z" fill="${o.hair}"/>`; top = `<path d="M29 45 Q29 23 50 23 Q71 23 71 45 Q63 31 47 33 Q35 35 29 45z" fill="${o.hair}"/>`; }
  if (o.hs === "court") top = `<path d="M28 47 Q26 21 50 21 Q74 21 72 47 Q69 31 50 31 Q31 31 28 47z" fill="${o.hair}"/>`;
  if (o.hs === "boucle") { back = [[30,30,10],[42,22,11],[58,22,11],[70,30,10],[26,42,8],[74,42,8],[50,18,10]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${o.hair}"/>`).join(""); top = `<path d="M30 40 Q38 28 50 30 Q62 28 70 40 Q66 26 50 26 Q34 26 30 40z" fill="${o.hair}"/>`; }
  if (o.hs === "chignon") { back = `<circle cx="50" cy="17" r="9" fill="${o.hair}"/>`; top = `<path d="M28 47 Q27 22 50 22 Q73 22 72 47 Q68 30 50 30 Q32 30 28 47z" fill="${o.hair}"/>`; }
  if (o.hs === "meche") top = `<path d="M28 46 Q25 20 52 20 Q76 21 72 46 Q70 34 60 30 Q48 38 30 40z" fill="${o.hair}"/>`;
  if (o.hs === "rase") top = `<path d="M29 44 Q29 24 50 24 Q71 24 71 44 Q66 30 50 30 Q34 30 29 44z" fill="${o.hair}" opacity=".45"/>`;
  return `<svg viewBox="0 0 100 100" class="avb"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${id})">
  <rect width="100" height="100" fill="${o.bg}"/>${back}
  <path d="M14 104 Q18 77 50 76 Q82 77 86 104z" fill="${o.shirt}"/><rect x="44" y="64" width="12" height="14" rx="5" fill="${dk(o.skin)}"/>
  <circle cx="${50 - F[0]}" cy="50" r="4.5" fill="${o.skin}"/><circle cx="${50 + F[0]}" cy="50" r="4.5" fill="${o.skin}"/>
  <ellipse cx="50" cy="48" rx="${F[0]}" ry="${F[1]}" fill="${o.skin}"/>
  ${o.beard ? `<path d="M${50 - F[0] + 1} 50 Q${50 - F[0] + 3} ${48 + F[1] + 5} 50 ${48 + F[1] + 4} Q${50 + F[0] - 3} ${48 + F[1] + 5} ${50 + F[0] - 1} 50 Q${50 + F[0] - 6} 64 50 63 Q${50 - F[0] + 6} 64 ${50 - F[0] + 1} 50z" fill="${o.hair}"/>` : ""}
  <circle cx="42" cy="49" r="2.6" fill="#2a1f1a"/><circle cx="58" cy="49" r="2.6" fill="#2a1f1a"/>
  <path d="M38 42.5 Q42 40.5 46 42.5M54 42.5 Q58 40.5 62 42.5" stroke="${o.hair}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="37" cy="56" rx="3.5" ry="2" fill="#e88a8a" opacity=".35"/><ellipse cx="63" cy="56" rx="3.5" ry="2" fill="#e88a8a" opacity=".35"/>
  <path d="M${o.beard ? "45 59 Q50 62 55 59" : "44 58 Q50 64 56 58"}" stroke="#8a3b32" stroke-width="2.2" fill="${o.beard ? "none" : "#fff"}" stroke-linecap="round"/>
  ${o.glasses ? `<g fill="rgba(255,255,255,.25)" stroke="#2a1f1a" stroke-width="1.8"><circle cx="42" cy="49" r="6.5"/><circle cx="58" cy="49" r="6.5"/><path d="M48.5 49h3" fill="none"/></g>` : ""}
  ${top}</g></svg>`;
}
const AV_PAT = {
  points: c => `<pattern id="P" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.4" fill="${c}"/></pattern>`,
  rayures: c => `<pattern id="P" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="12" fill="${c}"/></pattern>`,
  vagues: c => `<pattern id="P" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q6 0 12 6 T24 6" stroke="${c}" stroke-width="2.4" fill="none"/></pattern>`,
  confettis: c => `<pattern id="P" width="30" height="30" patternUnits="userSpaceOnUse"><rect x="4" y="5" width="6" height="2.5" rx="1" fill="${c}" transform="rotate(30 7 6)"/><circle cx="22" cy="9" r="2" fill="${c}"/><rect x="15" y="21" width="6" height="2.5" rx="1" fill="${c}" transform="rotate(-25 18 22)"/><circle cx="6" cy="23" r="1.6" fill="${c}"/></pattern>`,
  damier: c => `<pattern id="P" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${c}"/><rect x="8" y="8" width="8" height="8" fill="${c}"/></pattern>`,
  soleil: c => `<pattern id="P" width="100" height="100" patternUnits="userSpaceOnUse">${Array.from({length: 12}, (_, i) => `<path d="M50 50 L${50 + 80 * Math.cos(i * Math.PI / 6)} ${50 + 80 * Math.sin(i * Math.PI / 6)} L${50 + 80 * Math.cos(i * Math.PI / 6 + .26)} ${50 + 80 * Math.sin(i * Math.PI / 6 + .26)}z" fill="${c}"/>`).join("")}</pattern>`,
};
function avIni(t, pat, bg, fg, ink) { const id = "avi" + (++avUid); t = String(t || "B"); const fs = t.length > 3 ? Math.max(20, 80 / t.length * 1.25) : t.length > 1 ? 38 : 48;
  return `<svg viewBox="0 0 100 100" class="avb"><defs>${(AV_PAT[pat] || AV_PAT.points)(fg).replace('id="P"', `id="${id}"`)}<clipPath id="k${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#k${id})"><rect width="100" height="100" fill="${bg}"/><rect width="100" height="100" fill="url(#${id})"/></g>
  <text x="50" y="${50 + fs * .35}" text-anchor="middle" font-family="Bricolage Grotesque, DM Sans, sans-serif" font-weight="800" font-size="${fs}" fill="${ink}" style="paint-order:stroke" stroke="${bg}" stroke-width="5" stroke-linejoin="round">${esc(t)}</text></svg>`; }

function avSvg(a) { return a && a.char ? avChar(a.char) : a && a.ini ? avIni(a.ini.t, a.ini.pat, a.ini.bg, a.ini.fg, a.ini.ink) : ""; }
function avPaint(el) {
  if (!el) return; const a = settings && settings.avatar, svg = avSvg(a);
  el.classList.toggle("av-img", !!(a && a.img)); el.classList.toggle("av-emo", !!(a && a.emo)); el.classList.toggle("av-svg", !!svg);
  if (svg) { el.style.backgroundImage = "none"; el.style.backgroundColor = "transparent"; el.innerHTML = svg; }
  else if (a && a.img) { el.style.backgroundImage = `url("${a.img}")`; el.style.backgroundColor = ""; el.textContent = ""; }
  else if (a && a.emo) { el.style.backgroundImage = "none"; el.style.backgroundColor = a.bg || ""; el.textContent = a.emo; }
  else { el.style.backgroundImage = ""; el.style.backgroundColor = ""; }
}
function avSet(v) { settings.avatar = v; saveSettings(); avPaint(document.getElementById("avatar")); }
function avResize(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const S = 160, c = document.createElement("canvas"); c.width = c.height = S; const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (S - w) / 2, (S - h) / 2, w, h); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", .82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image")); }; img.src = url;
  });
}
function avNameParts() { const u = store && store.user ? store.user() : {}; const n = String((u && u.name) || document.getElementById("helloName").textContent || "B").trim(); const w = n.split(/[\s@._-]+/).filter(Boolean);
  const first = (w[0] || "B"), cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  return [first.charAt(0).toUpperCase(), (first.charAt(0) + (w[1] ? w[1].charAt(0) : first.charAt(1) || "")).toUpperCase(), cap(first).slice(0, 8)]; }
// La fenêtre « Mon avatar » : Personnage · Initiales · Photo
function avPick(tab0) {
  const a = settings.avatar || {}, N = avNameParts();
  let tab = tab0 || (a.ini ? "ini" : a.img ? "photo" : "char");
  let ch = Object.assign({}, AV_CHAR0, a.char || {});
  let ini = Object.assign({ t: N[1], pat: "confettis", bg: AV_DUO[0][0], fg: AV_DUO[0][1], ink: AV_DUO[0][2] }, a.ini || {});
  const sw = (attr, v, cur, bgv) => `<button type="button" class="ab-sw" ${attr}="${v}" aria-pressed="${v === cur}" style="background:${bgv || v}" aria-label="Couleur"></button>`;
  const f = openForm(`<div class="f2 ab"><h3>Mon avatar</h3><div class="ab-tabs" role="tablist"><button type="button" data-abt="char">Personnage</button><button type="button" data-abt="ini">Initiales</button><button type="button" data-abt="photo">Photo</button></div>
    <div class="ab-prev" id="abPrev"></div><div id="abBody"></div></div>`, () => {
    if (tab === "char") avSet({ char: ch }); else if (tab === "ini") avSet({ ini }); else return true;
    render(); toast("Avatar enregistré"); return true;
  });
  const sb = f.querySelector("button[type=submit]"); sb.textContent = "Enregistrer";
  const body = f.querySelector("#abBody"), prev = f.querySelector("#abPrev");
  const draw = () => {
    f.querySelectorAll("[data-abt]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.abt === tab)));
    sb.hidden = tab === "photo";
    if (tab === "char") {
      prev.innerHTML = avChar(ch);
      body.innerHTML = `<div class="ab-cap">Coiffure</div><div class="ab-row">${AV_HS.map(([k, l]) => `<button type="button" class="ab-hs" data-hs="${k}" aria-pressed="${k === ch.hs}" aria-label="${l}">${avChar({ ...ch, hs: k, glasses: false, beard: false, bg: "transparent" })}</button>`).join("")}</div>
        <div class="ab-cap">Couleur de peau</div><div class="ab-row">${AV_SKIN.map(c => sw("data-skin", c, ch.skin)).join("")}</div>
        <div class="ab-cap">Cheveux</div><div class="ab-row">${AV_HAIR.map(c => sw("data-hair", c, ch.hair)).join("")}</div>
        <div class="ab-cap">Visage</div><div class="ab-row">${[["oval", "Ovale"], ["rond", "Rond"], ["long", "Allongé"]].map(([k, l]) => `<button type="button" class="ab-chip" data-face="${k}" aria-pressed="${k === ch.face}">${l}</button>`).join("")}</div>
        <div class="ab-cap">Accessoires</div><div class="ab-row"><button type="button" class="ab-chip" data-tg="glasses" aria-pressed="${!!ch.glasses}">Lunettes</button><button type="button" class="ab-chip" data-tg="beard" aria-pressed="${!!ch.beard}">Barbe</button></div>
        <div class="ab-cap">Haut</div><div class="ab-row">${AV_SHIRT.map(c => sw("data-shirt", c, ch.shirt)).join("")}</div>
        <div class="ab-cap">Fond</div><div class="ab-row">${AV_BGS.map(c => sw("data-bgc", c, ch.bg)).join("")}</div>
        <button type="button" class="linkbtn" id="abRnd" style="display:block;margin:14px auto 0">🎲 Au hasard</button>`;
    } else if (tab === "ini") {
      prev.innerHTML = avIni(ini.t, ini.pat, ini.bg, ini.fg, ini.ink);
      body.innerHTML = `<div class="ab-cap">Lettres</div><div class="ab-row">${[...new Set(N)].map(t => `<button type="button" class="ab-chip" data-it="${esc(t)}" aria-pressed="${t === ini.t}">${esc(t)}</button>`).join("")}</div>
        <div class="ab-cap">Motif</div><div class="ab-row">${Object.keys(AV_PAT).map(p => `<button type="button" class="ab-hs" data-pat="${p}" aria-pressed="${p === ini.pat}" aria-label="${p}">${avIni(ini.t.slice(0, 2), p, ini.bg, ini.fg, ini.ink)}</button>`).join("")}</div>
        <div class="ab-cap">Couleurs</div><div class="ab-row">${AV_DUO.map((d, i) => `<button type="button" class="ab-sw" data-duo="${i}" aria-pressed="${d[0] === ini.bg && d[2] === ini.ink}" style="background:linear-gradient(135deg,${d[0]} 0 55%,${d[2]} 55%)" aria-label="Couleurs"></button>`).join("")}</div>`;
    } else {
      prev.innerHTML = a.img ? `<span class="ab-img" style="background-image:url('${a.img}')"></span>` : avIni(N[0], "points", "#eef1ee", "#dfe5e1", "#9aa5a0");
      body.innerHTML = `<p class="hint" style="text-align:center">Une photo de toi, réduite pour rester légère.</p><div class="av-btns"><button type="button" class="btn primary" id="avPhoto">📷 Choisir une photo</button>${settings.avatar ? `<button type="button" class="btn" id="avNone">Retirer mon avatar</button>` : ""}</div><input type="file" id="avFile" accept="image/*" hidden>`;
      body.querySelector("#avPhoto").onclick = () => body.querySelector("#avFile").click();
      body.querySelector("#avFile").onchange = async e => { const file = e.target.files && e.target.files[0]; if (!file) return;
        try { avSet({ img: await avResize(file) }); a.img = settings.avatar.img; draw(); render(); toast("Photo enregistrée"); } catch (er) { toast("Cette image n'a pas pu être lue."); } };
      const no = body.querySelector("#avNone"); if (no) no.onclick = () => { avSet(null); closeForm(); render(); toast("Avatar retiré"); };
    }
    body.querySelectorAll("[data-hs]").forEach(b => b.onclick = () => { ch.hs = b.dataset.hs; draw(); });
    body.querySelectorAll("[data-skin]").forEach(b => b.onclick = () => { ch.skin = b.dataset.skin; draw(); });
    body.querySelectorAll("[data-hair]").forEach(b => b.onclick = () => { ch.hair = b.dataset.hair; draw(); });
    body.querySelectorAll("[data-face]").forEach(b => b.onclick = () => { ch.face = b.dataset.face; draw(); });
    body.querySelectorAll("[data-tg]").forEach(b => b.onclick = () => { ch[b.dataset.tg] = !ch[b.dataset.tg]; draw(); });
    body.querySelectorAll("[data-shirt]").forEach(b => b.onclick = () => { ch.shirt = b.dataset.shirt; draw(); });
    body.querySelectorAll("[data-bgc]").forEach(b => b.onclick = () => { ch.bg = b.dataset.bgc; draw(); });
    const rnd = body.querySelector("#abRnd"); if (rnd) rnd.onclick = () => { const r = L => L[Math.floor(Math.random() * L.length)];
      ch = { hs: r(AV_HS)[0], skin: r(AV_SKIN), hair: r(AV_HAIR), face: r(["oval", "rond", "long"]), glasses: Math.random() < .35, beard: Math.random() < .25, shirt: r(AV_SHIRT), bg: r(AV_BGS) }; draw(); };
    body.querySelectorAll("[data-it]").forEach(b => b.onclick = () => { ini.t = b.dataset.it; draw(); });
    body.querySelectorAll("[data-pat]").forEach(b => b.onclick = () => { ini.pat = b.dataset.pat; draw(); });
    body.querySelectorAll("[data-duo]").forEach(b => b.onclick = () => { const d = AV_DUO[+b.dataset.duo]; ini.bg = d[0]; ini.fg = d[1]; ini.ink = d[2]; draw(); });
  };
  f.querySelectorAll("[data-abt]").forEach(b => b.onclick = () => { tab = b.dataset.abt; draw(); });
  draw();
}
