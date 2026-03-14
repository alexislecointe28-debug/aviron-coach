import { useState, useEffect, useRef } from "react";
import { S } from "../styles.js";
import { api } from "../config/supabase.js";

// ---- Constantes ----
const CHARGE_COLORS = {
  "Légère":    { bg:"#4ade8020", border:"#4ade8050", text:"#4ade80" },
  "Modérée":   { bg:"#f59e0b20", border:"#f59e0b50", text:"#f59e0b" },
  "Élevée":    { bg:"#f9731620", border:"#f9731650", text:"#f97316" },
  "Maximale":  { bg:"#ef444420", border:"#ef444450", text:"#ef4444" },
  "Compétition":{ bg:"#a78bfa20",border:"#a78bfa50", text:"#a78bfa" },
};
const TYPE_SEMAINE_COLORS = {
  "TRANSITION":    "#64748b",
  "CONSTRUCTION":  "#0ea5e9",
  "DÉCHARGE":      "#4ade80",
  "SURCOMPENSATION":"#22d3ee",
  "CHARGE 1":      "#f97316",
  "CHARGE 2":      "#ef4444",
  "SPÉCIFIQUE 500m":"#a78bfa",
  "AFFÛTAGE SPRINT":"#f59e0b",
  "AFFÛTAGE 1000m": "#f59e0b",
  "COMPÉTITION":   "#e879f9",
  "RECONSTRUCTION":"#38bdf8",
};
const TYPES_SEMAINE = ["TRANSITION","CONSTRUCTION","DÉCHARGE","SURCOMPENSATION","CHARGE 1","CHARGE 2","SPÉCIFIQUE 500m","AFFÛTAGE SPRINT","AFFÛTAGE 1000m","COMPÉTITION","RECONSTRUCTION"];
const CHARGES = ["Légère","Modérée","Élevée","Maximale","Compétition"];
const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const TYPE_SEANCE_COLORS = {
  MUSCU:"#f97316", ERGO:"#0ea5e9", BATEAU:"#22d3ee", PLIO:"#fbbf24",
  RECUP:"#4ade80", REPOS:"#64748b", TEST:"#a78bfa", COMPETITION:"#e879f9",
};
const TYPE_SEANCE_LABELS = {
  MUSCU:"💪 Muscu", ERGO:"🚣 Ergo", BATEAU:"⛵ Bateau", PLIO:"⚡ Plio",
  RECUP:"🔄 Récup", REPOS:"😴 Repos", TEST:"📊 Test", COMPETITION:"🏆 Compét",
};

function chargeBadge(charge, isMobile) {
  const c = CHARGE_COLORS[charge] || { bg:"#33415520", border:"#33415550", text:"#94a3b8" };
  return <span style={{background:c.bg,border:`1px solid ${c.border}`,color:c.text,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{charge}</span>;
}

function typeBadge(type) {
  const col = TYPE_SEMAINE_COLORS[type] || "#64748b";
  return <span style={{background:col+"20",border:`1px solid ${col}50`,color:col,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{type}</span>;
}

function FF({ label, children }) {
  return <div style={{marginBottom:12}}><label style={{display:"block",color:"#7a95b0",fontSize:11,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{label}</label>{children}</div>;
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,width:wide?700:460,maxWidth:"95vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:0}}>{title}</h2>
          <button style={{background:"none",border:"none",color:"#7a95b0",cursor:"pointer",fontSize:20}} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PlanningSpace({ athletes, isMobile, currentUser }) {
  const [view, setView]           = useState("plans");   // plans | timeline | semaine | templates
  const [plans, setPlans]         = useState([]);
  const [selPlan, setSelPlan]     = useState(null);
  const [weeks, setWeeks]         = useState([]);
  const [selWeek, setSelWeek]     = useState(null);
  const [sessions, setSessions]   = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);

  // Modals
  const [showPlanModal,      setShowPlanModal]      = useState(false);
  const [showWeekModal,      setShowWeekModal]      = useState(false);
  const [showSessionModal,   setShowSessionModal]   = useState(false);
  const [showTplModal,       setShowTplModal]       = useState(false);
  const [exercises,          setExercises]          = useState([]);
  const [favTpls,            setFavTpls]            = useState(()=>{
    try { return JSON.parse(localStorage.getItem("fav_templates")||"[]"); } catch { return []; }
  });

  function toggleFavTpl(id) {
    setFavTpls(prev => {
      const next = prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id];
      localStorage.setItem("fav_templates", JSON.stringify(next));
      return next;
    });
  }
  const [showAthletesModal,  setShowAthletesModal]  = useState(false);
  const [editPlan,           setEditPlan]           = useState(null);
  const [editWeek,           setEditWeek]           = useState(null);
  const [editSession,        setEditSession]        = useState(null);
  const [editTpl,            setEditTpl]            = useState(null);
  const [overrides,          setOverrides]          = useState([]);

  const CATEGORIES = [...new Set(athletes.map(a=>a.category).filter(Boolean))].sort();

  // ---- Load ----
  useEffect(()=>{
    loadAll();
  },[]);

  async function loadAll() {
    setLoading(true);
    try {
      const [pl, tpl, exos] = await Promise.all([
        api.getSeasonPlans(),
        api.getSessionTemplates(),
        api.getExercises().catch(()=>[]),
      ]);
      setPlans(pl||[]);
      setTemplates(tpl||[]);
      setExercises(exos||[]);
    } catch(e) { showToast("Erreur chargement","error"); }
    setLoading(false);
  }

  async function loadWeeks(planId) {
    try {
      const w = await api.getPlanWeeks(planId);
      setWeeks(w||[]);
    } catch(e) {}
  }

  async function loadSessions(weekId) {
    try {
      const s = await api.getPlannedSessions(weekId);
      setSessions(s||[]);
    } catch(e) {}
  }

  async function loadOverrides(planId) {
    try {
      const o = await api.getPlanOverrides(planId);
      setOverrides(o||[]);
    } catch(e) {}
  }

  function showToast(m, t="success") {
    setToast({m,t});
    setTimeout(()=>setToast(null),2500);
  }

  // ---- Plan CRUD ----
  async function savePlan(data) {
    try {
      if(data.id) {
        await api.updateSeasonPlan(data.id, data);
        setPlans(pl=>pl.map(p=>p.id===data.id?{...p,...data}:p));
      } else {
        const res = await api.createSeasonPlan(data);
        if(res&&res[0]) setPlans(pl=>[...pl,res[0]]);
      }
      showToast(data.id?"Plan modifié":"Plan créé");
      setShowPlanModal(false);
    } catch(e) { showToast("Erreur sauvegarde","error"); }
  }

  async function deletePlan(id) {
    if(!window.confirm("Supprimer ce plan ? Toutes les semaines et séances seront supprimées.")) return;
    try {
      await api.deleteSeasonPlan(id);
      setPlans(pl=>pl.filter(p=>p.id!==id));
      if(selPlan?.id===id) { setSelPlan(null); setView("plans"); }
      showToast("Plan supprimé");
    } catch(e) { showToast("Erreur suppression","error"); }
  }

  // ---- Week CRUD ----
  async function saveWeek(data) {
    try {
      if(data.id) {
        await api.updatePlanWeek(data.id, data);
        setWeeks(w=>w.map(x=>x.id===data.id?{...x,...data}:x));
      } else {
        const res = await api.createPlanWeek({...data,plan_id:selPlan.id});
        if(res&&res[0]) setWeeks(w=>[...w,res[0]].sort((a,b)=>a.num_semaine-b.num_semaine));
      }
      showToast(data.id?"Semaine modifiée":"Semaine ajoutée");
      setShowWeekModal(false);
    } catch(e) { showToast("Erreur sauvegarde","error"); }
  }

  async function deleteWeek(id) {
    if(!window.confirm("Supprimer cette semaine ?")) return;
    try {
      await api.deletePlanWeek(id);
      setWeeks(w=>w.filter(x=>x.id!==id));
      if(selWeek?.id===id) { setSelWeek(null); setView("timeline"); }
      showToast("Semaine supprimée");
    } catch(e) { showToast("Erreur","error"); }
  }

  // ---- Session CRUD ----
  async function saveSession(data) {
    try {
      if(data.id) {
        await api.updatePlannedSession(data.id, data);
        setSessions(s=>s.map(x=>x.id===data.id?{...x,...data}:x));
      } else {
        const res = await api.createPlannedSession({...data,week_id:selWeek.id});
        if(res&&res[0]) setSessions(s=>[...s,res[0]]);
      }
      showToast(data.id?"Séance modifiée":"Séance ajoutée");
      setShowSessionModal(false);
    } catch(e) { showToast("Erreur sauvegarde","error"); }
  }

  async function deleteSession(id) {
    try {
      await api.deletePlannedSession(id);
      setSessions(s=>s.filter(x=>x.id!==id));
      showToast("Séance supprimée");
    } catch(e) { showToast("Erreur","error"); }
  }

  // ---- Template CRUD ----
  async function saveTpl(data) {
    try {
      if(data.id) {
        await api.updateSessionTemplate(data.id, data);
        setTemplates(t=>t.map(x=>x.id===data.id?{...x,...data}:x));
      } else {
        const res = await api.createSessionTemplate({...data,created_by:currentUser?.name});
        if(res&&res[0]) setTemplates(t=>[...t,res[0]]);
      }
      showToast(data.id?"Template modifié":"Template créé");
      setShowTplModal(false);
    } catch(e) { showToast("Erreur sauvegarde","error"); }
  }

  async function deleteTpl(id) {
    if(!window.confirm("Supprimer ce template ?")) return;
    try {
      await api.deleteSessionTemplate(id);
      setTemplates(t=>t.filter(x=>x.id!==id));
      showToast("Template supprimé");
    } catch(e) { showToast("Erreur","error"); }
  }

  // ---- Navigation helpers ----
  function openPlan(plan) {
    setSelPlan(plan);
    loadWeeks(plan.id);
    loadOverrides(plan.id);
    setView("timeline");
  }

  function openWeek(week) {
    setSelWeek(week);
    loadSessions(week.id);
    setView("semaine");
  }

  // ==================== EXPORT PDF ====================

  async function exportPlanPDF() {
    showToast("Génération du PDF...", "success");

    // Charger jsPDF dynamiquement
    if(!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;

    // Charger TOUTES les séances de TOUTES les semaines
    const allSessions = {};
    await Promise.all(weeks.map(async w => {
      const s = await api.getPlannedSessions(w.id).catch(()=>[]);
      allSessions[w.id] = s || [];
    }));

    // Palette impression fond blanc
    const CHARGE_HEX = {
      "Légère":     { bg:[220,252,231], border:[134,239,172], text:[22,101,52]   },
      "Modérée":    { bg:[254,243,199], border:[253,224,71],  text:[133,77,14]   },
      "Élevée":     { bg:[255,237,213], border:[253,186,116], text:[154,52,18]   },
      "Maximale":   { bg:[254,226,226], border:[252,165,165], text:[153,27,27]   },
      "Compétition":{ bg:[243,232,255], border:[216,180,254], text:[88,28,135]   },
    };
    const TYPE_HEX = {
      MUSCU:        { bg:[255,237,213], border:[253,186,116], text:[154,52,18]  },
      ERGO:         { bg:[224,242,254], border:[125,211,252], text:[12,74,110]  },
      BATEAU:       { bg:[207,250,254], border:[103,232,249], text:[21,94,117]  },
      RECUP:        { bg:[220,252,231], border:[134,239,172], text:[22,101,52]  },
      REPOS:        { bg:[241,245,249], border:[203,213,225], text:[71,85,105]  },
      TEST:         { bg:[243,232,255], border:[216,180,254], text:[88,28,135]  },
      COMPETITION:  { bg:[253,244,255], border:[240,171,252], text:[134,25,143] },
    };
    const SEMAINE_HEX = {
      TRANSITION:      [71,85,105],
      CONSTRUCTION:    [14,116,144],
      "DÉCHARGE":      [22,101,52],
      SURCOMPENSATION: [88,28,135],
      "CHARGE 1":      [154,52,18],
      "CHARGE 2":      [153,27,27],
      "SPÉCIFIQUE":    [134,25,143],
      "AFFÛTAGE":      [133,77,14],
      "COMPÉTITION":   [134,25,143],
      RECONSTRUCTION:  [21,94,117],
    };

    const JOURS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    const JOURS_FULL  = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

    // PDF A4 paysage
    const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
    const PW = 297, PH = 210;
    const MARGIN = 10;

    // ---- Helpers dessin ----
    function setRGB(arr) { doc.setTextColor(arr[0],arr[1],arr[2]); }
    function setFill(arr) { doc.setFillColor(arr[0],arr[1],arr[2]); }
    function setDraw(arr) { doc.setDrawColor(arr[0],arr[1],arr[2]); }

    function truncate(str, maxChars) {
      if(!str) return "";
      return str.length > maxChars ? str.slice(0,maxChars-1)+"…" : str;
    }

    // ---- Page header ----
    function drawPageHeader(pageNum, totalPages) {
      // Fond header blanc avec bordure basse
      doc.setFillColor(255,255,255);
      doc.rect(0,0,PW,14,"F");
      doc.setDrawColor(200,210,220);
      doc.setLineWidth(0.4);
      doc.line(0,14,PW,14);
      // Titre plan
      doc.setFont("helvetica","bold");
      doc.setFontSize(11);
      doc.setTextColor(30,41,59);
      doc.text(selPlan.name, MARGIN, 9);
      // Catégorie
      doc.setFont("helvetica","normal");
      doc.setFontSize(8);
      doc.setTextColor(100,116,139);
      doc.text(selPlan.category || "", MARGIN + doc.getTextWidth(selPlan.name) + 4, 9);
      // Page
      doc.setFontSize(8);
      doc.setTextColor(100,116,139);
      doc.text(`Page ${pageNum}/${totalPages}`, PW-MARGIN, 9, {align:"right"});
      // Date export
      doc.text(`Export : ${new Date().toLocaleDateString("fr-FR")}`, PW/2, 9, {align:"center"});
    }

    // ---- Dessin d'un bloc semaine ----
    function drawWeekBlock(w, x, y, bw, bh) {
      const typeColor = SEMAINE_HEX[w.type_semaine] || [71,85,105];
      const chargeConf = CHARGE_HEX[w.charge];

      // Fond blanc + bordure gris clair
      doc.setFillColor(255,255,255);
      doc.setDrawColor(203,213,225);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, y, bw, bh, 3, 3, "FD");

      // Bandeau header coloré (léger)
      const headerH = 10;
      doc.setFillColor(
        Math.min(255, typeColor[0]*0.15 + 235),
        Math.min(255, typeColor[1]*0.15 + 235),
        Math.min(255, typeColor[2]*0.15 + 235)
      );
      doc.roundedRect(x, y, bw, headerH, 3, 3, "F");
      doc.rect(x, y+headerH-4, bw, 4, "F");

      // Bordure gauche colorée
      doc.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
      doc.rect(x, y, 2.5, headerH, "F");

      // Numéro semaine
      doc.setFont("helvetica","bold");
      doc.setFontSize(8.5);
      doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
      doc.text(`S${w.num_semaine}`, x+5, y+6.5);

      // Type semaine
      doc.setFont("helvetica","normal");
      doc.setFontSize(7);
      doc.setTextColor(50,65,85);
      doc.text(truncate(w.type_semaine||"",18), x+16, y+6.5);

      // Badge charge
      if(chargeConf) {
        const chargeText = w.charge || "";
        const cw = doc.getTextWidth(chargeText) + 5;
        const cx = x + bw - cw - 3;
        doc.setFillColor(chargeConf.bg[0], chargeConf.bg[1], chargeConf.bg[2]);
        doc.setDrawColor(chargeConf.border[0], chargeConf.border[1], chargeConf.border[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y+2.5, cw, 6, 1.5, 1.5, "FD");
        doc.setFontSize(6.5);
        doc.setFont("helvetica","bold");
        doc.setTextColor(chargeConf.text[0], chargeConf.text[1], chargeConf.text[2]);
        doc.text(chargeText, cx+2.5, y+6.8);
      }

      // Séparateur sous header
      doc.setDrawColor(220,228,237);
      doc.setLineWidth(0.2);
      doc.line(x, y+headerH, x+bw, y+headerH);

      // Date + objectif
      let metaY = y + headerH + 3.5;
      if(w.date_debut || w.objectif) {
        doc.setFont("helvetica","normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100,116,139);
        const meta = [w.date_debut, w.objectif].filter(Boolean).map(s=>truncate(s,32)).join(" · ");
        doc.text(meta, x+3, metaY);
        metaY += 4;
      }

      // Grille jours
      const weeksessions = allSessions[w.id] || [];
      const cellW = (bw - 6) / 7;
      const gridStartX = x + 3;
      const gridStartY = metaY;
      const gridH = bh - (metaY - y) - 2;

      JOURS_SHORT.forEach((jour, ji) => {
        const cx = gridStartX + ji * cellW;
        const cy = gridStartY;
        const fullJour = JOURS_FULL[ji];
        const daysSessions = weeksessions.filter(s=>s.jour===fullJour);
        const isWeekend = ji >= 5;

        // Fond cellule
        doc.setFillColor(isWeekend ? 248 : 252, isWeekend ? 249 : 253, isWeekend ? 250 : 254);
        doc.setDrawColor(220,228,237);
        doc.setLineWidth(0.2);
        doc.roundedRect(cx, cy, cellW-1, gridH, 1, 1, "FD");

        // Header jour
        doc.setFont("helvetica","bold");
        doc.setFontSize(6);
        doc.setTextColor(isWeekend ? 148 : 100, isWeekend ? 163 : 116, isWeekend ? 184 : 139);
        doc.text(jour, cx + cellW/2 - 1, cy+4.5, {align:"center"});

        // Ligne sous header jour
        doc.setDrawColor(220,228,237);
        doc.line(cx, cy+6, cx+cellW-1, cy+6);

        // Séances
        let sessY = cy + 8;
        daysSessions.slice(0,4).forEach(s => {
          const sc = TYPE_HEX[s.type_seance] || TYPE_HEX.REPOS;
          const contenu = typeof s.contenu==="string" ? JSON.parse(s.contenu||"{}") : (s.contenu||{});
          const typeLabel = s.type_seance ? s.type_seance.slice(0,3) : "???";
          const badgeW = cellW - 3;

          // Badge type séance
          doc.setFillColor(sc.bg[0], sc.bg[1], sc.bg[2]);
          doc.setDrawColor(sc.border[0], sc.border[1], sc.border[2]);
          doc.setLineWidth(0.25);
          doc.roundedRect(cx+1, sessY-2, badgeW, 4.5, 1, 1, "FD");
          doc.setTextColor(sc.text[0], sc.text[1], sc.text[2]);
          doc.setFont("helvetica","bold");
          doc.setFontSize(5.5);
          doc.text(typeLabel, cx+2.5, sessY+1.5);

          // Titre séance
          if(s.titre) {
            doc.setFont("helvetica","normal");
            doc.setFontSize(5);
            doc.setTextColor(50,65,85);
            doc.text(truncate(s.titre, 13), cx+1, sessY+5.5);
          }

          // Durée
          if(contenu.duree_min) {
            doc.setFontSize(4.5);
            doc.setTextColor(100,116,139);
            doc.text(`${contenu.duree_min}min`, cx+1, sessY+9);
            sessY += 12;
          } else {
            sessY += 9;
          }
          if(sessY > cy + gridH - 3) return;
        });

        // Repos si aucune séance
        if(daysSessions.length === 0) {
          doc.setFont("helvetica","normal");
          doc.setFontSize(5);
          doc.setTextColor(203,213,225);
          doc.text("—", cx + cellW/2 - 1, cy + gridH/2 + 1, {align:"center"});
        }
      });
    }

    // ==================== GÉNÉRATION PAGES ====================
    // 4 semaines par page, 2 colonnes × 2 lignes
    const WEEKS_PER_PAGE = 4;
    const totalPages = Math.ceil(weeks.length / WEEKS_PER_PAGE);

    const CONTENT_Y = 16; // sous header
    const CONTENT_H = PH - CONTENT_Y - MARGIN;
    const BLOCK_W = (PW - MARGIN*2 - 6) / 2;
    const BLOCK_H = (CONTENT_H - 6) / 2;

    weeks.forEach((w, idx) => {
      const pageIdx = Math.floor(idx / WEEKS_PER_PAGE);
      const posInPage = idx % WEEKS_PER_PAGE;

      if(posInPage === 0) {
        if(pageIdx > 0) doc.addPage();
        // Fond blanc
        doc.setFillColor(255,255,255);
        doc.rect(0,0,PW,PH,"F");
        drawPageHeader(pageIdx+1, totalPages);
      }

      const col = posInPage % 2;
      const row = Math.floor(posInPage / 2);
      const bx = MARGIN + col*(BLOCK_W+6);
      const by = CONTENT_Y + row*(BLOCK_H+6);

      drawWeekBlock(w, bx, by, BLOCK_W, BLOCK_H);
    });

    // Légende (dernière page)
    doc.addPage();
    doc.setFillColor(255,255,255);
    doc.rect(0,0,PW,PH,"F");
    drawPageHeader(totalPages+1, totalPages+1);

    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.setTextColor(30,41,59);
    doc.text("Légende", MARGIN, 26);

    // Types de séances
    doc.setFontSize(8);
    doc.setTextColor(100,116,139);
    doc.text("TYPES DE SÉANCES", MARGIN, 34);
    const typeEntries = Object.entries(TYPE_HEX);
    typeEntries.forEach(([label, conf], i) => {
      const lx = MARGIN + (i % 4) * 65;
      const ly = 40 + Math.floor(i/4) * 10;
      doc.setFillColor(conf.bg[0], conf.bg[1], conf.bg[2]);
      doc.setDrawColor(conf.border[0], conf.border[1], conf.border[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(lx, ly-3, 14, 5.5, 1.5, 1.5, "FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(6);
      doc.setTextColor(conf.text[0], conf.text[1], conf.text[2]);
      doc.text(label.slice(0,3), lx+1.5, ly+0.5);
      doc.setFont("helvetica","normal");
      doc.setFontSize(7);
      doc.setTextColor(50,65,85);
      doc.text(label, lx+16, ly+0.5);
    });

    // Charges
    let chargeY = 70;
    doc.setFontSize(8);
    doc.setTextColor(100,116,139);
    doc.text("CHARGES SEMAINE", MARGIN, chargeY);
    Object.entries(CHARGE_HEX).forEach(([label, conf], i) => {
      const lx = MARGIN + i*55;
      doc.setFillColor(conf.bg[0], conf.bg[1], conf.bg[2]);
      doc.setDrawColor(conf.border[0], conf.border[1], conf.border[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(lx, chargeY+5, 36, 6, 1.5, 1.5, "FD");
      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      doc.setTextColor(conf.text[0], conf.text[1], conf.text[2]);
      doc.text(label, lx+2, chargeY+9.5);
    });

    doc.save(`${selPlan.name.replace(/\s+/g,"-")}_planning.pdf`);
    showToast("PDF téléchargé ✓", "success");
  }

  // ==================== VIEWS ====================

  // ---- Vue liste des plans ----
  function ViewPlans() {
    return (
      <div>
        <div style={{...S.ph,marginBottom:isMobile?16:28}}>
          <div>
            <h1 style={{...S.ttl,fontSize:isMobile?22:28}}>📅 Planning</h1>
            <p style={S.sub}>{plans.length} plan{plans.length!==1?"s":""} de saison</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={{...S.btnP,background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",fontSize:12}} onClick={()=>setView("templates")}>📋 Templates</button>
            <button style={S.btnP} onClick={()=>{setEditPlan({name:"",category:"",date_debut:"",date_fin:"",description:""});setShowPlanModal(true);}}>+ Nouveau plan</button>
          </div>
        </div>
        {plans.length===0?(
          <div style={{...S.card,textAlign:"center",padding:48}}>
            <div style={{fontSize:48,marginBottom:16}}>📅</div>
            <div style={{color:"#f1f5f9",fontWeight:700,fontSize:16,marginBottom:8}}>Aucun plan de saison</div>
            <div style={{color:"#64748b",fontSize:13,marginBottom:24}}>Crée ton premier plan pour commencer à planifier</div>
            <button style={S.btnP} onClick={()=>{setEditPlan({name:"",category:"",date_debut:"",date_fin:"",description:""});setShowPlanModal(true);}}>+ Créer un plan</button>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
            {plans.map(p=>(
              <div key={p.id} style={{...S.card,cursor:"pointer",transition:"border-color 0.15s"}} onClick={()=>openPlan(p)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{fontWeight:800,color:"#f1f5f9",fontSize:16,marginBottom:4}}>{p.name}</div>
                    <div style={{color:"#0ea5e9",fontSize:12,fontWeight:600}}>{p.category}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button style={{...S.actionBtn,borderColor:"#334155",color:"#94a3b8",fontSize:11}} onClick={e=>{e.stopPropagation();setEditPlan({...p});setShowPlanModal(true);}}>✏️</button>
                    <button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",fontSize:11}} onClick={e=>{e.stopPropagation();deletePlan(p.id);}}>🗑</button>
                  </div>
                </div>
                {p.description&&<div style={{color:"#7a95b0",fontSize:13,marginBottom:12}}>{p.description}</div>}
                <div style={{display:"flex",gap:8,fontSize:12,color:"#64748b"}}>
                  <span>📆 {p.date_debut} → {p.date_fin}</span>
                </div>
                <div style={{marginTop:12,color:"#38bdf8",fontSize:12,fontWeight:600}}>Voir le plan →</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Vue timeline ----
  function ViewTimeline() {
    if(!selPlan) return null;
    const totalWeeks = weeks.length;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:isMobile?16:24}}>
          <button style={{...S.actionBtn,borderColor:"#334155",color:"#94a3b8"}} onClick={()=>setView("plans")}>← Retour</button>
          <div style={{flex:1}}>
            <h1 style={{...S.ttl,fontSize:isMobile?18:24,margin:0}}>{selPlan.name}</h1>
            <p style={{...S.sub,marginTop:2}}>{selPlan.category} · {totalWeeks} semaine{totalWeeks!==1?"s":""}</p>
          </div>
          <button style={{...S.btnP,background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",fontSize:12}} onClick={()=>setShowAthletesModal(true)}>👥 Athlètes</button>
          <button style={{...S.btnP,background:"#1e293b",border:"1px solid #0ea5e940",color:"#0ea5e9",fontSize:12}} onClick={exportPlanPDF}>📄 PDF</button>
          <button style={S.btnP} onClick={()=>{
            const nextNum = weeks.length>0?Math.max(...weeks.map(w=>w.num_semaine))+1:1;
            setEditWeek({num_semaine:nextNum,date_debut:"",type_semaine:"CONSTRUCTION",charge:"Modérée",objectif:"",notes:""});
            setShowWeekModal(true);
          }}>+ Semaine</button>
        </div>

        {/* Résumé athlètes */}
        {(()=>{
          const includes = overrides.filter(o=>o.type==="include");
          const excludes = overrides.filter(o=>o.type==="exclude");
          const planCats = (selPlan.category||"").split(",").map(s=>s.trim()).filter(Boolean);
          const catAthletes = athletes.filter(a=>planCats.includes(a.category)||planCats.includes("Tous"));
          const total = catAthletes.length + includes.length - excludes.length;
          return (
            <div style={{...S.card,marginBottom:16,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{color:"#94a3b8",fontSize:13}}>👥 <b style={{color:"#f1f5f9"}}>{total} athlète{total!==1?"s":""}</b> dans ce plan</span>
              <span style={{color:"#64748b",fontSize:12}}>{catAthletes.length} {selPlan.category}{includes.length>0?` + ${includes.length} ajouté${includes.length>1?"s":""}`:""}{excludes.length>0?` − ${excludes.length} exclu${excludes.length>1?"s":""}`:""}</span>
              <button style={{...S.actionBtn,borderColor:"#334155",color:"#64748b",fontSize:11,marginLeft:"auto"}} onClick={()=>setShowAthletesModal(true)}>Modifier →</button>
            </div>
          );
        })()}

        {weeks.length===0?(
          <div style={{...S.card,textAlign:"center",padding:40}}>
            <div style={{color:"#64748b",fontSize:14,marginBottom:16}}>Aucune semaine dans ce plan</div>
            <button style={S.btnP} onClick={()=>{setEditWeek({num_semaine:1,date_debut:"",type_semaine:"CONSTRUCTION",charge:"Modérée",objectif:"",notes:""});setShowWeekModal(true);}}>+ Ajouter la semaine 1</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {weeks.map((w,i)=>{
              const col = TYPE_SEMAINE_COLORS[w.type_semaine]||"#64748b";
              const ch  = CHARGE_COLORS[w.charge]||{bg:"#33415520",border:"#33415550",text:"#94a3b8"};
              const sessCount = 0; // sera chargé plus tard
              return (
                <div key={w.id} style={{background:"#1e293b",border:`1px solid ${col}40`,borderLeft:`4px solid ${col}`,borderRadius:10,padding:isMobile?"12px":"14px 18px",cursor:"pointer",display:"flex",alignItems:isMobile?"flex-start":"center",gap:isMobile?8:16,flexDirection:isMobile?"column":"row"}}
                  onClick={()=>openWeek(w)}>
                  {/* Numéro */}
                  <div style={{width:isMobile?32:40,height:isMobile?32:40,borderRadius:8,background:col+"20",border:`1px solid ${col}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{color:col,fontWeight:900,fontSize:isMobile?13:15}}>S{w.num_semaine}</span>
                  </div>
                  {/* Dates + type */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{color:col,fontWeight:700,fontSize:13}}>{w.type_semaine}</span>
                      {chargeBadge(w.charge)}
                    </div>
                    {w.date_debut&&<div style={{color:"#64748b",fontSize:12}}>📆 {w.date_debut}</div>}
                    {w.objectif&&<div style={{color:"#94a3b8",fontSize:12,marginTop:2}}>{w.objectif}</div>}
                  </div>
                  {/* Actions */}
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button style={{...S.actionBtn,borderColor:"#334155",color:"#94a3b8",fontSize:11}} onClick={e=>{e.stopPropagation();setEditWeek({...w});setShowWeekModal(true);}}>✏️</button>
                    <button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",fontSize:11}} onClick={e=>{e.stopPropagation();deleteWeek(w.id);}}>🗑</button>
                    <span style={{color:"#38bdf8",fontSize:12,fontWeight:600,padding:"5px 0"}}>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- Vue semaine (grille Lun-Dim) ----
  function ViewSemaine() {
    if(!selWeek) return null;
    const col = TYPE_SEMAINE_COLORS[selWeek.type_semaine]||"#64748b";

    // Group sessions by day
    const [dragSess, setDragSess] = useState(null); // {id, jour, idx}
    const [localOrder, setLocalOrder] = useState({}); // {jour: [id, id, ...]}

    const byDay = {};
    JOURS.forEach(j=>{ byDay[j]=[]; });
    sessions.forEach(s=>{ if(byDay[s.jour]) byDay[s.jour].push(s); });
    // Appliquer l'ordre local
    JOURS.forEach(j=>{
      if(localOrder[j]) {
        byDay[j].sort((a,b)=>{
          const ia = localOrder[j].indexOf(a.id);
          const ib = localOrder[j].indexOf(b.id);
          if(ia===-1&&ib===-1) return 0;
          if(ia===-1) return 1;
          if(ib===-1) return -1;
          return ia-ib;
        });
      }
    });

    return (
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:isMobile?12:20,flexWrap:"wrap"}}>
          <button style={{...S.actionBtn,borderColor:"#334155",color:"#94a3b8"}} onClick={()=>{setView("timeline");}}>← Retour</button>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <h1 style={{...S.ttl,fontSize:isMobile?17:22,margin:0}}>Semaine {selWeek.num_semaine}</h1>
              <span style={{color:col,fontWeight:700,fontSize:13}}>{selWeek.type_semaine}</span>
              {chargeBadge(selWeek.charge)}
            </div>
            {selWeek.date_debut&&<p style={{...S.sub,marginTop:4}}>📆 {selWeek.date_debut}</p>}
            {selWeek.objectif&&<p style={{color:"#94a3b8",fontSize:13,margin:"4px 0 0"}}>{selWeek.objectif}</p>}
          </div>
        </div>

        {/* Notes de la semaine */}
        {selWeek.notes&&(
          <div style={{...S.card,marginBottom:16,borderLeft:`3px solid ${col}`,background:col+"08"}}>
            <div style={{color:"#94a3b8",fontSize:13}}>{selWeek.notes}</div>
          </div>
        )}

        {/* Grille jours */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(7,1fr)",gap:isMobile?8:10}}>
          {JOURS.map(jour=>{
            const joursessions = byDay[jour]||[];
            const isDropTarget = dragSess && dragSess.jour!==jour;
            return (
              <div key={jour}
                onDragOver={e=>{e.preventDefault();}}
                onDrop={async e=>{
                  e.preventDefault();
                  if(!dragSess||dragSess.jour===jour) return;
                  // Changer le jour de la séance en base
                  try {
                    await api.updatePlannedSession(dragSess.id,{jour});
                    setSessions(prev=>prev.map(s=>s.id===dragSess.id?{...s,jour}:s));
                  } catch(err) { showToast("Erreur déplacement","error"); }
                  setDragSess(null);
                }}
                style={{background:isDropTarget?"#0ea5e915":"#1e293b",border:`1px solid ${isDropTarget?"#0ea5e960":"#334155"}`,borderRadius:10,padding:isMobile?"10px 8px":"12px 10px",minHeight:isMobile?90:120,display:"flex",flexDirection:"column",gap:6,transition:"background 0.15s,border 0.15s"}}>
                <div style={{fontWeight:700,color:isDropTarget?"#0ea5e9":"#f1f5f9",fontSize:isMobile?11:12,marginBottom:4,borderBottom:"1px solid #334155",paddingBottom:4}}>{isMobile?jour.slice(0,3):jour}</div>
                {joursessions.map((s,si)=>{
                  const sc = TYPE_SEANCE_COLORS[s.type_seance]||"#64748b";
                  const isDragging = dragSess?.id===s.id;
                  return (
                    <div key={s.id}
                      draggable
                      onDragStart={e=>{e.stopPropagation();setDragSess({id:s.id,jour,idx:si});}}
                      onDragOver={e=>{
                        e.preventDefault();e.stopPropagation();
                        if(!dragSess||dragSess.jour!==jour||dragSess.id===s.id) return;
                        const cur=[...joursessions];
                        const fromIdx=cur.findIndex(x=>x.id===dragSess.id);
                        const toIdx=si;
                        if(fromIdx===toIdx) return;
                        const [item]=cur.splice(fromIdx,1);
                        cur.splice(toIdx,0,item);
                        setLocalOrder(o=>({...o,[jour]:cur.map(x=>x.id)}));
                        setDragSess({...dragSess,idx:toIdx});
                      }}
                      onDragEnd={()=>setDragSess(null)}
                      style={{background:sc+"18",border:`1px solid ${isDragging?"#0ea5e9":sc+"40"}`,borderRadius:6,padding:"5px 7px",cursor:"grab",opacity:isDragging?0.4:1,display:"flex",alignItems:"flex-start",gap:4}}
                    >
                      <span style={{color:"#334155",fontSize:10,flexShrink:0,marginTop:1}}>⠿</span>
                      <div style={{flex:1,minWidth:0}} onClick={()=>{if(!dragSess){setEditSession({...s});setShowSessionModal(true);}}}>
                        <div style={{color:sc,fontSize:10,fontWeight:700}}>{TYPE_SEANCE_LABELS[s.type_seance]||s.type_seance}</div>
                        <div style={{color:"#cbd5e1",fontSize:11,fontWeight:600,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.titre}</div>
                        {s.contenu?.duree_min>0&&<div style={{color:"#64748b",fontSize:10}}>{s.contenu.duree_min}'</div>}
                      </div>
                    </div>
                  );
                })}
                <button style={{background:"none",border:"1px dashed #334155",borderRadius:6,color:"#475569",fontSize:isMobile?16:18,cursor:"pointer",padding:"4px",marginTop:"auto"}}
                  onClick={()=>{setEditSession({jour,type_seance:"ERGO",titre:"",contenu:{blocs:[],duree_min:60}});setShowSessionModal(true);}}>
                  +
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Vue templates ----
  function ViewTemplates() {
    const [filterPhase, setFilterPhase] = useState(null);
    const PHASES = [
      {key:"phase_transition",    label:"Transition",     color:"#6366f1"},
      {key:"phase_construction",  label:"Construction",   color:"#0ea5e9"},
      {key:"phase_decharge",      label:"Décharge",       color:"#4ade80"},
      {key:"phase_surcompensation",label:"Surcompensation",color:"#f59e0b"},
      {key:"phase_specifique",    label:"Spécifique",     color:"#ec4899"},
    ];
    const filtered = filterPhase ? templates.filter(t=>t[filterPhase]) : templates;
    const byType = {};
    filtered.forEach(t=>{
      if(!byType[t.type_seance]) byType[t.type_seance]=[];
      byType[t.type_seance].push(t);
    });
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:isMobile?16:24}}>
          <button style={{...S.actionBtn,borderColor:"#334155",color:"#94a3b8"}} onClick={()=>setView("plans")}>← Retour</button>
          <div style={{flex:1}}>
            <h1 style={{...S.ttl,fontSize:isMobile?18:24,margin:0}}>📋 Templates de séance</h1>
            <p style={{...S.sub,marginTop:2}}>{templates.length} modèles disponibles</p>
          </div>
          <button style={S.btnP} onClick={()=>{setEditTpl({name:"",type_seance:"ERGO",contenu:{blocs:[],duree_min:60}});setShowTplModal(true);}}>+ Template</button>
        {PHASES.map(p=>(
          <button key={p.key}
            style={{...S.btnP,background:filterPhase===p.key?p.color:"transparent",border:`1px solid ${p.color}60`,color:filterPhase===p.key?"#fff":p.color,fontSize:11,padding:"4px 10px"}}
            onClick={()=>setFilterPhase(filterPhase===p.key?null:p.key)}>
            {p.label}
          </button>
        ))}
        </div>
        {Object.entries(byType).map(([type,tpls])=>(
          <TplGroup key={type} type={type} tpls={tpls} isMobile={isMobile} />
        ))}
      </div>
    );
  }

  function TplGroup({type, tpls, isMobile}) {
    const [open, setOpen] = useState(false);
    const color = TYPE_SEANCE_COLORS[type]||"#64748b";
    const PHASES_BADGE = [
      {key:"phase_transition",    label:"Tr", color:"#6366f1"},
      {key:"phase_construction",  label:"C",  color:"#0ea5e9"},
      {key:"phase_decharge",      label:"D",  color:"#4ade80"},
      {key:"phase_surcompensation",label:"S", color:"#f59e0b"},
      {key:"phase_specifique",    label:"Sp", color:"#ec4899"},
    ];
    return (
      <div style={{marginBottom:16,border:`1px solid ${color}30`,borderRadius:12,overflow:"hidden"}}>
        <button
          onClick={()=>setOpen(o=>!o)}
          style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:`${color}12`,border:"none",cursor:"pointer",textAlign:"left"}}>
          <span style={{color,fontWeight:800,fontSize:14}}>{TYPE_SEANCE_LABELS[type]||type}</span>
          <span style={{background:`${color}25`,color,borderRadius:10,fontSize:11,fontWeight:700,padding:"1px 8px"}}>{tpls.length}</span>
          <span style={{marginLeft:"auto",color,fontSize:16}}>{open?"▲":"▼"}</span>
        </button>
        {open&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:10,padding:"12px 14px"}}>
              {tpls.map(t=>(
                <div key={t.id} style={{...S.card,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{fontWeight:700,color:"#f1f5f9",fontSize:14}}>{t.name}</div>
                    <div style={{display:"flex",gap:4}}>
                      <button style={{...S.actionBtn,borderColor:"#334155",color:"#94a3b8",fontSize:10,padding:"3px 8px"}} onClick={()=>{setEditTpl({...t,contenu:typeof t.contenu==="string"?JSON.parse(t.contenu):t.contenu});setShowTplModal(true);}}>✏️</button>
                      <button onClick={()=>toggleFavTpl(t.id)}
                      style={{...S.actionBtn,borderColor:favTpls.includes(t.id)?"#f59e0b40":"#334155",color:favTpls.includes(t.id)?"#f59e0b":"#475569",fontSize:13,padding:"2px 6px"}}>
                      {favTpls.includes(t.id)?"♥":"♡"}
                    </button>
                    {!t.is_default&&<button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",fontSize:10,padding:"3px 8px"}} onClick={()=>deleteTpl(t.id)}>🗑</button>}
                    </div>
                  </div>
                  {(()=>{
                    const c = typeof t.contenu==="string"?JSON.parse(t.contenu):t.contenu;
                    return (<>
                      {c.blocs?.map((b,i)=><div key={i} style={{fontSize:12,color:"#94a3b8",marginBottom:2}}><span style={{color:"#64748b"}}>• </span><b style={{color:"#cbd5e1"}}>{b.titre}</b> — {b.detail}</div>)}
                      {c.duree_min>0&&<div style={{color:"#64748b",fontSize:11,marginTop:6}}>⏱ {c.duree_min} min</div>}
                    </>);
                  })()}
                  {t.is_default&&<div style={{marginTop:8,fontSize:10,color:"#475569",fontStyle:"italic"}}>Template système</div>}
                </div>
              ))}
          </div>
        }
      </div>
    );
  }



  // ==================== MODALS ====================

  function ModalPlan() {
    const [form, setForm] = useState(editPlan||{});
    function set(k,v) { setForm(f=>({...f,[k]:v})); }

    // category stored as comma-separated string, work with array internally
    const selectedCats = (form.category||"").split(",").map(s=>s.trim()).filter(Boolean);
    function toggleCat(cat) {
      const next = selectedCats.includes(cat)
        ? selectedCats.filter(c=>c!==cat)
        : [...selectedCats, cat];
      set("category", next.join(", "));
    }

    return (
      <Modal title={form.id?"Modifier le plan":"Nouveau plan de saison"} onClose={()=>setShowPlanModal(false)}>
        <FF label="Nom du plan"><input style={{...S.inp}} value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="Ex: Saison 2026 Masters"/></FF>
        <FF label="Groupes / Catégories">
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[...CATEGORIES,"Tous"].map(c=>{
              const active = selectedCats.includes(c);
              return (
                <button key={c} onClick={()=>toggleCat(c)} style={{...S.actionBtn,background:active?"#0ea5e920":"transparent",borderColor:active?"#0ea5e9":"#334155",color:active?"#0ea5e9":"#64748b",padding:"6px 14px",fontWeight:active?700:500}}>
                  {active?"✓ ":""}{c}
                </button>
              );
            })}
          </div>
          {selectedCats.length>0&&<div style={{marginTop:8,color:"#64748b",fontSize:12}}>Sélectionné : {form.category}</div>}
        </FF>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FF label="Date début"><input style={{...S.inp}} type="date" value={form.date_debut||""} onChange={e=>set("date_debut",e.target.value)}/></FF>
          <FF label="Date fin"><input style={{...S.inp}} type="date" value={form.date_fin||""} onChange={e=>set("date_fin",e.target.value)}/></FF>
        </div>
        <FF label="Description (optionnel)"><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={form.description||""} onChange={e=>set("description",e.target.value)} placeholder="Objectifs, contexte..."/></FF>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <button style={{...S.btnP,background:"transparent",color:"#64748b",border:"1px solid #334155"}} onClick={()=>setShowPlanModal(false)}>Annuler</button>
          <button style={S.btnP} onClick={()=>savePlan(form)} disabled={!form.name||!form.category}>Enregistrer</button>
        </div>
      </Modal>
    );
  }

  function ModalWeek() {
    const [form, setForm] = useState(editWeek||{});
    function set(k,v) { setForm(f=>({...f,[k]:v})); }
    return (
      <Modal title={form.id?"Modifier la semaine":"Nouvelle semaine"} onClose={()=>setShowWeekModal(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FF label="N° semaine"><input style={{...S.inp}} type="number" min="1" value={form.num_semaine||""} onChange={e=>set("num_semaine",parseInt(e.target.value))}/></FF>
          <FF label="Date début"><input style={{...S.inp}} type="date" value={form.date_debut||""} onChange={e=>set("date_debut",e.target.value)}/></FF>
        </div>
        <FF label="Type de semaine">
          <select style={{...S.inp}} value={form.type_semaine||""} onChange={e=>set("type_semaine",e.target.value)}>
            {TYPES_SEMAINE.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </FF>
        <FF label="Charge">
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {CHARGES.map(c=>{
              const col=CHARGE_COLORS[c]||{bg:"#33415520",border:"#33415550",text:"#94a3b8"};
              return <button key={c} style={{...S.actionBtn,background:form.charge===c?col.bg:"transparent",borderColor:form.charge===c?col.border:"#334155",color:form.charge===c?col.text:"#64748b",padding:"6px 14px"}} onClick={()=>set("charge",c)}>{c}</button>;
            })}
          </div>
        </FF>
        <FF label="Objectif"><input style={{...S.inp}} value={form.objectif||""} onChange={e=>set("objectif",e.target.value)} placeholder="Ex: Régate 1000m · 4/5 avr."/></FF>
        <FF label="Notes coach"><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Consignes, contexte..."/></FF>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <button style={{...S.btnP,background:"transparent",color:"#64748b",border:"1px solid #334155"}} onClick={()=>setShowWeekModal(false)}>Annuler</button>
          <button style={S.btnP} onClick={()=>saveWeek(form)}>Enregistrer</button>
        </div>
      </Modal>
    );
  }

  // Composant de sélection d'exercice avec dropdown custom (compatible Safari)
  function ExoInput({value, onChange, exercises, typeSeance, style, placeholder}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value||"");
    // Synchroniser query si value change de l'extérieur (ex: drag & drop)
    const prevValue = useRef(value);
    if(prevValue.current !== value) { prevValue.current = value; }
    // Utiliser value directement comme source de vérité quand pas en focus
    const [focused, setFocused] = useState(false);
    const displayValue = focused ? query : (value||"");
    const filtered = exercises
      .filter(e=>!displayValue||e.titre.toLowerCase().includes(displayValue.toLowerCase()))
      .sort((a,b)=>{
        // Prioriser les exos du même type en haut
        const sameA = !typeSeance||a.type_seance===typeSeance;
        const sameB = !typeSeance||b.type_seance===typeSeance;
        if(sameA&&!sameB) return -1;
        if(!sameA&&sameB) return 1;
        return a.titre.localeCompare(b.titre);
      })
      .slice(0,15);
    return(
      <div style={{position:"relative",flex:1,minWidth:0}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setFocused(false);}}}>
        <input
          style={{...style,width:"100%",boxSizing:"border-box"}}
          value={displayValue}
          placeholder={placeholder||"Exercice..."}
          onChange={e=>{setQuery(e.target.value);onChange(e.target.value,"");setOpen(true);}}
          onFocus={()=>{setQuery(value||"");setFocused(true);setOpen(true);}}
        />
        {open&&focused&&filtered.length>0&&(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1e293b",border:"1px solid #334155",borderRadius:8,zIndex:500,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #00000060"}}>
            {filtered.map(e=>(
              <div key={e.id}
                onMouseDown={()=>{onChange(e.titre,e.detail_defaut||"");setQuery(e.titre);setOpen(false);setFocused(false);}}
                style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #263547",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                onMouseEnter={e2=>e2.currentTarget.style.background="#263547"}
                onMouseLeave={e2=>e2.currentTarget.style.background="transparent"}>
                <span style={{color:"#f1f5f9",fontSize:13,fontWeight:600}}>{e.titre}</span>
                <div style={{display:"flex",gap:4,alignItems:"center",marginLeft:"auto"}}>
                  {e.type_seance&&e.type_seance!==typeSeance&&<span style={{background:"#33415530",color:"#64748b",borderRadius:4,fontSize:9,padding:"1px 5px"}}>{e.type_seance}</span>}
                  {e.detail_defaut&&<span style={{color:"#475569",fontSize:11}}>{e.detail_defaut.slice(0,25)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function ModalSession() {
    const initContenu = editSession?.contenu && typeof editSession.contenu==="object" ? editSession.contenu : {blocs:[],duree_min:60};
    const [form, setForm] = useState({...editSession, contenu: initContenu});
    const [newBloc, setNewBloc] = useState({titre:"",detail:""});
    const [selTpl, setSelTpl] = useState(null);
    const [showTplSave, setShowTplSave] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);
    function set(k,v) { setForm(f=>({...f,[k]:v})); }
    function setContenu(k,v) { setForm(f=>({...f,contenu:{...f.contenu,[k]:v}})); }

    function applyTemplate(tpl) {
      const c = typeof tpl.contenu==="string"?JSON.parse(tpl.contenu):tpl.contenu;
      setForm(f=>({...f,type_seance:tpl.type_seance,titre:tpl.name,contenu:{...c}}));
      setSelTpl(tpl);
      setShowTplSave(false);
    }

    function handleSaveSession() {
      // Si un template a été appliqué, proposer de le sauvegarder
      if(selTpl) { setShowTplSave(true); return; }
      saveSession(form);
    }

    async function saveTplAndSession(mode) {
      if(mode==="overwrite" && selTpl?.id) {
        await saveTpl({...selTpl, contenu: form.contenu});
      } else if(mode==="new") {
        const {id:_,is_default:__,...rest} = selTpl||{};
        await saveTpl({...rest, name: (selTpl?.name||form.titre)+" (modifié)", contenu: form.contenu, is_default:false});
      }
      saveSession(form);
    }

    const PHASES_TPL = [
      {key:"phase_transition",    label:"Transition",     color:"#6366f1"},
      {key:"phase_construction",  label:"Construction",   color:"#0ea5e9"},
      {key:"phase_decharge",      label:"Décharge",       color:"#4ade80"},
      {key:"phase_surcompensation",label:"Surcompensation",color:"#f59e0b"},
      {key:"phase_specifique",    label:"Spécifique",     color:"#ec4899"},
    ];
    const [tplPhaseFilter, setTplPhaseFilter] = useState(null);
    const myTemplates = templates
      .filter(t=>!form.type_seance||t.type_seance===form.type_seance)
      .filter(t=>!tplPhaseFilter||t[tplPhaseFilter]);

    return (
      <Modal title={form.id?"Modifier la séance":"Nouvelle séance"} onClose={()=>setShowSessionModal(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FF label="Jour">
            <select style={{...S.inp}} value={form.jour||JOURS[0]} onChange={e=>set("jour",e.target.value)}>
              {JOURS.map(j=><option key={j} value={j}>{j}</option>)}
            </select>
          </FF>
          <FF label="Type">
            <select style={{...S.inp}} value={form.type_seance||"ERGO"} onChange={e=>set("type_seance",e.target.value)}>
              {Object.entries(TYPE_SEANCE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </FF>
        </div>
        <FF label="Titre"><input style={{...S.inp}} value={form.titre||""} onChange={e=>set("titre",e.target.value)} placeholder="Ex: Ergo B1 45' continu"/></FF>

        {/* Templates rapides */}
        {templates.filter(t=>!form.type_seance||t.type_seance===form.type_seance).length>0&&(
          <FF label="Utiliser un template">
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
              {PHASES_TPL.map(p=>(
                <button key={p.key}
                  style={{background:tplPhaseFilter===p.key?p.color:"transparent",border:`1px solid ${p.color}60`,color:tplPhaseFilter===p.key?"#fff":p.color,borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}
                  onClick={()=>setTplPhaseFilter(tplPhaseFilter===p.key?null:p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {/* Favoris en premier */}
            {myTemplates.filter(t=>favTpls.includes(t.id)).length>0&&(
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                {myTemplates.filter(t=>favTpls.includes(t.id)).map(t=>(
                  <button key={t.id} style={{...S.fb,fontSize:11,borderColor:"#f59e0b40",background:"#f59e0b08"}} onClick={()=>applyTemplate(t)}>
                    ♥ {t.name}
                  </button>
                ))}
              </div>
            )}
            {myTemplates.map(t=>(
              <button key={t.id} style={{...S.fb,fontSize:11}} onClick={()=>applyTemplate(t)}>
                {t.name}
                {PHASES_TPL.filter(p=>t[p.key]).map(p=>(
                  <span key={p.key} style={{marginLeft:4,background:p.color+"30",color:p.color,borderRadius:3,fontSize:8,padding:"0 4px",verticalAlign:"middle"}}>{p.label[0]}</span>
                ))}
              </button>
            ))}
            </div>
          </FF>
        )}

        {/* Blocs de contenu */}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",color:"#7a95b0",fontSize:11,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Contenu (blocs) — glisser pour réordonner</label>
          {(form.contenu?.blocs||[]).map((b,i)=>{
            const blocs=form.contenu?.blocs||[];
            const typeExos=exercises.filter(e=>!form.type_seance||e.type_seance===form.type_seance);
            return(
              <div key={i}
                draggable
                onDragStart={()=>setDragIdx(i)}
                onDragOver={e=>{e.preventDefault();if(dragIdx===null||dragIdx===i)return;const nb=[...blocs];const[item]=nb.splice(dragIdx,1);nb.splice(i,0,item);setContenu("blocs",nb);setDragIdx(i);}}
                onDragEnd={()=>setDragIdx(null)}
                style={{display:"flex",gap:8,marginBottom:6,alignItems:"center",opacity:dragIdx===i?0.5:1,cursor:"grab",background:dragIdx===i?"#0ea5e910":"transparent",borderRadius:6,padding:"2px 0"}}>
                <span style={{color:"#334155",fontSize:16,cursor:"grab",flexShrink:0,paddingLeft:2}}>⠿</span>
                <ExoInput
                  value={b.titre}
                  exercises={exercises}
                  typeSeance={form.type_seance}
                  style={{...S.inp,fontSize:12,fontWeight:700,borderColor:"#0ea5e940",color:"#0ea5e9"}}
                  placeholder="Exercice"
                  onChange={(titre,detail)=>setContenu("blocs",blocs.map((x,j)=>j===i?{...x,titre,detail:detail||x.detail}:x))}
                />
                <input style={{...S.inp,flex:1,fontSize:12}}
                  value={b.detail}
                  onChange={e=>setContenu("blocs",blocs.map((x,j)=>j===i?{...x,detail:e.target.value}:x))}
                  placeholder="Détail"/>
                <button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",padding:"6px 10px"}} onClick={()=>setContenu("blocs",blocs.filter((_,j)=>j!==i))}>×</button>
              </div>
            );
          })}
          {/* Ajouter un bloc */}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <ExoInput
              value={newBloc.titre}
              exercises={exercises}
              typeSeance={form.type_seance}
              style={{...S.inp,fontSize:12}}
              placeholder="Exercice"
              onChange={(titre,detail)=>setNewBloc(b=>({...b,titre,detail:detail||b.detail}))}
            />
            <input style={{...S.inp,flex:1,fontSize:12}} placeholder="Détail (ex: 4×10-12 · 60%)" value={newBloc.detail} onChange={e=>setNewBloc(b=>({...b,detail:e.target.value}))}/>
            <button style={S.btnP} onClick={()=>{if(!newBloc.titre)return;setContenu("blocs",[...(form.contenu?.blocs||[]),{...newBloc}]);setNewBloc({titre:"",detail:""});}}>+</button>
          </div>
        </div>

        <FF label="Durée (min)"><input style={{...S.inp,width:100}} type="number" min="0" value={form.contenu?.duree_min||0} onChange={e=>setContenu("duree_min",parseInt(e.target.value))}/></FF>

        {/* Transformer la séance en template */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
          <button
            onClick={()=>{
              setShowTplModal(false);
              setEditTpl({
                name: form.titre||"Nouveau template",
                type_seance: form.type_seance||"ERGO",
                contenu: form.contenu||{blocs:[],duree_min:60},
                is_default: false,
              });
              setShowSessionModal(false);
              setShowTplModal(true);
            }}
            style={{background:"none",border:"1px dashed #334155",borderRadius:8,color:"#64748b",fontSize:12,cursor:"pointer",padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
            📋 Transformer en template
          </button>
        </div>

        {/* Proposition sauvegarde template */}
        {showTplSave&&selTpl&&(
          <div style={{background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:10,padding:"12px 14px",marginTop:8}}>
            <div style={{color:"#0ea5e9",fontWeight:700,fontSize:13,marginBottom:8}}>
              ✏️ Tu as modifié le template <em>"{selTpl.name}"</em>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button style={{...S.btnP,background:"transparent",color:"#64748b",border:"1px solid #334155",fontSize:12}} onClick={()=>{setShowTplSave(false);saveSession(form);}}>
                Garder les modifs pour cette séance seulement
              </button>
              <button style={{...S.btnP,background:"#0ea5e9",fontSize:12}} onClick={()=>saveTplAndSession("overwrite")}>
                💾 Écraser le template original
              </button>
              <button style={{...S.btnP,background:"#4ade80",color:"#0f1923",fontSize:12}} onClick={()=>saveTplAndSession("new")}>
                ✨ Enregistrer comme nouveau template
              </button>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:10,justifyContent:"space-between",marginTop:8,flexWrap:"wrap"}}>
          <div>
            {form.id&&<button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444"}} onClick={()=>{deleteSession(form.id);setShowSessionModal(false);}}>Supprimer</button>}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button style={{...S.btnP,background:"transparent",color:"#64748b",border:"1px solid #334155"}} onClick={()=>setShowSessionModal(false)}>Annuler</button>
            <button style={S.btnP} onClick={handleSaveSession}>Enregistrer</button>
          </div>
        </div>
      </Modal>
    );
  }

  function ModalTemplate() {
    const initContenu = editTpl?.contenu && typeof editTpl.contenu==="object" ? editTpl.contenu : {blocs:[],duree_min:60};
    const [form, setForm] = useState({...editTpl, contenu: initContenu});
    const [newBloc, setNewBloc] = useState({titre:"",detail:""});
    const [dIdx, setDIdx] = useState(null);
    function set(k,v) { setForm(f=>({...f,[k]:v})); }
    function setContenu(k,v) { setForm(f=>({...f,contenu:{...f.contenu,[k]:v}})); }
    return (
      <Modal title={form.id?"Modifier le template":"Nouveau template"} onClose={()=>setShowTplModal(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FF label="Nom"><input style={{...S.inp}} value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="Ex: Ergo B1 45' continu"/></FF>
          <FF label="Type">
            <select style={{...S.inp}} value={form.type_seance||"ERGO"} onChange={e=>set("type_seance",e.target.value)}>
              {Object.entries(TYPE_SEANCE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </FF>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",color:"#7a95b0",fontSize:11,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Blocs de contenu</label>
          {(form.contenu?.blocs||[]).map((b,i)=>{
            const blocs=form.contenu?.blocs||[];
            const typeExos=exercises.filter(e=>!form.type_seance||e.type_seance===form.type_seance);
            return(
              <div key={i} draggable
                onDragStart={()=>setDIdx(i)}
                onDragOver={e=>{e.preventDefault();if(dIdx===null||dIdx===i)return;const nb=[...blocs];const[it]=nb.splice(dIdx,1);nb.splice(i,0,it);setContenu("blocs",nb);setDIdx(i);}}
                onDragEnd={()=>setDIdx(null)}
                style={{display:"flex",gap:8,marginBottom:6,alignItems:"center",opacity:dIdx===i?0.5:1,cursor:"grab"}}>
                <span style={{color:"#334155",fontSize:14,flexShrink:0}}>⠿</span>
                <input list="tpl-exos" style={{...S.inp,width:140,flexShrink:0,fontSize:12,fontWeight:700,color:"#0ea5e9",borderColor:"#0ea5e940"}}
                  value={b.titre}
                  onChange={e=>{const v=e.target.value;const m=exercises.find(x=>x.titre===v);setContenu("blocs",blocs.map((x,j)=>j===i?{...x,titre:v,detail:m?m.detail_defaut:x.detail}:x));}}
                  placeholder="Exercice"/>
                <input style={{...S.inp,flex:1,fontSize:12}} value={b.detail}
                  onChange={e=>setContenu("blocs",blocs.map((x,j)=>j===i?{...x,detail:e.target.value}:x))}
                  placeholder="Détail"/>
                <button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",padding:"6px 10px"}} onClick={()=>setContenu("blocs",blocs.filter((_,j)=>j!==i))}>×</button>
              </div>
            );
          })}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <input style={{...S.inp,width:110,fontSize:12}} placeholder="Titre" value={newBloc.titre} onChange={e=>setNewBloc(b=>({...b,titre:e.target.value}))}/>
            <input style={{...S.inp,flex:1,fontSize:12}} placeholder="Détail" value={newBloc.detail} onChange={e=>setNewBloc(b=>({...b,detail:e.target.value}))}/>
            <button style={S.btnP} onClick={()=>{
              if(!newBloc.titre) return;
              setContenu("blocs",[...(form.contenu?.blocs||[]),{...newBloc}]);
              setNewBloc({titre:"",detail:""});
            }}>+</button>
          </div>
        </div>
        <FF label="Durée (min)"><input style={{...S.inp,width:100}} type="number" min="0" value={form.contenu?.duree_min||0} onChange={e=>setContenu("duree_min",parseInt(e.target.value))}/></FF>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",color:"#7a95b0",fontSize:11,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Phases d'utilisation</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[
      {key:"phase_transition",    label:"Transition",     color:"#6366f1"},
      {key:"phase_construction",  label:"Construction",   color:"#0ea5e9"},
      {key:"phase_decharge",      label:"Décharge",       color:"#4ade80"},
      {key:"phase_surcompensation",label:"Surcompensation",color:"#f59e0b"},
      {key:"phase_specifique",    label:"Spécifique",     color:"#ec4899"},
            ].map(p=>(
              <button key={p.key}
                style={{background:form[p.key]?p.color:"transparent",border:`1px solid ${p.color}60`,color:form[p.key]?"#fff":p.color,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}
                onClick={()=>set(p.key,!form[p.key])}>
                {form[p.key]?"✓ ":""}{p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          <button style={{...S.btnP,background:"transparent",color:"#64748b",border:"1px solid #334155",flex:1}} onClick={()=>setShowTplModal(false)}>Annuler</button>
          {form.id&&(
            <button style={{...S.btnP,background:"#0ea5e9",flex:2}} disabled={!form.name}
              onClick={()=>saveTpl(form)}>
              💾 Écraser l'original
            </button>
          )}
          <button style={{...S.btnP,background:"#4ade80",color:"#0f1923",flex:2}} disabled={!form.name}
            onClick={()=>{
              const {id:_,is_default:__,...rest} = form;
              saveTpl({...rest, name: form.id ? form.name+" (copie)" : form.name, is_default:false});
            }}>
            ✨ {form.id?"Enregistrer comme nouveau":"Créer le template"}
          </button>
        </div>
      </Modal>
    );
  }

  // ---- Modal gestion athlètes du plan ----
  function ModalAthletes() {
    if(!selPlan) return null;
    const includes = overrides.filter(o=>o.type==="include");
    const excludes = overrides.filter(o=>o.type==="exclude");

    // Catégories du plan (peut être multiple "Master A, Master B")
    const planCats = (selPlan.category||"").split(",").map(s=>s.trim()).filter(Boolean);
    // Athlètes de la/les catégorie(s) du plan (base)
    const catAthletes = athletes.filter(a=>planCats.includes(a.category)||planCats.includes("Tous"));
    // Athlètes hors catégorie (pour pouvoir en ajouter)
    const otherAthletes = athletes.filter(a=>!planCats.includes(a.category)&&!planCats.includes("Tous"));

    const isIncluded  = (id) => includes.some(o=>o.athlete_id===id);
    const isExcluded  = (id) => excludes.some(o=>o.athlete_id===id);

    async function toggleInclude(athlete) {
      if(isIncluded(athlete.id)) {
        // Remove include override
        const o = includes.find(x=>x.athlete_id===athlete.id);
        try {
          await api.deletePlanOverride(o.id);
          setOverrides(prev=>prev.filter(x=>x.id!==o.id));
          showToast(`${athlete.name} retiré`);
        } catch(e) { showToast("Erreur","error"); }
      } else {
        // Add include override
        try {
          const res = await api.createPlanOverride({plan_id:selPlan.id,athlete_id:athlete.id,type:"include"});
          if(res&&res[0]) setOverrides(prev=>[...prev,res[0]]);
          showToast(`${athlete.name} ajouté`);
        } catch(e) { showToast("Erreur","error"); }
      }
    }

    async function toggleExclude(athlete) {
      if(isExcluded(athlete.id)) {
        // Remove exclude override (re-include)
        const o = excludes.find(x=>x.athlete_id===athlete.id);
        try {
          await api.deletePlanOverride(o.id);
          setOverrides(prev=>prev.filter(x=>x.id!==o.id));
          showToast(`${athlete.name} réintégré`);
        } catch(e) { showToast("Erreur","error"); }
      } else {
        // Add exclude override
        try {
          const res = await api.createPlanOverride({plan_id:selPlan.id,athlete_id:athlete.id,type:"exclude"});
          if(res&&res[0]) setOverrides(prev=>[...prev,res[0]]);
          showToast(`${athlete.name} exclu`);
        } catch(e) { showToast("Erreur","error"); }
      }
    }

    const total = catAthletes.length + includes.length - excludes.length;

    return (
      <Modal title={`👥 Athlètes — ${selPlan.name}`} onClose={()=>setShowAthletesModal(false)} wide>
        <div style={{marginBottom:16,padding:"10px 14px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,color:"#94a3b8",fontSize:13}}>
          <b style={{color:"#f1f5f9"}}>{total} athlète{total!==1?"s":""}</b> affecté{total!==1?"s":""} à ce plan
        </div>

        {/* Athlètes de la catégorie */}
        <div style={{marginBottom:20}}>
          <div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
            Groupe {selPlan.category} ({catAthletes.length})
          </div>
          {catAthletes.length===0&&<div style={{color:"#475569",fontSize:13,fontStyle:"italic"}}>Aucun athlète dans cette catégorie</div>}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {catAthletes.map(a=>{
              const excluded = isExcluded(a.id);
              return (
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:excluded?"#ef444408":"#1e293b",border:`1px solid ${excluded?"#ef444430":"#334155"}`,borderRadius:8,opacity:excluded?0.7:1}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"#0ea5e920",border:"1px solid #0ea5e940",display:"flex",alignItems:"center",justifyContent:"center",color:"#0ea5e9",fontWeight:800,fontSize:12,flexShrink:0}}>
                    {a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color: excluded?"#64748b":"#f1f5f9",fontSize:13,fontWeight:600,textDecoration:excluded?"line-through":"none"}}>{a.name}</div>
                    <div style={{color:"#64748b",fontSize:11}}>{a.category}</div>
                  </div>
                  {excluded
                    ? <button style={{...S.actionBtn,borderColor:"#4ade8030",color:"#4ade80",fontSize:11,padding:"4px 12px"}} onClick={()=>toggleExclude(a)}>Réintégrer</button>
                    : <button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",fontSize:11,padding:"4px 12px"}} onClick={()=>toggleExclude(a)}>Exclure</button>
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* Athlètes hors catégorie (ajout individuel) */}
        {otherAthletes.length>0&&(
          <div>
            <div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
              Autres athlètes — ajout individuel
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
              {otherAthletes.map(a=>{
                const included = isIncluded(a.id);
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:included?"#4ade8008":"#0f172a",border:`1px solid ${included?"#4ade8030":"#1e293b"}`,borderRadius:8}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"#33415520",border:"1px solid #33415540",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",fontWeight:800,fontSize:12,flexShrink:0}}>
                      {a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{color:"#f1f5f9",fontSize:13,fontWeight:600}}>{a.name}</div>
                      <div style={{color:"#64748b",fontSize:11}}>{a.category||"—"}</div>
                    </div>
                    {included
                      ? <button style={{...S.actionBtn,borderColor:"#ef444430",color:"#ef4444",fontSize:11,padding:"4px 12px"}} onClick={()=>toggleInclude(a)}>Retirer</button>
                      : <button style={{...S.actionBtn,borderColor:"#4ade8030",color:"#4ade80",fontSize:11,padding:"4px 12px"}} onClick={()=>toggleInclude(a)}>+ Ajouter</button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
          <button style={S.btnP} onClick={()=>setShowAthletesModal(false)}>Fermer</button>
        </div>
      </Modal>
    );
  }

  // ==================== RENDER ====================
  if(loading) return <div style={{padding:48,textAlign:"center",color:"#64748b"}}>Chargement du planning...</div>;


  return (
    <div style={{position:"relative"}}>
      {toast&&<div style={{position:"fixed",bottom:isMobile?80:24,right:24,background:toast.t==="error"?"#ef444420":"#4ade8020",border:`1px solid ${toast.t==="error"?"#ef4444":"#4ade80"}`,color:toast.t==="error"?"#ef4444":"#4ade80",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:700,zIndex:200}}>{toast.m}</div>}

      {view==="plans"    && <ViewPlans/>}
      {view==="timeline" && <ViewTimeline/>}
      {view==="semaine"  && <ViewSemaine/>}
      {view==="templates"&& <ViewTemplates/>}

      {showPlanModal    && <ModalPlan/>}
      {showWeekModal    && <ModalWeek/>}
      {showSessionModal && <ModalSession/>}
      {showTplModal     && <ModalTemplate/>}
      {showAthletesModal&& <ModalAthletes/>}
    </div>
  );
}
