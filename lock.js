/* Bourselle — verrouillage de l'appli par Face ID, empreinte ou code du téléphone (WebAuthn, authentificateur de l'appareil).
 * Réglé par appareil (rien n'est envoyé : la clé reste dans le téléphone). Quand l'appli s'ouvre, ou revient après un délai
 * en arrière-plan, un écran masque tout jusqu'au déverrouillage. En cas de souci, on peut se déconnecter puis se reconnecter.
 * Les clés d'accès (passkeys) Google et Microsoft, elles, servent à se connecter au compte : on donne le lien pour en créer une. */
const LOCK_KEY = "bourselle-lock";
const LOCK_DELAYS = [[0, "Tout de suite"], [60, "Après 1 min"], [300, "Après 5 min"], [900, "Après 15 min"]];
const lockCfg = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); } catch (e) { return null; } };
const lockSave = c => { try { if (c) localStorage.setItem(LOCK_KEY, JSON.stringify(c)); else localStorage.removeItem(LOCK_KEY); } catch (e) {} };
const lockOn = () => !!(lockCfg() && lockCfg().id);
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
async function lockSupported() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
}
// Activer : on crée une clé liée à l'appareil, qui demandera Face ID / l'empreinte / le code
async function lockEnable() {
  if (!await lockSupported()) { toast("Ce téléphone ou ce navigateur ne permet pas le déverrouillage par Face ID ou empreinte."); return false; }
  try {
    const name = (typeof store !== "undefined" && store && store.user && store.user().email) || "Bourselle";
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: rnd(32), rp: { name: "Bourselle" }, user: { id: rnd(16), name, displayName: "Bourselle" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" }, timeout: 60000, attestation: "none" } });
    if (!cred) return false;
    lockSave({ id: b64u(cred.rawId), delay: 60, at: Date.now() });
    toast("Verrouillage activé"); return true;
  } catch (e) { if (e && e.name !== "NotAllowedError") toast("Activation impossible : " + (e.message || e.name)); return false; }
}
async function lockVerify() {
  const c = lockCfg(); if (!c) return true;
  try {
    const a = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: "public-key", id: unb64u(c.id) }], userVerification: "required", timeout: 60000 } });
    return !!(a && a.response && a.response.authenticatorData && a.response.authenticatorData.byteLength >= 37 && (new Uint8Array(a.response.authenticatorData)[32] & 4));   // drapeau « utilisateur vérifié »
  } catch (e) { return false; }
}
async function lockDisable() { if (!await lockVerify()) { toast("Déverrouillage refusé : le verrouillage reste actif"); return false; } lockSave(null); toast("Verrouillage désactivé"); return true; }

// Écran de verrouillage
let lockShown = false, lockHiddenAt = 0;
function lockShow() {
  if (!lockOn() || lockShown) return;
  lockShown = true; document.documentElement.classList.add("locked");
  let el = document.getElementById("lockScreen");
  if (!el) { el = document.createElement("div"); el.id = "lockScreen"; el.className = "lock-screen"; document.body.appendChild(el); }
  el.innerHTML = `<div class="lock-in"><img src="icons/icon-192.png" alt="" width="64" height="64"><h2>Bourselle est verrouillé</h2>
    <p>Déverrouille avec Face ID, ton empreinte ou le code de ton téléphone.</p>
    <button type="button" class="btn primary" id="lockGo">🔓 Déverrouiller</button>
    <button type="button" class="linkbtn" id="lockOut">Se déconnecter</button></div>`;
  el.hidden = false;
  if (window.T) el.querySelectorAll("h2,p,button").forEach(n => { n.textContent = window.T(n.textContent); });
  const go = async () => { const b = el.querySelector("#lockGo"); b.disabled = true; const ok = await lockVerify(); b.disabled = false; if (ok) lockHide(); else toast("Pas déverrouillé : réessaie"); };
  el.querySelector("#lockGo").onclick = go;
  el.querySelector("#lockOut").onclick = () => { lockHide(); lockSave(null); if (typeof signOut === "function") signOut(); };
  // Sur ordinateur et Android, on peut lancer la demande tout de suite ; sur iPhone, Safari exige un toucher
  if (!/iP(hone|ad|od)/.test(navigator.userAgent)) setTimeout(go, 300);
}
function lockHide() { lockShown = false; document.documentElement.classList.remove("locked"); const el = document.getElementById("lockScreen"); if (el) el.hidden = true; }
document.addEventListener("visibilitychange", () => {
  if (!lockOn()) return;
  if (document.visibilityState === "hidden") lockHiddenAt = Date.now();
  else if (lockHiddenAt && Date.now() - lockHiddenAt >= (lockCfg().delay || 0) * 1000) lockShow();
});
// Au démarrage : verrouillé d'emblée (avant même d'afficher les données)
if (lockOn()) { document.documentElement.classList.add("locked"); document.addEventListener("DOMContentLoaded", lockShow); if (document.readyState !== "loading") lockShow(); }

// Carte dans Paramètres
function lockCardHTML() {
  const c = lockCfg(), on = !!(c && c.id);
  return `<div class="card"><h2>Verrouillage et clé d'accès</h2>
    <label class="toggle" for="lockTg"><span>Verrouiller l'appli (Face ID, empreinte ou code)</span><input type="checkbox" id="lockTg" ${on ? "checked" : ""}></label>
    ${on ? `<span class="lbl">Verrouiller quand je reviens</span><div class="chips" id="lockDelay"></div>` : ""}
    <p class="hint" style="margin:6px 0 0">Sur cet appareil seulement. Rien n'est envoyé : Bourselle demande simplement à ton téléphone de vérifier que c'est toi.</p>
    <span class="lbl" style="margin-top:14px">Se connecter sans mot de passe</span>
    <p class="hint" style="margin:0 0 8px">Crée une clé d'accès sur ton compte : à la connexion, Google ou Microsoft te demanderont Face ID ou ton empreinte au lieu du mot de passe.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="https://myaccount.google.com/signinoptions/passkeys" target="_blank" rel="noopener">Clé d'accès Google ↗</a><a class="btn" href="https://account.live.com/proofs/manage" target="_blank" rel="noopener">Clé d'accès Microsoft ↗</a></div></div>`;
}
function lockBind(root) {
  const tg = root.querySelector("#lockTg"); if (!tg) return;
  tg.onchange = async () => { tg.disabled = true; const ok = tg.checked ? await lockEnable() : await lockDisable(); tg.disabled = false; if (!ok) tg.checked = !tg.checked; render(); };
  if (root.querySelector("#lockDelay")) chipsPick("lockDelay", LOCK_DELAYS.map(([v, l]) => [String(v), l]), String((lockCfg() || {}).delay ?? 60), v => { const c = lockCfg(); if (c) { c.delay = Number(v); lockSave(c); } });
}
