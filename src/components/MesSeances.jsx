import { useState, useEffect } from "react";
import { api } from "../config/supabase.js";

const TYPE_COLORS = { ERGO:"#0ea5e9", BATEAU:"#22d3ee", MUSCU:"#f97316" };
const TYPE_LABELS = { ERGO:"🚣 Ergo", BATEAU:"⛵ Bateau", MUSCU:"💪 Muscu" };

const CHAMPS_ERGO  = [["temps","Temps","ex: 1:52"],["allure","Allure /500m","ex: 1:52"],["watts","Watts","ex: 185"],["cadence","Cad. spm","ex: 24"]];
const CHAMPS_BAT   = [["distance","Distance","ex: 2×1000m"],["temps","Temps","ex: 3:42"],["allure","Allure /500m","ex: 1:51"],["cadence","Cad. spm","ex: 26"]];

function emptyBloc(type) {
  if (type === "MUSCU") return { titre:"", groupe:"", series:"", reps:"", charge:"", charge_cible:"", rm_estime:"", note_bloc:"", ia_conseil:"" };
  if (type === "BATEAU") return { titre:"", distance:"", temps:"", allure:"", cadence:"" };
  return { titre:"", temps:"", allure:"", watts:"", cadence:"" };
}

// ── Exercices suggérés par catégorie ──
const EXOS_SUGGEST = [
  "Back squat","Front squat","Squat dynamique",
  "RDL","Hip thrust","Fentes bulgares","Fentes marchées","Montée de box",
  "Développé couché","Développé militaire","Push press",
  "Rowing barre","Rowing haltères","Tirage vertical","Tirage horizontal poulie",
  "Gainage","Hollow rocks","Pallof press","Copenhagen plank",
  "Trap bar jump","Jump squat","Med ball throw",
];

export default function MesSeances({ athlete, perfs, isMobile }) {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);

  const [type, setType]           = useState("MUSCU");
  const [date, setDate]           = useState(new Date().toISOString().split("T")[0]);
  const [titre, setTitre]         = useState("");
  const [blocs, setBlocs]         = useState([emptyBloc("MUSCU")]);
  const [ressenti, setRessenti]   = useState(null);
  const [commentaire, setComment] = useState("");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone]       = useState(false);
  const [aiError, setAiError]     = useState(null);

  useEffect(() => { loadSessions(); }, [athlete?.id]);

  async function loadSessions() {
    if (!athlete) return;
    setLoading(true);
    const raw = await api.getAthleteSessions(athlete.id).catch(() => []);
    // Adapter le format session_completions → format séance
    const parsed = (raw||[]).map(r => {
      const meta = r.blocs_realises?._meta || {};
      return {
        id: r.id,
        athlete_id: r.athlete_id,
        date: meta.date || r.created_at?.split('T')[0] || '',
        type_seance: meta.type_seance || 'MUSCU',
        titre: meta.titre || '',
        blocs: r.blocs_realises?.blocs || [],
        ressenti: r.note,
        commentaire: r.commentaire,
      };
    });
    setSessions(parsed);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setType("MUSCU"); setDate(new Date().toISOString().split("T")[0]);
    setTitre(""); setBlocs([emptyBloc("MUSCU")]); setRessenti(null); setComment("");
    setAiDone(false); setAiError(null);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditId(s.id);
    setType(s.type_seance); setDate(s.date); setTitre(s.titre || "");
    setBlocs(s.blocs?.length ? s.blocs : [emptyBloc(s.type_seance)]);
    setRessenti(s.ressenti || null); setComment(s.commentaire || "");
    setAiDone(false); setAiError(null);
    setShowForm(true);
  }

  function changeType(t) {
    setType(t);
    const first = emptyBloc(t);
    if (t === "MUSCU") first.groupe = "A1";
    setBlocs([first]); setAiDone(false); setAiError(null);
  }

  function getGroupeBloc(index) {
    if (type !== "MUSCU") return null;
    const g = ["A","A","B","B","C","C","D","D"];
    const pos = ["1","2","1","2","1","2","1","2"];
    return { lettre: g[index] || String.fromCharCode(65 + Math.floor(index/2)), pos: pos[index] || "1" };
  }
  function addBloc() {
    const nb = blocs.length;
    const bloc = emptyBloc(type);
    if (type === "MUSCU") {
      const g = getGroupeBloc(nb);
      bloc.groupe = g ? g.lettre + g.pos : "";
    }
    setBlocs(b => [...b, bloc]);
  }
  function removeBloc(i) { setBlocs(b => b.filter((_, j) => j !== i)); }
  function updateBloc(i, field, val) {
    setBlocs(b => { const n = [...b]; n[i] = { ...n[i], [field]: val }; return n; });
  }

  async function save() {
    if (!date) return;
    const payload = {
      athlete_id: athlete.id, date, type_seance: type,
      titre: titre || TYPE_LABELS[type],
      blocs: blocs.filter(b => b.titre),
      ressenti, commentaire,
    };
    try {
      if (editId) await api.updateAthleteSession(editId, payload);
      else await api.createAthleteSession(payload);
      setShowForm(false); loadSessions();
    } catch (e) { alert("Erreur : " + e.message); }
  }

  async function callAI() {
    const validBlocs = blocs.filter(b => b.titre);
    if (!validBlocs.length) { setAiError("Nomme au moins un exercice."); return; }
    setAiLoading(true); setAiDone(false); setAiError(null);
    try {
      const r = await fetch("/api/athlete_ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: type === "MUSCU" ? "muscu" : "session",
          athlete, perfs, blocs: validBlocs, session_type: type
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      // Injecter dans les blocs
      if (data.blocs) {
        setBlocs(prev => prev.map((b, i) => {
          const ai = data.blocs[i] || {};
          if (type === "MUSCU") return {
            ...b,
            series: ai.series_reps?.split("×")[0] || b.series,
            reps: ai.series_reps?.split("×")[1]?.replace(/[^0-9-]/g,"") || b.reps,
            charge_cible: ai.charge_cible || b.charge_cible,
            rm_estime: ai.estimation_1rm || b.rm_estime,
            ia_conseil: ai.conseil || b.ia_conseil,
          };
          return { ...b, allure: ai.allure || b.allure, cadence: ai.cadence || b.cadence };
        }));
        setAiDone(true);
      }
    } catch (e) { setAiError(e.message); }
    setAiLoading(false);
  }

  const INP = { background:"#0f172a", border:"1px solid #334155", borderRadius:6, color:"#f1f5f9", padding:"7px 10px", fontSize:13, width:"100%", boxSizing:"border-box" };
  const tc = TYPE_COLORS[type];

  // ─── VUE LISTE ───
  if (!showForm) return (
    <div style={{ padding: isMobile ? "16px 12px" : "28px 40px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:900, margin:0 }}>🏋️ Mes séances</h1>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Ergo · Bateau · Muscu</p>
        </div>
        <button onClick={openNew} style={{ padding:"10px 18px", borderRadius:10, border:"none", background:"#f97316", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          + Nouvelle séance
        </button>
      </div>

      {loading ? <div style={{ color:"#64748b", textAlign:"center", padding:40 }}>Chargement...</div>
      : sessions.length === 0 ? (
        <div style={{ background:"#182030", borderRadius:16, padding:48, textAlign:"center", border:"1px dashed #334155" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💪</div>
          <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:16, marginBottom:8 }}>Aucune séance enregistrée</div>
          <div style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>Saisis ta première séance</div>
          <button onClick={openNew} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:"#f97316", color:"#fff", fontWeight:700, cursor:"pointer" }}>
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
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom: blocs.length ? "1px solid #1e293b" : "none" }}>
                  <span style={{ background:col+"20", color:col, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {TYPE_LABELS[s.type_seance]}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.titre}</div>
                    <div style={{ color:"#475569", fontSize:11 }}>{s.date}</div>
                  </div>
                  {s.ressenti && (
                    <div style={{ background:`hsl(${(s.ressenti-1)*12},70%,35%)`, color:"#fff", borderRadius:6, padding:"2px 8px", fontSize:12, fontWeight:700, flexShrink:0 }}>
                      {s.ressenti}/10
                    </div>
                  )}
                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                    <button onClick={() => openEdit(s)} style={{ background:"none", border:"1px solid #334155", borderRadius:6, color:"#94a3b8", cursor:"pointer", padding:"4px 8px", fontSize:12 }}>✏️</button>
                    <button onClick={async () => { if(window.confirm("Supprimer ?")) { await api.deleteAthleteSession(s.id); loadSessions(); } }} style={{ background:"none", border:"1px solid #ef444430", borderRadius:6, color:"#ef4444", cursor:"pointer", padding:"4px 8px", fontSize:12 }}>🗑</button>
                  </div>
                </div>
                {blocs.length > 0 && (
                  <div style={{ padding:"8px 16px 12px" }}>
                    {blocs.slice(0,4).map((b, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"baseline", gap:8, fontSize:12, marginBottom:3 }}>
                        <span style={{ color:col, fontWeight:700 }}>•</span>
                        <span style={{ color:"#e2e8f0", fontWeight:600 }}>{b.titre}</span>
                        {s.type_seance === "MUSCU" ? (
                          <span style={{ color:"#475569" }}>
                            {b.series&&b.reps?`${b.series}×${b.reps}`:b.series_reps||""}
                            {b.charge&&` · ${b.charge}`}
                            {b.charge_cible&&!b.charge&&` · ${b.charge_cible}`}
                            {b.rm_estime&&<span style={{ color:"#f97316", marginLeft:4 }}>1RM ~{b.rm_estime}</span>}
                          </span>
                        ) : (
                          <span style={{ color:"#475569" }}>
                            {b.allure&&`${b.allure}/500m`}{b.cadence&&` · ${b.cadence}spm`}
                          </span>
                        )}
                      </div>
                    ))}
                    {blocs.length > 4 && <div style={{ color:"#334155", fontSize:11 }}>+{blocs.length-4} exercices</div>}
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
  const CHAMPS = type === "BATEAU" ? CHAMPS_BAT : CHAMPS_ERGO;

  return (
    <div style={{ padding: isMobile ? "16px 12px" : "28px 40px", maxWidth:600, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => setShowForm(false)} style={{ background:"none", border:"1px solid #334155", borderRadius:8, color:"#94a3b8", cursor:"pointer", padding:"6px 12px", fontSize:13 }}>← Retour</button>
        <h1 style={{ color:"#f1f5f9", fontSize:18, fontWeight:800, margin:0 }}>
          {editId ? "Modifier" : "Nouvelle séance"}
        </h1>
      </div>

      {/* Type + Date */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <div>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Type</div>
          <div style={{ display:"flex", gap:6 }}>
            {["MUSCU","ERGO","BATEAU"].map(t => (
              <button key={t} onClick={() => changeType(t)} style={{
                flex:1, padding:"8px 4px", borderRadius:8,
                border:`2px solid ${type===t?TYPE_COLORS[t]:"#334155"}`,
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
        <input
          placeholder={type==="MUSCU"?"ex: Force max — Jambes + Dos":"ex: 6×100m + 2×250m vitesse"}
          value={titre} onChange={e => setTitre(e.target.value)} style={{ ...INP }}
        />
      </div>

      {/* ─── BLOCS ─── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
            {type === "MUSCU" ? "Exercices" : "Blocs"}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {/* Bouton IA */}
            <button onClick={callAI} disabled={aiLoading} style={{
              padding:"5px 12px", borderRadius:7,
              border:`1px solid ${tc}60`,
              background: aiDone ? tc+"25" : tc+"10",
              color: tc, fontSize:12, fontWeight:700,
              cursor: aiLoading ? "wait" : "pointer",
              opacity: aiLoading ? 0.6 : 1,
              display:"flex", alignItems:"center", gap:5,
            }}>
              {aiLoading ? "🤖 Calcul..." : aiDone ? "🤖 Rechargé ✓" : "🤖 Suggestions IA"}
            </button>
            <button onClick={addBloc} style={{
              padding:"5px 12px", borderRadius:7, border:"1px solid #334155",
              background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer"
            }}>+ {type === "MUSCU" ? "Exercice" : "Bloc"}</button>
          </div>
        </div>

        {aiError && <div style={{ background:"#ef444415", border:"1px solid #ef444430", borderRadius:8, padding:"8px 12px", color:"#ef4444", fontSize:12, marginBottom:10 }}>{aiError}</div>}
        {aiDone && type === "MUSCU" && (
          <div style={{ background:"#f9741610", border:"1px solid #f9741630", borderRadius:8, padding:"8px 12px", color:"#f97316", fontSize:12, marginBottom:10 }}>
            🤖 Charges et 1RM estimés d'après tes données — ajuste selon ta forme du jour
          </div>
        )}

        {/* ─── MUSCU : blocs A/B/C ─── */}
        {type === "MUSCU" ? (()=>{
          const groupes = {};
          blocs.forEach((b,i) => {
            const lettre = b.groupe?.[0] || String.fromCharCode(65+Math.floor(i/2));
            if (!groupes[lettre]) groupes[lettre] = [];
            groupes[lettre].push({b,i});
          });
          const COULEURS_G = {A:"#f97316",B:"#0ea5e9",C:"#a78bfa",D:"#4ade80"};
          return(
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {Object.entries(groupes).map(([lettre,items]) => {
                const gc = COULEURS_G[lettre] || tc;
                return(
                  <div key={lettre} style={{ border:`1px solid ${gc}35`, borderRadius:12, overflow:"hidden" }}>
                    {/* Header groupe */}
                    <div style={{ background:gc+"18", padding:"8px 14px", display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:26,height:26,borderRadius:"50%",background:gc,color:"#fff",fontWeight:900,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{lettre}</div>
                      <div style={{ color:gc,fontWeight:700,fontSize:12,flex:1 }}>Bloc {lettre} {items.length>1?`— Superset ×${items.length}`:""}</div>
                      <button onClick={()=>{
                        const bloc=emptyBloc("MUSCU"); bloc.groupe=lettre+(items.length+1);
                        setBlocs(b=>{ const n=[...b]; n.splice(items[items.length-1].i+1,0,bloc); return n; });
                      }} style={{ background:"none",border:`1px solid ${gc}40`,borderRadius:5,color:gc,cursor:"pointer",fontSize:10,padding:"2px 7px" }}>+ Exo</button>
                    </div>
                    {/* Exercices */}
                    {items.map(({b:bloc,i},pos)=>(
                      <div key={i} style={{ padding:"10px 14px",borderTop:pos>0?"1px solid #1e293b":"none",background:"#0f172a" }}>
                        <div style={{ display:"flex",gap:6,marginBottom:8 }}>
                          <span style={{ background:gc+"22",color:gc,borderRadius:4,padding:"1px 7px",fontSize:11,fontWeight:800,flexShrink:0,alignSelf:"center" }}>{lettre}{pos+1}</span>
                          <input list={`exos-${i}`} placeholder="Exercice (ex: Back squat)"
                            value={bloc.titre} onChange={e=>updateBloc(i,"titre",e.target.value)}
                            style={{ ...INP,fontWeight:700,flex:1,borderColor:bloc.titre?gc+"50":"#334155" }}/>
                          <datalist id={`exos-${i}`}>{EXOS_SUGGEST.map(e=><option key={e} value={e}/>)}</datalist>
                          {blocs.length>1&&<button onClick={()=>removeBloc(i)} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:15,padding:"0 3px" }}>✕</button>}
                        </div>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:bloc.charge_cible||bloc.rm_estime?8:0 }}>
                          {[["series","Séries","4","number"],["reps","Répétitions","10 ou 6-8","text"],["charge","Charge (kg)","80","number"]].map(([f,l,p,t])=>(
                            <div key={f}>
                              <div style={{ color:"#475569",fontSize:10,fontWeight:700,marginBottom:3 }}>{l}</div>
                              <input type={t} placeholder={p} value={bloc[f]||""} onChange={e=>updateBloc(i,f,e.target.value)}
                                style={{ ...INP,padding:"6px 8px",fontSize:13,textAlign:"center" }}/>
                            </div>
                          ))}
                        </div>
                        {(bloc.charge_cible||bloc.rm_estime)&&(
                          <div style={{ background:gc+"10",border:`1px solid ${gc}25`,borderRadius:7,padding:"6px 10px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:6 }}>
                            <span style={{ fontSize:10,color:"#64748b" }}>🤖</span>
                            {bloc.charge_cible&&<span style={{ background:gc+"25",color:gc,borderRadius:4,padding:"1px 8px",fontSize:11,fontWeight:800 }}>Cible : {bloc.charge_cible}</span>}
                            {bloc.rm_estime&&<span style={{ background:"#a78bfa25",color:"#a78bfa",borderRadius:4,padding:"1px 8px",fontSize:11,fontWeight:800 }}>1RM ~{bloc.rm_estime}</span>}
                            {bloc.ia_conseil&&<span style={{ color:"#64748b",fontSize:10,fontStyle:"italic",width:"100%",marginTop:1 }}>{bloc.ia_conseil}</span>}
                          </div>
                        )}
                        <input placeholder="Note (ex: propre, lourd, technique OK...)" value={bloc.note_bloc||""} onChange={e=>updateBloc(i,"note_bloc",e.target.value)}
                          style={{ ...INP,padding:"5px 8px",fontSize:11,color:"#94a3b8" }}/>
                      </div>
                    ))}
                  </div>
                );
              })}
              <button onClick={()=>{
                const nextL=String.fromCharCode(65+Object.keys(groupes).length);
                const b1=emptyBloc("MUSCU"); b1.groupe=nextL+"1";
                const b2=emptyBloc("MUSCU"); b2.groupe=nextL+"2";
                setBlocs(prev=>[...prev,b1,b2]);
              }} style={{ alignSelf:"flex-start",background:"transparent",border:`1px dashed ${tc}40`,borderRadius:8,color:tc,cursor:"pointer",fontSize:12,padding:"6px 14px" }}>
                + Nouveau bloc ({String.fromCharCode(65+Object.keys(groupes).length)})
              </button>
            </div>
          );
        })() : (
          /* ─── Ergo / Bateau ─── */
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {blocs.map((bloc,i)=>(
              <div key={i} style={{ background:"#0f172a",borderRadius:10,padding:"10px 12px",border:`1px solid ${tc}20` }}>
                <div style={{ display:"flex",gap:6,marginBottom:8 }}>
                  <input placeholder="Bloc (ex: 6×100m, 2×250m vitesse, 16km B1...)"
                    value={bloc.titre} onChange={e=>updateBloc(i,"titre",e.target.value)}
                    style={{ ...INP,fontWeight:700,flex:1 }}/>
                  {blocs.length>1&&<button onClick={()=>removeBloc(i)} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:15 }}>✕</button>}
                </div>
                <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":`repeat(${CHAMPS.length},1fr)`,gap:6 }}>
                  {CHAMPS.map(([f,l,p])=>(
                    <div key={f}>
                      <div style={{ color:"#475569",fontSize:10,marginBottom:3 }}>{l}</div>
                      <input placeholder={p} value={bloc[f]||""} onChange={e=>updateBloc(i,f,e.target.value)}
                        style={{ ...INP,padding:"5px 8px",fontSize:12 }}/>
                    </div>
                  ))}
                  {bloc.allure&&aiDone&&(
                    <div style={{ gridColumn:"1/-1",marginTop:4,display:"flex",gap:6 }}>
                      <span style={{ background:"#0ea5e925",color:"#0ea5e9",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700 }}>🤖 {bloc.allure}/500m</span>
                      {bloc.cadence&&<span style={{ background:"#a78bfa25",color:"#a78bfa",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700 }}>{bloc.cadence} spm</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ressenti */}
      <div style={{ marginBottom:14 }}>
        <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Ressenti global / 10</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const active = ressenti === n;
            const col = n<=3?"#ef4444":n<=6?"#f59e0b":n<=8?"#0ea5e9":"#4ade80";
            return <button key={n} onClick={() => setRessenti(active?null:n)}
              style={{ width:36, height:36, borderRadius:7, border:`2px solid ${active?col:"#334155"}`, background:active?col+"30":"transparent", color:active?col:"#64748b", fontWeight:active?800:500, fontSize:13, cursor:"pointer" }}>
              {n}
            </button>;
          })}
        </div>
      </div>

      {/* Commentaire */}
      <div style={{ marginBottom:20 }}>
        <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Commentaire</div>
        <textarea placeholder="Sensations, contexte, remarques..." value={commentaire} onChange={e => setComment(e.target.value)}
          style={{ ...INP, minHeight:56, resize:"vertical" }} />
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
