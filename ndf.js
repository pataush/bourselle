// ---------- Notes de frais : dossier dans le Drive + classeur Excel ----------
// Les tickets des notes de frais sont rangés dans Bourselle › Notes de frais › AAAA › AAAA-MM,
// nommés « AAAA-MM-JJ - Libellé - Montant ». Le classeur « Notes de frais AAAA.xlsx » (un onglet par mois,
// une ligne par dépense, HT / TVA / TTC, totaux) est recréé dans ce dossier à chaque changement.

// --- Petit écrivain XLSX (zip sans compression) ---
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {   // files : [[nom, texte]]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const head = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...head]);
    parts.push(local, nb, data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...head, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += local.length + nb.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
const xmlEsc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const colL = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const xlDate = iso => { const [y, m, d] = iso.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); };
// Styles : 0 normal · 1 en-tête · 2 montant · 3 taux % · 4 date · 5 total (montant gras) · 6 texte gras · 7 lien · 8 titre · 9 nombre
function xlsxBook(sheets, cur) {
  const z = NO_CENTS.includes(cur), sym = (curSymOf(cur) || cur).replace(/"/g, "");
  const money = `#,##0${z ? "" : ".00"} "${sym}"`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="${xmlEsc(money)}"/><numFmt numFmtId="165" formatCode="0.##&quot; %&quot;"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><u/><sz val="11"/><color rgb="FF1F5FBF"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF16324A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><top style="thin"><color rgb="FF16324A"/></top></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const cellXml = (c, r, ci) => {
    if (c == null || c === "") return "";
    const ref = colL(ci) + r, o = typeof c === "object" ? c : { v: c };
    const s = o.s ? ` s="${o.s}"` : "";
    if (o.f) {
      const isNum = typeof o.v === "number";
      return `<c r="${ref}"${s}${isNum ? "" : ` t="str"`}><f>${xmlEsc(o.f)}</f>${o.v != null ? `<v>${xmlEsc(isNum ? Math.round(o.v * 100) / 100 : o.v)}</v>` : ""}</c>`;
    }
    if (typeof o.v === "number" && isFinite(o.v)) return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(o.v)}</t></is></c>`;
  };
  const sheetXml = sh => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"${sh.first ? ` tabSelected="1"` : ""}>${sh.freeze ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : ""}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${sh.rows.map((row, ri) => `<row r="${ri + 1}"${ri === sh.headerRow ? ` ht="30" customHeight="1"` : ""}>${row.map((c, ci) => cellXml(c, ri + 1, ci)).join("")}</row>`).join("")}</sheetData>
${sh.filter ? `<autoFilter ref="${sh.filter}"/>` : ""}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheets.map((sh, i) => `<sheet name="${xmlEsc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
${sheets.some(sh => sh.filter) ? `<definedNames>${sheets.map((sh, i) => sh.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEsc(sh.name.replace(/'/g, "''"))}'!${sh.filter.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")}</definedName>` : "").join("")}</definedNames>` : ""}
<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", styles],
    ...sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)]),
  ];
  return zipStore(files);
}

// --- Contenu du classeur ---
const NDF_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const tt = s => window.T ? T(s) : s;
function ndfItems(year) { return allItems().filter(x => x.type === "depense" && x.ndf && x.date && x.date.startsWith(year + "-")).sort((a, b) => a.date.localeCompare(b.date) || (a.created || 0) - (b.created || 0)); }
function ndfYears() { return [...new Set(allItems().filter(x => x.type === "depense" && x.ndf && x.date).map(x => x.date.slice(0, 4)))].sort(); }
function ndfVat(x) {   // TVA et HT dans la devise du budget
  if (!x.vat) return { vat: null, ht: null, rate: null };
  const k = x.orig && x.vat.cur === x.orig.cur && x.orig.rate ? 1 / x.orig.rate : 1, vat = Math.round(x.vat.amount * k * 100) / 100;
  return { vat, ht: Math.round((Number(x.amount) - vat) * 100) / 100, rate: x.vat.rate != null ? x.vat.rate : null, rates: x.vat.rates };
}
function ndfBook(year) {
  const cur = baseCurrency(), items = ndfItems(year), sheets = [];
  const H = ["Date", "Libellé", "Catégorie", "Montant HT", "Taux de TVA", "TVA", "Montant TTC", "Devise d'origine", "Montant d'origine", "TVA d'origine", "Taux de change", "Statut", "Remboursée le", "Justificatifs", "Ticket"].map(h => ({ v: tt(h), s: 1 }));
  const monthsWith = [...new Set(items.map(x => Number(x.date.slice(5, 7))))].sort((a, b) => a - b);
  const recap = [];
  for (const m of monthsWith) {
    const list = items.filter(x => Number(x.date.slice(5, 7)) === m), name = `${tt(NDF_MOIS[m - 1])} ${year}`;
    const rows = [[{ v: `${tt("Notes de frais")} – ${name}`, s: 8 }], [], H];
    for (const x of list) {
      const v = ndfVat(x), files = x.files || [], link = (files.find(f => f.url) || {}).url;
      rows.push([{ v: xlDate(x.date), s: 4 }, x.note || catById(x.cat).name, catById(x.cat).name,
        v.ht != null ? { v: v.ht, s: 2 } : "", v.rate != null ? { v: v.rate, s: 3 } : v.rates ? (v.rates.map(e => String(e.rate).replace(".", ",") + " %").join(" + ")) : "",
        v.vat != null ? { v: v.vat, s: 2 } : "", { v: Number(x.amount), s: 2 },
        x.orig ? x.orig.cur : "", x.orig ? { v: Number(x.orig.amount), s: 9 } : "", x.orig && x.vat && x.vat.cur === x.orig.cur ? { v: x.vat.amount, s: 9 } : "", x.orig ? x.orig.rate : "",
        tt(x.ndfStatus === "rembourse" ? "Remboursée" : "À rembourser"), x.ndfPaidOn ? { v: xlDate(x.ndfPaidOn), s: 4 } : "",
        files.length ? files.map(f => f.name).join(", ") : tt("Aucun"), link ? { f: `HYPERLINK("${link.replace(/"/g, "")}","${tt("Voir le ticket").replace(/"/g, "")}")`, v: tt("Voir le ticket"), s: 7 } : ""]);
    }
    const first = 4, last = rows.length, tr = last + 2;
    const sum = (col, fn) => ({ f: `SUM(${col}${first}:${col}${last})`, v: fn, s: 5 });
    const tot = { ht: list.reduce((a, x) => a + (ndfVat(x).ht ?? 0), 0), vat: list.reduce((a, x) => a + (ndfVat(x).vat ?? 0), 0), ttc: list.reduce((a, x) => a + Number(x.amount), 0) };
    const due = list.filter(x => x.ndfStatus !== "rembourse").reduce((a, x) => a + Number(x.amount), 0);
    rows.push([]);
    rows.push([{ v: tt("Total"), s: 6 }, { v: `${list.length} ${tt(list.length > 1 ? "dépenses" : "dépense")}`, s: 6 }, { v: "", s: 6 }, sum("D", tot.ht), { v: "", s: 6 }, sum("F", tot.vat), sum("G", tot.ttc)]);
    rows.push([{ v: tt("Dont à rembourser"), s: 8 }, "", "", "", "", "", { f: `SUMIF(L${first}:L${last},"${tt("À rembourser")}",G${first}:G${last})`, v: due, s: 2 }]);
    rows.push([{ v: tt("Dont remboursé"), s: 8 }, "", "", "", "", "", { f: `SUMIF(L${first}:L${last},"${tt("Remboursée")}",G${first}:G${last})`, v: tot.ttc - due, s: 2 }]);
    if (list.some(x => !x.vat)) rows.push([], [{ v: tt("HT et TVA vides : TVA non renseignée pour cette dépense.") }]);
    sheets.push({ name: name.slice(0, 31), cols: [12, 30, 22, 14, 11, 12, 14, 10, 14, 12, 11, 15, 14, 30, 16], rows, freeze: 3, headerRow: 2, filter: `A3:O${last}` });
    recap.push({ name: sheets[sheets.length - 1].name, n: list.length, ...tot, due, tr });
  }
  // Récapitulatif de l'année
  const R = [[{ v: `${tt("Notes de frais")} ${year} – ${tt("Récapitulatif")}`, s: 8 }], [], ["Mois", "Nombre", "Montant HT", "TVA", "Montant TTC", "À rembourser", "Remboursé"].map(h => ({ v: tt(h), s: 1 }))];
  for (const r of recap) {
    const ref = c => `'${r.name.replace(/'/g, "''")}'!${c}`;
    R.push([r.name, { f: `COUNTA(${ref(`A4:A${r.tr - 2}`)})`, v: r.n }, { f: ref(`D${r.tr}`), v: r.ht, s: 2 }, { f: ref(`F${r.tr}`), v: r.vat, s: 2 }, { f: ref(`G${r.tr}`), v: r.ttc, s: 2 },
      { f: ref(`G${r.tr + 1}`), v: r.due, s: 2 }, { f: ref(`G${r.tr + 2}`), v: r.ttc - r.due, s: 2 }]);
  }
  const a = 4, b = R.length, S = k => recap.reduce((s, r) => s + r[k], 0);
  R.push([]);
  R.push([{ v: tt("Total"), s: 6 }, { f: `SUM(B${a}:B${b})`, v: S("n"), s: 6 }, { f: `SUM(C${a}:C${b})`, v: S("ht"), s: 5 }, { f: `SUM(D${a}:D${b})`, v: S("vat"), s: 5 }, { f: `SUM(E${a}:E${b})`, v: S("ttc"), s: 5 }, { f: `SUM(F${a}:F${b})`, v: S("due"), s: 5 }, { f: `SUM(G${a}:G${b})`, v: recap.reduce((s, r) => s + r.ttc - r.due, 0), s: 5 }]);
  R.push([], [{ v: `${tt("Montants en")} ${cur}. ${tt("Généré par Bourselle le")} ${frDate(todayISO())}.` }]);
  sheets.unshift({ name: tt("Récapitulatif"), cols: [20, 10, 15, 13, 15, 15, 15], rows: R, freeze: 3, headerRow: 2, first: true });
  return xlsxBook(sheets, cur);
}
function ndfDownload(year) { const ok = saveFile(`${tt("Notes de frais")} ${year}.xlsx`, ndfBook(year)); if (ok) toast(tt("Classeur Excel téléchargé")); }

// --- Rangement dans le Drive ---
const ndfSync = { timer: null, busy: false, status: "", when: null, error: null };
function ndfRoot() { if (!settings.ndfFolder) settings.ndfFolder = tt("Notes de frais"); return settings.ndfFolder; }
function ndfFileName(x, f, k, n) {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(f.name || "") || [])[1] || ({ "application/pdf": "pdf", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[f.type] || "jpg");
  const amt = (x.orig ? fmtCur(x.orig.cur, x.orig.amount) : eur(x.amount)).replace(/[  ]/g, " ");
  return `${x.date} - ${(x.note || catById(x.cat).name).slice(0, 50)} - ${amt}${n > 1 ? ` (${k + 1})` : ""}.${ext.toLowerCase()}`;
}
function ndfCanSync() { return !!(store && assets && store.placeFile && store.putFile && store.id !== "local"); }
function ndfSyncSoon() { if (!ndfCanSync()) return; clearTimeout(ndfSync.timer); ndfSync.timer = setTimeout(ndfRun, 2500); }
async function ndfRun() {
  if (!ndfCanSync() || ndfSync.busy) return;
  ndfSync.busy = true; const s0 = store;
  try {
    const root = ndfRoot(); let moved = 0, changedKeys = new Set();
    // 1. tickets : dossier AAAA/AAAA-MM, nom daté
    for (const x of allItems().filter(x => x.type === "depense" && x.ndf && x.date && (x.files || []).length)) {
      const t = months[x.key] && months[x.key].items[x.id]; if (!t) continue;
      const path = [root, x.date.slice(0, 4), x.date.slice(0, 7)];
      for (let k = 0; k < t.files.length; k++) {
        const f = t.files[k], name = ndfFileName(t, f, k, t.files.length), key = path.join("/") + "|" + name;
        if (f.placed === key) continue;
        const r = await s0.placeFile(f.id, path, name);
        if (store !== s0) return;
        f.placed = key; if (r && r.url) f.url = r.url; moved++; changedKeys.add(x.key);
      }
    }
    if (moved) { for (const k of changedKeys) saveMonth(k); scheduleSave(); }
    // 2. classeurs Excel, seulement s'ils ont changé
    for (const y of ndfYears()) {
      const sig = JSON.stringify([window.LANG, baseCurrency(), ndfItems(y).map(x => [x.date, x.note, x.cat, x.amount, x.vat, x.orig, x.ndfStatus, x.ndfPaidOn, (x.files || []).map(f => [f.name, f.url])])]);
      const lk = `bourselle-ndfx-${s0.id}-${y}`; let h = 0; for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
      if (localStorage.getItem(lk) === String(h)) continue;
      await s0.putFile([root], `${root} ${y}.xlsx`, ndfBook(y), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      if (store !== s0) return;
      localStorage.setItem(lk, String(h));
    }
    ndfSync.error = null; ndfSync.when = new Date();
  } catch (e) { ndfSync.error = e; if (e && e.code === "auth") ndfSync.status = "auth"; }
  finally { ndfSync.busy = false; if (tab === "frais") { const el = document.getElementById("ndfDriveState"); if (el) el.innerHTML = ndfStateHTML(); } }
}
function ndfStateHTML() {
  if (!ndfCanSync()) return `<span>${tt("Connecte-toi avec Google ou Microsoft pour que les tickets soient rangés automatiquement dans ton Drive. Tu peux déjà télécharger le classeur.")}</span>`;
  if (ndfSync.busy) return `<span>${tt("Rangement en cours…")}</span>`;
  if (ndfSync.error) return `<span class="bad">${tt("Rangement impossible pour l'instant : nouvel essai au prochain enregistrement.")}</span>`;
  if (ndfSync.when) return `<span>${tt("À jour")} · ${esc(ndfSync.when.toLocaleTimeString(appLocale(), { hour: "2-digit", minute: "2-digit" }))}</span>`;
  return `<span>${tt("Mise à jour automatique à chaque changement.")}</span>`;
}
function ndfCardHTML(year) {
  const root = esc(settings.ndfFolder || tt("Notes de frais"));
  return `<div class="card"><h2>Dossier « Notes de frais »<small>Excel</small></h2>
    <p class="hint" style="margin-top:0">${ndfCanSync() ? `<span>Dans ton ${esc(store.label)}, les tickets sont rangés dans</span> <b>Bourselle › ${root} › ${year} › ${year}-MM</b><span>, nommés par date (année-mois-jour). Le classeur</span> <b>${root} ${year}.xlsx</b> <span>contient un onglet par mois : une ligne par dépense avec HT, TVA, TTC, statut et lien du ticket, et les totaux.</span>` : `<span>Le classeur contient un onglet par mois : une ligne par dépense avec HT, TVA, TTC et statut, et les totaux.</span>`}</p>
    <p class="hint" id="ndfDriveState" style="margin:0 0 10px">${ndfStateHTML()}</p>
    <div class="acts"><button class="btn primary" id="ndfXlsx">Télécharger l'Excel ${year}</button>${ndfCanSync() ? `<button class="btn" id="ndfOpen">Ouvrir le dossier</button>` : ""}<button class="btn" id="ndfCsv">CSV</button></div></div>`;
}
function ndfBind(year) {
  const x = document.getElementById("ndfXlsx"); if (x) x.onclick = () => ndfDownload(year);
  const o = document.getElementById("ndfOpen");
  if (o) o.onclick = async () => {
    const w = window.open("", "_blank");
    try { const u = await store.folderLink([ndfRoot()]); if (w) w.location = u; else location.href = u; }
    catch (e) { if (w) w.close(); toast(tt("Dossier indisponible pour l'instant")); }
  };
  if (ndfCanSync()) ndfSyncSoon();
}
