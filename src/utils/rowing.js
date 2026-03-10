// Utilitaires aviron

export function timeToSeconds(t) { if(!t||!t.includes(":"))return 9999; const[m,s]=t.split(":").map(Number); return m*60+s; }
export function secondsToTime(s) { const m=Math.floor(s/60),sec=Math.round(s%60); return `${m}:${String(sec).padStart(2,"0")}`; }
// Diviseur selon distance : 500m→/1, 1000m→/2, 2000m→/4
function paceDiv(distanceType) {
  if(distanceType==="500m")  return 1;
  if(distanceType==="1000m") return 2;
  return 4; // 2000m par défaut
}
export function concept2Watts(timeStr, distanceType="2000m") {
  // Concept2 formula: P = 2.80 / (pace_500m / 500)^3
  if(!timeStr || !timeStr.includes(":")) return null;
  const [m,s] = timeStr.split(":").map(Number);
  const total = m*60 + s;
  const pace = total / paceDiv(distanceType);
  if(!pace || pace <= 0) return null;
  return Math.round(2.80 / Math.pow(pace/500, 3));
}
export function concept2WattsFast(timeStr, distanceType="2000m") {
  // Formule Concept2 officielle: P = 2.80 / (pace_500m / 500)^3
  if(!timeStr || !timeStr.includes(":")) return null;
  const [m,s] = timeStr.split(":").map(Number);
  const total = m*60 + s;
  const pace = total / paceDiv(distanceType);
  if(!pace || pace <= 0) return null;
  return Math.round(2.80 / Math.pow(pace / 500, 3));
}
export function getBestTime(perfs) { if(!perfs.length)return null; return perfs.reduce((b,p)=>timeToSeconds(p.time)<timeToSeconds(b.time)?p:b); }
export function getLastPerf(perfs) { if(!perfs.length)return null; return [...perfs].sort((a,b)=>b.date.localeCompare(a.date))[0]; }
export function avg(arr) { return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0; }

const ROLE_COLORS = { admin:"#f59e0b", coach:"#0ea5e9", athlete:"#a78bfa" };
const ROLE_LABELS = { admin:"Super Admin", coach:"Coach", athlete:"Athlète" };
const ROLE_ICONS  = { admin:"~", coach:"~", athlete:"~" };
const ZONE_COLORS = { Z1:"#4ade80",Z2:"#22d3ee",Z3:"#f59e0b",Z4:"#f97316",Z5:"#ef4444",Race:"#a78bfa","--":"#374151" };
const TYPE_COLORS = { Endurance:"#0ea5e9","Fractionné":"#f97316","Repos actif":"#4ade80",Seuil:"#f59e0b",Sprint:"#ef4444",Compétition:"#a78bfa",Repos:"#374151" };
const CMP_COLORS  = ["#0ea5e9","#f97316","#a78bfa","#4ade80"];

// ------ CATEGORIES D'AGE -----------------------------------------------
// Catégories FFAviron 2025-2026 basées sur l'année de naissance
export function getAgeCatFromBirthYear(birthYear) {
  if(!birthYear) return "N/A";
  const y = parseInt(birthYear);
  const currentYear = new Date().getFullYear();
  if(y >= currentYear - 9)  return "U12";
  if(y >= currentYear - 11) return "U12";
  if(y >= currentYear - 14) return "U15";
  if(y >= currentYear - 16) return "U17";
  if(y >= currentYear - 18) return "U19";
  if(y >= currentYear - 22) return "U23";
  if(y >= currentYear - 26) return "Senior";
  if(y >= currentYear - 35) return "Master A";
  if(y >= currentYear - 42) return "Master B";
  if(y >= currentYear - 49) return "Master C";
  if(y >= currentYear - 54) return "Master D";
  if(y >= currentYear - 59) return "Master E";
  return "Master F";
}
export function getAgeCategory(ageOrYear) {
  if(!ageOrYear) return "N/A";
  const v = parseInt(ageOrYear);
  if(v > 1900) return getAgeCatFromBirthYear(v);
  return getAgeCatFromBirthYear(new Date().getFullYear() - v);
}
const AGE_CAT_COLORS = {
  "U12":"#0ea5e9","U15":"#06b6d4","U17":"#3b82f6",
  "U19":"#8b5cf6","U23":"#6d28d9","Senior":"#f59e0b","Master A":"#f97316",
  "Master B":"#fb923c","Master C":"#fbbf24","Master D":"#a3e635","Master E":"#34d399","Master F":"#2dd4bf"
};
const AGE_CAT_GROUPS = ["Tous","U12","U15","U17","U19","U23","Senior","Master"];
export function matchesAgeGroup(athlete, group) {
  if(group === "Tous") return true;
  const birthYear = athlete.date_naissance ? new Date(athlete.date_naissance).getFullYear() : null;
  const cat = birthYear ? getAgeCatFromBirthYear(birthYear) : getAgeCategory(athlete.age);
  if(group === "Master") return cat.startsWith("Master");
  return cat === group;
}

export function calcAgeFromDOB(dob) {
  // Aviron fédéral : année en cours - année de naissance (peu importe le mois)
  if(!dob) return null;
  const currentYear = new Date().getFullYear();
  const birthYear = new Date(dob).getFullYear();
  return currentYear - birthYear;
}
export function calcRealAge(dob) {
  // Âge réel (tient compte du mois et du jour)
  if(!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if(m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
export function getCategoryFromAge(age, genre="H") {
  if(!age && age !== 0) return `Senior ${genre}`;
  const g = genre || "H";
  if(age <= 13)  return `Jeune ${g}`;
  if(age === 14) return `Jeune ${g}`;
  if(age === 15) return `Junior ${g}`;  // J15
  if(age === 16) return `Junior ${g}`;  // J16
  if(age <= 18)  return `Junior ${g}`;  // J18
  if(age <= 22)  return `Espoir ${g}`;  // U23
  if(age >= 27 && age <= 35)  return `Master A ${g}`;
  if(age >= 36 && age <= 42)  return `Master B ${g}`;
  if(age >= 43 && age <= 49)  return `Master C ${g}`;
  if(age >= 50 && age <= 54)  return `Master D ${g}`;
  if(age >= 55 && age <= 59)  return `Master E ${g}`;
  if(age >= 60 && age <= 64)  return `Master F ${g}`;
  if(age >= 65)               return `Master G ${g}`;
  return `Senior ${g}`;
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

export function suggestRigging(athlete, bladeType, boatType) {
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
export function calcCroisement(levier_int, entraxe) {
  if(!levier_int || !entraxe) return null;
  return Math.round(2 * levier_int - entraxe);
}

const CREW_SLOTS  = { "1x":1,"2x":2,"2-":2,"4x":4,"4x+":4,"4-":4,"4+":4,"8+":8 };

