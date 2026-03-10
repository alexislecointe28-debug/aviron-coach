import { useState, useEffect } from "react";
import { ROLE_COLORS, ROLE_LABELS, ZONE_COLORS, TYPE_COLORS, S } from "../styles.js";
import { api } from "../config/supabase.js";
import { FF, Modal, Toast, Loader } from "./ui.jsx";
import { timeToSeconds, secondsToTime, concept2WattsFast, getBestTime, getLastPerf, calcAgeFromDOB, suggestRigging } from "../utils/rowing.js";

export default function AthleteSpace({ currentUser, onLogout }) {
  const [tab,setTab]   = useState("dashboard");
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
  const [newPerf,setNP] = useState({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""});
  const [toast,setToast] = useState(null);

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

  const myCrew = athlete ? crews.find(c=>crewMembers.some(m=>m.crew_id===c.id&&m.athlete_id===athlete.id)) : null;
  const crewMates = myCrew ? allAthletes.filter(a=>crewMembers.some(m=>m.crew_id===myCrew.id&&m.athlete_id===a.id)&&a.id!==athlete?.id) : [];
  const mySessions = sessions.filter(s=>myCrew&&sessionCrews.some(sc=>sc.session_id===s.id&&sc.crew_id===myCrew.id));
  const best=getBestTime(myPerfs), last=getLastPerf(myPerfs);
  const lastWatts = last ? (concept2WattsFast(last.time)||last.watts||0) : null;
  const wpkg = lastWatts&&athlete?.weight ? (lastWatts/athlete.weight).toFixed(2) : null;

  async function saveEdit() {
    await api.updateAthlete(athlete.id,{weight:+editForm.weight,age:+editForm.age});
    setToast({m:"Fiche mise à jour v",t:"success"}); load(); setEditing(false);
  }
  async function addPerf() {
    const watts = concept2WattsFast(newPerf.time) || 0;
    await api.createPerf({athlete_id:currentUser.athlete_id,date:newPerf.date,time:newPerf.time,watts,spm:+newPerf.spm,hr:+newPerf.hr,rpe:+newPerf.rpe,distance:+newPerf.distance});
    setToast({m:"Performance enregistrée v",t:"success"}); load();
    setNP({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""}); setShowAddPerf(false);
  }

  const NAV=[{id:"dashboard",label:"Mon espace",icon:"*"},{id:"stats",label:"Mes stats",icon:"*"},{id:"crew",label:"Mon équipage",icon:"~"},{id:"boats",label:"Mon bateau",icon:"~"},{id:"planning",label:"Mon planning",icon:"#"}];
  if(loading) return <div style={{...S.root,alignItems:"center",justifyContent:"center"}}><Loader/></div>;
  if(!athlete) return <div style={{minHeight:"100vh",background:"#0f1923",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontFamily:"monospace"}}>Fiche athlète introuvable. Contacte ton coach.</div>;

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={{...S.sidebar,borderColor:"#2d1b4e"}}>
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
      <div style={S.main}>
        {tab==="dashboard"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Bonjour, {athlete.name.split(" ")[0]} </h1><p style={S.sub}>Ton espace personnel</p></div><button style={{...S.btnP,background:"#a78bfa",color:"#0f1923"}} onClick={()=>setEditing(true)}>✏️ Ma fiche</button></div>
          <div style={{...S.card,marginBottom:24,borderColor:"#2d1b4e"}}>
            <div style={{display:"flex",alignItems:"center",gap:20}}>
              <div style={{...S.av,width:64,height:64,fontSize:22,background:"#a78bfa22",border:"2px solid #a78bfa44",color:"#a78bfa"}}>{athlete.avatar}</div>
              <div style={{flex:1}}><div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{athlete.name}</div><div style={{color:"#7a95b0",fontSize:14,marginTop:2}}>{athlete.category} - {athlete.age}ans - {athlete.weight}kg</div></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"12px 18px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2000m</div><div style={{color:"#4ade80",fontWeight:900,fontSize:26}}>{best?.time??"--"}</div><div style={{color:"#5a7a9a",fontSize:11}}>{best?.date??""}</div></div>
                <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"12px 18px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:26}}>{wpkg??"--"}</div><div style={{color:"#5a7a9a",fontSize:11}}>{lastWatts}W - {athlete.weight}kg</div></div>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
            {[{l:"Sessions",v:myPerfs.length,c:"#0ea5e9",ic:"*"},{l:"Dernière puiss.",v:last?`${last.watts}W`:"--",c:"#a78bfa",ic:"~"},{l:"Km cumulés",v:`${myPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"~"},{l:"Équipage",v:myCrew?.name??"--",c:"#4ade80",ic:"~"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:18,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
          </div>
          <div style={S.st}>Dernières performances</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {[...myPerfs].reverse().slice(0,4).map(p=>{const pw=concept2WattsFast(p.time)||p.watts||0;const pwkg=pw&&athlete?.weight?(pw/athlete.weight).toFixed(2):null;return(<div key={p.id} style={{...S.card,display:"flex",alignItems:"center",gap:12,padding:"12px 18px",flexWrap:"wrap"}}><div style={{color:"#7a95b0",fontSize:12,minWidth:85}}>{p.date}</div><div style={{color:"#4ade80",fontWeight:700,fontSize:16,minWidth:55}}>{p.time}</div><div style={{color:"#0ea5e9",fontWeight:700}}>⚡ {pw}W</div>{pwkg&&<div style={{color:"#a78bfa",fontWeight:700,fontSize:13}}>{pwkg} W/kg</div>}<div style={{color:"#f59e0b",fontSize:12}}>{p.spm} spm</div><div style={{color:"#ef4444",fontSize:12}}>{p.hr} bpm</div><div style={{marginLeft:"auto",color:"#f97316",fontSize:12}}>{p.distance}km</div><div style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff"}}>{p.rpe}/10</div></div>);})}
            {!myPerfs.length&&<div style={{...S.card,textAlign:"center",color:"#5a7a9a",padding:"28px"}}>Aucune performance</div>}
          </div>
          <button style={{...S.btnP,background:"#a78bfa",color:"#0f1923"}} onClick={()=>setShowAddPerf(true)}>+ Ajouter une performance</button>
          {editing&&<Modal title="Éditer ma fiche" onClose={()=>setEditing(false)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Âge"><input style={S.inp} type="number" value={editForm.age} onChange={e=>setEditForm(p=>({...p,age:e.target.value}))}/></FF>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editForm.weight} onChange={e=>setEditForm(p=>({...p,weight:e.target.value}))}/></FF>
            </div>
            
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#0f1923"}} onClick={saveEdit}>Enregistrer</button>
          </Modal>}
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
            <FF label="Temps 2000m"><input style={S.inp} placeholder="6:45.0" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
            {newPerf.time&&concept2WattsFast(newPerf.time)&&(()=>{const w=concept2WattsFast(newPerf.time);const wpkgVal=athlete?.weight?(w/athlete.weight).toFixed(2):null;return(
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
        </div>)}
        {tab==="codes"&&(
          <div style={S.page}>
            <div style={S.ph}>
              <div><h1 style={S.ttl}>Codes d&apos;invitation</h1><p style={S.sub}>Gérer les accès à la plateforme</p></div>
              <button style={{...S.btnP,background:"#f59e0b",color:"#0f1923"}} onClick={()=>setShowAddCode(true)}>+ Nouveau code</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
              {[{l:"Total",v:codes.length,c:"#f1f5f9"},{l:"Actifs",v:codes.filter(c=>c.active).length,c:"#4ade80"},{l:"Utilisations",v:codes.reduce((s,c)=>s+(c.uses_count||0),0),c:"#0ea5e9"}].map((k,i)=>(
                <div key={i} style={S.kpi}><div style={{color:k.c,fontSize:28,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>
              ))}
            </div>
            {loading?<Loader/>:(
              <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
                  <thead><tr>{["Code","Rôle","Utilisations","Statut","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {codes.map(c=>(
                      <tr key={c.id} style={{borderBottom:"1px solid #1e293b",opacity:c.active?1:0.5}}>
                        <td style={S.td}>
                          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:16,color:"#f59e0b",letterSpacing:2}}>{c.code}</div>
                        </td>
                        <td style={S.td}>
                          <span style={{...S.badge,background:(ROLE_COLORS[c.role]||"#374151")+"22",color:ROLE_COLORS[c.role]||"#94a3b8",border:"1px solid "+(ROLE_COLORS[c.role]||"#374151")+"40"}}>
                            {ROLE_LABELS[c.role]||c.role}
                          </span>
                        </td>
                        <td style={{...S.td,color:"#0ea5e9",fontWeight:700}}>
                          {c.uses_count||0}{c.max_uses?` / ${c.max_uses}`:" / ∞"}
                        </td>
                        <td style={S.td}>
                          <span style={{...S.badge,background:c.active?"#4ade8020":"#ef444420",color:c.active?"#4ade80":"#ef4444",border:`1px solid ${c.active?"#4ade8040":"#ef444440"}`}}>
                            {c.active?"Actif":"Inactif"}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{display:"flex",gap:6}}>
                            <button style={{...S.actionBtn,color:"#f59e0b",borderColor:"#f59e0b30"}} onClick={()=>toggleCode(c.id,c.active)}>{c.active?"Désact.":"Activer"}</button>
                            <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#0ea5e930",fontSize:10}} onClick={()=>resetCode(c.id)}>Reset</button>
                            <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>deleteCode(c.id)}>X</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!codes.length&&<tr><td colSpan={5} style={{...S.td,textAlign:"center",padding:"32px",color:"#5a7a9a"}}>Aucun code d&apos;invitation</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{marginTop:20,padding:"14px 18px",background:"#182030",border:"1px solid #1e293b",borderRadius:10,fontSize:12,color:"#7a95b0"}}>
              Communique les codes à tes membres par SMS ou email. Code actuel athlète : <strong style={{color:"#f59e0b",fontFamily:"monospace"}}>CLUB2026</strong> — Coach : <strong style={{color:"#0ea5e9",fontFamily:"monospace"}}>COACH2026</strong>
            </div>
            {showAddCode&&<Modal title="Nouveau code d&apos;invitation" onClose={()=>setShowAddCode(false)}>
              <FF label="Code (majuscules)"><input style={{...S.inp,textTransform:"uppercase",letterSpacing:3,fontFamily:"monospace",fontWeight:700}} placeholder="ex: CLUB2026" value={newCode.code} onChange={e=>setNewCode(p=>({...p,code:e.target.value.toUpperCase()}))}/></FF>
              <FF label="Rôle accordé">
                <div style={{display:"flex",gap:8}}>
                  {[["athlete","Athlète"],["coach","Coach"],["admin","Admin"]].map(([v,l])=>(
                    <button key={v} style={{...S.fb,flex:1,...(newCode.role===v?{background:(ROLE_COLORS[v]||"#374151")+"20",border:"1px solid "+(ROLE_COLORS[v]||"#374151")+"60",color:ROLE_COLORS[v]||"#94a3b8"}:{})}} onClick={()=>setNewCode(p=>({...p,role:v}))}>{l}</button>
                  ))}
                </div>
              </FF>
              <FF label="Nombre max d&apos;utilisations (vide = illimité)">
                <input style={S.inp} type="number" min="1" placeholder="illimité" value={newCode.max_uses} onChange={e=>setNewCode(p=>({...p,max_uses:e.target.value}))}/>
              </FF>
              <button style={{...S.btnP,width:"100%",marginTop:8,background:"#f59e0b",color:"#0f1923"}} onClick={addCode}>Créer le code</button>
            </Modal>}
          </div>
        )}
        {tab==="stats"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mes Stats</h1><p style={S.sub}>Progression</p></div></div>
          {myPerfs.length<2?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Ajoute au moins 2 sessions pour voir ta progression.</div>:(<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
              {[{l:"Best 2k",v:best?.time??"--",c:"#4ade80",ic:"~"},{l:"Record watts",v:`${Math.max(...myPerfs.map(p=>concept2WattsFast(p.time)||p.watts||0))}W`,c:"#0ea5e9",ic:"~"},{l:"W/kg actuel",v:wpkg??"--",c:"#a78bfa",ic:"~"},{l:"SPM moyen",v:Math.round(avg(myPerfs.map(p=>p.spm))),c:"#f59e0b",ic:"~"},{l:"FC moyenne",v:`${Math.round(avg(myPerfs.map(p=>p.hr)))}bpm`,c:"#ef4444",ic:"~"},{l:"Km totaux",v:`${myPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"~"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:22,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[{l:"Puissance",vals:myPerfs.map(p=>concept2WattsFast(p.time)||p.watts||0),c:"#0ea5e9",hi:true},{l:"Temps 2k (s)",vals:myPerfs.map(p=>timeToSeconds(p.time)),c:"#4ade80",hi:false,disp:v=>secondsToTime(v)},{l:"W/kg",vals:myPerfs.map(p=>+((concept2WattsFast(p.time)||p.watts||0)/(athlete.weight||1)).toFixed(2)),c:"#a78bfa",hi:true},{l:"SPM",vals:myPerfs.map(p=>p.spm),c:"#f59e0b",hi:true},{l:"FC",vals:myPerfs.map(p=>p.hr),c:"#ef4444",hi:false},{l:"Distance",vals:myPerfs.map(p=>p.distance||0),c:"#f97316",hi:true}].map(m=>{const lv=m.vals[m.vals.length-1],pv=m.vals[m.vals.length-2],diff=lv-pv,up=m.hi?diff>0:diff<0;return(<div key={m.l} style={S.mc}><div style={{color:"#7a95b0",fontSize:12,marginBottom:6}}>{m.l}</div><div style={{color:m.c,fontSize:22,fontWeight:900}}>{m.disp?m.disp(lv):lv}</div><div style={{color:up?"#4ade80":"#ef4444",fontSize:12,marginBottom:8}}>{up?"^":"v"} {Math.abs(diff)}</div><Sparkline data={m.vals} color={m.c} invert={!m.hi}/></div>);})}
            </div>
          </>)}
        </div>)}
        {tab==="crew"&&(<div style={S.page}>
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
        {tab==="boats"&&(<div style={S.page}>
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
        {tab==="planning"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mon Planning</h1><p style={S.sub}>Seances assignees par le coach</p></div></div>
          {!myCrew?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Aucun equipage assigne.</div>:(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
              {sessions.map(s=>{
                const assigned=sessionCrews.some(sc=>sc.session_id===s.id&&sc.crew_id===myCrew.id);
                const tColor=TYPE_COLORS[s.type] ? TYPE_COLORS[s.type] : "#374151";
                const zColor=ZONE_COLORS[s.zone] ? ZONE_COLORS[s.zone] : "#374151";
                return(<div key={s.id} style={{...S.card,borderTop:"3px solid "+(assigned?tColor:"#263547"),opacity:assigned?1:0.3}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{fontWeight:800,fontSize:16,color:"#f1f5f9"}}>{s.day}</div><div style={{color:"#7a95b0",fontSize:12}}>{s.date}</div></div><div style={{...S.badge,background:zColor+"22",color:zColor}}>{s.zone}</div></div>
                  <div style={{...S.badge,marginBottom:8,background:tColor+"22",color:tColor}}>{s.type}</div>
                  {assigned&&<>{s.duration&&<div style={{color:"#a8bfd4",fontSize:13,marginBottom:8}}>{s.duration}</div>}{s.notes&&<div style={{background:"#1e293b50",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#a8bfd4",lineHeight:1.5}}>{s.notes}</div>}</>}
                </div>);
              })}
            </div>
          )}
        </div>)}
      </div>
    </div>
  );
}

// ==========================================================================================================================================================
// APP ROOT
// ==========================================================================================================================================================
