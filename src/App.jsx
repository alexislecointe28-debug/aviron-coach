import { useState, useEffect, Component } from "react";
import { supabaseAuth, clearSession, loadSession, saveSession, api } from "./config/supabase.js";
import Login from "./components/Login.jsx";
import AdminSpace from "./components/AdminSpace.jsx";
import CoachSpace from "./components/CoachSpace.jsx";
import AthleteSpace from "./components/AthleteSpace.jsx";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{padding:40,fontFamily:"monospace",background:"#0f1923",color:"#ef4444",minHeight:"100vh"}}>
        <h2>Erreur React détectée</h2>
        <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",color:"#fca5a5",fontSize:13}}>
          {this.state.error.message}\n\n{this.state.error.stack}
        </pre>
        <button onClick={()=>{ localStorage.removeItem("ac_session"); window.location.reload(); }}
          style={{marginTop:20,padding:"10px 20px",background:"#f59e0b",color:"#0f1923",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>
          Vider la session et recharger
        </button>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingSW, setWaitingSW] = useState(null);

  // Détecter les nouvelles versions du Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      // Vérifier dès le départ
      if (reg.waiting) { setWaitingSW(reg.waiting); setUpdateReady(true); return; }
      // Écouter les nouvelles installations
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(newSW);
            setUpdateReady(true);
          }
        });
      });
    });
    // Écouter le message "skipWaiting" → recharger
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
    // Vérifier les mises à jour toutes les 60 secondes
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then(reg => reg.update());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function applyUpdate() {
    if (waitingSW) waitingSW.postMessage({ type: 'SKIP_WAITING' });
  }

  const [profile, setProfile] = useState(() => {
    const s = loadSession();
    return s?.profile || null;
  });
  const [managedSections, setManagedSections] = useState([]);

  useEffect(() => {
    if (profile?.id && profile.role === "athlete") {
      api.getMySections(profile.id)
        .then(rows => setManagedSections((rows||[]).map(r => r.section)))
        .catch(() => setManagedSections([]));
    } else {
      setManagedSections([]);
    }
  }, [profile?.id]);

  async function handleLogin(p) {
    saveSession({ profile: p });
    setProfile(p);
  }

  async function handleLogout() {
    const s = loadSession();
    if(s?.access_token) {
      try { await supabaseAuth.signOut(s.access_token); } catch(e){}
    }
    clearSession();
    setProfile(null);
    setManagedSections([]);
  }

  if(!profile) return <ErrorBoundary><Login onLogin={handleLogin}/></ErrorBoundary>;

  // Bannière mise à jour
  const UpdateBanner = updateReady ? (
    <div style={{
      position:"fixed", top:0, left:0, right:0, zIndex:9999,
      background:"linear-gradient(90deg,#0369a1,#0284c7)",
      color:"#fff", display:"flex", alignItems:"center",
      justifyContent:"space-between", padding:"10px 16px",
      boxShadow:"0 2px 12px #00000040",
      fontFamily:"-apple-system,sans-serif",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>🚀</span>
        <div>
          <div style={{fontWeight:700,fontSize:13}}>Nouvelle version disponible</div>
          <div style={{fontSize:11,opacity:0.8}}>AvironCoach a été mis à jour</div>
        </div>
      </div>
      <button onClick={applyUpdate} style={{
        background:"#fff", color:"#0369a1",
        border:"none", borderRadius:8,
        padding:"7px 14px", fontWeight:700,
        fontSize:12, cursor:"pointer",
        flexShrink:0,
      }}>
        Mettre à jour →
      </button>
    </div>
  ) : null;
  const role = profile.role;
  if(role==="superadmin" || role==="admin") return <ErrorBoundary><AdminSpace currentUser={profile} onLogout={handleLogout}/></ErrorBoundary>;
  if(role==="coach") return <ErrorBoundary><CoachSpace currentUser={profile} onLogout={handleLogout}/></ErrorBoundary>;
  return <ErrorBoundary><AthleteSpace currentUser={profile} onLogout={handleLogout} managedSections={managedSections}/></ErrorBoundary>;
}
