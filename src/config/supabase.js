// ------ SUPABASE CONFIG --------------------------------------------------------------------------------------------------------------------
export const SUPABASE_URL = "https://kiyhjgikyjduyupnubuc.supabase.co";
export const SUPABASE_KEY = "sb_publishable_VzHiBH0KcoJCOoPerdK0lA_baD53pYY";

// ------ SUPABASE AUTH -------------------------------------------------------
export const supabaseAuth = {
  signIn: async (email, password) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Erreur de connexion");
    return data; // { access_token, user, ... }
  },
  signUp: async (email, password) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Erreur inscription");
    return data;
  },
  signOut: async (token) => {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    });
  },
  getUser: async (token) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    });
    return res.ok ? await res.json() : null;
  }
};

// Session stored in localStorage
export function saveSession(s) { try { localStorage.setItem("ac_session", JSON.stringify(s)); } catch(e){} }
export function loadSession() { try { const s=localStorage.getItem("ac_session"); return s?JSON.parse(s):null; } catch(e){ return null; } }
export function clearSession() { try { localStorage.removeItem("ac_session"); } catch(e){} }

export async function sb(path, options = {}, token = null) {
  const sess = loadSession();
  const authToken = token || sess?.access_token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${authToken}`,
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
export const api = {
  // Clubs
  getClubs:        ()          => sb("clubs?select=*&order=name"),
  createClub:      (data)      => sb("clubs", { method:"POST", body:JSON.stringify(data) }),
  updateClub:      (id, data)  => sb(`clubs?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),

  // Invite codes
  getInviteCodes:  ()          => sb("invite_codes?select=*&order=created_at.desc"),
  createInviteCode:(data)      => sb("invite_codes", { method:"POST", body:JSON.stringify(data) }),
  updateInviteCode:(id, data)  => sb(`invite_codes?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteInviteCode:(id)        => sb(`invite_codes?id=eq.${id}`, { method:"DELETE", prefer:"" }),
  checkInviteCode: (code)      => sb(`invite_codes?code=eq.${encodeURIComponent(code)}&active=eq.true&select=*`),

  // User profiles (linked to Supabase Auth)
  getUserProfile:  (auth_id)   => sb(`user_profiles?auth_id=eq.${auth_id}&select=*`),
  createUserProfile:(data)     => sb("user_profiles", { method:"POST", body:JSON.stringify(data) }),
  updateUserProfile:(id, data) => sb(`user_profiles?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),

  // Photo upload to Supabase Storage
  uploadPhoto: async (file, athleteId) => {
    const ext = file.name.split('.').pop();
    const path = `avatars/${athleteId}_${Date.now()}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": file.type,
        "x-upsert": "true"
      },
      body: file
    });
    if(!res.ok) { const e = await res.text(); throw new Error(e); }
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
  },

  // Users (legacy + compat)
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
  updatePerf:      (id, data)  => sb(`performances?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
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
  getBodyMeasurements: (athleteId) => sb(`body_measurements?athlete_id=eq.${athleteId}&order=date.desc`),
  getStrengthSessions: (athleteId) => sb(`strength_sessions?athlete_id=eq.${athleteId}&order=date.desc`),
  getAllStrengthSessions: () => sb(`strength_sessions?order=date.desc`),
  createStrengthSession: (data)    => sb("strength_sessions", { method:"POST", body:JSON.stringify(data) }),
  deleteStrengthSession: (id)      => sb(`strength_sessions?id=eq.${id}`, { method:"DELETE", prefer:"" }),
  createBodyMeasurement: (data) => sb("body_measurements", { method:"POST", body:JSON.stringify(data) }),
  deleteBodyMeasurement: (id)   => sb(`body_measurements?id=eq.${id}`, { method:"DELETE", prefer:"" }),
  createBoatSetting: (data)    => sb("boat_settings", { method:"POST", body:JSON.stringify(data) }),
  updateBoatSetting: (id, data)=> sb(`boat_settings?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteBoatSetting: (id)      => sb(`boat_settings?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Planning — Season plans
  getSeasonPlans:      ()          => sb("season_plans?select=*&order=created_at.desc"),
  createSeasonPlan:    (data)      => sb("season_plans", { method:"POST", body:JSON.stringify(data) }),
  updateSeasonPlan:    (id, data)  => sb(`season_plans?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteSeasonPlan:    (id)        => sb(`season_plans?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Planning — Weeks
  getPlanWeeks:        (planId)    => sb(`plan_weeks?plan_id=eq.${planId}&order=num_semaine`),
  createPlanWeek:      (data)      => sb("plan_weeks", { method:"POST", body:JSON.stringify(data) }),
  updatePlanWeek:      (id, data)  => sb(`plan_weeks?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deletePlanWeek:      (id)        => sb(`plan_weeks?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Planning — Sessions
  getPlannedSessions:  (weekId)    => sb(`planned_sessions?week_id=eq.${weekId}&order=ordre,created_at`),
  createPlannedSession:(data)      => sb("planned_sessions", { method:"POST", body:JSON.stringify(data) }),
  updatePlannedSession:(id, data)  => sb(`planned_sessions?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deletePlannedSession:(id)        => sb(`planned_sessions?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Planning — Templates
  getSessionTemplates: ()          => sb("session_templates?select=*&order=type_seance,name"),
  createSessionTemplate:(data)     => sb("session_templates", { method:"POST", body:JSON.stringify(data) }),
  updateSessionTemplate:(id, data) => sb(`session_templates?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteSessionTemplate:(id)       => sb(`session_templates?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Planning — Overrides (athlètes individuels)
  getPlanOverrides:    (planId)    => sb(`plan_overrides?plan_id=eq.${planId}&select=*`),
  createPlanOverride:  (data)      => sb("plan_overrides", { method:"POST", body:JSON.stringify(data) }),
  deletePlanOverride:  (id)        => sb(`plan_overrides?id=eq.${id}`, { method:"DELETE", prefer:"" }),

  // Planning — Completions
  getSessionCompletions:(athleteId) => sb(`session_completions?athlete_id=eq.${athleteId}&order=created_at.desc`),
  createCompletion:    (data)       => sb("session_completions", { method:"POST", body:JSON.stringify(data) }),
  updateCompletion:    (id, data)   => sb(`session_completions?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
};

