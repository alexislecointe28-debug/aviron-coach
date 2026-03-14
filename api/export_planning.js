export const config = { runtime: "edge" };

const TYPE_COLORS = {
  MUSCU:"#7c3aed", ERGO:"#0ea5e9", BATEAU:"#06b6d4", PLIO:"#f59e0b",
  RECUP:"#10b981", REPOS:"#94a3b8", TEST:"#3b82f6", COMPETITION:"#ef4444",
};
const CHARGE_BG = {
  "Légère":"#dcfce7","Modérée":"#dbeafe","Élevée":"#fef3c7",
  "Maximale":"#fee2e2","Compétition":"#fce7f3",
};
const CHARGE_TEXT = {
  "Légère":"#16a34a","Modérée":"#1d4ed8","Élevée":"#d97706",
  "Maximale":"#dc2626","Compétition":"#9333ea",
};
const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const JOURS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed",{status:405});
  const { semaines, titre } = await req.json();
  return new Response(buildHTML(semaines, titre||"Planning AvironCoach"), {
    headers:{"Content-Type":"text/html; charset=utf-8"},
  });
}

function buildHTML(semaines, titre) {
  const semHtml = semaines.map(sem => {
    const charge = sem.charge || "";
    const chargeBg   = CHARGE_BG[charge]   || "#f1f5f9";
    const chargeText = CHARGE_TEXT[charge] || "#475569";

    const jourCells = JOURS.map((jour, ji) => {
      const seances = sem.seances?.[jour] || [];
      if (!seances.length) return `<td class="cell cell-empty"></td>`;

      const cards = seances.map(s => {
        const col = TYPE_COLORS[s.type_seance] || "#64748b";
        const blocs = (s.contenu?.blocs || [])
          .map(b => `<span class="bloc">${b.titre}${b.detail ? ` <em>${b.detail}</em>` : ""}</span>`)
          .join("");
        const duree = s.contenu?.duree_min ? `<span class="duree">${s.contenu.duree_min}'</span>` : "";
        return `<div class="card" style="--c:${col}">
          <div class="card-top">
            <div class="card-title">${s.titre}</div>
            ${duree}
          </div>
          ${blocs ? `<div class="card-blocs">${blocs}</div>` : ""}
        </div>`;
      }).join("");

      return `<td class="cell">${cards}</td>`;
    }).join("");

    return `
      <div class="semaine">
        <table>
          <thead>
            <tr>
              <th class="th-sem">
                <div class="sem-num">S${sem.num_semaine||sem.num}</div>
                ${sem.date_debut ? `<div class="sem-date">${sem.date_debut}</div>` : ""}
                ${sem.type_semaine ? `<div class="sem-type">${sem.type_semaine}</div>` : ""}
                ${charge ? `<div class="sem-charge" style="background:${chargeBg};color:${chargeText}">${charge}</div>` : ""}
              </th>
              ${JOURS_SHORT.map(j => `<th class="th-day">${j}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>${jourCells}</tr>
          </tbody>
        </table>
        ${sem.objectif ? `<div class="sem-objectif">🎯 ${sem.objectif}</div>` : ""}
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${titre}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }

body {
  font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 10px;
  color: #1e293b;
  background: #fff;
  padding: 0;
}

/* ── Barre d'impression ── */
.toolbar {
  background: #0f172a;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.toolbar h1 { color: #0ea5e9; font-size: 14px; font-weight: 700; }
.btn-print {
  background: #0ea5e9; color: white; border: none;
  border-radius: 6px; padding: 6px 16px; font-size: 12px;
  font-weight: 700; cursor: pointer; letter-spacing: 0.3px;
}
.btn-print:hover { background: #0284c7; }

/* ── Contenu ── */
.content { padding: 6mm; }

/* ── Semaine ── */
.semaine { margin-bottom: 5mm; }

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

/* En-tête colonne semaine */
.th-sem {
  width: 18mm;
  background: #0f172a;
  color: white;
  vertical-align: middle;
  text-align: center;
  padding: 5px 3px;
  border-radius: 6px 0 0 0;
}
.sem-num { font-size: 14px; font-weight: 900; color: #f8fafc; letter-spacing: -0.5px; }
.sem-date { font-size: 7px; color: #64748b; margin-top: 2px; }
.sem-type { font-size: 7px; color: #94a3b8; margin-top: 1px; text-transform: uppercase; letter-spacing: 0.5px; }
.sem-charge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 7px;
  font-weight: 700;
}

/* En-têtes jours */
.th-day {
  background: #f8fafc;
  color: #64748b;
  font-size: 8px;
  font-weight: 700;
  text-align: center;
  padding: 4px 2px;
  border: 1px solid #e2e8f0;
  border-left: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Cellules */
.cell {
  vertical-align: top;
  padding: 3px;
  border: 1px solid #e2e8f0;
  border-top: none;
  min-height: 14mm;
}
.cell-empty {
  background: #fafafa;
}

/* Carte séance */
.card {
  border-left: 3px solid var(--c);
  background: color-mix(in srgb, var(--c) 6%, white);
  border-radius: 0 4px 4px 0;
  padding: 3px 4px;
  margin-bottom: 3px;
}
.card:last-child { margin-bottom: 0; }

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;
}
.card-title {
  font-size: 8.5px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.duree {
  font-size: 7px;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-blocs {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.bloc {
  font-size: 7px;
  color: #475569;
  line-height: 1.4;
  display: block;
}
.bloc em {
  color: #94a3b8;
  font-style: normal;
}

/* Objectif semaine */
.sem-objectif {
  font-size: 8px;
  color: #64748b;
  padding: 3px 6px;
  background: #f8fafc;
  border-left: 3px solid #e2e8f0;
  margin-top: 2px;
  border-radius: 0 3px 3px 0;
}

/* ── Impression ── */
@media print {
  .toolbar { display: none !important; }
  body { padding: 0; }
  .content { padding: 5mm; }
  .semaine { page-break-inside: avoid; }
  @page { size: A4 landscape; margin: 5mm; }
}
</style>
</head>
<body>
  <div class="toolbar">
    <h1>${titre}</h1>
    <button class="btn-print" onclick="window.print()">🖨 Imprimer / Sauver en PDF</button>
  </div>
  <div class="content">
    ${semHtml}
  </div>
</body>
</html>`;
}
