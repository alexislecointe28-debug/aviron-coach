import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TYPE_COLORS, CMP_COLORS, AGE_CAT_COLORS, AGE_CAT_GROUPS, BLADE_TYPES, CREW_SLOTS, S } from "../styles.js";
import { api } from "../config/supabase.js";
import { FF, Modal, Toast, Loader, Sparkline, StatPill } from "./ui.jsx";
import OutilsCoach from "./OutilsCoach.jsx";
import PlanningSpace from "./PlanningSpace.jsx";
import {
  timeToSeconds, secondsToTime, concept2Watts, concept2WattsFast,
  getBestTime, getLastPerf, avg, getAgeCatFromBirthYear, getAgeCategory,
  matchesAgeGroup, calcAgeFromDOB, calcRealAge, getCategoryFromAge,
  suggestRigging, calcCroisement
} from "../utils/rowing.js";

export default function CoachSpace({ currentUser, onLogout }) {
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
  const [dashDistType,setDashDistType] = useState("2000m");
  const [dashCatFilter,setDashCatFilter] = useState("Tous");
  const [compareIds,setCompareIds] = useState([]);
  const [compareType,setCompareType] = useState("2000m");
  const [crewBoat,setCrewBoat] = useState("4-");
  const [newCrewMembers,setNewCrewMembers] = useState([]);
  const [crewName,setCrewName] = useState("Nouvel équipage");
  const [editCrew,setEditCrew] = useState(null);
  const [editCrewMembers,setEditCrewMembers] = useState([]);
  const [showAddPerf,setShowAddPerf] = useState(false);
  const [showAddAth,setShowAddAth] = useState(false);
  const [editAth,setEditAth] = useState(null);
  const [newPerf,setNP] = useState({athleteId:"",date:"",time:"",hr:"",rpe:"",distance:""});
  const [newAth,setNA]  = useState({name:"",date_naissance:"",genre:"H",weight:"",taille:"",envergure:"",longueur_bras:"",largeur_epaules:"",taille_assise:""});
  const [bodyMeasurements,setBodyMeasurements] = useState([]);
  const [showMorphoForm,setShowMorphoForm] = useState(false);
  const [newMorpho,setNewMorpho] = useState({date:new Date().toISOString().split("T")[0],poids:"",taille:"",masse_grasse:""});
  const [strengthSessions,setStrengthSessions] = useState([]);
  const [allStrengthSessions,setAllStrengthSessions] = useState([]);
  const [showStrengthForm,setShowStrengthForm] = useState(false);
  const [strengthTab,setStrengthTab] = useState("saisie");
  const [selStrengthExo,setSelStrengthExo] = useState("Squat");
  const [newStrength,setNewStrength] = useState({date:new Date().toISOString().split("T")[0],exercices:[{exercice:"Squat",series:"",reps:"",charge:""},{exercice:"Hip Thrust",series:"",reps:"",charge:""},{exercice:"RDL",series:"",reps:"",charge:""},{exercice:"Tirades rowing",series:"",reps:"",charge:""}]});
  const [ficheTab,setFicheTab] = useState("general");
  const [selBoatDetail,setSelBoatDetail] = useState(null);
  // Boats states
  const [selBoat,setSelBoat]   = useState(null);
  const [boatFilter,setBoatFilter] = useState(null);
  // ═══ OUTILS ═══
  const [outiTab,setOutiTab]   = useState("cadence");
  // Cadencemètre
  const [cadTaps,setCadTaps]   = useState([]);
  const [cadSpm,setCadSpm]     = useState(null);
  const [cadActive,setCadActive] = useState(false);
  // Chrono départs différés
  const [chronoCrews,setChronoCrews]   = useState([]);
  const [chronoRunning,setChronoRunning] = useState(false);
  const [chronoStart,setChronoStart]   = useState(null);
  const [chronoNow,setChronoNow]       = useState(0);
  const [chronoArrivals,setChronoArrivals] = useState({});
  // Notes vocales
  const [voiceNotes,setVoiceNotes]   = useState([]);
  const [voiceRec,setVoiceRec]       = useState(false);
  const [voiceRecorder,setVoiceRecorder] = useState(null);
  const [boatOpen,setBoatOpen]   = useState({});
  const [showAddBoat,setShowAddBoat] = useState(false);
  const [paddles,setPaddles] = useState([]);
  const [showAddPaddle,setShowAddPaddle] = useState(false);
  const [editPaddle,setEditPaddle] = useState(null);
  const [newPaddle,setNPaddle] = useState({numero:"",type_nage:"couple",marque:"",modele:"",plage_reglage:"",notes:""});
  const [showAddSetting,setShowAddSetting] = useState(false);
  const [aiRigging,setAIRigging]         = useState(null);   // suggestion IA poste unique
  const [aiRiggingAll,setAIRiggingAll]   = useState(null);   // suggestion IA tous postes
  const [aiRiggingLoading,setAIRiggingLoading] = useState(false);
  const [aiRiggingAllLoading,setAIRiggingAllLoading] = useState(false);
  const [aiRiggingAllImporting,setAIRiggingAllImporting] = useState(false);
  const [editBoat,setEditBoat] = useState(null);
  const [newBoat,setNB]        = useState({name:"",type:"couple",seats:4,categorie:"",brand:"",model:"",avg_buoyancy:"",notes:""});
  const [newSetting,setNS]     = useState({poste:1,date_reglage:"",regle_par:"",entraxe:"",longueur_pedale:"",levier_interieur:"",levier_exterieur:"",croisement:"",numero_pelle:"",type_pelle:"",observations:""});

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const safe = (p) => p.catch(()=>[]);
      const [aths,perfs,cr,cm,sess,sc,bt,bc,bs,allS,pdls] = await Promise.all([
        safe(api.getAthletes()),safe(api.getPerformances()),safe(api.getCrews()),safe(api.getCrewMembers()),
        safe(api.getSessions()),safe(api.getSessionCrews()),
        safe(api.getBoats()),safe(api.getBoatCrews()),safe(api.getBoatSettings()),
        safe(api.getAllStrengthSessions()),safe(api.getPaddles())
      ]);
      setAthletes(aths||[]); setPerformances(perfs||[]); setCrews(cr||[]); setCrewMembers(cm||[]);
      setSessions(sess||[]); setSessionCrews(sc||[]);
      setBoats(bt||[]); setBoatCrews(bc||[]); setBoatSettings(bs||[]);
      setAllStrengthSessions(allS||[]); setPaddles(pdls||[]);
      if((aths||[]).length>=2) setCompareIds([aths[0].id,aths[1].id]);
    } catch(e){ console.error("Load error:", e); }
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[]);

  useEffect(()=>{
    if(selAth) {
      api.getBodyMeasurements(selAth).then(d=>setBodyMeasurements(d||[])).catch(()=>{});
      api.getStrengthSessions(selAth).then(d=>setStrengthSessions(d||[])).catch(()=>{});
    }
  },[selAth]);

  async function addMorpho() {
    if(!newMorpho.poids && !newMorpho.taille) return;
    const poids = newMorpho.poids ? parseFloat(newMorpho.poids) : null;
    const taille = newMorpho.taille ? parseFloat(newMorpho.taille) : null;
    const imc = (poids && taille) ? parseFloat((poids / ((taille/100)**2)).toFixed(1)) : null;
    const masse_grasse = newMorpho.masse_grasse ? parseFloat(newMorpho.masse_grasse) : null;
    await api.createBodyMeasurement({athlete_id:selAth, date:newMorpho.date, poids, taille, masse_grasse, imc});
    setToast({m:"Mesure enregistrée v",t:"success"});
    setNewMorpho({date:new Date().toISOString().split("T")[0],poids:"",taille:"",masse_grasse:""});
    setShowMorphoForm(false);
    api.getBodyMeasurements(selAth).then(d=>setBodyMeasurements(d||[]));
  }

  const EXERCICES_LIST = ["Squat","Hip Thrust","RDL","Soulevé de terre","Développé couché","Tirades rowing","Tractions lestées","Leg press","Fentes","Rowing barre","Autre..."];

  function calcOneRM(charge, reps) {
    if(!charge || !reps) return null;
    return parseFloat((parseFloat(charge) * (1 + parseFloat(reps)/30)).toFixed(1));
  }

  async function addStrengthSession() {
    const rows = newStrength.exercices.filter(e=>e.exercice&&e.exercice!=="Autre..."&&e.charge&&e.reps&&e.series);
    const rowsCustom = newStrength.exercices.filter(e=>e.exercice==="Autre..."&&e.customEx&&e.charge&&e.reps&&e.series);
    const allRows = [...rows, ...rowsCustom.map(e=>({...e,exercice:e.customEx}))];
    console.log("addStrengthSession called, allRows:", allRows, "selAth:", selAth);
    if(!allRows.length){setToast({m:"Remplis au moins un exercice complet (séries/reps/charge)",t:"error"});return;}
    try {
      for(const e of allRows) {
        const one_rm = calcOneRM(e.charge, e.reps);
        const volume = parseFloat(e.series)*parseFloat(e.reps)*parseFloat(e.charge);
        await api.createStrengthSession({
          athlete_id:selAth, date:newStrength.date,
          exercice:e.exercice, series:+e.series, reps:+e.reps,
          charge:+e.charge, one_rm, volume
        });
      }
      setToast({m:"Séance enregistrée ✓",t:"success"});
      setShowStrengthForm(false);
      setNewStrength({date:new Date().toISOString().split("T")[0],exercices:[{exercice:"Squat",series:"",reps:"",charge:""}]});
      api.getStrengthSessions(selAth).then(d=>setStrengthSessions(d||[]));
      api.getAllStrengthSessions().then(d=>setAllStrengthSessions(d||[]));
    } catch(err) {
      setToast({m:"Erreur: "+err.message,t:"error"});
    }
  }

  async function deleteStrengthSession(id) {
    await api.deleteStrengthSession(id);
    api.getStrengthSessions(selAth).then(d=>setStrengthSessions(d||[]));
    api.getAllStrengthSessions().then(d=>setAllStrengthSessions(d||[]));
  }

  async function deleteMorpho(id) {
    await api.deleteBodyMeasurement(id);
    api.getBodyMeasurements(selAth).then(d=>setBodyMeasurements(d||[]));
  }

  function getPerfFor(id) { return performances.filter(p=>p.athlete_id===id).sort((a,b)=>a.date.localeCompare(b.date)); }
  function aStats(a, distType="2000m") { const perfs=getPerfFor(a.id); const filtered=perfs.filter(p=>(p.distance_type||"2000m")===distType); const best=getBestTime(filtered),last=getLastPerf(filtered); const w=best?concept2WattsFast(best.time,distType):null; return{perfs,filtered,best,last,watts:w,wpkg:w&&a.weight?(w/a.weight).toFixed(2):null}; }
  function getCrewForAthlete(a) { const cm=crewMembers.find(m=>m.athlete_id===a.id); return cm?crews.find(c=>c.id===cm.crew_id):null; }
  function getCrewMembersFor(crewId) { return crewMembers.filter(m=>m.crew_id===crewId).map(m=>athletes.find(a=>a.id===m.athlete_id)).filter(Boolean); }
  function getSessionCrewsFor(sessionId) { return sessionCrews.filter(sc=>sc.session_id===sessionId).map(sc=>crews.find(c=>c.id===sc.crew_id)).filter(Boolean); }

  const [editPerf,setEditPerf] = useState(null);
  async function addPerf() {
    try {
      const watts = concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m");
      await api.createPerf({athlete_id:+newPerf.athleteId,date:newPerf.date,time:newPerf.time,watts:watts||0,spm:0,hr:+newPerf.hr,rpe:+newPerf.rpe,distance:+newPerf.distance,distance_type:newPerf.distance_type||"2000m"});
      setToast({m:"Performance ajoutée v",t:"success"}); load();
      setNP({athleteId:"",date:"",time:"",hr:"",rpe:"",distance:""}); setShowAddPerf(false);
    } catch(e){setToast({m:"Erreur "+e.message,t:"error"});}
  }
  async function saveEditPerf() {
    try {
      const watts = concept2WattsFast(editPerf.time, editPerf.distance_type||"2000m");
      await api.updatePerf(editPerf.id,{date:editPerf.date,time:editPerf.time,watts:watts||0,hr:+editPerf.hr,rpe:+editPerf.rpe,distance:+editPerf.distance,distance_type:editPerf.distance_type||"2000m"});
      setToast({m:"Performance modifiée v",t:"success"}); load(); setEditPerf(null);
    } catch(e){setToast({m:"Erreur",t:"error"});}
  }
  async function addAth() {
    try {
      const av=newAth.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      const computedAge = calcAgeFromDOB(newAth.date_naissance);
      const computedCat = getCategoryFromAge(computedAge, newAth.genre);
      let photo_url = null;
      if(newAth.photo_file) {
        try { photo_url = await api.uploadPhoto(newAth.photo_file, `new_${Date.now()}`); } catch(e) { console.warn("Photo upload failed:", e); }
      }
      await api.createAthlete({name:newAth.name,age:computedAge,category:computedCat,weight:+newAth.weight,genre:newAth.genre||"H",photo_url,date_naissance:newAth.date_naissance,avatar:av,crew_id:null,taille:newAth.taille?+newAth.taille:null,envergure:newAth.envergure?+newAth.envergure:null,longueur_bras:newAth.longueur_bras?+newAth.longueur_bras:null,largeur_epaules:newAth.largeur_epaules?+newAth.largeur_epaules:null,taille_assise:newAth.taille_assise?+newAth.taille_assise:null});
      setToast({m:"Athlète ajouté v",t:"success"}); load();
      setNA({name:"",date_naissance:"",genre:"H",weight:"",taille:"",envergure:"",longueur_bras:"",largeur_epaules:"",taille_assise:"",photo_file:null,photo_preview:null}); setShowAddAth(false);
    } catch(e){setToast({m:"Erreur "+e.message,t:"error"});}
  }
  async function saveEditAth() {
    try {
      let photo_url = editAth.photo_url || null;
      if(editAth.photo_file) {
        try { photo_url = await api.uploadPhoto(editAth.photo_file, editAth.id); } catch(e) { console.warn("Photo upload failed:", e); }
      }
      const dob = editAth.date_naissance || null;
      const computedAge = dob ? calcAgeFromDOB(dob) : +editAth.age;
      const genre = editAth.genre || (editAth.category?.includes("F") ? "F" : "H");
      const computedCat = getCategoryFromAge(computedAge, genre);
      await api.updateAthlete(editAth.id,{name:editAth.name,age:computedAge,category:computedCat,weight:+editAth.weight,genre,photo_url,date_naissance:dob,taille:editAth.taille?+editAth.taille:null,envergure:editAth.envergure?+editAth.envergure:null,longueur_bras:editAth.longueur_bras?+editAth.longueur_bras:null,largeur_epaules:editAth.largeur_epaules?+editAth.largeur_epaules:null,taille_assise:editAth.taille_assise?+editAth.taille_assise:null});
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

  async function deleteCrew(id) {
    if(!window.confirm("Supprimer cet équipage ?")) return;
    try {
      await api.removeCrewMembers(id);
      await api.deleteCrew(id);
      setToast({m:"Équipage supprimé",t:"success"}); load();
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
  async function deleteBoat(id) {
    if(!window.confirm("Supprimer ce bateau et tous ses réglages ?")) return;
    try {
      // delete settings first
      const settings = boatSettings.filter(s=>s.boat_id===id);
      for(const s of settings) await api.deleteBoatSetting(s.id);
      const bcs = boatCrews.filter(bc=>bc.boat_id===id);
      for(const bc of bcs) await api.removeBoatCrew(id, bc.crew_id);
      await api.deleteBoat(id);
      if(selBoat===id) setSelBoat(null);
      setToast({m:"Bateau supprimé",t:"success"}); load();
    } catch(e){setToast({m:"Erreur suppression",t:"error"});}
  }
  async function addBoat() {
    try {
      await api.createBoat({...newBoat,seats:+newBoat.seats,avg_buoyancy:newBoat.avg_buoyancy?+newBoat.avg_buoyancy:null});
      setToast({m:"Bateau ajouté v",t:"success"}); load();
      setNB({name:"",type:"couple",seats:4,categorie:"",brand:"",model:"",avg_buoyancy:"",notes:""}); setShowAddBoat(false);
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
  function getPaddlesFor(boatId) { return paddles.filter(p=>p.boat_id===boatId).sort((a,b)=>a.numero.localeCompare(b.numero)); }
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

  const BOAT_CATS = ["1x","2x","2-","4x","4-","4+","8+"];
  function getCat(b) {
    if(b.categorie) return b.categorie;
    if(b.seats===1) return "1x";
    if(b.seats===2) return b.type==="couple"?"2x":"2-";
    if(b.seats===4) return b.type==="couple"?"4x":"4-";
    if(b.seats===8) return "8+";
    return null;
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
  const dashPerfs=performances.filter(p=>(p.distance_type||"2000m")===dashDistType);
  const dashAthletes=dashCatFilter==="Tous"?athletes:athletes.filter(a=>matchesAgeGroup(a,dashCatFilter)||a.category===dashCatFilter);
  const globalAvgW=dashPerfs.length?Math.round(dashPerfs.reduce((s,p)=>s+(concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0),0)/dashPerfs.length):0;
  const globalBest=dashPerfs.reduce((b,p)=>timeToSeconds(p.time)<timeToSeconds(b)?p.time:b,"9:99");

  // Responsive mobile
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',handler);
    return()=>window.removeEventListener('resize',handler);
  },[]);

  const NAV=[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"athletes",label:"Athlètes",icon:"👤"},{id:"performances",label:"Performances",icon:"⚡"},{id:"compare",label:"Comparer",icon:"⚖️"},{id:"crew",label:"Équipages",icon:"🚣"},{id:"boats",label:"Bateaux",icon:"🛶"},{id:"planning",label:"Planning",icon:"📅"},{id:"outils",label:"Outils",icon:"🧰"}];


  async function applyAllRigging() {
    if (!aiRiggingAll?.postes?.length) return;
    setAIRiggingAllImporting(true);
    const today = new Date().toISOString().split("T")[0];
    const coach = currentUser?.name || currentUser?.email || "IA";
    let count = 0;
    try {
      for (const p of aiRiggingAll.postes) {
        const r = p.reglages || {};
        await api.createBoatSetting({
          boat_id: selBoat,
          poste: p.poste,
          date_reglage: today,
          regle_par: coach + " (IA)",
          entraxe: r.entraxe || null,
          longueur_pedale: r.longueur_pedale || null,
          levier_interieur: r.levier_interieur || null,
          levier_exterieur: r.levier_exterieur || null,
          croisement: r.croisement || null,
          observations: p.notes || "",
        });
        count++;
      }
      setToast({ m: `${count} réglages IA appliqués ✓`, t: "success" });
      setAIRiggingAll(null);
      const s = await api.getBoatSettings(selBoat); setBoatSettings(s||[]);
    } catch(e) {
      setToast({ m: "Erreur application : " + e.message, t: "error" });
    } finally {
      setAIRiggingAllImporting(false);
    }
  }

  if(loading) return <div style={{...S.root,alignItems:"center",justifyContent:"center"}}><Loader text="Chargement depuis Supabase..."/></div>;

  return (
    <div style={{...S.root,flexDirection:isMobile?"column":"row"}}>
      {toast&&<Toast message={toast.m} type={toast.t} onDone={()=>setToast(null)}/>}
      <aside style={isMobile?{display:"none"}:S.sidebar}>
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
      <div style={{...S.main,paddingBottom:isMobile?64:0,width:isMobile?"100%":0}}>

        {tab==="dashboard"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={{...S.ph,marginBottom:isMobile?12:20,flexWrap:"wrap",gap:10}}>
            <div><h1 style={{...S.ttl,fontSize:isMobile?22:28}}>Dashboard</h1><p style={S.sub}>{dashAthletes.length} athlètes · {dashPerfs.length} sessions</p></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{display:"flex",gap:4}}>{"500m 1000m 2000m".split(" ").map(t=><button key={t} onClick={()=>setDashDistType(t)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${dashDistType===t?"#0ea5e9":"#1e293b"}`,background:dashDistType===t?"#0ea5e920":"transparent",color:dashDistType===t?"#0ea5e9":"#5a7a9a",fontSize:12,cursor:"pointer",fontWeight:dashDistType===t?700:400}}>{t}</button>)}</div>
              <div style={{display:"flex",gap:4}}>{["Tous",...AGE_CAT_GROUPS.slice(1)].map(cat=><button key={cat} onClick={()=>setDashCatFilter(cat)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${dashCatFilter===cat?"#a78bfa":"#1e293b"}`,background:dashCatFilter===cat?"#a78bfa20":"transparent",color:dashCatFilter===cat?"#a78bfa":"#5a7a9a",fontSize:12,cursor:"pointer",fontWeight:dashCatFilter===cat?700:400}}>{cat}</button>)}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(5,1fr)",gap:isMobile?10:14,marginBottom:isMobile?20:36}}>
            {[{l:"Athlètes",v:dashAthletes.length,c:"#0ea5e9",ic:"o"},{l:"Sessions",v:dashPerfs.length,c:"#f59e0b",ic:"*"},{l:"Puissance moy.",v:`${globalAvgW}W`,c:"#a78bfa",ic:"~"},{l:`Meilleur ${dashDistType}`,v:globalBest,c:"#4ade80",ic:"~"},{l:"Équipages",v:crews.length,c:"#f97316",ic:"~"}].map((k,i)=>(
              <div key={i} style={S.kpi}><div style={{color:k.c,fontSize:22,marginBottom:8}}>{k.ic}</div><div style={{color:k.c,fontSize:26,fontWeight:900,letterSpacing:-1}}>{k.v}</div><div style={{color:"#a8bfd4",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div></div>
            ))}
          </div>
          {(()=>{
            // rankMode from parent state
            const ranked=dashAthletes.map(a=>{
              const perfs=getPerfFor(a.id).filter(p=>(p.distance_type||"2000m")===dashDistType);
              const best=getBestTime(perfs),last=getLastPerf(perfs);
              const w=best?concept2WattsFast(best.time,best.distance_type||"2000m"):null;
              const wpkg=w&&a.weight?(w/a.weight).toFixed(2):null;
              const km=perfs.reduce((s,p)=>s+(p.distance||0),0);
              return last?{...a,watts:w||0,wpkg:parseFloat(wpkg)||0,wT:perfs.map(p=>concept2WattsFast(p.time,p.distance_type||"2000m")||p.watts||0),best,km,sessions:perfs.length}:null;
            }).filter(Boolean);
            const sorted=rankMode==="wpkg"?[...ranked].sort((a,b)=>b.wpkg-a.wpkg):rankMode==="time"?[...ranked].filter(a=>a.best).sort((a,b)=>timeToSeconds(a.best.time)-timeToSeconds(b.best.time)):rankMode==="km"?[...ranked].sort((a,b)=>b.km-a.km):[...ranked].sort((a,b)=>b.sessions-a.sessions);
            return(<>
              <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",marginBottom:14,flexDirection:isMobile?"column":"row",gap:isMobile?8:0}}>
                <div style={S.st}>Classements</div>
                <div style={{display:"flex",gap:6}}>{[["wpkg","W/kg","#a78bfa"],["time",`Temps ${dashDistType}`,"#4ade80"],["km","Km totaux","#f97316"],["sessions","Sessions","#0ea5e9"]].map(([k,l,c])=><button key={k} style={{...S.fb,...(rankMode===k?{background:c+"20",border:"1px solid "+c+"60",color:c}:{})}} onClick={()=>setRankMode(k)}>{l}</button>)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:32}}>
                {sorted.map((a,i)=>{
                  const val=rankMode==="wpkg"?a.wpkg.toFixed(2)+" W/kg":rankMode==="time"?(a.best?.time??"-"):rankMode==="km"?a.km+"km":a.sessions+" sessions";
                  const sub=rankMode==="wpkg"?a.watts+"W":rankMode==="time"?a.wpkg+" W/kg":rankMode==="km"?a.sessions+" sessions":a.km+"km";
                  const col=rankMode==="wpkg"?"#a78bfa":rankMode==="time"?"#4ade80":rankMode==="km"?"#f97316":"#0ea5e9";
                  const ageCat=a.date_naissance?getAgeCatFromBirthYear(new Date(a.date_naissance).getFullYear()):getAgeCategory(a.age);
                  return(<div key={a.id} style={S.topCard} onClick={()=>{setSelAth(a.id);setFicheTab("general");setSelBoatDetail(null);setTab("athlete_detail");}}>
                    <div style={{width:28,color:"#0ea5e9",fontWeight:900,fontSize:18}}>#{i+1}</div>
                    {a.photo_url?<img src={a.photo_url} style={{...S.av,objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>:<div style={{...S.av,backgroundImage:a.photo_url?`url(${a.photo_url})`:"none",backgroundSize:"cover",backgroundPosition:"center"}}>{!a.photo_url&&a.avatar}</div>}
                    <div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9",display:"flex",alignItems:"center",gap:6}}>{a.name}<span style={{fontSize:10,padding:"2px 6px",borderRadius:8,background:(AGE_CAT_COLORS[ageCat] ? AGE_CAT_COLORS[ageCat] : "#374151")+"25",color:(AGE_CAT_COLORS[ageCat] ? AGE_CAT_COLORS[ageCat] : "#94a3b8")}}>{ageCat}</span></div><div style={{color:"#7a95b0",fontSize:12}}>{a.category}</div></div>
                    <div style={{textAlign:"right",minWidth:90}}><div style={{color:col,fontWeight:800,fontSize:18}}>{val}</div><div style={{color:"#7a95b0",fontSize:12}}>{sub}</div></div>
                    <div style={{marginLeft:14}}><Sparkline data={a.wT} color="#0ea5e9"/></div>
                  </div>);
                })}
              </div>
            </>);
          })()}
          <div style={S.st}>~ Planning semaine</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(7,1fr)",gap:10}}>
            {sessions.map(s=><div key={s.id} style={{...S.card,minHeight:110}}>
              <div style={{fontWeight:800,color:"#f1f5f9",fontSize:13,marginBottom:8}}>{s.day}</div>
              <div style={{...S.badge,background:TYPE_COLORS[s.type]+"22",color:TYPE_COLORS[s.type]?""+TYPE_COLORS[s.type]:"#a8bfd4",border:"1px solid "+(TYPE_COLORS[s.type] ? TYPE_COLORS[s.type] : "#a8bfd4")+"44",marginBottom:8}}>{s.type}</div>
              <div style={{color:"#a8bfd4",fontSize:12}}>{s.duration}</div>
              <div style={{color:"#5a7a9a",fontSize:11,marginTop:4}}>{getSessionCrewsFor(s.id).length?`${getSessionCrewsFor(s.id).length} équipages`:"--"}</div>
            </div>)}
          </div>
        </div>)}

        {tab==="athletes"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={{...S.ph,marginBottom:isMobile?16:32}}><div><h1 style={{...S.ttl,fontSize:isMobile?22:28}}>Athlètes</h1><p style={S.sub}>{athletes.length} rameurs</p></div><button style={S.btnP} onClick={()=>setShowAddAth(true)}>+ Ajouter</button></div>
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
            {AGE_CAT_GROUPS.map(c=><button key={c} style={{...S.fb,...(filterCat===c?S.fbon:{})}} onClick={()=>setFilterCat(c)}>{c}</button>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(290px,1fr))",gap:isMobile?12:16}}>
            {filteredAths.map(a=>{
              const{perfs,filtered,best,last,wpkg}=aStats(a,"2000m");const wTrend=filtered.length>=2?(concept2WattsFast(filtered[filtered.length-1].time,"2000m")||0)-(concept2WattsFast(filtered[filtered.length-2].time,"2000m")||0):0;const aCrew=getCrewForAthlete(a);
              return(<div key={a.id} style={{...S.card,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  {a.photo_url?<img src={a.photo_url} style={{...S.av,objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>:<div style={{...S.av,backgroundImage:a.photo_url?`url(${a.photo_url})`:"none",backgroundSize:"cover",backgroundPosition:"center"}}>{!a.photo_url&&a.avatar}</div>}
                  <div style={{flex:1}} onClick={()=>{setSelAth(a.id);setFicheTab("general");setSelBoatDetail(null);setTab("athlete_detail");}}><div style={{fontWeight:800,color:"#f1f5f9",fontSize:15,display:"flex",alignItems:"center",gap:8}}>{a.name}<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:(AGE_CAT_COLORS[a.date_naissance?getAgeCatFromBirthYear(new Date(a.date_naissance).getFullYear()):getAgeCategory(a.age)] || "#374151")+"25",color:(AGE_CAT_COLORS[a.date_naissance?getAgeCatFromBirthYear(new Date(a.date_naissance).getFullYear()):getAgeCategory(a.age)] || "#94a3b8"),fontWeight:700}}>{a.date_naissance?getAgeCatFromBirthYear(new Date(a.date_naissance).getFullYear()):getAgeCategory(a.age)}</span></div><div style={{color:"#7a95b0",fontSize:12}}>{a.category} — {a.date_naissance?calcRealAge(a.date_naissance):a.age} ans — {a.weight} kg{a.taille?" — "+a.taille+"cm":""}</div>{aCrew&&<div style={{color:"#0ea5e9",fontSize:11,marginTop:2}}>~ {aCrew.name}</div>}</div>
                  <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30",flexShrink:0}} onClick={e=>{e.stopPropagation();setEditAth({...a});}}>✏️ Edit</button>
                </div>
                {last?(<>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}} onClick={()=>{setSelAth(a.id);setFicheTab("general");setSelBoatDetail(null);setTab("athlete_detail");}}>
                    <div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:8,padding:"7px 10px"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best {best?.distance_type||"2k"}</div><div style={{color:"#4ade80",fontWeight:900,fontSize:20}}>{best?.time??"--"}</div></div>
                    <div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:8,padding:"7px 10px"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:20}}>{wpkg??"--"}</div></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}} onClick={()=>{setSelAth(a.id);setFicheTab("general");setSelBoatDetail(null);setTab("athlete_detail");}}>
                    <span style={{color:"#7a95b0",fontSize:12}}>{perfs.length} sessions</span>
                    <span style={{color:wTrend>=0?"#4ade80":"#ef4444",fontSize:13,fontWeight:700}}>{wTrend>=0?"^":"v"} {Math.abs(wTrend)}W</span>
                    <Sparkline data={perfs.map(p=>p.watts)} color="#0ea5e9"/>
                  </div>
                </>):<div style={{color:"#5a7a9a",fontSize:13,textAlign:"center",padding:"12px 0"}} onClick={()=>{setSelAth(a.id);setFicheTab("general");setSelBoatDetail(null);setTab("athlete_detail");}}>Aucune performance</div>}
              </div>);
            })}
          </div>
          {showAddAth&&<Modal title="Nouvel athlète" onClose={()=>setShowAddAth(false)}>
            <FF label="Nom"><input style={S.inp} value={newAth.name} onChange={e=>setNA(p=>({...p,name:e.target.value}))} placeholder="Prénom Nom"/></FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Date de naissance"><input style={S.inp} type="date" value={newAth.date_naissance} onChange={e=>setNA(p=>({...p,date_naissance:e.target.value}))}/></FF>
              <FF label="Genre"><select style={S.inp} value={newAth.genre} onChange={e=>setNA(p=>({...p,genre:e.target.value}))}><option value="H">Homme</option><option value="F">Femme</option></select></FF>
            </div>
            {newAth.date_naissance&&(()=>{const age=calcAgeFromDOB(newAth.date_naissance);const realAge=calcRealAge(newAth.date_naissance);const cat=getCategoryFromAge(age,newAth.genre);return(<div style={{padding:"8px 12px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,fontSize:13}}><span style={{color:"#64748b"}}>Catégorie auto : </span><span style={{color:"#0ea5e9",fontWeight:700}}>{cat}</span><span style={{color:"#64748b"}}> · {realAge} ans réels ({age} fédéral)</span></div>);})()}
            <FF label="Poids (kg)"><input style={S.inp} type="number" value={newAth.weight} onChange={e=>setNA(p=>({...p,weight:e.target.value}))} placeholder="ex: 75"/></FF>
            <FF label="Photo">
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {newAth.photo_preview&&<img src={newAth.photo_preview} style={{width:44,height:44,borderRadius:8,objectFit:"cover"}} alt="preview"/>}
                <label style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30",cursor:"pointer"}}>
                  📷 Choisir une photo
                  <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{
                    const f=e.target.files[0]; if(!f) return;
                    const reader=new FileReader();
                    reader.onload=ev=>setNA(p=>({...p,photo_preview:ev.target.result,photo_file:f}));
                    reader.readAsDataURL(f);
                  }}/>
                </label>
                {newAth.photo_preview&&<button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>setNA(p=>({...p,photo_preview:null,photo_file:null}))}>✕</button>}
              </div>
            </FF>
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
            <FF label="Photo">
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {(editAth.photo_preview||editAth.photo_url)&&<img src={editAth.photo_preview||editAth.photo_url} style={{width:44,height:44,borderRadius:8,objectFit:"cover"}} alt="preview"/>}
                <label style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30",cursor:"pointer"}}>
                  📷 {editAth.photo_url?"Changer":"Ajouter"} photo
                  <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{
                    const f=e.target.files[0]; if(!f) return;
                    const reader=new FileReader();
                    reader.onload=ev=>setEditAth(p=>({...p,photo_preview:ev.target.result,photo_file:f}));
                    reader.readAsDataURL(f);
                  }}/>
                </label>
                {(editAth.photo_preview||editAth.photo_url)&&<button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>setEditAth(p=>({...p,photo_preview:null,photo_file:null,photo_url:null}))}>✕ Retirer</button>}
              </div>
            </FF>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Date de naissance"><input style={S.inp} type="date" value={editAth.date_naissance||""} onChange={e=>setEditAth(p=>({...p,date_naissance:e.target.value}))}/></FF>
              <FF label="Genre"><select style={S.inp} value={editAth.genre||(editAth.category?.includes("F")?"F":"H")} onChange={e=>setEditAth(p=>({...p,genre:e.target.value}))}><option value="H">Homme</option><option value="F">Femme</option></select></FF>
            </div>
            {(editAth.date_naissance||(editAth.age&&editAth.age>0))&&(()=>{const age=editAth.date_naissance?calcAgeFromDOB(editAth.date_naissance):editAth.age;const genre=editAth.genre||(editAth.category?.includes("F")?"F":"H");const cat=getCategoryFromAge(age,genre);return(<div style={{padding:"8px 12px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,fontSize:13}}><span style={{color:"#64748b"}}>Catégorie : </span><span style={{color:"#0ea5e9",fontWeight:700}}>{cat}</span><span style={{color:"#64748b"}}> · {age} ans</span></div>);})()}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="Poids (kg)"><input style={S.inp} type="number" value={editAth.weight} onChange={e=>setEditAth(p=>({...p,weight:e.target.value}))}/></FF>
              
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

        {tab==="athlete_detail"&&selAth&&(()=>{
          const a=athletes.find(x=>x.id===selAth);
          if(!a) return null;
          const perfs=getPerfFor(selAth);
          const perfs2k=perfs.filter(p=>(p.distance_type||"2000m")==="2000m");
          const best=getBestTime(perfs2k), last=getLastPerf(perfs2k);
          const bestW=best?concept2WattsFast(best.time, best.distance_type||"2000m"):null;
          const lastW=last?concept2WattsFast(last.time, last.distance_type||"2000m"):null;
          const wpkg=bestW&&a.weight?(bestW/a.weight).toFixed(2):null;
          const aCrew=getCrewForAthlete(a);
          const crewMemberList=aCrew?athletes.filter(x=>crewMembers.some(m=>m.crew_id===aCrew.id&&m.athlete_id===x.id)):[];
          // Tous les bateaux de l'athlète (via tous ses équipages)
          const allCrewsAth=crewMembers.filter(m=>m.athlete_id===a.id).map(m=>({
            crew:crews.find(c=>c.id===m.crew_id),
            poste:crewMembers.filter(x=>x.crew_id===m.crew_id).findIndex(x=>x.athlete_id===a.id)+1
          })).filter(x=>x.crew);
          const athBoats=allCrewsAth.reduce((acc,{crew,poste})=>{
            const bc=boatCrews.find(x=>x.crew_id===crew.id);
            if(!bc) return acc;
            const boat=boats.find(b=>b.id===bc.boat_id);
            if(!boat||acc.find(x=>x.boat.id===boat.id)) return acc;
            return [...acc,{boat,poste,crew}];
          },[]);
          const activeBId=selBoatDetail&&athBoats.find(x=>x.boat.id===selBoatDetail)?selBoatDetail:(athBoats[0]?.boat.id||null);
          const activeBEntry=athBoats.find(x=>x.boat.id===activeBId)||null;
          const myBoat=activeBEntry?.boat||null;
          const poste=activeBEntry?.poste||null;
          const mySettings=myBoat?boatSettings.filter(s=>s.boat_id===myBoat.id&&s.poste===poste).sort((x,y)=>y.date_reglage.localeCompare(x.date_reglage)):[];
          const lastSetting=mySettings[0]||null;
          const ageDisplay=a.date_naissance?calcRealAge(a.date_naissance):a.age;
          const ageFederal=a.date_naissance?calcAgeFromDOB(a.date_naissance):a.age;
          const ageCat=a.date_naissance?getAgeCatFromBirthYear(new Date(a.date_naissance).getFullYear()):getAgeCategory(a.age);
          return(
            <div style={S.page}>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#0ea5e930",padding:"6px 14px",fontSize:13}} onClick={()=>setTab("athletes")}>← Retour</button>
                <div style={{flex:1}}><h1 style={{...S.ttl,margin:0}}>{a.name}</h1><p style={{...S.sub,margin:0}}>{a.category} — {ageCat}</p></div>
                <button style={{...S.btnP,background:"#0ea5e9",color:"#0f1923"}} onClick={()=>setEditAth({...a})}>✏️ Modifier</button>
              </div>
              {/* Onglets fiche */}
              <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
                {[["general","📋 Général"],["muscu","💪 Muscu"],["morpho","⚖️ Morpho"]].map(([k,l])=>(
                  <button key={k} style={{...S.fb,...(ficheTab===k?S.fbon:{})}} onClick={()=>setFicheTab(k)}>{l}</button>
                ))}
              </div>

              <div style={{display:ficheTab==="general"?"grid":"none",gridTemplateColumns:isMobile?"1fr":"320px 1fr",gap:isMobile?12:20,marginBottom:20}}>
                {/* Left: Identity card */}
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div style={{...S.card,borderTop:"3px solid #0ea5e9",textAlign:"center",padding:"24px 20px"}}>
                    <div style={{position:"relative",display:"inline-block",marginBottom:16}}>
                      {a.photo_url
                        ?<img src={a.photo_url} style={{width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid #0ea5e940"}} onError={e=>{e.target.style.display="none";}}/>
                        :<div style={{...S.av,width:90,height:90,fontSize:32,background:"#0ea5e920",border:"2px solid #0ea5e940",color:"#0ea5e9",margin:"0 auto"}}>{a.avatar}</div>
                      }
                    </div>
                    <div style={{fontSize:20,fontWeight:900,color:"#f1f5f9",marginBottom:4}}>{a.name}</div>
                    <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
                      <span style={{...S.badge,background:"#0ea5e920",color:"#0ea5e9",border:"1px solid #0ea5e940"}}>{a.category}</span>
                      <span style={{...S.badge,background:(AGE_CAT_COLORS[ageCat]||"#374151")+"25",color:AGE_CAT_COLORS[ageCat]||"#94a3b8",border:"1px solid "+(AGE_CAT_COLORS[ageCat]||"#374151")+"40"}}>{ageCat}</span>
                      
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,textAlign:"left"}}>
                      {[
                        {l:"Âge",v:ageDisplay?""+ageDisplay+" ans":"--"},
                        {l:"Poids",v:a.weight?a.weight+" kg":"--"},
                        {l:"Taille",v:a.taille?a.taille+" cm":"--"},
                        {l:"Date naiss.",v:a.date_naissance||"--"},
                        {l:"Genre",v:a.genre||"--"},
                        
                      ].map((k,i)=>(
                        <div key={i} style={{background:"#1e293b50",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{color:"#5a7a9a",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
                          <div style={{color:"#f1f5f9",fontWeight:700,fontSize:14,marginTop:2}}>{k.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mensurations */}
                  <div style={S.card}>
                    <div style={{...S.st,marginBottom:14}}>📐 Mensurations</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[
                        {l:"Envergure",v:a.envergure?a.envergure+" cm":"--"},
                        {l:"Long. bras",v:a.longueur_bras?a.longueur_bras+" cm":"--"},
                        {l:"Larg. épaules",v:a.largeur_epaules?a.largeur_epaules+" cm":"--"},
                        {l:"Taille assise",v:a.taille_assise?a.taille_assise+" cm":"--"},
                      ].map((k,i)=>(
                        <div key={i} style={{background:"#1e293b50",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{color:"#5a7a9a",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
                          <div style={{color:"#f1f5f9",fontWeight:700,fontSize:14,marginTop:2}}>{k.v}</div>
                        </div>
                      ))}
                    </div>
                    {(!a.envergure&&!a.longueur_bras&&!a.largeur_epaules&&!a.taille_assise)&&
                      <div style={{color:"#5a7a9a",fontSize:12,textAlign:"center",padding:"8px 0",marginTop:4}}>Aucune mensuration renseignée</div>
                    }
                  </div>
                </div>

                {/* Right: Stats + perfs */}
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {/* KPIs */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                    {[
                      {l:`Best ${best?.distance_type||"2000m"}`,v:best?.time??"--",c:"#4ade80"},
                      {l:"Watts (best)",v:bestW?bestW+"W":"--",c:"#0ea5e9"},
                      {l:"W/kg",v:wpkg??"--",c:"#a78bfa"},
                      {l:"Sessions",v:perfs.length,c:"#f59e0b"},
                    ].map((k,i)=>(
                      <div key={i} style={{...S.kpi,padding:"16px"}}>
                        <div style={{color:k.c,fontSize:22,fontWeight:900}}>{k.v}</div>
                        <div style={{color:"#7a95b0",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{k.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Dernières perfs */}
                  <div style={S.card}>
                    <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",marginBottom:14,flexDirection:isMobile?"column":"row",gap:isMobile?8:0}}>
                      <div style={S.st}>⚡ Dernières performances</div>
                      <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#0ea5e930",fontSize:12}} onClick={()=>setTab("performances")}>Voir tout →</button>
                    </div>
                    {perfs.length===0
                      ?<div style={{color:"#5a7a9a",fontSize:13,textAlign:"center",padding:"20px 0"}}>Aucune performance enregistrée</div>
                      :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {[...perfs].reverse().slice(0,5).map(p=>{
                          const pw=concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts||0;
                          const pwkg=pw&&a.weight?(pw/a.weight).toFixed(2):null;
                          const isBest=p.id===best?.id;
                          return(
                            <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"#1e293b50",borderRadius:8,border:isBest?"1px solid #4ade8040":"1px solid transparent"}}>
                              {isBest&&<span style={{color:"#4ade80",fontSize:10,fontWeight:700,minWidth:28}}>BEST</span>}
                              {!isBest&&<span style={{minWidth:28}}/>}
                              <span style={{color:"#7a95b0",fontSize:12,minWidth:85}}>{p.date}</span>
                              <span style={{color:"#4ade80",fontWeight:800,fontSize:15,minWidth:55}}>{p.time}</span>
                              <span style={{color:"#0ea5e9",fontWeight:700}}>⚡{pw}W</span>
                              {pwkg&&<span style={{color:"#a78bfa",fontSize:12}}>{pwkg} W/kg</span>}
                              <span style={{marginLeft:"auto",color:"#ef4444",fontSize:12}}>{p.hr?p.hr+" bpm":""}</span>
                              <span style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff",fontSize:10}}>{p.rpe}/10</span>
                            </div>
                          );
                        })}
                      </div>
                    }
                  </div>

                  {/* Équipage + Réglages */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div style={S.card}>
                      <div style={{...S.st,marginBottom:12}}>🚣 Équipage</div>
                      {aCrew
                        ?<>
                          <div style={{fontWeight:800,color:"#f1f5f9",marginBottom:4}}>{aCrew.name}</div>
                          <div style={{color:"#7a95b0",fontSize:12,marginBottom:10}}>{aCrew.boat}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {crewMemberList.map(m=>(
                              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                                <div style={{...S.av,width:24,height:24,fontSize:11,flexShrink:0}}>{m.avatar}</div>
                                <span style={{color:m.id===a.id?"#0ea5e9":"#a8bfd4",fontSize:12,fontWeight:m.id===a.id?700:400}}>{m.name}{m.id===a.id?" ★":""}</span>
                              </div>
                            ))}
                          </div>
                        </>
                        :<div style={{color:"#5a7a9a",fontSize:12,textAlign:"center",padding:"12px 0"}}>Aucun équipage</div>
                      }
                    </div>
                    <div style={S.card}>
                      <div style={{...S.st,marginBottom:12}}>🛶 Réglages bateau</div>
                      {athBoats.length>1&&(
                        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                          {athBoats.map(({boat})=>(
                            <button key={boat.id} style={{...S.fb,...(activeBId===boat.id?S.fbon:{})}} onClick={()=>setSelBoatDetail(boat.id)}>
                              {boat.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {lastSetting
                        ?<div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {[
                            {l:"Bateau",v:myBoat?.name||"--"},
                            {l:"Poste",v:poste?"#"+poste:"--"},
                            {l:"Entraxe",v:lastSetting.entraxe?lastSetting.entraxe+" cm":"--"},
                            {l:"Long. Pelles",v:lastSetting.longueur_pedale?lastSetting.longueur_pedale+" cm":"--"},
                            {l:"Levier int.",v:lastSetting.levier_interieur?lastSetting.levier_interieur+" cm":"--"},
                          ].map((k,i)=>(
                            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1e293b50"}}>
                              <span style={{color:"#5a7a9a",fontSize:12}}>{k.l}</span>
                              <span style={{color:"#f1f5f9",fontWeight:700,fontSize:12}}>{k.v}</span>
                            </div>
                          ))}
                          <div style={{color:"#7a95b0",fontSize:10,marginTop:4}}>Réglé le {lastSetting.date_reglage}</div>
                          {mySettings.length>1&&(
                            <div style={{marginTop:8,borderTop:"1px solid #1e293b",paddingTop:8}}>
                              <div style={{color:"#5a7a9a",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Historique</div>
                              {mySettings.slice(1,4).map((s,i)=>(
                                <div key={i} style={{display:"flex",gap:8,fontSize:11,color:"#7a95b0",padding:"3px 0",borderBottom:"1px solid #1e293b30"}}>
                                  <span style={{minWidth:80}}>{s.date_reglage}</span>
                                  {s.entraxe&&<span>Entr. {s.entraxe}cm</span>}
                                  {s.longueur_pedale&&<span>Pelles {s.longueur_pedale}cm</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        :<div style={{color:"#5a7a9a",fontSize:12,textAlign:"center",padding:"12px 0"}}>{athBoats.length===0?"Aucun bateau lié":"Aucun réglage pour ce bateau"}</div>
                      }
                    </div>
                  </div>
                </div>
              </div>
            {ficheTab==="muscu"&&(()=>{
              const EXOS=["Squat","Hip Thrust","RDL","Soulevé de terre","Développé couché","Tirades rowing","Tractions lestées","Leg press","Fentes","Rowing barre"];
              const athStrength=strengthSessions;
              // Best 1RM per exercise
              const bests=EXOS.reduce((acc,ex)=>{
                const rows=athStrength.filter(s=>s.exercice===ex).sort((a,b)=>b.one_rm-a.one_rm);
                acc[ex]=rows[0]||null; return acc;
              },{});
              // Chart data for selected exercise
              const exoSessions=athStrength.filter(s=>s.exercice===selStrengthExo).sort((a,b)=>a.date.localeCompare(b.date));
              const chartData=exoSessions.map(s=>({date:s.date,oneRM:s.one_rm,Volume:Math.round(s.volume)}));
              // Last 5 sessions grouped by date
              const recentDates=[...new Set(athStrength.map(s=>s.date))].sort((a,b)=>b.localeCompare(a)).slice(0,5);
              return(
                <div style={{marginTop:8}}>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                    <div style={S.st}>💪 Musculation</div>
                    <button style={{...S.btnP,background:"#f97316",color:"#0f1923",padding:"7px 16px",fontSize:13}} onClick={()=>setShowStrengthForm(v=>!v)}>{showStrengthForm?"Annuler":"+ Séance"}</button>
                  </div>
                  {/* Form */}
                  {showStrengthForm&&(
                    <div style={{...S.card,marginBottom:16,border:"1px solid #f9731640"}}>
                      <div style={{...S.st,marginBottom:12,color:"#f97316"}}>Nouvelle séance</div>
                      <FF label="Date"><input style={S.inp} type="date" value={newStrength.date} onChange={e=>setNewStrength(v=>({...v,date:e.target.value}))}/></FF>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:6,marginBottom:8,alignItems:"center"}}>
                        <span style={{color:"#5a7a9a",fontSize:11,textTransform:"uppercase"}}>Exercice</span>
                        <span style={{color:"#5a7a9a",fontSize:11,textTransform:"uppercase"}}>Séries</span>
                        <span style={{color:"#5a7a9a",fontSize:11,textTransform:"uppercase"}}>Reps</span>
                        <span style={{color:"#5a7a9a",fontSize:11,textTransform:"uppercase"}}>Charge kg</span>
                        <span></span>
                      </div>
                      {newStrength.exercices.map((ex,i)=>{
                        const rm=ex.charge&&ex.reps?parseFloat((parseFloat(ex.charge)*(1+parseFloat(ex.reps)/30)).toFixed(1)):null;
                        return(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:6,marginBottom:6,alignItems:"center"}}>
                            <select style={{...S.inp,padding:"6px 8px"}} value={ex.exercice} onChange={e=>{const arr=[...newStrength.exercices];arr[i]={...arr[i],exercice:e.target.value};setNewStrength(v=>({...v,exercices:arr}));}}>
                              {EXOS.map(o=><option key={o} value={o}>{o}</option>)}
                              <option value="Autre...">Autre...</option>
                            </select>
                            {ex.exercice==="Autre..."&&<input style={{...S.inp,padding:"6px 8px",gridColumn:"span 1"}} placeholder="Exercice..." value={ex.customEx||""} onChange={e=>{const arr=[...newStrength.exercices];arr[i]={...arr[i],customEx:e.target.value};setNewStrength(v=>({...v,exercices:arr}));}}/>}
                            <input style={{...S.inp,padding:"6px 8px"}} type="number" placeholder="3" value={ex.series} onChange={e=>{const arr=[...newStrength.exercices];arr[i]={...arr[i],series:e.target.value};setNewStrength(v=>({...v,exercices:arr}));}}/>
                            <input style={{...S.inp,padding:"6px 8px"}} type="number" placeholder="6" value={ex.reps} onChange={e=>{const arr=[...newStrength.exercices];arr[i]={...arr[i],reps:e.target.value};setNewStrength(v=>({...v,exercices:arr}));}}/>
                            <div style={{position:"relative"}}>
                              <input style={{...S.inp,padding:"6px 8px"}} type="number" placeholder="80" value={ex.charge} onChange={e=>{const arr=[...newStrength.exercices];arr[i]={...arr[i],charge:e.target.value};setNewStrength(v=>({...v,exercices:arr}));}}/>
                              {rm&&<div style={{position:"absolute",top:-18,right:0,fontSize:9,color:"#f97316",whiteSpace:"nowrap"}}>≈{rm}kg 1RM</div>}
                            </div>
                            <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430",padding:"4px 8px"}} onClick={()=>{const arr=newStrength.exercices.filter((_,j)=>j!==i);setNewStrength(v=>({...v,exercices:arr}));}}>✕</button>
                          </div>
                        );
                      })}
                      <div style={{display:"flex",gap:8,marginTop:8}}>
                        <button style={{...S.fb,flex:1}} onClick={()=>setNewStrength(v=>({...v,exercices:[...v.exercices,{exercice:"Squat",series:"",reps:"",charge:""}]}))}>+ Exercice</button>
                        <button style={{...S.btnP,flex:2,background:"#f97316",color:"#0f1923"}} onClick={addStrengthSession}>💾 Enregistrer la séance</button>
                      </div>
                    </div>
                  )}
                  {/* Records dashboard */}
                  {athStrength.length>0&&(
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:16}}>
                        {EXOS.filter(ex=>bests[ex]).map(ex=>{
                          const b=bests[ex];
                          return(
                            <div key={ex} style={{...S.card,padding:"10px 12px",cursor:"pointer",border:selStrengthExo===ex?"1px solid #f97316":"1px solid #1e293b",background:selStrengthExo===ex?"#f9731610":"#182030"}} onClick={()=>setSelStrengthExo(ex)}>
                              <div style={{color:"#5a7a9a",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{ex}</div>
                              <div style={{color:"#f97316",fontWeight:900,fontSize:18}}>{b.one_rm}kg</div>
                              <div style={{color:"#7a95b0",fontSize:10}}>1RM estimé</div>
                              <div style={{color:"#5a7a9a",fontSize:10}}>{b.series}×{b.reps}×{b.charge}kg</div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Progression chart */}
                      {chartData.length>1&&(
                        <div style={{...S.card,marginBottom:16}}>
                          <div style={{color:"#f97316",fontWeight:700,marginBottom:12,fontSize:13}}>📈 Progression {selStrengthExo}</div>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chartData}>
                              <XAxis dataKey="date" tick={{fill:"#5a7a9a",fontSize:10}} tickFormatter={d=>d.slice(5)}/>
                              <YAxis tick={{fill:"#5a7a9a",fontSize:10}}/>
                              <Tooltip contentStyle={{background:"#182030",border:"1px solid #1e293b",borderRadius:8}} labelStyle={{color:"#f97316"}} itemStyle={{color:"#f1f5f9"}}/>
                              <Legend wrapperStyle={{fontSize:11}}/>
                              <Line type="monotone" dataKey="oneRM" stroke="#f97316" strokeWidth={2} dot={{fill:"#f97316",r:3}}/>
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {/* Recent sessions */}
                      <div style={S.card}>
                        <div style={{color:"#f97316",fontWeight:700,marginBottom:12,fontSize:13}}>📋 Dernières séances</div>
                        {recentDates.map(date=>{
                          const dayRows=athStrength.filter(s=>s.date===date);
                          return(
                            <div key={date} style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #1e293b"}}>
                              <div style={{color:"#7a95b0",fontSize:11,marginBottom:6,fontWeight:700}}>{date}</div>
                              {dayRows.map(s=>(
                                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:12}}>
                                  <span style={{color:"#f1f5f9",fontWeight:700,minWidth:130}}>{s.exercice}</span>
                                  <span style={{color:"#7a95b0"}}>{s.series}×{s.reps} @ {s.charge}kg</span>
                                  <span style={{color:"#f97316",marginLeft:"auto",fontWeight:700}}>≈{s.one_rm}kg</span>
                                  <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430",padding:"2px 6px",fontSize:11}} onClick={()=>deleteStrengthSession(s.id)}>✕</button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {athStrength.length===0&&!showStrengthForm&&(
                    <div style={{...S.card,textAlign:"center",padding:"32px 20px",color:"#5a7a9a"}}>
                      <div style={{fontSize:32,marginBottom:8}}>💪</div>
                      <div style={{fontSize:13}}>Aucune séance enregistrée</div>
                      <div style={{fontSize:11,marginTop:4}}>Clique sur "+ Séance" pour commencer</div>
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
          );
        })()}
        {tab==="performances"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={S.ph}><div><h1 style={S.ttl}>Performances</h1><p style={S.sub}>Vue globale</p></div><button style={S.btnP} onClick={()=>{setNP(p=>({...p,athleteId:selAth||""}));setShowAddPerf(true);}}>+ Ajouter</button></div>          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            <button style={{...S.fb,...(selAth===null?S.fbon:{})}} onClick={()=>setSelAth(null)}>Tous</button>
            {athletes.map(a=><button key={a.id} style={{...S.fb,...(selAth===a.id?S.fbon:{})}} onClick={()=>setSelAth(a.id)}>{a.name}</button>)}
          </div>
          {selAth&&(()=>{const a=athletes.find(x=>x.id===selAth);if(!a)return null;const perfs=getPerfFor(selAth),perfs2k=perfs.filter(p=>(p.distance_type||"2000m")==="2000m"),best=getBestTime(perfs2k),last=getLastPerf(perfs2k),wpkg=best&&a.weight?(concept2WattsFast(best.time,"2000m")/a.weight).toFixed(2):null;return(<div style={{...S.card,display:"flex",alignItems:"center",gap:16,marginBottom:16}}><div style={{...S.av,backgroundImage:a.photo_url?`url(${a.photo_url})`:"none",backgroundSize:"cover",backgroundPosition:"center"}}>{!a.photo_url&&a.avatar}</div><div style={{flex:1}}><div style={{fontSize:18,fontWeight:800,color:"#f1f5f9"}}>{a.name}</div><div style={{color:"#7a95b0",fontSize:13}}>{a.category} - {a.weight}kg</div></div><button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>setEditAth({...a})}>✏️ Edit</button><div style={{display:"flex",gap:10}}><div style={{background:"#4ade8015",border:"1px solid #4ade8030",borderRadius:10,padding:"10px 16px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Best {best?.distance_type||"2k"}</div><div style={{color:"#4ade80",fontWeight:900,fontSize:22}}>{best?.time??"-"}</div></div><div style={{background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:10,padding:"10px 16px",textAlign:"center"}}><div style={{color:"#7a95b0",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>W/kg</div><div style={{color:"#a78bfa",fontWeight:900,fontSize:22}}>{wpkg??"-"}</div></div></div></div>);})()}
          <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
              <thead><tr>{["Athlète","Date","Distance","Temps","Best","W/kg","Watts","FC","RPE","Km",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{performances.filter(p=>selAth===null||p.athlete_id===selAth).sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{const a=athletes.find(x=>x.id===p.athlete_id);const best=getBestTime(getPerfFor(p.athlete_id).filter(x=>(x.distance_type||"2000m")===(p.distance_type||"2000m")));return(<tr key={p.id} style={{borderBottom:"1px solid #1e293b"}}><td style={S.td}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:28,height:28,fontSize:11}}>{a?.avatar}</div>{a?.name}</div></td><td style={{...S.td,color:"#7a95b0"}}>{p.date}</td><td style={{...S.td,color:"#7a95b0",fontSize:11}}><span style={{background:"#1e293b",padding:"2px 7px",borderRadius:5}}>{p.distance_type||"2000m"}</span></td><td style={{...S.td,color:"#0ea5e9",fontWeight:700}}>{p.time}</td><td style={{...S.td,color:"#4ade80",fontWeight:700}}>{best?.time??"-"}</td><td style={{...S.td,color:"#a78bfa",fontWeight:700}}>{a&&a.weight?((concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts)/a.weight).toFixed(2):"--"}</td><td style={{...S.td,color:"#0ea5e9"}}>{concept2WattsFast(p.time, p.distance_type||"2000m")||p.watts}W</td><td style={{...S.td,color:"#ef4444"}}>{p.hr}</td><td style={S.td}><div style={{...S.badge,background:`hsl(${(10-p.rpe)*12},80%,40%)`,color:"#fff"}}>{p.rpe}/10</div></td><td style={{...S.td,color:"#f97316"}}>{p.distance}km</td><td style={S.td}><div style={{display:"flex",gap:4}}><button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>setEditPerf({...p})}>✏️</button><button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={async()=>{await api.deletePerf(p.id);load();setToast({m:"Performance supprimée",t:"success"});}}>✕</button></div></td></tr>);})}
              </tbody>
            </table>
          </div>
          {showAddPerf&&<Modal title="Nouvelle performance" onClose={()=>setShowAddPerf(false)}>
            <FF label="Athlète"><select style={S.inp} value={newPerf.athleteId} onChange={e=>setNP(p=>({...p,athleteId:e.target.value}))}><option value="">Sélectionner...</option>{athletes.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></FF>
            <FF label="Date"><input style={S.inp} type="date" value={newPerf.date} onChange={e=>setNP(p=>({...p,date:e.target.value}))}/></FF>
            <FF label="Distance"><select style={S.inp} value={newPerf.distance_type} onChange={e=>setNP(p=>({...p,distance_type:e.target.value}))}><option>500m</option><option>1000m</option><option>2000m</option></select></FF>
            <FF label={`Temps ${newPerf.distance_type||"2000m"}`}><input style={S.inp} placeholder="6:45.0" value={newPerf.time} onChange={e=>setNP(p=>({...p,time:e.target.value}))}/></FF>
            {newPerf.time&&concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m")&&(()=>{const w=concept2WattsFast(newPerf.time, newPerf.distance_type||"2000m");const ath=athletes.find(a=>a.id==newPerf.athleteId);const wpkgVal=ath?.weight?(w/ath.weight).toFixed(2):null;return(
              <div style={{padding:"10px 14px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,display:"flex",gap:16,alignItems:"center"}}>
                <span style={{color:"#0ea5e9",fontWeight:700,fontSize:15}}>⚡ {w} W</span>
                {wpkgVal&&<span style={{color:"#a78bfa",fontWeight:700,fontSize:15}}>= {wpkgVal} W/kg</span>}
                <span style={{color:"#5a7a9a",fontSize:11,marginLeft:"auto"}}>Concept2 auto</span>
              </div>
            );})()}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="SPM"><input style={S.inp} type="number" value={newPerf.spm} onChange={e=>setNP(p=>({...p,spm:e.target.value}))}/></FF>
              <FF label="FC"><input style={S.inp} type="number" value={newPerf.hr} onChange={e=>setNP(p=>({...p,hr:e.target.value}))}/></FF>
              <FF label="RPE"><input style={S.inp} type="number" min="1" max="10" value={newPerf.rpe} onChange={e=>setNP(p=>({...p,rpe:e.target.value}))}/></FF>
              <FF label="Distance (km)"><input style={S.inp} type="number" value={newPerf.distance} onChange={e=>setNP(p=>({...p,distance:e.target.value}))}/></FF>
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addPerf}>Enregistrer</button>
          </Modal>}
          {editPerf&&<Modal title="Éditer la performance" onClose={()=>setEditPerf(null)}>
            <FF label="Date"><input style={S.inp} type="date" value={editPerf.date} onChange={e=>setEditPerf(p=>({...p,date:e.target.value}))}/></FF>
            <FF label="Distance"><select style={S.inp} value={editPerf.distance_type||"2000m"} onChange={e=>setEditPerf(p=>({...p,distance_type:e.target.value}))}><option>500m</option><option>1000m</option><option>2000m</option></select></FF>
            <FF label={`Temps ${editPerf.distance_type||"2000m"}`}><input style={S.inp} placeholder="6:45" value={editPerf.time} onChange={e=>setEditPerf(p=>({...p,time:e.target.value}))}/></FF>
            {editPerf.time&&concept2WattsFast(editPerf.time, editPerf.distance_type||"2000m")&&(()=>{const w=concept2WattsFast(editPerf.time, editPerf.distance_type||"2000m");const ath=athletes.find(a=>a.id===editPerf.athlete_id);const wpkgVal=ath?.weight?(w/ath.weight).toFixed(2):null;return(<div style={{padding:"10px 14px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,display:"flex",gap:16,alignItems:"center"}}><span style={{color:"#0ea5e9",fontWeight:700,fontSize:15}}>⚡ {w} W</span>{wpkgVal&&<span style={{color:"#a78bfa",fontWeight:700,fontSize:15}}>= {wpkgVal} W/kg</span>}<span style={{color:"#5a7a9a",fontSize:11,marginLeft:"auto"}}>Concept2 auto</span></div>);})()}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="FC (bpm)"><input style={S.inp} type="number" value={editPerf.hr} onChange={e=>setEditPerf(p=>({...p,hr:e.target.value}))}/></FF>
              <FF label="RPE (1-10)"><input style={S.inp} type="number" min="1" max="10" value={editPerf.rpe} onChange={e=>setEditPerf(p=>({...p,rpe:e.target.value}))}/></FF>
              <FF label="Distance (km)"><input style={S.inp} type="number" value={editPerf.distance} onChange={e=>setEditPerf(p=>({...p,distance:e.target.value}))}/></FF>
            </div>
            <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={saveEditPerf}>Enregistrer</button>
          </Modal>}
        </div>)}

        {tab==="athlete_detail"&&selAth&&ficheTab==="morpho"&&(()=>{
          const sorted=[...bodyMeasurements].sort((a,b)=>a.date.localeCompare(b.date));
          const lastM=sorted[sorted.length-1]||null;
          const chartData=sorted.map(m=>({date:m.date,Poids:m.poids,MG:m.masse_grasse,IMC:m.imc}));
          return(
            <div style={{...S.card,marginTop:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={S.st}>⚖️ Suivi morphologique</div>
                <button style={{...S.btnP,background:"#0ea5e9",color:"#0f1923",padding:"7px 16px",fontSize:13}} onClick={()=>setShowMorphoForm(v=>!v)}>{showMorphoForm?"Annuler":"+ Mesure"}</button>
              </div>
              {showMorphoForm&&(
                <div style={{background:"#111827",border:"1px solid #1e293b",borderRadius:12,padding:"16px",marginBottom:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:12}}>
                    <FF label="Date"><input style={S.inp} type="date" value={newMorpho.date} onChange={e=>setNewMorpho(p=>({...p,date:e.target.value}))}/></FF>
                    <FF label="Poids (kg)"><input style={S.inp} type="number" step="0.1" placeholder="72.5" value={newMorpho.poids} onChange={e=>setNewMorpho(p=>({...p,poids:e.target.value}))}/></FF>
                    <FF label="Taille (cm)"><input style={S.inp} type="number" step="0.5" placeholder="180" value={newMorpho.taille} onChange={e=>setNewMorpho(p=>({...p,taille:e.target.value}))}/></FF>
                    <FF label="Masse grasse (%)"><input style={S.inp} type="number" step="0.1" placeholder="12.5" value={newMorpho.masse_grasse} onChange={e=>setNewMorpho(p=>({...p,masse_grasse:e.target.value}))}/></FF>
                  </div>
                  {newMorpho.poids&&newMorpho.taille&&(()=>{const imc=(parseFloat(newMorpho.poids)/((parseFloat(newMorpho.taille)/100)**2)).toFixed(1);return(<div style={{padding:"8px 14px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:12,fontSize:13,color:"#0ea5e9",fontWeight:700}}>IMC auto : {imc}</div>);})()}
                  <button style={{...S.btnP,background:"#0ea5e9",color:"#0f1923",width:"100%"}} onClick={addMorpho}>Enregistrer la mesure</button>
                </div>
              )}
              {lastM&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
                  {[
                    {l:"Poids",v:lastM.poids?lastM.poids+"kg":"-",c:"#4ade80"},
                    {l:"Taille",v:lastM.taille?lastM.taille+"cm":"-",c:"#0ea5e9"},
                    {l:"Masse grasse",v:lastM.masse_grasse?lastM.masse_grasse+"%":"-",c:"#f59e0b"},
                    {l:"IMC",v:lastM.imc??"-",c:"#a78bfa"},
                  ].map((k,i)=>(
                    <div key={i} style={{background:"#1e293b50",borderRadius:10,padding:"12px",textAlign:"center"}}>
                      <div style={{color:"#5a7a9a",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{k.l}</div>
                      <div style={{color:k.c,fontWeight:900,fontSize:20}}>{k.v}</div>
                      <div style={{color:"#5a7a9a",fontSize:10,marginTop:2}}>{lastM.date}</div>
                    </div>
                  ))}
                </div>
              )}
              {chartData.length>=2&&(
                <div style={{marginBottom:16}}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:0}}>
                      <XAxis dataKey="date" tick={{fill:"#5a7a9a",fontSize:10}} tickLine={false}/>
                      <YAxis tick={{fill:"#5a7a9a",fontSize:10}} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{background:"#182030",border:"1px solid #334155",borderRadius:8,fontSize:12}}/>
                      <Legend wrapperStyle={{fontSize:11,color:"#7a95b0"}}/>
                      <Line type="monotone" dataKey="Poids" stroke="#4ade80" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                      <Line type="monotone" dataKey="MG" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                      <Line type="monotone" dataKey="IMC" stroke="#a78bfa" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {bodyMeasurements.length>0?(
                <div>
                  <div style={{color:"#5a7a9a",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Historique ({bodyMeasurements.length} mesures)</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {bodyMeasurements.map(m=>(
                      <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"#111827",borderRadius:8,fontSize:13}}>
                        <span style={{color:"#7a95b0",minWidth:90}}>{m.date}</span>
                        {m.poids&&<span style={{color:"#4ade80",fontWeight:700}}>{m.poids} kg</span>}
                        {m.taille&&<span style={{color:"#0ea5e9"}}>{m.taille} cm</span>}
                        {m.masse_grasse&&<span style={{color:"#f59e0b"}}>{m.masse_grasse}% MG</span>}
                        {m.imc&&<span style={{color:"#a78bfa"}}>IMC {m.imc}</span>}
                        <button style={{marginLeft:"auto",background:"none",border:"none",color:"#ef444460",cursor:"pointer",fontSize:14}} onClick={()=>deleteMorpho(m.id)}>🗑</button>
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div style={{color:"#5a7a9a",fontSize:13,textAlign:"center",padding:"20px 0"}}>Aucune mesure enregistrée</div>
              )}
            </div>
          );
        })()}

        {tab==="compare"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={S.ph}><div><h1 style={S.ttl}>Comparer</h1><p style={S.sub}>2 à 4 athlètes</p></div>
            <div style={{display:"flex",gap:6}}>{"500m 1000m 2000m".split(" ").map(t=><button key={t} onClick={()=>setCompareType(t)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${compareType===t?"#22d3ee":"#1e293b"}`,background:compareType===t?"#22d3ee20":"transparent",color:compareType===t?"#22d3ee":"#5a7a9a",fontSize:12,cursor:"pointer",fontWeight:compareType===t?700:400}}>{t}</button>)}</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>{athletes.map(a=>{const on=compareIds.includes(a.id);return(<button key={a.id} style={{...S.fb,...(on?{background:"#22d3ee20",border:"1px solid #22d3ee60",color:"#0ea5e9"}:{})}} onClick={()=>setCompareIds(prev=>prev.includes(a.id)?(prev.length>2?prev.filter(x=>x!==a.id):prev):prev.length<4?[...prev,a.id]:prev)}>{on?"v ":""}{a.name}</button>);})}</div>
          {compareIds.length>=2&&(()=>{
            const cmp=compareIds.map(id=>{const a=athletes.find(x=>x.id===id);const perfs=getPerfFor(id).filter(p=>(p.distance_type||"2000m")===compareType),last=getLastPerf(perfs),best=getBestTime(perfs);return{...a,last,best,wpkg:best&&a.weight?(concept2WattsFast(best.time, best.distance_type||"2000m")/a.weight).toFixed(2):null,perfs};});
            const rows=[{label:`Meilleur ${compareType}`,fn:c=>c.best?.time??"--",bfn:c=>c.best?timeToSeconds(c.best.time):9999,lower:true,c:"#4ade80"},{label:"Puissance",fn:c=>c.best?`${concept2WattsFast(c.best.time, c.best.distance_type||"2000m")||0}W`:"--",bfn:c=>c.best?concept2WattsFast(c.best.time, c.best.distance_type||"2000m")||0:0,lower:false,c:"#0ea5e9"},{label:"W/kg",fn:c=>c.wpkg??"-",bfn:c=>parseFloat(c.wpkg)||0,lower:false,c:"#a78bfa"},{label:"Sessions",fn:c=>c.perfs.length,bfn:c=>c.perfs.length,lower:false,c:"#f97316"}];
            return(<>
              <div style={{display:"grid",gridTemplateColumns:`140px repeat(${cmp.length},1fr)`,gap:2,marginBottom:2}}><div/>{cmp.map((c,i)=><div key={c.id} style={{...S.card,textAlign:"center",borderTop:`3px solid ${CMP_COLORS[i]}`,padding:"12px 8px"}}><div style={{...S.av,margin:"0 auto 8px",border:`2px solid ${CMP_COLORS[i]}`}}>{c.avatar}</div><div style={{fontWeight:800,color:"#f1f5f9",fontSize:13}}>{c.name}</div><div style={{color:"#7a95b0",fontSize:11}}>{c.category}</div></div>)}</div>
              {rows.map(row=>{const bests=cmp.map(c=>row.bfn(c)),bestVal=row.lower?Math.min(...bests):Math.max(...bests),barMax=row.lower?Math.max(...bests):bestVal;return(<div key={row.label} style={{display:"grid",gridTemplateColumns:`140px repeat(${cmp.length},1fr)`,gap:2,marginBottom:2}}><div style={{display:"flex",alignItems:"center",color:"#7a95b0",fontSize:13,fontWeight:600,paddingLeft:8}}>{row.label}</div>{cmp.map((c,i)=>{const val=row.bfn(c),isBest=val===bestVal,barVal=row.lower?barMax-val+Math.min(...bests):val;return(<div key={c.id} style={{...S.card,padding:"10px 12px",background:isBest?"#22d3ee08":"#182030"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{color:isBest?row.c:"#a8bfd4",fontWeight:isBest?900:600,fontSize:15,minWidth:80}}>{row.fn(c)}{isBest?" *":""}</div><div style={{flex:1,height:5,background:"#263547",borderRadius:3,overflow:"hidden"}}><div style={{width:`${barMax?Math.min((barVal/barMax)*100,100):0}%`,height:"100%",background:CMP_COLORS[i],borderRadius:3}}/></div></div></div>);})}</div>);})}
            </>);
          })()}
          {/* Scatter plot Force vs Puissance */}
          {(()=>{
            const scatterAths=(compareIds.length>0?athletes.filter(a=>compareIds.includes(a.id)):athletes).map(a=>{
              const perfs=getPerfFor(a.id).filter(p=>(p.distance_type||"2000m")===compareType),best=getBestTime(perfs);
              const wpkg=best&&a.weight?(concept2WattsFast(best.time, best.distance_type||"2000m")/a.weight):null;
              const squat=allStrengthSessions.filter(s=>s.athlete_id===a.id&&s.exercice==="Squat").sort((x,y)=>y.one_rm-x.one_rm)[0];
              const forceKg=squat&&a.weight?(squat.one_rm/a.weight):null;
              return wpkg&&forceKg?{name:a.name,wpkg:parseFloat(wpkg.toFixed(2)),force:parseFloat(forceKg.toFixed(2)),avatar:a.avatar}:null;
            }).filter(Boolean);
            if(scatterAths.length<2) return null;
            const avgWpkg=scatterAths.reduce((s,a)=>s+a.wpkg,0)/scatterAths.length;
            const avgForce=scatterAths.reduce((s,a)=>s+a.force,0)/scatterAths.length;
            const minW=Math.min(...scatterAths.map(a=>a.wpkg))-0.2;
            const maxW=Math.max(...scatterAths.map(a=>a.wpkg))+0.2;
            const minF=Math.min(...scatterAths.map(a=>a.force))-0.1;
            const maxF=Math.max(...scatterAths.map(a=>a.force))+0.1;
            const toX=(f)=>((f-minF)/(maxF-minF||1))*100;
            const toY=(w)=>(1-(w-minW)/(maxW-minW||1))*100;
            return(
              <div style={{...S.card,marginTop:20}}>
                <div style={{...S.st,marginBottom:4}}>⚡💪 Profil Force × Puissance</div>
                <div style={{color:"#5a7a9a",fontSize:11,marginBottom:16}}>Axe X = Force relative squat (1RM/kg) — Axe Y = W/kg sur {compareType}</div>
                <div style={{position:"relative",width:"100%",paddingBottom:"55%",background:"#0d1520",borderRadius:10,border:"1px solid #1e293b"}}>
                  {/* Quadrant lines */}
                  <div style={{position:"absolute",left:`${toX(avgForce)}%`,top:0,bottom:0,width:1,background:"#1e293b"}}/>
                  <div style={{position:"absolute",top:`${toY(avgWpkg)}%`,left:0,right:0,height:1,background:"#1e293b"}}/>
                  {/* Quadrant labels */}
                  <div style={{position:"absolute",left:"4%",top:"4%",fontSize:9,color:"#ef444460"}}>Force ↓ / Ergo ↑</div>
                  <div style={{position:"absolute",right:"4%",top:"4%",fontSize:9,color:"#4ade8060"}}>Force ↑ / Ergo ↑ ★</div>
                  <div style={{position:"absolute",left:"4%",bottom:"4%",fontSize:9,color:"#5a7a9a"}}>Force ↓ / Ergo ↓</div>
                  <div style={{position:"absolute",right:"4%",bottom:"4%",fontSize:9,color:"#f9731660"}}>Force ↑ / Ergo ↓</div>
                  {/* Athlete dots */}
                  {scatterAths.map((a,i)=>(
                    <div key={i} style={{position:"absolute",left:`calc(${toX(a.force)}% - 16px)`,top:`calc(${toY(a.wpkg)}% - 16px)`,display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:CMP_COLORS[i%CMP_COLORS.length]+"33",border:`2px solid ${CMP_COLORS[i%CMP_COLORS.length]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"default"}} title={`${a.name} — ${a.wpkg}W/kg ergo, ${a.force}x1RM/kg squat`}>{a.avatar}</div>
                      <div style={{fontSize:9,color:CMP_COLORS[i%CMP_COLORS.length],fontWeight:700,whiteSpace:"nowrap",marginTop:2}}>{a.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>)}

        {tab==="crew"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
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
                <button style={{...S.btnP,width:"100%",marginTop:12,opacity:!newCrewMembers.length?0.5:1}} onClick={saveNewCrew} disabled={!newCrewMembers.length}>Créer →</button>
              </div>
            </div>
            <div>
              <div style={S.st}>~ Équipages actifs ({crews.length})</div>
              {crews.map(cr=><div key={cr.id} style={{...S.card,marginBottom:12,borderTop:"3px solid #22d3ee"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <div style={{fontWeight:800,color:"#f1f5f9",fontSize:16}}>{cr.name}</div>
                  <div style={{display:"flex",gap:6}}><button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>{setEditCrew({...cr});setEditCrewMembers(getCrewMembersFor(cr.id).map(a=>a.id));}}>✏️ Modifier</button><button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>deleteCrew(cr.id)}>🗑️</button></div>
                </div>
                {(()=>{
                  const members = getCrewMembersFor(cr.id);
                  const ages = members.map(a=>a.date_naissance?calcRealAge(a.date_naissance):a.age).filter(Boolean);
                  const avgAge = ages.length ? Math.round(ages.reduce((s,a)=>s+a,0)/ages.length) : null;
                  const crewCat = avgAge ? getAgeCatFromBirthYear(new Date().getFullYear() - avgAge) : null;
                  const crewCatColor = crewCat ? (AGE_CAT_COLORS[crewCat] || "#94a3b8") : null;
                  const avgW = members.map(a=>{const{best}=aStats(a);return best?concept2WattsFast(best.time, best.distance_type||"2000m"):null;}).filter(Boolean);
                  const avgWatts = avgW.length ? Math.round(avgW.reduce((s,w)=>s+w,0)/avgW.length) : null;
                  return (<>
                    <div style={{color:"#7a95b0",fontSize:12,marginBottom:8,display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span>{cr.boat} · {members.length} rameur{members.length>1?"s":""}</span>
                      {avgAge&&<span style={{color:"#f59e0b"}}>⌀ {avgAge} ans</span>}
                      {crewCat&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:crewCatColor+"25",color:crewCatColor,fontWeight:700,border:"1px solid "+crewCatColor+"40"}}>{crewCat}</span>}
                      {avgWatts&&<span style={{color:"#0ea5e9"}}>⌀ {avgWatts}W</span>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{members.map(a=>{const{last,watts,wpkg}=aStats(a);const ageA=a.date_naissance?calcRealAge(a.date_naissance):a.age;return(<div key={a.id} style={{background:"#263547",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:8}}><div style={{...S.av,width:26,height:26,fontSize:10}}>{a.avatar}</div><div><div style={{color:"#f1f5f9",fontSize:12,fontWeight:600}}>{a.name.split(" ")[0]}{ageA?<span style={{color:"#64748b",fontSize:10,marginLeft:4}}>{ageA}ans</span>:""}</div>{last&&<div style={{color:"#0ea5e9",fontSize:10}}>{watts||0}W · {wpkg}W/kg</div>}</div></div>);})}</div>
                  </>);
                })()}
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


        {tab==="boats"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}>
          <div style={S.ph}>
            <div><h1 style={S.ttl}>Bateaux</h1><p style={S.sub}>{boats.length} bateaux - réglages par poste</p></div>
            <button style={S.btnP} onClick={()=>setShowAddBoat(true)}>+ Nouveau bateau</button>
          </div>

          {/* Filtres par catégorie */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
            <button style={{...S.actionBtn,background:boatFilter===null?"#22d3ee20":"transparent",color:boatFilter===null?"#0ea5e9":"#64748b",borderColor:boatFilter===null?"#22d3ee60":"#334155",fontWeight:700,fontSize:12,padding:"4px 12px"}} onClick={()=>setBoatFilter(null)}>Tous</button>
            {BOAT_CATS.map(cat=>{
              const count=boats.filter(b=>getCat(b)===cat).length;
              if(!count) return null;
              return(<button key={cat} style={{...S.actionBtn,background:boatFilter===cat?"#0ea5e920":"transparent",color:boatFilter===cat?"#0ea5e9":"#94a3b8",borderColor:boatFilter===cat?"#0ea5e960":"#334155",fontWeight:700,fontSize:12,padding:"4px 12px"}} onClick={()=>setBoatFilter(boatFilter===cat?null:cat)}>{cat} <span style={{opacity:0.6,fontWeight:400}}>({count})</span></button>);
            })}
          </div>

          {/* Liste bateaux */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:28}}>
            {boats.filter(b=>!boatFilter||getCat(b)===boatFilter).map(b=>{
              const linked=getBoatCrewsFor(b.id);
              const lastSetting=getSettingsFor(b.id)[0];
              const isOpen=boatOpen[b.id]!==false;
              const cat=getCat(b);
              return(
                <div key={b.id} style={{...S.card,borderTop:`3px solid ${selBoat===b.id?"#0ea5e9":"#263547"}`,background:selBoat===b.id?"#22d3ee08":"#182030",padding:0,overflow:"hidden"}}>
                  {/* En-tête toujours visible */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",cursor:"pointer"}} onClick={()=>setBoatOpen(p=>({...p,[b.id]:!isOpen}))}>
                    <span style={{color:"#94a3b8",fontSize:13,marginRight:2}}>{isOpen?"▼":"▶"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:900,color:"#f1f5f9",fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.name}</div>
                      {!isOpen&&<div style={{color:"#5a7a9a",fontSize:11,marginTop:1}}>{b.brand} {b.model}</div>}
                    </div>
                    {cat&&<span style={{...S.badge,background:"#22d3ee15",color:"#0ea5e9",border:"1px solid #22d3ee30",flexShrink:0}}>{cat}</span>}
                    <span style={{...S.badge,background:b.type==="couple"?"#22d3ee15":"#a78bfa15",color:b.type==="couple"?"#0ea5e9":"#a78bfa",border:`1px solid ${b.type==="couple"?"#22d3ee30":"#a78bfa30"}`,flexShrink:0,display:isOpen?"inline":"none"}}>{b.type==="couple"?"Couple":"Pointe"}</span>
                    <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={e=>{e.stopPropagation();setEditBoat({...b});}}>✏️</button>
                      <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={e=>{e.stopPropagation();deleteBoat(b.id);}}>🗑️</button>
                    </div>
                  </div>
                  {/* Corps repliable */}
                  {isOpen&&<div style={{padding:"0 14px 14px"}}>
                    <div style={{color:"#7a95b0",fontSize:12,marginBottom:8}}>{b.brand} {b.model} — {b.seats} postes</div>
                    {b.avg_buoyancy&&<div style={{color:"#f59e0b",fontSize:13,marginBottom:8}}>~ Portance moy. : {b.avg_buoyancy} kg</div>}
                    {linked.length>0&&<div style={{marginBottom:8}}>{linked.map(cr=><div key={cr.id} style={{color:"#0ea5e9",fontSize:12}}>~ {cr.name}</div>)}</div>}
                    {lastSetting&&<div style={{color:"#5a7a9a",fontSize:11,marginBottom:8}}>Dernier réglage : {lastSetting.date_reglage} - {lastSetting.regle_par}</div>}
                    {b.notes&&<div style={{background:"#1e293b50",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#a8bfd4",marginBottom:8}}>{b.notes}</div>}
                    {(()=>{const st=getBoatStats(b.id);if(!st)return null;return(<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>{st.avgWatts&&<span style={{...S.badge,background:"#22d3ee15",color:"#0ea5e9",border:"1px solid #22d3ee30"}}>{st.avgWatts}W moy.</span>}{st.avgWeight&&<span style={{...S.badge,background:"#a78bfa15",color:"#a78bfa",border:"1px solid #a78bfa30"}}>{st.avgWeight}kg moy.</span>}{st.avgTime&&<span style={{...S.badge,background:"#4ade8015",color:"#4ade80",border:"1px solid #4ade8030"}}>{st.avgTime} moy. 2k</span>}</div>);})()}
                    <button style={{...S.btnP,width:"100%",fontSize:12,padding:"6px"}} onClick={()=>setSelBoat(selBoat===b.id?null:b.id)}>{selBoat===b.id?"▲ Masquer réglages":"▼ Voir réglages & pelles"}</button>
                  </div>}
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

                {/* Section Pelles */}
                {(()=>{
                  const boatPaddles = getPaddlesFor(selBoat);
                  const MARQUES = ["Concept2","Croker","Dreher","Braca","Vespoli","Autre"];
                  const MODELES_C2 = ["Smoothie 2","Fat 2","Fat2 Skinny","BigBlade","Macon","Bantam","Apex","Autre"];
                  async function savePaddle() {
                    if(!newPaddle.numero) { setToast({m:"Numéro requis",t:"error"}); return; }
                    try {
                      await api.createPaddle({...newPaddle, boat_id:selBoat});
                      setToast({m:"Pelle ajoutée ✓",t:"success"});
                      setNPaddle({numero:"",type_nage:"couple",marque:"",modele:"",plage_reglage:"",notes:""});
                      setShowAddPaddle(false);
                      const pdls = await api.getPaddles(); setPaddles(pdls||[]);
                    } catch(e) { setToast({m:"Erreur: "+e.message,t:"error"}); }
                  }
                  async function saveEditPaddle() {
                    try {
                      const {id:_,...d} = editPaddle;
                      await api.updatePaddle(editPaddle.id, d);
                      setToast({m:"Pelle modifiée ✓",t:"success"});
                      setEditPaddle(null);
                      const pdls = await api.getPaddles(); setPaddles(pdls||[]);
                    } catch(e) { setToast({m:"Erreur",t:"error"}); }
                  }
                  async function delPaddle(id) {
                    if(!window.confirm("Supprimer cette pelle ?")) return;
                    await api.deletePaddle(id);
                    const pdls = await api.getPaddles(); setPaddles(pdls||[]);
                  }
                  return(
                    <div style={{marginBottom:28}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={S.st}>🚣 Pelles — {boat.name}</div>
                        <button style={S.btnP} onClick={()=>setShowAddPaddle(true)}>+ Ajouter une pelle</button>
                      </div>
                      {boatPaddles.length===0 && !showAddPaddle && (
                        <div style={{...S.card,textAlign:"center",color:"#5a7a9a",padding:24}}>Aucune pelle associée à ce bateau.</div>
                      )}
                      {boatPaddles.length>0 && (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
                          {boatPaddles.map(p=>(
                            <div key={p.id} style={{...S.card,borderTop:`3px solid ${p.type_nage==="couple"?"#0ea5e9":"#a78bfa"}`,padding:"14px 16px"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                                <div>
                                  <div style={{fontWeight:900,color:"#f1f5f9",fontSize:16}}>N° {p.numero}</div>
                                  <span style={{...S.badge,background:p.type_nage==="couple"?"#22d3ee20":"#a78bfa20",color:p.type_nage==="couple"?"#0ea5e9":"#a78bfa",border:`1px solid ${p.type_nage==="couple"?"#22d3ee40":"#a78bfa40"}`,marginTop:4,display:"inline-block"}}>
                                    {p.type_nage==="couple"?"~ Couple":"~ Pointe"}
                                  </span>
                                </div>
                                <div style={{display:"flex",gap:4}}>
                                  <button style={{...S.actionBtn,color:"#0ea5e9",borderColor:"#22d3ee30"}} onClick={()=>setEditPaddle({...p})}>✏️</button>
                                  <button style={{...S.actionBtn,color:"#ef4444",borderColor:"#ef444430"}} onClick={()=>delPaddle(p.id)}>✕</button>
                                </div>
                              </div>
                              {p.marque&&<div style={{color:"#94a3b8",fontSize:13,marginBottom:2}}>🏷 {p.marque}{p.modele?` · ${p.modele}`:""}</div>}
                              {p.plage_reglage&&<div style={{color:"#f59e0b",fontSize:13,fontWeight:700}}>📏 {p.plage_reglage} cm</div>}
                              {p.notes&&<div style={{color:"#64748b",fontSize:11,marginTop:6,fontStyle:"italic"}}>{p.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {showAddPaddle&&(
                        <div style={{...S.card,marginTop:12,borderTop:"2px solid #0ea5e9"}}>
                          <div style={{fontWeight:700,color:"#f1f5f9",marginBottom:12}}>+ Nouvelle pelle</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                            <FF label="Numéro"><input style={S.inp} value={newPaddle.numero} onChange={e=>setNPaddle(p=>({...p,numero:e.target.value}))} placeholder="ex: C2-01"/></FF>
                            <FF label="Type de nage">
                              <select style={S.inp} value={newPaddle.type_nage} onChange={e=>setNPaddle(p=>({...p,type_nage:e.target.value}))}>
                                <option value="couple">Couple</option>
                                <option value="pointe">Pointe</option>
                              </select>
                            </FF>
                            <FF label="Marque">
                              <select style={S.inp} value={newPaddle.marque} onChange={e=>setNPaddle(p=>({...p,marque:e.target.value}))}>
                                <option value="">-- Choisir --</option>
                                {["Concept2","Croker","Dreher","Braca","Vespoli","Autre"].map(m=><option key={m}>{m}</option>)}
                              </select>
                            </FF>
                            <FF label="Modèle"><input style={S.inp} value={newPaddle.modele} onChange={e=>setNPaddle(p=>({...p,modele:e.target.value}))} placeholder="ex: Fat 2, Smoothie 2..."/></FF>
                            <FF label="Plage de réglage (cm)"><input style={S.inp} value={newPaddle.plage_reglage} onChange={e=>setNPaddle(p=>({...p,plage_reglage:e.target.value}))} placeholder="ex: 284-289"/></FF>
                            <FF label="Notes"><input style={S.inp} value={newPaddle.notes} onChange={e=>setNPaddle(p=>({...p,notes:e.target.value}))} placeholder="Optionnel"/></FF>
                          </div>
                          <div style={{display:"flex",gap:8,marginTop:12}}>
                            <button style={{...S.btnP,background:"#0ea5e9",color:"#0f1923"}} onClick={savePaddle}>Enregistrer</button>
                            <button style={{...S.btnP,background:"transparent",color:"#7a95b0",border:"1px solid #1e293b"}} onClick={()=>setShowAddPaddle(false)}>Annuler</button>
                          </div>
                        </div>
                      )}
                      {editPaddle&&editPaddle.boat_id===selBoat&&(
                        <Modal title={`Modifier pelle N° ${editPaddle.numero}`} onClose={()=>setEditPaddle(null)}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                            <FF label="Numéro"><input style={S.inp} value={editPaddle.numero} onChange={e=>setEditPaddle(p=>({...p,numero:e.target.value}))}/></FF>
                            <FF label="Type de nage">
                              <select style={S.inp} value={editPaddle.type_nage} onChange={e=>setEditPaddle(p=>({...p,type_nage:e.target.value}))}>
                                <option value="couple">Couple</option>
                                <option value="pointe">Pointe</option>
                              </select>
                            </FF>
                            <FF label="Marque">
                              <select style={S.inp} value={editPaddle.marque||""} onChange={e=>setEditPaddle(p=>({...p,marque:e.target.value}))}>
                                <option value="">-- Choisir --</option>
                                {["Concept2","Croker","Dreher","Braca","Vespoli","Autre"].map(m=><option key={m}>{m}</option>)}
                              </select>
                            </FF>
                            <FF label="Modèle"><input style={S.inp} value={editPaddle.modele||""} onChange={e=>setEditPaddle(p=>({...p,modele:e.target.value}))}/></FF>
                            <FF label="Plage de réglage (cm)"><input style={S.inp} value={editPaddle.plage_reglage||""} onChange={e=>setEditPaddle(p=>({...p,plage_reglage:e.target.value}))} placeholder="ex: 284-289"/></FF>
                            <FF label="Notes"><input style={S.inp} value={editPaddle.notes||""} onChange={e=>setEditPaddle(p=>({...p,notes:e.target.value}))}/></FF>
                          </div>
                          <button style={{...S.btnP,width:"100%",marginTop:12,background:"#0ea5e9",color:"#0f1923"}} onClick={saveEditPaddle}>Enregistrer</button>
                        </Modal>
                      )}
                    </div>
                  );
                })()}

                {/* Réglages par poste -- vue actuelle */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={S.st}>~ Réglages actuels -- {boat.name}</div>
                  <div style={{display:"flex",gap:8}}>
                    <button
                      style={{...S.btnP,background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",color:"#fff",fontWeight:800,fontSize:12,opacity:aiRiggingAllLoading?0.6:1}}
                      onClick={async()=>{
                        setAIRiggingAll(null);
                        setAIRiggingAllLoading(true);
                        try {
                          const postes = Array.from({length:boat.seats},(_,i)=>i+1).map(p=>({
                            poste:p,
                            athlete:(()=>{const a=getAthleteAtPoste(selBoat,p);if(!a)return null;const st=aStats(a,"2000m");return {...a,wpkg:st.wpkg,watts:st.watts,best_time:st.best?.time};})(),
                            paddle:(()=>{const s=getLatestSettingPerPoste(selBoat).find(s=>s.poste===p);return s&&!s.empty?paddles.find(pd=>pd.numero===s.numero_pelle&&pd.boat_id===selBoat)||null:null;})()
                          }));
                          const resp = await fetch("/api/suggest_rigging",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"all",bateau:boat,postes})});
                          const data = await resp.json();
                          if(data.error) throw new Error(data.error);
                          setAIRiggingAll(data);
                        } catch(e){setToast({m:"Erreur IA : "+e.message,t:"error"});}
                        finally{setAIRiggingAllLoading(false);}
                      }}
                      disabled={aiRiggingAllLoading}>
                      {aiRiggingAllLoading?"⏳ Analyse...":"✨ Réglages IA tous postes"}
                    </button>
                    <button style={S.btnP} onClick={()=>{setAIRigging(null);setShowAddSetting(true);}}>+ Nouveau réglage</button>
                  </div>
                </div>
                {aiRiggingAll&&(
                  <div style={{background:"#7c3aed10",border:"1px solid #a855f730",borderRadius:12,padding:"16px 18px",marginBottom:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div style={{color:"#c084fc",fontWeight:800,fontSize:14}}>✨ Suggestion IA — {aiRiggingAll.bateau}</div>
                      <button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:18}} onClick={()=>setAIRiggingAll(null)}>×</button>
                    </div>
                    {aiRiggingAll.synthese&&<div style={{color:"#94a3b8",fontSize:12,marginBottom:14,fontStyle:"italic",borderLeft:"2px solid #a855f740",paddingLeft:10}}>{aiRiggingAll.synthese}</div>}
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {(aiRiggingAll.postes||[]).map((p,i)=>(
                        <div key={i} style={{background:"#0f192360",borderRadius:8,padding:"10px 14px"}}>
                          <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13,marginBottom:8}}>
                            Poste #{p.poste} {p.athlete&&<span style={{color:"#7a95b0",fontWeight:400}}>— {p.athlete}</span>}
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
                            {[
                              {label:"Entraxe",val:p.reglages?.entraxe,col:"#0ea5e9"},
                              {label:"Long. Pelle",val:p.reglages?.longueur_pedale,col:"#4ade80"},
                              {label:"Levier int.",val:p.reglages?.levier_interieur,col:"#a78bfa"},
                              {label:"Levier ext.",val:p.reglages?.levier_exterieur,col:"#f59e0b"},
                              {label:"Croisement",val:p.reglages?.croisement,col:"#f97316"},
                            ].filter(x=>x.val).map(x=>(
                              <div key={x.label} style={{background:"#182030",borderRadius:6,padding:"6px 10px",textAlign:"center"}}>
                                <div style={{color:"#64748b",fontSize:9}}>{x.label}</div>
                                <div style={{color:x.col,fontWeight:900,fontSize:15}}>{x.val} <span style={{fontSize:9,color:"#334155"}}>cm</span></div>
                              </div>
                            ))}
                          </div>
                          {p.notes&&<div style={{color:"#64748b",fontSize:11,fontStyle:"italic"}}>💡 {p.notes}</div>}
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:14,display:"flex",justifyContent:"flex-end"}}>
                      <button
                        style={{...S.btnP,background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",border:"none",color:"#fff",fontWeight:800,fontSize:12,opacity:aiRiggingAllImporting?0.6:1}}
                        disabled={aiRiggingAllImporting}
                        onClick={applyAllRigging}>
                        {aiRiggingAllImporting ? "⏳ Application..." : "⬇ Appliquer à l'équipage"}
                      </button>
                    </div>
                  </div>
                )}
                <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #1e293b",marginBottom:28}}>
                  <table style={{width:"100%",borderCollapse:"collapse",background:"#182030"}}>
                    <thead>
                      <tr>{["Poste","Rameur","Date","Réglé par","Entraxe","Long. Pelle","Levier int.","Pelle","Observations"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
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
                                <td style={S.td}>{s.numero_pelle?`N°${s.numero_pelle}${s.type_pelle?" · "+s.type_pelle:""}`:s.type_pelle||"--"}</td>
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
                      <thead><tr>{["Poste","Date","Réglé par","Entraxe","Long. Pelle","Levier int.","Pelle","Observations",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {allSettings.map(s=>(
                          <tr key={s.id} style={{borderBottom:"1px solid #1e293b"}}>
                            <td style={{...S.td,fontWeight:900,color:"#0ea5e9"}}>#{s.poste}</td>
                            <td style={{...S.td,color:"#7a95b0"}}>{s.date_reglage}</td>
                            <td style={S.td}>{s.regle_par||"--"}</td>
                            <td style={{...S.td,color:"#0ea5e9"}}>{s.entraxe?`${s.entraxe} cm`:"--"}</td>
                            <td style={{...S.td,color:"#a78bfa"}}>{s.longueur_pedale?`${s.longueur_pedale} cm`:"--"}</td>
                            <td style={{...S.td,color:"#f59e0b"}}>{s.levier_interieur?`${s.levier_interieur} cm`:"--"}</td>
                            <td style={S.td}>{s.numero_pelle?`N°${s.numero_pelle}${s.type_pelle?" · "+s.type_pelle:""}`:s.type_pelle||"--"}</td>
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
              <FF label="Catégorie"><select style={S.inp} value={newBoat.categorie||""} onChange={e=>setNB(p=>({...p,categorie:e.target.value}))}><option value="">Auto (depuis postes + type)</option>{["1x","2x","2-","4x","4-","4+","8+"].map(c=><option key={c} value={c}>{c}</option>)}</select></FF>
              <FF label="Type"><select style={S.inp} value={newBoat.type} onChange={e=>setNB(p=>({...p,type:e.target.value}))}><option value="couple">~ Couple</option><option value="pointe">~ Pointe</option></select></FF>
              <FF label="Portance moyenne (kg)"><input style={S.inp} type="number" value={newBoat.avg_buoyancy} onChange={e=>setNB(p=>({...p,avg_buoyancy:e.target.value}))} placeholder="ex: 82"/></FF>
              <FF label="Marque"><input style={S.inp} value={newBoat.brand} onChange={e=>setNB(p=>({...p,brand:e.target.value}))} placeholder="ex: Filippi"/></FF>
              <FF label="Modèle"><input style={S.inp} value={newBoat.model} onChange={e=>setNB(p=>({...p,model:e.target.value}))} placeholder="ex: F50"/></FF>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="N° Bateau"><input style={S.inp} value={newBoat.numero_bateau||""} onChange={e=>setNB(p=>({...p,numero_bateau:e.target.value}))} placeholder="ex: B-04"/></FF>
              
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
              <FF label="Catégorie"><select style={S.inp} value={editBoat.categorie||""} onChange={e=>setEditBoat(p=>({...p,categorie:e.target.value}))}><option value="">Auto (depuis postes + type)</option>{["1x","2x","2-","4x","4-","4+","8+"].map(c=><option key={c} value={c}>{c}</option>)}</select></FF>
              <FF label="Portance (kg)"><input style={S.inp} type="number" value={editBoat.avg_buoyancy||""} onChange={e=>setEditBoat(p=>({...p,avg_buoyancy:e.target.value}))}/></FF>
              <FF label="Marque"><input style={S.inp} value={editBoat.brand||""} onChange={e=>setEditBoat(p=>({...p,brand:e.target.value}))}/></FF>
              <FF label="Modèle"><input style={S.inp} value={editBoat.model||""} onChange={e=>setEditBoat(p=>({...p,model:e.target.value}))}/></FF>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FF label="N° Bateau"><input style={S.inp} value={editBoat.numero_bateau||""} onChange={e=>setEditBoat(p=>({...p,numero_bateau:e.target.value}))}/></FF>
              
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
                  async function fetchAISingle() {
                    if (!posteAth) return;
                    setAIRigging(null); setAIRiggingLoading(true);
                    const st = aStats(posteAth,"2000m");
                    const paddle = paddles.find(p=>p.numero===newSetting.numero_pelle&&p.boat_id===selBoat)||null;
                    try {
                      const resp = await fetch("/api/suggest_rigging",{method:"POST",headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({mode:"single",bateau:boat,poste:newSetting.poste,paddle,
                          athlete:{...posteAth,wpkg:st.wpkg,watts:st.watts,best_time:st.best?.time}})});
                      const data = await resp.json();
                      if(data.error) throw new Error(data.error);
                      setAIRigging(data);
                    } catch(e){setToast({m:"Erreur IA : "+e.message,t:"error"});}
                    finally{setAIRiggingLoading(false);}
                  }
                  return posteAth ? (
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"8px 12px",background:"#111827",borderRadius:8}}>
                        <span style={{color:"#7a95b0",fontSize:12,flex:1}}>
                          <strong style={{color:"#f1f5f9"}}>{posteAth.name}</strong>
                          {posteAth.taille?` · ${posteAth.taille} cm`:""}
                          {posteAth.envergure?` · env. ${posteAth.envergure} cm`:""}
                          {posteAth.longueur_bras?` · bras ${posteAth.longueur_bras} cm`:""}
                        </span>
                        <button style={{...S.btnP,fontSize:11,padding:"5px 12px",background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",color:"#fff",fontWeight:800,opacity:aiRiggingLoading?0.6:1}}
                          onClick={fetchAISingle} disabled={aiRiggingLoading}>
                          {aiRiggingLoading?"⏳ Analyse...":"✨ Suggérer avec IA"}
                        </button>
                      </div>
                      {aiRigging&&aiRigging.reglages&&(
                        <div style={{background:"#7c3aed0d",border:"1px solid #a855f730",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                          <div style={{color:"#c084fc",fontWeight:700,fontSize:12,marginBottom:8}}>✨ Suggestion IA — {aiRigging.athlete}</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                            {[{l:"Entraxe",v:aiRigging.reglages.entraxe,c:"#0ea5e9",k:"entraxe"},
                              {l:"Long. Pelle",v:aiRigging.reglages.longueur_pedale,c:"#4ade80",k:"longueur_pedale"},
                              {l:"Levier int.",v:aiRigging.reglages.levier_interieur,c:"#a78bfa",k:"levier_interieur"},
                              {l:"Levier ext.",v:aiRigging.reglages.levier_exterieur,c:"#f59e0b",k:"levier_exterieur"},
                              {l:"Croisement",v:aiRigging.reglages.croisement,c:"#f97316",k:"croisement"},
                            ].filter(x=>x.v).map(x=>(
                              <div key={x.k} style={{background:"#182030",borderRadius:8,padding:"8px 12px",textAlign:"center",minWidth:80}}>
                                <div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{x.l}</div>
                                <div style={{color:x.c,fontWeight:900,fontSize:17}}>{x.v}</div>
                                <div style={{color:"#334155",fontSize:9}}>cm</div>
                              </div>
                            ))}
                          </div>
                          {aiRigging.raisonnement&&(
                            <div style={{fontSize:11,color:"#94a3b8",marginBottom:8,display:"flex",flexDirection:"column",gap:3}}>
                              {aiRigging.raisonnement.morpho&&<div>📐 {aiRigging.raisonnement.morpho}</div>}
                              {aiRigging.raisonnement.puissance&&<div>⚡ {aiRigging.raisonnement.puissance}</div>}
                              {aiRigging.raisonnement.pelle&&<div>🚣 {aiRigging.raisonnement.pelle}</div>}
                              {(aiRigging.raisonnement.points_attention||[]).map((pt,i)=><div key={i} style={{color:"#f59e0b"}}>⚠️ {pt}</div>)}
                            </div>
                          )}
                          <button style={{...S.btnP,fontSize:11,padding:"5px 12px",background:"#7c3aed20",color:"#c084fc",border:"1px solid #a855f740"}}
                            onClick={()=>{const r=aiRigging.reglages;setNS(p=>({...p,...(r.entraxe?{entraxe:r.entraxe}:{}),...(r.longueur_pedale?{longueur_pedale:r.longueur_pedale}:{}),...(r.levier_interieur?{levier_interieur:r.levier_interieur}:{}),...(r.levier_exterieur?{levier_exterieur:r.levier_exterieur}:{}),...(r.croisement?{croisement:r.croisement}:{})}));}}>
                            ⬇ Appliquer ces valeurs
                          </button>
                        </div>
                      )}
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
                  <FF label="Long. Pelle (cm)"><input style={S.inp} type="number" value={newSetting.longueur_pedale} onChange={e=>setNS(p=>({...p,longueur_pedale:e.target.value}))}/></FF>
                  <FF label="Levier intérieur (cm)"><input style={S.inp} type="number" value={newSetting.levier_interieur} onChange={e=>setNS(p=>({...p,levier_interieur:e.target.value}))}/></FF>
                  <FF label="Levier extérieur (cm)"><input style={S.inp} type="number" value={newSetting.levier_exterieur} onChange={e=>setNS(p=>({...p,levier_exterieur:e.target.value}))}/></FF>
                  <FF label="Croisement (cm)"><input style={S.inp} type="number" value={newSetting.croisement} onChange={e=>setNS(p=>({...p,croisement:e.target.value}))}/></FF>
                  <FF label="N° Pelle">
                    <select style={S.inp} value={newSetting.numero_pelle} onChange={e=>{
                      const sel = paddles.find(p=>p.numero===e.target.value&&p.boat_id===selBoat);
                      setNS(p=>({...p,numero_pelle:e.target.value,type_pelle:sel?.modele||p.type_pelle}));
                    }}>
                      <option value="">-- Choisir ou saisir --</option>
                      {getPaddlesFor(selBoat).map(p=><option key={p.id} value={p.numero}>N°{p.numero} — {p.marque} {p.modele} ({p.type_nage}) {p.plage_reglage?`· ${p.plage_reglage}cm`:""}</option>)}
                    </select>
                  </FF>
                  {newSetting.numero_pelle&&(()=>{const sel=paddles.find(p=>p.numero===newSetting.numero_pelle&&p.boat_id===selBoat);if(!sel)return null;return(<div style={{padding:"8px 12px",background:"#0ea5e910",border:"1px solid #0ea5e930",borderRadius:8,marginBottom:8,fontSize:12,color:"#94a3b8"}}>🚣 {sel.type_nage} · {sel.marque} {sel.modele}{sel.plage_reglage?` · Plage: ${sel.plage_reglage} cm`:""}</div>);})()}
                  <FF label="Type de pelle"><select style={S.inp} value={newSetting.type_pelle} onChange={e=>setNS(p=>({...p,type_pelle:e.target.value}))}><option value="">-- Choisir --</option>{BLADE_TYPES.map(b=><option key={b} value={b}>{b}</option>)}</select></FF>
                </div>
                <FF label="Observations"><textarea style={{...S.inp,height:72,resize:"vertical"}} value={newSetting.observations} onChange={e=>setNS(p=>({...p,observations:e.target.value}))}/></FF>
                <button style={{...S.btnP,width:"100%",marginTop:8}} onClick={addSetting}>Enregistrer le réglage</button>
              </Modal>
            );
          })()}
        </div>)}

        {tab==="planning"&&(<div style={{...S.page,padding:isMobile?"16px 12px":"28px 32px"}}><PlanningSpace athletes={athletes} isMobile={isMobile} currentUser={currentUser}/></div>)}

        {tab==="outils"&&(<OutilsCoach
          outiTab={outiTab} setOutiTab={setOutiTab}
          cadTaps={cadTaps} setCadTaps={setCadTaps} cadSpm={cadSpm} setCadSpm={setCadSpm} cadActive={cadActive} setCadActive={setCadActive}
          chronoCrews={chronoCrews} setChronoCrews={setChronoCrews} chronoRunning={chronoRunning} setChronoRunning={setChronoRunning}
          chronoStart={chronoStart} setChronoStart={setChronoStart} chronoNow={chronoNow} setChronoNow={setChronoNow}
          chronoArrivals={chronoArrivals} setChronoArrivals={setChronoArrivals}
          voiceNotes={voiceNotes} setVoiceNotes={setVoiceNotes} voiceRec={voiceRec} setVoiceRec={setVoiceRec}
          voiceRecorder={voiceRecorder} setVoiceRecorder={setVoiceRecorder}
          crews={crews} isMobile={isMobile} S={S}
        />)}













      </div>
      {/* Mobile bottom navigation */}
      {isMobile&&(
        <nav style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:"#1e293b",borderTop:"1px solid #334155",display:"flex",alignItems:"stretch",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {NAV.map(n=>(
            <button key={n.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",color:tab===n.id?"#38bdf8":"#64748b",padding:"6px 2px",minWidth:0}} onClick={()=>setTab(n.id)}>
              <span style={{fontSize:18}}>{n.icon}</span>
              <span style={{fontSize:9,fontWeight:tab===n.id?700:500,letterSpacing:0.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{n.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ==========================================================================================================================================================
// ATHLETE SPACE
// ==========================================================================================================================================================
