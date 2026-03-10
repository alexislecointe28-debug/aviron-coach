import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabaseAuth, clearSession, loadSession } from "./config/supabase.js";
import Login from "./components/Login.jsx";
import AdminSpace from "./components/AdminSpace.jsx";
import CoachSpace from "./components/CoachSpace.jsx";
import AthleteSpace from "./components/AthleteSpace.jsx";

export default function App() {
  const [profile, setProfile] = useState(() => {
    const s = loadSession();
    return s?.profile || null;
  });

  async function handleLogin(p) {
    setProfile(p);
  }

  async function handleLogout() {
    const s = loadSession();
    if(s?.access_token) {
      try { await supabaseAuth.signOut(s.access_token); } catch(e){}
    }
    clearSession();
    setProfile(null);
  }

  if(!profile) return <Login onLogin={handleLogin}/>;
  const role = profile.role;
  if(role==="superadmin" || role==="admin") return <AdminSpace currentUser={profile} onLogout={handleLogout}/>;
  if(role==="coach") return <CoachSpace currentUser={profile} onLogout={handleLogout}/>;
  return <AthleteSpace currentUser={profile} onLogout={handleLogout}/>;
}
