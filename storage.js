/* Bourselle — stockage des données dans le cloud de chaque utilisateur.
 *
 * Chaque adaptateur expose la même interface, utilisée par app.js :
 *   id, label, canFiles
 *   signIn(interactive)      -> connecte l'utilisateur (interactive = clic de l'utilisateur)
 *   user()                   -> { name, email }
 *   load()                   -> { data, version } (data = null si rien n'est encore enregistré)
 *   save(data)               -> version
 *   remoteVersion()          -> version actuelle dans le cloud (pour voir si un autre appareil a modifié)
 *   uploadFile(file, type)   -> { id, name, type }
 *   fileBlob(id)             -> Blob
 *   deleteFile(id)           -> met le fichier à la corbeille
 *   folderUrl()              -> lien pour ouvrir le dossier « Bourselle » dans le Drive
 *   placeFile(id, path, name) -> range un fichier existant dans Bourselle/<path> sous un nouveau nom -> { url }
 *   putFile(path, name, blob, type) -> crée ou remplace Bourselle/<path>/<name> -> { id, url }
 *   folderLink(path)         -> lien pour ouvrir Bourselle/<path>
 *   signOut()
 *
 * Pour ajouter iCloud plus tard : écrire un adaptateur de plus avec cette interface.
 */
(function () {
  const DATA_FILE = "bourselle-donnees.json";
  const FOLDER = "Bourselle";
  const FILES_FOLDER = "Factures";

  class StoreError extends Error {
    constructor(code, message) { super(message || code); this.code = code; }
  }

  function safeName(name) {
    const base = String(name || "facture").normalize("NFC").replace(/[\\/:*?"<>|#%]+/g, "-").replace(/\s+/g, " ").trim();
    return base.slice(-80) || "facture";
  }
  function stamp() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`; }

  async function check(res) {
    if (res.ok) return res;
    let reason = "";
    try { const j = await res.clone().json(); const er = j && j.error; reason = (er && ((er.errors && er.errors[0] && er.errors[0].reason) || er.status || (typeof er === "string" ? er : er.code))) || ""; } catch (e) {}
    const mk = (code, msg) => { const e = new StoreError(code, msg); e.status = res.status; e.reason = String(reason || ""); return e; };
    if (res.status === 401) throw mk("auth", "Session expirée");
    if (res.status === 403) {
      if (/storageQuota|quotaExceeded/i.test(reason)) throw mk("quota", "Espace de stockage plein");
      if (/rateLimit|userRateLimit|backendError/i.test(reason)) throw mk("unavailable", "Service momentanément indisponible");
      if (/insufficient|scope|appNotAuthorized|PERMISSION_DENIED|accessNotConfigured|forbidden/i.test(reason) || !reason) throw mk("scope", "Le Drive refuse l'enregistrement : reconnecte-toi et autorise l'accès au dossier « Bourselle »");
      throw mk("forbidden", "Accès refusé par le Drive");
    }
    if (res.status === 404) throw new StoreError("not_found", "Introuvable");
    if (res.status === 507 || res.status === 413) throw new StoreError("quota", "Espace de stockage plein");
    if (res.status === 429 || res.status >= 500) throw new StoreError("unavailable", "Service momentanément indisponible");
    throw new StoreError("http_" + res.status, "Erreur " + res.status);
  }

  function waitFor(test, ms = 10000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function poll() {
        const v = test();
        if (v) return resolve(v);
        if (Date.now() - t0 > ms) return reject(new StoreError("script", "Le service de connexion ne s'est pas chargé. Vérifie ta connexion internet."));
        setTimeout(poll, 100);
      })();
    });
  }

  // ------------------------------------------------------------------
  // Démo : données gardées dans ce navigateur, sans compte.
  // ------------------------------------------------------------------
  function LocalStore() {
    const KEY = "bourselle-demo";
    return {
      id: "local", label: "Cet appareil (démo)", canFiles: false,
      async signIn() {}, user: () => ({ name: "Mode démo", email: "" }),
      async load() { try { const raw = localStorage.getItem(KEY); return { data: raw ? JSON.parse(raw) : null, version: "local" }; } catch (e) { return { data: null, version: "local" }; } },
      async save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { throw new StoreError("quota", "Stockage du navigateur plein"); } return "local"; },
      async remoteVersion() { return "local"; },
      async uploadFile() { throw new StoreError("unsupported", "Les factures demandent un compte Google ou Microsoft."); },
      async fileBlob() { throw new StoreError("not_found"); },
      async deleteFile() {},
      folderUrl: () => "",
      signOut() {},
    };
  }

  // ------------------------------------------------------------------
  // Google Drive : dossier « Bourselle » visible dans le Drive de l'utilisateur.
  // Portée drive.file : l'app ne voit QUE les fichiers qu'elle a créés.
  // ------------------------------------------------------------------
  function GoogleStore(clientId) {
    const SCOPES = "https://www.googleapis.com/auth/drive.file openid email profile";
    const API = "https://www.googleapis.com/drive/v3";
    const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
    let token = null, expires = 0, me = null;
    let folderId = null, filesFolderId = null, dataFileId = null;

    function requestToken(prompt) {
      return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          hint: localStorage.getItem("mb-google-hint") || undefined,
          callback: r => {
            if (r.error) return reject(new StoreError("auth", r.error_description || r.error));
            if (!google.accounts.oauth2.hasGrantedAllScopes(r, "https://www.googleapis.com/auth/drive.file"))
              return reject(new StoreError("scope", "Autorise l'accès au dossier « Bourselle » de ton Drive pour continuer."));
            token = r.access_token; expires = Date.now() + (Number(r.expires_in) - 120) * 1000; resolve();
          },
          error_callback: e => reject(new StoreError(e && e.type === "popup_closed" ? "cancelled" : "auth", "Connexion annulée ou bloquée")),
        });
        client.requestAccessToken({ prompt });
      });
    }
    async function api(url, opts = {}) {
      if (!token || Date.now() > expires) throw new StoreError("auth", "Session expirée");
      let res;
      try { res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + token } }); }
      catch (e) { throw new StoreError("offline", "Pas de connexion internet"); }
      if (res.status === 401) { token = null; }
      return check(res);
    }
    const q = s => encodeURIComponent(s);
    async function findOrCreateFolder(name, parent) {
      const query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
      const r = await (await api(`${API}/files?q=${q(query)}&fields=files(id,name)&spaces=drive`)).json();
      if (r.files && r.files.length) return r.files[0].id;
      const c = await (await api(`${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }) })).json();
      return c.id;
    }
    async function ensureFolders() {
      if (!folderId) folderId = await findOrCreateFolder(FOLDER, "root");
      if (!filesFolderId) filesFolderId = await findOrCreateFolder(FILES_FOLDER, folderId);
    }
    const folderCache = {};
    async function folderPath(path) {   // crée au besoin Bourselle/a/b/c et renvoie l'identifiant du dernier dossier
      await ensureFolders();
      let parent = folderId, key = "";
      for (const part of path) {
        key += "/" + part;
        if (!folderCache[key]) folderCache[key] = await findOrCreateFolder(safeName(part), parent);
        parent = folderCache[key];
      }
      return parent;
    }
    function multipart(meta, blob, type) {
      const b = "mb" + Math.random().toString(36).slice(2);
      const body = new Blob([
        `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`,
        blob, `\r\n--${b}--`]);
      return { body, contentType: `multipart/related; boundary=${b}` };
    }

    return {
      id: "google", label: "Google Drive", canFiles: true,
      async signIn(interactive) {
        await waitFor(() => window.google && google.accounts && google.accounts.oauth2);
        await requestToken(interactive === "choose" ? "select_account" : interactive === "consent" ? "consent" : "");
        me = await (await api("https://www.googleapis.com/oauth2/v3/userinfo")).json();
        if (me.email) localStorage.setItem("mb-google-hint", me.email);
        await ensureFolders();
      },
      tokenExpiresSoon: () => !token || Date.now() > expires - 5 * 60 * 1000,
      async accessToken() { if (!token || Date.now() > expires) await requestToken(""); return token; },
      refresh: () => requestToken(""),
      user: () => ({ name: me ? me.name || me.email : "", email: me ? me.email : "" }),
      async load() {
        await ensureFolders();
        const query = `name='${DATA_FILE}' and '${folderId}' in parents and trashed=false`;
        const r = await (await api(`${API}/files?q=${q(query)}&fields=files(id,modifiedTime,version)&orderBy=modifiedTime desc`)).json();
        if (!r.files || !r.files.length) return { data: null, version: null };
        dataFileId = r.files[0].id;
        const data = await (await api(`${API}/files/${dataFileId}?alt=media`)).json();
        return { data, version: r.files[0].version };
      },
      async save(data) {
        await ensureFolders();
        const json = new Blob([JSON.stringify(data)], { type: "application/json" });
        let r;
        if (dataFileId) {
          r = await (await api(`${UPLOAD}/files/${dataFileId}?uploadType=media&fields=id,version`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json })).json();
        } else {
          const m = multipart({ name: DATA_FILE, parents: [folderId], mimeType: "application/json" }, json, "application/json");
          r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id,version`, { method: "POST", headers: { "Content-Type": m.contentType }, body: m.body })).json();
          dataFileId = r.id;
        }
        return r.version;
      },
      async remoteVersion() {
        if (!dataFileId) return null;
        const r = await (await api(`${API}/files/${dataFileId}?fields=version`)).json();
        return r.version;
      },
      async uploadFile(file, type) {
        await ensureFolders();
        const name = `${stamp()} ${safeName(file.name)}`;
        const m = multipart({ name, parents: [filesFolderId] }, file, type);
        const r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType`, { method: "POST", headers: { "Content-Type": m.contentType }, body: m.body })).json();
        return { id: r.id, name: file.name || r.name, type: r.mimeType || type };
      },
      async fileBlob(id) { return (await api(`${API}/files/${encodeURIComponent(id)}?alt=media`)).blob(); },
      async deleteFile(id) {
        await api(`${API}/files/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
      },
      folderUrl: () => folderId ? `https://drive.google.com/drive/folders/${folderId}` : "https://drive.google.com/",
      async placeFile(id, path, name) {
        const dest = await folderPath(path);
        const cur = await (await api(`${API}/files/${encodeURIComponent(id)}?fields=parents,name`)).json();
        const remove = (cur.parents || []).filter(p => p !== dest).join(",");
        await api(`${API}/files/${encodeURIComponent(id)}?addParents=${dest}${remove ? "&removeParents=" + remove : ""}&fields=id`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: safeName(name) }) });
        return { url: `https://drive.google.com/file/d/${id}/view` };
      },
      async putFile(path, name, blob, type) {
        const dest = await folderPath(path);
        const query = `name='${name.replace(/'/g, "\\'")}' and '${dest}' in parents and trashed=false`;
        const r = await (await api(`${API}/files?q=${q(query)}&fields=files(id)`)).json();
        let id;
        if (r.files && r.files.length) {
          id = r.files[0].id;
          await api(`${UPLOAD}/files/${id}?uploadType=media&fields=id`, { method: "PATCH", headers: { "Content-Type": type }, body: blob });
        } else {
          const m = multipart({ name, parents: [dest] }, blob, type);
          id = (await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", headers: { "Content-Type": m.contentType }, body: m.body })).json()).id;
        }
        return { id, url: `https://drive.google.com/file/d/${id}/view` };
      },
      async folderLink(path) { return `https://drive.google.com/drive/folders/${await folderPath(path)}`; },
      signOut() {
        if (token && window.google && google.accounts) google.accounts.oauth2.revoke(token, () => {});
        token = null; localStorage.removeItem("mb-google-hint");
      },
    };
  }

  // ------------------------------------------------------------------
  // Microsoft OneDrive (Hotmail, Outlook, Live, comptes pro) :
  // dossier d'application « Applications/Bourselle » du OneDrive de l'utilisateur.
  // Portée Files.ReadWrite.AppFolder : l'app ne voit QUE son propre dossier.
  // ------------------------------------------------------------------
  function MicrosoftStore(clientId) {
    const SCOPES = ["Files.ReadWrite.AppFolder", "User.Read"];
    const G = "https://graph.microsoft.com/v1.0";
    let msal = null, account = null, me = null, root = null;
    const redirectUri = location.origin + location.pathname;

    async function getMsal() {
      if (msal) return msal;
      await waitFor(() => window.msal && window.msal.PublicClientApplication);
      msal = new window.msal.PublicClientApplication({
        auth: { clientId, authority: "https://login.microsoftonline.com/common", redirectUri },
        cache: { cacheLocation: "localStorage" },
      });
      if (msal.initialize) await msal.initialize();
      return msal;
    }
    async function getToken() {
      const app = await getMsal();
      if (!account) throw new StoreError("auth", "Non connecté");
      try { return (await app.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
      catch (e) { throw new StoreError("auth", "Session expirée"); }
    }
    async function api(url, opts = {}) {
      const t = await getToken();
      return check(await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + t } }));
    }
    const path = p => `${G}/me/drive/special/approot:/${p.split("/").map(encodeURIComponent).join("/")}`;
    const msCache = {};
    async function msFolder(folder) {   // crée au besoin approot/a/b/c et renvoie { id, webUrl }
      let parentUrl = `${G}/me/drive/special/approot`, rel = [], last = null;
      for (const part of folder.map(safeName)) {
        rel.push(part); const key = rel.join("/");
        if (!msCache[key]) {
          try { msCache[key] = await (await api(`${path(key)}?select=id,webUrl`)).json(); }
          catch (e) {
            if (e.code !== "not_found") throw e;
            msCache[key] = await (await api(`${parentUrl}/children`, { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: part, folder: {}, "@microsoft.graph.conflictBehavior": "replace" }) })).json();
          }
        }
        last = msCache[key]; parentUrl = `${G}/me/drive/items/${last.id}`;
      }
      return last;
    }
    async function download(itemUrl) {
      const meta = await (await api(`${itemUrl}?select=id,eTag,@microsoft.graph.downloadUrl`)).json();
      const res = await fetch(meta["@microsoft.graph.downloadUrl"]);
      await check(res);
      return { res, meta };
    }

    return {
      id: "microsoft", label: "OneDrive", canFiles: true,
      accessToken: () => getToken(),
      // Au démarrage : récupère le retour de la page de connexion Microsoft, s'il y en a un.
      async resume() {
        const app = await getMsal();
        const r = await app.handleRedirectPromise();
        account = (r && r.account) || app.getAllAccounts()[0] || null;
        return !!account;
      },
      async signIn(interactive) {
        const app = await getMsal();
        if (!account) {
          if (!interactive) throw new StoreError("auth", "Non connecté");
          await app.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
          return new Promise(() => {});   // la page part vers Microsoft
        }
        try { await getToken(); }
        catch (e) {
          if (!interactive) throw e;
          await app.acquireTokenRedirect({ scopes: SCOPES, account });
          return new Promise(() => {});
        }
        me = await (await api(`${G}/me?$select=displayName,mail,userPrincipalName`)).json();
        root = await (await api(`${G}/me/drive/special/approot?$select=id,webUrl`)).json();
      },
      user: () => ({ name: me ? me.displayName : "", email: me ? me.mail || me.userPrincipalName : "" }),
      async load() {
        try {
          const { res, meta } = await download(path(DATA_FILE));
          return { data: await res.json(), version: meta.eTag };
        } catch (e) { if (e.code === "not_found") return { data: null, version: null }; throw e; }
      },
      async save(data) {
        const r = await (await api(`${path(DATA_FILE)}:/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).json();
        return r.eTag;
      },
      async remoteVersion() {
        try { return (await (await api(`${path(DATA_FILE)}?select=eTag`)).json()).eTag; }
        catch (e) { if (e.code === "not_found") return null; throw e; }
      },
      async uploadFile(file, type) {
        const name = `${FILES_FOLDER}/${stamp()} ${safeName(file.name)}`;
        let item;
        if (file.size < 4 * 1024 * 1024) {
          item = await (await api(`${path(name)}:/content?@microsoft.graph.conflictBehavior=rename`, { method: "PUT", headers: { "Content-Type": type }, body: file })).json();
        } else {
          const s = await (await api(`${path(name)}:/createUploadSession`, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }) })).json();
          const CHUNK = 320 * 1024 * 10;
          for (let start = 0; start < file.size; start += CHUNK) {
            const end = Math.min(file.size, start + CHUNK);
            const res = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Range": `bytes ${start}-${end - 1}/${file.size}` }, body: file.slice(start, end) });
            await check(res);
            if (end === file.size) item = await res.json();
          }
        }
        return { id: item.id, name: file.name || item.name, type };
      },
      async fileBlob(id) { const { res } = await download(`${G}/me/drive/items/${encodeURIComponent(id)}`); return res.blob(); },
      async deleteFile(id) { await api(`${G}/me/drive/items/${encodeURIComponent(id)}`, { method: "DELETE" }); },
      folderUrl: () => root ? root.webUrl : "https://onedrive.live.com/",
      async placeFile(id, folder, name) {
        const dest = await msFolder(folder);
        const item = await (await api(`${G}/me/drive/items/${encodeURIComponent(id)}?@microsoft.graph.conflictBehavior=rename`, { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: safeName(name), parentReference: { id: dest.id } }) })).json();
        return { url: item.webUrl || "" };
      },
      async putFile(folder, name, blob, type) {
        await msFolder(folder);
        const item = await (await api(`${path([...folder.map(safeName), safeName(name)].join("/"))}:/content`, { method: "PUT", headers: { "Content-Type": type }, body: blob })).json();
        return { id: item.id, url: item.webUrl || "" };
      },
      async folderLink(folder) { return (await msFolder(folder)).webUrl || (root && root.webUrl) || ""; },
      signOut() {
        const a = account; account = null;
        if (msal && a) msal.logoutRedirect({ account: a, postLogoutRedirectUri: redirectUri }).catch(() => {});
      },
    };
  }

  window.MBStorage = { LocalStore, GoogleStore, MicrosoftStore, StoreError };
})();
