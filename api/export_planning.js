export const config = { runtime: "edge" };

const TYPE_COLOR = {
  MUSCU:"#6d28d9", ERGO:"#0369a1", BATEAU:"#0e7490", PLIO:"#b45309",
  RECUP:"#047857", REPOS:"#94a3b8", TEST:"#1d4ed8", COMPETITION:"#b91c1c",
};
const TYPE_LABEL = {
  MUSCU:"MUSCU", ERGO:"ERGO", BATEAU:"BATEAU", PLIO:"PLIO",
  RECUP:"RÉCUP", REPOS:"REPOS", TEST:"TEST", COMPETITION:"COMPÉT",
};
const CHARGE_STYLE = {
  "Légère":    {bg:"#f0fdf4",fg:"#166534",bar:"#22c55e"},
  "Modérée":   {bg:"#eff6ff",fg:"#1e40af",bar:"#3b82f6"},
  "Élevée":    {bg:"#fefce8",fg:"#92400e",bar:"#f59e0b"},
  "Maximale":  {bg:"#fef2f2",fg:"#991b1b",bar:"#ef4444"},
  "Compétition":{bg:"#fdf4ff",fg:"#6b21a8",bar:"#a855f7"},
};
const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const JOURS_SHORT = ["LUN","MAR","MER","JEU","VEN","SAM","DIM"];

function parseContenu(s) {
  if (!s.contenu) return { blocs:[], duree_min:0 };
  if (typeof s.contenu === "string") {
    try { return JSON.parse(s.contenu); } catch { return { blocs:[], duree_min:0 }; }
  }
  return s.contenu;
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed",{status:405});
  const { semaines, titre } = await req.json();
  return new Response(buildHTML(semaines, titre||"Planning AvironCoach"), {
    headers:{"Content-Type":"text/html; charset=utf-8"},
  });
}

function buildHTML(semaines, titre) {
  const pages = semaines.map(sem => buildPage(sem)).join('<div class="pb"></div>');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${titre}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',sans-serif;background:#cbd5e1;padding:0}
.toolbar{position:fixed;top:0;left:0;right:0;background:#0f172a;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:100}
.toolbar h1{color:#38bdf8;font-size:13px;font-weight:700;letter-spacing:-.2px}
.btn{background:#38bdf8;color:#0f172a;border:none;border-radius:6px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.wrap{padding:52px 16px 16px}
.page{width:210mm;min-height:297mm;background:#fff;margin:0 auto 16px;box-shadow:0 8px 40px #0003;display:flex;flex-direction:column;font-size:8.5px}
.pb{page-break-after:always}

/* Header */
.ph{display:flex;align-items:stretch;border-bottom:3px solid #0f172a}
.ph-left{background:#0f172a;color:#fff;padding:18px 20px;min-width:56mm;display:flex;flex-direction:column;justify-content:space-between}
.ph-semnum{font-size:42px;font-weight:900;line-height:1;color:#f8fafc;letter-spacing:-2px}
.ph-semnum span{font-size:13px;font-weight:500;color:#64748b;letter-spacing:0;vertical-align:super}
.ph-type{font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-top:4px}
.ph-date{font-size:8px;color:#475569;margin-top:2px}
.ph-right{flex:1;padding:16px 20px;display:flex;flex-direction:column;justify-content:space-between;background:#f8fafc}
.ph-title{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.5px;line-height:1.1}
.ph-sub{font-size:9px;color:#64748b;margin-top:3px}
.ph-bottom{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.charge-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:8.5px;font-weight:700;border:1.5px solid}
.charge-bar{height:4px;border-radius:2px;margin-top:6px;width:100%}
.ph-objectif{font-size:8px;color:#475569;font-style:italic}

/* Grille jours */
.grid{display:grid;grid-template-columns:repeat(7,1fr);flex:1;border-bottom:1px solid #e2e8f0}

.day{display:flex;flex-direction:column;border-right:1px solid #e2e8f0}
.day:last-child{border-right:none}

.day-head{padding:6px 0 5px;text-align:center;border-bottom:2px solid #e2e8f0;background:#f8fafc}
.day-name{font-size:7px;font-weight:800;letter-spacing:2px;color:#94a3b8}

.day-body{padding:5px 4px;display:flex;flex-direction:column;gap:4px;flex:1}
.day-rest{display:flex;align-items:center;justify-content:center;flex:1;color:#e2e8f0;font-size:10px}

/* Carte séance */
.card{border-radius:6px;overflow:hidden;border:1px solid}
.card-top{padding:4px 6px 3px;display:flex;align-items:center;justify-content:space-between}
.card-badge{font-size:6.5px;font-weight:800;letter-spacing:.8px}
.card-dur{font-size:6.5px;font-weight:500;font-family:'JetBrains Mono',monospace;opacity:.7}
.card-title{padding:2px 6px 4px;font-size:9px;font-weight:700;color:#0f172a;line-height:1.3}
.card-sep{height:1px;margin:0 6px;opacity:.3}
.card-blocs{padding:4px 6px 5px;display:flex;flex-direction:column;gap:2.5px}
.bloc{display:flex;gap:3px;align-items:flex-start}
.bloc-dot{width:4px;height:4px;border-radius:50%;flex-shrink:0;margin-top:2.5px}
.bloc-text{font-size:7.5px;color:#1e293b;line-height:1.35;font-weight:500}
.bloc-detail{font-size:7px;color:#64748b;font-family:'JetBrains Mono',monospace;margin-left:1px}
.more{font-size:6.5px;color:#94a3b8;font-style:italic;padding:0 6px 4px}

/* Footer */
.pf{padding:7px 18px;border-top:2px solid #0f172a;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;flex-shrink:0}
.legend{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.leg-item{display:flex;align-items:center;gap:3px;font-size:7px;color:#64748b;font-weight:600}
.leg-sq{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.pf-right{font-size:7px;color:#94a3b8}

@media print{
  body{background:#fff}
  .toolbar{display:none!important}
  .wrap{padding:0}
  .page{margin:0;box-shadow:none;min-height:297mm;height:297mm}
  .pb{page-break-after:always}
  @page{size:A4 portrait;margin:0}
}
</style>
</head>
<body>
<div class="toolbar"><h1>AvironCoach — Export Planning</h1><button class="btn" onclick="window.print()">🖨 Imprimer / PDF</button></div>
<div class="wrap">${pages}</div>
</body></html>`;
}

function buildPage(sem) {
  const charge = sem.charge || "";
  const cs = CHARGE_STYLE[charge] || {bg:"#f8fafc",fg:"#475569",bar:"#94a3b8"};

  // Types présents
  const typesPresents = [...new Set(JOURS.flatMap(j=>(sem.seances?.[j]||[]).map(s=>s.type_seance)).filter(Boolean))];

  // Colonnes
  const cols = JOURS.map((jour,ji) => {
    const ss = sem.seances?.[jour] || [];
    const head = `<div class="day-head"><div class="day-name">${JOURS_SHORT[ji]}</div></div>`;
    if (!ss.length) return `<div class="day">${head}<div class="day-body"><div class="day-rest">—</div></div></div>`;

    const cards = ss.map(s => {
      const c = parseContenu(s);
      const col = TYPE_COLOR[s.type_seance] || "#64748b";
      const lbl = TYPE_LABEL[s.type_seance] || s.type_seance;
      const blocs = c.blocs || [];
      const dur = c.duree_min ? `${c.duree_min}'` : "";
      const topBg = col + "18";
      const borderCol = col + "40";

      const blocsHtml = blocs.slice(0,6).map(b =>
        `<div class="bloc">
          <div class="bloc-dot" style="background:${col}"></div>
          <div><span class="bloc-text">${b.titre}</span>${b.detail?`<span class="bloc-detail"> ${b.detail}</span>`:""}</div>
        </div>`
      ).join("");

      const more = blocs.length > 6 ? `<div class="more">+${blocs.length-6} blocs</div>` : "";

      return `<div class="card" style="border-color:${borderCol}">
        <div class="card-top" style="background:${topBg}">
          <span class="card-badge" style="color:${col}">${lbl}</span>
          ${dur?`<span class="card-dur" style="color:${col}">${dur}</span>`:""}
        </div>
        <div class="card-title">${s.titre}</div>
        ${blocs.length?`<div class="card-sep" style="background:${col}"></div><div class="card-blocs">${blocsHtml}${more}</div>`:""}
      </div>`;
    }).join("");

    return `<div class="day">${head}<div class="day-body">${cards}</div></div>`;
  }).join("");

  const legend = typesPresents.map(t=>
    `<div class="leg-item"><div class="leg-sq" style="background:${TYPE_COLOR[t]||'#94a3b8'}"></div>${TYPE_LABEL[t]||t}</div>`
  ).join("");

  const chargeW = {Légère:20,Modérée:45,Élevée:70,Maximale:90,Compétition:100}[charge]||50;

  return `<div class="page">
  <div class="ph">
    <div class="ph-left">
      <div>
        <div class="ph-semnum"><span>S</span>${sem.num_semaine||sem.num||"—"}</div>
        <div class="ph-type">${sem.type_semaine||""}</div>
        ${sem.date_debut?`<div class="ph-date">Sem. du ${sem.date_debut}</div>`:""}
      </div>
      ${charge?`<div>
        <div class="charge-bar" style="background:#1e293b">
          <div style="height:4px;border-radius:2px;width:${chargeW}%;background:${cs.bar}"></div>
        </div>
        <div style="font-size:7.5px;color:${cs.bar};font-weight:700;margin-top:3px">${charge}</div>
      </div>`:""}
    </div>
    <div class="ph-right">
      <div>
        <div class="ph-title">Planning d'entraînement</div>
        <div class="ph-sub">Semaine ${sem.num_semaine||sem.num||""} ${sem.type_semaine?`· ${sem.type_semaine}`:""}</div>
      </div>
      ${sem.objectif?`<div class="ph-objectif">🎯 ${sem.objectif}</div>`:"<div></div>"}
    </div>
  </div>

  <div class="grid">${cols}</div>

  <div class="pf">
    <div class="legend">${legend}</div>
    <div class="pf-right">AvironCoach · Exporté le ${new Date().toLocaleDateString("fr-FR")}</div>
  </div>
</div>`;
}
