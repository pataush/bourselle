/* Bourselle — un seul appareil connecté à la fois.
 * Se connecter (clic sur Google / Microsoft) fait de cet appareil l'appareil actif sur le serveur.
 * Les autres appareils le voient à leur prochaine vérification (ouverture, retour au premier plan,
 * toutes les minutes, avant chaque enregistrement) et se déconnectent sans rien écraser.
 * Si le serveur ne répond pas, on ne bloque rien (hors ligne, serveur pas encore à jour…). */
const SESS_KEY = "bourselle-sid";
let sessLast = 0, sessBusy = null, sessKicked = false;
const sessOn = () => !sessKicked && typeof socOn === "function" && socOn();
function sessDev() {
  const ua = navigator.userAgent || "";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "téléphone Android" : "tablette Android") : /Windows/.test(ua) ? "PC Windows" : /Macintosh|Mac OS/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "ordinateur Linux" : "autre appareil";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? `${os} (${br})` : os;
}
const sessTimeout = (p, ms = 5000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("délai")), ms))]);
function sessNewId() { const a = crypto.getRandomValues(new Uint8Array(16)); return Array.from(a, b => (b % 36).toString(36)).join("") + Date.now().toString(36); }

// Cet appareil devient l'appareil actif (ifFree : seulement si personne ne l'est encore).
async function sessClaim(ifFree) {
  if (!sessOn()) return true;
  const sid = sessNewId();
  try {
    const j = await sessTimeout(socApi("/me/session", { method: "POST", body: JSON.stringify({ sid, dev: sessDev(), ifFree: !!ifFree }) }));
    if (j.sid !== sid) { sessKick(j.dev); return false; }
    localStorage.setItem(SESS_KEY, sid); sessLast = Date.now();
    if (j.prev && !ifFree) setTimeout(() => toast(`Connecté ici : Bourselle a été déconnecté de ton ${j.prev}.`), 1500);
  } catch (e) {}
  return true;
}
// Vrai si cet appareil est (encore) l'appareil actif. force : true = tout de suite, ou un délai en ms (20 s par défaut).
async function sessCheck(force) {
  if (sessKicked) return false;
  if (!sessOn()) return true;
  if (force !== true && Date.now() - sessLast < (typeof force === "number" ? force : 20000)) return true;
  if (sessBusy) return sessBusy;
  sessBusy = (async () => {
    try {
      const j = await sessTimeout(socApi("/me/session"));
      sessLast = Date.now();
      const mine = localStorage.getItem(SESS_KEY);
      if (!j.sid) return await sessClaim(true);            // personne d'actif (première fois) : cet appareil le devient
      if (j.sid !== mine) { sessKick(j.dev); return false; }
      return true;
    } catch (e) { return true; }                            // hors ligne ou serveur indisponible : on ne bloque pas
    finally { sessBusy = null; }
  })();
  return sessBusy;
}
// Un autre appareil a pris la main : on se déconnecte ici sans enregistrer (pour ne pas écraser ses données).
function sessKick(dev) {
  if (sessKicked) return; sessKicked = true;
  try { dirty = false; clearTimeout(saveTimer); dropPending(); } catch (e) {}
  localStorage.removeItem(SESS_KEY);
  try { signOut(); } catch (e) {}
  const m = document.getElementById("loginMsg");
  if (m) m.textContent = `Ton compte Bourselle a été ouvert sur un autre appareil${dev ? ` (${dev})` : ""}. Tu as été déconnecté ici. Reconnecte-toi pour continuer sur cet appareil : l'autre sera alors déconnecté.`;
}
// Appelée par connect() : connexion choisie (clic) → on prend la main ; reprise automatique → on vérifie.
async function sessStart(claim) {
  sessKicked = false; sessLast = 0;
  return claim ? sessClaim(false) : sessCheck(true);
}
function sessEnd() { localStorage.removeItem(SESS_KEY); sessLast = 0; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sessCheck(true); });
window.addEventListener("focus", () => sessCheck());
setInterval(() => { if (document.visibilityState === "visible") sessCheck(true); }, 60000);
