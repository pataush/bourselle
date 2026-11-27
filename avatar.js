/* Bourselle — photo de profil ou avatar (emoji), choisi en touchant la photo dans le menu du profil.
 * Gardé dans les réglages (donc sur tous les appareils) : settings.avatar = { img: "data:image/jpeg…" } ou { emo: "🦊", bg: "#…" }.
 * La photo est réduite à 160 px avant d'être enregistrée (quelques Ko). */
const AV_EMO = ["😀", "😎", "🤓", "🥳", "😺", "🦊", "🐼", "🐨", "🦁", "🐸", "🐧", "🦄", "🌻", "🌈", "⚽", "🎧", "🎨", "✈️", "☕", "🍀"];
const AV_BG = ["#f2d27a", "#cfe8d9", "#f6c9b9", "#c9d8f6", "#e5d0f2", "#1f6b4b"];
function avPaint(el) {
  if (!el) return; const a = settings && settings.avatar;
  el.classList.toggle("av-img", !!(a && a.img)); el.classList.toggle("av-emo", !!(a && a.emo));
  if (a && a.img) { el.style.backgroundImage = `url("${a.img}")`; el.style.backgroundColor = ""; el.textContent = ""; }
  else if (a && a.emo) { el.style.backgroundImage = "none"; el.style.backgroundColor = a.bg || ""; el.textContent = a.emo; }
  else { el.style.backgroundImage = ""; el.style.backgroundColor = ""; }
}
function avSet(v) { settings.avatar = v; saveSettings(); avPaint(document.getElementById("avatar")); document.querySelectorAll(".pmx-av").forEach(avPaint); }
function avResize(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const S = 160, c = document.createElement("canvas"); c.width = c.height = S; const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (S - w) / 2, (S - h) / 2, w, h); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", .82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image")); }; img.src = url;
  });
}
function avPick() {
  const a = settings.avatar || {}; let bg = a.bg || AV_BG[0];
  const f = openForm(`<div class="f2 av-sheet"><h3>Ma photo</h3>
    <div class="av-prev"><span class="pmx-av" id="avPrev"></span></div>
    <div class="av-btns"><button type="button" class="btn primary" id="avPhoto">📷 Choisir une photo</button>${a.img || a.emo ? `<button type="button" class="btn" id="avNone">Retirer</button>` : ""}</div>
    <input type="file" id="avFile" accept="image/*" hidden>
    <div class="pmx-cap">Ou un avatar</div>
    <div class="av-bgs">${AV_BG.map(c => `<button type="button" data-avbg="${c}" style="background:${c}" aria-label="Couleur" aria-pressed="${c === bg}"></button>`).join("")}</div>
    <div class="av-grid">${AV_EMO.map(e => `<button type="button" data-avemo="${e}">${e}</button>`).join("")}</div></div>`, () => true);
  f.querySelector("button[type=submit]").hidden = true; f.querySelector("#f2Cancel").textContent = "Terminé";
  const prev = f.querySelector("#avPrev"), init = (document.getElementById("avatar").dataset.init || "B");
  const paint = () => { prev.textContent = init; avPaint(prev); };
  paint();
  f.querySelector("#avPhoto").onclick = () => f.querySelector("#avFile").click();
  f.querySelector("#avFile").onchange = async e => { const file = e.target.files && e.target.files[0]; if (!file) return;
    try { avSet({ img: await avResize(file) }); paint(); toast("Photo enregistrée"); } catch (er) { toast("Cette image n'a pas pu être lue."); } };
  const none = f.querySelector("#avNone"); if (none) none.onclick = () => { avSet(null); closeForm(); render(); toast("Photo retirée"); };
  f.querySelectorAll("[data-avbg]").forEach(b => b.onclick = () => { bg = b.dataset.avbg; f.querySelectorAll("[data-avbg]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    if (settings.avatar && settings.avatar.emo) { avSet({ emo: settings.avatar.emo, bg }); paint(); } });
  f.querySelectorAll("[data-avemo]").forEach(b => b.onclick = () => { avSet({ emo: b.dataset.avemo, bg }); paint(); });
}
