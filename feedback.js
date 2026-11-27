// Écrire à l'équipe Bourselle : une idée, un souci. Le message arrive au propriétaire (notification + liste dans ses Paramètres).
const FB_KINDS = [["idee", "💡 Une suggestion"], ["souci", "🐞 Un problème"], ["autre", "💬 Autre"]];
let FB_OWNER = null;   // null : pas encore vérifié
function fbCardHTML() {
  return `<div class="card fb-card"><h2>Une suggestion, un problème ?</h2>
    <p class="hint" style="margin:0 0 10px">Dis-nous ce qui te manque ou ce qui ne marche pas : on lit tout et Bourselle s'améliore grâce à toi.</p>
    <button type="button" class="btn primary block" id="fbOpen">✉️ Écrire à l'équipe Bourselle</button>
    <div id="fbAdmin"></div></div>`;
}
function fbBind() {
  const b = document.getElementById("fbOpen"); if (b) b.onclick = () => fbOpen();
  fbAdminLoad();
}
function fbOpen(kind) {
  if (!(typeof socOn === "function" && socOn())) { toast("Connecte-toi avec Google ou Microsoft pour nous écrire"); return; }
  const f = openForm(`<div class="f2"><h3>✉️ Écrire à l'équipe Bourselle</h3>
    <div class="chips" id="fbK">${FB_KINDS.map(([k, l]) => `<button type="button" class="chip" data-k="${k}" aria-pressed="${k === (kind || "idee")}">${l}</button>`).join("")}</div>
    <textarea class="field" id="fbT" rows="6" maxlength="2000" placeholder="Ex. « J'aimerais pouvoir… » ou « Quand je touche…, il se passe… »" style="margin-top:10px"></textarea>
    <p class="hint" style="margin:6px 0 0">On joint la version de l'appli et le type de téléphone pour nous aider à comprendre. On te répondra par e-mail si besoin.</p></div>`, () => {
    const text = f.querySelector("#fbT").value.trim(); if (text.length < 3) { toast("Écris quelques mots"); return false; }
    const k = (f.querySelector("#fbK [aria-pressed=true]") || {}).dataset?.k || "autre";
    const tech = `v${typeof APP_VERSION !== "undefined" ? APP_VERSION : "?"} · ${isSimple && isSimple() ? "simple" : "complète"} · ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 200)}`;
    const sb = f.querySelector("button[type=submit]"); sb.disabled = true;
    socApi("/me/feedback", { method: "POST", body: JSON.stringify({ kind: k, text, tech }) }).then(() => { closeForm(); toast("Merci ! Ton message est bien arrivé 🙏"); }).catch(e => { sb.disabled = false; toast(e.message || "Envoi impossible, réessaie"); });
    return false;
  });
  f.querySelector("button[type=submit]").textContent = "Envoyer";
  f.querySelectorAll("#fbK [data-k]").forEach(b => b.onclick = () => f.querySelectorAll("#fbK [data-k]").forEach(x => x.setAttribute("aria-pressed", x === b)));
  setTimeout(() => f.querySelector("#fbT").focus(), 80);
}
// Propriétaire : les messages reçus
let FB_ITEMS = [];
async function fbAdminLoad() {
  const box = document.getElementById("fbAdmin"); if (!box || FB_OWNER === false || !(typeof socOn === "function" && socOn())) return;
  try { FB_ITEMS = (await socApi("/me/feedback")).items || []; FB_OWNER = true; } catch (e) { FB_OWNER = false; return; }
  const kl = k => (FB_KINDS.find(x => x[0] === k) || FB_KINDS[2])[1];
  box.innerHTML = `<span class="lbl" style="margin-top:14px;display:block">Messages reçus (${FB_ITEMS.length})</span>` + (FB_ITEMS.length ? FB_ITEMS.map(x => `<div class="fb-it"><div class="fb-h"><b>${esc(kl(x.kind))}</b><small>${esc(x.from || "")}${x.tag ? " · @" + esc(x.tag) : ""} · ${esc(new Date(x.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</small></div>
    <p>${esc(x.text).replace(/\n/g, "<br>")}</p><small class="hint">${esc(x.tech || "")}</small>
    <div class="fb-a"><a class="btn" href="mailto:${esc(x.email)}?subject=${encodeURIComponent("Ton message à Bourselle")}">Répondre</a><button type="button" class="btn" data-fbdone="${esc(x.id)}">✓ Traité</button></div></div>`).join("") : `<p class="hint">Aucun message pour l'instant.</p>`);
  box.querySelectorAll("[data-fbdone]").forEach(b => b.onclick = async () => { try { await socApi("/me/feedback", { method: "POST", body: JSON.stringify({ done: b.dataset.fbdone }) }); fbAdminLoad(); } catch (e) { toast(e.message); } });
}
