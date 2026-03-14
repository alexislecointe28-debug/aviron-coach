export const config = { runtime: "edge" };

// Couleurs par type de séance
const TYPE_COLORS = {
  MUSCU: "#7c3aed", ERGO: "#0ea5e9", BATEAU: "#06b6d4", PLIO: "#f59e0b",
  RECUP: "#10b981", REPOS: "#475569", TEST: "#3b82f6", COMPETITION: "#ef4444",
};
const TYPE_LABELS = {
  MUSCU:"MUS", ERGO:"ERG", BATEAU:"BAT", PLIO:"PLI",
  RECUP:"REC", REPOS:"REP", TEST:"TES", COMPETITION:"COM",
};
const CHARGE_COLORS = {
  "Légère":"#4ade80","Modérée":"#0ea5e9","Élevée":"#f59e0b","Maximale":"#ef4444","Compétition":"#ef4444"
};
const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { semaines, titre } = await req.json();
  // semaines: [{num, type, charge, date, seances: {Lundi:[{type,titre,duree,blocs:[{titre,detail}]}]}}]

  const html = buildHTML(semaines, titre || "AvironCoach — Planning");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function buildHTML(semaines, titre) {
  const semHtml = semaines.map(sem => {
    const chargeColor = CHARGE_COLORS[sem.charge] || "#64748b";
    const maxRows = Math.max(1, ...JOURS.map(j => (sem.seances?.[j]?.length || 0)));

    const jourCols = JOURS.map(j => {
      const seances = sem.seances?.[j] || [];
      return `<td class="day-cell">
        ${seances.map(s => {
          const col = TYPE_COLORS[s.type_seance] || "#64748b";
          const lbl = TYPE_LABELS[s.type_seance] || s.type_seance;
          const blocs = (s.contenu?.blocs || []).map(b => `${b.titre}${b.detail ? ` — ${b.detail}` : ""}`).join(" · ");
          return `<div class="seance-card" style="border-left:3px solid ${col}">
            <div class="seance-header" style="color:${col}">[${lbl}] <b>${s.titre}</b>${s.contenu?.duree_min ? ` <span class="duree">${s.contenu.duree_min}'</span>` : ""}</div>
            ${blocs ? `<div class="seance-blocs">${blocs}</div>` : ""}
          </div>`;
        }).join("")}
      </td>`;
    }).join("");

    return `
      <div class="semaine">
        <table class="week-table">
          <colgroup>
            <col class="col-label">
            ${JOURS.map(() => '<col class="col-day">').join("")}
          </colgroup>
          <thead>
            <tr>
              <th class="week-header">
                <div class="week-num">S${sem.num}</div>
                <div class="week-type">${sem.type_semaine || ""}</div>
                <div class="week-charge" style="color:${chargeColor}">${sem.charge || ""}</div>
                ${sem.date_debut ? `<div class="week-date">${sem.date_debut}</div>` : ""}
              </th>
              ${JOURS.map(j => `<th class="day-header">${j.slice(0,3)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>${jourCols}</tr>
          </tbody>
        </table>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${titre}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; background: white; }

  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
    .semaine { page-break-inside: avoid; }
    @page { size: A4 landscape; margin: 8mm; }
  }

  .header { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #0f172a; color: white; margin-bottom: 6px; }
  .header h1 { font-size: 13px; color: #0ea5e9; }
  .header .meta { font-size: 9px; color: #64748b; }

  .no-print { padding: 8px; background: #f1f5f9; display: flex; gap: 8px; margin-bottom: 6px; }
  .btn { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; }
  .btn-print { background: #0ea5e9; color: white; }

  .semaine { margin-bottom: 5mm; }
  .week-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .col-label { width: 18mm; }
  .col-day { width: calc((100% - 18mm) / 7); }

  .week-header { background: #1e293b; color: white; text-align: center; padding: 4px 3px; vertical-align: middle; }
  .week-num { font-size: 11px; font-weight: bold; color: #f1f5f9; }
  .week-type { font-size: 7px; color: #94a3b8; margin-top: 1px; }
  .week-charge { font-size: 8px; font-weight: bold; margin-top: 1px; }
  .week-date { font-size: 7px; color: #64748b; margin-top: 1px; }

  .day-header { background: #0f172a; color: #94a3b8; text-align: center; font-size: 8px; font-weight: bold; padding: 3px 2px; border: 1px solid #1e293b; }
  .day-cell { vertical-align: top; padding: 2px; border: 1px solid #e2e8f0; background: #fafafa; min-height: 12mm; }

  .seance-card { padding: 2px 3px; margin-bottom: 2px; border-radius: 2px; background: white; }
  .seance-header { font-size: 8px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .seance-blocs { font-size: 7px; color: #64748b; margin-top: 1px; line-height: 1.3; }
  .duree { font-size: 7px; color: #94a3b8; font-weight: normal; }

  .legend { display: flex; gap: 8px; flex-wrap: wrap; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 4mm; }
  .legend-item { font-size: 8px; display: flex; align-items: center; gap: 3px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
</style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer / Exporter PDF</button>
  </div>
  <div class="header">
    <h1>${titre}</h1>
    <div class="meta">Export ${new Date().toLocaleDateString("fr-FR")}</div>
  </div>

  ${semHtml}

  <div class="legend">
    ${Object.entries(TYPE_COLORS).map(([k,c]) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${c}"></div>
        <b>${TYPE_LABELS[k]}</b> ${k.charAt(0)+k.slice(1).toLowerCase().replace("u","u").replace("ergo","Ergo")}
      </div>`).join("")}
  </div>
</body>
</html>`;
}
