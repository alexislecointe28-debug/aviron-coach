import { useState, useEffect, useCallback } from "react";
import { ROLE_COLORS, ROLE_LABELS, ZONE_COLORS, TYPE_COLORS, S } from "../styles.js";
import { api } from "../config/supabase.js";
import { FF, Modal, Toast, Loader, Sparkline, StatPill } from "./ui.jsx";
import { timeToSeconds, secondsToTime, concept2WattsFast, getBestTime, getLastPerf, calcAgeFromDOB, suggestRigging, avg } from "../utils/rowing.js";

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

  const NAV=[{id:"dashboard",label:"Mon espace",icon:"*"},{id:"stats",label:"Mes stats",icon:"*"},{id:"crew",label:"Mon équipage",icon:"~"},{id:"boats",label:"Mon bateau",icon:"~"},{id:"planning",label:"Mon planning",icon:"#"},...(managedSections.length>0?[{id:"section",label:"Ma section",icon:"👥"}]:[])];
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
        {tab==="stats"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mes Stats</h1><p style={S.sub}>Progression</p></div></div>
          {myPerfs.length<2?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Ajoute au moins 2 sessions pour voir ta progression.</div>:(<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
              {/* Filtre type perf */}
              <div style={{display:"flex",gap:6,marginBottom:12}}>{"500m 1000m 2000m".split(" ").map(t=><button key={t} onClick={()=>setPerfTypeFilter(t)} style={{padding:"4px 12px",borderRadius:6,border:`1px solid ${perfTypeFilter===t?"#a78bfa":"#1e293b"}`,background:perfTypeFilter===t?"#a78bfa20":"transparent",color:perfTypeFilter===t?"#a78bfa":"#5a7a9a",fontSize:12,cursor:"pointer",fontWeight:perfTypeFilter===t?700:400}}>{t}</button>)}</div>
              {[{l:`Best ${perfTypeFilter}`,v:best?.time??"--",c:"#4ade80",ic:"~"},{l:"Record watts",v:`${Math.max(...myPerfs.map(p=>concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts||0))}W`,c:"#0ea5e9",ic:"~"},{l:"W/kg actuel",v:wpkg??"--",c:"#a78bfa",ic:"~"},{l:"Km totaux",v:`${filteredPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"~"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:22,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[{l:"Puissance",vals:myPerfs.map(p=>concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts||0),c:"#0ea5e9",hi:true},{l:"Temps 2k (s)",vals:myPerfs.map(p=>timeToSeconds(p.time)),c:"#4ade80",hi:false,disp:v=>secondsToTime(v)},{l:"W/kg",vals:myPerfs.map(p=>+((concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts||0)/(athlete.weight||1)).toFixed(2)),c:"#a78bfa",hi:true},{l:"Distance",vals:myPerfs.map(p=>p.distance||0),c:"#f97316",hi:true}].map(m=>{const lv=m.vals[m.vals.length-1],pv=m.vals[m.vals.length-2],diff=lv-pv,up=m.hi?diff>0:diff<0;return(<div key={m.l} style={S.mc}><div style={{color:"#7a95b0",fontSize:12,marginBottom:6}}>{m.l}</div><div style={{color:m.c,fontSize:22,fontWeight:900}}>{m.disp?m.disp(lv):lv}</div><div style={{color:up?"#4ade80":"#ef4444",fontSize:12,marginBottom:8}}>{up?"^":"v"} {Math.abs(diff)}</div><Sparkline data={m.vals} color={m.c} invert={!m.hi}/></div>);})}
            </div>
          </>)}
        </div>)}
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
          <div style={S.ph}><div><h1 style={S.ttl}>Mon Bateau</h1><p style={S.sub}>Réglages de ton poste</p></div></div>
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
        {tab==="planning"&&(<div style={{...S.page,padding:0}}>
          <AthletePlanningView athlete={athlete} currentUser={currentUser} isMobile={isMobile}/>
        </div>)}
      </div>

      {/* Bottom nav mobile */}
      {isMobile&&(
        <nav style={{position:"fixed",bottom:0,left:0,right:0,height:56,background:"#0f1923",borderTop:"1px solid #2d1b4e",display:"flex",zIndex:100}}>
          {NAV.map(n=>{
            const active=tab===n.id;
            const ICONS={dashboard:"🏠",stats:"📊",crew:"👥",boats:"⛵",planning:"📅",section:"🏅"};
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

function AthletePlanningView({ athlete, currentUser }) {
  const [weeks, setWeeks]           = useState([]);
  const [selWeek, setSelWeek]       = useState(null);
  const [sessions, setSessions]     = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [selSession, setSelSession] = useState(null);
  const [noteForm, setNoteForm]     = useState({ note:"", commentaire:"" });

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

  function openNote(session) {
    const existing = getCompletion(session.id);
    setSelSession(session);
    setNoteForm({ note: existing?.note||"", commentaire: existing?.commentaire||"" });
    setShowModal(true);
  }

  async function saveCompletion() {
    if(!selSession||!athlete) return;
    const existing = getCompletion(selSession.id);
    try {
      let res;
      if(existing) {
        res = await api.updateCompletion(existing.id, { note:+noteForm.note||null, commentaire:noteForm.commentaire });
        setCompletions(c=>c.map(x=>x.id===existing.id?{...x,...res?.[0]}:x));
      } else {
        res = await api.createCompletion({ session_id:selSession.id, athlete_id:athlete.id, note:+noteForm.note||null, commentaire:noteForm.commentaire });
        if(res&&res[0]) setCompletions(c=>[...c,res[0]]);
      }
      setToast("Séance validée ✓");
      setTimeout(()=>setToast(null),2500);
      setShowModal(false);
    } catch(e) { setToast("Erreur"); setTimeout(()=>setToast(null),2500); }
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

      {/* Grille jours */}
      {sessions.length===0?(
        <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:40,textAlign:"center",color:"#64748b"}}>Aucune séance cette semaine.</div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
          {JOURS.map(jour=>{
            const joursessions = byDay[jour]||[];
            if(joursessions.length===0) return (
              <div key={jour} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"12px 10px",minHeight:80,opacity:0.4}}>
                <div style={{fontWeight:700,color:"#334155",fontSize:12,marginBottom:6}}>{jour.slice(0,3)}</div>
                <div style={{color:"#1e293b",fontSize:11}}>Repos</div>
              </div>
            );
            return (
              <div key={jour} style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontWeight:700,color:"#94a3b8",fontSize:12,padding:"0 2px"}}>{jour}</div>
                {joursessions.map(s=>{
                  const sc = TYPE_SEANCE_COLORS[s.type_seance]||"#64748b";
                  const done = getCompletion(s.id);
                  const contenu = typeof s.contenu==="string"?JSON.parse(s.contenu||"{}"):s.contenu||{};
                  return (
                    <div key={s.id} style={{background:done?"#4ade8010":"#1e293b",border:`2px solid ${done?"#4ade8040":sc+"40"}`,borderRadius:10,padding:"12px"}}>
                      {/* Type + titre */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:10,fontWeight:700,color:sc,background:sc+"20",padding:"2px 8px",borderRadius:4}}>{TYPE_SEANCE_LABELS[s.type_seance]||s.type_seance}</span>
                        {done&&<span style={{fontSize:10,color:"#4ade80",fontWeight:700}}>✓</span>}
                      </div>
                      <div style={{fontWeight:700,color:"#f1f5f9",fontSize:13,marginBottom:6}}>{s.titre}</div>
                      {/* Blocs contenu */}
                      {contenu.blocs?.slice(0,2).map((b,i)=>(
                        <div key={i} style={{fontSize:11,color:"#64748b",marginBottom:2}}>
                          <span style={{color:"#475569"}}>• </span><b style={{color:"#94a3b8"}}>{b.titre}</b> {b.detail&&`— ${b.detail}`}
                        </div>
                      ))}
                      {contenu.blocs?.length>2&&<div style={{color:"#475569",fontSize:11}}>+{contenu.blocs.length-2} blocs</div>}
                      {contenu.duree_min>0&&<div style={{color:"#475569",fontSize:11,marginTop:4}}>⏱ {contenu.duree_min} min</div>}
                      {/* Note si fait */}
                      {done&&done.note&&<div style={{marginTop:6,fontSize:11,color:"#4ade80"}}>Note : {done.note}/10{done.commentaire?` — "${done.commentaire}"`:""}</div>}
                      {/* Bouton */}
                      {s.type_seance!=="REPOS"&&(
                        <button onClick={()=>openNote(s)}
                          style={{marginTop:10,width:"100%",padding:"7px",borderRadius:7,border:`1px solid ${done?"#4ade8040":"#334155"}`,background:done?"#4ade8015":"#0f172a",color:done?"#4ade80":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          {done?"✓ Modifier":"Marquer comme fait"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal validation */}
      {showModal&&selSession&&(
        <div style={{position:"fixed",inset:0,background:"#00000080",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{background:"#1a2744",border:"1px solid #2a3f5f",borderRadius:16,padding:28,width:420,maxWidth:"95vw"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:0}}>Séance effectuée ✓</h2>
              <button style={{background:"none",border:"none",color:"#7a95b0",cursor:"pointer",fontSize:20}} onClick={()=>setShowModal(false)}>×</button>
            </div>
            <div style={{background:"#0f172a",borderRadius:8,padding:"10px 14px",marginBottom:20}}>
              <div style={{color:"#94a3b8",fontSize:12,fontWeight:700}}>{TYPE_SEANCE_LABELS[selSession.type_seance]}</div>
              <div style={{color:"#f1f5f9",fontWeight:700,marginTop:2}}>{selSession.titre}</div>
            </div>
            {/* Note /10 */}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ressenti / 10</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                  const active = +noteForm.note===n;
                  const col = n<=3?"#ef4444":n<=6?"#f59e0b":n<=8?"#0ea5e9":"#4ade80";
                  return <button key={n} onClick={()=>setNoteForm(f=>({...f,note:n}))}
                    style={{width:36,height:36,borderRadius:8,border:`2px solid ${active?col:"#334155"}`,background:active?col+"30":"transparent",color:active?col:"#64748b",fontWeight:active?800:500,fontSize:14,cursor:"pointer"}}>
                    {n}
                  </button>;
                })}
              </div>
            </div>
            {/* Commentaire */}
            <div style={{marginBottom:20}}>
              <label style={{display:"block",color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Commentaire (optionnel)</label>
              <textarea style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",padding:"10px 12px",fontSize:13,resize:"vertical",minHeight:70,boxSizing:"border-box"}}
                value={noteForm.commentaire} onChange={e=>setNoteForm(f=>({...f,commentaire:e.target.value}))}
                placeholder="Comment s'est passée la séance ?"/>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={{padding:"9px 18px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#64748b",cursor:"pointer"}} onClick={()=>setShowModal(false)}>Annuler</button>
              <button style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0ea5e9",color:"#fff",fontWeight:700,cursor:"pointer"}} onClick={saveCompletion}>Valider</button>
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
