import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════
//  OUTILS COACH — Cadencemètre / Chrono / Notes vocales
// ═══════════════════════════════════════════════════

export default function OutilsCoach({
  outiTab, setOutiTab,
  cadTaps, setCadTaps, cadSpm, setCadSpm, cadActive, setCadActive,
  chronoCrews, setChronoCrews, chronoRunning, setChronoRunning,
  chronoStart, setChronoStart, chronoNow, setChronoNow,
  chronoArrivals, setChronoArrivals,
  voiceNotes, setVoiceNotes, voiceRec, setVoiceRec,
  voiceRecorder, setVoiceRecorder,
  crews, isMobile, S
}) {

  // Chrono tick
  useEffect(() => {
    if (!chronoRunning) return;
    const id = setInterval(() => setChronoNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [chronoRunning]);

  const TABS = [
    { id: "cadence", label: "🎯 Cadence" },
    { id: "chrono",  label: "⏱ Chrono" },
    { id: "notes",   label: "🎙 Notes" },
  ];

  const tabStyle = (id) => ({
    padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: outiTab === id ? 800 : 500, fontSize: 14,
    background: outiTab === id ? "#0ea5e9" : "#182030",
    color: outiTab === id ? "#fff" : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <div style={{ ...S.page, padding: isMobile ? "16px 12px" : "28px 40px" }}>
      <h1 style={{ ...S.ttl, marginBottom: 20 }}>🧰 Outils Coach</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setOutiTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {outiTab === "cadence" && (
        <Cadencemetre
          taps={cadTaps} setTaps={setCadTaps}
          spm={cadSpm} setSpm={setCadSpm}
          active={cadActive} setActive={setCadActive}
          isMobile={isMobile} S={S}
        />
      )}
      {outiTab === "chrono" && (
        <ChronoHandicap
          crewsConfig={chronoCrews} setCrewsConfig={setChronoCrews}
          running={chronoRunning} setRunning={setChronoRunning}
          startTime={chronoStart} setStartTime={setChronoStart}
          now={chronoNow} setNow={setChronoNow}
          arrivals={chronoArrivals} setArrivals={setChronoArrivals}
          allCrews={crews} isMobile={isMobile} S={S}
        />
      )}
      {outiTab === "notes" && (
        <NotesVocales
          notes={voiceNotes} setNotes={setVoiceNotes}
          recording={voiceRec} setRecording={setVoiceRec}
          recorder={voiceRecorder} setRecorder={setVoiceRecorder}
          isMobile={isMobile} S={S}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  CADENCEMÈTRE
// ══════════════════════════════════════
function Cadencemetre({ taps, setTaps, spm, setSpm, active, setActive, isMobile, S }) {
  const WINDOW = 5; // nb de frappes pour la moyenne glissante

  function handleTap() {
    const now = Date.now();
    setTaps(prev => {
      const next = [...prev, now].slice(-WINDOW);
      if (next.length >= 2) {
        const intervals = [];
        for (let i = 1; i < next.length; i++) intervals.push(next[i] - next[i-1]);
        const avg = intervals.reduce((s,v) => s + v, 0) / intervals.length;
        setSpm(Math.round(60000 / avg));
      }
      return next;
    });
    if (!active) setActive(true);
  }

  function reset() {
    setTaps([]); setSpm(null); setActive(false);
  }

  // Couleur selon la zone SPM
  const spmColor = !spm ? "#64748b"
    : spm < 20 ? "#4ade80"
    : spm < 26 ? "#0ea5e9"
    : spm < 32 ? "#f59e0b"
    : "#f97316";

  const zone = !spm ? "—"
    : spm < 20 ? "B1 · Endurance"
    : spm < 26 ? "B2 · Soutenu"
    : spm < 32 ? "Seuil · Spécifique"
    : "Course · Vitesse";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Affichage SPM */}
      <div style={{
        background: "#182030", border: `2px solid ${spmColor}40`,
        borderRadius: 20, padding: "32px 24px", textAlign: "center", marginBottom: 24,
        boxShadow: spm ? `0 0 40px ${spmColor}20` : "none",
        transition: "all 0.2s",
      }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          Cadence
        </div>
        <div style={{ color: spmColor, fontSize: isMobile ? 80 : 100, fontWeight: 900, lineHeight: 1, transition: "color 0.2s" }}>
          {spm ?? "--"}
        </div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>coups / min</div>
        <div style={{ color: spmColor, fontSize: 14, fontWeight: 700, marginTop: 12 }}>{zone}</div>
        {taps.length >= 2 && (
          <div style={{ color: "#334155", fontSize: 11, marginTop: 8 }}>
            Moyenne sur {Math.min(taps.length, WINDOW)} frappe{taps.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Bouton frappe */}
      <button
        onClick={handleTap}
        style={{
          width: "100%", height: isMobile ? 140 : 120,
          borderRadius: 16, border: `3px solid ${spmColor}`,
          background: `linear-gradient(135deg, ${spmColor}20, ${spmColor}10)`,
          color: spmColor, fontSize: 28, fontWeight: 900,
          cursor: "pointer", transition: "all 0.1s",
          boxShadow: `0 4px 24px ${spmColor}20`,
          letterSpacing: 1,
        }}
        onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.background = `${spmColor}30`; }}
        onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = `linear-gradient(135deg, ${spmColor}20, ${spmColor}10)`; }}
        onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
        onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; handleTap(); }}
      >
        🚣 FRAPPER
      </button>

      {/* Reset */}
      {active && (
        <button onClick={reset} style={{
          width: "100%", marginTop: 12, padding: "12px", borderRadius: 10,
          border: "1px solid #334155", background: "transparent",
          color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}>
          Réinitialiser
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  CHRONO DÉPARTS DIFFÉRÉS
// ══════════════════════════════════════
function ChronoHandicap({ crewsConfig, setCrewsConfig, running, setRunning, startTime, setStartTime, now, setNow, arrivals, setArrivals, allCrews, isMobile, S }) {

  const [setupMode, setSetupMode] = useState(!running && crewsConfig.length === 0);
  const [newCrewId, setNewCrewId] = useState("");
  const [newDelay, setNewDelay] = useState(0);

  function fmt(ms) {
    if (ms < 0) return "--:--.-";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const d = Math.floor((ms % 1000) / 100);
    return `${m}:${String(s).padStart(2,"0")}.${d}`;
  }

  function addCrew() {
    if (!newCrewId) return;
    const crew = allCrews.find(c => c.id === newCrewId);
    if (!crew) return;
    if (crewsConfig.find(c => c.id === newCrewId)) return;
    setCrewsConfig(prev => [...prev, {
      id: newCrewId, name: crew.name,
      delay: +newDelay || 0,
    }]);
    setNewCrewId(""); setNewDelay(0);
  }

  function startChrono() {
    const t = Date.now();
    setStartTime(t); setRunning(true); setNow(t); setSetupMode(false);
  }

  function stopChrono() { setRunning(false); }

  function reset() {
    setRunning(false); setStartTime(null); setNow(0);
    setCrewsConfig([]); setArrivals({}); setSetupMode(true);
  }

  function recordArrival(crewId) {
    if (arrivals[crewId]) return;
    setArrivals(prev => ({ ...prev, [crewId]: now }));
  }

  // Calcul classement avec handicap
  function getElapsed(crew) {
    if (!startTime) return null;
    const t = now - startTime - (crew.delay * 1000);
    return t;
  }

  function getFinishTime(crew) {
    if (!arrivals[crew.id]) return null;
    return arrivals[crew.id] - startTime - (crew.delay * 1000);
  }

  const ranked = [...crewsConfig]
    .map(c => ({ ...c, finish: getFinishTime(c) }))
    .filter(c => c.finish !== null)
    .sort((a, b) => a.finish - b.finish);

  const started = crewsConfig.filter(c => {
    if (!startTime) return false;
    return (now - startTime) >= c.delay * 1000;
  });

  // ── SETUP ──
  if (setupMode) return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Configuration de la course</div>

      {/* Ajouter un équipage */}
      <div style={{ background: "#182030", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Ajouter un équipage</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            style={{ ...S.inp, flex: 2, minWidth: 140 }}
            value={newCrewId}
            onChange={e => setNewCrewId(e.target.value)}
          >
            <option value="">— Équipage —</option>
            {allCrews.filter(c => !crewsConfig.find(x => x.id === c.id)).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 120 }}>
            <input
              type="number" min="0" placeholder="Délai (s)"
              style={{ ...S.inp, flex: 1 }}
              value={newDelay || ""}
              onChange={e => setNewDelay(+e.target.value)}
            />
            <span style={{ color: "#64748b", fontSize: 12 }}>sec</span>
          </div>
          <button style={{ ...S.btnP, flexShrink: 0 }} onClick={addCrew}>Ajouter</button>
        </div>
      </div>

      {/* Liste équipages */}
      {crewsConfig.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {crewsConfig.map((c, i) => (
            <div key={c.id} style={{ background: "#182030", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: "#0ea5e920", color: "#0ea5e9", borderRadius: 6, padding: "2px 10px", fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: "center" }}>#{i+1}</div>
              <div style={{ flex: 1, color: "#f1f5f9", fontWeight: 700 }}>{c.name}</div>
              <div style={{ color: c.delay > 0 ? "#f59e0b" : "#4ade80", fontSize: 13, fontWeight: 700 }}>
                {c.delay > 0 ? `+${c.delay}s` : "⏩ Scratch"}
              </div>
              <button onClick={() => setCrewsConfig(prev => prev.filter(x => x.id !== c.id))}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {crewsConfig.length >= 2 && (
        <button style={{ ...S.btnP, width: "100%", padding: 16, fontSize: 16, background: "#4ade80", color: "#0f1923" }} onClick={startChrono}>
          🚦 Lancer la course
        </button>
      )}
      {crewsConfig.length < 2 && (
        <div style={{ textAlign: "center", color: "#475569", fontSize: 13, marginTop: 8 }}>Ajoute au moins 2 équipages</div>
      )}
    </div>
  );

  // ── CHRONO EN COURS ──
  const elapsed = startTime ? now - startTime : 0;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Chrono global */}
      <div style={{ background: "#182030", borderRadius: 16, padding: "20px 24px", textAlign: "center", marginBottom: 20, border: `2px solid ${running ? "#4ade80" : "#334155"}` }}>
        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          {running ? "⏱ En cours" : "⏹ Arrêté"}
        </div>
        <div style={{ color: running ? "#4ade80" : "#94a3b8", fontSize: isMobile ? 52 : 64, fontWeight: 900, letterSpacing: 2, lineHeight: 1 }}>
          {fmt(elapsed)}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
          {running
            ? <button style={{ ...S.btnP, background: "#ef4444", color: "#fff" }} onClick={stopChrono}>⏹ Stop</button>
            : <button style={{ ...S.btnP, background: "#4ade80", color: "#0f1923" }} onClick={startChrono}>▶ Reprendre</button>
          }
          <button style={{ ...S.actionBtn, borderColor: "#334155", color: "#64748b" }} onClick={reset}>↺ Reset</button>
        </div>
      </div>

      {/* Équipages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {crewsConfig.map((crew, i) => {
          const crewElapsed = getElapsed(crew);
          const isStarted = crewElapsed !== null && crewElapsed >= 0;
          const isFinished = !!arrivals[crew.id];
          const finishT = getFinishTime(crew);
          const rank = ranked.findIndex(r => r.id === crew.id) + 1;
          const borderColor = isFinished ? "#a78bfa" : isStarted ? "#4ade80" : "#334155";

          return (
            <div key={crew.id} style={{
              background: "#182030", borderRadius: 12, padding: "14px 16px",
              border: `2px solid ${borderColor}40`,
              opacity: !isStarted && !isFinished ? 0.5 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 28, textAlign: "center", color: "#64748b", fontWeight: 800, fontSize: 15 }}>#{i+1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{crew.name}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>
                    {crew.delay > 0 ? `Départ +${crew.delay}s` : "Départ scratch"}
                    {!isStarted && !isFinished && startTime && (
                      <span style={{ color: "#f59e0b", marginLeft: 8 }}>
                        ⏳ dans {fmt((crew.delay * 1000) - (now - startTime))}
                      </span>
                    )}
                  </div>
                </div>
                {isFinished ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#a78bfa", fontWeight: 900, fontSize: 18 }}>{fmt(finishT)}</div>
                    {rank > 0 && <div style={{ color: rank===1?"#f59e0b":rank===2?"#94a3b8":rank===3?"#cd7f32":"#64748b", fontSize: 12, fontWeight: 700 }}>
                      #{rank} {rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":""}
                    </div>}
                  </div>
                ) : isStarted ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 16 }}>{fmt(crewElapsed)}</div>
                    <button
                      onClick={() => recordArrival(crew.id)}
                      style={{ marginTop: 4, padding: "6px 14px", borderRadius: 8, border: "none", background: "#a78bfa", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      🏁 Arrivée
                    </button>
                  </div>
                ) : (
                  <div style={{ color: "#334155", fontSize: 12 }}>En attente</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Classement final */}
      {ranked.length > 0 && (
        <div style={{ background: "#182030", borderRadius: 12, padding: "14px 16px", border: "1px solid #a78bfa30" }}>
          <div style={{ color: "#a78bfa", fontWeight: 800, fontSize: 13, marginBottom: 10 }}>🏆 Classement</div>
          {ranked.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < ranked.length-1 ? "1px solid #1e293b" : "none" }}>
              <span style={{ color: i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#cd7f32":"#64748b", fontWeight: 900, fontSize: 16, minWidth: 28 }}>
                {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
              </span>
              <span style={{ flex: 1, color: "#f1f5f9", fontWeight: 700 }}>{c.name}</span>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{fmt(c.finish)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  NOTES VOCALES
// ══════════════════════════════════════
function NotesVocales({ notes, setNotes, recording, setRecording, recorder, setRecorder, isMobile, S }) {
  const [error, setError] = useState(null);

  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        setNotes(prev => [{
          id: Date.now(),
          url,
          date: now.toLocaleDateString("fr-FR"),
          time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          duration: null,
        }, ...prev]);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecorder(mr);
      setRecording(true);
    } catch (e) {
      setError("Microphone non disponible. Autorise l'accès dans le navigateur.");
    }
  }

  function stopRecording() {
    if (recorder) { recorder.stop(); setRecorder(null); }
    setRecording(false);
  }

  function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      {/* Bouton enregistrement */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <button
          onClick={recording ? stopRecording : startRecording}
          style={{
            width: isMobile ? 160 : 180, height: isMobile ? 160 : 180,
            borderRadius: "50%",
            border: `4px solid ${recording ? "#ef4444" : "#0ea5e9"}`,
            background: recording ? "#ef444420" : "#0ea5e920",
            color: recording ? "#ef4444" : "#0ea5e9",
            fontSize: 40, cursor: "pointer",
            boxShadow: recording ? "0 0 40px #ef444440" : "0 0 20px #0ea5e920",
            transition: "all 0.2s",
            animation: recording ? "pulse 1s infinite" : "none",
          }}
        >
          {recording ? "⏹" : "🎙"}
        </button>
        <div style={{ color: recording ? "#ef4444" : "#64748b", fontWeight: 700, fontSize: 14, marginTop: 12 }}>
          {recording ? "● Enregistrement en cours..." : "Appuyer pour enregistrer"}
        </div>
        {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 20px #ef444430} 50%{box-shadow:0 0 50px #ef444460} }`}</style>

      {/* Liste des notes */}
      {notes.length === 0 ? (
        <div style={{ textAlign: "center", color: "#475569", fontSize: 13 }}>Aucune note enregistrée</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            {notes.length} note{notes.length > 1 ? "s" : ""}
          </div>
          {notes.map((note, i) => (
            <div key={note.id} style={{ background: "#182030", borderRadius: 12, padding: "12px 14px", border: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>
                  Note #{notes.length - i} · {note.date} à {note.time}
                </div>
                <audio src={note.url} controls style={{ width: "100%", height: 36 }} />
              </div>
              <button onClick={() => deleteNote(note.id)}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
