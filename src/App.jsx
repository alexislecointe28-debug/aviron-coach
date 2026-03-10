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
  const role = profile.role;
  if(role==="superadmin" || role==="admin") return <ErrorBoundary><AdminSpace currentUser={profile} onLogout={handleLogout}/></ErrorBoundary>;
  if(role==="coach") return <ErrorBoundary><CoachSpace currentUser={profile} onLogout={handleLogout}/></ErrorBoundary>;
  return <ErrorBoundary><AthleteSpace currentUser={profile} onLogout={handleLogout} managedSections={managedSections}/></ErrorBoundary>;
}
