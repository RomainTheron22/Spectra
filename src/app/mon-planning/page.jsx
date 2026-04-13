"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./MonPlanning.module.css";
import Modal from "../../components/ui/Modal";

/* ═══ CONSTANTS ═══ */
const ABSENCE_TYPES = [
  { value: "conge", label: "Congé", color: "#10b981", icon: "🌴", desc: "Vacances, repos, journée perso", gradient: "linear-gradient(135deg, #d1fae5, #a7f3d0)" },
  { value: "tt", label: "Télétravail", color: "#8b5cf6", icon: "🏡", desc: "Je bosse de chez moi", gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)" },
  { value: "maladie", label: "Maladie", color: "#f43f5e", icon: "🤧", desc: "Arrêt maladie", gradient: "linear-gradient(135deg, #ffe4e6, #fecdd3)" },
  { value: "absence_autre", label: "Autre", color: "#f59e0b", icon: "✨", desc: "RDV, formation, perso...", gradient: "linear-gradient(135deg, #fef3c7, #fde68a)" },
];
const STATUT_LABELS = { en_attente: { label: "En attente", cls: "statutAttente" }, valide: { label: "Validé", cls: "statutValide" }, refuse: { label: "Refusé", cls: "statutRefuse" } };
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_HEAD = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const JOURS_FULL = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DEFAULT_CONGES = 30;

const FAKE_PROJECTS = [
  { id: "p1", title: "Clip Artiste X", branche: "Production AV", color: "#e11d48", statut: "En production" },
  { id: "p2", title: "Scéno Salon Y", branche: "Scénographie", color: "#7c3aed", statut: "Conception" },
  { id: "p3", title: "Podcast S3", branche: "CreativGen", color: "#0891b2", statut: "Stand-by" },
  { id: "p4", title: "Décor Festival Z", branche: "Atelier", color: "#ca8a04", statut: "En cours" },
  { id: "p5", title: "Campagne Marque W", branche: "Communication", color: "#059669", statut: "Livré" },
];
const MY_MISSION_IDS = ["p1", "p3"];

function getFakeProjectsWithDates() {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  return [
    { ...FAKE_PROJECTS[0], dateDebut: toYMD(new Date(y, m, 8)), dateFin: toYMD(new Date(y, m, 18)) },
    { ...FAKE_PROJECTS[1], dateDebut: toYMD(new Date(y, m, 3)), dateFin: toYMD(new Date(y, m, 14)) },
    { ...FAKE_PROJECTS[2], dateDebut: toYMD(new Date(y, m, 20)), dateFin: toYMD(new Date(y, m, 28)) },
    { ...FAKE_PROJECTS[3], dateDebut: toYMD(new Date(y, m, 12)), dateFin: toYMD(new Date(y, m, 25)) },
    { ...FAKE_PROJECTS[4], dateDebut: toYMD(new Date(y, m, 1)), dateFin: toYMD(new Date(y, m, 6)) },
  ];
}

const CONGE_VIBES = [
  { min: 30, emoji: "🌏", msg: "Le monde entier est à toi", sub: "Six semaines d'aventure possibles", tone: "ocean" },
  { min: 25, emoji: "🌅", msg: "Un mois de soleil t'attend", sub: "Ferme les yeux. Tu entends les vagues ?", tone: "ocean" },
  { min: 20, emoji: "🗾", msg: "Trois semaines au Japon", sub: "Tokyo, Kyoto, ramen, cerisiers...", tone: "ocean" },
  { min: 15, emoji: "🛤️", msg: "Road trip sans fin", sub: "La route, la musique, zéro notification", tone: "warm" },
  { min: 10, emoji: "🏖️", msg: "Deux semaines les pieds dans le sable", sub: "Ton seul agenda : lever de soleil", tone: "warm" },
  { min: 7, emoji: "🌺", msg: "Une semaine à Bali", sub: "Temples, rizières, couchers de soleil", tone: "warm" },
  { min: 4, emoji: "🛫", msg: "City-trip à Lisbonne", sub: "Pastéis de nata et rooftops", tone: "sunset" },
  { min: 2, emoji: "🏔️", msg: "Week-end à la montagne", sub: "L'air pur, le silence, les étoiles", tone: "sunset" },
  { min: 1, emoji: "🧘‍♀️", msg: "24h rien que pour toi", sub: "Prends soin de toi.", tone: "sunset" },
  { min: 0, emoji: "💫", msg: "Full energy", sub: "Tu as tout donné. La team est fière.", tone: "energy" },
];

function getVibe(j) { for (const v of CONGE_VIBES) { if (j >= v.min) return v; } return CONGE_VIBES[CONGE_VIBES.length - 1]; }
function toYMD(d) { return d.toISOString().slice(0, 10); }
function countWorkDays(s, e, half) { if (half) return 0.5; let c = 0; const d = new Date(s); const end = new Date(e); while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); } return c; }
function dayOfWeekFr(d) { return JOURS_FULL[(d.getDay() + 6) % 7]; }
function formatDateFr(d) { return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; }

function Sparkles({ active }) {
  if (!active) return null;
  return <div className={styles.sparklesWrap} aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <span key={i} className={styles.sparkle} style={{ "--i": i }} />)}</div>;
}

/* ═══ COMPONENT ═══ */
export default function MonPlanning() {
  const [absences, setAbsences] = useState([]);
  const [profile, setProfile] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [view, setView] = useState("month"); // month | week | day
  const [selectedDate, setSelectedDate] = useState(null); // panel latéral
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [vibeHover, setVibeHover] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showProjets, setShowProjets] = useState(true);
  const [showMissions, setShowMissions] = useState(true);
  const [showAbsences, setShowAbsences] = useState(true);

  const projects = useMemo(() => getFakeProjectsWithDates(), []);
  const myMissions = useMemo(() => projects.filter((p) => MY_MISSION_IDS.includes(p.id)), [projects]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [absRes, profRes] = await Promise.all([
        fetch("/api/employee-absences", { cache: "no-store" }),
        fetch("/api/employee-profiles?mine=true", { cache: "no-store" }),
      ]);
      if (cancelled) return;
      const absData = await absRes.json(); setAbsences(absData.items || []);
      try { const profData = await profRes.json(); if (profData.items?.length) setProfile(profData.items[0]); } catch {}
      setTimeout(() => setLoaded(true), 100);
    })();
    return () => { cancelled = true; };
  }, []);

  const solde = useMemo(() => {
    const credit = profile?.congesAnnuels || DEFAULT_CONGES;
    const year = new Date().getFullYear();
    const pris = absences.filter((a) => a.type === "conge" && a.statut === "valide" && a.dateDebut?.startsWith(String(year)))
      .reduce((sum, a) => sum + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0);
    return { credit, pris, reste: credit - pris };
  }, [absences, profile]);
  const vibe = useMemo(() => getVibe(solde.reste), [solde.reste]);

  // Build events map
  const calEvents = useMemo(() => {
    const map = {};
    const add = (dateStr, event) => { if (!map[dateStr]) map[dateStr] = []; map[dateStr].push(event); };
    if (showProjets) { for (const p of projects) { const d = new Date(p.dateDebut); const end = new Date(p.dateFin); while (d <= end) { add(toYMD(d), { type: "projet", ...p }); d.setDate(d.getDate() + 1); } } }
    if (showMissions) { for (const p of myMissions) { const d = new Date(p.dateDebut); const end = new Date(p.dateFin); while (d <= end) { const k = toYMD(d); const ex = map[k]?.find((e) => e.type === "projet" && e.id === p.id); if (ex) ex.isMine = true; else add(k, { type: "mission", ...p, isMine: true }); d.setDate(d.getDate() + 1); } } }
    if (showAbsences) { for (const a of absences) { const d = new Date(a.dateDebut); const end = new Date(a.dateFin); while (d <= end) { add(toYMD(d), { type: "absence", ...a, absType: ABSENCE_TYPES.find((t) => t.value === a.type) }); d.setDate(d.getDate() + 1); } } }
    return map;
  }, [projects, myMissions, absences, showProjets, showMissions, showAbsences]);

  // Calendar days for month view
  const calDays = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const first = new Date(y, m, 1); let start = (first.getDay() + 6) % 7;
    const sd = new Date(first); sd.setDate(sd.getDate() - start);
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(sd); d.setDate(d.getDate() + i); days.push(d); if (i >= 27 && d.getMonth() !== m) break; }
    return days;
  }, [calDate]);

  // Week days for week view
  const weekDays = useMemo(() => {
    const d = new Date(calDate); const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(dd.getDate() + i); return dd; });
  }, [calDate]);

  // Events for selected date (panel)
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return { projs: [], missions: [], abs: [] };
    const key = toYMD(selectedDate);
    const all = calEvents[key] || [];
    return {
      projs: all.filter((e) => e.type === "projet" && !e.isMine),
      missions: all.filter((e) => (e.type === "projet" && e.isMine) || e.type === "mission"),
      abs: all.filter((e) => e.type === "absence"),
    };
  }, [selectedDate, calEvents]);

  function handleDayClick(date) {
    setSelectedDate(date);
  }

  function openAbsenceForm(dateStr) {
    setEditId(null);
    setForm({ type: "", dateDebut: dateStr || "", dateFin: dateStr || "", demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openNew() { openAbsenceForm(""); }

  function openEdit(absence) {
    setEditId(String(absence._id));
    setForm({ type: absence.type || "", dateDebut: absence.dateDebut, dateFin: absence.dateFin, demiJournee: absence.demiJournee || "", commentaire: absence.commentaire || "" });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type) { alert("Choisis un type d'absence"); return; }
    if (form.dateDebut > form.dateFin) { alert("La date de fin doit être après le début"); return; }
    setSaving(true);
    const body = { type: form.type, dateDebut: form.dateDebut, dateFin: form.dateFin, demiJournee: form.demiJournee || null, commentaire: form.commentaire };
    const url = editId ? `/api/employee-absences/${editId}` : "/api/employee-absences";
    const res = await fetch(url, { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }
    if (editId) { setAbsences((prev) => prev.map((a) => (String(a._id) === editId ? data.item : a))); }
    else { setAbsences((prev) => [data.item, ...prev]); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 2500); }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette demande ?")) return;
    const res = await fetch(`/api/employee-absences/${id}`, { method: "DELETE" });
    if (res.ok) setAbsences((prev) => prev.filter((a) => String(a._id) !== id));
  }

  const today = toYMD(new Date());
  const month = calDate.getMonth();
  const pct = Math.max(3, (solde.reste / solde.credit) * 100);

  function navPrev() {
    setSelectedDate(null);
    setCalDate((d) => {
      const n = new Date(d);
      if (view === "month") n.setMonth(n.getMonth() - 1);
      else if (view === "week") n.setDate(n.getDate() - 7);
      else n.setDate(n.getDate() - 1);
      return n;
    });
  }
  function navNext() {
    setSelectedDate(null);
    setCalDate((d) => {
      const n = new Date(d);
      if (view === "month") n.setMonth(n.getMonth() + 1);
      else if (view === "week") n.setDate(n.getDate() + 7);
      else n.setDate(n.getDate() + 1);
      return n;
    });
  }
  function goToday() { setSelectedDate(null); setCalDate(new Date()); }

  function calLabel() {
    if (view === "month") return `${MOIS[calDate.getMonth()]} ${calDate.getFullYear()}`;
    if (view === "week") { const s = weekDays[0]; const e = weekDays[6]; return `${s.getDate()} ${MOIS[s.getMonth()].slice(0, 3)} — ${e.getDate()} ${MOIS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`; }
    return `${dayOfWeekFr(calDate)} ${formatDateFr(calDate)}`;
  }

  // Render events for a calendar cell
  function renderCellEvents(events, compact) {
    const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
    const abs = events.find((e) => e.type === "absence");
    const limit = compact ? 2 : 5;
    return (
      <div className={styles.calEvents}>
        {projs.slice(0, limit).map((p, j) => (
          <div key={j} className={`${styles.calEvt} ${p.isMine ? styles.calEvtMine : ""}`} style={{ "--ec": p.color }}>
            {p.isMine ? "👤" : "🎬"} {compact ? (p.title.length > 10 ? p.title.slice(0, 10) + "…" : p.title) : p.title}
          </div>
        ))}
        {projs.length > limit && <div className={styles.calEvtMore}>+{projs.length - limit}</div>}
        {abs && (
          <div className={`${styles.calEvt} ${styles.calEvtAbs} ${abs.statut === "en_attente" ? styles.calEvtPending : ""}`} style={{ "--ec": abs.absType?.color || "#888" }}>
            {abs.absType?.icon} {abs.absType?.label}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {showConfetti && <div className={styles.confettiWrap} aria-hidden="true">{Array.from({ length: 20 }).map((_, i) => <span key={i} className={styles.confetti} style={{ "--ci": i }} />)}</div>}

      {/* ═══ VIBE HERO ═══ */}
      <div className={`${styles.vibeHero} ${styles[`vibe_${vibe.tone}`] || ""} ${loaded ? styles.vibeLoaded : ""}`} onMouseEnter={() => setVibeHover(true)} onMouseLeave={() => setVibeHover(false)}>
        <Sparkles active={vibeHover} />
        <span className={`${styles.vibeEmoji} ${loaded ? styles.vibeEmojiAnim : ""}`}>{vibe.emoji}</span>
        <div className={styles.vibeCenter}>
          <h1 className={styles.vibeMsg}>{vibe.msg}</h1>
          <p className={styles.vibeSub}>{vibe.sub}</p>
          <div className={styles.vibeBarRow}>
            <div className={styles.vibeBar}><div className={`${styles.vibeBarFill} ${loaded ? styles.vibeBarGo : ""}`} style={{ "--tw": `${pct}%` }} /></div>
            <span className={styles.vibeCount}>{solde.reste}j / {solde.credit}</span>
          </div>
        </div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className={styles.toolbar}>
        <div className={styles.toggles}>
          <button className={`${styles.toggle} ${showProjets ? styles.toggleOn : ""}`} style={{ "--tg": "#e11d48" }} onClick={() => setShowProjets((v) => !v)}>
            <span className={styles.toggleDot} /> 🎬 Projets <span className={styles.toggleCount}>{projects.length}</span>
          </button>
          <button className={`${styles.toggle} ${showMissions ? styles.toggleOn : ""}`} style={{ "--tg": "#7c3aed" }} onClick={() => setShowMissions((v) => !v)}>
            <span className={styles.toggleDot} /> 👤 Mes missions <span className={styles.toggleCount}>{myMissions.length}</span>
          </button>
          <button className={`${styles.toggle} ${showAbsences ? styles.toggleOn : ""}`} style={{ "--tg": "#10b981" }} onClick={() => setShowAbsences((v) => !v)}>
            <span className={styles.toggleDot} /> 🌴 Absences <span className={styles.toggleCount}>{absences.length}</span>
          </button>
        </div>
        <button className={styles.addBtn} onClick={openNew}>+ Poser une absence</button>
      </div>

      {/* ═══ CALENDAR TOOLBAR ═══ */}
      <div className={styles.calBar}>
        <div className={styles.calNavGroup}>
          <button className={styles.calNav} onClick={navPrev}><span className={styles.calNavArrow}>‹</span></button>
          <button className={styles.calTodayBtn} onClick={goToday}>Aujourd'hui</button>
          <button className={styles.calNav} onClick={navNext}><span className={styles.calNavArrow}>›</span></button>
        </div>
        <h2 className={styles.calTitle}>{calLabel()}</h2>
        <div className={styles.viewSwitch}>
          <button className={`${styles.viewBtn} ${view === "month" ? styles.viewBtnOn : ""}`} onClick={() => setView("month")}>Mois</button>
          <button className={`${styles.viewBtn} ${view === "week" ? styles.viewBtnOn : ""}`} onClick={() => setView("week")}>Semaine</button>
          <button className={`${styles.viewBtn} ${view === "day" ? styles.viewBtnOn : ""}`} onClick={() => setView("day")}>Jour</button>
        </div>
      </div>

      {/* ═══ MAIN AREA : Calendar + Panel ═══ */}
      <div className={styles.mainArea}>

        {/* CALENDAR */}
        <div className={`${styles.calWrap} ${loaded ? styles.calLoaded : ""}`}>

          {/* VUE MOIS */}
          {view === "month" && (
            <div className={styles.calGrid7}>
              {JOURS_HEAD.map((j) => <div key={j} className={styles.calHeader}>{j}</div>)}
              {calDays.map((d, i) => {
                const key = toYMD(d); const isMonth = d.getMonth() === month; const isToday = key === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const events = calEvents[key] || []; const isSelected = selectedDate && toYMD(selectedDate) === key;
                return (
                  <div key={i} className={[styles.calDay, isToday && styles.calToday, !isMonth && styles.calOther, isWeekend && styles.calWeekend, isMonth && styles.calClickable, isSelected && styles.calSelected].filter(Boolean).join(" ")}
                    onClick={() => isMonth && handleDayClick(d)} role={isMonth ? "button" : undefined} tabIndex={isMonth ? 0 : undefined}
                    onKeyDown={(e) => { if (isMonth && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleDayClick(d); } }}>
                    <span className={styles.calNum}>{d.getDate()}</span>
                    {events.length > 0 ? renderCellEvents(events, true) : isMonth && <span className={styles.calPlus}>+</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* VUE SEMAINE */}
          {view === "week" && (
            <div className={styles.weekView}>
              {weekDays.map((d, i) => {
                const key = toYMD(d); const isToday = key === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const canClick = !isWeekend; const events = calEvents[key] || [];
                const isSelected = selectedDate && toYMD(selectedDate) === key;
                return (
                  <div key={i} className={[styles.weekCol, isToday && styles.weekColToday, isWeekend && styles.weekColWeekend, styles.weekColClickable, isSelected && styles.weekColSelected].filter(Boolean).join(" ")}
                    onClick={() => handleDayClick(d)} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDayClick(d); } }}>
                    <div className={styles.weekColHead}>
                      <span className={styles.weekColDay}>{JOURS_HEAD[i]}</span>
                      <span className={styles.weekColNum}>{d.getDate()}</span>
                    </div>
                    <div className={styles.weekColBody}>
                      {renderCellEvents(events, false)}
                      {!events.length && !isWeekend && <div className={styles.weekColEmpty}>Rien de prévu</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VUE JOUR */}
          {view === "day" && (() => {
            const key = toYMD(calDate); const events = calEvents[key] || [];
            const isWeekend = calDate.getDay() === 0 || calDate.getDay() === 6;
            const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
            const absList = events.filter((e) => e.type === "absence");
            return (
              <div className={styles.dayView}>
                <div className={styles.dayDate}>{dayOfWeekFr(calDate)} {formatDateFr(calDate)}</div>
                {isWeekend && <div className={styles.dayEmpty}>Week-end 😌</div>}
                {!isWeekend && !events.length && <div className={styles.dayEmpty}>Rien de prévu — journée libre</div>}
                {projs.length > 0 && (
                  <div className={styles.daySection}>
                    <h3 className={styles.daySectionTitle}>Projets</h3>
                    {projs.map((p, j) => (
                      <div key={j} className={styles.dayEvt} style={{ "--dc": p.color }}>
                        <span className={styles.dayEvtIcon}>{p.isMine ? "👤" : "🎬"}</span>
                        <div>
                          <div className={styles.dayEvtTitle}>{p.title}</div>
                          <div className={styles.dayEvtMeta}>{p.branche} · {p.statut}</div>
                        </div>
                        {p.isMine && <span className={styles.dayEvtBadge}>Ma mission</span>}
                      </div>
                    ))}
                  </div>
                )}
                {absList.length > 0 && (
                  <div className={styles.daySection}>
                    <h3 className={styles.daySectionTitle}>Absences</h3>
                    {absList.map((a, j) => (
                      <div key={j} className={styles.dayEvt} style={{ "--dc": a.absType?.color || "#888" }}>
                        <span className={styles.dayEvtIcon}>{a.absType?.icon}</span>
                        <div>
                          <div className={styles.dayEvtTitle}>{a.absType?.label}</div>
                          <div className={styles.dayEvtMeta}>{STATUT_LABELS[a.statut]?.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isWeekend && (
                  <button className={styles.dayAddBtn} onClick={() => openAbsenceForm(key)}>+ Poser une absence ce jour</button>
                )}
              </div>
            );
          })()}
        </div>

        {/* ═══ PANEL LATÉRAL — détail du jour ═══ */}
        {selectedDate && (() => {
          const dateStr = toYMD(selectedDate);
          const isFuture = dateStr >= today;
          const isToday2 = dateStr === today;
          return (
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelDay}>{dayOfWeekFr(selectedDate)}</div>
                <div className={styles.panelDate}>{selectedDate.getDate()} {MOIS[selectedDate.getMonth()]}</div>
                {isToday2 && <span className={styles.panelTodayTag}>Aujourd'hui</span>}
              </div>
              <button className={styles.panelClose} onClick={() => setSelectedDate(null)}>✕</button>
            </div>

            {/* Projets du jour */}
            {selectedEvents.projs.length > 0 && (
              <div className={styles.panelSection}>
                <h3 className={styles.panelSecTitle}>🎬 Projets</h3>
                {selectedEvents.projs.map((p, j) => (
                  <div key={j} className={styles.panelEvt} style={{ "--pc": p.color }}>
                    <div className={styles.panelEvtTitle}>{p.title}</div>
                    <div className={styles.panelEvtMeta}>{p.branche} · {p.statut}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Mes missions */}
            {selectedEvents.missions.length > 0 && (
              <div className={styles.panelSection}>
                <h3 className={styles.panelSecTitle}>👤 Mes missions</h3>
                {selectedEvents.missions.map((p, j) => (
                  <div key={j} className={styles.panelEvt} style={{ "--pc": p.color }}>
                    <div className={styles.panelEvtTitle}>{p.title}</div>
                    <div className={styles.panelEvtMeta}>{p.branche} · {p.statut}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Absences */}
            {selectedEvents.abs.length > 0 && (
              <div className={styles.panelSection}>
                <h3 className={styles.panelSecTitle}>🌴 Absences</h3>
                {selectedEvents.abs.map((a, j) => {
                  const s = STATUT_LABELS[a.statut] || { label: a.statut, cls: "" };
                  const canModify = a.statut === "en_attente" && a.dateDebut >= today;
                  return (
                    <div key={j} className={styles.panelEvt} style={{ "--pc": a.absType?.color || "#888" }}>
                      <div className={styles.panelEvtTitle}>{a.absType?.icon} {a.absType?.label}</div>
                      <span className={`${styles.panelEvtStatut} ${styles[s.cls]}`}>{s.label}</span>
                      {canModify && (
                        <div className={styles.panelEvtActions}>
                          <button className={styles.panelEditBtn} onClick={() => openEdit(a)}>Modifier</button>
                          <button className={styles.panelDeleteBtn} onClick={() => handleDelete(String(a._id))}>Supprimer</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedEvents.projs.length === 0 && selectedEvents.missions.length === 0 && selectedEvents.abs.length === 0 && (
              <div className={styles.panelEmpty}>Rien de prévu ce jour</div>
            )}

            {/* Actions — hub générique */}
            {isFuture && (
              <div className={styles.panelActions}>
                <h3 className={styles.panelSecTitle}>Ajouter</h3>
                <button className={styles.panelActionBtn} style={{ "--pab": "#10b981" }} onClick={() => openAbsenceForm(dateStr)}>
                  🌴 Poser une absence
                </button>
                <button className={styles.panelActionBtn} style={{ "--pab": "#7c3aed" }} disabled>
                  🎬 Ajouter un projet <span className={styles.panelSoon}>bientôt</span>
                </button>
                <button className={styles.panelActionBtn} style={{ "--pab": "#f59e0b" }} disabled>
                  📝 Ajouter une note <span className={styles.panelSoon}>bientôt</span>
                </button>
              </div>
            )}
          </aside>
          );
        })()}
      </div>

      {/* ═══ MES ABSENCES (compact, en bas) ═══ */}
      {absences.length > 0 && (
        <section className={styles.absSection}>
          <h2 className={styles.secTitle}>Mes absences</h2>
          <div className={styles.absList}>
            {absences.map((a) => {
              const t = ABSENCE_TYPES.find((t) => t.value === a.type); const s = STATUT_LABELS[a.statut] || { label: a.statut, cls: "" };
              const canEdit = a.statut === "en_attente" && a.dateDebut >= today; const jours = countWorkDays(a.dateDebut, a.dateFin, a.demiJournee);
              return (
                <div key={String(a._id)} className={styles.absCard} style={{ "--ac": t?.color || "#888" }}>
                  <span className={styles.absIcon}>{t?.icon || "📋"}</span>
                  <div className={styles.absBody}>
                    <div className={styles.absTop}>
                      <span className={styles.absType}>{t?.label}</span>
                      <span className={`${styles.absStatut} ${styles[s.cls]}`}>{s.label}</span>
                      <span className={styles.absDates}>{a.dateDebut === a.dateFin ? a.dateDebut : `${a.dateDebut} → ${a.dateFin}`}</span>
                      <span className={styles.absJours}>{jours}j</span>
                    </div>
                    {a.commentaire && <p className={styles.absComment}>{a.commentaire}</p>}
                    {a.motifRefus && <p className={styles.absRefus}>Motif : {a.motifRefus}</p>}
                  </div>
                  {canEdit && (
                    <div className={styles.absActions}>
                      <button className={styles.editBtn} onClick={() => openEdit(a)}>Modifier</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(String(a._id))}>Supprimer</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ MODALE ═══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Modifier" : "Poser une absence"} size="sm">
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.formHint}>Quel type ?</p>
          <div className={styles.typeGrid}>
            {ABSENCE_TYPES.map((t) => (
              <button key={t.value} type="button" className={`${styles.typeCard} ${form.type === t.value ? styles.typeCardOn : ""}`} style={{ "--tc": t.color, "--tcbg": t.gradient }}
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}>
                <span className={styles.tcIcon}>{t.icon}</span>
                <span className={styles.tcLabel}>{t.label}</span>
                <span className={styles.tcDesc}>{t.desc}</span>
              </button>
            ))}
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.field}>Du <input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label>
            <label className={styles.field}>Au <input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} required /></label>
          </div>
          <label className={styles.field}>Demi-journée ?
            <select value={form.demiJournee} onChange={(e) => setForm((f) => ({ ...f, demiJournee: e.target.value }))}><option value="">Journée complète</option><option value="matin">Matin</option><option value="apres-midi">Après-midi</option></select>
          </label>
          <label className={styles.field}>Un petit mot ?
            <textarea value={form.commentaire} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))} rows={2} placeholder="Voyage, recharge, aventure..." />
          </label>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)} disabled={saving}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={saving || !form.type}>{saving ? "Envoi..." : editId ? "Modifier" : "C'est parti ! 🚀"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
