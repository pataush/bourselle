/* Bourselle — mon avatar : un personnage à composer, des initiales à motif, ou une photo.
 * Gardé dans les réglages (donc sur tous les appareils) : settings.avatar = { char: {…} } | { ini: {…} } | { img: "data:image/jpeg…" }
 * (l'ancien { emo, bg } reste affiché). La photo est réduite à 160 px avant d'être enregistrée (quelques Ko). */
let avUid = 0;
const AV_HS = [["court", "Court"], ["long", "Long"], ["carre", "Carré"], ["boucle", "Bouclé"], ["afro", "Afro"], ["rasta", "Locks"], ["tresses", "Tresses"], ["chignon", "Chignon"], ["couettes", "Couettes"], ["meche", "Mèche"], ["iroquois", "Iroquois"], ["rase", "Rasé"], ["chauve", "Sans"]];
// Les cheveux suivent la forme du visage : w = demi-largeur, h = demi-hauteur du visage (centre 50, 48)
function avHair(o, w, h) {
  const L = 50 - w, R = 50 + w, T = 48 - h, c = o.hair, f = v => Math.round(v * 10) / 10;
  const P = (d, x) => `<path d="${d}" fill="${c}"${x || ""}/>`, C = (x, y, r, col) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${col || c}"/>`;
  const cap = (dip, x) => P(`M${f(L - 1.5)} 47 Q${f(L - 3)} ${f(T - 2)} 50 ${f(T - 2)} Q${f(R + 3)} ${f(T - 2)} ${f(R + 1.5)} 47 Q${f(R - 1)} ${f(T + dip)} 50 ${f(T + dip)} Q${f(L + 1)} ${f(T + dip)} ${f(L - 1.5)} 47z`, x);
  const arc = (r0, step, a0, a1, rr) => { let o2 = ""; for (let a = a0; a <= a1; a += step) { const t = a * Math.PI / 180; o2 += C(50 + (w + r0) * Math.cos(t), 46 + (h + r0) * Math.sin(t), rr); } return o2; };
  const BEADS = ["#e0a84a", "#c8553d", "#2e8a5b"];
  switch (o.hs) {
    case "long": return [P(`M${f(L - 3)} 46 Q${f(L - 5)} ${f(T - 4)} 50 ${f(T - 4)} Q${f(R + 5)} ${f(T - 4)} ${f(R + 3)} 46 L${f(R + 7)} 84 Q50 90 ${f(L - 7)} 84z`), P(`M${f(L - 1)} 46 Q${f(L - 1)} ${f(T - 1)} 50 ${f(T - 1)} Q${f(R + 1)} ${f(T - 1)} ${f(R + 1)} 46 Q${f(R - 5)} ${f(T + 8)} 52 ${f(T + 11)} Q${f(L + 6)} ${f(T + 13)} ${f(L - 1)} 46z`)];
    case "carre": return [P(`M${f(L - 4)} 46 Q${f(L - 5)} ${f(T - 4)} 50 ${f(T - 4)} Q${f(R + 5)} ${f(T - 4)} ${f(R + 4)} 46 L${f(R + 5)} 67 Q${f(R + 1)} 70 ${f(R - 3)} 67 L${f(L + 3)} 67 Q${f(L - 1)} 70 ${f(L - 5)} 67z`), P(`M${f(L - 0.5)} 46 Q${f(L - 1)} ${f(T - 1)} 50 ${f(T - 1)} Q${f(R + 1)} ${f(T - 1)} ${f(R + 0.5)} 46 L${f(R - 1)} ${f(T + 13)} Q50 ${f(T + 15)} ${f(L + 1)} ${f(T + 13)}z`)];
    case "boucle": return [arc(2, 20, 190, 350, 8.5), cap(8)];
    case "afro": return [`<ellipse cx="50" cy="${f(T + 9)}" rx="${f(w + 14)}" ry="${f(h + 3)}" fill="${c}"/>` + arc(12, 22.5, 180, 360, 7), cap(9)];
    case "rasta": { let s2 = ""; [L - 8, L - 3, R + 3, R + 8, L - 12, R + 12].forEach((x, i) => { const y1 = i > 3 ? 70 : 86; let d = `M${f(x)} ${f(T + 2)}`; for (let y = T + 2, k = 0; y < y1 - 6; y += 6, k++) d += ` q${k % 2 ? -2.2 : 2.2} 3 0 6`;
        s2 += `<path d="${d}" stroke="${c}" stroke-width="5.4" stroke-linecap="round" fill="none"/>` + C(x, y1 - 2, 2.7, BEADS[i % 3]); });
      return [s2, cap(9) + P(`M${f(L + 2)} ${f(T + 2)} Q50 ${f(T - 9)} ${f(R - 2)} ${f(T + 2)}`, ` stroke="${c}" stroke-width="5" fill="none"`)]; }
    case "tresses": { let s2 = ""; [L - 7, L - 2, R + 2, R + 7].forEach(x => { for (let y = T + 6; y < 86; y += 5) s2 += `<ellipse cx="${f(x + ((y / 5) % 2 ? .8 : -.8))}" cy="${f(y)}" rx="3" ry="3.2" fill="${c}"/>`; });
      return [s2, cap(9) + `<path d="M${f(50 - w / 2)} ${f(T + 1)} L${f(50 - w / 2)} ${f(T + 9)} M50 ${f(T)} L50 ${f(T + 9)} M${f(50 + w / 2)} ${f(T + 1)} L${f(50 + w / 2)} ${f(T + 9)}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>`]; }
    case "chignon": return [C(50, T - 7, 9), cap(10)];
    case "couettes": return [C(L - 8, T + 13, 9) + C(R + 8, T + 13, 9), cap(10) + C(L - 2, T + 10, 2.2, "#e84a8a") + C(R + 2, T + 10, 2.2, "#e84a8a")];
    case "meche": return ["", P(`M${f(L - 1.5)} 46 Q${f(L - 4)} ${f(T - 3)} 52 ${f(T - 3)} Q${f(R + 4)} ${f(T - 2)} ${f(R + 1.5)} 46 Q${f(R - 1)} ${f(T + 12)} ${f(R - 10)} ${f(T + 8)} Q50 ${f(T + 16)} ${f(L - 1.5)} ${f(T + 20)}z`)];
    case "iroquois": return ["", cap(8, ` opacity=".35"`) + P(`M${f(50 - 6)} ${f(T + 8)} Q${f(50 - 4)} ${f(T - 18)} 50 ${f(T - 18)} Q${f(50 + 4)} ${f(T - 18)} ${f(50 + 6)} ${f(T + 8)}z`)];
    case "rase": return ["", cap(8, ` opacity=".45"`)];
    case "chauve": return ["", `<ellipse cx="${f(50 - w / 3)}" cy="${f(T + 6)}" rx="4" ry="2" fill="#fff" opacity=".35"/>`];
    default: return ["", cap(10)];
  }
}
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
  const H = avHair(o, F[0], F[1]), back = H[0], top = H[1];
  return `<svg viewBox="0 0 100 100" class="avb"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${id})">
  <rect width="100" height="100" fill="${o.bg}"/>${back}
  <path d="M14 104 Q18 77 50 76 Q82 77 86 104z" fill="${o.shirt}"/><rect x="44" y="64" width="12" height="14" rx="5" fill="${dk(o.skin)}"/>
  <circle cx="${50 - F[0]}" cy="50" r="4.5" fill="${o.skin}"/><circle cx="${50 + F[0]}" cy="50" r="4.5" fill="${o.skin}"/>
  <ellipse cx="50" cy="48" rx="${F[0]}" ry="${F[1]}" fill="${o.skin}"/>
  ${o.beard ? `<path d="M${50 - F[0] + 1} 50 Q${50 - F[0] + 3} ${48 + F[1] + 5} 50 ${48 + F[1] + 4} Q${50 + F[0] - 3} ${48 + F[1] + 5} ${50 + F[0] - 1} 50 Q${50 + F[0] - 6} 64 50 63 Q${50 - F[0] + 6} 64 ${50 - F[0] + 1} 50z" fill="${o.hair}"/>` : ""}
  <g class="av-eyes" style="animation-delay:-${(avUid * 1.7) % 5}s"><circle cx="42" cy="49" r="2.6" fill="#2a1f1a"/><circle cx="58" cy="49" r="2.6" fill="#2a1f1a"/></g>
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
function avSet(v) { settings.avatar = v; saveSettings(); avPaint(document.getElementById("avatar")); avPush(); }
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

// ---------- Les avatars des proches ----------
// Mon avatar est envoyé au serveur (personnage, initiales ou petite photo) ; ceux des proches sont gardés ici 15 min.
const AV_HEXC = v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#cccccc";
function avSafe(a) {   // même contrôle que le serveur : rien d'autre que des couleurs et des choix connus
  if (!a || typeof a !== "object") return null;
  if (a.char) { const c = a.char; return { char: { bg: AV_HEXC(c.bg), skin: AV_HEXC(c.skin), hair: AV_HEXC(c.hair), shirt: AV_HEXC(c.shirt), hs: AV_HS.some(h => h[0] === c.hs) ? c.hs : "court", face: ["oval", "rond", "long"].includes(c.face) ? c.face : "oval", glasses: !!c.glasses, beard: !!c.beard } }; }
  if (a.ini) { const c = a.ini; return { ini: { t: String(c.t || "?").slice(0, 8), pat: AV_PAT[c.pat] ? c.pat : "points", bg: AV_HEXC(c.bg), fg: AV_HEXC(c.fg), ink: AV_HEXC(c.ink) } }; }
  if (typeof a.img === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a.img)) return { img: a.img };
  return null;
}
let AV_CACHE = (() => { try { return JSON.parse(localStorage.getItem("bourselle-avs") || "{}"); } catch (e) { return {}; } })();
const avSaveCache = () => { try { localStorage.setItem("bourselle-avs", JSON.stringify(AV_CACHE)); } catch (e) {} };
let avBusy = false;
async function avFetch(tags) {
  if (avBusy || !(typeof socOn === "function" && socOn())) return;
  const now = Date.now(), need = [...new Set(tags)].filter(t => t && t !== (typeof SOC !== "undefined" && SOC.tag) && (!AV_CACHE[t] || now - AV_CACHE[t].at > 15 * 60e3)).slice(0, 40);
  if (!need.length) return;
  avBusy = true;
  try { const j = await socApi("/avatars?t=" + encodeURIComponent(need.join(","))); for (const t of need) AV_CACHE[t] = { av: avSafe((j.avatars || {})[t]), at: now }; avSaveCache(); avHydrate(true); }
  catch (e) { for (const t of need) AV_CACHE[t] = { av: (AV_CACHE[t] || {}).av || null, at: now - 14 * 60e3 }; }   // réessai dans une minute
  finally { avBusy = false; }
}
async function avPush() {
  if (!(typeof socOn === "function" && socOn())) return;
  const a = settings.avatar && (settings.avatar.char || settings.avatar.ini || settings.avatar.img) ? settings.avatar : null, sig = JSON.stringify(a);
  try { if (localStorage.getItem("bourselle-av-sent") === sig) return; } catch (e) {}
  try { await socApi("/me/avatar", { method: "POST", body: JSON.stringify({ av: a }) }); localStorage.setItem("bourselle-av-sent", sig); } catch (e) {}
}
// Remplace les pastilles à initiale des proches par leur avatar (et lance les petites animations)
function avHydrate(force) {
  const els = document.querySelectorAll("[data-avtag]"), miss = [];
  els.forEach(el => {
    const t = el.dataset.avtag; if (!t) return;
    const c = AV_CACHE[t]; if (!c) { miss.push(t); return; }
    if (Date.now() - c.at > 15 * 60e3) miss.push(t);
    if (!c.av || (el.dataset.avdone === "1" && !force)) return;
    const svg = avSvg(c.av);
    [...el.childNodes].forEach(n => { if (n.nodeType === 3 || (n.tagName === "svg") || (n.classList && n.classList.contains("avb"))) n.remove(); });   // garde l'étoile et la pastille « non lu »
    if (svg) { el.insertAdjacentHTML("afterbegin", svg); el.classList.add("av-svg"); }
    else if (c.av.img) { el.style.backgroundImage = `url("${c.av.img}")`; el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; el.classList.add("av-img"); }
    el.classList.add("av-in");
    if (el.dataset.avwave === "1" && el.dataset.avdone !== "1") { el.classList.add("av-wave"); el.insertAdjacentHTML("beforeend", `<i class="av-hand" aria-hidden="true">👋</i>`); setTimeout(() => { el.classList.remove("av-wave"); const h = el.querySelector(".av-hand"); if (h) h.remove(); }, 2200); }
    el.dataset.avdone = "1";
  });
  // Dans une discussion : un petit avatar à côté du premier message de chaque série
  document.querySelectorAll(".dm-box").forEach(box => {
    let prev = "";
    box.querySelectorAll(".dm-m").forEach(m => {
      const t = m.dataset.from || "", mine = m.classList.contains("me");
      if (!mine && t && !t.startsWith("g:") && t !== "sys") {
        const c = AV_CACHE[t]; if (!c) miss.push(t);
        if (c && c.av && t !== prev && !m.querySelector(".dm-pav")) {
          const svg = avSvg(c.av); m.classList.add("has-pav");
          m.insertAdjacentHTML("afterbegin", svg ? `<span class="dm-pav av-svg">${svg}</span>` : `<span class="dm-pav av-img" style="background-image:url('${c.av.img}')"></span>`);
        } else if (c && c.av && t === prev) m.classList.add("has-pav");
      }
      prev = mine ? "" : t;
    });
  });
  if (miss.length) avFetch(miss);
}
// Surveille l'écran : dès qu'une pastille de proche apparaît, on y met son avatar
{
  let q = 0;
  const run = () => { q = 0; try { avHydrate(); } catch (e) {} };
  new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); }).observe(document.body, { childList: true, subtree: true });
  setTimeout(() => { try { avPush(); } catch (e) {} }, 4000);
}
