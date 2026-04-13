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

// Couleurs par branche de projet
const BRANCH_COLORS = {
  "Agency": "#e11d48",
  "CreativeGen": "#7c3aed",
  "Entertainment": "#0891b2",
  "SFX": "#ca8a04",
  "default": "#6b7280",
};

function projectColor(branche) {
  return BRANCH_COLORS[branche] || BRANCH_COLORS.default;
}

function normalizeProject(contrat) {
  return {
    id: String(contrat._id),
    title: contrat.nom || contrat.nomContrat || "Sans nom",
    branche: contrat.branche || "—",
    color: projectColor(contrat.branche),
    statut: contrat.statut || "—",
    dateDebut: contrat.dateDebut || null,
    dateFin: contrat.dateFin || null,
    assignees: contrat.assignees || contrat.equipe || [],
  };
}

// Phrases du jour — inspirantes, contextuelles, rotatives
const DAILY_QUOTES = [
  { emoji: "🚀", msg: "Chaque jour est une nouvelle chance de créer quelque chose d'incroyable", author: "" },
  { emoji: "🎬", msg: "Les meilleures histoires commencent par 'Et si on essayait ?'", author: "" },
  { emoji: "✨", msg: "La créativité, c'est l'intelligence qui s'amuse", author: "Albert Einstein" },
  { emoji: "🌟", msg: "Fais de chaque détail une oeuvre", author: "" },
  { emoji: "💡", msg: "L'imagination est le début de la création", author: "George Bernard Shaw" },
  { emoji: "🎯", msg: "Vise la lune. Même en cas d'échec, tu atterriras parmi les étoiles", author: "Oscar Wilde" },
  { emoji: "🔥", msg: "Le talent, c'est l'audace que les autres n'ont pas eue", author: "" },
  { emoji: "🌈", msg: "Après la pluie, le beau temps — et des projets encore plus fous", author: "" },
  { emoji: "🎨", msg: "Chaque projet est une toile blanche. À toi de jouer.", author: "" },
  { emoji: "⚡", msg: "L'énergie d'une équipe, c'est sa plus grande force créative", author: "" },
  { emoji: "🌺", msg: "Prends le temps de bien faire. La qualité, ça se ressent.", author: "" },
  { emoji: "🏔️", msg: "Les grands projets se construisent un pas après l'autre", author: "" },
  { emoji: "🎭", msg: "Le spectacle continue — et il est magnifique", author: "" },
  { emoji: "💫", msg: "Aujourd'hui est un bon jour pour faire avancer les choses", author: "" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

// Vibes congés — chaque palier a sa référence culturelle
const CONGE_VIBES = [
  { min: 30, emoji: "🌍", msg: "30 jours. Phileas Fogg a fait le tour du monde en 80 — tu as de la marge", sub: "Six semaines d'aventure t'attendent" },
  { min: 28, emoji: "🌙", msg: "28 jours. Un cycle lunaire complet. Assez pour se transformer", sub: "La lune fait le tour, toi aussi" },
  { min: 25, emoji: "🎄", msg: "25 jours. Comme un calendrier de l'Avent — chaque jour est une surprise", sub: "Ouvre chaque case avec impatience" },
  { min: 21, emoji: "🃏", msg: "21. Blackjack. Tu as la main parfaite", sub: "Trois semaines de pur kiff" },
  { min: 18, emoji: "⛳", msg: "18 jours. Un parcours de golf complet. Trou par trou, profite", sub: "Prends ton temps, vise le green" },
  { min: 15, emoji: "🏉", msg: "15 jours. Comme une équipe de rugby — en force", sub: "Deux semaines et demie d'évasion" },
  { min: 12, emoji: "🕐", msg: "12 jours. 12 coups de minuit. Cendrillon avait moins de temps que toi", sub: "Et elle a quand même dansé" },
  { min: 10, emoji: "🔟", msg: "10 jours. Les 10 Commandements ont changé le monde — imagine ce que tu peux faire", sub: "Deux semaines les pieds dans le sable" },
  { min: 7, emoji: "🌅", msg: "7 jours. Le monde a été créé en 7 jours. On a de quoi encore faire pas mal de choses", sub: "Une semaine pour tout réinventer" },
  { min: 5, emoji: "🖐️", msg: "5 jours. Les 5 sens. Prends le temps de tous les éveiller", sub: "Une semaine pour se reconnecter" },
  { min: 3, emoji: "🧞", msg: "3 jours. Trois voeux. Choisis-les bien", sub: "Un long week-end magique" },
  { min: 2, emoji: "🎭", msg: "2 jours. Pile et face. L'aventure ou le repos ? Pourquoi pas les deux", sub: "48h rien qu'à toi" },
  { min: 1, emoji: "🎯", msg: "1 jour. 24h. 1440 minutes. Chacune compte — fais-en un chef-d'oeuvre", sub: "Une journée, une histoire" },
  { min: 0, emoji: "⚡", msg: "0 jour. Batterie à 100%. Tu as tout donné — et la team le sait", sub: "Full power. Respect." },
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
  const [modalType, setModalType] = useState(""); // "absence" | "projet" | "note" | "choose"
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
  const [projForm, setProjForm] = useState({ nom: "", branche: "", dateDebut: "", dateFin: "", description: "" });
  const [noteForm, setNoteForm] = useState({ contenu: "", dateDebut: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [vibeHover, setVibeHover] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showProjets, setShowProjets] = useState(true);
  const [showMissions, setShowMissions] = useState(true);
  const [showAbsences, setShowAbsences] = useState(true);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [showGcal, setShowGcal] = useState(true);
  const [gcalCalendars, setGcalCalendars] = useState([]);
  const [gcalSelectedIds, setGcalSelectedIds] = useState([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [showCalPicker, setShowCalPicker] = useState(false);

  const [projects, setProjects] = useState([]);

  // Mes missions = projets où mon userId est dans les assignees
  const myMissions = useMemo(() => {
    if (!profile?.userId) return [];
    return projects.filter((p) => Array.isArray(p.assignees) && p.assignees.some((a) => String(a) === String(profile.userId) || String(a._id || a.id || a) === String(profile.userId)));
  }, [projects, profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [absRes, profRes, projRes] = await Promise.all([
        fetch("/api/employee-absences", { cache: "no-store" }),
        fetch("/api/employee-profiles?mine=true", { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
      ]);
      if (cancelled) return;
      const absData = await absRes.json(); setAbsences(absData.items || []);
      try { const profData = await profRes.json(); if (profData.items?.length) setProfile(profData.items[0]); } catch {}
      try { const projData = await projRes.json(); setProjects((projData.items || []).map(normalizeProject).filter((p) => p.dateDebut && p.dateFin)); } catch {}
      // Google Calendar — fetch calendriers + events
      try {
        const calRes = await fetch("/api/planning/google-calendar/calendars", { cache: "no-store" });
        const calData = await calRes.json();
        if (calData.connected) {
          setGcalConnected(true);
          setGcalCalendars(calData.calendars || []);
          setGcalSelectedIds(calData.selectedIds || []);
        }
        const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
        const from = new Date(y, m, 1).toISOString();
        const to = new Date(y, m + 2, 0).toISOString();
        const gcRes = await fetch(`/api/planning/google-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
        const gcData = await gcRes.json();
        if (gcData.items) setGcalEvents(gcData.items);
      } catch {}
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
  const dailyQuote = useMemo(() => getDailyQuote(), []);

  // Récap absences par type
  const absRecap = useMemo(() => {
    const year = new Date().getFullYear();
    const thisYear = absences.filter((a) => a.statut === "valide" && a.dateDebut?.startsWith(String(year)));
    return {
      conge: thisYear.filter((a) => a.type === "conge").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
      tt: thisYear.filter((a) => a.type === "tt").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
      maladie: thisYear.filter((a) => a.type === "maladie").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
      autre: thisYear.filter((a) => a.type === "absence_autre").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
    };
  }, [absences]);

  // Build events map
  const calEvents = useMemo(() => {
    const map = {};
    const add = (dateStr, event) => { if (!map[dateStr]) map[dateStr] = []; map[dateStr].push(event); };
    if (showProjets) { for (const p of projects) { const d = new Date(p.dateDebut); const end = new Date(p.dateFin); while (d <= end) { add(toYMD(d), { type: "projet", ...p }); d.setDate(d.getDate() + 1); } } }
    if (showMissions) { for (const p of myMissions) { const d = new Date(p.dateDebut); const end = new Date(p.dateFin); while (d <= end) { const k = toYMD(d); const ex = map[k]?.find((e) => e.type === "projet" && e.id === p.id); if (ex) ex.isMine = true; else add(k, { type: "mission", ...p, isMine: true }); d.setDate(d.getDate() + 1); } } }
    if (showAbsences) { for (const a of absences) { const d = new Date(a.dateDebut); const end = new Date(a.dateFin); while (d <= end) { add(toYMD(d), { type: "absence", ...a, absType: ABSENCE_TYPES.find((t) => t.value === a.type) }); d.setDate(d.getDate() + 1); } } }
    if (showGcal) {
      for (const ev of gcalEvents) {
        if (!ev.start) continue;
        // Google Calendar dates can be ISO datetime or date-only
        const startDate = String(ev.start).slice(0, 10);
        const endRaw = ev.end ? String(ev.end).slice(0, 10) : startDate;
        // All-day events: Google sets end to next day, so subtract 1
        let endDate = endRaw;
        if (ev.end && !ev.end.includes("T") && endRaw > startDate) {
          const ed = new Date(endRaw); ed.setDate(ed.getDate() - 1); endDate = toYMD(ed);
        }
        // Find calendar color
        const sourceCal = gcalCalendars.find((c) => c.id === ev.calendarId);
        const evColor = sourceCal?.backgroundColor || "#4285f4";
        const calName = sourceCal?.summary || "";
        const d = new Date(startDate); const end = new Date(endDate);
        while (d <= end) { add(toYMD(d), { type: "gcal", title: ev.title, color: evColor, gcalId: ev.gcalId, calendarName: calName }); d.setDate(d.getDate() + 1); }
      }
    }
    return map;
  }, [projects, myMissions, absences, gcalEvents, gcalCalendars, showProjets, showMissions, showAbsences, showGcal]);

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
    if (!selectedDate) return { projs: [], missions: [], abs: [], gcals: [] };
    const key = toYMD(selectedDate);
    const all = calEvents[key] || [];
    return {
      projs: all.filter((e) => e.type === "projet" && !e.isMine),
      missions: all.filter((e) => (e.type === "projet" && e.isMine) || e.type === "mission"),
      abs: all.filter((e) => e.type === "absence"),
      gcals: all.filter((e) => e.type === "gcal"),
    };
  }, [selectedDate, calEvents]);

  function handleDayClick(date) {
    setSelectedDate(date);
  }

  async function toggleGcalCalendar(calId) {
    const newIds = gcalSelectedIds.includes(calId) ? gcalSelectedIds.filter((id) => id !== calId) : [...gcalSelectedIds, calId];
    setGcalSelectedIds(newIds);
    // Save d'abord, puis attendre avant de refetch
    const saveRes = await fetch("/api/planning/google-calendar/calendars", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarIds: newIds }),
    });
    if (!saveRes.ok) return;
    // Refetch events
    await refetchGcalEvents();
  }

  async function refetchGcalEvents() {
    try {
      const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
      const from = new Date(y, m, 1).toISOString();
      const to = new Date(y, m + 2, 0).toISOString();
      const gcRes = await fetch(`/api/planning/google-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const gcData = await gcRes.json();
      if (gcData.items) setGcalEvents(gcData.items);
    } catch {}
  }

  function openChoose(dateStr) {
    setEditId(null);
    setModalType("choose");
    setForm({ type: "", dateDebut: dateStr || "", dateFin: dateStr || "", demiJournee: "", commentaire: "" });
    setProjForm({ nom: "", branche: "", dateDebut: dateStr || "", dateFin: dateStr || "", description: "" });
    setNoteForm({ contenu: "", dateDebut: dateStr || "" });
    setModalOpen(true);
  }

  function openAbsenceForm(dateStr) {
    setEditId(null);
    setModalType("absence");
    setForm({ type: "", dateDebut: dateStr || "", dateFin: dateStr || "", demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openProjForm(dateStr) {
    setModalType("projet");
    setProjForm({ nom: "", branche: "", dateDebut: dateStr || "", dateFin: dateStr || "", description: "" });
    setModalOpen(true);
  }

  function openNoteForm(dateStr) {
    setModalType("note");
    setNoteForm({ contenu: "", dateDebut: dateStr || toYMD(new Date()) });
    setModalOpen(true);
  }

  function openNew() { openChoose(""); }

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

  async function handleSubmitProjet(e) {
    e.preventDefault();
    if (!projForm.nom) { alert("Le nom du projet est obligatoire"); return; }
    setSaving(true);
    const body = { nom: projForm.nom, branche: projForm.branche, dateDebut: projForm.dateDebut, dateFin: projForm.dateFin, brief: projForm.description, statut: "En cours" };
    const res = await fetch("/api/contrats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }
    const newProj = normalizeProject(data.item || data);
    if (newProj.dateDebut && newProj.dateFin) setProjects((prev) => [...prev, newProj]);
    setShowConfetti(true); setTimeout(() => setShowConfetti(false), 2500);
    setModalOpen(false);
  }

  async function handleSubmitNote(e) {
    e.preventDefault();
    if (!noteForm.contenu) { alert("La note ne peut pas être vide"); return; }
    // Pour l'instant, on stocke les notes comme des events Google Calendar
    // TODO: créer une collection notes dédiée si besoin
    setSaving(true);
    const body = { title: noteForm.contenu, start: `${noteForm.dateDebut}T09:00:00`, end: `${noteForm.dateDebut}T09:30:00` };
    const res = await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur — vérifie que Google Agenda est connecté"); return; }
    if (data.item) setGcalEvents((prev) => [...prev, data.item]);
    setShowConfetti(true); setTimeout(() => setShowConfetti(false), 2500);
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

  function renderCellEvents(events, compact) {
    const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
    const abs = events.find((e) => e.type === "absence");
    const gcals = events.filter((e) => e.type === "gcal");
    const limit = compact ? 2 : 5;
    return (
      <div className={styles.calEvents}>
        {projs.slice(0, limit).map((p, j) => (
          <div key={`p${j}`} className={`${styles.calEvt} ${p.isMine ? styles.calEvtMine : ""}`} style={{ "--ec": p.color }}>
            {p.isMine ? "👤" : "🎬"} {compact ? (p.title.length > 10 ? p.title.slice(0, 10) + "…" : p.title) : p.title}
          </div>
        ))}
        {projs.length > limit && <div className={styles.calEvtMore}>+{projs.length - limit}</div>}
        {gcals.slice(0, compact ? 1 : 3).map((g, j) => (
          <div key={`g${j}`} className={styles.calEvt} style={{ "--ec": g.color || "#4285f4" }}>
            📅 {compact ? (g.title.length > 10 ? g.title.slice(0, 10) + "…" : g.title) : g.title}
          </div>
        ))}
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

      {/* ═══ PHRASE DU JOUR ═══ */}
      <div className={`${styles.quoteHero} ${loaded ? styles.quoteLoaded : ""}`} onMouseEnter={() => setVibeHover(true)} onMouseLeave={() => setVibeHover(false)}>
        <Sparkles active={vibeHover} />
        <span className={`${styles.quoteEmoji} ${loaded ? styles.quoteEmojiAnim : ""}`}>{dailyQuote.emoji}</span>
        <div className={styles.quoteCenter}>
          <p className={styles.quoteMsg}>{dailyQuote.msg}</p>
          {dailyQuote.author && <span className={styles.quoteAuthor}>— {dailyQuote.author}</span>}
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
          {gcalConnected && (
            <>
              <button className={`${styles.toggle} ${showGcal ? styles.toggleOn : ""}`} style={{ "--tg": "#4285f4" }} onClick={() => setShowGcal((v) => !v)}>
                <span className={styles.toggleDot} /> 📅 Agenda <span className={styles.toggleCount}>{gcalEvents.length}</span>
              </button>
              <button className={styles.toggleGear} onClick={() => setShowCalPicker((v) => !v)} title="Choisir les agendas">⚙️</button>
            </>
          )}
        </div>
        <button className={styles.addBtn} onClick={openNew}>+ Ajouter</button>
      </div>

      {/* ═══ CALENDAR PICKER (dropdown) ═══ */}
      {showCalPicker && (
        <div className={styles.calPicker}>
          <div className={styles.calPickerHeader}>
            <span className={styles.calPickerTitle}>📅 Tes agendas Google</span>
            <button className={styles.calPickerClose} onClick={() => setShowCalPicker(false)}>✕</button>
          </div>
          <div className={styles.calPickerList}>
            {gcalCalendars.map((cal) => {
              const isOn = gcalSelectedIds.includes(cal.id);
              return (
                <button key={cal.id} className={`${styles.calPickerItem} ${isOn ? styles.calPickerItemOn : ""}`}
                  style={{ "--cpb": cal.backgroundColor || "#4285f4" }}
                  onClick={() => toggleGcalCalendar(cal.id)}>
                  <span className={styles.calPickerDot} />
                  <span className={styles.calPickerName}>{cal.summary}</span>
                  {cal.primary && <span className={styles.calPickerPrimary}>Principal</span>}
                  <span className={styles.calPickerCheck}>{isOn ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          {gcalCalendars.length === 0 && <p className={styles.calPickerEmpty}>Aucun agenda trouvé</p>}
        </div>
      )}

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

            {/* Google Agenda */}
            {selectedEvents.gcals.length > 0 && (
              <div className={styles.panelSection}>
                <h3 className={styles.panelSecTitle}>📅 Google Agenda</h3>
                {selectedEvents.gcals.map((g, j) => (
                  <div key={j} className={styles.panelEvt} style={{ "--pc": g.color || "#4285f4" }}>
                    <div className={styles.panelEvtTitle}>{g.title}</div>
                    {g.calendarName && <div className={styles.panelEvtMeta}>{g.calendarName}</div>}
                  </div>
                ))}
              </div>
            )}

            {selectedEvents.projs.length === 0 && selectedEvents.missions.length === 0 && selectedEvents.abs.length === 0 && selectedEvents.gcals.length === 0 && (
              <div className={styles.panelEmpty}>Rien de prévu ce jour</div>
            )}

            {/* Actions — hub générique */}
            {isFuture && (
              <div className={styles.panelActions}>
                <h3 className={styles.panelSecTitle}>Ajouter</h3>
                <button className={styles.panelActionBtn} style={{ "--pab": "#10b981" }} onClick={() => openAbsenceForm(dateStr)}>
                  🌴 Poser une absence
                </button>
                <button className={styles.panelActionBtn} style={{ "--pab": "#7c3aed" }} onClick={() => openProjForm(dateStr)}>
                  🎬 Ajouter un projet
                </button>
                <button className={styles.panelActionBtn} style={{ "--pab": "#f59e0b" }} onClick={() => openNoteForm(dateStr)}>
                  📝 Ajouter une note
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalType === "choose" ? "Que veux-tu ajouter ?" : modalType === "absence" ? (editId ? "Modifier l'absence" : "Poser une absence") : modalType === "projet" ? "Ajouter un projet" : "Ajouter une note"} size="sm">

        {/* CHOIX : absence / projet / note */}
        {modalType === "choose" && (
          <div className={styles.chooseGrid}>
            <button className={styles.chooseCard} style={{ "--cc": "#10b981" }} onClick={() => { setModalType("absence"); }}>
              <span className={styles.chooseIcon}>🌴</span>
              <span className={styles.chooseLabel}>Absence</span>
              <span className={styles.chooseDesc}>Congé, TT, maladie...</span>
            </button>
            <button className={styles.chooseCard} style={{ "--cc": "#7c3aed" }} onClick={() => { setModalType("projet"); }}>
              <span className={styles.chooseIcon}>🎬</span>
              <span className={styles.chooseLabel}>Projet</span>
              <span className={styles.chooseDesc}>Tournage, scéno, event...</span>
            </button>
            <button className={styles.chooseCard} style={{ "--cc": "#f59e0b" }} onClick={() => { setModalType("note"); }}>
              <span className={styles.chooseIcon}>📝</span>
              <span className={styles.chooseLabel}>Note</span>
              <span className={styles.chooseDesc}>Rappel, idée, memo...</span>
            </button>
          </div>
        )}

        {/* ABSENCE */}
        {modalType === "absence" && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {!editId && (
              <div className={styles.recapBar}>
                <div className={styles.recapItem} style={{ "--rc": "#10b981" }}>
                  <span className={styles.recapIcon}>🌴</span>
                  <div className={styles.recapData}><span className={styles.recapValue}>{absRecap.conge}j</span><span className={styles.recapLabel}>Congés</span></div>
                </div>
                <div className={styles.recapItem} style={{ "--rc": "#8b5cf6" }}>
                  <span className={styles.recapIcon}>🏡</span>
                  <div className={styles.recapData}><span className={styles.recapValue}>{absRecap.tt}j</span><span className={styles.recapLabel}>TT</span></div>
                </div>
                <div className={styles.recapItem} style={{ "--rc": "#f43f5e" }}>
                  <span className={styles.recapIcon}>🤧</span>
                  <div className={styles.recapData}><span className={styles.recapValue}>{absRecap.maladie}j</span><span className={styles.recapLabel}>Maladie</span></div>
                </div>
                <div className={styles.recapVibe}>
                  <span className={styles.recapVibeEmoji}>{vibe.emoji}</span>
                  <div className={styles.recapVibeText}>
                    <span className={styles.recapVibeMsg}>{vibe.msg}</span>
                    {vibe.sub && <span className={styles.recapVibeSub}>{vibe.sub}</span>}
                  </div>
                  <span className={styles.recapReste}>{solde.reste}j restants</span>
                </div>
              </div>
            )}
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
              <button type="button" className={styles.backBtn} onClick={() => editId ? setModalOpen(false) : setModalType("choose")}>← Retour</button>
              <button type="submit" className={styles.submitBtn} disabled={saving || !form.type}>{saving ? "Envoi..." : editId ? "Modifier" : "C'est parti ! 🚀"}</button>
            </div>
          </form>
        )}

        {/* PROJET */}
        {modalType === "projet" && (
          <form onSubmit={handleSubmitProjet} className={styles.form}>
            <label className={styles.field}>Nom du projet
              <input value={projForm.nom} onChange={(e) => setProjForm((f) => ({ ...f, nom: e.target.value }))} required placeholder="Ex: Tournage Clip X" />
            </label>
            <label className={styles.field}>Branche
              <select value={projForm.branche} onChange={(e) => setProjForm((f) => ({ ...f, branche: e.target.value }))}>
                <option value="">— Choisir —</option>
                <option value="Agency">Agency</option>
                <option value="CreativeGen">CreativeGen</option>
                <option value="Entertainment">Entertainment</option>
                <option value="SFX">SFX</option>
              </select>
            </label>
            <div className={styles.fieldRow}>
              <label className={styles.field}>Du <input type="date" value={projForm.dateDebut} onChange={(e) => setProjForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label>
              <label className={styles.field}>Au <input type="date" value={projForm.dateFin} onChange={(e) => setProjForm((f) => ({ ...f, dateFin: e.target.value }))} required /></label>
            </div>
            <label className={styles.field}>Description
              <textarea value={projForm.description} onChange={(e) => setProjForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Contexte, objectifs..." />
            </label>
            <div className={styles.formActions}>
              <button type="button" className={styles.backBtn} onClick={() => setModalType("choose")}>← Retour</button>
              <button type="submit" className={styles.submitBtn} disabled={saving || !projForm.nom}>{saving ? "Création..." : "Créer le projet 🎬"}</button>
            </div>
          </form>
        )}

        {/* NOTE */}
        {modalType === "note" && (
          <form onSubmit={handleSubmitNote} className={styles.form}>
            <label className={styles.field}>Date
              <input type="date" value={noteForm.dateDebut} onChange={(e) => setNoteForm((f) => ({ ...f, dateDebut: e.target.value }))} required />
            </label>
            <label className={styles.field}>Note
              <textarea value={noteForm.contenu} onChange={(e) => setNoteForm((f) => ({ ...f, contenu: e.target.value }))} rows={3} required placeholder="Rappel, idée, pensée du jour..." />
            </label>
            <div className={styles.formActions}>
              <button type="button" className={styles.backBtn} onClick={() => setModalType("choose")}>← Retour</button>
              <button type="submit" className={styles.submitBtn} disabled={saving || !noteForm.contenu}>{saving ? "Ajout..." : "Ajouter la note 📝"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
