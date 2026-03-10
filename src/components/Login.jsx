import { useState } from "react";
import { S } from "../styles.js";
import { api, sb, SUPABASE_URL, SUPABASE_KEY } from "../config/supabase.js";
import { FF } from "./ui.jsx";

export default function Login({ onLogin }) {
  const [mode,setMode]=useState("login"); // "login" | "register"
  const [email,setEmail]=useState(""); const [pwd,setPwd]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const [reg,setReg]=useState({name:"",email:"",password:"",password2:"",code:""});
  const [regOk,setRegOk]=useState(false);

  async function login() {
    setErr(""); setLoading(true);
    try {
      const results = await api.loginUser(email, pwd);
      if(results.length>0) onLogin(results[0]);
      else setErr("Email ou mot de passe incorrect, ou compte désactivé.");
    } catch(e) { setErr("Erreur de connexion. Vérifie ta configuration Supabase."); }
    setLoading(false);
  }

  async function register() {
    setErr("");
    if(!reg.name||!reg.email||!reg.password||!reg.code) { setErr("Tous les champs sont requis."); return; }
    if(reg.password!==reg.password2) { setErr("Les mots de passe ne correspondent pas."); return; }
    if(reg.password.length<6) { setErr("Mot de passe trop court (6 caractères minimum)."); return; }
    setLoading(true);
    try {
      // Vérifier le code d'invitation
      const codes = await api.checkInviteCode(reg.code.trim().toUpperCase());
      if(!codes||codes.length===0) { setErr("Code d'invitation invalide ou expiré."); setLoading(false); return; }
      const inviteCode = codes[0];
      if(inviteCode.max_uses && inviteCode.uses_count >= inviteCode.max_uses) { setErr("Ce code d'invitation a atteint sa limite d'utilisation."); setLoading(false); return; }
      // Créer le compte dans la table users (ancien système compatible)
      const role = inviteCode.role || "athlete";
      const existList = await sb(`users?email=eq.${encodeURIComponent(reg.email)}&select=id`);
      if(existList.length>0) { setErr("Un compte avec cet email existe déjà."); setLoading(false); return; }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Prefer":"return=representation"},
        body:JSON.stringify({name:reg.name,email:reg.email,password:reg.password,role,active:true,athlete_id:null})
      });
      if(!res.ok) throw new Error("Erreur création compte");
      const newUser = await res.json();
      // Si athlète → créer automatiquement la fiche athlète et lier
      if(role==="athlete" && newUser && newUser[0]) {
        try {
          const AVATARS=["🚣","🏅","💪","⚡","🌊","🎯"];
          const ath = await api.createAthlete({
            name: reg.name,
            category: "Senior",
            weight: 0,
            age: 0,
            boat: "1x",
            avatar: AVATARS[Math.floor(Math.random()*AVATARS.length)],
            active: true
          });
          if(ath && ath[0]) {
            await api.updateUser(newUser[0].id, {athlete_id: ath[0].id});
          }
        } catch(e) { console.warn("Athlete auto-create:", e); }
      }
      // Incrémenter uses_count
      await api.updateInviteCode(inviteCode.id,{uses_count:(inviteCode.uses_count||0)+1});
      setRegOk(true);
    } catch(e) { setErr("Erreur : "+e.message); }
    setLoading(false);
  }

  const logoBlock = (
    <div style={{textAlign:"center",marginBottom:48}}>
      <div style={{fontSize:52,marginBottom:12}}>~</div>
      <div style={{fontSize:22,fontWeight:900,color:"#0ea5e9",letterSpacing:1}}>AvironCoach</div>
      <div style={{fontSize:11,color:"#5a7a9a",letterSpacing:3,textTransform:"uppercase",marginTop:4}}>Performance Track</div>
    </div>
  );

  if(regOk) return (
    <div style={{minHeight:"100vh",width:"100%",background:"#0f1923",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif"}}>
      <div style={{width:420}}>{logoBlock}
        <div style={{background:"#182030",border:"1px solid #1e293b",borderRadius:16,padding:"36px 32px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:16}}>✓</div>
          <div style={{fontSize:18,fontWeight:800,color:"#4ade80",marginBottom:8}}>Compte créé !</div>
          <div style={{color:"#7a95b0",fontSize:14,marginBottom:24}}>Tu peux maintenant te connecter avec ton email et ton mot de passe.</div>
          <button style={{...S.btnP,width:"100%",padding:"12px"}} onClick={()=>{setMode("login");setRegOk(false);setEmail(reg.email);}}>Se connecter →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",width:"100%",background:"#0f1923",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif"}}>
      <div style={{width:420}}>{logoBlock}
        <div style={{background:"#182030",border:"1px solid #1e293b",borderRadius:16,padding:"36px 32px"}}>
          {/* Toggle login/register */}
          <div style={{display:"flex",gap:0,marginBottom:28,background:"#111827",borderRadius:10,padding:3}}>
            {[["login","Connexion"],["register","Créer un compte"]].map(([m,l])=>(
              <button key={m} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.15s",
                background:mode===m?"#0ea5e9":"transparent",color:mode===m?"#fff":"#5a7a9a",fontFamily:"inherit"}}
                onClick={()=>{setMode(m);setErr("");}}>
                {l}
              </button>
            ))}
          </div>

          {mode==="login"&&(<>
            <FF label="Email"><input style={{...S.inp,width:"100%"}} type="email" placeholder="email@club.fr" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></FF>
            <FF label="Mot de passe"><input style={{...S.inp,width:"100%"}} type="password" placeholder="••••••" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></FF>
            {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:14,padding:"8px 12px",background:"#ef444415",borderRadius:8,border:"1px solid #ef444430"}}>{err}</div>}
            <button style={{...S.btnP,width:"100%",marginTop:4,padding:"12px",fontSize:14,opacity:loading?0.7:1}} onClick={login} disabled={loading}>{loading?"Connexion...":"Se connecter →"}</button>
          </>)}

          {mode==="register"&&(<>
            <FF label="Nom complet"><input style={{...S.inp,width:"100%"}} placeholder="Prénom Nom" value={reg.name} onChange={e=>setReg(r=>({...r,name:e.target.value}))}/></FF>
            <FF label="Email"><input style={{...S.inp,width:"100%"}} type="email" placeholder="email@club.fr" value={reg.email} onChange={e=>setReg(r=>({...r,email:e.target.value}))}/></FF>
            <FF label="Mot de passe"><input style={{...S.inp,width:"100%"}} type="password" placeholder="6 caractères minimum" value={reg.password} onChange={e=>setReg(r=>({...r,password:e.target.value}))}/></FF>
            <FF label="Confirmer le mot de passe"><input style={{...S.inp,width:"100%"}} type="password" placeholder="••••••" value={reg.password2} onChange={e=>setReg(r=>({...r,password2:e.target.value}))}/></FF>
            <FF label="Code d'invitation">
              <input style={{...S.inp,width:"100%",textTransform:"uppercase",letterSpacing:2}} placeholder="ex: CLUB2026" value={reg.code} onChange={e=>setReg(r=>({...r,code:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&register()}/>
            </FF>
            <div style={{fontSize:11,color:"#5a7a9a",marginBottom:16,marginTop:-6}}>Code fourni par ton entraîneur</div>
            {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:14,padding:"8px 12px",background:"#ef444415",borderRadius:8,border:"1px solid #ef444430"}}>{err}</div>}
            <button style={{...S.btnP,width:"100%",padding:"12px",fontSize:14,opacity:loading?0.7:1}} onClick={register} disabled={loading}>{loading?"Création...":"Créer mon compte →"}</button>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ==========================================================================================================================================================
// ADMIN PANEL
// ==========================================================================================================================================================
