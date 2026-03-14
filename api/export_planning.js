export const config = { runtime: "edge" };

const TYPE_COLORS = {
  MUSCU:"#7c3aed", ERGO:"#0284c7", BATEAU:"#0891b2", PLIO:"#d97706",
  RECUP:"#059669", REPOS:"#94a3b8", TEST:"#2563eb", COMPETITION:"#dc2626",
};
const TYPE_LABELS = {
  MUSCU:"Muscu", ERGO:"Ergo", BATEAU:"Bateau", PLIO:"Plio",
  RECUP:"Récup", REPOS:"Repos", TEST:"Test", COMPETITION:"Compét",
};
const TYPE_BG = {
  MUSCU:"#f5f3ff", ERGO:"#eff6ff", BATEAU:"#ecfeff", PLIO:"#fffbeb",
  RECUP:"#f0fdf4", REPOS:"#f8fafc", TEST:"#eff6ff", COMPETITION:"#fff1f2",
};
const CHARGE_STYLES = {
  "Légère":    { bg:"#dcfce7", text:"#15803d", dot:"#22c55e" },
  "Modérée":   { bg:"#dbeafe", text:"#1d4ed8", dot:"#3b82f6" },
  "Élevée":    { bg:"#fef3c7", text:"#b45309", dot:"#f59e0b" },
  "Maximale":  { bg:"#fee2e2", text:"#b91c1c", dot:"#ef4444" },
  "Compétition":{ bg:"#fce7f3", text:"#9d174d", dot:"#ec4899" },
};
const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const JOURS_SHORT = ["LUN","MAR","MER","JEU","VEN","SAM","DIM"];

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed",{status:405});
  const { semaines, titre } = await req.json();
  return new Response(buildHTML(semaines, titre||"Planning AvironCoach"), {
    headers:{"Content-Type":"text/html; charset=utf-8"},
  });
}

function buildHTML(semaines, titre) {
  const pages = semaines.map(sem => buildPage(sem)).join('<div class="page-break"></div>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${titre}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
* { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

:root {
  --ink: #0f172a;
  --ink-2: #334155;
  --ink-3: #64748b;
  --ink-4: #94a3b8;
  --line: #e2e8f0;
  --bg: #ffffff;
  --bg-2: #f8fafc;
  --radius: 10px;
  --font: 'DM Sans', sans-serif;
  --mono: 'DM Mono', monospace;
}

body {
  font-family: var(--font);
  color: var(--ink);
  background: #e5e7eb;
  padding: 0;
}

/* ── Toolbar ── */
.toolbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  background: #0f172a;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
  box-shadow: 0 2px 12px #00000040;
}
.toolbar-title { color: #38bdf8; font-size: 14px; font-weight: 700; letter-spacing: -0.3px; }
.btn-print {
  background: #38bdf8; color: #0f172a; border: none;
  border-radius: 7px; padding: 7px 18px; font-size: 12px;
  font-weight: 700; cursor: pointer; font-family: var(--font);
  letter-spacing: 0.2px;
}
.btn-print:hover { background: #7dd3fc; }

/* ── Pages ── */
.pages-wrapper { padding: 56px 20px 20px; }

.page {
  width: 210mm;
  min-height: 297mm;
  background: var(--bg);
  margin: 0 auto 20px;
  box-shadow: 0 4px 32px #00000020;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header page ── */
.page-header {
  background: var(--ink);
  padding: 20px 24px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.header-left {}
.page-club {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #38bdf8;
  margin-bottom: 4px;
}
.page-title {
  font-size: 22px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.5px;
  line-height: 1;
}
.page-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
  font-weight: 400;
}
.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.sem-badge {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px 12px;
  text-align: center;
}
.sem-num { font-size: 20px; font-weight: 900; color: #f1f5f9; line-height: 1; font-variant-numeric: tabular-nums; }
.sem-label { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }
.charge-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
}
.charge-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.sem-info { font-size: 10px; color: #475569; text-align: right; }
.sem-objectif { font-size: 9px; color: #64748b; font-style: italic; margin-top: 2px; text-align: right; }

/* ── Grille jours ── */
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex: 1;
  border-top: 1px solid var(--line);
}

/* Colonne jour */
.day-col {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  min-height: 0;
}
.day-col:last-child { border-right: none; }

/* Header jour */
.day-header {
  padding: 8px 6px 7px;
  text-align: center;
  border-bottom: 2px solid var(--line);
  background: var(--bg-2);
  flex-shrink: 0;
}
.day-name {
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--ink-3);
}
.day-rest {
  font-size: 8px;
  color: var(--ink-4);
  padding: 10px 6px;
  text-align: center;
  font-style: italic;
}

/* Contenu du jour */
.day-body {
  padding: 6px 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

/* Carte séance */
.session-card {
  border-radius: 7px;
  overflow: hidden;
  border: 1.5px solid;
}
.card-header {
  padding: 5px 7px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.card-type {
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.card-duree {
  font-size: 7px;
  font-weight: 500;
  opacity: 0.65;
  font-family: var(--mono);
  flex-shrink: 0;
}
.card-title {
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.25;
  padding: 0 7px 5px;
  color: var(--ink);
}
.card-blocs {
  padding: 0 7px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bloc-row {
  display: flex;
  gap: 4px;
  align-items: baseline;
}
.bloc-bullet {
  font-size: 6px;
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.5;
}
.bloc-name {
  font-size: 7.5px;
  font-weight: 600;
  color: var(--ink-2);
  line-height: 1.3;
}
.bloc-detail {
  font-size: 7px;
  color: var(--ink-3);
  font-family: var(--mono);
  line-height: 1.3;
  margin-left: 2px;
}
.blocs-more {
  font-size: 6.5px;
  color: var(--ink-4);
  font-style: italic;
  padding: 0 7px 5px;
}

/* ── Footer ── */
.page-footer {
  padding: 8px 24px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-2);
  flex-shrink: 0;
}
.footer-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 7px;
  color: var(--ink-3);
  font-weight: 500;
}
.legend-dot {
  width: 7px; height: 7px;
  border-radius: 2px;
  flex-shrink: 0;
}
.footer-right {
  font-size: 7px;
  color: var(--ink-4);
  font-style: italic;
}

/* ── Print ── */
@media print {
  body { background: white; }
  .toolbar { display: none !important; }
  .pages-wrapper { padding: 0; }
  .page { margin: 0; box-shadow: none; min-height: 297mm; height: 297mm; }
  .page-break { page-break-after: always; }
  @page { size: A4 portrait; margin: 0; }
}

.page-break { display: block; }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">AvironCoach — Export Planning</span>
    <button class="btn-print" onclick="window.print()">🖨 Imprimer / PDF</button>
  </div>
  <div class="pages-wrapper">
    ${pages}
  </div>
</body>
</html>`;
}

function buildPage(sem) {
  const charge = sem.charge || "";
  const cs = CHARGE_STYLES[charge] || { bg:"#f1f5f9", text:"#475569", dot:"#94a3b8" };

  // Colonnes jours
  const dayCols = JOURS.map((jour, ji) => {
    const short = JOURS_SHORT[ji];
    const seances = sem.seances?.[jour] || [];

    if (!seances.length) {
      return `<div class="day-col">
        <div class="day-header"><div class="day-name">${short}</div></div>
        <div class="day-rest">—</div>
      </div>`;
    }

    const cards = seances.map(s => {
      const col  = TYPE_COLORS[s.type_seance] || "#64748b";
      const bg   = TYPE_BG[s.type_seance]   || "#f8fafc";
      const lbl  = TYPE_LABELS[s.type_seance] || s.type_seance;
      const blocs = s.contenu?.blocs || [];
      const duree = s.contenu?.duree_min ? `${s.contenu.duree_min}'` : "";

      const blocsHtml = blocs.slice(0,5).map(b => `
        <div class="bloc-row">
          <span class="bloc-bullet" style="color:${col}">▸</span>
          <span class="bloc-name">${b.titre}</span>
          ${b.detail ? `<span class="bloc-detail">${b.detail}</span>` : ""}
        </div>`).join("");

      const moreHtml = blocs.length > 5
        ? `<div class="blocs-more">+${blocs.length-5} blocs</div>` : "";

      return `<div class="session-card" style="border-color:${col}30;background:${bg}">
        <div class="card-header" style="background:${col}15">
          <span class="card-type" style="color:${col}">${lbl}</span>
          ${duree ? `<span class="card-duree" style="color:${col}">${duree}</span>` : ""}
        </div>
        <div class="card-title">${s.titre}</div>
        ${blocsHtml ? `<div class="card-blocs">${blocsHtml}${moreHtml}</div>` : ""}
      </div>`;
    }).join("");

    return `<div class="day-col">
      <div class="day-header"><div class="day-name">${short}</div></div>
      <div class="day-body">${cards}</div>
    </div>`;
  }).join("");

  // Legend
  const typesPresents = [...new Set(
    JOURS.flatMap(j => (sem.seances?.[j]||[]).map(s=>s.type_seance)).filter(Boolean)
  )];
  const legendHtml = typesPresents.map(t => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${TYPE_COLORS[t]||'#94a3b8'}"></div>
      ${TYPE_LABELS[t]||t}
    </div>`).join("");

  return `<div class="page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <div class="page-club">AvironCoach</div>
        <div class="page-title">Semaine ${sem.num_semaine||sem.num||"—"}</div>
        <div class="page-sub">
          ${sem.type_semaine ? `${sem.type_semaine}` : ""}
          ${sem.date_debut ? ` · À partir du ${sem.date_debut}` : ""}
        </div>
      </div>
      <div class="header-right">
        ${charge ? `<div class="charge-badge" style="background:${cs.bg};color:${cs.text}">
          <div class="charge-dot" style="background:${cs.dot}"></div>
          Charge ${charge}
        </div>` : ""}
        ${sem.objectif ? `<div class="sem-objectif">${sem.objectif}</div>` : ""}
      </div>
    </div>

    <!-- Grille -->
    <div class="days-grid">${dayCols}</div>

    <!-- Footer -->
    <div class="page-footer">
      <div class="footer-legend">${legendHtml}</div>
      <div class="footer-right">Exporté le ${new Date().toLocaleDateString("fr-FR")}</div>
    </div>
  </div>`;
}
