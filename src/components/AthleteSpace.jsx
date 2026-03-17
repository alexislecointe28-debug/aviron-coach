import { useState, useEffect, useCallback } from "react";
import { ROLE_COLORS, ROLE_LABELS, ZONE_COLORS, TYPE_COLORS, S } from "../styles.js";
import { api } from "../config/supabase.js";
import { FF, Modal, Toast, Loader, Sparkline, StatPill } from "./ui.jsx";
import { timeToSeconds, secondsToTime, concept2WattsFast, getBestTime, getLastPerf, calcAgeFromDOB, suggestRigging, avg } from "../utils/rowing.js";

// Formule d'Epley : 1RM estimé
function calc1RM(kg, reps) {
  if (!kg || !reps || reps <= 0) return null;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + reps / 30));
}
// Parser les reps depuis "6-8", "10", "4 à 6"
function parseReps(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(',', '.').match(/[\d.]+/)?.[0]);
  return isNaN(n) ? null : n;
}

export default function AthleteSpace({ currentUser, onLogout, managedSections=[] }) {
  const [tab,setTab]   = useState("dashboard");
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  const [athlete,setAthlete] = useState(null);
  const [myPerfs,setMyPerfs] = useState([]);
  const [crews,setCrews]     = useState([]);
  const [crewMembers,setCrewMembers] = useState([]);
  const [allAthletes,setAllAthletes] = useState([]);
  const [sessions,setSessions] = useState([]);
  const [sessionCrews,setSessionCrews] = useState([]);
  const [boats,setBoats]       = useState([]);
  const [boatCrews,setBoatCrews] = useState([]);
  const [boatSettings,setBoatSettings] = useState([]);
  const [loading,setLoading] = useState(true);
  const [editing,setEditing] = useState(false);
  const [showAddPerf,setShowAddPerf] = useState(false);
  const [editForm,setEditForm] = useState({});
  const [newPerf,setNP] = useState({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:"",distance_type:"2000m"});
  const [perfTypeFilter,setPerfTypeFilter] = useState("2000m");
  const [toast,setToast] = useState(null);
  const [dashWeek,setDashWeek]       = useState(null);
  const [dashSessions,setDashSessions] = useState([]);
  const [dashLoading,setDashLoading] = useState(false);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const safe = (p) => p.catch(()=>[]);
      const [aths,perfs,cr,cm,sess,sc,bt,bc,bs]=await Promise.all([safe(api.getAthletes()),safe(api.getPerformances()),safe(api.getCrews()),safe(api.getCrewMembers()),safe(api.getSessions()),safe(api.getSessionCrews()),safe(api.getBoats()),safe(api.getBoatCrews()),safe(api.getBoatSettings())]);
      const me=(aths||[]).find(a=>a.id===currentUser.athlete_id);
      setAthlete(me); setAllAthletes(aths||[]);
      setMyPerfs((perfs||[]).filter(p=>p.athlete_id===currentUser.athlete_id).sort((a,b)=>a.date.localeCompare(b.date)));
      setCrews(cr||[]); setCrewMembers(cm||[]); setSessions(sess||[]); setSessionCrews(sc||[]);
      setBoats(bt||[]); setBoatCrews(bc||[]); setBoatSettings(bs||[]);
      if(me) setEditForm({weight:me.weight,age:me.age});
    } catch(e){ console.error("Load error:", e); }
    setLoading(false);
  },[currentUser.athlete_id]);
  const [completions, setCompletions] = useState([]);
  const [morphoForm, setMorphoForm] = useState(null);
  const [morphoSaving, setMorphoSaving] = useState(false);
  const [morphoToast, setMorphoToast] = useState("");

  async function saveMorpho(athlete) {
    if (!athlete || !morphoForm) return;
    setMorphoSaving(true);
    try {
      await api.updateAthlete(athlete.id, {
        taille: morphoForm.taille ? +morphoForm.taille : null,
        envergure: morphoForm.envergure ? +morphoForm.envergure : null,
        longueur_bras: morphoForm.longueur_bras ? +morphoForm.longueur_bras : null,
        largeur_epaules: morphoForm.largeur_epaules ? +morphoForm.largeur_epaules : null,
        taille_assise: morphoForm.taille_assise ? +morphoForm.taille_assise : null,
        weight: morphoForm.weight ? +morphoForm.weight : null,
      });
      setMorphoForm(null);
      setMorphoToast("✅ Mesures enregistrées !");
      setTimeout(() => setMorphoToast(""), 3000);
    } catch(e) {
      setMorphoToast("❌ Erreur lors de la sauvegarde");
      setTimeout(() => setMorphoToast(""), 3000);
    }
    setMorphoSaving(false);
  }

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',handler);
    return()=>window.removeEventListener('resize',handler);
  },[]);

  const myCrew = athlete ? crews.find(c=>crewMembers.some(m=>m.crew_id===c.id&&m.athlete_id===athlete.id)) : null;
  const crewMates = myCrew ? allAthletes.filter(a=>crewMembers.some(m=>m.crew_id===myCrew.id&&m.athlete_id===a.id)&&a.id!==athlete?.id) : [];
  const mySessions = sessions.filter(s=>myCrew&&sessionCrews.some(sc=>sc.session_id===s.id&&sc.crew_id===myCrew.id));
  const filteredPerfs=myPerfs.filter(p=>(p.distance_type||"2000m")===perfTypeFilter);
  const best=getBestTime(filteredPerfs), last=getLastPerf(filteredPerfs);
  const lastWatts = last ? (concept2WattsFast(last.time, last.distance_type||"2000m")||last.watts||0) : null;
  const wpkg = lastWatts&&athlete?.weight ? (lastWatts/athlete.weight).toFixed(2) : null;

  async function saveEdit() {
    await api.updateAthlete(athlete.id,{weight:+editForm.weight,age:+editForm.age});
    setToast({m:"Fiche mise à jour v",t:"success"}); load(); setEditing(false);
  }
  async function addPerf() {
    if(!newPerf.date) { setToast({m:"Date invalide ou manquante",t:"error"}); return; }
    const watts = concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m") || 0;
    await api.createPerf({athlete_id:currentUser.athlete_id,date:newPerf.date,time:newPerf.time,watts,spm:+newPerf.spm,hr:+newPerf.hr,rpe:+newPerf.rpe,distance:+newPerf.distance,distance_type:newPerf.distance_type||"2000m"});
    setToast({m:"Performance enregistrée v",t:"success"}); load();
    setNP({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:"",distance_type:"2000m"}); setShowAddPerf(false);
  }

  // Charger les completions de l'athlète
  useEffect(() => {
    if (!athlete?.id) return;
    api.getSessionCompletions(athlete.id)
      .then(c => setCompletions(c||[]))
      .catch(() => {});
  }, [athlete?.id]);

  // Charge la semaine courante pour le dashboard
  useEffect(()=>{
    if(athlete) loadDashboardPlanning();
  },[athlete?.id]);

  async function loadDashboardPlanning() {
    setDashLoading(true);
    try {
      const allPlans = await api.getSeasonPlans().catch(()=>[]);
      const myPlans = (allPlans||[]).filter(p=>{
        const cats=p.category.split(",").map(s=>s.trim());
        return cats.includes(athlete.category)||cats.includes("Tous");
      });
      if(!myPlans.length){ setDashLoading(false); return; }
      const allWeeks=(await Promise.all(myPlans.map(p=>api.getPlanWeeks(p.id).catch(()=>[]))))
        .flat().sort((a,b)=>a.date_debut?.localeCompare(b.date_debut||"")||a.num_semaine-b.num_semaine);
      const today=new Date().toISOString().split("T")[0];
      const cur=allWeeks.find(w=>w.date_debut&&w.date_debut<=today)||allWeeks[0];
      if(cur){
        setDashWeek(cur);
        const s=await api.getPlannedSessions(cur.id).catch(()=>[]);
        setDashSessions(s||[]);
      }
    } catch(e){}
    setDashLoading(false);
  }

  const NAV=[{id:"dashboard",label:"Mon espace",icon:"*"},{id:"stats",label:"Mes stats",icon:"*"},{id:"crew",label:"Mon équipage",icon:"~"},{id:"boats",label:"Mon bateau",icon:"~"},{id:"planning",label:"Mon planning",icon:"#"},{id:"journal",label:"Journal",icon:"📓"},...(managedSections.length>0?[{id:"section",label:"Ma section",icon:"👥"}]:[])];
  if(loading) return <div style={{...S.root,alignItems:"center",justifyContent:"center"}}><Loader/></div>;
  if(!athlete) return <div style={{minHeight:"100vh",background:"#0f1923",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontFamily:"monospace"}}>Fiche athlète introuvable. Contacte ton coach.</div>;

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}

      {/* Sidebar desktop uniquement */}
      <aside style={{...S.sidebar,borderColor:"#2d1b4e",...(isMobile?{display:"none"}:{})}}>
        <div style={{...S.logo,borderColor:"#2d1b4e"}}><span style={{fontSize:28}}>~</span><div><div style={{...S.logoT,color:"#a78bfa"}}>AvironCoach</div><div style={S.logoS}>Espace Athlète</div></div></div>
        <nav style={{flex:1,padding:"8px 12px"}}>{NAV.map(n=><button key={n.id} style={{...S.nb,...(tab===n.id?{...S.nba,color:"#a78bfa",background:"#a78bfa15",borderLeftColor:"#a78bfa"}:{})}} onClick={()=>setTab(n.id)}><span style={{fontSize:16}}>{n.icon}</span>{n.label}</button>)}</nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #2d1b4e"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{...S.av,background:"#a78bfa22",border:"1px solid #a78bfa44",color:"#a78bfa"}}>{athlete.avatar}</div>
            <div><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{athlete.name}</div><div style={{fontSize:11,color:"#7a95b0"}}>{athlete.category}</div></div>
          </div>
          <button style={{...S.btnP,width:"100%",background:"transparent",color:"#7a95b0",border:"1px solid #1e293b",fontSize:12}} onClick={onLogout}>Deconnexion</button>
        </div>
      </aside>

      {/* Contenu principal */}
      <div style={{...S.main,paddingBottom:isMobile?64:0,width:isMobile?"100%":"auto",flex:1}}>
        {tab==="dashboard"&&(()=>{
          // ——— Jauge de forme ———
          const CHARGE_WEIGHTS = {"Légère":1,"Modérée":2,"Élevée":3,"Maximale":4,"Compétition":4};
          const TYPE_SEANCE_LABELS_D = {ERGO:"Ergo",BATEAU:"Bateau",MUSCU:"Muscu",REPOS:"Repos",AUTRE:"Autre"};
          const TYPE_SEANCE_COLORS_D = {ERGO:"#0ea5e9",BATEAU:"#4ade80",MUSCU:"#f97316",REPOS:"#334155",AUTRE:"#a78bfa"};
          const weekSessions = dashSessions.filter(s=>s.type_seance!=="REPOS");
          const chargeScore = weekSessions.reduce((sum,s)=>sum+(CHARGE_WEIGHTS[dashWeek?.charge]||1),0);
          const chargeMax = Math.max(weekSessions.length * 4, 1);
          const chargePct = Math.min(Math.round(chargeScore/chargeMax*100),100);
          const formeColor = chargePct<35?"#4ade80":chargePct<65?"#f59e0b":chargePct<85?"#f97316":"#ef4444";
          const formeLabel = chargePct<35?"Frais 🟢":chargePct<65?"Chargé 🟡":chargePct<85?"Élevé 🟠":"Limite 🔴";

          // ——— Séance du jour ———
          const todayJour = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][new Date().getDay()];
          const todaySessions = dashSessions.filter(s=>s.jour===todayJour&&s.type_seance!=="REPOS");
          const JOURS_ORDER = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
          const best2k = getBestTime(myPerfs.filter(p=>(p.distance_type||"2000m")==="2000m"));

          return (
          <div style={{padding:0,minHeight:"100%"}}>

            {/* ═══ HERO CARD ═══ */}
            <div style={{background:"linear-gradient(135deg,#1a0a2e 0%,#0f1923 50%,#0a1628 100%)",padding:isMobile?"24px 16px 20px":"32px 40px 28px",borderBottom:"1px solid #2d1b4e",position:"relative",overflow:"hidden"}}>
              {/* Déco fond */}
              <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"#a78bfa08",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:-20,left:-20,width:120,height:120,borderRadius:"50%",background:"#7c3aed08",pointerEvents:"none"}}/>

              <div style={{display:"flex",alignItems:"center",gap:isMobile?14:24,position:"relative"}}>
                {/* Avatar */}
                <div style={{flexShrink:0,width:isMobile?70:90,height:isMobile?70:90,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?28:36,border:"3px solid #a78bfa50",boxShadow:"0 0 30px #a78bfa30"}}>
                  {athlete.avatar}
                </div>
                {/* Identité */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#a78bfa",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Espace Athlète</div>
                  <div style={{color:"#f1f5f9",fontSize:isMobile?22:30,fontWeight:900,lineHeight:1.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{athlete.name}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                    <span style={{background:"#a78bfa20",border:"1px solid #a78bfa40",color:"#a78bfa",borderRadius:20,fontSize:11,fontWeight:700,padding:"2px 10px"}}>{athlete.category}</span>
                    {myCrew&&<span style={{background:"#0ea5e920",border:"1px solid #0ea5e940",color:"#0ea5e9",borderRadius:20,fontSize:11,fontWeight:700,padding:"2px 10px"}}>🚣 {myCrew.name}</span>}
                    {athlete.weight&&<span style={{background:"#f97316",color:"#fff",borderRadius:20,fontSize:11,fontWeight:700,padding:"2px 10px"}}>{athlete.weight} kg</span>}
                  </div>
                </div>
                <button style={{...S.btnP,background:"transparent",border:"1px solid #a78bfa50",color:"#a78bfa",fontSize:12,flexShrink:0}} onClick={()=>setEditing(true)}>✏️</button>
              </div>

              {/* ——— Best perf + W/kg ——— */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:20}}>
                <div style={{background:"#4ade8010",border:"1px solid #4ade8030",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Record 2k</div>
                  <div style={{color:"#4ade80",fontWeight:900,fontSize:isMobile?28:34,lineHeight:1}}>{best2k?.time??"--"}</div>
                  {best2k&&<div style={{color:"#5a7a9a",fontSize:10,marginTop:4}}>{best2k.date}</div>}
                </div>
                <div style={{background:"#a78bfa10",border:"1px solid #a78bfa30",borderRadius:12,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Puissance</div>
                  <div style={{color:"#a78bfa",fontWeight:900,fontSize:isMobile?28:34,lineHeight:1}}>{wpkg??"--"}<span style={{fontSize:14,fontWeight:400}}> W/kg</span></div>
                  {lastWatts&&<div style={{color:"#5a7a9a",fontSize:10,marginTop:4}}>{lastWatts} W</div>}
                </div>
              </div>
            </div>

            {/* ═══ JAUGE DE FORME ═══ */}
            <div style={{padding:isMobile?"16px 16px 0":"20px 40px 0"}}>
              <div style={{background:"#182030",border:`1px solid ${formeColor}30`,borderRadius:12,padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13}}>Forme cette semaine</div>
                    {dashWeek&&<div style={{color:"#64748b",fontSize:11,marginTop:2}}>S{dashWeek.num_semaine} · {weekSessions.length} séance{weekSessions.length!==1?"s":""} prévue{weekSessions.length!==1?"s":""}</div>}
                  </div>
                  <div style={{color:formeColor,fontWeight:800,fontSize:14}}>{formeLabel}</div>
                </div>
                <div style={{height:8,background:"#1e293b",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${chargePct}%`,background:`linear-gradient(90deg,#4ade80,${formeColor})`,borderRadius:4,transition:"width 0.6s ease"}}/>
                </div>
              </div>
            </div>

            {/* ═══ OBJECTIF SAISON ═══ */}
            {(athlete.objectif_saison||athlete.objectif_valeur)&&(
              <div style={{padding:isMobile?"12px 16px 0":"16px 40px 0"}}>
                <div style={{background:"#182030",border:"1px solid #a78bfa30",borderRadius:12,padding:"14px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:athlete.objectif_progress>0?10:0}}>
                    <div>
                      <div style={{color:"#a78bfa",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>🎯 Objectif saison</div>
                      <div style={{color:"#f1f5f9",fontWeight:700,fontSize:14}}>{athlete.objectif_saison||""}</div>
                      {athlete.objectif_valeur&&<div style={{color:"#94a3b8",fontSize:12,marginTop:2}}>{athlete.objectif_valeur}</div>}
                    </div>
                    {athlete.objectif_progress>0&&<div style={{color:"#a78bfa",fontWeight:900,fontSize:22}}>{Math.round(athlete.objectif_progress)}%</div>}
                  </div>
                  {athlete.objectif_progress>0&&(
                    <div style={{height:6,background:"#1e293b",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(athlete.objectif_progress,100)}%`,background:"linear-gradient(90deg,#7c3aed,#a78bfa)",borderRadius:3,transition:"width 0.8s ease"}}/>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ PLANNING DE LA SEMAINE ═══ */}
            <div style={{padding:isMobile?"16px 16px 0":"20px 40px 0"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15}}>📅 Cette semaine</div>
                <button style={{...S.actionBtn,borderColor:"#a78bfa40",color:"#a78bfa",fontSize:11}} onClick={()=>setTab("planning")}>Voir tout →</button>
              </div>
              {dashLoading?<div style={{color:"#64748b",fontSize:13,padding:"16px 0"}}>Chargement...</div>:
              dashSessions.length===0?<div style={{background:"#182030",border:"1px solid #334155",borderRadius:12,padding:"20px",textAlign:"center",color:"#5a7a9a",fontSize:13}}>Aucune séance planifiée cette semaine</div>:
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {JOURS_ORDER.map(jour=>{
                  const jourSessions=dashSessions.filter(s=>s.jour===jour);
                  if(!jourSessions.length) return null;
                  const isToday=jour===todayJour;
                  return(
                    <div key={jour} style={{background:isToday?"#a78bfa10":"#182030",border:`1px solid ${isToday?"#a78bfa50":"#1e293b"}`,borderRadius:10,padding:"10px 14px",position:"relative"}}>
                      {isToday&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:"#a78bfa",borderRadius:"10px 0 0 10px"}}/>}
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:isToday?"#a78bfa":"#475569",fontWeight:isToday?800:600,fontSize:12,minWidth:70}}>{isToday?"▶ Aujourd'hui":jour}</span>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1}}>
                          {jourSessions.map(s=>{
                            const tc=TYPE_SEANCE_COLORS_D[s.type_seance]||"#64748b";
                            const tl=TYPE_SEANCE_LABELS_D[s.type_seance]||s.type_seance;
                            if(s.type_seance==="REPOS") return <span key={s.id} style={{color:"#334155",fontSize:11}}>Repos</span>;
                            return <span key={s.id} style={{background:tc+"20",border:"1px solid "+tc+"50",color:tc,borderRadius:6,fontSize:11,fontWeight:700,padding:"2px 8px"}}>{tl}{s.title?" · "+s.title.slice(0,20):""}</span>;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>

            {/* ═══ DERNIÈRES PERFS ═══ */}
            <div style={{padding:isMobile?"16px":"20px 40px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15}}>⚡ Dernières performances</div>
                <button style={{...S.btnP,background:"#a78bfa",color:"#0f1923",fontSize:11,padding:"4px 12px"}} onClick={()=>setShowAddPerf(true)}>+ Ajouter</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...myPerfs].reverse().slice(0,3).map(p=>{
                  const pw=concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0;
                  const pwkg=pw&&athlete?.weight?(pw/athlete.weight).toFixed(2):null;
                  return(
                    <div key={p.id} style={{background:"#182030",border:"1px solid #1e293b",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <div style={{color:"#475569",fontSize:11,minWidth:80}}>{p.date}</div>
                      <div style={{color:"#4ade80",fontWeight:800,fontSize:16}}>{p.time}</div>
                      <div style={{color:"#0ea5e9",fontWeight:700,fontSize:13}}>⚡ {pw}W</div>
                      {pwkg&&<div style={{color:"#a78bfa",fontWeight:700,fontSize:12}}>{pwkg} W/kg</div>}
                      <div style={{marginLeft:"auto",background:`hsl(${(10-(p.rpe||5))*12},70%,40%)`,color:"#fff",borderRadius:6,fontSize:10,fontWeight:700,padding:"2px 7px"}}>RPE {p.rpe||"--"}</div>
                    </div>
                  );
                })}
                {!myPerfs.length&&<div style={{background:"#182030",border:"1px solid #1e293b",borderRadius:12,padding:"24px",textAlign:"center",color:"#5a7a9a",fontSize:13}}>Aucune performance enregistrée</div>}
              </div>
            </div>

          </div>);
        })()}
          {editing&&<Modal title="Éditer ma fiche" onClose={()=>setEditing(false)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Âge"><input style={S.inp} type="number" value={editForm.age} onChange={e=>setEditForm(p=>({...p,age:e.target.value}))}/></FF>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editForm.weight} onChange={e=>setEditForm(p=>({...p,weight:e.target.value}))}/></FF>
            </div>
            
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#0f1923"}} onClick={saveEdit}>Enregistrer</button>
          </Modal>}
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
            <FF label="Distance"><select style={S.inp} value={newPerf.distance_type} onChange={e=>setNP(p=>({...p,distance_type:e.target.value}))}><option>500m</option><option>1000m</option><option>2000m</option></select></FF>
            <FF label={`Temps ${newPerf.distance_type||"2000m"}`}><input style={S.inp} placeholder="6:45.0" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
            {newPerf.time&&concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m")&&(()=>{const w=concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m");const wpkgVal=athlete?.weight?(w/athlete.weight).toFixed(2):null;return(
              <div style={{padding:"10px 14px",background:"#a78bfa10",border:"1px solid #a78bfa30",borderRadius:8,marginBottom:12,display:"flex",gap:16,alignItems:"center"}}>
                <span style={{color:"#0ea5e9",fontWeight:700,fontSize:15}}>⚡ {w} W</span>
                {wpkgVal&&<span style={{color:"#a78bfa",fontWeight:700,fontSize:15}}>= {wpkgVal} W/kg</span>}
                <span style={{color:"#5a7a9a",fontSize:11,marginLeft:"auto"}}>Concept2 auto</span>
              </div>
            );})()}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="SPM"><input style={S.inp} type="number" value={newPerf.spm} onChange={e=>setNP(p=>({...p,spm:e.target.value}))}/></FF>
              <FF label="FC (bpm)"><input style={S.inp} type="number" value={newPerf.hr} onChange={e=>setNP(p=>({...p,hr:e.target.value}))}/></FF>
              <FF label="RPE (1-10)"><input style={S.inp} type="number" min="1" max="10" value={newPerf.rpe} onChange={e=>setNP(p=>({...p,rpe:e.target.value}))}/></FF>
              <FF label="Distance (km)"><input style={S.inp} type="number" value={newPerf.distance} onChange={e=>setNP(p=>({...p,distance:e.target.value}))}/></FF>
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#0f1923"}} onClick={addPerf}>Enregistrer</button>
          </Modal>}
        {tab==="stats"&&(()=>{
          // ——— Données courbe ———
          const perfs2k = myPerfs.filter(p=>(p.distance_type||"2000m")==="2000m").slice(-12);
          const perfs1k = myPerfs.filter(p=>p.distance_type==="1000m").slice(-12);
          const chartPerfs = perfTypeFilter==="1000m"?perfs1k:perfTypeFilter==="500m"?myPerfs.filter(p=>p.distance_type==="500m").slice(-12):perfs2k;
          const chartWatts = chartPerfs.map(p=>concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0);
          const chartTimes = chartPerfs.map(p=>timeToSeconds(p.time)).filter(Boolean);

          // ——— Records ———
          const recordWatts = Math.max(0,...myPerfs.map(p=>concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0));
          const recordWattsPerf = myPerfs.find(p=>(concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0)===recordWatts);
          const best2kPerf = getBestTime(perfs2k);
          const best1kPerf = getBestTime(perfs1k);

          // ——— Streak assiduité (séances validées consécutives) ———
          // On simule avec les perfs: chaque perf = 1 séance honorée
          const sortedDates=[...new Set(myPerfs.map(p=>p.date))].sort();
          let streak=0,maxStreak=0,cur=0;
          for(let i=0;i<sortedDates.length;i++){
            if(i===0){cur=1;}else{
              const d1=new Date(sortedDates[i-1]),d2=new Date(sortedDates[i]);
              const diff=Math.round((d2-d1)/(1000*60*60*24));
              cur=diff<=7?cur+1:1;
            }
            maxStreak=Math.max(maxStreak,cur);
          }
          streak=cur;

          // ——— Comparaison équipe ———
          const teamWatts = myCrew ? allAthletes
            .filter(a=>crewMembers.some(m=>m.crew_id===myCrew.id&&m.athlete_id===a.id))
            .map(a=>{
              const ap=myPerfs.filter(p=>p.athlete_id===a.id);
              const lp=ap[ap.length-1];
              return lp?(concept2WattsFast(lp.time,lp.distance_type||"2000m")||lp.watts||0):0;
            }).filter(Boolean) : [];
          const teamAvgW = teamWatts.length?Math.round(teamWatts.reduce((s,v)=>s+v,0)/teamWatts.length):null;
          const myRankW = teamWatts.length?[...teamWatts].sort((a,b)=>b-a).indexOf(lastWatts)+1:null;

          // ——— Mini courbe SVG animée ———
          function MiniChart({data, color, invert, label, unit, dispFn}) {
            if(!data||data.length<2) return null;
            const W=280,H=80,pad=8;
            const mn=Math.min(...data),mx=Math.max(...data);
            const range=mx-mn||1;
            const pts=data.map((v,i)=>{
              const x=pad+(i/(data.length-1))*(W-pad*2);
              const y=invert?pad+(v-mn)/range*(H-pad*2):H-pad-(v-mn)/range*(H-pad*2);
              return `${x},${y}`;
            }).join(" ");
            const last=data[data.length-1];
            const prev=data[data.length-2];
            const trend=invert?(last<prev):(last>prev);
            return(
              <div style={{background:"#0f1923",borderRadius:10,padding:"12px 14px",border:`1px solid ${color}25`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{color:trend?"#4ade80":"#ef4444",fontSize:11}}>{trend?"▲":"▼"}</span>
                    <span style={{color:color,fontWeight:900,fontSize:18}}>{dispFn?dispFn(last):last}{unit&&<span style={{fontSize:11,fontWeight:400,color:"#64748b"}}> {unit}</span>}</span>
                  </div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:60,overflow:"visible"}}>
                  <defs>
                    <linearGradient id={`g${label.replace(/ /g,'')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={color} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  {data.map((v,i)=>{
                    const x=pad+(i/(data.length-1))*(W-pad*2);
                    const y=invert?pad+(v-mn)/range*(H-pad*2):H-pad-(v-mn)/range*(H-pad*2);
                    return i===data.length-1?<circle key={i} cx={x} cy={y} r="4" fill={color} stroke="#0f1923" strokeWidth="2"/>:null;
                  })}
                </svg>
                <div style={{color:"#334155",fontSize:10,textAlign:"right"}}>{data.length} sessions</div>
              </div>
            );
          }

          return(
          <div style={{padding:isMobile?"16px 12px":"28px 40px"}}>

            {/* Filtre distance */}
            <div style={{display:"flex",gap:6,marginBottom:20}}>
              {["500m","1000m","2000m"].map(t=>(
                <button key={t} onClick={()=>setPerfTypeFilter(t)}
                  style={{padding:"5px 14px",borderRadius:8,border:`1px solid ${perfTypeFilter===t?"#a78bfa":"#1e293b"}`,background:perfTypeFilter===t?"#a78bfa20":"transparent",color:perfTypeFilter===t?"#a78bfa":"#5a7a9a",fontSize:12,cursor:"pointer",fontWeight:perfTypeFilter===t?700:400}}>
                  {t}
                </button>
              ))}
            </div>

            {/* ═══ RECORDS ═══ */}
            <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15,marginBottom:12}}>🏆 Records personnels</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:24}}>
              {[
                {label:"Best 2000m",value:best2kPerf?.time??"--",sub:best2kPerf?.date??"",color:"#4ade80",icon:"⏱"},
                {label:"Best 1000m",value:best1kPerf?.time??"--",sub:best1kPerf?.date??"",color:"#0ea5e9",icon:"⚡"},
                {label:"Record watts",value:recordWatts?`${recordWatts}W`:"--",sub:recordWattsPerf?.date??"",color:"#f59e0b",icon:"💥"},
                {label:"W/kg record",value:recordWatts&&athlete?.weight?`${(recordWatts/athlete.weight).toFixed(2)}`:"--",sub:`${athlete.weight}kg`,color:"#a78bfa",icon:"⚖️"},
              ].map((r,i)=>(
                <div key={i} style={{background:"#182030",border:`1px solid ${r.color}30`,borderRadius:12,padding:"14px",textAlign:"center"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{r.icon}</div>
                  <div style={{color:r.color,fontWeight:900,fontSize:isMobile?18:22}}>{r.value}</div>
                  <div style={{color:"#64748b",fontSize:10,marginTop:2,textTransform:"uppercase",letterSpacing:1}}>{r.label}</div>
                  {r.sub&&<div style={{color:"#475569",fontSize:10,marginTop:2}}>{r.sub}</div>}
                </div>
              ))}
            </div>

            {/* ═══ COURBES ═══ */}
            <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15,marginBottom:12}}>📈 Progression</div>
            {chartPerfs.length<2
              ?<div style={{background:"#182030",border:"1px solid #1e293b",borderRadius:12,padding:"32px",textAlign:"center",color:"#5a7a9a",marginBottom:24}}>
                Pas assez de données pour {perfTypeFilter} — ajoute des performances !
              </div>
              :<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:24}}>
                <MiniChart data={chartWatts} color="#0ea5e9" label="Puissance" unit="W" invert={false}/>
                <MiniChart data={chartTimes} color="#4ade80" label="Temps" invert={true} dispFn={secondsToTime}/>
                <MiniChart data={chartPerfs.map(p=>+((concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0)/(athlete.weight||1)).toFixed(2))} color="#a78bfa" label="W/kg" invert={false}/>
                <MiniChart data={chartPerfs.map(p=>p.distance||0)} color="#f97316" label="Distance" unit="km" invert={false}/>
              </div>
            }

            {/* ═══ PROGRESSION MUSCU ═══ */}
            {(()=>{
              // Agréger les charges par exercice depuis session_completions
              const muscuCompletions = completions
                .filter(c => c.blocs_realises?.length)
                .sort((a,b) => (a.completed_at||a.created_at) > (b.completed_at||b.created_at) ? 1 : -1);
              
              // Grouper par nom d'exercice
              const exoMap = {};
              muscuCompletions.forEach(c => {
                (c.blocs_realises||[]).forEach(b => {
                  if (!b.charge_kg && !b.rm_estime) return;
                  const key = b.titre;
                  if (!exoMap[key]) exoMap[key] = [];
                  exoMap[key].push({
                    date: c.completed_at||c.created_at,
                    kg: b.charge_kg,
                    rm: b.rm_estime,
                    prevu: b.prevu,
                  });
                });
              });

              const exos = Object.entries(exoMap).filter(([,pts])=>pts.length>=1);
              if (!exos.length) return null;

              return(
                <div style={{marginBottom:16}}>
                  <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15,marginBottom:12}}>💪 Progression muscu</div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
                    {exos.map(([nom, pts])=>{
                      const last = pts[pts.length-1];
                      const prev = pts[pts.length-2];
                      const rmVals = pts.map(p=>p.rm||p.kg||0).filter(Boolean);
                      const trend = prev ? (last.rm||last.kg||0) - (prev.rm||prev.kg||0) : 0;
                      const trendCol = trend > 0 ? "#4ade80" : trend < 0 ? "#ef4444" : "#64748b";
                      const maxRM = Math.max(...rmVals);
                      const minRM = Math.min(...rmVals);
                      const range = maxRM - minRM || 1;

                      return(
                        <div key={nom} style={{background:"#182030",border:"1px solid #a78bfa20",borderRadius:12,padding:"12px 14px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                            <div>
                              <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13}}>{nom}</div>
                              {last.prevu&&<div style={{color:"#475569",fontSize:10}}>{last.prevu}</div>}
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{color:"#a78bfa",fontWeight:900,fontSize:18,lineHeight:1}}>
                                {last.rm ? `~${last.rm}kg` : `${last.kg}kg`}
                              </div>
                              <div style={{color:"#64748b",fontSize:10}}>1RM estimé</div>
                            </div>
                          </div>
                          {/* Mini sparkline */}
                          {rmVals.length > 1 && (
                            <svg width="100%" height="32" style={{display:"block",marginBottom:6}}>
                              {rmVals.map((v,i)=>{
                                const x = i/(rmVals.length-1)*100+"%";
                                const y = 28 - ((v-minRM)/range)*24;
                                return i===0 ? null : (
                                  <line key={i}
                                    x1={(i-1)/(rmVals.length-1)*100+"%"} y1={28-((rmVals[i-1]-minRM)/range)*24}
                                    x2={x} y2={y}
                                    stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"/>
                                );
                              })}
                              {rmVals.map((v,i)=>{
                                const x = i/(rmVals.length-1)*100;
                                const y = 28 - ((v-minRM)/range)*24;
                                const isLast = i===rmVals.length-1;
                                return <circle key={i} cx={x+"%"} cy={y} r={isLast?4:2.5} fill={isLast?"#a78bfa":"#6d28d9"}/>;
                              })}
                            </svg>
                          )}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{color:"#475569",fontSize:11}}>{pts.length} session{pts.length>1?"s":""}</span>
                            {prev&&<span style={{color:trendCol,fontSize:12,fontWeight:700}}>
                              {trend>0?"↑":trend<0?"↓":"="} {Math.abs(trend)>0?Math.abs(trend)+"kg 1RM":"stable"}
                            </span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ═══ STREAK + COMPARAISON ═══ */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>

              {/* Streak */}
              <div style={{background:"#182030",border:"1px solid #f59e0b30",borderRadius:12,padding:"16px"}}>
                <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13,marginBottom:12}}>🔥 Assiduité</div>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{color:"#f59e0b",fontWeight:900,fontSize:36,lineHeight:1}}>{streak}</div>
                    <div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>Séances récentes</div>
                  </div>
                  <div style={{flex:1,borderLeft:"1px solid #1e293b",paddingLeft:16}}>
                    <div style={{color:"#94a3b8",fontSize:13,marginBottom:4}}>Record : <span style={{color:"#f59e0b",fontWeight:700}}>{maxStreak}</span></div>
                    <div style={{color:"#94a3b8",fontSize:13,marginBottom:4}}>Total sessions : <span style={{color:"#f1f5f9",fontWeight:700}}>{myPerfs.length}</span></div>
                    <div style={{color:"#94a3b8",fontSize:13}}>Km totaux : <span style={{color:"#f97316",fontWeight:700}}>{myPerfs.reduce((s,p)=>s+(p.distance||0),0)} km</span></div>
                  </div>
                </div>
              </div>

              {/* Comparaison équipe */}
              <div style={{background:"#182030",border:"1px solid #0ea5e930",borderRadius:12,padding:"16px"}}>
                <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13,marginBottom:12}}>👥 vs Équipe {myCrew?`(${myCrew.name})`:""}</div>
                {!myCrew||!teamAvgW
                  ?<div style={{color:"#5a7a9a",fontSize:13}}>Aucun équipage assigné</div>
                  :<>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div style={{flex:1}}>
                        <div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Toi</div>
                        <div style={{color:lastWatts>teamAvgW?"#4ade80":"#f97316",fontWeight:900,fontSize:22}}>{lastWatts??"--"}W</div>
                      </div>
                      <div style={{color:"#334155",fontSize:20}}>vs</div>
                      <div style={{flex:1,textAlign:"right"}}>
                        <div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Moy. équipe</div>
                        <div style={{color:"#0ea5e9",fontWeight:900,fontSize:22}}>{teamAvgW}W</div>
                      </div>
                    </div>
                    {myRankW&&<div style={{background:"#0f1923",borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:"#64748b",fontSize:12}}>Classement équipe</span>
                      <span style={{color:myRankW===1?"#f59e0b":"#94a3b8",fontWeight:800,fontSize:16}}>#{myRankW} {myRankW===1?"🥇":myRankW===2?"🥈":myRankW===3?"🥉":""}</span>
                    </div>}
                  </>
                }
              </div>
            </div>

          </div>);
        })()}
        {tab==="crew"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mon Équipage</h1><p style={S.sub}>Assigné par le coach</p></div></div>
          {!myCrew?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Aucun équipage assigné pour le moment.</div>:(<>
            <div style={{...S.card,marginBottom:20}}><div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:4}}>{myCrew.name}</div><div style={{color:"#7a95b0",fontSize:14,marginBottom:12}}>{myCrew.boat}</div>{myCrew.notes&&<div style={{background:"#1e293b50",borderRadius:8,padding:"10px",color:"#a8bfd4",fontSize:13}}> {myCrew.notes}</div>}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {allAthletes.filter(a=>crewMembers.some(m=>m.crew_id===myCrew.id&&m.athlete_id===a.id)).map(a=>{
                const perfs=myPerfs.filter(p=>p.athlete_id===a.id),lp=getLastPerf(a.id===athlete.id?myPerfs:[]),isMe=a.id===athlete.id;
                return(<div key={a.id} style={{...S.card,display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderColor:isMe?"#a78bfa44":"#263547",background:isMe?"#a78bfa08":"#182030"}}>
                  <div style={{...S.av,background:isMe?"#a78bfa22":"#22d3ee15",border:`1px solid ${isMe?"#a78bfa44":"#22d3ee30"}`,color:isMe?"#a78bfa":"#0ea5e9"}}>{a.avatar}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9"}}>{a.name} {isMe&&<span style={{color:"#a78bfa",fontSize:12}}>(toi)</span>}</div><div style={{color:"#7a95b0",fontSize:12}}>{a.category} - {a.weight}kg</div></div>
                  {isMe&&last&&<div style={{display:"flex",gap:10}}><StatPill label="2000m" value={last.time} color="#4ade80"/><StatPill label="Watts" value={`${last.watts}W`} color="#0ea5e9"/><StatPill label="W/kg" value={wpkg} color="#a78bfa"/></div>}
                </div>);
              })}
            </div>
          </>)}
        </div>)}
        {tab==="boats"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          {morphoToast&&<div style={{position:"fixed",bottom:24,right:24,background:"#0f172a",border:"1px solid #334155",color:"#f1f5f9",padding:"12px 20px",borderRadius:10,fontSize:13,fontWeight:700,zIndex:200}}>{morphoToast}</div>}
          <div style={S.ph}>
            <div><h1 style={S.ttl}>Mon Bateau</h1><p style={S.sub}>Réglages de ton poste</p></div>
          </div>

          {/* ── Section mesures morpho ── */}
          <div style={{background:"#182030",border:"1px solid #334155",borderRadius:14,padding:"16px 18px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:morphoForm?16:0}}>
              <div>
                <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15}}>📐 Mes mesures</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:2}}>Utilisées pour calculer tes réglages</div>
              </div>
              {!morphoForm&&(
                <button onClick={()=>setMorphoForm({
                  taille: athlete?.taille||"",
                  envergure: athlete?.envergure||"",
                  longueur_bras: athlete?.longueur_bras||"",
                  largeur_epaules: athlete?.largeur_epaules||"",
                  taille_assise: athlete?.taille_assise||"",
                  weight: athlete?.weight||"",
                })}
                  style={{background:"#0ea5e915",border:"1px solid #0ea5e940",color:"#0ea5e9",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {(athlete?.taille||athlete?.envergure)?"✏️ Modifier":"+ Saisir"}
                </button>
              )}
            </div>

            {/* Affichage des mesures existantes */}
            {!morphoForm&&(athlete?.taille||athlete?.envergure||athlete?.longueur_bras||athlete?.weight)?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12}}>
                {[
                  {label:"Taille",val:athlete?.taille,unit:"cm",icon:"📏"},
                  {label:"Poids",val:athlete?.weight,unit:"kg",icon:"⚖️"},
                  {label:"Envergure",val:athlete?.envergure,unit:"cm",icon:"↔️"},
                  {label:"Long. bras",val:athlete?.longueur_bras,unit:"cm",icon:"💪"},
                  {label:"Larg. épaules",val:athlete?.largeur_epaules,unit:"cm",icon:"🏊"},
                  {label:"Taille assise",val:athlete?.taille_assise,unit:"cm",icon:"🪑"},
                ].map((m,i)=>(
                  <div key={i} style={{background:"#0f172a",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:16,marginBottom:2}}>{m.icon}</div>
                    <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15}}>{m.val||"—"}{m.val?<span style={{fontSize:10,color:"#475569",marginLeft:2}}>{m.unit}</span>:""}</div>
                    <div style={{color:"#64748b",fontSize:10}}>{m.label}</div>
                  </div>
                ))}
              </div>
            ):!morphoForm&&(
              <div style={{color:"#475569",fontSize:13,marginTop:8,fontStyle:"italic"}}>
                Aucune mesure renseignée — le coach en a besoin pour régler ton bateau 👆
              </div>
            )}

            {/* Formulaire de saisie */}
            {morphoForm&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                  {[
                    {key:"taille",label:"Taille",unit:"cm",icon:"📏",placeholder:"ex: 180"},
                    {key:"weight",label:"Poids",unit:"kg",icon:"⚖️",placeholder:"ex: 75"},
                    {key:"envergure",label:"Envergure",unit:"cm",icon:"↔️",placeholder:"ex: 186",help:"Bras écartés, bout à bout"},
                    {key:"longueur_bras",label:"Long. de bras",unit:"cm",icon:"💪",placeholder:"ex: 48",help:"Coude → bout des doigts"},
                    {key:"largeur_epaules",label:"Larg. épaules",unit:"cm",icon:"🏊",placeholder:"ex: 44"},
                    {key:"taille_assise",label:"Taille assise",unit:"cm",icon:"🪑",placeholder:"ex: 92",help:"Siège → sommet du crâne"},
                  ].map(({key,label,unit,icon,placeholder,help})=>(
                    <div key={key}>
                      <label style={{display:"block",color:"#94a3b8",fontSize:11,fontWeight:600,marginBottom:4}}>
                        {icon} {label} <span style={{color:"#475569"}}>({unit})</span>
                      </label>
                      {help&&<div style={{color:"#475569",fontSize:10,marginBottom:3,fontStyle:"italic"}}>{help}</div>}
                      <input
                        type="number"
                        value={morphoForm[key]||""}
                        onChange={e=>setMorphoForm(f=>({...f,[key]:e.target.value}))}
                        placeholder={placeholder}
                        style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",padding:"9px 12px",fontSize:14,boxSizing:"border-box"}}
                      />
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setMorphoForm(null)}
                    style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#64748b",fontSize:13,cursor:"pointer"}}>
                    Annuler
                  </button>
                  <button onClick={()=>saveMorpho(athlete)} disabled={morphoSaving}
                    style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:"#0ea5e9",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:morphoSaving?0.6:1}}>
                    {morphoSaving?"Enregistrement...":"💾 Enregistrer mes mesures"}
                  </button>
                </div>
              </div>
            )}
          </div>
          {(()=>{
            if(!myCrew) return <div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Aucun équipage assigné.</div>;
            // Trouver le bateau lié à l'équipage de l'athlète
            const myBoatCrew = boatCrews.find(bc=>bc.crew_id===myCrew.id);
            const myBoat = myBoatCrew ? boats.find(b=>b.id===myBoatCrew.boat_id) : null;
            if(!myBoat) return <div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Aucun bateau assigné à ton équipage pour l'instant.</div>;
            // Trouver le poste de l'athlète dans l'équipage
            const members = crewMembers.filter(m=>m.crew_id===myCrew.id).map(m=>allAthletes.find(a=>a.id===m.athlete_id)).filter(Boolean);
            const myPoste = members.findIndex(a=>a.id===athlete.id)+1;
            // Réglages pour mon poste
            const mySettings = boatSettings.filter(s=>s.boat_id===myBoat.id&&s.poste===myPoste).sort((a,b)=>b.date_reglage.localeCompare(a.date_reglage));
            const lastSetting = mySettings[0];
            return(<>
              {/* Fiche bateau */}
              <div style={{...S.card,marginBottom:24,borderTop:"3px solid #a78bfa"}}>
                <div style={{display:"flex",alignItems:"center",gap:20}}>
                  <div style={{fontSize:48}}>~</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{myBoat.name}</div>
                    <div style={{color:"#7a95b0",fontSize:14,marginTop:2}}>{myBoat.brand} {myBoat.model} - {myBoat.type==="couple"?"Couple":"Pointe"} - {myBoat.seats} postes</div>
                    {myBoat.avg_buoyancy&&<div style={{color:"#f59e0b",fontSize:13,marginTop:4}}>~ Portance moyenne : {myBoat.avg_buoyancy} kg</div>}
                    {myBoat.notes&&<div style={{color:"#a8bfd4",fontSize:13,marginTop:6}}>{myBoat.notes}</div>}
                  </div>
                  <div style={{background:"#a78bfa20",border:"2px solid #a78bfa44",borderRadius:12,padding:"16px 24px",textAlign:"center"}}>
                    <div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Ton poste</div>
                    <div style={{color:"#a78bfa",fontWeight:900,fontSize:36}}>#{myPoste}</div>
                  </div>
                </div>
              </div>

              {/* Réglages actuels mon poste */}
              <div style={S.st}>~ Mes réglages actuels</div>
              {lastSetting?(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:28}}>
                  {[
                    {l:"Date réglage",v:lastSetting.date_reglage,c:"#7a95b0"},
                    {l:"Réglé par",v:lastSetting.regle_par||"--",c:"#a8bfd4"},
                    {l:"Entraxe",v:lastSetting.entraxe?`${lastSetting.entraxe} cm`:"--",c:"#0ea5e9"},
                    {l:"Long. Pelle",v:lastSetting.longueur_pedale?`${lastSetting.longueur_pedale} cm`:"--",c:"#a78bfa"},
                    {l:"Levier int.",v:lastSetting.levier_interieur?`${lastSetting.levier_interieur} cm`:"--",c:"#f59e0b"},
                    {l:"Ndeg pelle",v:lastSetting.numero_pelle||"--",c:"#f97316"},
                    {l:"Type de pelle",v:lastSetting.type_pelle||"--",c:"#4ade80"},
                  ].map((k,i)=>(
                    <div key={i} style={S.kpi}>
                      <div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{k.l}</div>
                      <div style={{color:k.c,fontWeight:700,fontSize:16}}>{k.v}</div>
                    </div>
                  ))}
                  {lastSetting.observations&&<div style={{...S.card,gridColumn:"1/-1",background:"#1e293b50"}}><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Observations</div><div style={{color:"#a8bfd4",fontSize:14}}>{lastSetting.observations}</div></div>}
                </div>
              ):<div style={{...S.card,textAlign:"center",padding:"32px",color:"#5a7a9a",marginBottom:28}}>Aucun réglage enregistré pour ton poste pour l'instant.</div>}

              {/* Historique */}
              {mySettings.length>1&&(<>
                <div style={S.st}>~ Historique de mes réglages</div>
                <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
                    <thead><tr>{["Date","Réglé par","Entraxe","Long. Pelle","Levier int.","Ndeg pelle","Type pelle","Observations"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {mySettings.map(s=>(
                        <tr key={s.id} style={{borderBottom:"1px solid #1e293b"}}>
                          <td style={{...S.td,color:"#7a95b0"}}>{s.date_reglage}</td>
                          <td style={S.td}>{s.regle_par||"--"}</td>
                          <td style={{...S.td,color:"#0ea5e9"}}>{s.entraxe?`${s.entraxe} cm`:"--"}</td>
                          <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"--"}</td>
                          <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"--"}</td>
                          <td style={S.td}>{s.numero_pelle||"--"}</td>
                          <td style={S.td}>{s.type_pelle||"--"}</td>
                          <td style={{...S.td,color:"#a8bfd4"}}>{s.observations||"--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>)}
            </>);
          })()}
        </div>)}
        {tab==="section"&&managedSections.length>0&&(
          <SectionManagerView
            managedSections={managedSections}
            currentUser={currentUser}
            isMobile={isMobile}
          />
        )}
        {tab==="journal"&&(()=>{
          const TYPE_COL_J={MUSCU:"#f97316",ERGO:"#0ea5e9",BATEAU:"#06b6d4",PLIO:"#f59e0b",RECUP:"#10b981",AUTRE:"#64748b"};
          const TYPE_LBL_J={MUSCU:"Muscu",ERGO:"Ergo",BATEAU:"Bateau",PLIO:"Plio",RECUP:"Récup",AUTRE:"Autre"};
          const entries=[...completions].sort((a,b)=>(b.completed_at||b.created_at)>(a.completed_at||a.created_at)?1:-1);
          const filtered=journalSearch?entries.filter(e=>{
            const blocs=Array.isArray(e.blocs_realises)?e.blocs_realises:(e.blocs_realises?.blocs||[]);
            const meta=e.blocs_realises?._meta||{};
            const txt=[meta.titre,e.commentaire,...blocs.map(b=>b.titre+" "+(b.note||""))].join(" ").toLowerCase();
            return txt.includes(journalSearch.toLowerCase());
          }):entries;
          const rpeData=entries.filter(e=>e.note).slice(0,20).reverse();
          const typeCount={};
          entries.forEach(e=>{const t=e.blocs_realises?._meta?.type_seance||"AUTRE";typeCount[t]=(typeCount[t]||0)+1;});
          return(
            <div style={{padding:isMobile?"16px 12px":"28px 32px"}}>
              <h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:900,margin:"0 0 4px"}}>📓 Journal</h1>
              <p style={{color:"#64748b",fontSize:13,marginBottom:20}}>{entries.length} séance{entries.length>1?"s":""} enregistrée{entries.length>1?"s":""}</p>
              {entries.length===0&&(
                <div style={{background:"#182030",borderRadius:12,padding:"40px 24px",textAlign:"center",border:"1px dashed #334155"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📓</div>
                  <div style={{color:"#f1f5f9",fontWeight:700,fontSize:15,marginBottom:6}}>Aucune séance encore</div>
                  <div style={{color:"#475569",fontSize:13}}>Valide une séance du planning ou ajoute une séance libre via le ＋</div>
                </div>
              )}
              {entries.length>0&&<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[{label:"Séances",val:entries.length,col:"#0ea5e9"},{label:"RPE moyen",val:entries.filter(e=>e.note).length?(entries.filter(e=>e.note).reduce((s,e)=>s+(+e.note),0)/entries.filter(e=>e.note).length).toFixed(1)+"/10":"—",col:"#f59e0b"}].map((s,i)=>(
                    <div key={i} style={{background:"#182030",borderRadius:10,padding:"12px 14px",border:`1px solid ${s.col}20`}}>
                      <div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.label}</div>
                      <div style={{color:s.col,fontWeight:900,fontSize:20}}>{s.val}</div>
                    </div>
                  ))}
                </div>
                {rpeData.length>1&&(
                  <div style={{background:"#182030",borderRadius:12,padding:"14px 16px",marginBottom:12,border:"1px solid #f59e0b20"}}>
                    <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13,marginBottom:10}}>📈 Ressenti dans le temps</div>
                    <svg width="100%" height="56" style={{overflow:"visible"}}>
                      {rpeData.map((e,i)=>{
                        const x=i/(rpeData.length-1)*100+"%",y=48-(+e.note/10)*40;
                        const col=+e.note<=3?"#ef4444":+e.note<=6?"#f59e0b":+e.note<=8?"#0ea5e9":"#4ade80";
                        const px=i>0?(i-1)/(rpeData.length-1)*100+"%":null,py=i>0?48-(+rpeData[i-1].note/10)*40:null;
                        return(<g key={i}>{i>0&&<line x1={px} y1={py} x2={x} y2={y} stroke="#334155" strokeWidth="1.5"/>}<circle cx={x} cy={y} r="4" fill={col}/>{i===rpeData.length-1&&<text x={x} y={y-8} textAnchor="middle" fontSize="9" fill={col} fontWeight="700">{e.note}/10</text>}</g>);
                      })}
                    </svg>
                  </div>
                )}
                {Object.keys(typeCount).length>0&&(
                  <div style={{background:"#182030",borderRadius:12,padding:"12px 16px",marginBottom:12,border:"1px solid #334155"}}>
                    <div style={{display:"flex",gap:3,height:14,borderRadius:4,overflow:"hidden",marginBottom:6}}>
                      {Object.entries(typeCount).sort((a,b)=>b[1]-a[1]).map(([t,n])=>(<div key={t} style={{flex:n,background:TYPE_COL_J[t]||"#64748b"}}/>))}
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {Object.entries(typeCount).sort((a,b)=>b[1]-a[1]).map(([t,n])=>(
                        <div key={t} style={{display:"flex",alignItems:"center",gap:3,fontSize:11}}>
                          <div style={{width:7,height:7,borderRadius:2,background:TYPE_COL_J[t]||"#64748b"}}/>
                          <span style={{color:"#94a3b8"}}>{TYPE_LBL_J[t]||t} <b style={{color:"#f1f5f9"}}>{n}</b></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <input placeholder="🔍 Rechercher..." value={journalSearch} onChange={e=>setJournalSearch(e.target.value)}
                  style={{width:"100%",background:"#182030",border:"1px solid #334155",borderRadius:10,color:"#f1f5f9",padding:"10px 14px",fontSize:13,boxSizing:"border-box",marginBottom:12}}/>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filtered.map((e,idx)=>{
                    const meta=e.blocs_realises?._meta||{};
                    const blocs=Array.isArray(e.blocs_realises)?e.blocs_realises:(e.blocs_realises?.blocs||[]);
                    const typeSeance=meta.type_seance||"AUTRE";
                    const col=TYPE_COL_J[typeSeance]||"#64748b";
                    const lbl=TYPE_LBL_J[typeSeance]||typeSeance;
                    const titre=meta.titre||"Séance libre";
                    const date=new Date(e.completed_at||e.created_at);
                    const rpe=e.note;
                    const rpeCol=rpe<=3?"#ef4444":rpe<=6?"#f59e0b":rpe<=8?"#0ea5e9":"#4ade80";
                    return(
                      <div key={idx} style={{background:"#182030",borderRadius:12,overflow:"hidden",border:`1px solid ${col}20`}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:col+"10",borderBottom:`1px solid ${col}20`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                              <span style={{color:col,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1}}>{lbl}</span>
                              <span style={{color:"#475569",fontSize:10}}>·</span>
                              <span style={{color:"#64748b",fontSize:10}}>{date.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</span>
                            </div>
                            <div style={{color:"#f1f5f9",fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{titre}</div>
                          </div>
                          {rpe&&<div style={{background:rpeCol+"20",border:`1px solid ${rpeCol}40`,borderRadius:8,padding:"4px 10px",textAlign:"center",flexShrink:0}}>
                            <div style={{color:rpeCol,fontWeight:900,fontSize:16,lineHeight:1}}>{rpe}</div>
                            <div style={{color:"#475569",fontSize:8,textTransform:"uppercase"}}>RPE</div>
                          </div>}
                        </div>
                        {(blocs.length>0||e.commentaire)&&(
                          <div style={{padding:"10px 14px"}}>
                            {blocs.length>0&&(
                              <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:e.commentaire?8:0}}>
                                {blocs.map((b,i)=>(<div key={i} style={{display:"flex",alignItems:"baseline",gap:6,fontSize:12}}>
                                  <span style={{color:col,fontWeight:700,flexShrink:0}}>▸</span>
                                  <span style={{color:"#94a3b8",fontWeight:600}}>{b.titre}</span>
                                  {b.series&&b.reps&&<span style={{color:"#64748b"}}>{b.series}×{b.reps}</span>}
                                  {b.charge_kg&&<span style={{color:"#f1f5f9",fontFamily:"monospace"}}>{b.charge_kg}kg</span>}
                                  {b.rm_estime&&<span style={{color:"#a78bfa",fontSize:11}}>~{b.rm_estime}kg 1RM</span>}
                                  {b.note&&!b.charge_kg&&<span style={{color:"#f1f5f9",fontFamily:"monospace"}}>{b.note}</span>}
                                </div>))}
                              </div>
                            )}
                            {e.commentaire&&<div style={{background:"#0f172a",borderRadius:8,padding:"7px 10px",fontSize:12,color:"#94a3b8",fontStyle:"italic",borderLeft:`3px solid ${col}40`}}>"{e.commentaire}"</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>}
            </div>
          );
        })()}
        {tab==="planning"&&(<div style={{...S.page,padding:0}}>
          <AthletePlanningView athlete={athlete} currentUser={currentUser} isMobile={isMobile} perfs={myPerfs}/>
        </div>)}
      </div>

      {/* Bottom nav mobile */}
      {isMobile&&(
        <nav style={{position:"fixed",bottom:0,left:0,right:0,height:56,background:"#0f1923",borderTop:"1px solid #2d1b4e",display:"flex",zIndex:100}}>
          {NAV.map(n=>{
            const active=tab===n.id;
            const ICONS={dashboard:"🏠",stats:"📊",crew:"👥",boats:"⛵",planning:"📅",journal:"📓",section:"🏅"};
            return(
              <button key={n.id} onClick={()=>setTab(n.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",color:active?"#a78bfa":"#4a6a8a",fontSize:10,fontWeight:active?700:500,borderTop:`2px solid ${active?"#a78bfa":"transparent"}`}}>
                <span style={{fontSize:18}}>{ICONS[n.id]}</span>
                <span>{n.label.replace("Mon ","")}</span>
              </button>
            );
          })}
          <button onClick={onLogout}
            style={{width:44,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",color:"#4a6a8a",fontSize:9,borderTop:"2px solid transparent"}}>
            <span style={{fontSize:16}}>🚪</span>
            <span>Exit</span>
          </button>
        </nav>
      )}
    </div>
  );
}


// ==========================================================================================================================================================
// SECTION MANAGER VIEW
// ==========================================================================================================================================================

function SectionManagerView({ managedSections, currentUser, isMobile }) {
  const [athletes, setAthletes]       = useState([]);
  const [allPerfs, setAllPerfs]       = useState([]);
  const [selAth, setSelAth]           = useState(null);
  const [selSection, setSelSection]   = useState(managedSections[0]||"");
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState(null);
  const [showAddPerf, setShowAddPerf] = useState(false);
  const [editPerf, setEditPerf]       = useState(null);
  const [newPerf, setNP]              = useState({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:"",distance_type:"2000m"});
  const [plans, setPlans]             = useState([]);
  const [weeks, setWeeks]             = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [selWeek, setSelWeek]         = useState(null);
  const [subTab, setSubTab]           = useState("athletes"); // athletes | planning

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [aths, perfs, ps] = await Promise.all([
        api.getAthletes(),
        api.getPerformances(),
        api.getSeasonPlans(),
      ]);
      setAthletes(aths||[]);
      setAllPerfs(perfs||[]);
      setPlans(ps||[]);
    } catch(e) {}
    setLoading(false);
  }

  const sectionAthletes = athletes.filter(a =>
    managedSections.some(s => a.category?.toLowerCase().includes(s.toLowerCase()))
  );

  const athPerfs = selAth ? allPerfs.filter(p => p.athlete_id === selAth.id).sort((a,b) => a.date.localeCompare(b.date)) : [];
  const best = getBestTime(athPerfs);
  const last = getLastPerf(athPerfs);

  async function savePerf() {
    if(!newPerf.date) { setToast({m:"Date invalide ou manquante",t:"error"}); return; }
    const watts = concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m") || 0;
    try {
      await api.createPerf({ athlete_id: selAth.id, date: newPerf.date, time: newPerf.time, watts, spm:+newPerf.spm||0, hr:+newPerf.hr||0, rpe:+newPerf.rpe||0, distance:+newPerf.distance||0, distance_type:newPerf.distance_type||"2000m" });
      setToast({m:"Performance ajoutée ✓", t:"success"});
      setShowAddPerf(false);
      setNP({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:"",distance_type:"2000m"});
      const perfs = await api.getPerformances();
      setAllPerfs(perfs||[]);
    } catch(e) { setToast({m:"Erreur "+e.message, t:"error"}); }
  }

  async function deletePerf(id) {
    if(!window.confirm("Supprimer cette performance ?")) return;
    try {
      await api.deletePerformance(id);
      const perfs = await api.getPerformances();
      setAllPerfs(perfs||[]);
    } catch(e) {}
  }

  // Planning section
  async function loadSectionPlanning(section) {
    try {
      const allPlans = plans.filter(p => {
        const cats = p.category.split(",").map(s=>s.trim());
        return cats.some(c => c.toLowerCase().includes(section.toLowerCase())) || cats.includes("Tous");
      });
      const allWeeks = (await Promise.all(allPlans.map(p => api.getPlanWeeks(p.id).catch(()=>[]))))
        .flat().sort((a,b) => a.date_debut?.localeCompare(b.date_debut||"")||a.num_semaine-b.num_semaine);
      setWeeks(allWeeks);
      const today = new Date().toISOString().split("T")[0];
      const cur = allWeeks.find(w => w.date_debut && w.date_debut <= today) || allWeeks[0];
      if(cur) { setSelWeek(cur); const s = await api.getPlannedSessions(cur.id); setSessions(s||[]); }
    } catch(e) {}
  }

  useEffect(() => { if(subTab==="planning" && plans.length>0) loadSectionPlanning(selSection); }, [subTab, selSection, plans.length]);

  const CHARGE_COLORS = {"Légère":"#4ade80","Modérée":"#f59e0b","Élevée":"#f97316","Maximale":"#ef4444","Compétition":"#a78bfa"};
  const TYPE_SEANCE_COLORS = {MUSCU:"#f97316",ERGO:"#0ea5e9",BATEAU:"#22d3ee",RECUP:"#4ade80",REPOS:"#64748b",TEST:"#a78bfa",COMPETITION:"#e879f9"};
  const TYPE_SEANCE_LABELS = {MUSCU:"💪 Muscu",ERGO:"🚣 Ergo",BATEAU:"⛵ Bateau",RECUP:"🔄 Récup",REPOS:"😴 Repos",TEST:"📊 Test",COMPETITION:"🏆 Compét"};
  const JOURS_S = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

  return (
    <div style={{...S.page, padding:isMobile?"16px 12px":"28px 32px"}}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}

      {/* Header */}
      <div style={S.ph}>
        <div>
          <h1 style={S.ttl}>🏅 Ma section</h1>
          <p style={S.sub}>{managedSections.map(s=>`Section ${s}`).join(" · ")} — {sectionAthletes.length} athlètes</p>
        </div>
        {managedSections.length > 1 && (
          <div style={{display:"flex",gap:6}}>
            {managedSections.map(s => (
              <button key={s} onClick={()=>{setSelSection(s);setSelAth(null);}}
                style={{...S.btnP, background:selSection===s?"#a78bfa":"transparent", color:selSection===s?"#0f1923":"#a78bfa", border:"1px solid #a78bfa"}}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["athletes","👤 Athlètes"],["planning","📅 Planning"]].map(([id,label])=>(
          <button key={id} onClick={()=>setSubTab(id)}
            style={{padding:"8px 18px",borderRadius:8,border:`1px solid ${subTab===id?"#a78bfa":"#1e293b"}`,background:subTab===id?"#a78bfa20":"transparent",color:subTab===id?"#a78bfa":"#7a95b0",fontWeight:subTab===id?700:500,cursor:"pointer",fontSize:13}}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Loader/> : (

        subTab==="athletes" ? (<>
          {/* Liste athlètes */}
          {!selAth ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sectionAthletes.length===0 && <div style={{...S.card,textAlign:"center",padding:40,color:"#5a7a9a"}}>Aucun athlète dans cette section.</div>}
              {sectionAthletes.map(a => {
                const perfs = allPerfs.filter(p=>p.athlete_id===a.id);
                const b = getBestTime(perfs);
                const l = getLastPerf(perfs);
                const wpkg = l && a.weight ? (concept2WattsFast(l.time, l.distance_type||"2000m")/a.weight).toFixed(2) : null;
                return (
                  <div key={a.id} onClick={()=>setSelAth(a)}
                    style={{...S.card, display:"flex", alignItems:"center", gap:16, padding:"14px 20px", cursor:"pointer", borderColor:"#263547"}}
                    onMouseOver={e=>e.currentTarget.style.borderColor="#a78bfa44"}
                    onMouseOut={e=>e.currentTarget.style.borderColor="#263547"}>
                    <div style={{...S.av, background:"#a78bfa22", border:"1px solid #a78bfa44", color:"#a78bfa"}}>{a.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:"#f1f5f9",fontSize:15}}>{a.name}</div>
                      <div style={{color:"#7a95b0",fontSize:12}}>{a.category} — {a.age}ans — {a.weight}kg</div>
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      {b && <StatPill label="Best 2k" value={b.time} color="#4ade80"/>}
                      {wpkg && <StatPill label="W/kg" value={wpkg} color="#a78bfa"/>}
                      <StatPill label="Sessions" value={perfs.length} color="#0ea5e9"/>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Fiche athlète */
            <div>
              <button onClick={()=>setSelAth(null)} style={{...S.btnP, background:"transparent", color:"#7a95b0", border:"1px solid #1e293b", marginBottom:20, fontSize:13}}>
                ← Retour à la liste
              </button>

              {/* Header fiche */}
              <div style={{...S.card, marginBottom:20, borderTop:"3px solid #a78bfa"}}>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div style={{...S.av, width:56, height:56, fontSize:20, background:"#a78bfa22", border:"2px solid #a78bfa44", color:"#a78bfa"}}>{selAth.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:20,fontWeight:900,color:"#f1f5f9"}}>{selAth.name}</div>
                    <div style={{color:"#7a95b0",fontSize:13}}>{selAth.category} — {selAth.age}ans — {selAth.weight}kg</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                      <div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best {best?.distance_type||"2000m"}</div>
                      <div style={{color:"#4ade80",fontWeight:900,fontSize:22}}>{best?.time??"--"}</div>
                    </div>
                    <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                      <div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Sessions</div>
                      <div style={{color:"#a78bfa",fontWeight:900,fontSize:22}}>{athPerfs.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performances */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={S.st}>Performances</div>
                <button style={{...S.btnP, background:"#a78bfa", color:"#0f1923", fontSize:12, padding:"6px 14px"}} onClick={()=>setShowAddPerf(true)}>+ Ajouter</button>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...athPerfs].reverse().map(p => {
                  const pw = concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts||0;
                  const pwkg = pw&&selAth.weight ? (pw/selAth.weight).toFixed(2) : null;
                  return (
                    <div key={p.id} style={{...S.card, display:"flex", alignItems:"center", gap:12, padding:"10px 16px", flexWrap:"wrap"}}>
                      <div style={{color:"#7a95b0",fontSize:12,minWidth:85}}>{p.date}</div>
                      <div style={{color:"#4ade80",fontWeight:700,fontSize:15,minWidth:50}}>{p.time}</div>
                      <div style={{color:"#0ea5e9",fontWeight:700}}>⚡ {pw}W</div>
                      {pwkg&&<div style={{color:"#a78bfa",fontWeight:700,fontSize:13}}>{pwkg} W/kg</div>}
                      <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                        <button onClick={()=>deletePerf(p.id)} style={{...S.actionBtn, color:"#ef4444", borderColor:"#ef444430"}}>✕</button>
                      </div>
                    </div>
                  );
                })}
                {!athPerfs.length && <div style={{...S.card, textAlign:"center", color:"#5a7a9a", padding:28}}>Aucune performance</div>}
              </div>

              {showAddPerf && (
                <Modal title={`+ Perf — ${selAth.name}`} onClose={()=>setShowAddPerf(false)}>
                  <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
                  <FF label="Distance"><select style={S.inp} value={newPerf.distance_type} onChange={e=>setNP(p=>({...p,distance_type:e.target.value}))}><option>500m</option><option>1000m</option><option>2000m</option></select></FF>
                  <FF label={`Temps ${newPerf.distance_type||"2000m"}`}><input style={S.inp} placeholder="6:45.0" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
                  {newPerf.time && concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m") && (
                    <div style={{padding:"8px 12px",background:"#a78bfa10",border:"1px solid #a78bfa30",borderRadius:8,marginBottom:12,color:"#0ea5e9",fontWeight:700}}>
                      ⚡ {concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m")} W
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <FF label="RPE (1-10)"><input style={S.inp} type="number" min="1" max="10" value={newPerf.rpe} onChange={e=>setNP(p=>({...p,rpe:e.target.value}))}/></FF>
                    <FF label="Distance (km)"><input style={S.inp} type="number" value={newPerf.distance} onChange={e=>setNP(p=>({...p,distance:e.target.value}))}/></FF>
                  </div>
                  <button style={{...S.btnP, width:"100%", marginTop:8, background:"#a78bfa", color:"#0f1923"}} onClick={savePerf}>Enregistrer</button>
                </Modal>
              )}
            </div>
          )}
        </>) : (

          /* Planning section */
          <div>
            {weeks.length===0 ? (
              <div style={{...S.card, textAlign:"center", padding:40, color:"#5a7a9a"}}>Aucun planning pour cette section.</div>
            ) : (<>
              {/* Sélecteur semaine */}
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
                {weeks.map(w => {
                  const col = CHARGE_COLORS[w.charge]||"#64748b";
                  const active = selWeek?.id===w.id;
                  return (
                    <button key={w.id} onClick={async()=>{setSelWeek(w);const s=await api.getPlannedSessions(w.id);setSessions(s||[]);}}
                      style={{flexShrink:0,padding:"6px 14px",borderRadius:8,border:`1px solid ${active?col:"#334155"}`,background:active?col+"20":"transparent",color:active?col:"#64748b",fontSize:12,fontWeight:active?700:500,cursor:"pointer",whiteSpace:"nowrap"}}>
                      S{w.num_semaine}{w.date_debut?` · ${w.date_debut.slice(5).replace("-","/")}`:""}{w.charge?` · ${w.charge}`:""}
                    </button>
                  );
                })}
              </div>

              {/* Grille */}
              {sessions.length===0 ? (
                <div style={{...S.card, textAlign:"center", padding:32, color:"#5a7a9a"}}>Aucune séance cette semaine.</div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
                  {JOURS_S.map(jour => {
                    const js = sessions.filter(s=>s.jour===jour);
                    if(!js.length) return null;
                    return (
                      <div key={jour} style={{display:"flex",flexDirection:"column",gap:6}}>
                        <div style={{fontWeight:700,color:"#94a3b8",fontSize:12}}>{jour}</div>
                        {js.map(s => {
                          const sc = TYPE_SEANCE_COLORS[s.type_seance]||"#64748b";
                          const contenu = typeof s.contenu==="string"?JSON.parse(s.contenu||"{}"):s.contenu||{};
                          return (
                            <div key={s.id} style={{background:"#1e293b",border:`2px solid ${sc}40`,borderRadius:10,padding:"10px"}}>
                              <span style={{fontSize:10,fontWeight:700,color:sc,background:sc+"20",padding:"2px 7px",borderRadius:4}}>{TYPE_SEANCE_LABELS[s.type_seance]||s.type_seance}</span>
                              <div style={{fontWeight:700,color:"#f1f5f9",fontSize:12,marginTop:5}}>{s.titre}</div>
                              {contenu.duree_min>0&&<div style={{color:"#475569",fontSize:11,marginTop:3}}>⏱ {contenu.duree_min} min</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </>)}
          </div>
        )
      )}
    </div>
  );
}

// ==========================================================================================================================================================
// ATHLETE PLANNING VIEW
// ==========================================================================================================================================================

const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const TYPE_SEANCE_COLORS = { MUSCU:"#f97316",ERGO:"#0ea5e9",BATEAU:"#22d3ee",RECUP:"#4ade80",REPOS:"#64748b",TEST:"#a78bfa",COMPETITION:"#e879f9" };
const TYPE_SEANCE_LABELS = { MUSCU:"💪 Muscu",ERGO:"🚣 Ergo",BATEAU:"⛵ Bateau",RECUP:"🔄 Récup",REPOS:"😴 Repos",TEST:"📊 Test",COMPETITION:"🏆 Compét" };

function AthletePlanningView({ athlete, currentUser, isMobile, perfs=[], completions:extCompletions=[], onCompletionsChange }) {
  const [weeks, setWeeks]           = useState([]);
  const [selWeek, setSelWeek]       = useState(null);
  const [sessions, setSessions]     = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [selSession, setSelSession] = useState(null);
  const [noteForm, setNoteForm]     = useState({ note:"", commentaire:"", charges:{} });
  const [showLibre, setShowLibre]   = useState(false);
  const [libreType, setLibreType]   = useState(null);
  const [libreForm, setLibreForm]   = useState({ titre:"", date:new Date().toISOString().split("T")[0], blocs:[], ressenti:null, commentaire:"" });
  const [libreSaving, setLibreSaving] = useState(false);
  const [allSessions, setAllSessions] = useState({});
  // Sync completions depuis parent
  useEffect(() => { setCompletions(extCompletions); }, [extCompletions?.length]);
  const [journalSearch, setJournalSearch] = useState("");
  const [aiSession, setAiSession]   = useState(null);
  const [expandedSessions, setExpandedSessions] = useState({});
  const today = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][new Date().getDay()];
  const [activeJour, setActiveJour] = useState(today); // id séance dont on affiche l'IA
  const [aiData, setAiData]         = useState({});    // {sessionId: resultIA}
  const [aiLoading, setAiLoading]   = useState(null);  // id séance en cours de chargement

  useEffect(() => { if(athlete) loadPlanning(); }, [athlete]);

  async function loadPlanning() {
    if(!athlete) return;
    setLoading(true);
    try {
      // Load all plans matching athlete's category
      const allPlans = await api.getSeasonPlans();
      const myPlans = (allPlans||[]).filter(p => {
        const cats = p.category.split(",").map(s=>s.trim());
        return cats.includes(athlete.category) || cats.includes("Tous");
      });

      // Load overrides to check if athlete is included/excluded
      let planIds = myPlans.map(p=>p.id);

      // Also load plans where athlete is individually included
      const allOverrides = await Promise.all(myPlans.map(p=>api.getPlanOverrides(p.id).catch(()=>[])));
      const flatOverrides = allOverrides.flat();
      const excluded = flatOverrides.filter(o=>o.type==="exclude"&&o.athlete_id===athlete.id).map(o=>o.plan_id);
      planIds = planIds.filter(id=>!excluded.includes(id));

      // Also add plans where athlete is individually added
      const allPlans2 = await api.getSeasonPlans();
      const includeOverrides = (await Promise.all((allPlans2||[]).map(p=>api.getPlanOverrides(p.id).catch(()=>[]))))
        .flat()
        .filter(o=>o.type==="include"&&o.athlete_id===athlete.id);
      includeOverrides.forEach(o=>{ if(!planIds.includes(o.plan_id)) planIds.push(o.plan_id); });

      if(planIds.length===0) { setLoading(false); return; }

      // Load all weeks from all plans
      const allWeeks = (await Promise.all(planIds.map(id=>api.getPlanWeeks(id).catch(()=>[]))))
        .flat()
        .sort((a,b)=>a.date_debut?.localeCompare(b.date_debut||"")||a.num_semaine-b.num_semaine);

      setWeeks(allWeeks);

      // Find current week by date
      const today = new Date().toISOString().split("T")[0];
      const current = allWeeks.find(w=>w.date_debut&&w.date_debut<=today) || allWeeks[0];
      if(current) {
        setSelWeek(current);
        await loadWeekSessions(current.id);
      }

      // Load completions for this athlete
      const comps = await api.getSessionCompletions(athlete.id).catch(()=>[]);
      setCompletions(comps||[]);
      // Indexer les sessions par id pour le journal
      if(comps?.length) {
        const sessionIds = [...new Set(comps.map(c=>c.session_id).filter(Boolean))];
        const sessionMap = {};
        await Promise.all(sessionIds.map(id =>
          api.getPlannedSession(id).then(s=>{ if(s) sessionMap[id]=s; }).catch(()=>{})
        ));
        setAllSessions(sessionMap);
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function loadWeekSessions(weekId) {
    try {
      const s = await api.getPlannedSessions(weekId);
      setSessions(s||[]);
    } catch(e) {}
  }

  async function changeWeek(week) {
    setSelWeek(week);
    await loadWeekSessions(week.id);
  }

  function getCompletion(sessionId) {
    return completions.find(c=>c.session_id===sessionId&&c.athlete_id===athlete.id);
  }

  async function callPlanningAI(session) {
    const contenu = typeof session.contenu==="string" ? JSON.parse(session.contenu||"{}") : session.contenu||{};
    const blocs = contenu.blocs||[];
    if(!blocs.length) { setAiData(d=>({...d,[session.id]:{error:"Aucun bloc dans cette séance."}})); return; }
    setAiLoading(session.id);
    setAiSession(session.id);
    try {
      const r = await fetch("/api/athlete_ai", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ mode:"planning", athlete, perfs, blocs, session_type: session.type_seance })
      });
      const data = await r.json();
      if(data.error) throw new Error(data.error);
      setAiData(d=>({...d,[session.id]:data}));
    } catch(e) {
      setAiData(d=>({...d,[session.id]:{error:e.message}}));
    }
    setAiLoading(null);
  }

  async function saveSeanceLibre() {
    if (!athlete || !libreType) return;
    setLibreSaving(true);
    try {
      const blocsAvecRM = libreForm.blocs.map(b => {
        const rm = calc1RM(parseFloat(b.charge_kg), parseFloat(b.reps));
        return { ...b, rm_estime: rm||null };
      });
      await api.createAthleteSession({
        athlete_id: athlete.id,
        date: libreForm.date,
        type_seance: libreType,
        titre: libreForm.titre || libreType,
        blocs: blocsAvecRM,
        ressenti: libreForm.ressenti,
        commentaire: libreForm.commentaire,
      });
      setShowLibre(false);
      setLibreType(null);
      setLibreForm({ titre:"", date:new Date().toISOString().split("T")[0], blocs:[], ressenti:null, commentaire:"" });
      setToast("Séance enregistrée ✓");
      setTimeout(()=>setToast(null), 2500);
    } catch(e) {
      setToast("Erreur: " + e.message.slice(0,60));
      setTimeout(()=>setToast(null), 3000);
    }
    setLibreSaving(false);
  }

  function openNote(session) {
    const existing = getCompletion(session.id);
    setSelSession(session);
    setNoteForm({ note: existing?.note||"", commentaire: existing?.commentaire||"", charges: existing?.blocs_realises?.reduce((acc,b,i)=>({...acc,[i]:b.charge_kg||b.note||""}),{}) || {} });
    setShowModal(true);
  }

  async function saveCompletion() {
    if(!selSession||!athlete) return;
    const existing = getCompletion(selSession.id);
    // Calculer blocs_realises avec 1RM estimé
    const contenu = typeof selSession.contenu==="string"?JSON.parse(selSession.contenu||"{}"):selSession.contenu||{};
    const blocs_realises = (contenu.blocs||[]).map((b,i)=>{
      const charge_kg = parseFloat(noteForm.charges[i]);
      // Parser les reps depuis le détail du bloc (ex: "4×6-8", "3×10")
      const detailStr = b.detail||"";
      const repsMatch = detailStr.match(/[×x](\d+(?:-\d+)?)/i);
      const reps = repsMatch ? parseReps(repsMatch[1]) : null;
      const rm = calc1RM(charge_kg, reps);
      return {
        titre: b.titre,
        prevu: b.detail,
        charge_kg: isNaN(charge_kg) ? null : charge_kg,
        reps_realises: reps,
        rm_estime: rm,
        note: noteForm.charges[i]||null,
      };
    }).filter(b=>b.charge_kg!=null||b.note);

    const payload = {
      note: +noteForm.note||null,
      commentaire: noteForm.commentaire||"",
    };
    if (blocs_realises.length) payload.blocs_realises = blocs_realises;
    try {
      console.log("[saveCompletion] payload:", JSON.stringify(payload));
      console.log("[saveCompletion] session_id:", selSession.id, "athlete_id:", athlete?.id);
      let res;
      if(existing) {
        res = await api.updateCompletion(existing.id, payload);
        setCompletions(c=>c.map(x=>x.id===existing.id?{...x,...res?.[0]}:x));
      } else {
        res = await api.createCompletion({ session_id:selSession.id, athlete_id:athlete.id, ...payload });
        if(res&&res[0]) setCompletions(c=>[...c,res[0]]);
      }
      setToast("Séance validée ✓");
      setTimeout(()=>setToast(null),2500);
      setShowModal(false);
    } catch(e) {
      console.error("[saveCompletion] ERREUR:", e.message);
      setToast("Erreur: " + e.message.slice(0,80));
      setTimeout(()=>setToast(null),5000);
    }
  }

  async function removeCompletion(sessionId) {
    const existing = getCompletion(sessionId);
    if(!existing) return;
    try {
      await api.updateCompletion(existing.id, { note:null, commentaire:"" });
      setCompletions(c=>c.filter(x=>x.id!==existing.id));
    } catch(e) {}
  }

  const CHARGE_COLORS = { "Légère":"#4ade80","Modérée":"#f59e0b","Élevée":"#f97316","Maximale":"#ef4444","Compétition":"#a78bfa" };

  if(loading) return <div style={{padding:48,textAlign:"center",color:"#64748b"}}>Chargement du planning...</div>;

  if(weeks.length===0) return (
    <div style={{padding:"28px 32px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:24,fontWeight:800,margin:0}}>📅 Mon Planning</h1><p style={{color:"#64748b",fontSize:14,marginTop:4}}>Séances assignées par le coach</p></div>
      </div>
      <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:48,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>📅</div>
        <div style={{color:"#f1f5f9",fontWeight:700,marginBottom:8}}>Aucun planning disponible</div>
        <div style={{color:"#64748b",fontSize:13}}>Ton coach n'a pas encore créé de plan pour ton groupe.</div>
      </div>
    </div>
  );

  // Group sessions by day for current week
  const byDay = {};
  JOURS.forEach(j=>{ byDay[j]=[]; });
  sessions.forEach(s=>{ if(byDay[s.jour]) byDay[s.jour].push(s); });
  const totalSessions = sessions.filter(s=>s.type_seance!=="REPOS").length;
  const doneSessions  = sessions.filter(s=>s.type_seance!=="REPOS"&&getCompletion(s.id)).length;
  const pct = totalSessions>0 ? Math.round(doneSessions/totalSessions*100) : 0;

  return (
    <div style={{padding:"28px 32px"}}>
      {toast&&<div style={{position:"fixed",bottom:24,right:24,background:"#4ade8020",border:"1px solid #4ade80",color:"#4ade80",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:700,zIndex:200}}>{toast}</div>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{color:"#f1f5f9",fontSize:24,fontWeight:800,margin:0}}>📅 Mon Planning</h1>
          <p style={{color:"#64748b",fontSize:14,marginTop:4}}>Séances assignées par le coach</p>
        </div>
        {/* Progression semaine */}
        {totalSessions>0&&(
          <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:10,padding:"10px 16px",minWidth:160}}>
            <div style={{display:"flex",justifyContent:"space-between",color:"#94a3b8",fontSize:12,marginBottom:6}}>
              <span>Cette semaine</span><span style={{color:"#f1f5f9",fontWeight:700}}>{doneSessions}/{totalSessions}</span>
            </div>
            <div style={{height:6,background:"#334155",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#4ade80":"#0ea5e9",borderRadius:3,transition:"width 0.3s"}}/>
            </div>
            <div style={{color:pct===100?"#4ade80":"#64748b",fontSize:11,marginTop:4,fontWeight:pct===100?700:400}}>{pct===100?"Semaine complète ✓":`${pct}% complété`}</div>
          </div>
        )}
      </div>

      {/* Sélecteur de semaine */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:20}}>
        {weeks.map(w=>{
          const col = CHARGE_COLORS[w.charge]||"#64748b";
          const active = selWeek?.id===w.id;
          return (
            <button key={w.id} onClick={()=>changeWeek(w)}
              style={{flexShrink:0,padding:"6px 14px",borderRadius:8,border:`1px solid ${active?col:"#334155"}`,background:active?col+"20":"transparent",color:active?col:"#64748b",fontSize:12,fontWeight:active?700:500,cursor:"pointer",whiteSpace:"nowrap"}}>
              S{w.num_semaine} {w.date_debut?`· ${w.date_debut.slice(5).replace("-","/")}`:""} {w.charge?`· ${w.charge}`:""}
            </button>
          );
        })}
      </div>

      {/* Infos semaine sélectionnée */}
      {selWeek&&(
        <div style={{background:"#1e293b",border:`1px solid #334155`,borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:"#94a3b8",fontSize:13}}>Semaine {selWeek.num_semaine}</span>
          {selWeek.type_semaine&&<span style={{fontSize:12,fontWeight:700,color:"#0ea5e9"}}>{selWeek.type_semaine}</span>}
          {selWeek.objectif&&<span style={{color:"#94a3b8",fontSize:13}}>— {selWeek.objectif}</span>}
          {selWeek.notes&&<span style={{color:"#64748b",fontSize:12,fontStyle:"italic"}}>{selWeek.notes}</span>}
        </div>
      )}

      {/* Navigation jours — swipe style */}
      {(()=>{
        const joursessions = byDay[activeJour]||[];
        return(
          <div>
            {/* Tabs jours */}
            <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:8,marginBottom:16,scrollbarWidth:"none"}}>
              {JOURS.map(jour=>{
                const js = byDay[jour]||[];
                const hasSeances = js.length>0;
                const isDone = hasSeances && js.filter(s=>s.type_seance!=="REPOS").every(s=>getCompletion(s.id));
                const isToday = jour===today;
                const isActive = jour===activeJour;
                const sc = hasSeances ? (TYPE_SEANCE_COLORS[js[0].type_seance]||"#64748b") : "#334155";
                return(
                  <button key={jour} onClick={()=>setActiveJour(jour)}
                    style={{
                      flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center",
                      padding:"8px 12px", borderRadius:10, cursor:"pointer",
                      border:`2px solid ${isActive?sc:isToday?"#334155":"transparent"}`,
                      background: isActive?sc+"20":isToday?"#1e293b":"transparent",
                      minWidth:52,
                    }}>
                    <span style={{fontSize:10,color:isActive?sc:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{jour.slice(0,3)}</span>
                    <span style={{fontSize:16,marginTop:2}}>{isDone?"✅":hasSeances?"🏋️":"—"}</span>
                    {isToday&&<span style={{fontSize:8,color:"#0ea5e9",fontWeight:700,marginTop:1}}>auj.</span>}
                  </button>
                );
              })}
            </div>

            {/* Carte du jour sélectionné */}
            {joursessions.length===0 ? (
              <div style={{background:"#0f172a",border:"1px dashed #1e293b",borderRadius:16,padding:"40px 24px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>😴</div>
                <div style={{color:"#334155",fontWeight:700,fontSize:15}}>Repos</div>
                <div style={{color:"#1e293b",fontSize:12,marginTop:4}}>Pas de séance prévue</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {joursessions.map(s=>{
                  const sc = TYPE_SEANCE_COLORS[s.type_seance]||"#64748b";
                  const done = getCompletion(s.id);
                  const contenu = typeof s.contenu==="string"?JSON.parse(s.contenu||"{}"):s.contenu||{};
                  const isExp = expandedSessions[s.id];
                  const blocsToShow = isExp ? contenu.blocs : contenu.blocs?.slice(0,10);

                  return(
                    <div key={s.id} style={{background:done?"#0a1f14":"#0f172a",border:`2px solid ${done?"#4ade8050":sc+"50"}`,borderRadius:16,overflow:"hidden"}}>
                      {/* Header séance */}
                      <div style={{background:sc+"18",padding:"14px 18px",borderBottom:`1px solid ${sc}25`}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,fontWeight:800,color:sc,textTransform:"uppercase",letterSpacing:1}}>
                            {TYPE_SEANCE_LABELS[s.type_seance]||s.type_seance}
                          </span>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {contenu.duree_min>0&&<span style={{fontSize:12,color:"#64748b"}}>⏱ {contenu.duree_min} min</span>}
                            {done&&<span style={{fontSize:13,color:"#4ade80",fontWeight:800}}>✓ Fait</span>}
                          </div>
                        </div>
                        <div style={{fontWeight:900,color:"#f1f5f9",fontSize:20,lineHeight:1.2}}>{s.titre}</div>
                      </div>

                      {/* Blocs contenu */}
                      {contenu.blocs?.length>0&&(
                        <div style={{padding:"14px 18px"}}>
                          <div style={{color:"#475569",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Contenu</div>
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {blocsToShow?.map((b,i)=>(
                              <div key={i} style={{display:"flex",gap:10,alignItems:"baseline"}}>
                                <span style={{color:sc,fontSize:14,flexShrink:0,marginTop:1}}>▸</span>
                                <div>
                                  <span style={{color:"#e2e8f0",fontWeight:700,fontSize:14}}>{b.titre}</span>
                                  {b.detail&&<span style={{color:"#64748b",fontSize:13}}> — {b.detail}</span>}
                                </div>
                              </div>
                            ))}
                            {contenu.blocs?.length>10&&(
                              <button onClick={()=>setExpandedSessions(p=>({...p,[s.id]:!isExp}))}
                                style={{background:"none",border:"none",color:sc,fontSize:12,cursor:"pointer",padding:"4px 0",textAlign:"left",fontWeight:700}}>
                                {isExp?"▲ Réduire":`▼ Voir +${contenu.blocs.length-10} blocs`}
                              </button>
                            )}
                          </div>
                          {done&&done.note&&(
                            <div style={{marginTop:12,padding:"8px 12px",background:"#4ade8015",borderRadius:8,border:"1px solid #4ade8030"}}>
                              <span style={{color:"#4ade80",fontWeight:700,fontSize:12}}>Note : {done.note}/10</span>
                              {done.commentaire&&<span style={{color:"#64748b",fontSize:12}}> — {done.commentaire}</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* IA */}
                      {aiSession===s.id&&aiData[s.id]&&(()=>{
                        const ai=aiData[s.id];
                        if(ai.error) return <div style={{margin:"0 18px 14px",padding:"8px 12px",background:"#ef444415",borderRadius:8,color:"#ef4444",fontSize:12}}>{ai.error}</div>;
                        return(
                          <div style={{margin:"0 18px 14px",background:sc+"08",border:`1px solid ${sc}25`,borderRadius:10,padding:"12px 14px"}}>
                            {ai.intro&&<div style={{color:sc,fontSize:12,fontStyle:"italic",marginBottom:10}}>🤖 {ai.intro}</div>}
                            {(ai.conseils||ai.blocs||[]).map((c,i)=>(
                              <div key={i} style={{borderTop:i>0?"1px solid #1e293b20":"none",paddingTop:i>0?10:0,marginTop:i>0?10:0}}>
                                <div style={{color:"#e2e8f0",fontWeight:700,fontSize:13,marginBottom:5}}>{c.bloc||c.titre}</div>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                  {(c.allure_range||c.allure)&&<span style={{background:"#0ea5e925",color:"#0ea5e9",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:800}}>{c.allure_range||c.allure}/500m</span>}
                                  {c.cadence&&<span style={{background:"#a78bfa25",color:"#a78bfa",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700}}>{c.cadence} spm</span>}
                                  {c.intensite&&<span style={{background:"#4ade8015",color:"#4ade80",borderRadius:6,padding:"3px 10px",fontSize:11}}>{c.intensite}</span>}
                                </div>
                                {c.conseil&&<div style={{color:"#64748b",fontSize:12,marginTop:6,fontStyle:"italic"}}>{c.conseil}</div>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      {s.type_seance!=="REPOS"&&(
                        <div style={{padding:"0 18px 16px",display:"flex",gap:10}}>
                          <button onClick={()=>openNote(s)}
                            style={{flex:2,padding:"12px",borderRadius:10,border:`1px solid ${done?"#4ade8050":sc+"40"}`,background:done?"#4ade8020":sc+"15",color:done?"#4ade80":sc,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                            {done?<>✓ <span style={{fontSize:12}}>Modifier</span></>:<>{s.type_seance==="MUSCU"||s.type_seance==="PLIO"?"💪":"📝"} <span>Saisir mes réalisations</span></>}
                          </button>
                          <button onClick={()=>aiSession===s.id&&aiData[s.id]?setAiSession(null):callPlanningAI(s)}
                            disabled={aiLoading===s.id}
                            style={{flex:1,padding:"12px",borderRadius:10,border:`1px solid ${sc}50`,background:aiSession===s.id&&aiData[s.id]?sc+"20":"transparent",color:sc,fontSize:13,fontWeight:700,cursor:"pointer",opacity:aiLoading===s.id?0.6:1}}>
                            {aiLoading===s.id?"🤖...":"🤖 IA"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

            {/* Bouton séance libre flottant */}
      <div style={{position:"fixed",bottom:isMobile?80:24,right:20,zIndex:50}}>
        <button onClick={()=>setShowLibre(true)}
          style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:50,width:52,height:52,fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px #6366f150",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>
          +
        </button>
      </div>

      {/* Modal séance libre */}
      {showLibre&&(
        <div style={{position:"fixed",inset:0,background:"#00000090",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}} onClick={e=>e.target===e.currentTarget&&(setShowLibre(false),setLibreType(null))}>
          <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:"16px 16px 0 0",padding:"20px",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
            
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{color:"#f1f5f9",fontWeight:800,fontSize:17}}>
                  {libreType ? `Séance ${libreType}` : "Séance libre"}
                </div>
                <div style={{color:"#64748b",fontSize:12}}>Hors planning coach</div>
              </div>
              <button onClick={()=>{setShowLibre(false);setLibreType(null);}} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer"}}>×</button>
            </div>

            {/* Étape 1 : choix du type */}
            {!libreType&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["ERGO","🚣","#0ea5e9"],["BATEAU","⛵","#06b6d4"],["MUSCU","💪","#f97316"],["PLIO","⚡","#f59e0b"],["RECUP","🔄","#10b981"],["AUTRE","📝","#94a3b8"]].map(([t,ic,col])=>(
                  <button key={t} onClick={()=>setLibreType(t)}
                    style={{background:col+"15",border:`1px solid ${col}40`,borderRadius:10,padding:"14px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <span style={{fontSize:24}}>{ic}</span>
                    <span style={{color:col,fontSize:12,fontWeight:700}}>{t}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Étape 2 : formulaire */}
            {libreType&&(()=>{
              const col = {ERGO:"#0ea5e9",BATEAU:"#06b6d4",MUSCU:"#f97316",PLIO:"#f59e0b",RECUP:"#10b981",AUTRE:"#94a3b8"}[libreType]||"#64748b";
              const isMuscu = libreType==="MUSCU"||libreType==="PLIO";
              return(
                <div>
                  {/* Bouton retour type */}
                  <button onClick={()=>setLibreType(null)} style={{background:"none",border:"none",color:"#64748b",fontSize:12,cursor:"pointer",marginBottom:12,padding:0}}>← Changer de type</button>

                  {/* Date + Titre */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                    <div>
                      <label style={{color:"#64748b",fontSize:11,display:"block",marginBottom:4}}>Date</label>
                      <input type="date" value={libreForm.date}
                        onChange={e=>setLibreForm(f=>({...f,date:e.target.value}))}
                        style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",padding:"8px 10px",fontSize:13,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <label style={{color:"#64748b",fontSize:11,display:"block",marginBottom:4}}>Titre (optionnel)</label>
                      <input placeholder={`ex: ${libreType} du matin`} value={libreForm.titre}
                        onChange={e=>setLibreForm(f=>({...f,titre:e.target.value}))}
                        style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",padding:"8px 10px",fontSize:13,boxSizing:"border-box"}}/>
                    </div>
                  </div>

                  {/* Blocs / contenu */}
                  <div style={{marginBottom:12}}>
                    <div style={{color:"#64748b",fontSize:11,marginBottom:8}}>Contenu</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {libreForm.blocs.map((b,i)=>{
                        const rm1 = isMuscu ? calc1RM(parseFloat(b.charge_kg), parseFloat(b.reps)) : null;
                        return(
                          <div key={i} style={{background:"#0f172a",borderRadius:10,padding:"10px 12px",border:`1px solid ${col}20`}}>
                            {/* Nom exercice */}
                            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:isMuscu?8:0}}>
                              <input placeholder={isMuscu?"Exercice (ex: Back squat)":"Bloc (ex: 4×6' r5')"}
                                value={b.titre||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,titre:e.target.value}:x)}))}
                                style={{flex:1,background:"#182030",border:"1px solid #334155",borderRadius:7,color:"#f1f5f9",padding:"7px 10px",fontSize:13}}/>
                              <button onClick={()=>setLibreForm(f=>({...f,blocs:f.blocs.filter((_,j)=>j!==i)}))}
                                style={{background:"none",border:"none",color:"#475569",fontSize:16,cursor:"pointer",padding:"0 4px",flexShrink:0}}>×</button>
                            </div>
                            {/* Champs selon type */}
                            {isMuscu?(
                              <div style={{display:"flex",gap:6,alignItems:"flex-end",flexWrap:"wrap"}}>
                                <div style={{flex:1,minWidth:60}}>
                                  <div style={{color:"#475569",fontSize:10,marginBottom:3}}>Séries</div>
                                  <input type="number" min="1" placeholder="4"
                                    value={b.series||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,series:e.target.value}:x)}))}
                                    style={{width:"100%",background:"#182030",border:"1px solid #334155",borderRadius:7,color:"#f1f5f9",padding:"7px 8px",fontSize:14,textAlign:"center",boxSizing:"border-box"}}/>
                                </div>
                                <div style={{color:"#475569",fontSize:16,paddingBottom:8}}>×</div>
                                <div style={{flex:1,minWidth:60}}>
                                  <div style={{color:"#475569",fontSize:10,marginBottom:3}}>Reps</div>
                                  <input type="number" min="1" placeholder="8"
                                    value={b.reps||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,reps:e.target.value}:x)}))}
                                    style={{width:"100%",background:"#182030",border:"1px solid #334155",borderRadius:7,color:"#f1f5f9",padding:"7px 8px",fontSize:14,textAlign:"center",boxSizing:"border-box"}}/>
                                </div>
                                <div style={{color:"#475569",fontSize:16,paddingBottom:8}}>@</div>
                                <div style={{flex:1,minWidth:60}}>
                                  <div style={{color:"#475569",fontSize:10,marginBottom:3}}>Charge (kg)</div>
                                  <input type="number" min="0" placeholder="80"
                                    value={b.charge_kg||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,charge_kg:e.target.value}:x)}))}
                                    style={{width:"100%",background:"#182030",border:`1px solid ${col}50`,borderRadius:7,color:"#f1f5f9",padding:"7px 8px",fontSize:14,textAlign:"center",boxSizing:"border-box"}}/>
                                </div>
                                {rm1&&<div style={{flexShrink:0,textAlign:"center",paddingBottom:4}}>
                                  <div style={{color:"#a78bfa",fontWeight:900,fontSize:15}}>~{rm1}</div>
                                  <div style={{color:"#475569",fontSize:9}}>1RM kg</div>
                                </div>}
                              </div>
                            ):(
                              <div style={{display:"flex",gap:6,alignItems:"flex-end",marginTop:8}}>
                                <div style={{flex:2}}>
                                  <div style={{color:"#475569",fontSize:10,marginBottom:3}}>
                                    {libreType==="ERGO"||libreType==="BATEAU"?"Format (ex: 3×6', 60'...)":"Détail"}
                                  </div>
                                  <input placeholder={libreType==="ERGO"||libreType==="BATEAU"?"ex: 3×6' r5', 60' B1":"ex: réalisé"}
                                    value={b.format||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,format:e.target.value}:x)}))}
                                    style={{width:"100%",background:"#182030",border:`1px solid ${col}40`,borderRadius:7,color:"#f1f5f9",padding:"7px 10px",fontSize:13,boxSizing:"border-box"}}/>
                                </div>
                                {(libreType==="ERGO"||libreType==="BATEAU")&&(
                                  <div style={{flex:1}}>
                                    <div style={{color:"#475569",fontSize:10,marginBottom:3}}>Cadence (spm)</div>
                                    <input type="number" placeholder="18"
                                      value={b.cadence||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,cadence:e.target.value}:x)}))}
                                      style={{width:"100%",background:"#182030",border:`1px solid ${col}40`,borderRadius:7,color:"#f1f5f9",padding:"7px 8px",fontSize:14,textAlign:"center",boxSizing:"border-box"}}/>
                                  </div>
                                )}
                                {(libreType==="ERGO"||libreType==="BATEAU")&&(
                                  <div style={{flex:1}}>
                                    <div style={{color:"#475569",fontSize:10,marginBottom:3}}>Allure /500m</div>
                                    <input placeholder="1:52"
                                      value={b.allure||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,allure:e.target.value}:x)}))}
                                      style={{width:"100%",background:"#182030",border:`1px solid ${col}40`,borderRadius:7,color:"#f1f5f9",padding:"7px 8px",fontSize:13,textAlign:"center",boxSizing:"border-box"}}/>
                                  </div>
                                )}
                                {libreType!=="ERGO"&&libreType!=="BATEAU"&&(
                                  <input placeholder="réalisé"
                                    value={b.note||""} onChange={e=>setLibreForm(f=>({...f,blocs:f.blocs.map((x,j)=>j===i?{...x,note:e.target.value}:x)}))}
                                    style={{flex:1,background:"#182030",border:`1px solid ${col}40`,borderRadius:7,color:"#f1f5f9",padding:"7px 10px",fontSize:13,boxSizing:"border-box"}}/>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button onClick={()=>setLibreForm(f=>({...f,blocs:[...f.blocs,{titre:"",note:"",series:"",reps:"",charge_kg:""}]}))}
                        style={{background:col+"10",border:`1px dashed ${col}40`,borderRadius:8,color:col,fontSize:12,fontWeight:700,padding:"10px",cursor:"pointer"}}>
                        + {isMuscu?"Ajouter un exercice":"Ajouter un bloc"}
                      </button>
                    </div>
                  </div>

                  {/* Ressenti */}
                  <div style={{marginBottom:12}}>
                    <label style={{color:"#64748b",fontSize:11,display:"block",marginBottom:6}}>Ressenti / 10</label>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                        const active = libreForm.ressenti===n;
                        const c = n<=3?"#ef4444":n<=6?"#f59e0b":n<=8?"#0ea5e9":"#4ade80";
                        return <button key={n} onClick={()=>setLibreForm(f=>({...f,ressenti:n}))}
                          style={{width:32,height:32,borderRadius:7,border:`2px solid ${active?c:"#334155"}`,background:active?c+"30":"transparent",color:active?c:"#64748b",fontWeight:active?800:500,fontSize:13,cursor:"pointer"}}>{n}</button>;
                      })}
                    </div>
                  </div>

                  {/* Commentaire */}
                  <textarea placeholder="Commentaire libre..." value={libreForm.commentaire}
                    onChange={e=>setLibreForm(f=>({...f,commentaire:e.target.value}))}
                    style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",padding:"9px 12px",fontSize:13,resize:"vertical",minHeight:60,boxSizing:"border-box",marginBottom:12}}/>

                  {/* Valider */}
                  <button onClick={saveSeanceLibre} disabled={libreSaving}
                    style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:col,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",opacity:libreSaving?0.6:1}}>
                    {libreSaving?"Enregistrement...":"💾 Enregistrer la séance"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal validation */}
      {showModal&&selSession&&(
        <div style={{position:"fixed",inset:0,background:"#00000080",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:"#1a2744",border:"1px solid #2a3f5f",borderRadius:16,padding:28,width:420,maxWidth:"95vw"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:0}}>{getCompletion(selSession?.id)?"Modifier mes réalisations ✓":"Saisir mes réalisations"}</h2>
              <button style={{background:"none",border:"none",color:"#7a95b0",cursor:"pointer",fontSize:20}} onClick={()=>setShowModal(false)}>×</button>
            </div>
            {/* Header séance */}
            <div style={{background:"#0f172a",borderRadius:8,padding:"10px 14px",marginBottom:16}}>
              <div style={{color:"#94a3b8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{TYPE_SEANCE_LABELS[selSession.type_seance]}</div>
              <div style={{color:"#f1f5f9",fontWeight:800,fontSize:15,marginTop:2}}>{selSession.titre}</div>
            </div>

            {/* Réalisations par bloc */}
            {(()=>{
              const contenu = typeof selSession.contenu==="string"?JSON.parse(selSession.contenu||"{}"):selSession.contenu||{};
              const blocs = contenu.blocs||[];
              const isMuscu = selSession.type_seance==="MUSCU";
              const isPlio = selSession.type_seance==="PLIO";
              if(!blocs.length) return null;
              return(
                <div style={{marginBottom:16}}>
                  <div style={{color:"#64748b",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
                    {isMuscu?"Charges réalisées":isPlio?"Réalisations":"Réalisations"}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
                    {blocs.map((b,i)=>{
                      const sc = selSession.type_seance==="MUSCU"?"#f97316":selSession.type_seance==="ERGO"?"#0ea5e9":selSession.type_seance==="BATEAU"?"#06b6d4":"#f59e0b";
                      return(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#0f172a",borderRadius:8,padding:"7px 10px"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{color:"#e2e8f0",fontWeight:600,fontSize:12}}>{b.titre}</div>
                            {b.detail&&<div style={{color:"#475569",fontSize:11,fontFamily:"monospace"}}>{b.detail}</div>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <input
                                placeholder={(()=>{
                                const t = (b.titre||"").toLowerCase();
                                if(isMuscu) return "kg";
                                if(t.includes("échauff")||t.includes("recup")||t.includes("récup")) return "ex: 2km, 10min";
                                if(t.includes("cadence")||t.includes("spm")) return "ex: 26 spm";
                                if(t.includes("format")||t.includes("x ")) return "ex: 1:52/500m";
                                if(t.includes("allure")) return "ex: 1:54";
                                return "réalisé";
                              })()}
                                value={noteForm.charges[i]||""}
                                onChange={e=>setNoteForm(f=>({...f,charges:{...f.charges,[i]:e.target.value}}))}
                                style={{width:isMuscu?56:80,background:"#182030",border:`1px solid ${sc}40`,borderRadius:6,color:"#f1f5f9",padding:"5px 8px",fontSize:12,textAlign:"center"}}
                              />
                              {isMuscu&&<span style={{color:"#475569",fontSize:11}}>kg</span>}
                            </div>
                            {isMuscu&&(()=>{
                              const kg = parseFloat(noteForm.charges[i]);
                              const detailStr = b.detail||"";
                              const repsMatch = detailStr.match(/[×x](\d+(?:-\d+)?)/i);
                              const reps = repsMatch ? parseReps(repsMatch[1]) : null;
                              const rm = calc1RM(kg, reps);
                              return rm ? <span style={{color:"#a78bfa",fontSize:10,fontWeight:700}}>1RM ~{rm}kg</span> : null;
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Ressenti */}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ressenti / 10</label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                  const active = +noteForm.note===n;
                  const col = n<=3?"#ef4444":n<=6?"#f59e0b":n<=8?"#0ea5e9":"#4ade80";
                  return <button key={n} onClick={()=>setNoteForm(f=>({...f,note:n}))}
                    style={{width:34,height:34,borderRadius:7,border:`2px solid ${active?col:"#334155"}`,background:active?col+"30":"transparent",color:active?col:"#64748b",fontWeight:active?800:500,fontSize:13,cursor:"pointer"}}>
                    {n}
                  </button>;
                })}
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Commentaire</label>
              <textarea style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",padding:"9px 12px",fontSize:13,resize:"vertical",minHeight:60,boxSizing:"border-box"}}
                value={noteForm.commentaire} onChange={e=>setNoteForm(f=>({...f,commentaire:e.target.value}))}
                placeholder="Comment s'est passée la séance ?"/>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={{padding:"9px 18px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#64748b",cursor:"pointer"}} onClick={()=>setShowModal(false)}>Annuler</button>
              <button style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0ea5e9",color:"#fff",fontWeight:700,cursor:"pointer"}} onClick={saveCompletion}>{getCompletion(selSession?.id)?"Mettre à jour ✓":"Valider la séance ✓"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================================================================================================
// APP ROOT
// ==========================================================================================================================================================
