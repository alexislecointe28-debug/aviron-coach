import { useState, useEffect } from "react";
import { ROLE_COLORS, ROLE_LABELS, ROLE_ICONS, S } from "../styles.js";
import { api } from "../config/supabase.js";
import { FF, Modal, Toast } from "./ui.jsx";

export default function AdminSpace({ currentUser, onLogout }) {
  const [users,setUsers]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [tab,setTab]         = useState("users");
  const [filterRole,setFilterRole] = useState("all");
  const [showAdd,setShowAdd] = useState(false);
  const [editUser,setEditUser]= useState(null);
  const [confirm,setConfirm] = useState(null);
  const [toast,setToast]     = useState(null);
  const [newUser,setNU]      = useState({name:"",email:"",password:"",role:"athlete"});
  const [codes,setCodes]     = useState([]);
  const [showAddCode,setShowAddCode] = useState(false);
  const [newCode,setNewCode] = useState({code:"",role:"athlete",max_uses:"",active:true});

  const load = useCallback(async()=>{
    setLoading(true);
    const [u,c] = await Promise.all([api.getUsers(), api.getInviteCodes().catch(()=>[])]);
    setUsers(u); setCodes(c);
    setLoading(false);
  },[]);
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

  async function addCode() {
    if(!newCode.code.trim()) return;
    try {
      await api.createInviteCode({code:newCode.code.trim().toUpperCase(),role:newCode.role,max_uses:newCode.max_uses?+newCode.max_uses:null,uses_count:0,active:true});
      setToast({m:"Code créé ✓",t:"success"}); load();
      setNewCode({code:"",role:"athlete",max_uses:"",active:true}); setShowAddCode(false);
    } catch(e){ setToast({m:"Erreur: "+e.message,t:"error"}); }
  }
  async function toggleCode(id, active) {
    await api.updateInviteCode(id,{active:!active}); load();
    setToast({m:active?"Code désactivé":"Code activé",t:"success"});
  }
  async function deleteCode(id) {
    await api.deleteInviteCode(id); load();
    setToast({m:"Code supprimé",t:"success"});
  }
  async function resetCode(id) {
    await api.updateInviteCode(id,{uses_count:0}); load();
    setToast({m:"Compteur remis à zéro",t:"success"});
  }

  const filtered = filterRole==="all"?users:users.filter(u=>u.role===filterRole);
  const counts   = { admin:users.filter(u=>u.role==="admin").length, coach:users.filter(u=>u.role==="coach").length, athlete:users.filter(u=>u.role==="athlete").length };

  return (
    <div style={S.root}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={{...S.sidebar,borderColor:"#3a2a0a"}}>
        <div style={{...S.logo,borderColor:"#3a2a0a"}}><span style={{fontSize:28}}>~</span><div><div style={{...S.logoT,color:"#f59e0b"}}>AvironCoach</div><div style={S.logoS}>Super Admin</div></div></div>
        <nav style={{flex:1,padding:"8px 12px"}}>
          {[{id:"users",label:"Comptes",icon:"o"},{id:"codes",label:"Codes invit.",icon:"#"},{id:"stats",label:"Vue globale",icon:"*"}].map(n=>(
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
