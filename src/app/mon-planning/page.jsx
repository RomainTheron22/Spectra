"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./MonPlanning.module.css";
import Modal from "../../components/ui/Modal";

/* ═══════════════════════════════════════════
   DATA & CONSTANTS
   ═══════════════════════════════════════════ */

const ABSENCE_TYPES = [
  { value: "conge", label: "Congé", color: "#10b981", icon: "🌴", desc: "Vacances, repos, journée perso", gradient: "linear-gradient(135deg, #d1fae5, #a7f3d0)" },
  { value: "tt", label: "Télétravail", color: "#8b5cf6", icon: "🏡", desc: "Je bosse de chez moi", gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)" },
  { value: "maladie", label: "Maladie", color: "#f43f5e", icon: "🤧", desc: "Arrêt maladie", gradient: "linear-gradient(135deg, #ffe4e6, #fecdd3)" },
  { value: "absence_autre", label: "Autre", color: "#f59e0b", icon: "✨", desc: "RDV, formation, perso...", gradient: "linear-gradient(135deg, #fef3c7, #fde68a)" },
];

const STATUT_LABELS = {
  en_attente: { label: "En attente", cls: "statutAttente" },
  valide: { label: "Validé", cls: "statutValide" },
  refuse: { label: "Refusé", cls: "statutRefuse" },
};

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_HEAD = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const JOURS_FULL = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi"];
const DEFAULT_CONGES = 30;

// Fake projects data — sera remplacé par l'API plus tard
const FAKE_PROJECTS = [
  { id: "p1", title: "Clip Artiste X", branche: "Production AV", color: "#e11d48", dateDebut: null, dateFin: null, statut: "En production" },
  { id: "p2", title: "Scéno Salon Y", branche: "Scénographie", color: "#7c3aed", dateDebut: null, dateFin: null, statut: "Conception" },
  { id: "p3", title: "Podcast S3", branche: "CreativGen", color: "#0891b2", dateDebut: null, dateFin: null, statut: "Stand-by" },
  { id: "p4", title: "Décor Festival Z", branche: "Atelier", color: "#ca8a04", dateDebut: null, dateFin: null, statut: "En cours" },
  { id: "p5", title: "Campagne Marque W", branche: "Communication", color: "#059669", dateDebut: null, dateFin: null, statut: "Livré" },
];

// Assign dates dynamically relative to current month
function getFakeProjectsWithDates() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { ...FAKE_PROJECTS[0], dateDebut: toYMD(new Date(y, m, 8)), dateFin: toYMD(new Date(y, m, 18)) },
    { ...FAKE_PROJECTS[1], dateDebut: toYMD(new Date(y, m, 3)), dateFin: toYMD(new Date(y, m, 14)) },
    { ...FAKE_PROJECTS[2], dateDebut: toYMD(new Date(y, m, 20)), dateFin: toYMD(new Date(y, m, 28)) },
    { ...FAKE_PROJECTS[3], dateDebut: toYMD(new Date(y, m, 12)), dateFin: toYMD(new Date(y, m, 25)) },
    { ...FAKE_PROJECTS[4], dateDebut: toYMD(new Date(y, m, 1)), dateFin: toYMD(new Date(y, m, 6)) },
  ];
}

// My missions (subset)
const MY_MISSION_IDS = ["p1", "p3"];

const CONGE_VIBES = [
  { min: 30, emoji: "🌏", msg: "Le monde entier est à toi", sub: "Six semaines d'aventure — où tu veux, quand tu veux", tone: "ocean" },
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

function Sparkles({ active }) {
  if (!active) return null;
  return <div className={styles.sparklesWrap} aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <span key={i} className={styles.sparkle} style={{ "--i": i }} />)}</div>;
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
export default function MonPlanning() {
  const [absences, setAbsences] = useState([]);
  const [profile, setProfile] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [vibeHover, setVibeHover] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Toggles — tous activés par défaut
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
      const absData = await absRes.json();
      setAbsences(absData.items || []);
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

  // Build calendar events map
  const calEvents = useMemo(() => {
    const map = {};
    const add = (dateStr, event) => { if (!map[dateStr]) map[dateStr] = []; map[dateStr].push(event); };

    if (showProjets) {
      for (const p of projects) {
        const d = new Date(p.dateDebut);
        const end = new Date(p.dateFin);
        while (d <= end) { add(toYMD(d), { type: "projet", ...p }); d.setDate(d.getDate() + 1); }
      }
    }
    if (showMissions) {
      for (const p of myMissions) {
        const d = new Date(p.dateDebut);
        const end = new Date(p.dateFin);
        while (d <= end) {
          const key = toYMD(d);
          const existing = map[key]?.find((e) => e.type === "projet" && e.id === p.id);
          if (existing) existing.isMine = true;
          else add(key, { type: "mission", ...p, isMine: true });
          d.setDate(d.getDate() + 1);
        }
      }
    }
    if (showAbsences) {
      for (const a of absences) {
        const d = new Date(a.dateDebut);
        const end = new Date(a.dateFin);
        while (d <= end) { add(toYMD(d), { type: "absence", ...a, absType: ABSENCE_TYPES.find((t) => t.value === a.type) }); d.setDate(d.getDate() + 1); }
      }
    }
    return map;
  }, [projects, myMissions, absences, showProjets, showMissions, showAbsences]);

  const calDays = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const first = new Date(y, m, 1);
    let start = (first.getDay() + 6) % 7;
    const sd = new Date(first); sd.setDate(sd.getDate() - start);
    const days = [];
    for (let i = 0; i < 42; i++) { const d = new Date(sd); d.setDate(d.getDate() + i); days.push(d); if (i >= 27 && d.getMonth() !== m) break; }
    return days;
  }, [calDate]);

  // Week view
  const weekDays = useMemo(() => {
    const now = new Date(); const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now); mon.setDate(diff);
    return Array.from({ length: 5 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  }, []);

  function handleDayClick(date, dayEvents) {
    const dateStr = toYMD(date);
    const pendingAbs = dayEvents.find((e) => e.type === "absence" && e.statut === "en_attente");
    if (pendingAbs) { openEdit(pendingAbs); return; }
    setEditId(null);
    setForm({ type: "", dateDebut: dateStr, dateFin: dateStr, demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openNew() { setEditId(null); setForm({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" }); setModalOpen(true); }

  function openEdit(absence) {
    setEditId(String(absence._id));
    setForm({ type: absence.type || absence.absType?.value || "", dateDebut: absence.dateDebut, dateFin: absence.dateFin, demiJournee: absence.demiJournee || "", commentaire: absence.commentaire || "" });
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
    const data = await res.json();
    setSaving(false);
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
  const activeCount = [showProjets, showMissions, showAbsences].filter(Boolean).length;

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

      {/* ═══ TOOLBAR : toggles + nav ═══ */}
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

      {/* ═══ LAYOUT PRINCIPAL : Semaine | Calendrier ═══ */}
      <div className={styles.mainGrid}>

      {/* ═══ MA SEMAINE (gauche) ═══ */}
      <section className={`${styles.weekSection} ${loaded ? styles.weekLoaded : ""}`}>
        <h2 className={styles.secTitle}>Ma semaine</h2>
        <div className={styles.weekCards}>
          {weekDays.map((d, i) => {
            const dateStr = toYMD(d);
            const isToday = dateStr === today;
            const events = calEvents[dateStr] || [];
            const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
            const abs = events.find((e) => e.type === "absence");
            return (
              <div key={i} className={`${styles.wkCard} ${isToday ? styles.wkToday : ""}`} onClick={() => handleDayClick(d, events)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDayClick(d, events); } }}>
                {isToday && <span className={styles.wkBadge}>Aujourd'hui</span>}
                <div className={styles.wkHead}>
                  <span className={styles.wkDay}>{JOURS_FULL[i]}</span>
                  <span className={styles.wkDate}>{d.getDate()}</span>
                </div>
                <div className={styles.wkEvents}>
                  {projs.map((p, j) => (
                    <div key={j} className={styles.wkEvt} style={{ "--wc": p.color }}>
                      {p.isMine ? "👤" : "🎬"} {p.title}
                    </div>
                  ))}
                  {abs && (
                    <div className={`${styles.wkEvt} ${styles.wkEvtAbs}`} style={{ "--wc": abs.absType?.color || "#888" }}>
                      {abs.absType?.icon} {abs.absType?.label}
                    </div>
                  )}
                  {!events.length && <div className={styles.wkFree}>Libre <span className={styles.wkAddHint}>+</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ CALENDRIER (droite) ═══ */}
      <section className={`${styles.calSection} ${loaded ? styles.calLoaded : ""}`}>
        <div className={styles.calToolbar}>
          <button className={styles.calNav} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}><span className={styles.calNavArrow}>‹</span></button>
          <h2 className={styles.calTitle}>{MOIS[month]} {calDate.getFullYear()}</h2>
          <button className={styles.calNav} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}><span className={styles.calNavArrow}>›</span></button>
        </div>

        <div className={styles.calGrid}>
          {JOURS_HEAD.map((j) => <div key={j} className={styles.calHeader}>{j}</div>)}
          {calDays.map((d, i) => {
            const key = toYMD(d);
            const isMonth = d.getMonth() === month;
            const isToday = key === today;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const canClick = isMonth && !isWeekend;
            const events = calEvents[key] || [];
            const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
            const abs = events.find((e) => e.type === "absence");

            return (
              <div key={i} className={[styles.calDay, isToday && styles.calToday, !isMonth && styles.calOther, isWeekend && styles.calWeekend, canClick && styles.calClickable].filter(Boolean).join(" ")}
                onClick={() => canClick && handleDayClick(d, events)} role={canClick ? "button" : undefined} tabIndex={canClick ? 0 : undefined}
                onKeyDown={(e) => { if (canClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleDayClick(d, events); } }}>
                <span className={styles.calNum}>{d.getDate()}</span>
                <div className={styles.calEvents}>
                  {projs.slice(0, 2).map((p, j) => (
                    <div key={j} className={`${styles.calEvt} ${p.isMine ? styles.calEvtMine : ""}`} style={{ "--ec": p.color }}>
                      {p.isMine ? "👤" : "🎬"} {p.title.length > 10 ? p.title.slice(0, 10) + "…" : p.title}
                    </div>
                  ))}
                  {projs.length > 2 && <div className={styles.calEvtMore}>+{projs.length - 2}</div>}
                  {abs && (
                    <div className={`${styles.calEvt} ${styles.calEvtAbs} ${abs.statut === "en_attente" ? styles.calEvtPending : ""}`} style={{ "--ec": abs.absType?.color || "#888" }}>
                      {abs.absType?.icon} {abs.absType?.label}
                    </div>
                  )}
                </div>
                {!events.length && canClick && <span className={styles.calPlus}>+</span>}
              </div>
            );
          })}
        </div>
      </section>

      </div>{/* end mainGrid */}

      {/* ═══ MES ABSENCES (compact) ═══ */}
      {absences.length > 0 && (
        <section className={styles.absSection}>
          <h2 className={styles.secTitle}>Mes absences</h2>
          <div className={styles.absList}>
            {absences.map((a) => {
              const t = ABSENCE_TYPES.find((t) => t.value === a.type);
              const s = STATUT_LABELS[a.statut] || { label: a.statut, cls: "" };
              const canEdit = a.statut === "en_attente";
              const jours = countWorkDays(a.dateDebut, a.dateFin, a.demiJournee);
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
            <select value={form.demiJournee} onChange={(e) => setForm((f) => ({ ...f, demiJournee: e.target.value }))}>
              <option value="">Journée complète</option><option value="matin">Matin</option><option value="apres-midi">Après-midi</option>
            </select>
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
