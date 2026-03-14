import { useState, useEffect } from "react";
import { api } from "../config/supabase.js";

const TYPE_COLORS = { ERGO:"#0ea5e9", BATEAU:"#22d3ee", MUSCU:"#f97316" };
const TYPE_LABELS = { ERGO:"🚣 Ergo", BATEAU:"⛵ Bateau", MUSCU:"💪 Muscu" };

const CHAMPS_ERGO  = [["temps","Temps","ex: 1:52 / 6 min"],["allure","Allure /500m","ex: 1:52"],["watts","Watts","ex: 185"],["cadence","Cad. spm","ex: 24"]];
const CHAMPS_BAT   = [["distance","Distance","ex: 2×1000m"],["temps","Temps","ex: 3:42"],["allure","Allure /500m","ex: 1:51"],["cadence","Cad. spm","ex: 26"]];
const CHAMPS_MUSCU = [["series_reps","Séries×reps","ex: 4×10"],["charge","Charge","ex: 80kg"],["note_bloc","Ressenti","ex: lourd"]];

function emptyBloc(type) {
  if (type === "MUSCU") return { titre:"", series_reps:"", charge:"", note_bloc:"" };
  if (type === "BATEAU") return { titre:"", distance:"", temps:"", allure:"", cadence:"" };
  return { titre:"", temps:"", allure:"", watts:"", cadence:"" };
}

export default function MesSeances({ athlete, perfs, isMobile }) {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);

  // Formulaire
  const [type, setType]           = useState("ERGO");
  const [date, setDate]           = useState(new Date().toISOString().split("T")[0]);
  const [titre, setTitre]         = useState("");
  const [blocs, setBlocs]         = useState([emptyBloc("ERGO")]);
  const [ressenti, setRessenti]   = useState(null);
  const [commentaire, setComment] = useState("");

  // IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState(null);
  const [aiError, setAiError]     = useState(null);

  useEffect(() => { loadSessions(); }, [athlete?.id]);

  async function loadSessions() {
    if (!athlete) return;
    setLoading(true);
    const s = await api.getAthleteSessions(athlete.id).catch(() => []);
    setSessions(s || []);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setType("ERGO"); setDate(new Date().toISOString().split("T")[0]);
    setTitre(""); setBlocs([emptyBloc("ERGO")]); setRessenti(null); setComment("");
    setAiResult(null); setAiError(null);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditId(s.id);
    setType(s.type_seance); setDate(s.date); setTitre(s.titre || "");
    setBlocs(s.blocs?.length ? s.blocs : [emptyBloc(s.type_seance)]);
    setRessenti(s.ressenti || null); setComment(s.commentaire || "");
    setAiResult(null); setAiError(null);
    setShowForm(true);
  }

  function changeType(t) {
    setType(t); setBlocs([emptyBloc(t)]); setAiResult(null);
  }

  function addBloc() { setBlocs(b => [...b, emptyBloc(type)]); }
  function removeBloc(i) { setBlocs(b => b.filter((_, j) => j !== i)); }
  function updateBloc(i, field, val) {
    setBlocs(b => { const n = [...b]; n[i] = { ...n[i], [field]: val }; return n; });
  }

  async function save() {
    if (!date) return;
    const payload = {
      athlete_id: athlete.id, date, type_seance: type,
      titre: titre || TYPE_LABELS[type],
      blocs: blocs.filter(b => b.titre || b.temps || b.distance || b.series_reps),
      ressenti, commentaire,
    };
    try {
      if (editId) await api.updateAthleteSession(editId, payload);
      else await api.createAthleteSession(payload);
      setShowForm(false); loadSessions();
    } catch (e) { alert("Erreur : " + e.message); }
  }

  async function deleteSession(id) {
    if (!window.confirm("Supprimer cette séance ?")) return;
    await api.deleteAthleteSession(id);
    loadSessions();
  }

  async function callAI() {
    const mode = type === "MUSCU" ? "muscu" : "session";
    const validBlocs = blocs.filter(b => b.titre);
    if (!validBlocs.length) { setAiError("Remplis au moins un nom de bloc d'abord."); return; }
    setAiLoading(true); setAiResult(null); setAiError(null);
    try {
      const r = await fetch("/api/athlete_ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, athlete, perfs, blocs: validBlocs, session_type: type }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAiResult(data);
      // Injecter les résultats IA dans les blocs
      if (data.blocs) {
        setBlocs(prev => prev.map((b, i) => {
          const ai = data.blocs[i] || {};
          if (type === "MUSCU") return { ...b, series_reps: ai.series_reps || b.series_reps, charge: ai.charge_cible || b.charge, note_bloc: ai.conseil || b.note_bloc };
          return { ...b, allure: ai.allure || b.allure, watts: ai.watts || b.watts, cadence: ai.cadence || b.cadence };
        }));
      }
    } catch (e) { setAiError(e.message); }
    setAiLoading(false);
  }

  const INP = { background:"#0f172a", border:"1px solid #334155", borderRadius:6, color:"#f1f5f9", padding:"7px 10px", fontSize:13, width:"100%", boxSizing:"border-box" };
  const CHAMPS = type === "MUSCU" ? CHAMPS_MUSCU : type === "BATEAU" ? CHAMPS_BAT : CHAMPS_ERGO;
  const tc = TYPE_COLORS[type];

  // ─── VUE LISTE ───
  if (!showForm) return (
    <div style={{ padding: isMobile ? "16px 12px" : "28px 40px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:900, margin:0 }}>🏋️ Mes séances</h1>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Ergo · Bateau · Muscu</p>
        </div>
        <button onClick={openNew} style={{ padding:"10px 18px", borderRadius:10, border:"none", background:"#0ea5e9", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          + Nouvelle séance
        </button>
      </div>

      {loading ? <div style={{ color:"#64748b", textAlign:"center", padding:40 }}>Chargement...</div>
      : sessions.length === 0 ? (
        <div style={{ background:"#182030", borderRadius:16, padding:48, textAlign:"center", border:"1px dashed #334155" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🚣</div>
          <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:16, marginBottom:8 }}>Aucune séance enregistrée</div>
          <div style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>Saisis ta première séance pour commencer le suivi</div>
          <button onClick={openNew} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:"#0ea5e9", color:"#fff", fontWeight:700, cursor:"pointer" }}>
            + Commencer
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {sessions.map(s => {
            const col = TYPE_COLORS[s.type_seance] || "#64748b";
            const blocs = s.blocs || [];
            return (
              <div key={s.id} style={{ background:"#182030", borderRadius:12, border:`1px solid ${col}25`, overflow:"hidden" }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom: blocs.length ? "1px solid #1e293b" : "none" }}>
                  <span style={{ background:col+"20", color:col, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {TYPE_LABELS[s.type_seance]}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.titre || TYPE_LABELS[s.type_seance]}</div>
                    <div style={{ color:"#475569", fontSize:11 }}>{s.date}</div>
                  </div>
                  {s.ressenti && (
                    <div style={{ background:`hsl(${(s.ressenti-1)*12},70%,35%)`, color:"#fff", borderRadius:6, padding:"2px 8px", fontSize:12, fontWeight:700, flexShrink:0 }}>
                      {s.ressenti}/10
                    </div>
                  )}
                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                    <button onClick={() => openEdit(s)} style={{ background:"none", border:"1px solid #334155", borderRadius:6, color:"#94a3b8", cursor:"pointer", padding:"4px 8px", fontSize:12 }}>✏️</button>
                    <button onClick={() => deleteSession(s.id)} style={{ background:"none", border:"1px solid #ef444430", borderRadius:6, color:"#ef4444", cursor:"pointer", padding:"4px 8px", fontSize:12 }}>🗑</button>
                  </div>
                </div>
                {/* Blocs résumé */}
                {blocs.length > 0 && (
                  <div style={{ padding:"8px 16px 12px", display:"flex", flexDirection:"column", gap:4 }}>
                    {blocs.slice(0, 3).map((b, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                        <span style={{ color:col, fontWeight:700, minWidth:16 }}>•</span>
                        <span style={{ color:"#e2e8f0", fontWeight:600 }}>{b.titre}</span>
                        <span style={{ color:"#475569" }}>
                          {b.allure && `${b.allure}/500m`}
                          {b.watts && ` · ${b.watts}W`}
                          {b.cadence && ` · ${b.cadence}spm`}
                          {b.series_reps && b.series_reps}
                          {b.charge && ` · ${b.charge}`}
                          {b.distance && b.distance}
                          {b.temps && ` · ${b.temps}`}
                        </span>
                      </div>
                    ))}
                    {blocs.length > 3 && <div style={{ color:"#334155", fontSize:11 }}>+{blocs.length-3} blocs</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── FORMULAIRE ───
  return (
    <div style={{ padding: isMobile ? "16px 12px" : "28px 40px", maxWidth:600, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => setShowForm(false)} style={{ background:"none", border:"1px solid #334155", borderRadius:8, color:"#94a3b8", cursor:"pointer", padding:"6px 12px", fontSize:13 }}>← Retour</button>
        <h1 style={{ color:"#f1f5f9", fontSize:18, fontWeight:800, margin:0 }}>
          {editId ? "Modifier la séance" : "Nouvelle séance"}
        </h1>
      </div>

      {/* Type + Date */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <div>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Type</div>
          <div style={{ display:"flex", gap:6 }}>
            {["ERGO","BATEAU","MUSCU"].map(t => (
              <button key={t} onClick={() => changeType(t)} style={{
                flex:1, padding:"8px 4px", borderRadius:8, border:`2px solid ${type===t?TYPE_COLORS[t]:"#334155"}`,
                background: type===t ? TYPE_COLORS[t]+"20" : "transparent",
                color: type===t ? TYPE_COLORS[t] : "#64748b",
                fontWeight: type===t ? 700 : 500, fontSize:11, cursor:"pointer",
              }}>
                {TYPE_LABELS[t].split(" ")[0]}<br/>{t === "ERGO" ? "Ergo" : t === "BATEAU" ? "Bateau" : "Muscu"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...INP }} />
        </div>
      </div>

      {/* Titre */}
      <div style={{ marginBottom:16 }}>
        <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Titre (optionnel)</div>
        <input placeholder={`ex: ${type==="ERGO"?"6×100m + 2×1000m":type==="BATEAU"?"16km avec 2×1000m à 24":"Séance force max"}`}
          value={titre} onChange={e => setTitre(e.target.value)} style={{ ...INP }} />
      </div>

      {/* Blocs */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>Blocs</div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={callAI} disabled={aiLoading} style={{
              padding:"4px 12px", borderRadius:6, border:`1px solid ${tc}50`,
              background: tc+"15", color:tc, fontSize:12, fontWeight:700, cursor:aiLoading?"wait":"pointer", opacity:aiLoading?0.6:1
            }}>
              {aiLoading ? "🤖 IA..." : "🤖 Cibles IA"}
            </button>
            <button onClick={addBloc} style={{
              padding:"4px 12px", borderRadius:6, border:"1px solid #334155",
              background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer"
            }}>+ Bloc</button>
          </div>
        </div>

        {aiError && <div style={{ background:"#ef444415", border:"1px solid #ef444430", borderRadius:8, padding:"8px 12px", color:"#ef4444", fontSize:12, marginBottom:10 }}>{aiError}</div>}

        {aiResult?.intro && (
          <div style={{ background:tc+"10", border:`1px solid ${tc}30`, borderRadius:8, padding:"8px 12px", color:tc, fontSize:12, marginBottom:10, fontStyle:"italic" }}>
            🤖 {aiResult.intro}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {blocs.map((bloc, i) => (
            <div key={i} style={{ background:"#0f172a", borderRadius:10, padding:"10px 12px", border:`1px solid ${tc}25` }}>
              <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                <input
                  placeholder={type==="MUSCU"?"Exercice (ex: Back squat, RDL...)":"Bloc (ex: 6×100m, 2×1000m allure course, 16km B1...)"}
                  value={bloc.titre} onChange={e => updateBloc(i,"titre",e.target.value)}
                  style={{ ...INP, fontWeight:700, flex:1 }}
                />
                {blocs.length > 1 && (
                  <button onClick={() => removeBloc(i)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:16, padding:"0 4px" }}>✕</button>
                )}
              </div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${CHAMPS.length},1fr)`, gap:6 }}>
                {CHAMPS.map(([field, label, ph]) => (
                  <div key={field}>
                    <div style={{ color:"#475569", fontSize:10, marginBottom:3 }}>{label}</div>
                    <input placeholder={ph} value={bloc[field]||""} onChange={e => updateBloc(i,field,e.target.value)}
                      style={{ ...INP, padding:"5px 8px", fontSize:12 }} />
                  </div>
                ))}
              </div>
              {/* Badge IA si résultat */}
              {aiResult?.blocs?.[i] && (
                <div style={{ marginTop:6, fontSize:11, color:tc, fontStyle:"italic" }}>
                  🤖 {aiResult.blocs[i].conseil}
                  {aiResult.blocs[i].estimation_1rm && ` · 1RM estimé: ${aiResult.blocs[i].estimation_1rm}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ressenti */}
      <div style={{ marginBottom:14 }}>
        <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Ressenti / 10</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const active = ressenti === n;
            const col = n<=3?"#ef4444":n<=6?"#f59e0b":n<=8?"#0ea5e9":"#4ade80";
            return <button key={n} onClick={() => setRessenti(active?null:n)}
              style={{ width:34, height:34, borderRadius:7, border:`2px solid ${active?col:"#334155"}`, background:active?col+"30":"transparent", color:active?col:"#64748b", fontWeight:active?800:500, fontSize:13, cursor:"pointer" }}>
              {n}
            </button>;
          })}
        </div>
      </div>

      {/* Commentaire */}
      <div style={{ marginBottom:20 }}>
        <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Commentaire</div>
        <textarea placeholder="Sensations, contexte, remarques..." value={commentaire} onChange={e => setComment(e.target.value)}
          style={{ ...INP, minHeight:60, resize:"vertical" }} />
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <button onClick={() => setShowForm(false)} style={{ flex:1, padding:12, borderRadius:10, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontWeight:600 }}>
          Annuler
        </button>
        <button onClick={save} style={{ flex:2, padding:12, borderRadius:10, border:"none", background:tc, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14 }}>
          {editId ? "Enregistrer" : "✅ Valider la séance"}
        </button>
      </div>
    </div>
  );
}
