import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kiyhjgikyjduyupnubuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_VzHiBH0KcoJCOoPerdK0lA_baD53pYY";

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// CRUD helpers
const api = {
  // Users
  getUsers:        ()          => sb("users?select=*&order=created_at"),
  createUser:      (data)      => sb("users", { method:"POST", body:JSON.stringify(data) }),
  updateUser:      (id, data)  => sb(`users?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteUser:      (id)        => sb(`users?id=eq.${id}`, { method:"DELETE", prefer:"" }),
  loginUser:       (email, pw) => sb(`users?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(pw)}&active=eq.true&select=*`),

  // Athletes
  getAthletes:     ()          => sb("athletes?select=*&order=name"),
  updateAthlete:   (id, data)  => sb(`athletes?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  createAthlete:   (data)      => sb("athletes", { method:"POST", body:JSON.stringify(data) }),
  deleteAthlete:   (id)        => sb(`athletes?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Performances
  getPerformances: ()          => sb("performances?select=*&order=date"),
  createPerf:      (data)      => sb("performances", { method:"POST", body:JSON.stringify(data) }),
  deletePerf:      (id)        => sb(`performances?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Crews
  getCrews:        ()          => sb("crews?select=*&order=name"),
  createCrew:      (data)      => sb("crews", { method:"POST", body:JSON.stringify(data) }),
  getCrewMembers:  ()          => sb("crew_members?select=*"),
  addCrewMember:   (data)      => sb("crew_members", { method:"POST", body:JSON.stringify(data) }),
  removeCrewMembers:(crewId)   => sb(`crew_members?crew_id=eq.${crewId}`, { method:"DELETE", prefer:"" }),

  // Sessions
  getSessions:     ()          => sb("sessions?select=*&order=date"),
  getSessionCrews: ()          => sb("session_crews?select=*"),

  // Boats
  getBoats:        ()          => sb("boats?select=*&order=name"),
  createBoat:      (data)      => sb("boats", { method:"POST", body:JSON.stringify(data) }),
  updateBoat:      (id, data)  => sb(`boats?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteBoat:      (id)        => sb(`boats?id=eq.${id}`, { method:"DELETE", prefer:"" }),
  getBoatCrews:    ()          => sb("boat_crews?select=*"),
  addBoatCrew:     (data)      => sb("boat_crews", { method:"POST", body:JSON.stringify(data) }),
  removeBoatCrew:  (boatId, crewId) => sb(`boat_crews?boat_id=eq.${boatId}&crew_id=eq.${crewId}`, { method:"DELETE", prefer:"" }),
  getBoatSettings: ()          => sb("boat_settings?select=*&order=date_reglage.desc"),
  createBoatSetting: (data)    => sb("boat_settings", { method:"POST", body:JSON.stringify(data) }),
  updateBoatSetting: (id, data)=> sb(`boat_settings?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteBoatSetting: (id)      => sb(`boat_settings?id=eq.${id}`, { method:"DELETE", prefer:"" }),
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function timeToSeconds(t) { if(!t||!t.includes(":"))return 9999; const[m,s]=t.split(":").map(Number); return m*60+s; }
function secondsToTime(s) { const m=Math.floor(s/60),sec=Math.round(s%60); return `${m}:${String(sec).padStart(2,"0")}`; }
function getBestTime(perfs) { if(!perfs.length)return null; return perfs.reduce((b,p)=>timeToSeconds(p.time)<timeToSeconds(b.time)?p:b); }
function getLastPerf(perfs) { if(!perfs.length)return null; return [...perfs].sort((a,b)=>b.date.localeCompare(a.date))[0]; }
function avg(arr) { return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0; }

const ROLE_COLORS = { admin:"#f59e0b", coach:"#22d3ee", athlete:"#a78bfa" };
const ROLE_LABELS = { admin:"Super Admin", coach:"Coach", athlete:"Athlète" };
const ROLE_ICONS  = { admin:"⚙️", coach:"🎯", athlete:"🚣" };
const ZONE_COLORS = { Z1:"#4ade80",Z2:"#22d3ee",Z3:"#f59e0b",Z4:"#f97316",Z5:"#ef4444",Race:"#a78bfa","—":"#374151" };
const TYPE_COLORS = { Endurance:"#22d3ee","Fractionné":"#f97316","Repos actif":"#4ade80",Seuil:"#f59e0b",Sprint:"#ef4444",Compétition:"#a78bfa",Repos:"#374151" };
const CMP_COLORS  = ["#22d3ee","#f97316","#a78bfa","#4ade80"];
const CREW_SLOTS  = { "1x":1,"2x":2,"2-":2,"4x":4,"4-":4,"4+":4,"8+":8 };

// ─── MINI COMPOSANTS ─────────────────────────────────────────────────────────
function Sparkline({ data, color="#22d3ee", invert=false }) {
  if(!data||data.length<2)return null;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1,w=72,h=26;
  const pts=data.map((v,i)=>{ const x=(i/(data.length-1))*w,y=invert?((v-min)/range)*h:h-((v-min)/range)*h; return `${x},${y}`; }).join(" ");
  const last=pts.split(" ").pop().split(",");
  return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx={last[0]} cy={last[1]} r="3" fill={color}/></svg>;
}
function StatPill({ label, value, color }) {
  return <div style={{background:color+"15",border:`1px solid ${color}30`,borderRadius:8,padding:"5px 10px",textAlign:"center"}}><div style={{color,fontWeight:700,fontSize:14}}>{value}</div><div style={{color:"#64748b",fontSize:10}}>{label}</div></div>;
}
function FF({ label, children }) {
  return <div style={{marginBottom:12}}><label style={{display:"block",color:"#64748b",fontSize:11,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{label}</label>{children}</div>;
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,width:wide?660:440}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:0}}>{title}</h2>
          <button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:20}} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Loader({ text="Chargement…" }) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",flexDirection:"column",gap:16}}>
    <div style={{width:40,height:40,border:"3px solid #1e293b",borderTop:"3px solid #22d3ee",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{color:"#64748b",fontSize:14}}>{text}</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
function Toast({ message, type="success", onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2500); return()=>clearTimeout(t); },[]);
  return <div style={{position:"fixed",bottom:24,right:24,background:type==="error"?"#ef444420":"#4ade8020",border:`1px solid ${type==="error"?"#ef4444":"#4ade80"}`,color:type==="error"?"#ef4444":"#4ade80",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:700,zIndex:200,fontFamily:"'DM Mono',monospace"}}>{message}</div>;
}

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [email,setEmail]=useState(""); const [pwd,setPwd]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  async function login() {
    setErr(""); setLoading(true);
    try {
      const results = await api.loginUser(email, pwd);
      if(results.length>0) onLogin(results[0]);
      else setErr("Email ou mot de passe incorrect, ou compte désactivé.");
    } catch(e) { setErr("Erreur de connexion. Vérifie ta configuration Supabase."); }
    setLoading(false);
  }
  return (
    <div style={{minHeight:"100vh",background:"#070d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono','Fira Code',monospace"}}>
      <div style={{width:420}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:52,marginBottom:12}}>🚣</div>
          <div style={{fontSize:22,fontWeight:900,color:"#22d3ee",letterSpacing:1}}>AvironCoach</div>
          <div style={{fontSize:11,color:"#475569",letterSpacing:3,textTransform:"uppercase",marginTop:4}}>Performance Track</div>
        </div>
        <div style={{background:"#0d1628",border:"1px solid #1e293b",borderRadius:16,padding:"36px 32px"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>Connexion</div>
          <div style={{fontSize:13,color:"#475569",marginBottom:28}}>Admin · Coach · Athlète</div>
          <FF label="Email"><input style={{...S.inp,width:"100%"}} type="email" placeholder="email@club.fr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></FF>
          <FF label="Mot de passe / PIN"><input style={{...S.inp,width:"100%"}} type="password" placeholder="••••" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></FF>
          {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:14,padding:"8px 12px",background:"#ef444415",borderRadius:8,border:"1px solid #ef444430"}}>{err}</div>}
          <button style={{...S.btnP,width:"100%",marginTop:4,padding:"12px",fontSize:14,opacity:loading?0.7:1}} onClick={login} disabled={loading}>{loading?"Connexion…":"Se connecter →"}</button>
          <div style={{marginTop:24,padding:"16px",background:"#1e293b50",borderRadius:10,fontSize:12,color:"#64748b",lineHeight:2}}>
            <div style={{color:"#94a3b8",fontWeight:700,marginBottom:4}}>Comptes de démo</div>
            <div>⚙️ <span style={{color:"#f59e0b"}}>admin@club.fr</span> / <span style={{color:"#f59e0b"}}>admin2026</span></div>
            <div>🎯 <span style={{color:"#22d3ee"}}>coach@club.fr</span> / <span style={{color:"#22d3ee"}}>coach2026</span></div>
            <div>🚣 <span style={{color:"#a78bfa"}}>lucas@club.fr</span> / <span style={{color:"#a78bfa"}}>1234</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═════════════════════════════════════════════════════════════════════════════
function AdminPanel({ currentUser, onLogout }) {
  const [users,setUsers]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [tab,setTab]         = useState("users");
  const [filterRole,setFilterRole] = useState("all");
  const [showAdd,setShowAdd] = useState(false);
  const [editUser,setEditUser]= useState(null);
  const [confirm,setConfirm] = useState(null);
  const [toast,setToast]     = useState(null);
  const [newUser,setNU]      = useState({name:"",email:"",password:"",role:"athlete"});

  const load = useCallback(async()=>{ setLoading(true); setUsers(await api.getUsers()); setLoading(false); },[]);
  useEffect(()=>{ load(); },[]);

  async function addUser() {
    try {
      await api.createUser({...newUser,active:true,athlete_id:null});
      setToast({m:"Compte créé ✓",t:"success"}); load();
      setNU({name:"",email:"",password:"",role:"athlete"}); setShowAdd(false);
    } catch(e){ setToast({m:"Erreur : "+e.message,t:"error"}); }
  }
  async function saveEdit() {
    try {
      await api.updateUser(editUser.id,{name:editUser.name,email:editUser.email,role:editUser.role,...(editUser._newpw?{password:editUser._newpw}:{})});
      setToast({m:"Modifié ✓",t:"success"}); load(); setEditUser(null);
    } catch(e){ setToast({m:"Erreur",t:"error"}); }
  }
  async function changeRole(uid,role) {
    await api.updateUser(uid,{role}); load();
  }
  async function toggleActive(uid,active) {
    await api.updateUser(uid,{active:!active}); load(); setConfirm(null);
    setToast({m:active?"Compte désactivé":"Compte réactivé",t:"success"});
  }
  async function deleteUser(uid) {
    await api.deleteUser(uid); load(); setConfirm(null);
    setToast({m:"Compte supprimé",t:"success"});
  }

  const filtered = filterRole==="all"?users:users.filter(u=>u.role===filterRole);
  const counts   = { admin:users.filter(u=>u.role==="admin").length, coach:users.filter(u=>u.role==="coach").length, athlete:users.filter(u=>u.role==="athlete").length };

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={{...S.sidebar,borderColor:"#3a2a0a"}}>
        <div style={{...S.logo,borderColor:"#3a2a0a"}}><span style={{fontSize:28}}>🚣</span><div><div style={{...S.logoT,color:"#f59e0b"}}>AvironCoach</div><div style={S.logoS}>Super Admin</div></div></div>
        <nav style={{flex:1,padding:"8px 12px"}}>
          {[{id:"users",label:"Comptes",icon:"◉"},{id:"stats",label:"Vue globale",icon:"◈"}].map(n=>(
            <button key={n.id} style={{...S.nb,...(tab===n.id?{...S.nba,color:"#f59e0b",background:"#f59e0b15",borderLeftColor:"#f59e0b"}:{})}} onClick={()=>setTab(n.id)}><span style={{fontSize:16}}>{n.icon}</span>{n.label}</button>
          ))}
        </nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #3a2a0a"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{...S.av,background:"#f59e0b22",border:"1px solid #f59e0b44",color:"#f59e0b",width:34,height:34,fontSize:14}}>A</div>
            <div><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{currentUser.name}</div><div style={{fontSize:11,color:"#64748b"}}>Super Admin</div></div>
          </div>
          <button style={{...S.btnP,width:"100%",background:"transparent",color:"#64748b",border:"1px solid #1e293b",fontSize:12}} onClick={onLogout}>← Déconnexion</button>
        </div>
      </aside>
      <div style={S.main}>
        {tab==="users"&&(
          <div style={S.page}>
            <div style={S.ph}>
              <div><h1 style={S.ttl}>Gestion des comptes</h1><p style={S.sub}>{users.filter(u=>u.active).length}/{users.length} actifs · données en direct depuis Supabase</p></div>
              <button style={{...S.btnP,background:"#f59e0b",color:"#070d1a"}} onClick={()=>setShowAdd(true)}>+ Nouveau compte</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
              {[{l:"Total",v:users.length,c:"#f1f5f9",ic:"◉"},{l:"Admins",v:counts.admin,c:"#f59e0b",ic:"⚙️"},{l:"Coachs",v:counts.coach,c:"#22d3ee",ic:"🎯"},{l:"Athlètes",v:counts.athlete,c:"#a78bfa",ic:"🚣"}].map((k,i)=>(
                <div key={i} style={S.kpi}><div style={{color:k.c,fontSize:22,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:28,fontWeight:900}}>{k.v}</div><div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {[["all","Tous"],["admin","Admins"],["coach","Coachs"],["athlete","Athlètes"]].map(([v,l])=>(
                <button key={v} style={{...S.fb,...(filterRole===v?{...S.fbon,borderColor:(ROLE_COLORS[v]||"#22d3ee")+"60",color:ROLE_COLORS[v]||"#22d3ee",background:(ROLE_COLORS[v]||"#22d3ee")+"20"}:{})}} onClick={()=>setFilterRole(v)}>{l}</button>
              ))}
            </div>
            {loading?<Loader/>:(
              <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                <table style={{width:"100%",borderCollapse:"collapse",background:"#0d1628"}}>
                  <thead><tr>{["Compte","Email","Rôle","Statut","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filtered.map(u=>(
                      <tr key={u.id} style={{borderBottom:"1px solid #1e293b",opacity:u.active?1:0.5}}>
                        <td style={S.td}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{...S.av,width:36,height:36,fontSize:13,background:ROLE_COLORS[u.role]+"22",border:`1px solid ${ROLE_COLORS[u.role]}40`,color:ROLE_COLORS[u.role]}}>{u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
                            <div><div style={{color:"#f1f5f9",fontWeight:700,fontSize:14}}>{u.name}</div><div style={{color:"#475569",fontSize:11}}>{u.role==="athlete"&&u.athlete_id?`Athlète #${u.athlete_id}`:""}</div></div>
                          </div>
                        </td>
                        <td style={{...S.td,color:"#64748b"}}>{u.email}</td>
                        <td style={S.td}>
                          <select style={{...S.inp,width:"auto",padding:"4px 8px",fontSize:12,color:ROLE_COLORS[u.role],background:"#0d1628",border:`1px solid ${ROLE_COLORS[u.role]}40`}}
                            value={u.role} onChange={e=>changeRole(u.id,e.target.value)} disabled={u.id===currentUser.id}>
                            <option value="admin">⚙️ Super Admin</option>
                            <option value="coach">🎯 Coach</option>
                            <option value="athlete">🚣 Athlète</option>
                          </select>
                        </td>
                        <td style={S.td}><span style={{...S.badge,background:u.active?"#4ade8020":"#ef444420",color:u.active?"#4ade80":"#ef4444",border:`1px solid ${u.active?"#4ade8040":"#ef444440"}`}}>{u.active?"● Actif":"○ Inactif"}</span></td>
                        <td style={S.td}>
                          <div style={{display:"flex",gap:6}}>
                            <button style={{...S.actionBtn,color:"#22d3ee",borderColor:"#22d3ee30"}} onClick={()=>setEditUser({...u,_newpw:""})}>✏️</button>
                            {u.id!==currentUser.id&&<>
                              <button style={{...S.actionBtn,color:u.active?"#f59e0b":"#4ade80",borderColor:u.active?"#f59e0b30":"#4ade8030"}} onClick={()=>setConfirm({u,action:u.active?"deactivate":"activate"})}>{u.active?"⏸":"▶"}</button>
                              <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>setConfirm({u,action:"delete"})}>🗑</button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{marginTop:20,padding:"14px 18px",background:"#0d1628",border:"1px solid #1e293b",borderRadius:10,fontSize:12,color:"#64748b"}}>
              💡 Les changements de rôle sont <strong style={{color:"#94a3b8"}}>immédiats et persistants</strong> dans Supabase.
            </div>

            {showAdd&&<Modal title="Créer un compte" onClose={()=>setShowAdd(false)}>
              <FF label="Rôle"><div style={{display:"flex",gap:8}}>
                {[["admin","⚙️ Admin"],["coach","🎯 Coach"],["athlete","🚣 Athlète"]].map(([v,l])=>(
                  <button key={v} style={{...S.fb,flex:1,...(newUser.role===v?{background:ROLE_COLORS[v]+"20",border:`1px solid ${ROLE_COLORS[v]}60`,color:ROLE_COLORS[v]}:{})}} onClick={()=>setNU(p=>({...p,role:v}))}>{l}</button>
                ))}
              </div></FF>
              <FF label="Nom complet"><input style={S.inp} value={newUser.name} onChange={e=>setNU(p=>({...p,name:e.target.value}))} placeholder="Prénom Nom"/></FF>
              <FF label="Email"><input style={S.inp} type="email" value={newUser.email} onChange={e=>setNU(p=>({...p,email:e.target.value}))} placeholder="prenom@club.fr"/></FF>
              <FF label="Mot de passe / PIN"><input style={S.inp} type="password" value={newUser.password} onChange={e=>setNU(p=>({...p,password:e.target.value}))} placeholder="Choisir un mot de passe"/></FF>
              <button style={{...S.btnP,width:"100%",marginTop:8,background:"#f59e0b",color:"#070d1a"}} onClick={addUser}>Créer le compte</button>
            </Modal>}

            {editUser&&<Modal title="Éditer le compte" onClose={()=>setEditUser(null)}>
              <FF label="Nom"><input style={S.inp} value={editUser.name} onChange={e=>setEditUser(p=>({...p,name:e.target.value}))}/></FF>
              <FF label="Email"><input style={S.inp} type="email" value={editUser.email} onChange={e=>setEditUser(p=>({...p,email:e.target.value}))}/></FF>
              <FF label="Nouveau mot de passe (vide = inchangé)"><input style={S.inp} type="password" placeholder="••••" onChange={e=>setEditUser(p=>({...p,_newpw:e.target.value}))}/></FF>
              <FF label="Rôle"><select style={S.inp} value={editUser.role} onChange={e=>setEditUser(p=>({...p,role:e.target.value}))} disabled={editUser.id===currentUser.id}>
                <option value="admin">⚙️ Super Admin</option><option value="coach">🎯 Coach</option><option value="athlete">🚣 Athlète</option>
              </select></FF>
              <button style={{...S.btnP,width:"100%",marginTop:8,background:"#f59e0b",color:"#070d1a"}} onClick={saveEdit}>Enregistrer</button>
            </Modal>}

            {confirm&&<Modal title="Confirmation" onClose={()=>setConfirm(null)}>
              <div style={{textAlign:"center",padding:"10px 0 20px"}}>
                <div style={{fontSize:40,marginBottom:12}}>{confirm.action==="delete"?"🗑️":confirm.action==="deactivate"?"⏸️":"▶️"}</div>
                <div style={{color:"#f1f5f9",fontSize:16,marginBottom:20}}>{confirm.action==="delete"?`Supprimer ${confirm.u.name} ?`:confirm.action==="deactivate"?`Désactiver ${confirm.u.name} ?`:`Réactiver ${confirm.u.name} ?`}</div>
                <div style={{display:"flex",gap:12,justifyContent:"center"}}>
                  <button style={{...S.btnP,background:"transparent",color:"#64748b",border:"1px solid #1e293b"}} onClick={()=>setConfirm(null)}>Annuler</button>
                  <button style={{...S.btnP,background:confirm.action==="delete"?"#ef4444":confirm.action==="deactivate"?"#f59e0b":"#4ade80",color:"#070d1a"}}
                    onClick={()=>confirm.action==="delete"?deleteUser(confirm.u.id):toggleActive(confirm.u.id,confirm.u.active)}>Confirmer</button>
                </div>
              </div>
            </Modal>}
          </div>
        )}
        {tab==="stats"&&(
          <div style={S.page}>
            <div style={S.ph}><div><h1 style={S.ttl}>Vue globale</h1><p style={S.sub}>Plateforme en temps réel</p></div></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
              {["admin","coach","athlete"].map(role=>{
                const ru=users.filter(u=>u.role===role); const c=ROLE_COLORS[role];
                return(<div key={role} style={{...S.card,borderTop:`3px solid ${c}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div><div style={{color:c,fontWeight:900,fontSize:24}}>{ru.length}</div><div style={{color:"#64748b",fontSize:13,textTransform:"uppercase",letterSpacing:1}}>{ROLE_LABELS[role]}s</div></div><div style={{fontSize:28}}>{ROLE_ICONS[role]}</div></div>
                  {ru.map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:"#1e293b50",borderRadius:6,marginBottom:4}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:u.active?"#4ade80":"#ef4444",flexShrink:0}}/>
                    <span style={{color:"#94a3b8",fontSize:12,flex:1}}>{u.name}</span>
                    <span style={{color:"#475569",fontSize:10}}>{u.active?"actif":"inactif"}</span>
                  </div>)}
                </div>);
              })}
            </div>
            <div style={S.card}>
              <div style={{display:"flex",gap:32,marginBottom:16}}>
                <div style={{textAlign:"center"}}><div style={{color:"#4ade80",fontSize:32,fontWeight:900}}>{users.filter(u=>u.active).length}</div><div style={{color:"#64748b",fontSize:12}}>Actifs</div></div>
                <div style={{textAlign:"center"}}><div style={{color:"#ef4444",fontSize:32,fontWeight:900}}>{users.filter(u=>!u.active).length}</div><div style={{color:"#64748b",fontSize:12}}>Désactivés</div></div>
                <div style={{textAlign:"center"}}><div style={{color:"#f59e0b",fontSize:32,fontWeight:900}}>{users.length}</div><div style={{color:"#64748b",fontSize:12}}>Total</div></div>
              </div>
              <div style={{height:10,borderRadius:5,background:"#1e293b",overflow:"hidden",display:"flex"}}>
                {["admin","coach","athlete"].map(role=><div key={role} style={{width:`${users.length?(users.filter(u=>u.role===role).length/users.length)*100:0}%`,background:ROLE_COLORS[role]}}/>)}
              </div>
              <div style={{display:"flex",gap:16,marginTop:10}}>
                {["admin","coach","athlete"].map(role=><div key={role} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:ROLE_COLORS[role]}}/><span style={{color:"#64748b",fontSize:12}}>{ROLE_LABELS[role]}s ({users.filter(u=>u.role===role).length})</span></div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COACH SPACE
// ═════════════════════════════════════════════════════════════════════════════
function CoachSpace({ currentUser, onLogout }) {
  const [tab,setTab]         = useState("dashboard");
  const [athletes,setAthletes] = useState([]);
  const [performances,setPerformances] = useState([]);
  const [crews,setCrews]     = useState([]);
  const [crewMembers,setCrewMembers] = useState([]);
  const [sessions,setSessions] = useState([]);
  const [sessionCrews,setSessionCrews] = useState([]);
  const [boats,setBoats]       = useState([]);
  const [boatCrews,setBoatCrews] = useState([]);
  const [boatSettings,setBoatSettings] = useState([]);
  const [loading,setLoading] = useState(true);
  const [toast,setToast]     = useState(null);
  const [selAth,setSelAth]   = useState(null);
  const [filterCat,setFilterCat] = useState("Tous");
  const [compareIds,setCompareIds] = useState([]);
  const [crewBoat,setCrewBoat] = useState("4-");
  const [newCrewMembers,setNewCrewMembers] = useState([]);
  const [crewName,setCrewName] = useState("Nouvel équipage");
  const [showAddPerf,setShowAddPerf] = useState(false);
  const [showAddAth,setShowAddAth] = useState(false);
  const [editAth,setEditAth] = useState(null);
  const [newPerf,setNP] = useState({athleteId:"",date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""});
  const [newAth,setNA]  = useState({name:"",age:"",category:"Senior H",weight:"",boat:"1x"});
  // Boats states
  const [selBoat,setSelBoat]   = useState(null);
  const [showAddBoat,setShowAddBoat] = useState(false);
  const [showAddSetting,setShowAddSetting] = useState(false);
  const [editBoat,setEditBoat] = useState(null);
  const [newBoat,setNB]        = useState({name:"",type:"couple",seats:4,brand:"",model:"",avg_buoyancy:"",notes:""});
  const [newSetting,setNS]     = useState({poste:1,date_reglage:"",regle_par:"",entraxe:"",longueur_pedale:"",levier_interieur:"",numero_pelle:"",type_pelle:"",observations:""});

  const load = useCallback(async()=>{
    setLoading(true);
    const [aths,perfs,cr,cm,sess,sc,bt,bc,bs] = await Promise.all([
      api.getAthletes(),api.getPerformances(),api.getCrews(),api.getCrewMembers(),
      api.getSessions(),api.getSessionCrews(),
      api.getBoats(),api.getBoatCrews(),api.getBoatSettings()
    ]);
    setAthletes(aths); setPerformances(perfs); setCrews(cr); setCrewMembers(cm);
    setSessions(sess); setSessionCrews(sc);
    setBoats(bt); setBoatCrews(bc); setBoatSettings(bs);
    if(aths.length>=2) setCompareIds([aths[0].id,aths[1].id]);
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[]);

  function getPerfFor(id) { return performances.filter(p=>p.athlete_id===id).sort((a,b)=>a.date.localeCompare(b.date)); }
  function aStats(a) { const perfs=getPerfFor(a.id),best=getBestTime(perfs),last=getLastPerf(perfs); return{perfs,best,last,wpkg:last&&a.weight?(last.watts/a.weight).toFixed(2):null}; }
  function getCrewForAthlete(a) { const cm=crewMembers.find(m=>m.athlete_id===a.id); return cm?crews.find(c=>c.id===cm.crew_id):null; }
  function getCrewMembersFor(crewId) { return crewMembers.filter(m=>m.crew_id===crewId).map(m=>athletes.find(a=>a.id===m.athlete_id)).filter(Boolean); }
  function getSessionCrewsFor(sessionId) { return sessionCrews.filter(sc=>sc.session_id===sessionId).map(sc=>crews.find(c=>c.id===sc.crew_id)).filter(Boolean); }

  async function addPerf() {
    try {
      await api.createPerf({athlete_id:+newPerf.athleteId,date:newPerf.date,time:newPerf.time,watts:+newPerf.watts,spm:+newPerf.spm,hr:+newPerf.hr,rpe:+newPerf.rpe,distance:+newPerf.distance});
      setToast({m:"Performance ajoutée ✓",t:"success"}); load();
      setNP({athleteId:"",date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""}); setShowAddPerf(false);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function addAth() {
    try {
      const av=newAth.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      await api.createAthlete({...newAth,age:+newAth.age,weight:+newAth.weight,avatar:av,crew_id:null});
      setToast({m:"Athlète ajouté ✓",t:"success"}); load();
      setNA({name:"",age:"",category:"Senior H",weight:"",boat:"1x"}); setShowAddAth(false);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function saveEditAth() {
    try {
      await api.updateAthlete(editAth.id,{name:editAth.name,age:+editAth.age,category:editAth.category,weight:+editAth.weight,boat:editAth.boat});
      setToast({m:"Fiche modifiée ✓",t:"success"}); load(); setEditAth(null);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function saveNewCrew() {
    if(!newCrewMembers.length)return;
    try {
      const [nc]=await api.createCrew({name:crewName,boat:crewBoat,notes:""});
      for(const aid of newCrewMembers) await api.addCrewMember({crew_id:nc.id,athlete_id:aid});
      setToast({m:"Équipage créé ✓",t:"success"}); load();
      setNewCrewMembers([]); setCrewName("Nouvel équipage");
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }

  // Boats CRUD
  async function addBoat() {
    try {
      await api.createBoat({...newBoat,seats:+newBoat.seats,avg_buoyancy:newBoat.avg_buoyancy?+newBoat.avg_buoyancy:null});
      setToast({m:"Bateau ajouté ✓",t:"success"}); load();
      setNB({name:"",type:"couple",seats:4,brand:"",model:"",avg_buoyancy:"",notes:""}); setShowAddBoat(false);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function saveEditBoat() {
    try {
      await api.updateBoat(editBoat.id,{name:editBoat.name,type:editBoat.type,seats:+editBoat.seats,brand:editBoat.brand,model:editBoat.model,avg_buoyancy:editBoat.avg_buoyancy?+editBoat.avg_buoyancy:null,notes:editBoat.notes});
      setToast({m:"Bateau modifié ✓",t:"success"}); load(); setEditBoat(null);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function addSetting() {
    if(!selBoat) return;
    try {
      await api.createBoatSetting({...newSetting,boat_id:selBoat,poste:+newSetting.poste,entraxe:newSetting.entraxe?+newSetting.entraxe:null,longueur_pedale:newSetting.longueur_pedale?+newSetting.longueur_pedale:null,levier_interieur:newSetting.levier_interieur?+newSetting.levier_interieur:null});
      setToast({m:"Réglage enregistré ✓",t:"success"}); load();
      setNS({poste:1,date_reglage:"",regle_par:"",entraxe:"",longueur_pedale:"",levier_interieur:"",numero_pelle:"",type_pelle:"",observations:""}); setShowAddSetting(false);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function toggleBoatCrew(boatId, crewId) {
    const exists=boatCrews.some(bc=>bc.boat_id===boatId&&bc.crew_id===crewId);
    if(exists) await api.removeBoatCrew(boatId,crewId); else await api.addBoatCrew({boat_id:boatId,crew_id:crewId});
    load();
  }
  function getBoatCrewsFor(boatId) { return boatCrews.filter(bc=>bc.boat_id===boatId).map(bc=>crews.find(c=>c.id===bc.crew_id)).filter(Boolean); }
  function getSettingsFor(boatId) { return boatSettings.filter(s=>s.boat_id===boatId).sort((a,b)=>b.date_reglage.localeCompare(a.date_reglage)); }
  function getLatestSettingPerPoste(boatId) {
    const settings=getSettingsFor(boatId);
    const boat=boats.find(b=>b.id===boatId);
    if(!boat) return [];
    return Array.from({length:boat.seats},(_, i)=>{
      const poste=i+1;
      return settings.find(s=>s.poste===poste)||{poste,empty:true};
    });
  }
  function getAthleteAtPoste(boatId, poste) {
    const linked=getBoatCrewsFor(boatId)[0];
    if(!linked) return null;
    const members=crewMembers.filter(m=>m.crew_id===linked.id).map(m=>athletes.find(a=>a.id===m.athlete_id)).filter(Boolean);
    return members[poste-1]||null;
  }

  const categories=["Tous",...new Set(athletes.map(a=>a.category))];
  const filteredAths=filterCat==="Tous"?athletes:athletes.filter(a=>a.category===filterCat);
  const globalAvgW=performances.length?Math.round(performances.reduce((s,p)=>s+(p.watts||0),0)/performances.length):0;
  const globalBest=performances.reduce((b,p)=>timeToSeconds(p.time)<timeToSeconds(b)?p.time:b,"9:99");

  const NAV=[{id:"dashboard",label:"Dashboard",icon:"◈"},{id:"athletes",label:"Athlètes",icon:"◉"},{id:"performances",label:"Performances",icon:"◆"},{id:"compare",label:"Comparer",icon:"⇌"},{id:"crew",label:"Équipages",icon:"⛵"},{id:"boats",label:"Bateaux",icon:"🚣"},{id:"planning",label:"Planning",icon:"▦"}];

  if(loading) return <div style={{...S.root,alignItems:"center",justifyContent:"center"}}><Loader text="Chargement depuis Supabase…"/></div>;

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={S.sidebar}>
        <div style={S.logo}><span style={{fontSize:28}}>🚣</span><div><div style={S.logoT}>AvironCoach</div><div style={S.logoS}>Espace Coach</div></div></div>
        <nav style={{flex:1,padding:"8px 12px"}}>{NAV.map(n=><button key={n.id} style={{...S.nb,...(tab===n.id?S.nba:{})}} onClick={()=>setTab(n.id)}><span style={{fontSize:16}}>{n.icon}</span>{n.label}</button>)}</nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #1e293b"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{...S.av,width:34,height:34,fontSize:14}}>{currentUser.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
            <div><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{currentUser.name}</div><div style={{fontSize:11,color:"#22d3ee"}}>🎯 Coach</div></div>
          </div>
          <button style={{...S.btnP,width:"100%",background:"transparent",color:"#64748b",border:"1px solid #1e293b",fontSize:12}} onClick={onLogout}>← Déconnexion</button>
        </div>
      </aside>
      <div style={S.main}>

        {tab==="dashboard"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Dashboard</h1><p style={S.sub}>{athletes.length} athlètes · données en direct</p></div></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:36}}>
            {[{l:"Athlètes",v:athletes.length,c:"#22d3ee",ic:"◉"},{l:"Sessions",v:performances.length,c:"#f59e0b",ic:"◆"},{l:"Puissance moy.",v:`${globalAvgW}W`,c:"#a78bfa",ic:"⚡"},{l:"Meilleur 2k",v:globalBest,c:"#4ade80",ic:"⏱"},{l:"Équipages",v:crews.length,c:"#f97316",ic:"⛵"}].map((k,i)=>(
              <div key={i} style={S.kpi}><div style={{color:k.c,fontSize:22,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:26,fontWeight:900,letterSpacing:-1}}>{k.v}</div><div style={{color:"#94a3b8",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>
            ))}
          </div>
          <div style={S.st}>🏆 Classement W/kg</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:32}}>
            {athletes.map(a=>{const{last,wpkg,perfs}=aStats(a);return last?{...a,watts:last.watts,wpkg:parseFloat(wpkg)||0,wT:perfs.map(p=>p.watts)}:null;}).filter(Boolean).sort((a,b)=>b.wpkg-a.wpkg).map((a,i)=>(
              <div key={a.id} style={S.topCard} onClick={()=>{setSelAth(a.id);setTab("performances");}}>
                <div style={{width:28,color:"#22d3ee",fontWeight:900,fontSize:18}}>#{i+1}</div>
                <div style={S.av}>{a.avatar}</div>
                <div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9"}}>{a.name}</div><div style={{color:"#64748b",fontSize:12}}>{a.category} · {a.boat}</div></div>
                <div style={{textAlign:"right",minWidth:90}}><div style={{color:"#a78bfa",fontWeight:800,fontSize:18}}>{a.wpkg.toFixed(2)} W/kg</div><div style={{color:"#64748b",fontSize:12}}>{a.watts}W</div></div>
                <div style={{marginLeft:14}}><Sparkline data={a.wT} color="#22d3ee"/></div>
              </div>
            ))}
          </div>
          <div style={S.st}>📅 Planning semaine</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
            {sessions.map(s=><div key={s.id} style={{...S.card,minHeight:110}}>
              <div style={{fontWeight:800,color:"#f1f5f9",fontSize:13,marginBottom:8}}>{s.day}</div>
              <div style={{...S.badge,background:TYPE_COLORS[s.type]+"22",color:TYPE_COLORS[s.type]||"#94a3b8",border:`1px solid ${TYPE_COLORS[s.type]||"#94a3b8"}44`,marginBottom:8}}>{s.type}</div>
              <div style={{color:"#94a3b8",fontSize:12}}>{s.duration}</div>
              <div style={{color:"#475569",fontSize:11,marginTop:4}}>{getSessionCrewsFor(s.id).length?`${getSessionCrewsFor(s.id).length} équipages`:"—"}</div>
            </div>)}
          </div>
        </div>)}

        {tab==="athletes"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Athlètes</h1><p style={S.sub}>{athletes.length} rameurs</p></div><button style={S.btnP} onClick={()=>setShowAddAth(true)}>+ Ajouter</button></div>
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>{categories.map(c=><button key={c} style={{...S.fb,...(filterCat===c?S.fbon:{})}} onClick={()=>setFilterCat(c)}>{c}</button>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16}}>
            {filteredAths.map(a=>{
              const{perfs,best,last,wpkg}=aStats(a);const wTrend=perfs.length>=2?last.watts-perfs[perfs.length-2].watts:0;const aCrew=getCrewForAthlete(a);
              return(<div key={a.id} style={{...S.card,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  <div style={S.av}>{a.avatar}</div>
                  <div style={{flex:1}} onClick={()=>{setSelAth(a.id);setTab("performances");}}><div style={{fontWeight:800,color:"#f1f5f9",fontSize:15}}>{a.name}</div><div style={{color:"#64748b",fontSize:12}}>{a.category} · {a.boat} · {a.age}ans · {a.weight}kg</div>{aCrew&&<div style={{color:"#22d3ee",fontSize:11,marginTop:2}}>⛵ {aCrew.name}</div>}</div>
                  <button style={{...S.actionBtn,color:"#22d3ee",borderColor:"#22d3ee30",flexShrink:0}} onClick={e=>{e.stopPropagation();setEditAth({...a});}}>✏️ Éditer</button>
                </div>
                {last?(<>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}} onClick={()=>{setSelAth(a.id);setTab("performances");}}>
                    <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:8,padding:"7px 10px"}}><div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2k</div><div style={{color:"#4ade80",fontWeight:900,fontSize:20}}>{best?.time??"—"}</div></div>
                    <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:8,padding:"7px 10px"}}><div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:20}}>{wpkg??"—"}</div></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}} onClick={()=>{setSelAth(a.id);setTab("performances");}}>
                    <span style={{color:"#64748b",fontSize:12}}>{perfs.length} sessions</span>
                    <span style={{color:wTrend>=0?"#4ade80":"#ef4444",fontSize:13,fontWeight:700}}>{wTrend>=0?"▲":"▼"} {Math.abs(wTrend)}W</span>
                    <Sparkline data={perfs.map(p=>p.watts)} color="#22d3ee"/>
                  </div>
                </>):<div style={{color:"#475569",fontSize:13,textAlign:"center",padding:"12px 0"}} onClick={()=>{setSelAth(a.id);setTab("performances");}}>Aucune performance</div>}
              </div>);
            })}
          </div>
          {showAddAth&&<Modal title="Nouvel athlète" onClose={()=>setShowAddAth(false)}>
            <FF label="Nom"><input style={S.inp} value={newAth.name} onChange={e=>setNA(p=>({...p,name:e.target.value}))} placeholder="Prénom Nom"/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Âge"><input style={S.inp} type="number" value={newAth.age} onChange={e=>setNA(p=>({...p,age:e.target.value}))}/></FF>
              <FF label="Poids"><input style={S.inp} type="number" value={newAth.weight} onChange={e=>setNA(p=>({...p,weight:e.target.value}))}/></FF>
            </div>
            <FF label="Catégorie"><select style={S.inp} value={newAth.category} onChange={e=>setNA(p=>({...p,category:e.target.value}))}>{["Junior H","Junior F","Espoir H","Espoir F","Senior H","Senior F"].map(c=><option key={c}>{c}</option>)}</select></FF>
            <FF label="Bateau"><select style={S.inp} value={newAth.boat} onChange={e=>setNA(p=>({...p,boat:e.target.value}))}>{["1x","2x","2-","4x","4-","4+","8+"].map(b=><option key={b}>{b}</option>)}</select></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addAth}>Créer la fiche</button>
          </Modal>}
          {editAth&&<Modal title={`Éditer — ${editAth.name}`} onClose={()=>setEditAth(null)}>
            <FF label="Nom complet"><input style={S.inp} value={editAth.name} onChange={e=>setEditAth(p=>({...p,name:e.target.value}))}/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Âge"><input style={S.inp} type="number" value={editAth.age} onChange={e=>setEditAth(p=>({...p,age:e.target.value}))}/></FF>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editAth.weight} onChange={e=>setEditAth(p=>({...p,weight:e.target.value}))}/></FF>
            </div>
            <FF label="Catégorie"><select style={S.inp} value={editAth.category} onChange={e=>setEditAth(p=>({...p,category:e.target.value}))}>{["Junior H","Junior F","Espoir H","Espoir F","Senior H","Senior F"].map(c=><option key={c}>{c}</option>)}</select></FF>
            <FF label="Bateau"><select style={S.inp} value={editAth.boat} onChange={e=>setEditAth(p=>({...p,boat:e.target.value}))}>{["1x","2x","2-","4x","4-","4+","8+"].map(b=><option key={b}>{b}</option>)}</select></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={saveEditAth}>Enregistrer les modifications</button>
          </Modal>}
        </div>)}

        {tab==="performances"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Performances</h1><p style={S.sub}>Vue globale</p></div><button style={S.btnP} onClick={()=>{setNP(p=>({...p,athleteId:selAth||""}));setShowAddPerf(true);}}>+ Ajouter</button></div>          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            <button style={{...S.fb,...(selAth===null?S.fbon:{})}} onClick={()=>setSelAth(null)}>Tous</button>
            {athletes.map(a=><button key={a.id} style={{...S.fb,...(selAth===a.id?S.fbon:{})}} onClick={()=>setSelAth(a.id)}>{a.name}</button>)}
          </div>
          {selAth&&(()=>{const a=athletes.find(x=>x.id===selAth);if(!a)return null;const perfs=getPerfFor(selAth),best=getBestTime(perfs),last=getLastPerf(perfs),wpkg=last&&a.weight?(last.watts/a.weight).toFixed(2):null;return(<div style={{...S.card,display:"flex",alignItems:"center",gap:16,marginBottom:16}}><div style={S.av}>{a.avatar}</div><div style={{flex:1}}><div style={{fontSize:18,fontWeight:800,color:"#f1f5f9"}}>{a.name}</div><div style={{color:"#64748b",fontSize:13}}>{a.category} · {a.weight}kg · {a.boat}</div></div><button style={{...S.actionBtn,color:"#22d3ee",borderColor:"#22d3ee30"}} onClick={()=>setEditAth({...a})}>✏️ Éditer la fiche</button><div style={{display:"flex",gap:10}}><div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"10px 16px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2k</div><div style={{color:"#4ade80",fontWeight:900,fontSize:22}}>{best?.time??"-"}</div></div><div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"10px 16px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:22}}>{wpkg??"-"}</div></div></div></div>);})()}
          <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#0d1628"}}>
              <thead><tr>{["Athlète","Date","2000m","Best 2k","W/kg","Watts","SPM","FC","RPE","Km",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{performances.filter(p=>selAth===null||p.athlete_id===selAth).sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{const a=athletes.find(x=>x.id===p.athlete_id);const best=getBestTime(getPerfFor(p.athlete_id));return(<tr key={p.id} style={{borderBottom:"1px solid #1e293b"}}><td style={S.td}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:28,height:28,fontSize:11}}>{a?.avatar}</div>{a?.name}</div></td><td style={{...S.td,color:"#64748b"}}>{p.date}</td><td style={{...S.td,color:"#22d3ee",fontWeight:700}}>{p.time}</td><td style={{...S.td,color:"#4ade80",fontWeight:700}}>{best?.time??"-"}</td><td style={{...S.td,color:"#a78bfa",fontWeight:700}}>{a&&a.weight?(p.watts/a.weight).toFixed(2):"—"}</td><td style={{...S.td,color:"#22d3ee"}}>{p.watts}W</td><td style={S.td}>{p.spm}</td><td style={{...S.td,color:"#ef4444"}}>{p.hr}</td><td style={S.td}><div style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff"}}>{p.rpe}/10</div></td><td style={{...S.td,color:"#f97316"}}>{p.distance}km</td><td style={S.td}><button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={async()=>{await api.deletePerf(p.id);load();setToast({m:"Performance supprimée",t:"success"});}}>🗑</button></td></tr>);})}
              </tbody>
            </table>
          </div>
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Athlète"><select style={S.inp} value={newPerf.athleteId} onChange={e=>setNP(p=>({...p,athleteId:e.target.value}))}><option value="">Sélectionner…</option>{athletes.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></FF>
            <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Temps 2000m"><input style={S.inp} placeholder="6:45" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
              <FF label="Watts"><input style={S.inp} type="number" value={newPerf.watts} onChange={e=>setNP(p=>({...p,watts:e.target.value}))}/></FF>
              <FF label="SPM"><input style={S.inp} type="number" value={newPerf.spm} onChange={e=>setNP(p=>({...p,spm:e.target.value}))}/></FF>
              <FF label="FC"><input style={S.inp} type="number" value={newPerf.hr} onChange={e=>setNP(p=>({...p,hr:e.target.value}))}/></FF>
              <FF label="RPE"><input style={S.inp} type="number" min="1" max="10" value={newPerf.rpe} onChange={e=>setNP(p=>({...p,rpe:e.target.value}))}/></FF>
              <FF label="Distance (km)"><input style={S.inp} type="number" value={newPerf.distance} onChange={e=>setNP(p=>({...p,distance:e.target.value}))}/></FF>
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addPerf}>Enregistrer</button>
          </Modal>}
        </div>)}

        {tab==="compare"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Comparer</h1><p style={S.sub}>2 à 4 athlètes</p></div></div>
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>{athletes.map(a=>{const on=compareIds.includes(a.id);return(<button key={a.id} style={{...S.fb,...(on?{background:"#22d3ee20",border:"1px solid #22d3ee60",color:"#22d3ee"}:{})}} onClick={()=>setCompareIds(prev=>prev.includes(a.id)?(prev.length>2?prev.filter(x=>x!==a.id):prev):prev.length<4?[...prev,a.id]:prev)}>{on?"✓ ":""}{a.name}</button>);})}</div>
          {compareIds.length>=2&&(()=>{
            const cmp=compareIds.map(id=>{const a=athletes.find(x=>x.id===id);const perfs=getPerfFor(id),last=getLastPerf(perfs),best=getBestTime(perfs);return{...a,last,best,wpkg:last&&a.weight?(last.watts/a.weight).toFixed(2):null,perfs};});
            const rows=[{label:"Meilleur 2k",fn:c=>c.best?.time??"—",bfn:c=>c.best?timeToSeconds(c.best.time):9999,lower:true,c:"#4ade80"},{label:"Puissance",fn:c=>c.last?`${c.last.watts}W`:"—",bfn:c=>c.last?.watts||0,lower:false,c:"#22d3ee"},{label:"W/kg",fn:c=>c.wpkg??"-",bfn:c=>parseFloat(c.wpkg)||0,lower:false,c:"#a78bfa"},{label:"SPM",fn:c=>c.last?.spm??"—",bfn:c=>c.last?.spm||0,lower:false,c:"#f59e0b"},{label:"Sessions",fn:c=>c.perfs.length,bfn:c=>c.perfs.length,lower:false,c:"#f97316"}];
            return(<>
              <div style={{display:"grid",gridTemplateColumns:`140px repeat(${cmp.length},1fr)`,gap:2,marginBottom:2}}><div/>{cmp.map((c,i)=><div key={c.id} style={{...S.card,textAlign:"center",borderTop:`3px solid ${CMP_COLORS[i]}`,padding:"12px 8px"}}><div style={{...S.av,margin:"0 auto 8px",border:`2px solid ${CMP_COLORS[i]}`}}>{c.avatar}</div><div style={{fontWeight:800,color:"#f1f5f9",fontSize:13}}>{c.name}</div><div style={{color:"#64748b",fontSize:11}}>{c.category}</div></div>)}</div>
              {rows.map(row=>{const bests=cmp.map(c=>row.bfn(c)),bestVal=row.lower?Math.min(...bests):Math.max(...bests),barMax=row.lower?Math.max(...bests):bestVal;return(<div key={row.label} style={{display:"grid",gridTemplateColumns:`140px repeat(${cmp.length},1fr)`,gap:2,marginBottom:2}}><div style={{display:"flex",alignItems:"center",color:"#64748b",fontSize:13,fontWeight:600,paddingLeft:8}}>{row.label}</div>{cmp.map((c,i)=>{const val=row.bfn(c),isBest=val===bestVal,barVal=row.lower?barMax-val+Math.min(...bests):val;return(<div key={c.id} style={{...S.card,padding:"10px 12px",background:isBest?"#22d3ee08":"#0d1628"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{color:isBest?row.c:"#94a3b8",fontWeight:isBest?900:600,fontSize:15,minWidth:80}}>{row.fn(c)}{isBest?" ★":""}</div><div style={{flex:1,height:5,background:"#1e293b",borderRadius:3,overflow:"hidden"}}><div style={{width:`${barMax?Math.min((barVal/barMax)*100,100):0}%`,height:"100%",background:CMP_COLORS[i],borderRadius:3}}/></div></div></div>);})}</div>);})}
            </>);
          })()}
        </div>)}

        {tab==="crew"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Équipages</h1><p style={S.sub}>Composer et assigner</p></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div>
              <div style={S.st}>➕ Créer un équipage</div>
              <div style={S.card}>
                <FF label="Nom"><input style={S.inp} value={crewName} onChange={e=>setCrewName(e.target.value)}/></FF>
                <FF label="Bateau"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.keys(CREW_SLOTS).map(b=><button key={b} style={{...S.fb,...(crewBoat===b?S.fbon:{})}} onClick={()=>{setCrewBoat(b);setNewCrewMembers([]);}}>{b}</button>)}</div></FF>
                <div style={{color:"#64748b",fontSize:12,marginBottom:10}}>Rameurs ({newCrewMembers.length}/{CREW_SLOTS[crewBoat]||4})</div>
                <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto"}}>
                  {athletes.map(a=>{const sel=newCrewMembers.includes(a.id),full=newCrewMembers.length>=(CREW_SLOTS[crewBoat]||4)&&!sel,{last}=aStats(a);return(<div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:`1px solid ${sel?"#22d3ee44":"#1e293b"}`,background:sel?"#22d3ee08":"transparent",cursor:full?"not-allowed":"pointer",opacity:full?0.4:1}} onClick={()=>!full&&setNewCrewMembers(prev=>prev.includes(a.id)?prev.filter(x=>x!==a.id):[...prev,a.id])}><div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sel?"#22d3ee":"#334155"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<div style={{width:7,height:7,borderRadius:"50%",background:"#22d3ee"}}/>}</div><div style={{...S.av,width:28,height:28,fontSize:11,flexShrink:0}}>{a.avatar}</div><div style={{flex:1,fontSize:13,color:"#f1f5f9",fontWeight:600}}>{a.name}</div>{last&&<div style={{color:"#22d3ee",fontSize:12}}>{last.watts}W</div>}</div>);})}
                </div>
                <button style={{...S.btnP,width:"100%",marginTop:12,opacity:!newCrewMembers.length?0.5:1}} onClick={saveNewCrew} disabled={!newCrewMembers.length}>Créer →</button>
              </div>
            </div>
            <div>
              <div style={S.st}>⛵ Équipages actifs ({crews.length})</div>
              {crews.map(cr=><div key={cr.id} style={{...S.card,marginBottom:12,borderTop:"3px solid #22d3ee"}}>
                <div style={{fontWeight:800,color:"#f1f5f9",fontSize:16,marginBottom:2}}>{cr.name}</div>
                <div style={{color:"#64748b",fontSize:12,marginBottom:12}}>{cr.boat} · {getCrewMembersFor(cr.id).length} rameurs</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{getCrewMembersFor(cr.id).map(a=>{const{last,wpkg}=aStats(a);return(<div key={a.id} style={{background:"#1e293b",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:26,height:26,fontSize:10}}>{a.avatar}</div><div><div style={{color:"#f1f5f9",fontSize:12,fontWeight:600}}>{a.name.split(" ")[0]}</div>{last&&<div style={{color:"#22d3ee",fontSize:10}}>{last.watts}W · {wpkg}W/kg</div>}</div></div>);})}</div>
              </div>)}
            </div>
          </div>
        </div>)}

        </div>)}

        {tab==="boats"&&(<div style={S.page}>
          <div style={S.ph}>
            <div><h1 style={S.ttl}>Bateaux</h1><p style={S.sub}>{boats.length} bateaux · réglages par poste</p></div>
            <button style={S.btnP} onClick={()=>setShowAddBoat(true)}>+ Nouveau bateau</button>
          </div>

          {/* Liste bateaux */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:28}}>
            {boats.map(b=>{
              const linked=getBoatCrewsFor(b.id);
              const lastSetting=getSettingsFor(b.id)[0];
              return(
                <div key={b.id} style={{...S.card,cursor:"pointer",borderTop:`3px solid ${selBoat===b.id?"#22d3ee":"#1e293b"}`,background:selBoat===b.id?"#22d3ee08":"#0d1628"}} onClick={()=>setSelBoat(selBoat===b.id?null:b.id)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontWeight:900,color:"#f1f5f9",fontSize:17}}>{b.name}</div>
                      <div style={{color:"#64748b",fontSize:12,marginTop:2}}>{b.brand} {b.model} · {b.seats} postes</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{...S.badge,background:b.type==="couple"?"#22d3ee20":"#a78bfa20",color:b.type==="couple"?"#22d3ee":"#a78bfa",border:`1px solid ${b.type==="couple"?"#22d3ee40":"#a78bfa40"}`}}>{b.type==="couple"?"⚓ Couple":"🏹 Pointe"}</span>
                      <button style={{...S.actionBtn,color:"#22d3ee",borderColor:"#22d3ee30"}} onClick={e=>{e.stopPropagation();setEditBoat({...b});}}>✏️</button>
                    </div>
                  </div>
                  {b.avg_buoyancy&&<div style={{color:"#f59e0b",fontSize:13,marginBottom:8}}>⚖️ Portance moy. : {b.avg_buoyancy} kg</div>}
                  {linked.length>0&&<div style={{marginBottom:8}}>{linked.map(cr=><div key={cr.id} style={{color:"#22d3ee",fontSize:12}}>⛵ {cr.name}</div>)}</div>}
                  {lastSetting&&<div style={{color:"#475569",fontSize:11}}>Dernier réglage : {lastSetting.date_reglage} · {lastSetting.regle_par}</div>}
                  {b.notes&&<div style={{background:"#1e293b50",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#94a3b8",marginTop:8}}>{b.notes}</div>}
                </div>
              );
            })}
            {!boats.length&&<div style={{...S.card,textAlign:"center",color:"#475569",padding:"32px",gridColumn:"1/-1"}}>Aucun bateau enregistré</div>}
          </div>

          {/* Détail bateau sélectionné */}
          {selBoat&&(()=>{
            const boat=boats.find(b=>b.id===selBoat); if(!boat) return null;
            const postes=getLatestSettingPerPoste(selBoat);
            const allSettings=getSettingsFor(selBoat);
            const linkedCrews=getBoatCrewsFor(selBoat);
            return(
              <div>
                {/* Assignation équipages */}
                <div style={S.st}>⛵ Équipages assignés à {boat.name}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
                  {crews.map(cr=>{
                    const linked=boatCrews.some(bc=>bc.boat_id===selBoat&&bc.crew_id===cr.id);
                    return(
                      <button key={cr.id} style={{...S.fb,...(linked?{background:"#22d3ee20",border:"1px solid #22d3ee60",color:"#22d3ee"}:{})}} onClick={()=>toggleBoatCrew(selBoat,cr.id)}>
                        {linked?"✓ ":""}{cr.name} ({cr.boat})
                      </button>
                    );
                  })}
                </div>

                {/* Réglages par poste — vue actuelle */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={S.st}>🔧 Réglages actuels — {boat.name}</div>
                  <button style={S.btnP} onClick={()=>setShowAddSetting(true)}>+ Nouveau réglage</button>
                </div>
                <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b",marginBottom:28}}>
                  <table style={{width:"100%",borderCollapse:"collapse",background:"#0d1628"}}>
                    <thead>
                      <tr>{["Poste","Rameur","Date","Réglé par","Entraxe","Long. pédale","Levier int.","N° pelle","Type pelle","Observations"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {postes.map(s=>{
                        const ath=getAthleteAtPoste(selBoat,s.poste);
                        return(
                          <tr key={s.poste} style={{borderBottom:"1px solid #1e293b",background:s.empty?"#070d1a08":"#0d1628"}}>
                            <td style={{...S.td,fontWeight:900,color:"#22d3ee",fontSize:18}}>#{s.poste}</td>
                            <td style={S.td}>
                              {ath?<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:28,height:28,fontSize:11}}>{ath.avatar}</div>{ath.name}</div>:<span style={{color:"#475569"}}>—</span>}
                            </td>
                            {s.empty?(
                              <td colSpan={8} style={{...S.td,color:"#334155",textAlign:"center",fontStyle:"italic"}}>Aucun réglage enregistré pour ce poste</td>
                            ):(
                              <>
                                <td style={{...S.td,color:"#64748b"}}>{s.date_reglage}</td>
                                <td style={S.td}>{s.regle_par||"—"}</td>
                                <td style={{...S.td,color:"#22d3ee",fontWeight:700}}>{s.entraxe?`${s.entraxe} cm`:"—"}</td>
                                <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"—"}</td>
                                <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"—"}</td>
                                <td style={S.td}>{s.numero_pelle||"—"}</td>
                                <td style={S.td}>{s.type_pelle||"—"}</td>
                                <td style={{...S.td,color:"#94a3b8",maxWidth:200}}>{s.observations||"—"}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Historique complet */}
                {allSettings.length>0&&(<>
                  <div style={S.st}>📋 Historique complet des réglages</div>
                  <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",background:"#0d1628"}}>
                      <thead><tr>{["Poste","Date","Réglé par","Entraxe","Long. pédale","Levier int.","N° pelle","Type pelle","Observations",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {allSettings.map(s=>(
                          <tr key={s.id} style={{borderBottom:"1px solid #1e293b"}}>
                            <td style={{...S.td,fontWeight:900,color:"#22d3ee"}}>#{s.poste}</td>
                            <td style={{...S.td,color:"#64748b"}}>{s.date_reglage}</td>
                            <td style={S.td}>{s.regle_par||"—"}</td>
                            <td style={{...S.td,color:"#22d3ee"}}>{s.entraxe?`${s.entraxe} cm`:"—"}</td>
                            <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"—"}</td>
                            <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"—"}</td>
                            <td style={S.td}>{s.numero_pelle||"—"}</td>
                            <td style={S.td}>{s.type_pelle||"—"}</td>
                            <td style={{...S.td,color:"#94a3b8"}}>{s.observations||"—"}</td>
                            <td style={S.td}><button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={async()=>{await api.deleteBoatSetting(s.id);load();setToast({m:"Réglage supprimé",t:"success"});}}>🗑</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>)}
              </div>
            );
          })()}

          {/* Modal nouveau bateau */}
          {showAddBoat&&<Modal title="Nouveau bateau" onClose={()=>setShowAddBoat(false)} wide>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Nom du bateau"><input style={S.inp} value={newBoat.name} onChange={e=>setNB(p=>({...p,name:e.target.value}))} placeholder="ex: Dragon Rouge"/></FF>
              <FF label="Nombre de postes"><input style={S.inp} type="number" min="1" max="8" value={newBoat.seats} onChange={e=>setNB(p=>({...p,seats:e.target.value}))}/></FF>
              <FF label="Type"><select style={S.inp} value={newBoat.type} onChange={e=>setNB(p=>({...p,type:e.target.value}))}><option value="couple">⚓ Couple</option><option value="pointe">🏹 Pointe</option></select></FF>
              <FF label="Portance moyenne (kg)"><input style={S.inp} type="number" value={newBoat.avg_buoyancy} onChange={e=>setNB(p=>({...p,avg_buoyancy:e.target.value}))} placeholder="ex: 82"/></FF>
              <FF label="Marque"><input style={S.inp} value={newBoat.brand} onChange={e=>setNB(p=>({...p,brand:e.target.value}))} placeholder="ex: Filippi"/></FF>
              <FF label="Modèle"><input style={S.inp} value={newBoat.model} onChange={e=>setNB(p=>({...p,model:e.target.value}))} placeholder="ex: F50"/></FF>
            </div>
            <FF label="Notes générales"><textarea style={{...S.inp,height:72,resize:"vertical"}} value={newBoat.notes} onChange={e=>setNB(p=>({...p,notes:e.target.value}))}/></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addBoat}>Créer le bateau</button>
          </Modal>}

          {/* Modal édition bateau */}
          {editBoat&&<Modal title={`Éditer — ${editBoat.name}`} onClose={()=>setEditBoat(null)} wide>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Nom"><input style={S.inp} value={editBoat.name} onChange={e=>setEditBoat(p=>({...p,name:e.target.value}))}/></FF>
              <FF label="Postes"><input style={S.inp} type="number" min="1" max="8" value={editBoat.seats} onChange={e=>setEditBoat(p=>({...p,seats:e.target.value}))}/></FF>
              <FF label="Type"><select style={S.inp} value={editBoat.type} onChange={e=>setEditBoat(p=>({...p,type:e.target.value}))}><option value="couple">⚓ Couple</option><option value="pointe">🏹 Pointe</option></select></FF>
              <FF label="Portance (kg)"><input style={S.inp} type="number" value={editBoat.avg_buoyancy||""} onChange={e=>setEditBoat(p=>({...p,avg_buoyancy:e.target.value}))}/></FF>
              <FF label="Marque"><input style={S.inp} value={editBoat.brand||""} onChange={e=>setEditBoat(p=>({...p,brand:e.target.value}))}/></FF>
              <FF label="Modèle"><input style={S.inp} value={editBoat.model||""} onChange={e=>setEditBoat(p=>({...p,model:e.target.value}))}/></FF>
            </div>
            <FF label="Notes"><textarea style={{...S.inp,height:72,resize:"vertical"}} value={editBoat.notes||""} onChange={e=>setEditBoat(p=>({...p,notes:e.target.value}))}/></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={saveEditBoat}>Enregistrer</button>
          </Modal>}

          {/* Modal nouveau réglage */}
          {showAddSetting&&selBoat&&(()=>{
            const boat=boats.find(b=>b.id===selBoat);
            return(
              <Modal title={`Nouveau réglage — ${boat?.name}`} onClose={()=>setShowAddSetting(false)} wide>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <FF label="Poste">
                    <select style={S.inp} value={newSetting.poste} onChange={e=>setNS(p=>({...p,poste:+e.target.value}))}>
                      {Array.from({length:boat?.seats||4},(_,i)=><option key={i+1} value={i+1}>Poste #{i+1}{getAthleteAtPoste(selBoat,i+1)?` — ${getAthleteAtPoste(selBoat,i+1).name}`:""}</option>)}
                    </select>
                  </FF>
                  <FF label="Date"><input style={S.inp} type="date" value={newSetting.date_reglage} onChange={e=>setNS(p=>({...p,date_reglage:e.target.value}))}/></FF>
                  <FF label="Réglé par"><input style={S.inp} value={newSetting.regle_par} onChange={e=>setNS(p=>({...p,regle_par:e.target.value}))} placeholder="Nom du coach"/></FF>
                  <FF label="Entraxe (cm)"><input style={S.inp} type="number" value={newSetting.entraxe} onChange={e=>setNS(p=>({...p,entraxe:e.target.value}))}/></FF>
                  <FF label="Longueur pédale (cm)"><input style={S.inp} type="number" value={newSetting.longueur_pedale} onChange={e=>setNS(p=>({...p,longueur_pedale:e.target.value}))}/></FF>
                  <FF label="Levier intérieur (cm)"><input style={S.inp} type="number" value={newSetting.levier_interieur} onChange={e=>setNS(p=>({...p,levier_interieur:e.target.value}))}/></FF>
                  <FF label="N° pelle"><input style={S.inp} value={newSetting.numero_pelle} onChange={e=>setNS(p=>({...p,numero_pelle:e.target.value}))}/></FF>
                  <FF label="Type de pelle"><input style={S.inp} value={newSetting.type_pelle} onChange={e=>setNS(p=>({...p,type_pelle:e.target.value}))} placeholder="ex: Smoothie2, Apex..."/></FF>
                </div>
                <FF label="Observations"><textarea style={{...S.inp,height:72,resize:"vertical"}} value={newSetting.observations} onChange={e=>setNS(p=>({...p,observations:e.target.value}))}/></FF>
                <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addSetting}>Enregistrer le réglage</button>
              </Modal>
            );
          })()}
        </div>)}

        {tab==="planning"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Planning</h1><p style={S.sub}>Semaine en cours</p></div></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}}>
            {sessions.map(s=><div key={s.id} style={{...S.card,borderTop:`3px solid ${TYPE_COLORS[s.type]||"#374151"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{fontWeight:800,fontSize:16,color:"#f1f5f9"}}>{s.day}</div><div style={{color:"#64748b",fontSize:12}}>{s.date}</div></div><div style={{...S.badge,background:(ZONE_COLORS[s.zone]||"#374151")+"22",color:ZONE_COLORS[s.zone]||"#374151",border:`1px solid ${ZONE_COLORS[s.zone]||"#374151"}44`}}>{s.zone}</div></div>
              <div style={{...S.badge,marginBottom:8,background:(TYPE_COLORS[s.type]||"#374151")+"22",color:TYPE_COLORS[s.type]||"#94a3b8",border:`1px solid ${(TYPE_COLORS[s.type]||"#374151")}44`}}>{s.type}</div>
              {s.duration&&s.duration!=="--"&&<div style={{color:"#94a3b8",fontSize:13,marginBottom:8}}>{s.duration}</div>}
              {s.notes&&<div style={{background:"#1e293b50",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#94a3b8",lineHeight:1.5}}>{s.notes}</div>}
              {getSessionCrewsFor(s.id).map(cr=><div key={cr.id} style={{color:"#22d3ee",fontSize:12,marginTop:6}}>{cr.name}</div>)}
            </div>)}
          </div>
        </div>)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ATHLETE SPACE
// ═════════════════════════════════════════════════════════════════════════════
function AthleteSpace({ currentUser, onLogout }) {
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
    const [aths,perfs,cr,cm,sess,sc,bt,bc,bs]=await Promise.all([api.getAthletes(),api.getPerformances(),api.getCrews(),api.getCrewMembers(),api.getSessions(),api.getSessionCrews(),api.getBoats(),api.getBoatCrews(),api.getBoatSettings()]);
    const me=aths.find(a=>a.id===currentUser.athlete_id);
    setAthlete(me); setAllAthletes(aths);
    setMyPerfs(perfs.filter(p=>p.athlete_id===currentUser.athlete_id).sort((a,b)=>a.date.localeCompare(b.date)));
    setCrews(cr); setCrewMembers(cm); setSessions(sess); setSessionCrews(sc);
    setBoats(bt); setBoatCrews(bc); setBoatSettings(bs);
    if(me) setEditForm({weight:me.weight,boat:me.boat,age:me.age});
    setLoading(false);
  },[currentUser.athlete_id]);
  useEffect(()=>{ load(); },[]);

  const myCrew = athlete ? crews.find(c=>crewMembers.some(m=>m.crew_id===c.id&&m.athlete_id===athlete.id)) : null;
  const crewMates = myCrew ? allAthletes.filter(a=>crewMembers.some(m=>m.crew_id===myCrew.id&&m.athlete_id===a.id)&&a.id!==athlete?.id) : [];
  const mySessions = sessions.filter(s=>myCrew&&sessionCrews.some(sc=>sc.session_id===s.id&&sc.crew_id===myCrew.id));
  const best=getBestTime(myPerfs), last=getLastPerf(myPerfs);
  const wpkg=last&&athlete?.weight?(last.watts/athlete.weight).toFixed(2):null;

  async function saveEdit() {
    await api.updateAthlete(athlete.id,{weight:+editForm.weight,boat:editForm.boat,age:+editForm.age});
    setToast({m:"Fiche mise à jour ✓",t:"success"}); load(); setEditing(false);
  }
  async function addPerf() {
    await api.createPerf({athlete_id:currentUser.athlete_id,date:newPerf.date,time:newPerf.time,watts:+newPerf.watts,spm:+newPerf.spm,hr:+newPerf.hr,rpe:+newPerf.rpe,distance:+newPerf.distance});
    setToast({m:"Performance enregistrée ✓",t:"success"}); load();
    setNP({date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""}); setShowAddPerf(false);
  }

  const NAV=[{id:"dashboard",label:"Mon espace",icon:"◈"},{id:"stats",label:"Mes stats",icon:"◆"},{id:"crew",label:"Mon équipage",icon:"⛵"},{id:"boats",label:"Mon bateau",icon:"🚣"},{id:"planning",label:"Mon planning",icon:"▦"}];
  if(loading) return <div style={{...S.root,alignItems:"center",justifyContent:"center"}}><Loader/></div>;
  if(!athlete) return <div style={{minHeight:"100vh",background:"#070d1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontFamily:"monospace"}}>Fiche athlète introuvable. Contacte ton coach.</div>;

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={{...S.sidebar,borderColor:"#2d1b4e"}}>
        <div style={{...S.logo,borderColor:"#2d1b4e"}}><span style={{fontSize:28}}>🚣</span><div><div style={{...S.logoT,color:"#a78bfa"}}>AvironCoach</div><div style={S.logoS}>Espace Athlète</div></div></div>
        <nav style={{flex:1,padding:"8px 12px"}}>{NAV.map(n=><button key={n.id} style={{...S.nb,...(tab===n.id?{...S.nba,color:"#a78bfa",background:"#a78bfa15",borderLeftColor:"#a78bfa"}:{})}} onClick={()=>setTab(n.id)}><span style={{fontSize:16}}>{n.icon}</span>{n.label}</button>)}</nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #2d1b4e"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{...S.av,background:"#a78bfa22",border:"1px solid #a78bfa44",color:"#a78bfa"}}>{athlete.avatar}</div>
            <div><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{athlete.name}</div><div style={{fontSize:11,color:"#64748b"}}>{athlete.category}</div></div>
          </div>
          <button style={{...S.btnP,width:"100%",background:"transparent",color:"#64748b",border:"1px solid #1e293b",fontSize:12}} onClick={onLogout}>← Déconnexion</button>
        </div>
      </aside>
      <div style={S.main}>
        {tab==="dashboard"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Bonjour, {athlete.name.split(" ")[0]} 👋</h1><p style={S.sub}>Ton espace personnel</p></div><button style={{...S.btnP,background:"#a78bfa",color:"#070d1a"}} onClick={()=>setEditing(true)}>✏️ Éditer ma fiche</button></div>
          <div style={{...S.card,marginBottom:24,borderColor:"#2d1b4e"}}>
            <div style={{display:"flex",alignItems:"center",gap:20}}>
              <div style={{...S.av,width:64,height:64,fontSize:22,background:"#a78bfa22",border:"2px solid #a78bfa44",color:"#a78bfa"}}>{athlete.avatar}</div>
              <div style={{flex:1}}><div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{athlete.name}</div><div style={{color:"#64748b",fontSize:14,marginTop:2}}>{athlete.category} · {athlete.boat} · {athlete.age}ans · {athlete.weight}kg</div></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"12px 18px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2000m</div><div style={{color:"#4ade80",fontWeight:900,fontSize:26}}>{best?.time??"—"}</div><div style={{color:"#475569",fontSize:11}}>{best?.date??""}</div></div>
                <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"12px 18px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:26}}>{wpkg??"—"}</div><div style={{color:"#475569",fontSize:11}}>{last?.watts}W · {athlete.weight}kg</div></div>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
            {[{l:"Sessions",v:myPerfs.length,c:"#22d3ee",ic:"◆"},{l:"Dernière puiss.",v:last?`${last.watts}W`:"—",c:"#a78bfa",ic:"⚡"},{l:"Km cumulés",v:`${myPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"🏁"},{l:"Équipage",v:myCrew?.name??"—",c:"#4ade80",ic:"⛵"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:18,fontWeight:900}}>{k.v}</div><div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
          </div>
          <div style={S.st}>Dernières performances</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {[...myPerfs].reverse().slice(0,4).map(p=><div key={p.id} style={{...S.card,display:"flex",alignItems:"center",gap:16,padding:"12px 18px"}}><div style={{color:"#64748b",fontSize:12,minWidth:90}}>{p.date}</div><div style={{color:"#4ade80",fontWeight:700,fontSize:16,minWidth:55}}>{p.time}</div><div style={{color:"#22d3ee",fontWeight:700}}>{p.watts}W</div><div style={{color:"#f59e0b"}}>{p.spm} spm</div><div style={{color:"#ef4444"}}>{p.hr} bpm</div><div style={{marginLeft:"auto",color:"#f97316",fontSize:12}}>{p.distance}km</div><div style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff"}}>{p.rpe}/10</div></div>)}
            {!myPerfs.length&&<div style={{...S.card,textAlign:"center",color:"#475569",padding:"28px"}}>Aucune performance</div>}
          </div>
          <button style={{...S.btnP,background:"#a78bfa",color:"#070d1a"}} onClick={()=>setShowAddPerf(true)}>+ Ajouter une performance</button>
          {editing&&<Modal title="Éditer ma fiche" onClose={()=>setEditing(false)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Âge"><input style={S.inp} type="number" value={editForm.age} onChange={e=>setEditForm(p=>({...p,age:e.target.value}))}/></FF>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editForm.weight} onChange={e=>setEditForm(p=>({...p,weight:e.target.value}))}/></FF>
            </div>
            <FF label="Bateau"><select style={S.inp} value={editForm.boat} onChange={e=>setEditForm(p=>({...p,boat:e.target.value}))}>{["1x","2x","2-","4x","4-","4+","8+"].map(b=><option key={b}>{b}</option>)}</select></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#070d1a"}} onClick={saveEdit}>Enregistrer</button>
          </Modal>}
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Temps 2000m"><input style={S.inp} placeholder="6:45" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
              <FF label="Watts"><input style={S.inp} type="number" value={newPerf.watts} onChange={e=>setNP(p=>({...p,watts:e.target.value}))}/></FF>
              <FF label="SPM"><input style={S.inp} type="number" value={newPerf.spm} onChange={e=>setNP(p=>({...p,spm:e.target.value}))}/></FF>
              <FF label="FC (bpm)"><input style={S.inp} type="number" value={newPerf.hr} onChange={e=>setNP(p=>({...p,hr:e.target.value}))}/></FF>
              <FF label="RPE (1–10)"><input style={S.inp} type="number" min="1" max="10" value={newPerf.rpe} onChange={e=>setNP(p=>({...p,rpe:e.target.value}))}/></FF>
              <FF label="Distance (km)"><input style={S.inp} type="number" value={newPerf.distance} onChange={e=>setNP(p=>({...p,distance:e.target.value}))}/></FF>
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#070d1a"}} onClick={addPerf}>Enregistrer</button>
          </Modal>}
        </div>)}
        {tab==="stats"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mes Stats</h1><p style={S.sub}>Progression</p></div></div>
          {myPerfs.length<2?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#475569"}}>Ajoute au moins 2 sessions pour voir ta progression.</div>:(<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
              {[{l:"Best 2k",v:best?.time??"—",c:"#4ade80",ic:"⏱"},{l:"Record watts",v:`${Math.max(...myPerfs.map(p=>p.watts))}W`,c:"#22d3ee",ic:"⚡"},{l:"W/kg actuel",v:wpkg??"—",c:"#a78bfa",ic:"📊"},{l:"SPM moyen",v:Math.round(avg(myPerfs.map(p=>p.spm))),c:"#f59e0b",ic:"🔄"},{l:"FC moyenne",v:`${Math.round(avg(myPerfs.map(p=>p.hr)))}bpm`,c:"#ef4444",ic:"❤️"},{l:"Km totaux",v:`${myPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"🏁"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:22,fontWeight:900}}>{k.v}</div><div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[{l:"Puissance",vals:myPerfs.map(p=>p.watts),c:"#22d3ee",hi:true},{l:"Temps 2k (s)",vals:myPerfs.map(p=>timeToSeconds(p.time)),c:"#4ade80",hi:false,disp:v=>secondsToTime(v)},{l:"W/kg",vals:myPerfs.map(p=>+(p.watts/(athlete.weight||1)).toFixed(2)),c:"#a78bfa",hi:true},{l:"SPM",vals:myPerfs.map(p=>p.spm),c:"#f59e0b",hi:true},{l:"FC",vals:myPerfs.map(p=>p.hr),c:"#ef4444",hi:false},{l:"Distance",vals:myPerfs.map(p=>p.distance||0),c:"#f97316",hi:true}].map(m=>{const lv=m.vals[m.vals.length-1],pv=m.vals[m.vals.length-2],diff=lv-pv,up=m.hi?diff>0:diff<0;return(<div key={m.l} style={S.mc}><div style={{color:"#64748b",fontSize:12,marginBottom:6}}>{m.l}</div><div style={{color:m.c,fontSize:22,fontWeight:900}}>{m.disp?m.disp(lv):lv}</div><div style={{color:up?"#4ade80":"#ef4444",fontSize:12,marginBottom:8}}>{up?"▲":"▼"} {Math.abs(diff)}</div><Sparkline data={m.vals} color={m.c} invert={!m.hi}/></div>);})}
            </div>
          </>)}
        </div>)}
        {tab==="crew"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mon Équipage</h1><p style={S.sub}>Assigné par le coach</p></div></div>
          {!myCrew?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#475569"}}>Aucun équipage assigné pour le moment.</div>:(<>
            <div style={{...S.card,marginBottom:20}}><div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:4}}>{myCrew.name}</div><div style={{color:"#64748b",fontSize:14,marginBottom:12}}>{myCrew.boat}</div>{myCrew.notes&&<div style={{background:"#1e293b50",borderRadius:8,padding:"10px",color:"#94a3b8",fontSize:13}}>💬 {myCrew.notes}</div>}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {allAthletes.filter(a=>crewMembers.some(m=>m.crew_id===myCrew.id&&m.athlete_id===a.id)).map(a=>{
                const perfs=myPerfs.filter(p=>p.athlete_id===a.id),lp=getLastPerf(a.id===athlete.id?myPerfs:[]),isMe=a.id===athlete.id;
                return(<div key={a.id} style={{...S.card,display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderColor:isMe?"#a78bfa44":"#1e293b",background:isMe?"#a78bfa08":"#0d1628"}}>
                  <div style={{...S.av,background:isMe?"#a78bfa22":"#22d3ee15",border:`1px solid ${isMe?"#a78bfa44":"#22d3ee30"}`,color:isMe?"#a78bfa":"#22d3ee"}}>{a.avatar}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9"}}>{a.name} {isMe&&<span style={{color:"#a78bfa",fontSize:12}}>(toi)</span>}</div><div style={{color:"#64748b",fontSize:12}}>{a.category} · {a.weight}kg</div></div>
                  {isMe&&last&&<div style={{display:"flex",gap:10}}><StatPill label="2000m" value={last.time} color="#4ade80"/><StatPill label="Watts" value={`${last.watts}W`} color="#22d3ee"/><StatPill label="W/kg" value={wpkg} color="#a78bfa"/></div>}
                </div>);
              })}
            </div>
          </>)}
        </div>)}
        {tab==="boats"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mon Bateau</h1><p style={S.sub}>Réglages de ton poste</p></div></div>
          {(()=>{
            if(!myCrew) return <div style={{...S.card,textAlign:"center",padding:"40px",color:"#475569"}}>Aucun équipage assigné.</div>;
            // Trouver le bateau lié à l'équipage de l'athlète
            const myBoatCrew = boatCrews.find(bc=>bc.crew_id===myCrew.id);
            const myBoat = myBoatCrew ? boats.find(b=>b.id===myBoatCrew.boat_id) : null;
            if(!myBoat) return <div style={{...S.card,textAlign:"center",padding:"40px",color:"#475569"}}>Aucun bateau assigné à ton équipage pour l'instant.</div>;
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
                  <div style={{fontSize:48}}>🚣</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{myBoat.name}</div>
                    <div style={{color:"#64748b",fontSize:14,marginTop:2}}>{myBoat.brand} {myBoat.model} · {myBoat.type==="couple"?"Couple":"Pointe"} · {myBoat.seats} postes</div>
                    {myBoat.avg_buoyancy&&<div style={{color:"#f59e0b",fontSize:13,marginTop:4}}>⚖️ Portance moyenne : {myBoat.avg_buoyancy} kg</div>}
                    {myBoat.notes&&<div style={{color:"#94a3b8",fontSize:13,marginTop:6}}>{myBoat.notes}</div>}
                  </div>
                  <div style={{background:"#a78bfa20",border:"2px solid #a78bfa44",borderRadius:12,padding:"16px 24px",textAlign:"center"}}>
                    <div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Ton poste</div>
                    <div style={{color:"#a78bfa",fontWeight:900,fontSize:36}}>#{myPoste}</div>
                  </div>
                </div>
              </div>

              {/* Réglages actuels mon poste */}
              <div style={S.st}>🔧 Mes réglages actuels</div>
              {lastSetting?(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:28}}>
                  {[
                    {l:"Date réglage",v:lastSetting.date_reglage,c:"#64748b"},
                    {l:"Réglé par",v:lastSetting.regle_par||"—",c:"#94a3b8"},
                    {l:"Entraxe",v:lastSetting.entraxe?`${lastSetting.entraxe} cm`:"—",c:"#22d3ee"},
                    {l:"Long. pédale",v:lastSetting.longueur_pedale?`${lastSetting.longueur_pedale} cm`:"—",c:"#a78bfa"},
                    {l:"Levier int.",v:lastSetting.levier_interieur?`${lastSetting.levier_interieur} cm`:"—",c:"#f59e0b"},
                    {l:"N° pelle",v:lastSetting.numero_pelle||"—",c:"#f97316"},
                    {l:"Type de pelle",v:lastSetting.type_pelle||"—",c:"#4ade80"},
                  ].map((k,i)=>(
                    <div key={i} style={S.kpi}>
                      <div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{k.l}</div>
                      <div style={{color:k.c,fontWeight:700,fontSize:16}}>{k.v}</div>
                    </div>
                  ))}
                  {lastSetting.observations&&<div style={{...S.card,gridColumn:"1/-1",background:"#1e293b50"}}><div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Observations</div><div style={{color:"#94a3b8",fontSize:14}}>{lastSetting.observations}</div></div>}
                </div>
              ):<div style={{...S.card,textAlign:"center",padding:"32px",color:"#475569",marginBottom:28}}>Aucun réglage enregistré pour ton poste pour l'instant.</div>}

              {/* Historique */}
              {mySettings.length>1&&(<>
                <div style={S.st}>📋 Historique de mes réglages</div>
                <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",background:"#0d1628"}}>
                    <thead><tr>{["Date","Réglé par","Entraxe","Long. pédale","Levier int.","N° pelle","Type pelle","Observations"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {mySettings.map(s=>(
                        <tr key={s.id} style={{borderBottom:"1px solid #1e293b"}}>
                          <td style={{...S.td,color:"#64748b"}}>{s.date_reglage}</td>
                          <td style={S.td}>{s.regle_par||"—"}</td>
                          <td style={{...S.td,color:"#22d3ee"}}>{s.entraxe?`${s.entraxe} cm`:"—"}</td>
                          <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"—"}</td>
                          <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"—"}</td>
                          <td style={S.td}>{s.numero_pelle||"—"}</td>
                          <td style={S.td}>{s.type_pelle||"—"}</td>
                          <td style={{...S.td,color:"#94a3b8"}}>{s.observations||"—"}</td>
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
          <div style={S.ph}><div><h1 style={S.ttl}>Mon Planning</h1><p style={S.sub}>Séances assignées par le coach</p></div></div>
          {!myCrew?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#475569"}}>Aucun équipage assigné.</div>:(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
              {sessions.map(s=>{const assigned=sessionCrews.some(sc=>sc.session_id===s.id&&sc.crew_id===myCrew.id);return(<div key={s.id} style={{...S.card,borderTop:`3px solid ${assigned?TYPE_COLORS[s.type]||"#374151":"#1e293b"}`,opacity:assigned?1:0.3}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{fontWeight:800,fontSize:16,color:"#f1f5f9"}}>{s.day}</div><div style={{color:"#64748b",fontSize:12}}>{s.date}</div></div><div style={{...S.badge,background:(ZONE_COLORS[s.zone]||"#374151")+"22",color:ZONE_COLORS[s.zone]||"#374151",border:`1px solid ${ZONE_COLORS[s.zone]||"#374151"}44`}}>{s.zone}</div></div>
                <div style={{...S.badge,marginBottom:8,background:(TYPE_COLORS[s.type]||"#374151")+"22",color:TYPE_COLORS[s.type]||"#94a3b8",border:`1px solid ${TYPE_COLORS[s.type]||"#374151"}44`}}>{s.type}</div>
                {assigned&&<>{s.duration&&s.duration!=="—"&&<div style={{color:"#94a3b8",fontSize:13,marginBottom:8}}>⏱ {s.duration}</div>}{s.notes&&<div style={{background:"#1e293b50",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#94a3b8",lineHeight:1.5}}>{s.notes}</div>}</>}
              </div>);})}
            </div>
          )}
        </div>)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  if(!session) return <LoginScreen onLogin={setSession}/>;
  if(session.role==="admin")   return <AdminPanel   currentUser={session} onLogout={()=>setSession(null)}/>;
  if(session.role==="coach")   return <CoachSpace   currentUser={session} onLogout={()=>setSession(null)}/>;
  return <AthleteSpace currentUser={session} onLogout={()=>setSession(null)}/>;
}

const S={
  root:      {display:"flex",minHeight:"100vh",background:"#070d1a",fontFamily:"'DM Mono','Fira Code',monospace",color:"#cbd5e1"},
  sidebar:   {width:220,background:"#0d1628",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",padding:"24px 0",position:"sticky",top:0,height:"100vh"},
  logo:      {display:"flex",alignItems:"center",gap:12,padding:"0 20px 28px",borderBottom:"1px solid #1e293b",marginBottom:16},
  logoT:     {fontSize:15,fontWeight:800,color:"#22d3ee",letterSpacing:1},
  logoS:     {fontSize:10,color:"#475569",letterSpacing:2,textTransform:"uppercase"},
  nb:        {display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 12px",borderRadius:8,border:"none",background:"transparent",color:"#475569",cursor:"pointer",fontSize:13,fontWeight:600,textAlign:"left",marginBottom:4,fontFamily:"inherit"},
  nba:       {background:"#22d3ee15",color:"#22d3ee",borderLeft:"3px solid #22d3ee"},
  main:      {flex:1,minHeight:"100vh",overflowY:"auto"},
  page:      {padding:"32px 36px",maxWidth:1200},
  ph:        {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32},
  ttl:       {fontSize:30,fontWeight:900,color:"#f1f5f9",margin:0,letterSpacing:-1},
  sub:       {color:"#475569",fontSize:14,marginTop:4},
  btnP:      {background:"#22d3ee",color:"#070d1a",border:"none",padding:"10px 20px",borderRadius:8,fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit"},
  kpi:       {background:"#0d1628",border:"1px solid #1e293b",borderRadius:12,padding:"18px 16px",textAlign:"center"},
  st:        {fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:2,marginBottom:14},
  topCard:   {background:"#0d1628",border:"1px solid #1e293b",borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"},
  card:      {background:"#0d1628",border:"1px solid #1e293b",borderRadius:12,padding:"18px"},
  av:        {width:44,height:44,borderRadius:"50%",background:"#22d3ee15",border:"1px solid #22d3ee30",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#22d3ee",fontSize:15,flexShrink:0},
  badge:     {fontSize:11,borderRadius:6,padding:"3px 10px",fontWeight:700,display:"inline-block"},
  fb:        {background:"#0d1628",border:"1px solid #1e293b",color:"#64748b",padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600},
  fbon:      {background:"#22d3ee15",border:"1px solid #22d3ee44",color:"#22d3ee"},
  mc:        {background:"#0d1628",border:"1px solid #1e293b",borderRadius:10,padding:"14px 12px"},
  th:        {padding:"12px 16px",color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:1,textAlign:"left",borderBottom:"1px solid #1e293b",fontWeight:700},
  td:        {padding:"12px 16px",fontSize:14,color:"#94a3b8"},
  overlay:   {position:"fixed",inset:0,background:"#000000bb",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100},
  modal:     {background:"#0d1628",border:"1px solid #1e293b",borderRadius:16,padding:"28px",maxHeight:"90vh",overflowY:"auto"},
  inp:       {width:"100%",background:"#070d1a",border:"1px solid #1e293b",borderRadius:8,padding:"9px 12px",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"},
  actionBtn: {background:"transparent",border:"1px solid",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"},
};
