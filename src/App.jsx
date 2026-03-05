import { useState, useEffect, useCallback } from "react";

// ------ SUPABASE CONFIG --------------------------------------------------------------------------------------------------------------------
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
  updateCrew:      (id, data)  => sb(`crews?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteCrew:      (id)        => sb(`crews?id=eq.${id}`, { method:"DELETE", prefer:"" }),
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

// ------ UTILS --------------------------------------------------------------------------------------------------------------------------------------
function timeToSeconds(t) { if(!t||!t.includes(":"))return 9999; const[m,s]=t.split(":").map(Number); return m*60+s; }
function secondsToTime(s) { const m=Math.floor(s/60),sec=Math.round(s%60); return `${m}:${String(sec).padStart(2,"0")}`; }
function getBestTime(perfs) { if(!perfs.length)return null; return perfs.reduce((b,p)=>timeToSeconds(p.time)<timeToSeconds(b.time)?p:b); }
function getLastPerf(perfs) { if(!perfs.length)return null; return [...perfs].sort((a,b)=>b.date.localeCompare(a.date))[0]; }
function avg(arr) { return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0; }

const ROLE_COLORS = { admin:"#f59e0b", coach:"#0ea5e9", athlete:"#a78bfa" };
const ROLE_LABELS = { admin:"Super Admin", coach:"Coach", athlete:"Athlète" };
const ROLE_ICONS  = { admin:"~", coach:"~", athlete:"~" };
const ZONE_COLORS = { Z1:"#4ade80",Z2:"#22d3ee",Z3:"#f59e0b",Z4:"#f97316",Z5:"#ef4444",Race:"#a78bfa","--":"#374151" };
const TYPE_COLORS = { Endurance:"#0ea5e9","Fractionné":"#f97316","Repos actif":"#4ade80",Seuil:"#f59e0b",Sprint:"#ef4444",Compétition:"#a78bfa",Repos:"#374151" };
const CMP_COLORS  = ["#0ea5e9","#f97316","#a78bfa","#4ade80"];

// ------ CATEGORIES D'AGE -----------------------------------------------
function getAgeCategory(age) {
  if(!age) return "N/A";
  const a = parseInt(age);
  if(a <= 9)  return "U10";
  if(a <= 11) return "U12";
  if(a === 12) return "J12";
  if(a === 13) return "J13";
  if(a === 14) return "J14";
  if(a <= 16) return "U17";
  if(a <= 18) return "U19";
  if(a <= 26) return "Senior";
  if(a <= 35) return "Master A";
  if(a <= 42) return "Master B";
  if(a <= 49) return "Master C";
  if(a <= 54) return "Master D";
  if(a <= 59) return "Master E";
  return "Master F";
}
const AGE_CAT_COLORS = {
  "U10":"#4ade80","U12":"#0ea5e9","J12":"#06b6d4","J13":"#0ea5e9","J14":"#3b82f6",
  "U17":"#a78bfa","U19":"#c084fc","Senior":"#f59e0b","Master A":"#f97316",
  "Master B":"#fb923c","Master C":"#fbbf24","Master D":"#a3e635","Master E":"#34d399","Master F":"#2dd4bf"
};
const AGE_CAT_GROUPS = ["Tous","U10","U12","Jeunes (J12-J14)","U17","U19","Senior","Master"];
function matchesAgeGroup(athlete, group) {
  if(group === "Tous") return true;
  const cat = getAgeCategory(athlete.age);
  if(group === "Jeunes (J12-J14)") return ["J12","J13","J14"].includes(cat);
  if(group === "Master") return cat.startsWith("Master");
  return cat === group;
}

function calcAgeFromDOB(dob) {
  if(!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if(m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
function getCategoryFromAge(age, genre="H") {
  if(!age && age !== 0) return "Senior H";
  const cat = getAgeCategory(age);
  // Map age cat to rowing category
  if(["U10","U12","J12","J13","J14"].includes(cat)) return `Jeune ${genre}`;
  if(cat === "U17") return `Junior ${genre}`;
  if(cat === "U19") return `Espoir ${genre}`;
  if(cat.startsWith("Master")) return `${cat} ${genre}`;
  return `Senior ${genre}`;
}

const BLADE_TYPES = ["Smoothie 2","Fat 2","Fat2 Skinny","BigBlade","Macon","Bantam","Apex","Autre"];

// ------ DONNÉES MORPHO & SUGGESTIONS RÉGLAGES (inspiré standards WRF/FISA) --------
// Longueurs pelles standard (cm) : levier total = intérieur + extérieur
const BLADE_SPECS = {
  "Smoothie 2":    {total:288, inboard_default:88},
  "Fat 2":         {total:290, inboard_default:88},
  "Fat2 Skinny":   {total:288, inboard_default:88},
  "BigBlade":      {total:290, inboard_default:90},
  "Macon":         {total:292, inboard_default:88},
  "Bantam":        {total:286, inboard_default:86},
  "Apex":          {total:288, inboard_default:88},
  "Autre":         {total:288, inboard_default:88},
};

function suggestRigging(athlete, bladeType, boatType) {
  if(!athlete) return null;
  const { envergure, longueur_bras, largeur_epaules, taille, taille_assise, weight } = athlete;
  if(!envergure && !longueur_bras && !largeur_epaules) return null;

  const blade = BLADE_SPECS[bladeType] || BLADE_SPECS["Smoothie 2"];
  const suggestions = {};
  const notes = [];

  // --- ENTRAXE (span) ---
  // Standard: largeur épaules + 2*delta selon type nage
  // Couple: ~158-162cm / Pointe: ~85-88cm (demi-entraxe)
  if(largeur_epaules) {
    if(boatType === "couple") {
      const span = Math.round(largeur_epaules * 1.12 + 100);
      suggestions.entraxe = Math.min(Math.max(span, 155), 165);
      notes.push("Entraxe calculé depuis largeur épaules (" + largeur_epaules + "cm)");
    } else {
      const halfSpan = Math.round(largeur_epaules * 0.56 + 50);
      suggestions.entraxe = Math.min(Math.max(halfSpan, 83), 90);
      notes.push("Demi-entraxe calculé (pointe)");
    }
  }

  // --- LEVIER INTÉRIEUR ---
  // Standard: longueur de bras / 2 + constante selon pelle
  // Règle générale: plus le bras est long, plus le levier peut être court
  if(longueur_bras) {
    const base = boatType === "couple" ? blade.inboard_default : Math.round(blade.inboard_default * 0.62);
    const adjust = Math.round((longueur_bras - 80) * 0.15);
    suggestions.levier_interieur = Math.min(Math.max(base - adjust, base - 3), base + 3);
    notes.push("Levier int. ajusté selon longueur de bras (" + longueur_bras + "cm)");
  }

  // --- LEVIER EXTÉRIEUR (longueur hors-bord) ---
  if(suggestions.levier_interieur) {
    suggestions.levier_exterieur = blade.total - suggestions.levier_interieur;
    // Ratio levier int/ext : idéalement 1:2.2 à 1:2.5
    const ratio = (suggestions.levier_exterieur / suggestions.levier_interieur).toFixed(2);
    notes.push("Ratio int/ext: 1:" + ratio + " (idéal: 1:2.2 à 1:2.5)");
  }

  // --- LONGUEUR PÉDALE ---
  // Basé sur taille assise ou taille * 0.27
  if(taille_assise) {
    suggestions.longueur_pedale = Math.round(taille_assise * 0.72);
    notes.push("Longueur pédale depuis taille assise (" + taille_assise + "cm)");
  } else if(taille) {
    const estimated_sitting = Math.round(taille * 0.52);
    suggestions.longueur_pedale = Math.round(estimated_sitting * 0.72);
    notes.push("Longueur pédale estimée depuis taille (" + taille + "cm)");
  }

  // --- CROISEMENT ---
  // Standard couple: 20-30cm selon morpho
  if(envergure && taille) {
    const ratio_env = envergure / taille;
    if(boatType === "couple") {
      suggestions.croisement = ratio_env > 1.05 ? 25 : ratio_env > 1.0 ? 22 : 20;
      notes.push("Croisement selon ratio envergure/taille (" + ratio_env.toFixed(2) + ")");
    }
  }

  return { suggestions, notes };
}
const CREW_SLOTS  = { "1x":1,"2x":2,"2-":2,"4x":4,"4-":4,"4+":4,"8+":8 };

// ------ MINI COMPOSANTS ------------------------------------------------------------------------------------------------------------------
function Sparkline({ data, color="#0ea5e9", invert=false }) {
  if(!data||data.length<2)return null;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1,w=72,h=26;
  const pts=data.map((v,i)=>{ const x=(i/(data.length-1))*w,y=invert?((v-min)/range)*h:h-((v-min)/range)*h; return `${x},${y}`; }).join(" ");
  const last=pts.split(" ").pop().split(",");
  return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx={last[0]} cy={last[1]} r="3" fill={color}/></svg>;
}
function StatPill({ label, value, color }) {
  return <div style={{background:color+"15",border:"1px solid "+(color)+"30",borderRadius:8,padding:"5px 10px",textAlign:"center"}}><div style={{color,fontWeight:700,fontSize:14}}>{value}</div><div style={{color:"#7a95b0",fontSize:10}}>{label}</div></div>;
}
function FF({ label, children }) {
  return <div style={{marginBottom:12}}><label style={{display:"block",color:"#7a95b0",fontSize:11,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{label}</label>{children}</div>;
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,width:wide?660:440}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:0}}>{title}</h2>
          <button style={{background:"none",border:"none",color:"#7a95b0",cursor:"pointer",fontSize:20}} onClick={onClose}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Loader({ text="Chargement..." }) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",flexDirection:"column",gap:16}}>
    <div style={{width:40,height:40,border:"3px solid #1e293b",borderTop:"3px solid #22d3ee",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{color:"#7a95b0",fontSize:14}}>{text}</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
function Toast({ message, type="success", onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2500); return()=>clearTimeout(t); },[]);
  return <div style={{position:"fixed",bottom:24,right:24,background:type==="error"?"#ef444420":"#4ade8020",border:`1px solid ${type==="error"?"#ef4444":"#4ade80"}`,color:type==="error"?"#ef4444":"#4ade80",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:700,zIndex:200,fontFamily:"'DM Mono',monospace"}}>{message}</div>;
}

// ==========================================================================================================================================================
// LOGIN
// ==========================================================================================================================================================
function Login({ onLogin }) {
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
    <div style={{minHeight:"100vh",background:"#0f1923",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif"}}>
      <div style={{width:420}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:52,marginBottom:12}}>~</div>
          <div style={{fontSize:22,fontWeight:900,color:"#0ea5e9",letterSpacing:1}}>AvironCoach</div>
          <div style={{fontSize:11,color:"#5a7a9a",letterSpacing:3,textTransform:"uppercase",marginTop:4}}>Performance Track</div>
        </div>
        <div style={{background:"#182030",border:"1px solid #1e293b",borderRadius:16,padding:"36px 32px"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>Connexion</div>
          <div style={{fontSize:13,color:"#5a7a9a",marginBottom:28}}>Admin - Coach - Athlète</div>
          <FF label="Email"><input style={{...S.inp,width:"100%"}} type="email" placeholder="email@club.fr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></FF>
          <FF label="Mot de passe / PIN"><input style={{...S.inp,width:"100%"}} type="password" placeholder="****" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></FF>
          {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:14,padding:"8px 12px",background:"#ef444415",borderRadius:8,border:"1px solid #ef444430"}}>{err}</div>}
          <button style={{...S.btnP,width:"100%",marginTop:4,padding:"12px",fontSize:14,opacity:loading?0.7:1}} onClick={login} disabled={loading}>{loading?"Connexion...":"Se connecter ->"}</button>
          <div style={{marginTop:24,padding:"16px",background:"#1e293b50",borderRadius:10,fontSize:12,color:"#7a95b0",lineHeight:2}}>
            <div style={{color:"#a8bfd4",fontWeight:700,marginBottom:4}}>Comptes de démo</div>
            <div>~ <span style={{color:"#f59e0b"}}>admin@club.fr</span> / <span style={{color:"#f59e0b"}}>admin2026</span></div>
            <div>~ <span style={{color:"#0ea5e9"}}>coach@club.fr</span> / <span style={{color:"#0ea5e9"}}>coach2026</span></div>
            <div>~ <span style={{color:"#a78bfa"}}>lucas@club.fr</span> / <span style={{color:"#a78bfa"}}>1234</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================================================================================================
// ADMIN PANEL
// ==========================================================================================================================================================
function AdminSpace({ currentUser, onLogout }) {
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
      setToast({m:"Compte créé v",t:"success"}); load();
      setNU({name:"",email:"",password:"",role:"athlete"}); setShowAdd(false);
    } catch(e){ setToast({m:"Erreur : "+e.message,t:"error"}); }
  }
  async function saveEdit() {
    try {
      await api.updateUser(editUser.id,{name:editUser.name,email:editUser.email,role:editUser.role,...(editUser._newpw?{password:editUser._newpw}:{})});
      setToast({m:"Modifié v",t:"success"}); load(); setEditUser(null);
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
        <div style={{...S.logo,borderColor:"#3a2a0a"}}><span style={{fontSize:28}}>~</span><div><div style={{...S.logoT,color:"#f59e0b"}}>AvironCoach</div><div style={S.logoS}>Super Admin</div></div></div>
        <nav style={{flex:1,padding:"8px 12px"}}>
          {[{id:"users",label:"Comptes",icon:"o"},{id:"stats",label:"Vue globale",icon:"*"}].map(n=>(
            <button key={n.id} style={{...S.nb,...(tab===n.id?{...S.nba,color:"#f59e0b",background:"#f59e0b15",borderLeftColor:"#f59e0b"}:{})}} onClick={()=>setTab(n.id)}><span style={{fontSize:16}}>{n.icon}</span>{n.label}</button>
          ))}
        </nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #3a2a0a"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{...S.av,background:"#f59e0b22",border:"1px solid #f59e0b44",color:"#f59e0b",width:34,height:34,fontSize:14}}>A</div>
            <div><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{currentUser.name}</div><div style={{fontSize:11,color:"#7a95b0"}}>Super Admin</div></div>
          </div>
          <button style={{...S.btnP,width:"100%",background:"transparent",color:"#7a95b0",border:"1px solid #1e293b",fontSize:12}} onClick={onLogout}>Deconnexion</button>
        </div>
      </aside>
      <div style={S.main}>
        {tab==="users"&&(
          <div style={S.page}>
            <div style={S.ph}>
              <div><h1 style={S.ttl}>Gestion des comptes</h1><p style={S.sub}>{users.filter(u=>u.active).length}/{users.length} actifs - données en direct depuis Supabase</p></div>
              <button style={{...S.btnP,background:"#f59e0b",color:"#0f1923"}} onClick={()=>setShowAdd(true)}>+ Nouveau compte</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
              {[{l:"Total",v:users.length,c:"#f1f5f9",ic:"o"},{l:"Admins",v:counts.admin,c:"#f59e0b",ic:"~"},{l:"Coachs",v:counts.coach,c:"#0ea5e9",ic:"~"},{l:"Athlètes",v:counts.athlete,c:"#a78bfa",ic:"~"}].map((k,i)=>(
                <div key={i} style={S.kpi}><div style={{color:k.c,fontSize:22,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:28,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {[["all","Tous"],["admin","Admins"],["coach","Coachs"],["athlete","Athlètes"]].map(([v,l])=>(
                <button key={v} style={{...S.fb,...(filterRole===v?{...S.fbon,borderColor:(ROLE_COLORS[v] ? ROLE_COLORS[v] : "#0ea5e9")+"60",color:ROLE_COLORS[v] ? ROLE_COLORS[v] : "#0ea5e9",background:(ROLE_COLORS[v] ? ROLE_COLORS[v] : "#0ea5e9")+"20"}:{})}} onClick={()=>setFilterRole(v)}>{l}</button>
              ))}
            </div>
            {loading?<Loader/>:(
              <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
                  <thead><tr>{["Compte","Email","Rôle","Statut","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filtered.map(u=>(
                      <tr key={u.id} style={{borderBottom:"1px solid #1e293b",opacity:u.active?1:0.5}}>
                        <td style={S.td}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{...S.av,width:36,height:36,fontSize:13,background:ROLE_COLORS[u.role]+"22",border:"1px solid "+(ROLE_COLORS[u.role])+"40",color:ROLE_COLORS[u.role]}}>{u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
                            <div><div style={{color:"#f1f5f9",fontWeight:700,fontSize:14}}>{u.name}</div><div style={{color:"#5a7a9a",fontSize:11}}>{u.role==="athlete"&&u.athlete_id?`Athlète #${u.athlete_id}`:""}</div></div>
                          </div>
                        </td>
                        <td style={{...S.td,color:"#7a95b0"}}>{u.email}</td>
                        <td style={S.td}>
                          <select style={{...S.inp,width:"auto",padding:"4px 8px",fontSize:12,color:ROLE_COLORS[u.role],background:"#182030",border:`1px solid ${ROLE_COLORS[u.role]}40`}}
                            value={u.role} onChange={e=>changeRole(u.id,e.target.value)} disabled={u.id===currentUser.id}>
                            <option value="admin">~ Super Admin</option>
                            <option value="coach">~ Coach</option>
                            <option value="athlete">~ Athlète</option>
                          </select>
                        </td>
                        <td style={S.td}><span style={{...S.badge,background:u.active?"#4ade8020":"#ef444420",color:u.active?"#4ade80":"#ef4444",border:`1px solid ${u.active?"#4ade8040":"#ef444440"}`}}>{u.active?"* Actif":"o Inactif"}</span></td>
                        <td style={S.td}>
                          <div style={{display:"flex",gap:6}}>
                            <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>setEditUser({...u,_newpw:""})}>Edit</button>
                            {u.id!==currentUser.id&&<>
                              <button style={{...S.actionBtn,color:u.active?"#f59e0b":"#4ade80",borderColor:u.active?"#f59e0b30":"#4ade8030"}} onClick={()=>setConfirm({u,action:u.active?"deactivate":"activate"})}>{u.active?"||":">"}</button>
                              <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>setConfirm({u,action:"delete"})}>X</button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{marginTop:20,padding:"14px 18px",background:"#182030",border:"1px solid #1e293b",borderRadius:10,fontSize:12,color:"#7a95b0"}}>
               Les changements de rôle sont <strong style={{color:"#a8bfd4"}}>immédiats et persistants</strong> dans Supabase.
            </div>

            {showAdd&&<Modal title="Créer un compte" onClose={()=>setShowAdd(false)}>
              <FF label="Rôle"><div style={{display:"flex",gap:8}}>
                {[["admin","~ Admin"],["coach","~ Coach"],["athlete","~ Athlète"]].map(([v,l])=>(
                  <button key={v} style={{...S.fb,flex:1,...(newUser.role===v?{background:ROLE_COLORS[v]+"20",border:"1px solid "+(ROLE_COLORS[v])+"60",color:ROLE_COLORS[v]}:{})}} onClick={()=>setNU(p=>({...p,role:v}))}>{l}</button>
                ))}
              </div></FF>
              <FF label="Nom complet"><input style={S.inp} value={newUser.name} onChange={e=>setNU(p=>({...p,name:e.target.value}))} placeholder="Prénom Nom"/></FF>
              <FF label="Email"><input style={S.inp} type="email" value={newUser.email} onChange={e=>setNU(p=>({...p,email:e.target.value}))} placeholder="prenom@club.fr"/></FF>
              <FF label="Mot de passe / PIN"><input style={S.inp} type="password" value={newUser.password} onChange={e=>setNU(p=>({...p,password:e.target.value}))} placeholder="Choisir un mot de passe"/></FF>
              <button style={{...S.btnP,width:"100%",marginTop:8,background:"#f59e0b",color:"#0f1923"}} onClick={addUser}>Créer le compte</button>
            </Modal>}

            {editUser&&<Modal title="Éditer le compte" onClose={()=>setEditUser(null)}>
              <FF label="Nom"><input style={S.inp} value={editUser.name} onChange={e=>setEditUser(p=>({...p,name:e.target.value}))}/></FF>
              <FF label="Email"><input style={S.inp} type="email" value={editUser.email} onChange={e=>setEditUser(p=>({...p,email:e.target.value}))}/></FF>
              <FF label="Nouveau mot de passe (vide = inchangé)"><input style={S.inp} type="password" placeholder="****" onChange={e=>setEditUser(p=>({...p,_newpw:e.target.value}))}/></FF>
              <FF label="Rôle"><select style={S.inp} value={editUser.role} onChange={e=>setEditUser(p=>({...p,role:e.target.value}))} disabled={editUser.id===currentUser.id}>
                <option value="admin">~ Super Admin</option><option value="coach">~ Coach</option><option value="athlete">~ Athlète</option>
              </select></FF>
              <button style={{...S.btnP,width:"100%",marginTop:8,background:"#f59e0b",color:"#0f1923"}} onClick={saveEdit}>Enregistrer</button>
            </Modal>}

            {confirm&&<Modal title="Confirmation" onClose={()=>setConfirm(null)}>
              <div style={{textAlign:"center",padding:"10px 0 20px"}}>
                <div style={{fontSize:40,marginBottom:12}}>{confirm.action==="delete"?"X":confirm.action==="deactivate"?"||":">"}</div>
                <div style={{color:"#f1f5f9",fontSize:16,marginBottom:20}}>{confirm.action==="delete"?`Supprimer ${confirm.u.name} ?`:confirm.action==="deactivate"?`Désactiver ${confirm.u.name} ?`:`Réactiver ${confirm.u.name} ?`}</div>
                <div style={{display:"flex",gap:12,justifyContent:"center"}}>
                  <button style={{...S.btnP,background:"transparent",color:"#7a95b0",border:"1px solid #1e293b"}} onClick={()=>setConfirm(null)}>Annuler</button>
                  <button style={{...S.btnP,background:confirm.action==="delete"?"#ef4444":confirm.action==="deactivate"?"#f59e0b":"#4ade80",color:"#0f1923"}}
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
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div><div style={{color:c,fontWeight:900,fontSize:24}}>{ru.length}</div><div style={{color:"#7a95b0",fontSize:13,textTransform:"uppercase",letterSpacing:1}}>{ROLE_LABELS[role]}s</div></div><div style={{fontSize:28}}>{ROLE_ICONS[role]}</div></div>
                  {ru.map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:"#1e293b50",borderRadius:6,marginBottom:4}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:u.active?"#4ade80":"#ef4444",flexShrink:0}}/>
                    <span style={{color:"#a8bfd4",fontSize:12,flex:1}}>{u.name}</span>
                    <span style={{color:"#5a7a9a",fontSize:10}}>{u.active?"actif":"inactif"}</span>
                  </div>)}
                </div>);
              })}
            </div>
            <div style={S.card}>
              <div style={{display:"flex",gap:32,marginBottom:16}}>
                <div style={{textAlign:"center"}}><div style={{color:"#4ade80",fontSize:32,fontWeight:900}}>{users.filter(u=>u.active).length}</div><div style={{color:"#7a95b0",fontSize:12}}>Actifs</div></div>
                <div style={{textAlign:"center"}}><div style={{color:"#ef4444",fontSize:32,fontWeight:900}}>{users.filter(u=>!u.active).length}</div><div style={{color:"#7a95b0",fontSize:12}}>Désactivés</div></div>
                <div style={{textAlign:"center"}}><div style={{color:"#f59e0b",fontSize:32,fontWeight:900}}>{users.length}</div><div style={{color:"#7a95b0",fontSize:12}}>Total</div></div>
              </div>
              <div style={{height:10,borderRadius:5,background:"#263547",overflow:"hidden",display:"flex"}}>
                {["admin","coach","athlete"].map(role=><div key={role} style={{width:`${users.length?(users.filter(u=>u.role===role).length/users.length)*100:0}%`,background:ROLE_COLORS[role]}}/>)}
              </div>
              <div style={{display:"flex",gap:16,marginTop:10}}>
                {["admin","coach","athlete"].map(role=><div key={role} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:ROLE_COLORS[role]}}/><span style={{color:"#7a95b0",fontSize:12}}>{ROLE_LABELS[role]}s ({users.filter(u=>u.role===role).length})</span></div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================================================================================================================
// COACH SPACE
// ==========================================================================================================================================================
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
  const [rankMode,setRankMode] = useState("wpkg");
  const [compareIds,setCompareIds] = useState([]);
  const [crewBoat,setCrewBoat] = useState("4-");
  const [newCrewMembers,setNewCrewMembers] = useState([]);
  const [crewName,setCrewName] = useState("Nouvel équipage");
  const [editCrew,setEditCrew] = useState(null);
  const [editCrewMembers,setEditCrewMembers] = useState([]);
  const [showAddPerf,setShowAddPerf] = useState(false);
  const [showAddAth,setShowAddAth] = useState(false);
  const [editAth,setEditAth] = useState(null);
  const [newPerf,setNP] = useState({athleteId:"",date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""});
  const [newAth,setNA]  = useState({name:"",date_naissance:"",genre:"H",weight:"",taille:"",envergure:"",longueur_bras:"",largeur_epaules:"",taille_assise:""});
  // Boats states
  const [selBoat,setSelBoat]   = useState(null);
  const [showAddBoat,setShowAddBoat] = useState(false);
  const [showAddSetting,setShowAddSetting] = useState(false);
  const [editBoat,setEditBoat] = useState(null);
  const [newBoat,setNB]        = useState({name:"",type:"couple",seats:4,brand:"",model:"",avg_buoyancy:"",notes:""});
  const [newSetting,setNS]     = useState({poste:1,date_reglage:"",regle_par:"",entraxe:"",longueur_pedale:"",levier_interieur:"",levier_exterieur:"",croisement:"",numero_pelle:"",type_pelle:"",observations:""});

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
      setToast({m:"Performance ajoutée v",t:"success"}); load();
      setNP({athleteId:"",date:"",time:"",watts:"",spm:"",hr:"",rpe:"",distance:""}); setShowAddPerf(false);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function addAth() {
    try {
      const av=newAth.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      const computedAge = calcAgeFromDOB(newAth.date_naissance);
      const computedCat = getCategoryFromAge(computedAge, newAth.genre);
      await api.createAthlete({name:newAth.name,age:computedAge,category:computedCat,weight:+newAth.weight,boat:"1x",date_naissance:newAth.date_naissance,avatar:av,crew_id:null,taille:newAth.taille?+newAth.taille:null,envergure:newAth.envergure?+newAth.envergure:null,longueur_bras:newAth.longueur_bras?+newAth.longueur_bras:null,largeur_epaules:newAth.largeur_epaules?+newAth.largeur_epaules:null,taille_assise:newAth.taille_assise?+newAth.taille_assise:null});
      setToast({m:"Athlète ajouté v",t:"success"}); load();
      setNA({name:"",date_naissance:"",genre:"H",weight:"",taille:"",envergure:"",longueur_bras:"",largeur_epaules:"",taille_assise:""}); setShowAddAth(false);
    } catch(e){setToast({m:"Erreur "+e.message,t:"error"});}
  }
  async function saveEditAth() {
    try {
      const dob = editAth.date_naissance || null;
      const computedAge = dob ? calcAgeFromDOB(dob) : +editAth.age;
      const genre = editAth.genre || (editAth.category?.includes("F") ? "F" : "H");
      const computedCat = getCategoryFromAge(computedAge, genre);
      await api.updateAthlete(editAth.id,{name:editAth.name,age:computedAge,category:computedCat,weight:+editAth.weight,boat:editAth.boat||"1x",photo_url:editAth.photo_url||null,date_naissance:dob,taille:editAth.taille?+editAth.taille:null,envergure:editAth.envergure?+editAth.envergure:null,longueur_bras:editAth.longueur_bras?+editAth.longueur_bras:null,largeur_epaules:editAth.largeur_epaules?+editAth.largeur_epaules:null,taille_assise:editAth.taille_assise?+editAth.taille_assise:null});
      setToast({m:"Fiche modifiée v",t:"success"}); load(); setEditAth(null);
    } catch(e){setToast({m:"Erreur "+e.message,t:"error"});}
  }
  async function deleteAth(id) {
    try {
      await api.deleteAthlete(id);
      setToast({m:"Athlète supprimé",t:"success"}); load();
      setEditAth(null);
    } catch(e){setToast({m:"Erreur suppression",t:"error"});}
  }

  async function saveNewCrew() {
    if(!newCrewMembers.length)return;
    try {
      const [nc]=await api.createCrew({name:crewName,boat:crewBoat,notes:""});
      for(const aid of newCrewMembers) await api.addCrewMember({crew_id:nc.id,athlete_id:aid});
      setToast({m:"Équipage créé v",t:"success"}); load();
      setNewCrewMembers([]); setCrewName("Nouvel équipage");
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }

  async function saveEditCrew() {
    if(!editCrew) return;
    try {
      await api.updateCrew(editCrew.id, {name:editCrew.name, boat:editCrew.boat, notes:editCrew.notes||""});
      await api.removeCrewMembers(editCrew.id);
      for(const aid of editCrewMembers) await api.addCrewMember({crew_id:editCrew.id, athlete_id:aid});
      setToast({m:"Équipage modifié v",t:"success"}); load(); setEditCrew(null);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }

  // Boats CRUD
  async function addBoat() {
    try {
      await api.createBoat({...newBoat,seats:+newBoat.seats,avg_buoyancy:newBoat.avg_buoyancy?+newBoat.avg_buoyancy:null});
      setToast({m:"Bateau ajouté v",t:"success"}); load();
      setNB({name:"",type:"couple",seats:4,brand:"",model:"",avg_buoyancy:"",notes:""}); setShowAddBoat(false);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function saveEditBoat() {
    try {
      await api.updateBoat(editBoat.id,{name:editBoat.name,type:editBoat.type,seats:+editBoat.seats,brand:editBoat.brand,model:editBoat.model,avg_buoyancy:editBoat.avg_buoyancy?+editBoat.avg_buoyancy:null,notes:editBoat.notes});
      setToast({m:"Bateau modifié v",t:"success"}); load(); setEditBoat(null);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function addSetting() {
    if(!selBoat) return;
    try {
      await api.createBoatSetting({...newSetting,boat_id:selBoat,poste:+newSetting.poste,entraxe:newSetting.entraxe?+newSetting.entraxe:null,longueur_pedale:newSetting.longueur_pedale?+newSetting.longueur_pedale:null,levier_interieur:newSetting.levier_interieur?+newSetting.levier_interieur:null,levier_exterieur:newSetting.levier_exterieur?+newSetting.levier_exterieur:null,croisement:newSetting.croisement?+newSetting.croisement:null});
      setToast({m:"Réglage enregistré v",t:"success"}); load();
      setNS({poste:1,date_reglage:"",regle_par:"",entraxe:"",longueur_pedale:"",levier_interieur:"",levier_exterieur:"",croisement:"",numero_pelle:"",type_pelle:"",observations:""}); setShowAddSetting(false);
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

  function getBoatStats(boatId) {
    const linkedCrews = getBoatCrewsFor(boatId);
    const members = linkedCrews.flatMap(cr => crewMembers.filter(m=>m.crew_id===cr.id).map(m=>athletes.find(a=>a.id===m.athlete_id)).filter(Boolean));
    if(!members.length) return null;
    const avgWeight = members.length ? Math.round(members.reduce((s,a)=>s+(a.weight||0),0)/members.length) : null;
    const memberPerfs = members.flatMap(a => performances.filter(p=>p.athlete_id===a.id));
    const avgWatts = memberPerfs.length ? Math.round(memberPerfs.reduce((s,p)=>s+(p.watts||0),0)/memberPerfs.length) : null;
    const bestTimes = members.map(a=>{const best=getBestTime(performances.filter(p=>p.athlete_id===a.id));return best?timeToSeconds(best.time):null;}).filter(Boolean);
    const avgTime = bestTimes.length ? secondsToTime(Math.round(bestTimes.reduce((s,t)=>s+t,0)/bestTimes.length)) : null;
    return {avgWeight, avgWatts, avgTime, count: members.length};
  }

    const categories=["Tous",...new Set(athletes.map(a=>a.category))];
  const filteredAths=filterCat==="Tous"?athletes:athletes.filter(a=>matchesAgeGroup(a,filterCat)||a.category===filterCat);
  const globalAvgW=performances.length?Math.round(performances.reduce((s,p)=>s+(p.watts||0),0)/performances.length):0;
  const globalBest=performances.reduce((b,p)=>timeToSeconds(p.time)<timeToSeconds(b)?p.time:b,"9:99");

  const NAV=[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"athletes",label:"Athlètes",icon:"👤"},{id:"performances",label:"Performances",icon:"⚡"},{id:"compare",label:"Comparer",icon:"⚖️"},{id:"crew",label:"Équipages",icon:"🚣"},{id:"boats",label:"Bateaux",icon:"🛶"},{id:"planning",label:"Planning",icon:"📅"}];

  if(loading) return <div style={{...S.root,alignItems:"center",justifyContent:"center"}}><Loader text="Chargement depuis Supabase..."/></div>;

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={{width:38,height:38,borderRadius:10,background:"#0ea5e920",border:"1px solid #0ea5e940",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🚣</div>
          <div><div style={S.logoT}>AvironCoach</div><div style={S.logoS}>Espace Coach</div></div>
        </div>
        <div style={{padding:"6px 12px",marginBottom:4}}><div style={{fontSize:10,color:"#334155",textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,padding:"0 6px"}}>Navigation</div></div>
        <nav style={{flex:1,padding:"0 10px",overflowY:"auto"}}>{NAV.map(n=><button key={n.id} style={{...S.nb,...(tab===n.id?S.nba:{})}} onClick={()=>setTab(n.id)}><span style={{fontSize:17,width:24,textAlign:"center"}}>{n.icon}</span><span style={{flex:1}}>{n.label}</span>{tab===n.id&&<span style={{width:6,height:6,borderRadius:"50%",background:"#38bdf8",display:"inline-block"}}/>}</button>)}</nav>
        <div style={{padding:"14px 12px",borderTop:"1px solid #1e293b",margin:"0 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",background:"#111827",borderRadius:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"#0ea5e920",border:"1px solid #0ea5e940",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0ea5e9",fontSize:13,flexShrink:0}}>{currentUser.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name}</div><div style={{fontSize:10,color:"#0ea5e9",fontWeight:600}}>Coach</div></div>
            <button title="Ma fiche" style={{background:"#0ea5e915",border:"1px solid #0ea5e930",borderRadius:6,color:"#0ea5e9",cursor:"pointer",fontSize:14,padding:"4px 8px"}} onClick={()=>{const me=athletes.find(a=>a.id===currentUser.athlete_id);if(me)setEditAth({...me});else setToast({m:"Aucune fiche liée à ce compte",t:"error"});}}>✏️</button>
          </div>
          <button style={{...S.btnP,width:"100%",background:"transparent",color:"#64748b",border:"1px solid #1e293b",fontSize:12,padding:"8px"}} onClick={onLogout}>← Déconnexion</button>
        </div>
      </aside>
      <div style={S.main}>

        {tab==="dashboard"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Dashboard</h1><p style={S.sub}>{athletes.length} athlètes - données en direct</p></div></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:36}}>
            {[{l:"Athlètes",v:athletes.length,c:"#0ea5e9",ic:"o"},{l:"Sessions",v:performances.length,c:"#f59e0b",ic:"*"},{l:"Puissance moy.",v:`${globalAvgW}W`,c:"#a78bfa",ic:"~"},{l:"Meilleur 2k",v:globalBest,c:"#4ade80",ic:"~"},{l:"Équipages",v:crews.length,c:"#f97316",ic:"~"}].map((k,i)=>(
              <div key={i} style={S.kpi}><div style={{color:k.c,fontSize:22,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:26,fontWeight:900,letterSpacing:-1}}>{k.v}</div><div style={{color:"#a8bfd4",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>
            ))}
          </div>
          {(()=>{
            // rankMode from parent state
            const ranked=athletes.map(a=>{const{last,wpkg,perfs,best}=aStats(a);const km=perfs.reduce((s,p)=>s+(p.distance||0),0);return last?{...a,watts:last.watts,wpkg:parseFloat(wpkg)||0,wT:perfs.map(p=>p.watts),best,km,sessions:perfs.length}:null;}).filter(Boolean);
            const sorted=rankMode==="wpkg"?[...ranked].sort((a,b)=>b.wpkg-a.wpkg):rankMode==="time"?[...ranked].filter(a=>a.best).sort((a,b)=>timeToSeconds(a.best.time)-timeToSeconds(b.best.time)):rankMode==="km"?[...ranked].sort((a,b)=>b.km-a.km):[...ranked].sort((a,b)=>b.sessions-a.sessions);
            return(<>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={S.st}>Classements</div>
                <div style={{display:"flex",gap:6}}>{[["wpkg","W/kg","#a78bfa"],["time","Temps 2k","#4ade80"],["km","Km totaux","#f97316"],["sessions","Sessions","#0ea5e9"]].map(([k,l,c])=><button key={k} style={{...S.fb,...(rankMode===k?{background:c+"20",border:"1px solid "+c+"60",color:c}:{})}} onClick={()=>setRankMode(k)}>{l}</button>)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:32}}>
                {sorted.map((a,i)=>{
                  const val=rankMode==="wpkg"?a.wpkg.toFixed(2)+" W/kg":rankMode==="time"?(a.best?.time??"-"):rankMode==="km"?a.km+"km":a.sessions+" sessions";
                  const sub=rankMode==="wpkg"?a.watts+"W":rankMode==="time"?a.wpkg+" W/kg":rankMode==="km"?a.sessions+" sessions":a.km+"km";
                  const col=rankMode==="wpkg"?"#a78bfa":rankMode==="time"?"#4ade80":rankMode==="km"?"#f97316":"#0ea5e9";
                  const ageCat=getAgeCategory(a.age);
                  return(<div key={a.id} style={S.topCard} onClick={()=>{setSelAth(a.id);setTab("performances");}}>
                    <div style={{width:28,color:"#0ea5e9",fontWeight:900,fontSize:18}}>#{i+1}</div>
                    {a.photo_url?<img src={a.photo_url} style={{...S.av,objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>:<div style={S.av}>{a.avatar}</div>}
                    <div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9",display:"flex",alignItems:"center",gap:6}}>{a.name}<span style={{fontSize:10,padding:"2px 6px",borderRadius:8,background:(AGE_CAT_COLORS[ageCat] ? AGE_CAT_COLORS[ageCat] : "#374151")+"25",color:(AGE_CAT_COLORS[ageCat] ? AGE_CAT_COLORS[ageCat] : "#94a3b8")}}>{ageCat}</span></div><div style={{color:"#7a95b0",fontSize:12}}>{a.category} - {a.boat}</div></div>
                    <div style={{textAlign:"right",minWidth:90}}><div style={{color:col,fontWeight:800,fontSize:18}}>{val}</div><div style={{color:"#7a95b0",fontSize:12}}>{sub}</div></div>
                    <div style={{marginLeft:14}}><Sparkline data={a.wT} color="#0ea5e9"/></div>
                  </div>);
                })}
              </div>
            </>);
          })()}
          <div style={S.st}>~ Planning semaine</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
            {sessions.map(s=><div key={s.id} style={{...S.card,minHeight:110}}>
              <div style={{fontWeight:800,color:"#f1f5f9",fontSize:13,marginBottom:8}}>{s.day}</div>
              <div style={{...S.badge,background:TYPE_COLORS[s.type]+"22",color:TYPE_COLORS[s.type]?""+TYPE_COLORS[s.type]:"#a8bfd4",border:"1px solid "+(TYPE_COLORS[s.type] ? TYPE_COLORS[s.type] : "#a8bfd4")+"44",marginBottom:8}}>{s.type}</div>
              <div style={{color:"#a8bfd4",fontSize:12}}>{s.duration}</div>
              <div style={{color:"#5a7a9a",fontSize:11,marginTop:4}}>{getSessionCrewsFor(s.id).length?`${getSessionCrewsFor(s.id).length} équipages`:"--"}</div>
            </div>)}
          </div>
        </div>)}

        {tab==="athletes"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Athlètes</h1><p style={S.sub}>{athletes.length} rameurs</p></div><button style={S.btnP} onClick={()=>setShowAddAth(true)}>+ Ajouter</button></div>
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
            {AGE_CAT_GROUPS.map(c=><button key={c} style={{...S.fb,...(filterCat===c?S.fbon:{})}} onClick={()=>setFilterCat(c)}>{c}</button>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16}}>
            {filteredAths.map(a=>{
              const{perfs,best,last,wpkg}=aStats(a);const wTrend=perfs.length>=2?last.watts-perfs[perfs.length-2].watts:0;const aCrew=getCrewForAthlete(a);
              return(<div key={a.id} style={{...S.card,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  {a.photo_url?<img src={a.photo_url} style={{...S.av,objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>:<div style={S.av}>{a.avatar}</div>}
                  <div style={{flex:1}} onClick={()=>{setSelAth(a.id);setTab("performances");}}><div style={{fontWeight:800,color:"#f1f5f9",fontSize:15,display:"flex",alignItems:"center",gap:8}}>{a.name}<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:(AGE_CAT_COLORS[getAgeCategory(a.age)] ? AGE_CAT_COLORS[getAgeCategory(a.age)] : "#374151")+"25",color:(AGE_CAT_COLORS[getAgeCategory(a.age)] ? AGE_CAT_COLORS[getAgeCategory(a.age)] : "#94a3b8"),fontWeight:700}}>{getAgeCategory(a.age)}</span></div><div style={{color:"#7a95b0",fontSize:12}}>{a.category} - {a.boat} - {a.age}ans - {a.weight}kg{a.taille?" - "+a.taille+"cm":""}{a.envergure?" - env."+a.envergure+"cm":""}</div>{aCrew&&<div style={{color:"#0ea5e9",fontSize:11,marginTop:2}}>~ {aCrew.name}</div>}</div>
                  <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30",flexShrink:0}} onClick={e=>{e.stopPropagation();setEditAth({...a});}}>✏️ Edit</button>
                </div>
                {last?(<>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}} onClick={()=>{setSelAth(a.id);setTab("performances");}}>
                    <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:8,padding:"7px 10px"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2k</div><div style={{color:"#4ade80",fontWeight:900,fontSize:20}}>{best?.time??"--"}</div></div>
                    <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:8,padding:"7px 10px"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:20}}>{wpkg??"--"}</div></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}} onClick={()=>{setSelAth(a.id);setTab("performances");}}>
                    <span style={{color:"#7a95b0",fontSize:12}}>{perfs.length} sessions</span>
                    <span style={{color:wTrend>=0?"#4ade80":"#ef4444",fontSize:13,fontWeight:700}}>{wTrend>=0?"^":"v"} {Math.abs(wTrend)}W</span>
                    <Sparkline data={perfs.map(p=>p.watts)} color="#0ea5e9"/>
                  </div>
                </>):<div style={{color:"#5a7a9a",fontSize:13,textAlign:"center",padding:"12px 0"}} onClick={()=>{setSelAth(a.id);setTab("performances");}}>Aucune performance</div>}
              </div>);
            })}
          </div>
          {showAddAth&&<Modal title="Nouvel athlète" onClose={()=>setShowAddAth(false)}>
            <FF label="Nom"><input style={S.inp} value={newAth.name} onChange={e=>setNA(p=>({...p,name:e.target.value}))} placeholder="Prénom Nom"/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Date de naissance"><input style={S.inp} type="date" value={newAth.date_naissance} onChange={e=>setNA(p=>({...p,date_naissance:e.target.value}))}/></FF>
              <FF label="Genre"><select style={S.inp} value={newAth.genre} onChange={e=>setNA(p=>({...p,genre:e.target.value}))}><option value="H">Homme</option><option value="F">Femme</option></select></FF>
            </div>
            {newAth.date_naissance&&(()=>{const age=calcAgeFromDOB(newAth.date_naissance);const cat=getCategoryFromAge(age,newAth.genre);return(<div style={{padding:"8px 12px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,fontSize:13}}><span style={{color:"#64748b"}}>Catégorie auto : </span><span style={{color:"#0ea5e9",fontWeight:700}}>{cat}</span><span style={{color:"#64748b"}}> · {age} ans</span></div>);})()}
            <FF label="Poids (kg)"><input style={S.inp} type="number" value={newAth.weight} onChange={e=>setNA(p=>({...p,weight:e.target.value}))} placeholder="ex: 75"/></FF>
            <div style={{marginTop:12,padding:"12px",background:"#111827",borderRadius:8,border:"1px solid #334155"}}><div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Données morphologiques (pour suggestions réglages)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <FF label="Taille (cm)"><input style={S.inp} type="number" value={newAth.taille} onChange={e=>setNA(p=>({...p,taille:e.target.value}))} placeholder="ex: 185"/></FF>
              <FF label="Envergure (cm)"><input style={S.inp} type="number" value={newAth.envergure} onChange={e=>setNA(p=>({...p,envergure:e.target.value}))} placeholder="ex: 190"/></FF>
              <FF label="Longueur bras (cm)"><input style={S.inp} type="number" value={newAth.longueur_bras} onChange={e=>setNA(p=>({...p,longueur_bras:e.target.value}))} placeholder="épaule-poignet"/></FF>
              <FF label="Largeur épaules (cm)"><input style={S.inp} type="number" value={newAth.largeur_epaules} onChange={e=>setNA(p=>({...p,largeur_epaules:e.target.value}))} placeholder="ex: 46"/></FF>
              <FF label="Taille assise (cm)"><input style={S.inp} type="number" value={newAth.taille_assise} onChange={e=>setNA(p=>({...p,taille_assise:e.target.value}))} placeholder="ex: 96"/></FF>
            </div></div>
            <button style={{...S.btnP,width:"100%",marginTop:12}} onClick={addAth}>Créer la fiche</button>
          </Modal>}
          {editAth&&<Modal title={`✏️ ${editAth.name}`} onClose={()=>setEditAth(null)}>
            <FF label="Nom complet"><input style={S.inp} value={editAth.name} onChange={e=>setEditAth(p=>({...p,name:e.target.value}))}/></FF>
            <FF label="Photo (URL)"><input style={S.inp} type="url" value={editAth.photo_url||""} onChange={e=>setEditAth(p=>({...p,photo_url:e.target.value}))} placeholder="https://... (lien image)"/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Date de naissance"><input style={S.inp} type="date" value={editAth.date_naissance||""} onChange={e=>setEditAth(p=>({...p,date_naissance:e.target.value}))}/></FF>
              <FF label="Genre"><select style={S.inp} value={editAth.genre||(editAth.category?.includes("F")?"F":"H")} onChange={e=>setEditAth(p=>({...p,genre:e.target.value}))}><option value="H">Homme</option><option value="F">Femme</option></select></FF>
            </div>
            {(editAth.date_naissance||(editAth.age&&editAth.age>0))&&(()=>{const age=editAth.date_naissance?calcAgeFromDOB(editAth.date_naissance):editAth.age;const genre=editAth.genre||(editAth.category?.includes("F")?"F":"H");const cat=getCategoryFromAge(age,genre);return(<div style={{padding:"8px 12px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,fontSize:13}}><span style={{color:"#64748b"}}>Catégorie : </span><span style={{color:"#0ea5e9",fontWeight:700}}>{cat}</span><span style={{color:"#64748b"}}> · {age} ans</span></div>);})()}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editAth.weight} onChange={e=>setEditAth(p=>({...p,weight:e.target.value}))}/></FF>
              <FF label="Bateau"><select style={S.inp} value={editAth.boat||"1x"} onChange={e=>setEditAth(p=>({...p,boat:e.target.value}))}>{["1x","2x","2-","4x","4-","4+","8+"].map(b=><option key={b}>{b}</option>)}</select></FF>
            </div>
            <div style={{marginTop:12,padding:"12px",background:"#111827",borderRadius:8,border:"1px solid #334155"}}><div style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📏 Données morphologiques</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <FF label="Taille (cm)"><input style={S.inp} type="number" value={editAth.taille||""} onChange={e=>setEditAth(p=>({...p,taille:e.target.value}))} placeholder="ex: 185"/></FF>
              <FF label="Envergure (cm)"><input style={S.inp} type="number" value={editAth.envergure||""} onChange={e=>setEditAth(p=>({...p,envergure:e.target.value}))} placeholder="ex: 190"/></FF>
              <FF label="Longueur bras (cm)"><input style={S.inp} type="number" value={editAth.longueur_bras||""} onChange={e=>setEditAth(p=>({...p,longueur_bras:e.target.value}))} placeholder="épaule-poignet"/></FF>
              <FF label="Largeur épaules (cm)"><input style={S.inp} type="number" value={editAth.largeur_epaules||""} onChange={e=>setEditAth(p=>({...p,largeur_epaules:e.target.value}))} placeholder="ex: 46"/></FF>
              <FF label="Taille assise (cm)"><input style={S.inp} type="number" value={editAth.taille_assise||""} onChange={e=>setEditAth(p=>({...p,taille_assise:e.target.value}))} placeholder="ex: 96"/></FF>
            </div></div>
            <div style={{display:"flex",gap:10,marginTop:12}}>
              <button style={{...S.btnP,flex:1}} onClick={saveEditAth}>Enregistrer</button>
              <button style={{...S.btnP,background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430"}} onClick={()=>{if(window.confirm(`Supprimer la fiche de ${editAth.name} ?`))deleteAth(editAth.id);}}>🗑️ Supprimer</button>
            </div>
          </Modal>}
        </div>)}

        {tab==="performances"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Performances</h1><p style={S.sub}>Vue globale</p></div><button style={S.btnP} onClick={()=>{setNP(p=>({...p,athleteId:selAth||""}));setShowAddPerf(true);}}>+ Ajouter</button></div>          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            <button style={{...S.fb,...(selAth===null?S.fbon:{})}} onClick={()=>setSelAth(null)}>Tous</button>
            {athletes.map(a=><button key={a.id} style={{...S.fb,...(selAth===a.id?S.fbon:{})}} onClick={()=>setSelAth(a.id)}>{a.name}</button>)}
          </div>
          {selAth&&(()=>{const a=athletes.find(x=>x.id===selAth);if(!a)return null;const perfs=getPerfFor(selAth),best=getBestTime(perfs),last=getLastPerf(perfs),wpkg=last&&a.weight?(last.watts/a.weight).toFixed(2):null;return(<div style={{...S.card,display:"flex",alignItems:"center",gap:16,marginBottom:16}}><div style={S.av}>{a.avatar}</div><div style={{flex:1}}><div style={{fontSize:18,fontWeight:800,color:"#f1f5f9"}}>{a.name}</div><div style={{color:"#7a95b0",fontSize:13}}>{a.category} - {a.weight}kg - {a.boat}</div></div><button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>setEditAth({...a})}>✏️ Edit</button><div style={{display:"flex",gap:10}}><div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"10px 16px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2k</div><div style={{color:"#4ade80",fontWeight:900,fontSize:22}}>{best?.time??"-"}</div></div><div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"10px 16px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:22}}>{wpkg??"-"}</div></div></div></div>);})()}
          <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
              <thead><tr>{["Athlète","Date","2000m","Best 2k","W/kg","Watts","SPM","FC","RPE","Km",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{performances.filter(p=>selAth===null||p.athlete_id===selAth).sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{const a=athletes.find(x=>x.id===p.athlete_id);const best=getBestTime(getPerfFor(p.athlete_id));return(<tr key={p.id} style={{borderBottom:"1px solid #1e293b"}}><td style={S.td}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:28,height:28,fontSize:11}}>{a?.avatar}</div>{a?.name}</div></td><td style={{...S.td,color:"#7a95b0"}}>{p.date}</td><td style={{...S.td,color:"#0ea5e9",fontWeight:700}}>{p.time}</td><td style={{...S.td,color:"#4ade80",fontWeight:700}}>{best?.time??"-"}</td><td style={{...S.td,color:"#a78bfa",fontWeight:700}}>{a&&a.weight?(p.watts/a.weight).toFixed(2):"--"}</td><td style={{...S.td,color:"#0ea5e9"}}>{p.watts}W</td><td style={S.td}>{p.spm}</td><td style={{...S.td,color:"#ef4444"}}>{p.hr}</td><td style={S.td}><div style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff"}}>{p.rpe}/10</div></td><td style={{...S.td,color:"#f97316"}}>{p.distance}km</td><td style={S.td}><button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={async()=>{await api.deletePerf(p.id);load();setToast({m:"Performance supprimée",t:"success"});}}>X</button></td></tr>);})}
              </tbody>
            </table>
          </div>
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Athlète"><select style={S.inp} value={newPerf.athleteId} onChange={e=>setNP(p=>({...p,athleteId:e.target.value}))}><option value="">Sélectionner...</option>{athletes.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></FF>
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
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>{athletes.map(a=>{const on=compareIds.includes(a.id);return(<button key={a.id} style={{...S.fb,...(on?{background:"#22d3ee20",border:"1px solid #22d3ee60",color:"#0ea5e9"}:{})}} onClick={()=>setCompareIds(prev=>prev.includes(a.id)?(prev.length>2?prev.filter(x=>x!==a.id):prev):prev.length<4?[...prev,a.id]:prev)}>{on?"v ":""}{a.name}</button>);})}</div>
          {compareIds.length>=2&&(()=>{
            const cmp=compareIds.map(id=>{const a=athletes.find(x=>x.id===id);const perfs=getPerfFor(id),last=getLastPerf(perfs),best=getBestTime(perfs);return{...a,last,best,wpkg:last&&a.weight?(last.watts/a.weight).toFixed(2):null,perfs};});
            const rows=[{label:"Meilleur 2k",fn:c=>c.best?.time??"--",bfn:c=>c.best?timeToSeconds(c.best.time):9999,lower:true,c:"#4ade80"},{label:"Puissance",fn:c=>c.last?`${c.last.watts}W`:"--",bfn:c=>c.last?.watts||0,lower:false,c:"#0ea5e9"},{label:"W/kg",fn:c=>c.wpkg??"-",bfn:c=>parseFloat(c.wpkg)||0,lower:false,c:"#a78bfa"},{label:"SPM",fn:c=>c.last?.spm??"--",bfn:c=>c.last?.spm||0,lower:false,c:"#f59e0b"},{label:"Sessions",fn:c=>c.perfs.length,bfn:c=>c.perfs.length,lower:false,c:"#f97316"}];
            return(<>
              <div style={{display:"grid",gridTemplateColumns:`140px repeat(${cmp.length},1fr)`,gap:2,marginBottom:2}}><div/>{cmp.map((c,i)=><div key={c.id} style={{...S.card,textAlign:"center",borderTop:`3px solid ${CMP_COLORS[i]}`,padding:"12px 8px"}}><div style={{...S.av,margin:"0 auto 8px",border:`2px solid ${CMP_COLORS[i]}`}}>{c.avatar}</div><div style={{fontWeight:800,color:"#f1f5f9",fontSize:13}}>{c.name}</div><div style={{color:"#7a95b0",fontSize:11}}>{c.category}</div></div>)}</div>
              {rows.map(row=>{const bests=cmp.map(c=>row.bfn(c)),bestVal=row.lower?Math.min(...bests):Math.max(...bests),barMax=row.lower?Math.max(...bests):bestVal;return(<div key={row.label} style={{display:"grid",gridTemplateColumns:`140px repeat(${cmp.length},1fr)`,gap:2,marginBottom:2}}><div style={{display:"flex",alignItems:"center",color:"#7a95b0",fontSize:13,fontWeight:600,paddingLeft:8}}>{row.label}</div>{cmp.map((c,i)=>{const val=row.bfn(c),isBest=val===bestVal,barVal=row.lower?barMax-val+Math.min(...bests):val;return(<div key={c.id} style={{...S.card,padding:"10px 12px",background:isBest?"#22d3ee08":"#182030"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{color:isBest?row.c:"#a8bfd4",fontWeight:isBest?900:600,fontSize:15,minWidth:80}}>{row.fn(c)}{isBest?" *":""}</div><div style={{flex:1,height:5,background:"#263547",borderRadius:3,overflow:"hidden"}}><div style={{width:`${barMax?Math.min((barVal/barMax)*100,100):0}%`,height:"100%",background:CMP_COLORS[i],borderRadius:3}}/></div></div></div>);})}</div>);})}
            </>);
          })()}
        </div>)}

        {tab==="crew"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Équipages</h1><p style={S.sub}>Composer et assigner</p></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div>
              <div style={S.st}>+ Créer un équipage</div>
              <div style={S.card}>
                <FF label="Nom"><input style={S.inp} value={crewName} onChange={e=>setCrewName(e.target.value)}/></FF>
                <FF label="Bateau"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.keys(CREW_SLOTS).map(b=><button key={b} style={{...S.fb,...(crewBoat===b?S.fbon:{})}} onClick={()=>{setCrewBoat(b);setNewCrewMembers([]);}}>{b}</button>)}</div></FF>
                <div style={{color:"#7a95b0",fontSize:12,marginBottom:10}}>Rameurs ({newCrewMembers.length}/{CREW_SLOTS[crewBoat]||4})</div>
                <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto"}}>
                  {athletes.map(a=>{const sel=newCrewMembers.includes(a.id),full=newCrewMembers.length>=(CREW_SLOTS[crewBoat]||4)&&!sel,{last}=aStats(a);return(<div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:`1px solid ${sel?"#22d3ee44":"#263547"}`,background:sel?"#22d3ee08":"transparent",cursor:full?"not-allowed":"pointer",opacity:full?0.4:1}} onClick={()=>!full&&setNewCrewMembers(prev=>prev.includes(a.id)?prev.filter(x=>x!==a.id):[...prev,a.id])}><div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sel?"#0ea5e9":"#334155"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<div style={{width:7,height:7,borderRadius:"50%",background:"#0ea5e9"}}/>}</div><div style={{...S.av,width:28,height:28,fontSize:11,flexShrink:0}}>{a.avatar}</div><div style={{flex:1,fontSize:13,color:"#f1f5f9",fontWeight:600}}>{a.name}</div>{last&&<div style={{color:"#0ea5e9",fontSize:12}}>{last.watts}W</div>}</div>);})}
                </div>
                <button style={{...S.btnP,width:"100%",marginTop:12,opacity:!newCrewMembers.length?0.5:1}} onClick={saveNewCrew} disabled={!newCrewMembers.length}>Créer -></button>
              </div>
            </div>
            <div>
              <div style={S.st}>~ Équipages actifs ({crews.length})</div>
              {crews.map(cr=><div key={cr.id} style={{...S.card,marginBottom:12,borderTop:"3px solid #22d3ee"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <div style={{fontWeight:800,color:"#f1f5f9",fontSize:16}}>{cr.name}</div>
                  <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>{setEditCrew({...cr});setEditCrewMembers(getCrewMembersFor(cr.id).map(a=>a.id));}}>Modifier</button>
                </div>
                <div style={{color:"#7a95b0",fontSize:12,marginBottom:12}}>{cr.boat} - {getCrewMembersFor(cr.id).length} rameurs</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{getCrewMembersFor(cr.id).map(a=>{const{last,wpkg}=aStats(a);return(<div key={a.id} style={{background:"#263547",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:26,height:26,fontSize:10}}>{a.avatar}</div><div><div style={{color:"#f1f5f9",fontSize:12,fontWeight:600}}>{a.name.split(" ")[0]}</div>{last&&<div style={{color:"#0ea5e9",fontSize:10}}>{last.watts}W - {wpkg}W/kg</div>}</div></div>);})}</div>
              </div>)}
            </div>
          </div>
          {editCrew&&<Modal title={`Modifier -- ${editCrew.name}`} onClose={()=>setEditCrew(null)} wide>
            <FF label="Nom"><input style={S.inp} value={editCrew.name} onChange={e=>setEditCrew(p=>({...p,name:e.target.value}))}/></FF>
            <FF label="Bateau"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.keys(CREW_SLOTS).map(b=><button key={b} style={{...S.fb,...(editCrew.boat===b?S.fbon:{})}} onClick={()=>setEditCrew(p=>({...p,boat:b}))}>{b}</button>)}</div></FF>
            <div style={{color:"#7a95b0",fontSize:12,marginBottom:10}}>Rameurs ({editCrewMembers.length}/{CREW_SLOTS[editCrew.boat]||4})</div>
            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto",marginBottom:16}}>
              {athletes.map(a=>{const sel=editCrewMembers.includes(a.id),full=editCrewMembers.length>=(CREW_SLOTS[editCrew.boat]||4)&&!sel,{last}=aStats(a);return(<div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:"1px solid "+(sel?"#22d3ee44":"#263547"),background:sel?"#22d3ee08":"transparent",cursor:full?"not-allowed":"pointer",opacity:full?0.4:1}} onClick={()=>!full&&setEditCrewMembers(prev=>prev.includes(a.id)?prev.filter(x=>x!==a.id):[...prev,a.id])}><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid "+(sel?"#0ea5e9":"#334155"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<div style={{width:7,height:7,borderRadius:"50%",background:"#0ea5e9"}}/>}</div><div style={{...S.av,width:28,height:28,fontSize:11,flexShrink:0}}>{a.avatar}</div><div style={{flex:1,fontSize:13,color:"#f1f5f9",fontWeight:600}}>{a.name}</div>{last&&<div style={{color:"#0ea5e9",fontSize:12}}>{last.watts}W</div>}</div>);})}
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={saveEditCrew}>Enregistrer les modifications</button>
          </Modal>}
        </div>)}


        {tab==="boats"&&(<div style={S.page}>
          <div style={S.ph}>
            <div><h1 style={S.ttl}>Bateaux</h1><p style={S.sub}>{boats.length} bateaux - réglages par poste</p></div>
            <button style={S.btnP} onClick={()=>setShowAddBoat(true)}>+ Nouveau bateau</button>
          </div>

          {/* Liste bateaux */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:28}}>
            {boats.map(b=>{
              const linked=getBoatCrewsFor(b.id);
              const lastSetting=getSettingsFor(b.id)[0];
              return(
                <div key={b.id} style={{...S.card,cursor:"pointer",borderTop:`3px solid ${selBoat===b.id?"#0ea5e9":"#263547"}`,background:selBoat===b.id?"#22d3ee08":"#182030"}} onClick={()=>setSelBoat(selBoat===b.id?null:b.id)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontWeight:900,color:"#f1f5f9",fontSize:17}}>{b.name}</div>
                      <div style={{color:"#7a95b0",fontSize:12,marginTop:2}}>{b.brand} {b.model} - {b.seats} postes</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{...S.badge,background:b.type==="couple"?"#22d3ee20":"#a78bfa20",color:b.type==="couple"?"#0ea5e9":"#a78bfa",border:`1px solid ${b.type==="couple"?"#22d3ee40":"#a78bfa40"}`}}>{b.type==="couple"?"~ Couple":"~ Pointe"}</span>
                      <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={e=>{e.stopPropagation();setEditBoat({...b});}}>Edit</button>
                    </div>
                  </div>
                  {b.avg_buoyancy&&<div style={{color:"#f59e0b",fontSize:13,marginBottom:8}}>~ Portance moy. : {b.avg_buoyancy} kg</div>}
                  {linked.length>0&&<div style={{marginBottom:8}}>{linked.map(cr=><div key={cr.id} style={{color:"#0ea5e9",fontSize:12}}>~ {cr.name}</div>)}</div>}
                  {lastSetting&&<div style={{color:"#5a7a9a",fontSize:11}}>Dernier réglage : {lastSetting.date_reglage} - {lastSetting.regle_par}</div>}
                  {b.notes&&<div style={{background:"#1e293b50",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#a8bfd4",marginTop:8}}>{b.notes}</div>}
                  {(()=>{const st=getBoatStats(b.id);if(!st)return null;return(<div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>{st.avgWatts&&<span style={{...S.badge,background:"#22d3ee15",color:"#0ea5e9",border:"1px solid #22d3ee30"}}>{st.avgWatts}W moy.</span>}{st.avgWeight&&<span style={{...S.badge,background:"#a78bfa15",color:"#a78bfa",border:"1px solid #a78bfa30"}}>{st.avgWeight}kg moy.</span>}{st.avgTime&&<span style={{...S.badge,background:"#4ade8015",color:"#4ade80",border:"1px solid #4ade8030"}}>{st.avgTime} moy. 2k</span>}</div>);})()}
                </div>
              );
            })}
            {!boats.length&&<div style={{...S.card,textAlign:"center",color:"#5a7a9a",padding:"32px",gridColumn:"1/-1"}}>Aucun bateau enregistré</div>}
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
                <div style={S.st}>~ Équipages assignés à {boat.name}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
                  {crews.map(cr=>{
                    const linked=boatCrews.some(bc=>bc.boat_id===selBoat&&bc.crew_id===cr.id);
                    return(
                      <button key={cr.id} style={{...S.fb,...(linked?{background:"#22d3ee20",border:"1px solid #22d3ee60",color:"#0ea5e9"}:{})}} onClick={()=>toggleBoatCrew(selBoat,cr.id)}>
                        {linked?"v ":""}{cr.name} ({cr.boat})
                      </button>
                    );
                  })}
                </div>

                {/* Réglages par poste -- vue actuelle */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={S.st}>~ Réglages actuels -- {boat.name}</div>
                  <button style={S.btnP} onClick={()=>setShowAddSetting(true)}>+ Nouveau réglage</button>
                </div>
                <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b",marginBottom:28}}>
                  <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
                    <thead>
                      <tr>{["Poste","Rameur","Date","Réglé par","Entraxe","Long. pédale","Levier int.","Ndeg pelle","Type pelle","Observations"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {postes.map(s=>{
                        const ath=getAthleteAtPoste(selBoat,s.poste);
                        return(
                          <tr key={s.poste} style={{borderBottom:"1px solid #1e293b",background:s.empty?"#070d1a08":"#182030"}}>
                            <td style={{...S.td,fontWeight:900,color:"#0ea5e9",fontSize:18}}>#{s.poste}</td>
                            <td style={S.td}>
                              {ath?<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:28,height:28,fontSize:11}}>{ath.avatar}</div>{ath.name}</div>:<span style={{color:"#5a7a9a"}}>--</span>}
                            </td>
                            {s.empty?(
                              <td colSpan={8} style={{...S.td,color:"#334155",textAlign:"center",fontStyle:"italic"}}>Aucun réglage enregistré pour ce poste</td>
                            ):(
                              <>
                                <td style={{...S.td,color:"#7a95b0"}}>{s.date_reglage}</td>
                                <td style={S.td}>{s.regle_par||"--"}</td>
                                <td style={{...S.td,color:"#0ea5e9",fontWeight:700}}>{s.entraxe?`${s.entraxe} cm`:"--"}</td>
                                <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"--"}</td>
                                <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"--"}</td>
                                <td style={S.td}>{s.numero_pelle||"--"}</td>
                                <td style={S.td}>{s.type_pelle||"--"}</td>
                                <td style={{...S.td,color:"#a8bfd4",maxWidth:200}}>{s.observations||"--"}</td>
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
                  <div style={S.st}>~ Historique complet des réglages</div>
                  <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
                      <thead><tr>{["Poste","Date","Réglé par","Entraxe","Long. pédale","Levier int.","Ndeg pelle","Type pelle","Observations",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {allSettings.map(s=>(
                          <tr key={s.id} style={{borderBottom:"1px solid #1e293b"}}>
                            <td style={{...S.td,fontWeight:900,color:"#0ea5e9"}}>#{s.poste}</td>
                            <td style={{...S.td,color:"#7a95b0"}}>{s.date_reglage}</td>
                            <td style={S.td}>{s.regle_par||"--"}</td>
                            <td style={{...S.td,color:"#0ea5e9"}}>{s.entraxe?`${s.entraxe} cm`:"--"}</td>
                            <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"--"}</td>
                            <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"--"}</td>
                            <td style={S.td}>{s.numero_pelle||"--"}</td>
                            <td style={S.td}>{s.type_pelle||"--"}</td>
                            <td style={{...S.td,color:"#a8bfd4"}}>{s.observations||"--"}</td>
                            <td style={S.td}><button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={async()=>{await api.deleteBoatSetting(s.id);load();setToast({m:"Réglage supprimé",t:"success"});}}>X</button></td>
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
              <FF label="Type"><select style={S.inp} value={newBoat.type} onChange={e=>setNB(p=>({...p,type:e.target.value}))}><option value="couple">~ Couple</option><option value="pointe">~ Pointe</option></select></FF>
              <FF label="Portance moyenne (kg)"><input style={S.inp} type="number" value={newBoat.avg_buoyancy} onChange={e=>setNB(p=>({...p,avg_buoyancy:e.target.value}))} placeholder="ex: 82"/></FF>
              <FF label="Marque"><input style={S.inp} value={newBoat.brand} onChange={e=>setNB(p=>({...p,brand:e.target.value}))} placeholder="ex: Filippi"/></FF>
              <FF label="Modèle"><input style={S.inp} value={newBoat.model} onChange={e=>setNB(p=>({...p,model:e.target.value}))} placeholder="ex: F50"/></FF>
            </div>
            <FF label="Notes générales"><textarea style={{...S.inp,height:72,resize:"vertical"}} value={newBoat.notes} onChange={e=>setNB(p=>({...p,notes:e.target.value}))}/></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addBoat}>Créer le bateau</button>
          </Modal>}

          {/* Modal édition bateau */}
          {editBoat&&<Modal title={`Éditer -- ${editBoat.name}`} onClose={()=>setEditBoat(null)} wide>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Nom"><input style={S.inp} value={editBoat.name} onChange={e=>setEditBoat(p=>({...p,name:e.target.value}))}/></FF>
              <FF label="Postes"><input style={S.inp} type="number" min="1" max="8" value={editBoat.seats} onChange={e=>setEditBoat(p=>({...p,seats:e.target.value}))}/></FF>
              <FF label="Type"><select style={S.inp} value={editBoat.type} onChange={e=>setEditBoat(p=>({...p,type:e.target.value}))}><option value="couple">~ Couple</option><option value="pointe">~ Pointe</option></select></FF>
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
              <Modal title={`Nouveau réglage -- ${boat?.name}`} onClose={()=>setShowAddSetting(false)} wide>
                {(()=>{
                  const posteAth = getAthleteAtPoste(selBoat, newSetting.poste);
                  const rigging = posteAth ? suggestRigging(posteAth, newSetting.type_pelle||"Smoothie 2", boat?.type||"couple") : null;
                  return rigging ? (
                    <div style={{marginBottom:16,padding:"14px 16px",background:"#0ea5e908",border:"1px solid #0ea5e930",borderRadius:10}}>
                      <div style={{color:"#0ea5e9",fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                        Suggestions pour {posteAth.name}
                        <span style={{fontSize:10,background:"#0ea5e920",padding:"2px 8px",borderRadius:10}}>morpho disponible</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:10}}>
                        {rigging.suggestions.entraxe&&<div style={{background:"#182030",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>Entraxe</div><div style={{color:"#0ea5e9",fontWeight:700,fontSize:16}}>{rigging.suggestions.entraxe} cm</div></div>}
                        {rigging.suggestions.levier_interieur&&<div style={{background:"#182030",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>Levier int.</div><div style={{color:"#a78bfa",fontWeight:700,fontSize:16}}>{rigging.suggestions.levier_interieur} cm</div></div>}
                        {rigging.suggestions.levier_exterieur&&<div style={{background:"#182030",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>Levier ext.</div><div style={{color:"#f59e0b",fontWeight:700,fontSize:16}}>{rigging.suggestions.levier_exterieur} cm</div></div>}
                        {rigging.suggestions.longueur_pedale&&<div style={{background:"#182030",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>Long. pédale</div><div style={{color:"#4ade80",fontWeight:700,fontSize:16}}>{rigging.suggestions.longueur_pedale} cm</div></div>}
                        {rigging.suggestions.croisement&&<div style={{background:"#182030",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>Croisement</div><div style={{color:"#f97316",fontWeight:700,fontSize:16}}>{rigging.suggestions.croisement} cm</div></div>}
                      </div>
                      <button style={{...S.btnP,fontSize:11,padding:"6px 14px",background:"#0ea5e920",color:"#0ea5e9",border:"1px solid #0ea5e940"}} onClick={()=>{const sg=rigging.suggestions;setNS(p=>({...p,...(sg.entraxe?{entraxe:sg.entraxe}:{}),...(sg.levier_interieur?{levier_interieur:sg.levier_interieur}:{}),...(sg.levier_exterieur?{levier_exterieur:sg.levier_exterieur}:{}),...(sg.longueur_pedale?{longueur_pedale:sg.longueur_pedale}:{}),...(sg.croisement?{croisement:sg.croisement}:{})}));}}>Appliquer ces valeurs</button>
                      <div style={{marginTop:8}}>{rigging.notes.map((n,i)=><div key={i} style={{color:"#64748b",fontSize:11}}>• {n}</div>)}</div>
                    </div>
                  ) : posteAth ? (
                    <div style={{marginBottom:16,padding:"10px 14px",background:"#111827",border:"1px solid #334155",borderRadius:8,color:"#64748b",fontSize:12}}>
                      Athlète: <strong style={{color:"#f1f5f9"}}>{posteAth.name}</strong> — Ajoute ses données morpho dans sa fiche pour obtenir des suggestions de réglage.
                    </div>
                  ) : null;
                })()}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <FF label="Poste">
                    <select style={S.inp} value={newSetting.poste} onChange={e=>setNS(p=>({...p,poste:+e.target.value}))}>
                      {Array.from({length:boat?.seats||4},(_,i)=><option key={i+1} value={i+1}>Poste #{i+1}{getAthleteAtPoste(selBoat,i+1)?` -- ${getAthleteAtPoste(selBoat,i+1).name}`:""}</option>)}
                    </select>
                  </FF>
                  <FF label="Date"><input style={S.inp} type="date" value={newSetting.date_reglage} onChange={e=>setNS(p=>({...p,date_reglage:e.target.value}))}/></FF>
                  <FF label="Réglé par"><input style={S.inp} value={newSetting.regle_par} onChange={e=>setNS(p=>({...p,regle_par:e.target.value}))} placeholder="Nom du coach"/></FF>
                  <FF label="Entraxe (cm)"><input style={S.inp} type="number" value={newSetting.entraxe} onChange={e=>setNS(p=>({...p,entraxe:e.target.value}))}/></FF>
                  <FF label="Longueur pédale (cm)"><input style={S.inp} type="number" value={newSetting.longueur_pedale} onChange={e=>setNS(p=>({...p,longueur_pedale:e.target.value}))}/></FF>
                  <FF label="Levier intérieur (cm)"><input style={S.inp} type="number" value={newSetting.levier_interieur} onChange={e=>setNS(p=>({...p,levier_interieur:e.target.value}))}/></FF>
                  <FF label="Levier extérieur (cm)"><input style={S.inp} type="number" value={newSetting.levier_exterieur} onChange={e=>setNS(p=>({...p,levier_exterieur:e.target.value}))}/></FF>
                  <FF label="Croisement (cm)"><input style={S.inp} type="number" value={newSetting.croisement} onChange={e=>setNS(p=>({...p,croisement:e.target.value}))}/></FF>
                  <FF label="Ndeg pelle"><input style={S.inp} value={newSetting.numero_pelle} onChange={e=>setNS(p=>({...p,numero_pelle:e.target.value}))}/></FF>
                  <FF label="Type de pelle"><select style={S.inp} value={newSetting.type_pelle} onChange={e=>setNS(p=>({...p,type_pelle:e.target.value}))}><option value="">-- Choisir --</option>{BLADE_TYPES.map(b=><option key={b} value={b}>{b}</option>)}</select></FF>
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
            {sessions.map(s=>(
              <div key={s.id} style={{...S.card}}>
                <div style={{fontWeight:800,fontSize:16,color:"#f1f5f9"}}>{s.day}</div>
                <div style={{color:"#7a95b0",fontSize:12}}>{s.date}</div>
                <div style={{color:"#a8bfd4",fontSize:13}}>{s.type}</div>
                {s.duration&&<div style={{color:"#a8bfd4",fontSize:13}}>{s.duration}</div>}
              </div>
            ))}
          </div>
        </div>)}
      </div>
    </div>
  );
}

// ==========================================================================================================================================================
// ATHLETE SPACE
// ==========================================================================================================================================================
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
    setToast({m:"Fiche mise à jour v",t:"success"}); load(); setEditing(false);
  }
  async function addPerf() {
    await api.createPerf({athlete_id:currentUser.athlete_id,date:newPerf.date,time:newPerf.time,watts:+newPerf.watts,spm:+newPerf.spm,hr:+newPerf.hr,rpe:+newPerf.rpe,distance:+newPerf.distance});
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
              <div style={{flex:1}}><div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{athlete.name}</div><div style={{color:"#7a95b0",fontSize:14,marginTop:2}}>{athlete.category} - {athlete.boat} - {athlete.age}ans - {athlete.weight}kg</div></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"12px 18px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best 2000m</div><div style={{color:"#4ade80",fontWeight:900,fontSize:26}}>{best?.time??"--"}</div><div style={{color:"#5a7a9a",fontSize:11}}>{best?.date??""}</div></div>
                <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"12px 18px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:26}}>{wpkg??"--"}</div><div style={{color:"#5a7a9a",fontSize:11}}>{last?.watts}W - {athlete.weight}kg</div></div>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
            {[{l:"Sessions",v:myPerfs.length,c:"#0ea5e9",ic:"*"},{l:"Dernière puiss.",v:last?`${last.watts}W`:"--",c:"#a78bfa",ic:"~"},{l:"Km cumulés",v:`${myPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"~"},{l:"Équipage",v:myCrew?.name??"--",c:"#4ade80",ic:"~"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:18,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
          </div>
          <div style={S.st}>Dernières performances</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {[...myPerfs].reverse().slice(0,4).map(p=><div key={p.id} style={{...S.card,display:"flex",alignItems:"center",gap:16,padding:"12px 18px"}}><div style={{color:"#7a95b0",fontSize:12,minWidth:90}}>{p.date}</div><div style={{color:"#4ade80",fontWeight:700,fontSize:16,minWidth:55}}>{p.time}</div><div style={{color:"#0ea5e9",fontWeight:700}}>{p.watts}W</div><div style={{color:"#f59e0b"}}>{p.spm} spm</div><div style={{color:"#ef4444"}}>{p.hr} bpm</div><div style={{marginLeft:"auto",color:"#f97316",fontSize:12}}>{p.distance}km</div><div style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff"}}>{p.rpe}/10</div></div>)}
            {!myPerfs.length&&<div style={{...S.card,textAlign:"center",color:"#5a7a9a",padding:"28px"}}>Aucune performance</div>}
          </div>
          <button style={{...S.btnP,background:"#a78bfa",color:"#0f1923"}} onClick={()=>setShowAddPerf(true)}>+ Ajouter une performance</button>
          {editing&&<Modal title="Éditer ma fiche" onClose={()=>setEditing(false)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Âge"><input style={S.inp} type="number" value={editForm.age} onChange={e=>setEditForm(p=>({...p,age:e.target.value}))}/></FF>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editForm.weight} onChange={e=>setEditForm(p=>({...p,weight:e.target.value}))}/></FF>
            </div>
            <FF label="Bateau"><select style={S.inp} value={editForm.boat} onChange={e=>setEditForm(p=>({...p,boat:e.target.value}))}>{["1x","2x","2-","4x","4-","4+","8+"].map(b=><option key={b}>{b}</option>)}</select></FF>
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#0f1923"}} onClick={saveEdit}>Enregistrer</button>
          </Modal>}
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Temps 2000m"><input style={S.inp} placeholder="6:45" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
              <FF label="Watts"><input style={S.inp} type="number" value={newPerf.watts} onChange={e=>setNP(p=>({...p,watts:e.target.value}))}/></FF>
              <FF label="SPM"><input style={S.inp} type="number" value={newPerf.spm} onChange={e=>setNP(p=>({...p,spm:e.target.value}))}/></FF>
              <FF label="FC (bpm)"><input style={S.inp} type="number" value={newPerf.hr} onChange={e=>setNP(p=>({...p,hr:e.target.value}))}/></FF>
              <FF label="RPE (1-10)"><input style={S.inp} type="number" min="1" max="10" value={newPerf.rpe} onChange={e=>setNP(p=>({...p,rpe:e.target.value}))}/></FF>
              <FF label="Distance (km)"><input style={S.inp} type="number" value={newPerf.distance} onChange={e=>setNP(p=>({...p,distance:e.target.value}))}/></FF>
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"#a78bfa",color:"#0f1923"}} onClick={addPerf}>Enregistrer</button>
          </Modal>}
        </div>)}
        {tab==="stats"&&(<div style={S.page}>
          <div style={S.ph}><div><h1 style={S.ttl}>Mes Stats</h1><p style={S.sub}>Progression</p></div></div>
          {myPerfs.length<2?<div style={{...S.card,textAlign:"center",padding:"40px",color:"#5a7a9a"}}>Ajoute au moins 2 sessions pour voir ta progression.</div>:(<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
              {[{l:"Best 2k",v:best?.time??"--",c:"#4ade80",ic:"~"},{l:"Record watts",v:`${Math.max(...myPerfs.map(p=>p.watts))}W`,c:"#0ea5e9",ic:"~"},{l:"W/kg actuel",v:wpkg??"--",c:"#a78bfa",ic:"~"},{l:"SPM moyen",v:Math.round(avg(myPerfs.map(p=>p.spm))),c:"#f59e0b",ic:"~"},{l:"FC moyenne",v:`${Math.round(avg(myPerfs.map(p=>p.hr)))}bpm`,c:"#ef4444",ic:"~"},{l:"Km totaux",v:`${myPerfs.reduce((s,p)=>s+(p.distance||0),0)}km`,c:"#f97316",ic:"~"}].map((k,i)=><div key={i} style={S.kpi}><div style={{color:k.c,fontSize:20,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:22,fontWeight:900}}>{k.v}</div><div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[{l:"Puissance",vals:myPerfs.map(p=>p.watts),c:"#0ea5e9",hi:true},{l:"Temps 2k (s)",vals:myPerfs.map(p=>timeToSeconds(p.time)),c:"#4ade80",hi:false,disp:v=>secondsToTime(v)},{l:"W/kg",vals:myPerfs.map(p=>+(p.watts/(athlete.weight||1)).toFixed(2)),c:"#a78bfa",hi:true},{l:"SPM",vals:myPerfs.map(p=>p.spm),c:"#f59e0b",hi:true},{l:"FC",vals:myPerfs.map(p=>p.hr),c:"#ef4444",hi:false},{l:"Distance",vals:myPerfs.map(p=>p.distance||0),c:"#f97316",hi:true}].map(m=>{const lv=m.vals[m.vals.length-1],pv=m.vals[m.vals.length-2],diff=lv-pv,up=m.hi?diff>0:diff<0;return(<div key={m.l} style={S.mc}><div style={{color:"#7a95b0",fontSize:12,marginBottom:6}}>{m.l}</div><div style={{color:m.c,fontSize:22,fontWeight:900}}>{m.disp?m.disp(lv):lv}</div><div style={{color:up?"#4ade80":"#ef4444",fontSize:12,marginBottom:8}}>{up?"^":"v"} {Math.abs(diff)}</div><Sparkline data={m.vals} color={m.c} invert={!m.hi}/></div>);})}
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
                    {l:"Long. pédale",v:lastSetting.longueur_pedale?`${lastSetting.longueur_pedale} cm`:"--",c:"#a78bfa"},
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
                    <thead><tr>{["Date","Réglé par","Entraxe","Long. pédale","Levier int.","Ndeg pelle","Type pelle","Observations"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
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
export default function App() {
  const [session, setSession] = useState(null);
  if(!session) return <Login onLogin={setSession}/>;
  if(session.role==="admin")   return <AdminSpace currentUser={session} onLogout={()=>setSession(null)}/>;
  if(session.role==="coach")   return <CoachSpace   currentUser={session} onLogout={()=>setSession(null)}/>;
  return <AthleteSpace currentUser={session} onLogout={()=>setSession(null)}/>;
}

const S={
  root:      {display:"flex",minHeight:"100vh",background:"#111827",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,sans-serif",color:"#e2e8f0"},
  sidebar:   {width:240,minWidth:240,background:"#1e293b",borderRight:"1px solid #334155",display:"flex",flexDirection:"column",padding:"20px 0 0",position:"sticky",top:0,height:"100vh",flexShrink:0},
  logo:      {display:"flex",alignItems:"center",gap:12,padding:"0 16px 20px",borderBottom:"1px solid #334155",marginBottom:12},
  logoT:     {fontSize:15,fontWeight:800,color:"#38bdf8",letterSpacing:0.5},
  logoS:     {fontSize:10,color:"#64748b",letterSpacing:2,textTransform:"uppercase"},
  nb:        {display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",borderRadius:9,border:"none",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left",marginBottom:3,fontFamily:"inherit",transition:"all 0.15s"},
  nba:       {background:"#38bdf818",color:"#38bdf8",fontWeight:700},
  main:      {flex:1,minHeight:"100vh",overflowY:"auto",background:"#111827",minWidth:0},
  page:      {padding:"32px 36px",maxWidth:"100%"},
  ph:        {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32},
  ttl:       {fontSize:28,fontWeight:800,color:"#f8fafc",margin:0},
  sub:       {color:"#64748b",fontSize:14,marginTop:4},
  btnP:      {background:"#0ea5e9",color:"#fff",border:"none",padding:"10px 20px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"},
  kpi:       {background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"20px 16px",textAlign:"center"},
  st:        {fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14},
  topCard:   {background:"#1e293b",border:"1px solid #334155",borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"},
  card:      {background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"20px"},
  av:        {width:44,height:44,borderRadius:"50%",background:"#0ea5e915",border:"1px solid #0ea5e930",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#0ea5e9",fontSize:15,flexShrink:0},
  badge:     {fontSize:11,borderRadius:6,padding:"3px 10px",fontWeight:600,display:"inline-block"},
  fb:        {background:"#1e293b",border:"1px solid #334155",color:"#64748b",padding:"7px 16px",borderRadius:20,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:500},
  fbon:      {background:"#0ea5e915",border:"1px solid #0ea5e944",color:"#0ea5e9"},
  mc:        {background:"#1e293b",border:"1px solid #334155",borderRadius:10,padding:"16px 14px"},
  th:        {padding:"12px 16px",color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:1,textAlign:"left",borderBottom:"1px solid #334155",fontWeight:600,background:"#172033"},
  td:        {padding:"13px 16px",fontSize:14,color:"#cbd5e1"},
  overlay:   {position:"fixed",inset:0,background:"#00000099",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"},
  modal:     {background:"#1e293b",border:"1px solid #334155",borderRadius:16,padding:"32px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px #00000060"},
  inp:       {width:"100%",background:"#111827",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",color:"#f1f5f9",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"},
  actionBtn: {background:"transparent",border:"1px solid",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"},
};