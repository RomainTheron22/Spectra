"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
const HOUR_START_WEEK = 7;
const HOUR_END_WEEK = 21;
const HOUR_START_DAY = 0;
const HOUR_END_DAY = 24;
const DAY_SCROLL_TO = 8; // scroll auto vers 8h à l'ouverture

const BRANCH_COLORS = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "default": "#6b7280" };
function projectColor(b) { return BRANCH_COLORS[b] || BRANCH_COLORS.default; }
function normalizeProject(c) { return { id: String(c._id), title: c.nomContrat || c.nom || "Sans nom", branche: c.branche || "—", color: projectColor(c.branche), statut: c.statut || "—", dateDebut: c.dateDebut || null, dateFin: c.dateFin || null, assignees: c.assignees || c.equipe || [], clientNom: c.clientNom || "", lieu: c.lieu || "" }; }

const CONGE_VIBES = [
  { min: 30, emoji: "🌍", msg: "Le monde entier est à toi" }, { min: 25, emoji: "🌅", msg: "Un mois de soleil t'attend" },
  { min: 20, emoji: "🗾", msg: "Trois semaines au Japon" }, { min: 15, emoji: "🛤️", msg: "Road trip sans fin" },
  { min: 10, emoji: "🏖️", msg: "Deux semaines les pieds dans le sable" }, { min: 7, emoji: "🌅", msg: "Le monde a été créé en 7 jours" },
  { min: 4, emoji: "🛫", msg: "City-trip à Lisbonne" }, { min: 2, emoji: "🏔️", msg: "Week-end à la montagne" },
  { min: 1, emoji: "🧘‍♀️", msg: "24h rien que pour toi" }, { min: 0, emoji: "💫", msg: "Full energy !" },
];
function getVibe(j) { for (const v of CONGE_VIBES) { if (j >= v.min) return v; } return CONGE_VIBES[CONGE_VIBES.length - 1]; }

function toYMD(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function countWorkDays(s, e, half) { if (half) return 0.5; let c = 0; const d = new Date(s); const end = new Date(e); while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); } return c; }
function dayOfWeekFr(d) { return JOURS_FULL[(d.getDay() + 6) % 7]; }
function formatDateShort(d) { return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 3)}`; }

// Phrase dynamique liée au projet le plus proche
function getProjectQuote(projects) {
  const now = new Date(); const todayStr = toYMD(now);
  // Trouver le projet le plus proche (en cours ou à venir)
  const upcoming = projects
    .filter((p) => p.dateFin >= todayStr)
    .sort((a, b) => (a.dateDebut > b.dateDebut ? 1 : -1));

  if (!upcoming.length) return { msg: "Pas de projet en vue — profites-en pour préparer la suite", icon: "🧭" };

  const hot = upcoming[0];
  const daysUntil = Math.ceil((new Date(hot.dateDebut) - now) / 86400000);
  const daysLeft = Math.ceil((new Date(hot.dateFin) - now) / 86400000);
  const isActive = hot.dateDebut <= todayStr;

  if (isActive && daysLeft <= 3) return { msg: `${hot.title} — dernière ligne droite ! On envoie du lourd`, icon: "🔥", color: hot.color };
  if (isActive) return { msg: `${hot.title} en cours — on tient un truc incroyable`, icon: "🎬", color: hot.color };
  if (daysUntil <= 2) return { msg: `${hot.title} dans ${daysUntil}j — préparez-vous, ça va être énorme !`, icon: "⚡", color: hot.color };
  if (daysUntil <= 7) return { msg: `${hot.title} arrive cette semaine — la team est prête`, icon: "🚀", color: hot.color };
  return { msg: `Prochain projet : ${hot.title} — ${hot.branche}`, icon: "📌", color: hot.color };
}

// IA catégorisation — détecte si un event Google est une absence/TT/indispo
const ABSENCE_KEYWORDS = ["absence", "congé", "conge", "congés", "vacances", "off", "repos", "jour off", "indispo", "indisponible", "maladie", "malade", "arrêt", "arret"];
const TT_KEYWORDS = ["télétravail", "teletravail", "tt", "remote", "home office", "wfh", "travail maison"];

function classifyGcalEvent(title) {
  const t = (title || "").toLowerCase();
  if (TT_KEYWORDS.some((kw) => t.includes(kw))) return "tt";
  if (ABSENCE_KEYWORDS.some((kw) => t.includes(kw))) return "absence";
  return "rdv";
}

function Sparkles({ active }) {
  if (!active) return null;
  return <div className={styles.sparklesWrap} aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <span key={i} className={styles.sparkle} style={{ "--i": i }} />)}</div>;
}

/* ═══ COMPONENT ═══ */
export default function MonPlanning() {
  const [absences, setAbsences] = useState([]);
  const [profile, setProfile] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
  const [projForm, setProjForm] = useState({ nomContrat: "", clientNom: "", branche: "", dateDebut: "", dateFin: "", lieu: "", brief: "" });
  const [noteForm, setNoteForm] = useState({ contenu: "", dateDebut: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [vibeHover, setVibeHover] = useState(false);
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
  const dayGridRef = useRef(null);
  const weekGridRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
      try {
        const calRes = await fetch("/api/planning/google-calendar/calendars", { cache: "no-store" });
        const calData = await calRes.json();
        if (calData.connected) { setGcalConnected(true); setGcalCalendars(calData.calendars || []); setGcalSelectedIds(calData.selectedIds || []); }
        const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
        const from = new Date(y, m - 1, 1).toISOString(); const to = new Date(y, m + 2, 0).toISOString();
        const gcRes = await fetch(`/api/planning/google-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
        const gcData = await gcRes.json();
        if (gcData.items) setGcalEvents(gcData.items);
      } catch {}
      setTimeout(() => setLoaded(true), 80);
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
  const projectQuote = useMemo(() => getProjectQuote(projects), [projects]);

  const absRecap = useMemo(() => {
    const year = new Date().getFullYear();
    const thisYear = absences.filter((a) => a.statut === "valide" && a.dateDebut?.startsWith(String(year)));
    return {
      conge: thisYear.filter((a) => a.type === "conge").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
      tt: thisYear.filter((a) => a.type === "tt").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
      maladie: thisYear.filter((a) => a.type === "maladie").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0),
    };
  }, [absences]);

  // Build events map
  const calEvents = useMemo(() => {
    const map = {};
    const add = (dateStr, event) => { if (!map[dateStr]) map[dateStr] = []; map[dateStr].push(event); };
    if (showProjets) { for (const p of projects) { const d = new Date(p.dateDebut + "T12:00:00"); const end = new Date(p.dateFin + "T12:00:00"); while (d <= end) { add(toYMD(d), { type: "projet", ...p }); d.setDate(d.getDate() + 1); } } }
    if (showMissions) { for (const p of myMissions) { const d = new Date(p.dateDebut + "T12:00:00"); const end = new Date(p.dateFin + "T12:00:00"); while (d <= end) { const k = toYMD(d); const ex = map[k]?.find((e) => e.type === "projet" && e.id === p.id); if (ex) ex.isMine = true; else add(k, { type: "mission", ...p, isMine: true }); d.setDate(d.getDate() + 1); } } }
    if (showAbsences) { for (const a of absences) { const d = new Date(a.dateDebut + "T12:00:00"); const end = new Date(a.dateFin + "T12:00:00"); while (d <= end) { add(toYMD(d), { type: "absence", ...a, absType: ABSENCE_TYPES.find((t) => t.value === a.type) }); d.setDate(d.getDate() + 1); } } }
    if (showGcal) {
      for (const ev of gcalEvents) {
        if (!ev.start) continue;
        const isAllDay = !String(ev.start).includes("T");
        const startLocal = new Date(ev.start);
        const endLocal = ev.end ? new Date(ev.end) : startLocal;
        const startDate = isAllDay ? String(ev.start).slice(0, 10) : toYMD(startLocal);
        let endDate;
        if (isAllDay) { const ed = new Date(ev.end || ev.start); ed.setDate(ed.getDate() - 1); endDate = String(ev.end || ev.start).slice(0, 10) > startDate ? toYMD(ed) : startDate; }
        else { endDate = toYMD(endLocal); }
        const startHour = isAllDay ? null : startLocal.getHours() + startLocal.getMinutes() / 60;
        const endHour = isAllDay ? null : endLocal.getHours() + endLocal.getMinutes() / 60;
        const sourceCal = gcalCalendars.find((c) => c.id === ev.calendarId);
        const evColor = sourceCal?.backgroundColor || "#4285f4";
        const calName = sourceCal?.summary || "";
        const classification = classifyGcalEvent(ev.title);
        const forceAllDay = classification === "absence" || classification === "tt" || isAllDay;
        const d = new Date(startDate + "T12:00:00"); const end = new Date(endDate + "T12:00:00");
        while (d <= end) { add(toYMD(d), { type: "gcal", title: ev.title, color: evColor, gcalId: ev.gcalId, calendarName: calName, startHour: forceAllDay ? null : startHour, endHour: forceAllDay ? null : endHour, isAllDay: forceAllDay, classification }); d.setDate(d.getDate() + 1); }
      }
    }
    return map;
  }, [projects, myMissions, absences, gcalEvents, gcalCalendars, showProjets, showMissions, showAbsences, showGcal]);

  const calDays = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const first = new Date(y, m, 1); let start = (first.getDay() + 6) % 7;
    const sd = new Date(first); sd.setDate(sd.getDate() - start);
    const days = []; for (let i = 0; i < 42; i++) { const d = new Date(sd); d.setDate(d.getDate() + i); days.push(d); if (i >= 27 && d.getMonth() !== m) break; } return days;
  }, [calDate]);

  const weekDays = useMemo(() => {
    const d = new Date(calDate); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff); return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(dd.getDate() + i); return dd; });
  }, [calDate]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return { projs: [], missions: [], abs: [], gcalByBranch: {} };
    const key = toYMD(selectedDate); const all = calEvents[key] || [];
    const gcalByBranch = {};
    for (const e of all.filter((e) => e.type === "gcal")) { const branch = e.calendarName || "Agenda"; if (!gcalByBranch[branch]) gcalByBranch[branch] = { color: e.color, events: [] }; gcalByBranch[branch].events.push(e); }
    return { projs: all.filter((e) => e.type === "projet" && !e.isMine), missions: all.filter((e) => (e.type === "projet" && e.isMine) || e.type === "mission"), abs: all.filter((e) => e.type === "absence"), gcalByBranch };
  }, [selectedDate, calEvents]);

  // Scroll to 8h when switching views
  useEffect(() => {
    const ref = view === "day" ? dayGridRef : weekGridRef;
    if (ref.current) {
      const slotH = 48; // px per hour
      ref.current.scrollTop = DAY_SCROLL_TO * slotH;
    }
  }, [view, calDate]);

  // Drag to create event
  function handleGridMouseDown(date, hour) {
    setDragStart({ date: toYMD(date), hour });
    setDragEnd({ date: toYMD(date), hour: hour + 0.5 });
    setIsDragging(true);
  }
  function handleGridMouseMove(hour) {
    if (!isDragging) return;
    setDragEnd((prev) => prev ? { ...prev, hour: Math.max(hour + 0.25, (dragStart?.hour || 0) + 0.25) } : prev);
  }
  function handleGridMouseUp() {
    if (!isDragging || !dragStart || !dragEnd) { setIsDragging(false); return; }
    setIsDragging(false);
    const startH = Math.floor(dragStart.hour);
    const startM = Math.round((dragStart.hour % 1) * 60);
    const endH = Math.floor(dragEnd.hour);
    const endM = Math.round((dragEnd.hour % 1) * 60);
    const heureDebut = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    const heureFin = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    const dateStr = dragStart.date;
    // Pré-remplir tous les formulaires avec les heures
    setForm({ type: "", dateDebut: dateStr, dateFin: dateStr, demiJournee: "", commentaire: "" });
    setProjForm({ nomContrat: "", clientNom: "", branche: "", dateDebut: dateStr, dateFin: dateStr, lieu: "", brief: "" });
    setNoteForm({ contenu: "", dateDebut: dateStr, heureDebut, heureFin, lieu: "", participants: "", allDay: false });
    setEditId(null);
    setModalType("choose");
    setModalOpen(true);
    setDragStart(null); setDragEnd(null);
  }

  function handleDayClick(date) { setSelectedDate(date); }

  async function toggleGcalCalendar(calId) {
    const newIds = gcalSelectedIds.includes(calId) ? gcalSelectedIds.filter((id) => id !== calId) : [...gcalSelectedIds, calId];
    setGcalSelectedIds(newIds);
    const saveRes = await fetch("/api/planning/google-calendar/calendars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendarIds: newIds }) });
    if (!saveRes.ok) return;
    await refetchGcalEvents();
  }

  async function refetchGcalEvents() {
    try {
      const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
      const from = new Date(y, m - 1, 1).toISOString(); const to = new Date(y, m + 2, 0).toISOString();
      const gcRes = await fetch(`/api/planning/google-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const gcData = await gcRes.json(); if (gcData.items) setGcalEvents(gcData.items);
    } catch {}
  }

  function openChoose(dateStr) { setEditId(null); setModalType("choose"); setForm({ type: "", dateDebut: dateStr || "", dateFin: dateStr || "", demiJournee: "", commentaire: "" }); setProjForm({ nomContrat: "", clientNom: "", branche: "", dateDebut: dateStr || "", dateFin: dateStr || "", lieu: "", brief: "" }); setNoteForm({ contenu: "", dateDebut: dateStr || "" }); setModalOpen(true); }
  function openAbsenceForm(dateStr) { setEditId(null); setModalType("absence"); setForm({ type: "", dateDebut: dateStr || "", dateFin: dateStr || "", demiJournee: "", commentaire: "" }); setModalOpen(true); }
  function openProjForm(dateStr) { setModalType("projet"); setProjForm({ nomContrat: "", clientNom: "", branche: "", dateDebut: dateStr || "", dateFin: dateStr || "", lieu: "", brief: "" }); setModalOpen(true); }
  function openNoteForm(dateStr) { setModalType("note"); setNoteForm({ contenu: "", dateDebut: dateStr || toYMD(new Date()), heureDebut: "09:00", heureFin: "10:00", lieu: "", participants: "", allDay: false }); setModalOpen(true); }
  function openNew() { openChoose(""); }
  function openEdit(absence) { setEditId(String(absence._id)); setModalType("absence"); setForm({ type: absence.type || "", dateDebut: absence.dateDebut, dateFin: absence.dateFin, demiJournee: absence.demiJournee || "", commentaire: absence.commentaire || "" }); setModalOpen(true); }

  async function handleSubmit(e) {
    e.preventDefault(); if (!form.type) { alert("Choisis un type"); return; } if (form.dateDebut > form.dateFin) { alert("Date fin > début"); return; }
    setSaving(true); const body = { type: form.type, dateDebut: form.dateDebut, dateFin: form.dateFin, demiJournee: form.demiJournee || null, commentaire: form.commentaire };
    const url = editId ? `/api/employee-absences/${editId}` : "/api/employee-absences";
    const res = await fetch(url, { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSaving(false); if (!res.ok) { alert(data.error || "Erreur"); return; }
    if (editId) setAbsences((prev) => prev.map((a) => (String(a._id) === editId ? data.item : a)));
    else {
      setAbsences((prev) => [data.item, ...prev]);
            // Push vers Google Agenda — cherche l'agenda "Planning" ou "planning"
      const typeLabel = ABSENCE_TYPES.find((t) => t.value === form.type)?.label || form.type;
      const planningCal = gcalCalendars.find((c) => c.summary.toLowerCase().includes("planning"));
      const calId = planningCal ? planningCal.id : undefined;
      try { await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `${typeLabel}`, start: form.dateDebut, end: form.dateFin, allDay: true, description: form.commentaire || "", calendarId: calId }) }); await refetchGcalEvents(); } catch {}
    }
    setModalOpen(false);
  }
  async function handleSubmitProjet(e) {
    e.preventDefault();
    if (!projForm.nomContrat) { alert("Le nom du projet est obligatoire"); return; }
    if (!projForm.clientNom) { alert("Le nom du client est obligatoire"); return; }
    if (!projForm.branche) { alert("La branche est obligatoire"); return; }
    setSaving(true);
    const body = { nomContrat: projForm.nomContrat, clientNom: projForm.clientNom, branche: projForm.branche, dateDebut: projForm.dateDebut, dateFin: projForm.dateFin, lieu: projForm.lieu, brief: projForm.brief, statut: "En cours" };
    const res = await fetch("/api/contrats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSaving(false); if (!res.ok) { alert(data.error || "Erreur"); return; }
    const np = normalizeProject(data.item || data); if (np.dateDebut && np.dateFin) setProjects((prev) => [...prev, np]);
        const branchCal = projForm.branche ? gcalCalendars.find((c) => c.summary.toLowerCase().includes(projForm.branche.toLowerCase())) : null;
    const projCalId = branchCal ? branchCal.id : undefined;
    try { await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `🎬 ${projForm.nomContrat}`, start: projForm.dateDebut, end: projForm.dateFin, allDay: true, description: projForm.brief || "", calendarId: projCalId }) }); await refetchGcalEvents(); } catch {}
    setModalOpen(false);
  }
  async function handleSubmitNote(e) {
    e.preventDefault(); if (!noteForm.contenu) { alert("Titre obligatoire"); return; } setSaving(true);
    const body = {
      title: noteForm.contenu,
      allDay: noteForm.allDay,
      start: noteForm.allDay ? noteForm.dateDebut : `${noteForm.dateDebut}T${noteForm.heureDebut}:00`,
      end: noteForm.allDay ? noteForm.dateDebut : `${noteForm.dateDebut}T${noteForm.heureFin}:00`,
      description: "",
      location: noteForm.lieu || "",
      attendees: noteForm.participants ? noteForm.participants.split(",").map((e) => e.trim()).filter(Boolean) : [],
    };
    const res = await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSaving(false); if (!res.ok) { alert(data.error || "Erreur Google Agenda"); return; }
    if (data.item) setGcalEvents((prev) => [...prev, data.item]);
    setModalOpen(false);
  }
  async function handleDelete(id) { if (!confirm("Supprimer ?")) return; const res = await fetch(`/api/employee-absences/${id}`, { method: "DELETE" }); if (res.ok) setAbsences((prev) => prev.filter((a) => String(a._id) !== id)); }

  // Edit/delete Google Calendar events
  async function handleDeleteGcalEvent(gcalId) {
    if (!confirm("Supprimer cet événement de Google Agenda ?")) return;
    const res = await fetch(`/api/planning/google-calendar/${gcalId}`, { method: "DELETE" });
    if (res.ok) { setGcalEvents((prev) => prev.filter((e) => e.gcalId !== gcalId)); }
    else { alert("Erreur lors de la suppression"); }
  }

  function openEditGcalEvent(ev) {
    setNoteForm({
      contenu: ev.title || "",
      dateDebut: ev.startHour != null ? toYMD(new Date()) : "",
      heureDebut: ev.startHour != null ? `${String(Math.floor(ev.startHour)).padStart(2, "0")}:${String(Math.round((ev.startHour % 1) * 60)).padStart(2, "0")}` : "09:00",
      heureFin: ev.endHour != null ? `${String(Math.floor(ev.endHour)).padStart(2, "0")}:${String(Math.round((ev.endHour % 1) * 60)).padStart(2, "0")}` : "10:00",
      lieu: "", participants: "", allDay: ev.isAllDay || false,
      gcalEditId: ev.gcalId,
    });
    setModalType("editGcal");
    setModalOpen(true);
  }

  async function handleUpdateGcalEvent(e) {
    e.preventDefault(); if (!noteForm.contenu) { alert("Titre obligatoire"); return; } setSaving(true);
    const body = {
      title: noteForm.contenu,
      start: noteForm.allDay ? noteForm.dateDebut : `${noteForm.dateDebut}T${noteForm.heureDebut}:00`,
      end: noteForm.allDay ? noteForm.dateDebut : `${noteForm.dateDebut}T${noteForm.heureFin}:00`,
    };
    const res = await fetch(`/api/planning/google-calendar/${noteForm.gcalEditId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false); if (!res.ok) { alert("Erreur lors de la modification"); return; }
    await refetchGcalEvents();
    setModalOpen(false);
  }

  const today = toYMD(new Date());
  const month = calDate.getMonth();
  const pct = Math.max(3, (solde.reste / solde.credit) * 100);
  const hoursWeek = Array.from({ length: HOUR_END_WEEK - HOUR_START_WEEK }, (_, i) => HOUR_START_WEEK + i);
  const hoursDay = Array.from({ length: HOUR_END_DAY - HOUR_START_DAY }, (_, i) => HOUR_START_DAY + i);

  function navPrev() { setSelectedDate(null); setCalDate((d) => { const n = new Date(d); if (view === "month") n.setMonth(n.getMonth() - 1); else if (view === "week") n.setDate(n.getDate() - 7); else n.setDate(n.getDate() - 1); return n; }); }
  function navNext() { setSelectedDate(null); setCalDate((d) => { const n = new Date(d); if (view === "month") n.setMonth(n.getMonth() + 1); else if (view === "week") n.setDate(n.getDate() + 7); else n.setDate(n.getDate() + 1); return n; }); }
  function goToday() { setSelectedDate(null); setCalDate(new Date()); }

  function calLabel() {
    if (view === "month") return `${MOIS[calDate.getMonth()]} ${calDate.getFullYear()}`;
    if (view === "week") return `${formatDateShort(weekDays[0])} — ${formatDateShort(weekDays[6])} ${weekDays[6].getFullYear()}`;
    return `${dayOfWeekFr(calDate)} ${calDate.getDate()} ${MOIS[calDate.getMonth()]}`;
  }

  // Render cell events for MONTH view — compact, hierarchical
  function renderMonthCell(events) {
    const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
    const abs = events.filter((e) => e.type === "absence");
    const gcals = events.filter((e) => e.type === "gcal");
    return (
      <>
        {projs.slice(0, 3).map((p, j) => <div key={`p${j}`} className={styles.mEvtProj} style={{ "--ec": p.color }}>{p.isMine ? "👤 " : ""}{p.title.length > 14 ? p.title.slice(0, 14) + "…" : p.title}</div>)}
        {abs.slice(0, 1).map((a, j) => <div key={`a${j}`} className={styles.mEvtAbs} style={{ "--ec": a.absType?.color }}>{a.absType?.icon} {a.absType?.label}</div>)}
        {gcals.slice(0, 3).map((g, j) => <div key={`g${j}`} className={styles.mEvtRdv} style={{ "--ec": g.color }}><span className={styles.mDot} />{g.title.length > 14 ? g.title.slice(0, 14) + "…" : g.title}</div>)}
        {(projs.length + abs.length + gcals.length) > 7 && <div className={styles.mEvtMore}>+{projs.length + abs.length + gcals.length - 7}</div>}
      </>
    );
  }

  return (
    <div className={styles.page}>
      {/* ═══ PHRASE PROJET CHAUD ═══ */}
      <div className={`${styles.hotBar} ${loaded ? styles.hotBarLoaded : ""}`} onMouseEnter={() => setVibeHover(true)} onMouseLeave={() => setVibeHover(false)}>
        <Sparkles active={vibeHover} />
        <span className={styles.hotIcon}>{projectQuote.icon}</span>
        <span className={styles.hotMsg}>{projectQuote.msg}</span>
        {projectQuote.color && <span className={styles.hotDot} style={{ background: projectQuote.color }} />}
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className={styles.toolbar}>
        <div className={styles.toggles}>
          <button className={`${styles.tg} ${showProjets ? styles.tgOn : ""}`} style={{ "--tgc": "#e11d48" }} onClick={() => setShowProjets((v) => !v)}>
            <span className={styles.tgDot} /> Projets <span className={styles.tgN}>{projects.length}</span>
          </button>
          <button className={`${styles.tg} ${showMissions ? styles.tgOn : ""}`} style={{ "--tgc": "#7c3aed" }} onClick={() => setShowMissions((v) => !v)}>
            <span className={styles.tgDot} /> Missions <span className={styles.tgN}>{myMissions.length}</span>
          </button>
          <button className={`${styles.tg} ${showAbsences ? styles.tgOn : ""}`} style={{ "--tgc": "#10b981" }} onClick={() => setShowAbsences((v) => !v)}>
            <span className={styles.tgDot} /> Absences <span className={styles.tgN}>{absences.length}</span>
          </button>
          {gcalConnected && (
            <>
              <button className={`${styles.tg} ${showGcal ? styles.tgOn : ""}`} style={{ "--tgc": "#4285f4" }} onClick={() => setShowGcal((v) => !v)}>
                <span className={styles.tgDot} /> Agenda <span className={styles.tgN}>{gcalEvents.length}</span>
              </button>
              <button className={styles.gearBtn} onClick={() => setShowCalPicker((v) => !v)}>⚙</button>
            </>
          )}
        </div>
        <button className={styles.addBtn} onClick={openNew}>+ Ajouter</button>
      </div>

      {/* Calendar picker */}
      {showCalPicker && (
        <div className={styles.calPicker}>
          <div className={styles.cpHead}><span className={styles.cpTitle}>Agendas Google</span><button className={styles.cpClose} onClick={() => setShowCalPicker(false)}>✕</button></div>
          {gcalCalendars.map((cal) => {
            const isOn = gcalSelectedIds.includes(cal.id);
            return (<button key={cal.id} className={`${styles.cpItem} ${isOn ? styles.cpItemOn : ""}`} style={{ "--cpb": cal.backgroundColor || "#4285f4" }} onClick={() => toggleGcalCalendar(cal.id)}>
              <span className={styles.cpDot} /><span className={styles.cpName}>{cal.summary}</span>{isOn && <span className={styles.cpCheck}>✓</span>}
            </button>);
          })}
        </div>
      )}

      {/* ═══ CALENDAR NAV ═══ */}
      <div className={styles.calNav2}>
        <div className={styles.navGroup}>
          <button className={styles.navBtn} onClick={navPrev}>‹</button>
          <button className={styles.todayBtn} onClick={goToday}>Aujourd'hui</button>
          <button className={styles.navBtn} onClick={navNext}>›</button>
        </div>
        <h2 className={styles.calLabel}>{calLabel()}</h2>
        <div className={styles.viewSw}>
          {["day", "week", "month"].map((v) => (
            <button key={v} className={`${styles.vBtn} ${view === v ? styles.vBtnOn : ""}`} onClick={() => setView(v)}>
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ MAIN: MiniCal + Calendar + Panel ═══ */}
      <div className={styles.main}>
        {/* Mini calendar */}
        <div className={styles.miniCal}>
          <div className={styles.miniCalNav}>
            <button className={styles.miniCalBtn} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>‹</button>
            <span className={styles.miniCalTitle}>{MOIS[calDate.getMonth()].slice(0, 3)} {calDate.getFullYear()}</span>
            <button className={styles.miniCalBtn} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>›</button>
          </div>
          <div className={styles.miniCalGrid}>
            {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} className={styles.miniCalHead}>{d}</div>)}
            {(() => {
              const y = calDate.getFullYear(), m = calDate.getMonth();
              const first = new Date(y, m, 1); let start = (first.getDay() + 6) % 7;
              const sd = new Date(first); sd.setDate(sd.getDate() - start);
              const days = [];
              for (let i = 0; i < 42; i++) { const d = new Date(sd); d.setDate(d.getDate() + i); days.push(d); }
              return days.map((d, i) => {
                const key = toYMD(d); const isMonth = d.getMonth() === m; const isToday2 = key === today;
                const hasEvents = (calEvents[key] || []).length > 0;
                const isSelected = selectedDate && toYMD(selectedDate) === key;
                return <button key={i} className={[styles.miniCalDay, isToday2 && styles.miniCalToday, !isMonth && styles.miniCalOther, isSelected && styles.miniCalSelected, hasEvents && styles.miniCalHasEvents].filter(Boolean).join(" ")}
                  onClick={() => { setCalDate(d); if (view === "day") setCalDate(d); handleDayClick(d); }}>{d.getDate()}</button>;
              });
            })()}
          </div>
          {/* Calendriers Google */}
          {gcalConnected && gcalCalendars.length > 0 && (
            <div className={styles.miniCalendars}>
              <div className={styles.miniCalLabel}>Agendas</div>
              {gcalCalendars.filter((c) => gcalSelectedIds.includes(c.id)).slice(0, 6).map((cal) => (
                <div key={cal.id} className={styles.miniCalItem}>
                  <span className={styles.miniCalDot} style={{ background: cal.backgroundColor || "#4285f4" }} />
                  <span className={styles.miniCalName}>{cal.summary.length > 16 ? cal.summary.slice(0, 16) + "…" : cal.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.calWrap} ${loaded ? styles.calLoaded : ""}`}>

          {/* VUE MOIS */}
          {view === "month" && (
            <div className={styles.mGrid}>
              {JOURS_HEAD.map((j) => <div key={j} className={styles.mHead}>{j}</div>)}
              {calDays.map((d, i) => {
                const key = toYMD(d); const isMonth = d.getMonth() === month; const isToday2 = key === today;
                const events = calEvents[key] || []; const isSelected = selectedDate && toYMD(selectedDate) === key;
                return (
                  <div key={i} className={[styles.mDay, isToday2 && styles.mDayToday, !isMonth && styles.mDayOther, isSelected && styles.mDaySelected].filter(Boolean).join(" ")}
                    onClick={() => isMonth && handleDayClick(d)} role={isMonth ? "button" : undefined} tabIndex={isMonth ? 0 : undefined}
                    onKeyDown={(e) => { if (isMonth && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleDayClick(d); } }}>
                    <span className={styles.mNum}>{d.getDate()}</span>
                    <div className={styles.mEvents}>{renderMonthCell(events)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VUE SEMAINE — TIME GRID */}
          {view === "week" && (
            <div className={styles.tgWrap}>
              <div className={styles.tgAllDay}>
                <div className={styles.tgTimeLabel} />
                {weekDays.map((d, i) => {
                  const key = toYMD(d); const events = calEvents[key] || [];
                  const allDay = events.filter((e) => (e.type === "gcal" && e.isAllDay) || e.type === "projet" || e.type === "mission" || e.type === "absence");
                  return (<div key={i} className={styles.tgAllDayCell}>
                    {allDay.slice(0, 4).map((ev, j) => {
                      const c = ev.type === "absence" ? (ev.absType?.color || "#888") : ev.color || "#4285f4";
                      const label = ev.type === "projet" || ev.type === "mission" ? `${ev.isMine ? "👤 " : ""}${ev.title}` : ev.type === "absence" ? `${ev.absType?.icon} ${ev.absType?.label}` : ev.title;
                      return <div key={j} className={styles.tgADEvt} style={{ "--adc": c }}>{label.length > 16 ? label.slice(0, 16) + "…" : label}</div>;
                    })}
                    {allDay.length > 4 && <div className={styles.tgADMore}>+{allDay.length - 4}</div>}
                  </div>);
                })}
              </div>
              <div className={styles.tgHead}>
                <div className={styles.tgTimeLabel} />
                {weekDays.map((d, i) => {
                  const key = toYMD(d); const isToday2 = key === today; const isSel = selectedDate && toYMD(selectedDate) === key;
                  return (<div key={i} className={`${styles.tgHCell} ${isToday2 ? styles.tgHToday : ""} ${isSel ? styles.tgHSel : ""}`} onClick={() => handleDayClick(d)} role="button" tabIndex={0}>
                    <span className={styles.tgHDay}>{JOURS_HEAD[i]}</span>
                    <span className={`${styles.tgHNum} ${isToday2 ? styles.tgHNumToday : ""}`}>{d.getDate()}</span>
                  </div>);
                })}
              </div>
              <div className={styles.tgBody} ref={weekGridRef}>
                <div className={styles.tgTimes}>{hoursWeek.map((h) => <div key={h} className={styles.tgTLine}><span className={styles.tgTText}>{String(h).padStart(2, "0")}:00</span></div>)}</div>
                <div className={styles.tgCols}>
                  {weekDays.map((d, i) => {
                    const key = toYMD(d); const isToday2 = key === today;
                    const timed = (calEvents[key] || []).filter((e) => e.type === "gcal" && !e.isAllDay && e.startHour != null)
                      .sort((a, b) => a.startHour - b.startHour);
                    // Layout: detect overlaps and assign columns
                    const laid = timed.map((ev) => ({ ...ev, col: 0, totalCols: 1 }));
                    for (let a = 0; a < laid.length; a++) {
                      for (let b = a + 1; b < laid.length; b++) {
                        if (laid[b].startHour < laid[a].endHour) {
                          if (laid[b].col === laid[a].col) laid[b].col = laid[a].col + 1;
                          laid[a].totalCols = Math.max(laid[a].totalCols, laid[b].col + 1);
                          laid[b].totalCols = Math.max(laid[b].totalCols, laid[b].col + 1);
                        }
                      }
                    }
                    // Propagate max totalCols for overlapping groups
                    for (let a = 0; a < laid.length; a++) {
                      for (let b = a + 1; b < laid.length; b++) {
                        if (laid[b].startHour < laid[a].endHour) {
                          const maxC = Math.max(laid[a].totalCols, laid[b].totalCols);
                          laid[a].totalCols = maxC; laid[b].totalCols = maxC;
                        }
                      }
                    }
                    return (<div key={i} className={`${styles.tgCol} ${isToday2 ? styles.tgColToday : ""}`} onClick={() => handleDayClick(d)}>
                      {hoursWeek.map((h) => <div key={h} className={styles.tgSlot} />)}
                      {laid.map((ev, j) => {
                        const top = ((ev.startHour - HOUR_START_WEEK) / (HOUR_END_WEEK - HOUR_START_WEEK)) * 100;
                        const height = Math.max(2.5, ((ev.endHour - ev.startHour) / (HOUR_END_WEEK - HOUR_START_WEEK)) * 100);
                        const width = 100 / ev.totalCols;
                        const left = ev.col * width;
                        return (<div key={j} className={styles.tgEvt} style={{ top: `${top}%`, height: `${height}%`, left: `${left}%`, width: `${width}%`, "--evc": ev.color }}>
                          <span className={styles.tgEvtTitle}>{ev.title}</span>
                          <span className={styles.tgEvtTime}>{String(Math.floor(ev.startHour)).padStart(2, "0")}:{String(Math.round((ev.startHour % 1) * 60)).padStart(2, "0")}</span>
                        </div>);
                      })}
                    </div>);
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VUE JOUR — TIME GRID */}
          {view === "day" && (() => {
            const key = toYMD(calDate); const events = calEvents[key] || [];
            const allDay = events.filter((e) => e.type !== "gcal" || e.isAllDay);
            const timed = events.filter((e) => e.type === "gcal" && !e.isAllDay && e.startHour != null);
            return (
              <div className={styles.tgWrap}>
                {allDay.length > 0 && (
                  <div className={styles.dayAllDay}>
                    {allDay.map((ev, j) => {
                      const c = ev.type === "absence" ? (ev.absType?.color || "#888") : ev.color || "#4285f4";
                      const label = ev.type === "projet" || ev.type === "mission" ? `${ev.isMine ? "👤 " : "🎬 "}${ev.title} · ${ev.branche}` : ev.type === "absence" ? `${ev.absType?.icon} ${ev.absType?.label}` : ev.title;
                      return <div key={j} className={styles.dayADEvt} style={{ "--adc": c }}>{label}</div>;
                    })}
                  </div>
                )}
                <div className={styles.dayGrid} ref={dayGridRef} onMouseUp={handleGridMouseUp} onMouseLeave={() => { if (isDragging) handleGridMouseUp(); }}>
                  <div className={styles.tgTimes}>{hoursDay.map((h) => <div key={h} className={styles.tgTLine}><span className={styles.tgTText}>{String(h).padStart(2, "0")}:00</span></div>)}</div>
                  <div className={styles.dayCol}>
                    {hoursDay.map((h) => (
                      <div key={h} className={styles.tgSlot}
                        onMouseDown={(e) => { e.preventDefault(); handleGridMouseDown(calDate, h); }}
                        onMouseMove={() => handleGridMouseMove(h + 0.5)}>
                        <div className={styles.tgSlotHalf}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleGridMouseDown(calDate, h + 0.5); }}
                          onMouseMove={(e) => { e.stopPropagation(); handleGridMouseMove(h + 1); }} />
                      </div>
                    ))}
                    {(() => {
                      // Layout algorithm — same as week view
                      const sorted = [...timed].sort((a, b) => a.startHour - b.startHour);
                      const laid = sorted.map((ev) => ({ ...ev, col: 0, totalCols: 1 }));
                      for (let a = 0; a < laid.length; a++) {
                        for (let b = a + 1; b < laid.length; b++) {
                          if (laid[b].startHour < laid[a].endHour) {
                            if (laid[b].col === laid[a].col) laid[b].col = laid[a].col + 1;
                            laid[a].totalCols = Math.max(laid[a].totalCols, laid[b].col + 1);
                            laid[b].totalCols = Math.max(laid[b].totalCols, laid[b].col + 1);
                          }
                        }
                      }
                      for (let a = 0; a < laid.length; a++) {
                        for (let b = a + 1; b < laid.length; b++) {
                          if (laid[b].startHour < laid[a].endHour) { const mx = Math.max(laid[a].totalCols, laid[b].totalCols); laid[a].totalCols = mx; laid[b].totalCols = mx; }
                        }
                      }
                      // Drag preview
                      const dragPreview = isDragging && dragStart && dragEnd && dragStart.date === toYMD(calDate);
                      return (<>{dragPreview && (() => {
                        const dTop = ((dragStart.hour - HOUR_START_DAY) / (HOUR_END_DAY - HOUR_START_DAY)) * 100;
                        const dH = Math.max(1, ((dragEnd.hour - dragStart.hour) / (HOUR_END_DAY - HOUR_START_DAY)) * 100);
                        return <div className={styles.dragPreview} style={{ top: `${dTop}%`, height: `${dH}%` }} />;
                      })()}{laid.map((ev, j) => {
                        const top = ((ev.startHour - HOUR_START_DAY) / (HOUR_END_DAY - HOUR_START_DAY)) * 100;
                        const height = Math.max(2, ((ev.endHour - ev.startHour) / (HOUR_END_DAY - HOUR_START_DAY)) * 100);
                        const width = 100 / ev.totalCols;
                        const left = ev.col * width;
                        return (<div key={j} className={styles.tgEvtDay} style={{ top: `${top}%`, height: `${height}%`, left: `${left}%`, width: `${width}%`, "--evc": ev.color }}>
                          <span className={styles.tgEvtTitle}>{ev.title}</span>
                          <span className={styles.tgEvtTime}>{String(Math.floor(ev.startHour)).padStart(2, "0")}:{String(Math.round((ev.startHour % 1) * 60)).padStart(2, "0")} — {String(Math.floor(ev.endHour)).padStart(2, "0")}:{String(Math.round((ev.endHour % 1) * 60)).padStart(2, "0")}</span>
                          {ev.calendarName && <span className={styles.tgEvtCal}>{ev.calendarName}</span>}
                        </div>);
                      })}</>);
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ═══ PANEL ═══ */}
        {selectedDate && (() => {
          const dateStr = toYMD(selectedDate); const isFuture = dateStr >= today;
          return (
            <aside className={styles.panel}>
              <div className={styles.pHead}><div><div className={styles.pDay}>{dayOfWeekFr(selectedDate)}</div><div className={styles.pDate}>{selectedDate.getDate()} {MOIS[selectedDate.getMonth()]}</div></div><button className={styles.pClose} onClick={() => setSelectedDate(null)}>✕</button></div>
              {selectedEvents.projs.length > 0 && (<div className={styles.pSec}><h3 className={styles.pSecTitle}>🎬 Projets</h3>{selectedEvents.projs.map((p, j) => <div key={j} className={styles.pEvt} style={{ "--pc": p.color }}><div className={styles.pEvtTitle}>{p.title}</div><div className={styles.pEvtMeta}>{p.branche} · {p.statut}</div></div>)}</div>)}
              {selectedEvents.missions.length > 0 && (<div className={styles.pSec}><h3 className={styles.pSecTitle}>👤 Mes missions</h3>{selectedEvents.missions.map((p, j) => <div key={j} className={styles.pEvt} style={{ "--pc": p.color }}><div className={styles.pEvtTitle}>{p.title}</div><div className={styles.pEvtMeta}>{p.branche} · {p.statut}</div></div>)}</div>)}
              {selectedEvents.abs.length > 0 && (<div className={styles.pSec}><h3 className={styles.pSecTitle}>🌴 Absences</h3>{selectedEvents.abs.map((a, j) => { const s = STATUT_LABELS[a.statut] || { label: a.statut, cls: "" }; const canMod = a.statut === "en_attente" && a.dateDebut >= today; return (<div key={j} className={styles.pEvt} style={{ "--pc": a.absType?.color || "#888" }}><div className={styles.pEvtTitle}>{a.absType?.icon} {a.absType?.label}</div><span className={`${styles.pStatut} ${styles[s.cls]}`}>{s.label}</span>{canMod && <div className={styles.pActions}><button className={styles.pEditBtn} onClick={() => openEdit(a)}>Modifier</button><button className={styles.pDelBtn} onClick={() => handleDelete(String(a._id))}>Supprimer</button></div>}</div>); })}</div>)}
              {Object.keys(selectedEvents.gcalByBranch).length > 0 && (<div className={styles.pSec}><h3 className={styles.pSecTitle}>📅 Agenda</h3>{Object.entries(selectedEvents.gcalByBranch).map(([branch, data]) => (<div key={branch} className={styles.pBranch}><div className={styles.pBranchHead}><span className={styles.pBranchDot} style={{ background: data.color }} /><span className={styles.pBranchName}>{branch}</span><span className={styles.pBranchN}>{data.events.length}</span></div>{data.events.map((g, j) => <div key={j} className={styles.pRdv}><span className={styles.pRdvTitle}>{g.title}</span>{g.gcalId && <div className={styles.pRdvBtns}><button className={styles.pMiniBtn} onClick={() => { const d = toYMD(selectedDate); setNoteForm({ contenu: g.title, dateDebut: d, heureDebut: g.startHour != null ? `${String(Math.floor(g.startHour)).padStart(2,"0")}:${String(Math.round((g.startHour%1)*60)).padStart(2,"0")}` : "09:00", heureFin: g.endHour != null ? `${String(Math.floor(g.endHour)).padStart(2,"0")}:${String(Math.round((g.endHour%1)*60)).padStart(2,"0")}` : "10:00", lieu: "", participants: "", allDay: g.isAllDay || false, gcalEditId: g.gcalId }); setModalType("editGcal"); setModalOpen(true); }}>✏️</button><button className={styles.pMiniBtn} onClick={() => handleDeleteGcalEvent(g.gcalId)}>🗑</button></div>}</div>)}</div>))}</div>)}
              {selectedEvents.projs.length === 0 && selectedEvents.missions.length === 0 && selectedEvents.abs.length === 0 && Object.keys(selectedEvents.gcalByBranch).length === 0 && <div className={styles.pEmpty}>Rien de prévu</div>}
              {isFuture && (<div className={styles.pAddSec}><h3 className={styles.pSecTitle}>Ajouter</h3><button className={styles.pAddBtn} style={{ "--pab": "#10b981" }} onClick={() => openAbsenceForm(dateStr)}>🌴 Absence</button><button className={styles.pAddBtn} style={{ "--pab": "#7c3aed" }} onClick={() => openProjForm(dateStr)}>🎬 Projet</button><button className={styles.pAddBtn} style={{ "--pab": "#f59e0b" }} onClick={() => openNoteForm(dateStr)}>📅 Événement</button></div>)}
            </aside>
          );
        })()}
      </div>

      {/* ═══ MES ABSENCES ═══ */}
      {absences.length > 0 && (
        <section className={styles.absSec}>
          <h2 className={styles.secTitle}>Mes absences</h2>
          <div className={styles.absList}>
            {absences.map((a) => {
              const t = ABSENCE_TYPES.find((t) => t.value === a.type); const s = STATUT_LABELS[a.statut] || { label: a.statut, cls: "" };
              const canEdit = a.statut === "en_attente" && a.dateDebut >= today; const jours = countWorkDays(a.dateDebut, a.dateFin, a.demiJournee);
              return (<div key={String(a._id)} className={styles.absCard} style={{ "--ac": t?.color || "#888" }}>
                <span className={styles.absIcon}>{t?.icon || "📋"}</span>
                <div className={styles.absBody}><div className={styles.absTop}><span className={styles.absType}>{t?.label}</span><span className={`${styles.absStatut} ${styles[s.cls]}`}>{s.label}</span><span className={styles.absDates}>{a.dateDebut === a.dateFin ? a.dateDebut : `${a.dateDebut} → ${a.dateFin}`}</span><span className={styles.absJours}>{jours}j</span></div>{a.commentaire && <p className={styles.absComment}>{a.commentaire}</p>}{a.motifRefus && <p className={styles.absRefus}>Motif : {a.motifRefus}</p>}</div>
                {canEdit && <div className={styles.absActions}><button className={styles.editBtn} onClick={() => openEdit(a)}>Modifier</button><button className={styles.deleteBtn} onClick={() => handleDelete(String(a._id))}>Supprimer</button></div>}
              </div>);
            })}
          </div>
        </section>
      )}

      {/* ═══ MODALE ═══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalType === "choose" ? "Ajouter" : modalType === "absence" ? (editId ? "Modifier" : "Absence") : modalType === "projet" ? "Projet" : modalType === "editGcal" ? "Modifier l'événement" : "Événement"} size="sm">
        {modalType === "choose" && (<div className={styles.chooseGrid}><button className={styles.chooseCard} style={{ "--cc": "#10b981" }} onClick={() => setModalType("absence")}><span className={styles.chooseIcon}>🌴</span><span className={styles.chooseLabel}>Absence</span></button><button className={styles.chooseCard} style={{ "--cc": "#7c3aed" }} onClick={() => setModalType("projet")}><span className={styles.chooseIcon}>🎬</span><span className={styles.chooseLabel}>Projet</span></button><button className={styles.chooseCard} style={{ "--cc": "#f59e0b" }} onClick={() => setModalType("note")}><span className={styles.chooseIcon}>📅</span><span className={styles.chooseLabel}>Événement</span></button></div>)}
        {modalType === "absence" && (<form onSubmit={handleSubmit} className={styles.form}>
          {!editId && (<div className={styles.recapBar}><div className={styles.recapItem} style={{ "--rc": "#10b981" }}><span>🌴</span><strong>{absRecap.conge}j</strong> congés</div><div className={styles.recapItem} style={{ "--rc": "#8b5cf6" }}><span>🏡</span><strong>{absRecap.tt}j</strong> TT</div><div className={styles.recapItem} style={{ "--rc": "#f43f5e" }}><span>🤧</span><strong>{absRecap.maladie}j</strong> maladie</div><div className={styles.recapVibe}>{vibe.emoji} {vibe.msg} — <strong>{solde.reste}j restants</strong></div></div>)}
          <div className={styles.typeGrid}>{ABSENCE_TYPES.map((t) => (<button key={t.value} type="button" className={`${styles.typeCard} ${form.type === t.value ? styles.typeCardOn : ""}`} style={{ "--tc": t.color, "--tcbg": t.gradient }} onClick={() => setForm((f) => ({ ...f, type: t.value }))}><span className={styles.tcIcon}>{t.icon}</span><span className={styles.tcLabel}>{t.label}</span></button>))}</div>
          <div className={styles.fieldRow}><label className={styles.field}>Du<input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label><label className={styles.field}>Au<input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} required /></label></div>
          <label className={styles.field}>Demi-journée ?<select value={form.demiJournee} onChange={(e) => setForm((f) => ({ ...f, demiJournee: e.target.value }))}><option value="">Complète</option><option value="matin">Matin</option><option value="apres-midi">Après-midi</option></select></label>
          <label className={styles.field}>Un mot ?<textarea value={form.commentaire} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))} rows={2} placeholder="Voyage, recharge..." /></label>
          <div className={styles.formActions}><button type="button" className={styles.backBtn} onClick={() => editId ? setModalOpen(false) : setModalType("choose")}>← Retour</button><button type="submit" className={styles.submitBtn} disabled={saving || !form.type}>{saving ? "..." : "C'est parti 🚀"}</button></div>
        </form>)}
        {modalType === "projet" && (<form onSubmit={handleSubmitProjet} className={styles.form}>
          <label className={styles.field}>Nom du projet *<input value={projForm.nomContrat} onChange={(e) => setProjForm((f) => ({ ...f, nomContrat: e.target.value }))} required placeholder="Tournage Clip X, Scéno Festival..." /></label>
          <label className={styles.field}>Client *<input value={projForm.clientNom} onChange={(e) => setProjForm((f) => ({ ...f, clientNom: e.target.value }))} required placeholder="Nom du client" /></label>
          <label className={styles.field}>Branche *<select value={projForm.branche} onChange={(e) => setProjForm((f) => ({ ...f, branche: e.target.value }))} required><option value="">— Choisir —</option><option>Agency</option><option>CreativeGen</option><option>Entertainment</option><option>SFX</option></select></label>
          <div className={styles.fieldRow}><label className={styles.field}>Du *<input type="date" value={projForm.dateDebut} onChange={(e) => setProjForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label><label className={styles.field}>Au *<input type="date" value={projForm.dateFin} onChange={(e) => setProjForm((f) => ({ ...f, dateFin: e.target.value }))} required /></label></div>
          <label className={styles.field}>Lieu <span className={styles.fieldOpt}>(optionnel)</span><input value={projForm.lieu} onChange={(e) => setProjForm((f) => ({ ...f, lieu: e.target.value }))} placeholder="Studio, extérieur, adresse..." /></label>
          <label className={styles.field}>Brief / Description<textarea value={projForm.brief} onChange={(e) => setProjForm((f) => ({ ...f, brief: e.target.value }))} rows={2} placeholder="Contexte, objectifs, équipe..." /></label>
          <div className={styles.formActions}><button type="button" className={styles.backBtn} onClick={() => setModalType("choose")}>← Retour</button><button type="submit" className={styles.submitBtn} disabled={saving || !projForm.nomContrat || !projForm.clientNom || !projForm.branche}>{saving ? "..." : "Créer le projet 🎬"}</button></div>
        </form>)}
        {modalType === "note" && (<form onSubmit={handleSubmitNote} className={styles.form}>
          <label className={styles.field}>Titre<input value={noteForm.contenu} onChange={(e) => setNoteForm((f) => ({ ...f, contenu: e.target.value }))} required placeholder="Réunion, RDV, rappel..." /></label>
          <label className={styles.field}>Date<input type="date" value={noteForm.dateDebut} onChange={(e) => setNoteForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label>
          <label className={styles.fieldCheck}><input type="checkbox" checked={noteForm.allDay} onChange={(e) => setNoteForm((f) => ({ ...f, allDay: e.target.checked }))} /> Toute la journée</label>
          {!noteForm.allDay && (
            <div className={styles.fieldRow}>
              <label className={styles.field}>De<input type="time" value={noteForm.heureDebut} onChange={(e) => setNoteForm((f) => ({ ...f, heureDebut: e.target.value }))} required /></label>
              <label className={styles.field}>À<input type="time" value={noteForm.heureFin} onChange={(e) => setNoteForm((f) => ({ ...f, heureFin: e.target.value }))} required /></label>
            </div>
          )}
          <label className={styles.field}>Lieu <span className={styles.fieldOpt}>(optionnel)</span><input value={noteForm.lieu} onChange={(e) => setNoteForm((f) => ({ ...f, lieu: e.target.value }))} placeholder="Bureau, visio, adresse..." /></label>
          <label className={styles.field}>Participants <span className={styles.fieldOpt}>(emails séparés par des virgules)</span><input value={noteForm.participants} onChange={(e) => setNoteForm((f) => ({ ...f, participants: e.target.value }))} placeholder="nom@email.com, autre@email.com" /></label>
          <div className={styles.formActions}><button type="button" className={styles.backBtn} onClick={() => setModalType("choose")}>← Retour</button><button type="submit" className={styles.submitBtn} disabled={saving || !noteForm.contenu}>{saving ? "..." : "Créer l'événement 📅"}</button></div>
        </form>)}
        {modalType === "editGcal" && (<form onSubmit={handleUpdateGcalEvent} className={styles.form}>
          <label className={styles.field}>Titre<input value={noteForm.contenu} onChange={(e) => setNoteForm((f) => ({ ...f, contenu: e.target.value }))} required /></label>
          <label className={styles.field}>Date<input type="date" value={noteForm.dateDebut} onChange={(e) => setNoteForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label>
          <label className={styles.fieldCheck}><input type="checkbox" checked={noteForm.allDay} onChange={(e) => setNoteForm((f) => ({ ...f, allDay: e.target.checked }))} /> Toute la journée</label>
          {!noteForm.allDay && (<div className={styles.fieldRow}>
            <label className={styles.field}>De<input type="time" value={noteForm.heureDebut} onChange={(e) => setNoteForm((f) => ({ ...f, heureDebut: e.target.value }))} required /></label>
            <label className={styles.field}>À<input type="time" value={noteForm.heureFin} onChange={(e) => setNoteForm((f) => ({ ...f, heureFin: e.target.value }))} required /></label>
          </div>)}
          <div className={styles.formActions}>
            <button type="button" className={styles.backBtn} onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="button" className={styles.deleteGcalBtn} onClick={() => { handleDeleteGcalEvent(noteForm.gcalEditId); setModalOpen(false); }}>Supprimer</button>
            <button type="submit" className={styles.submitBtn} disabled={saving || !noteForm.contenu}>{saving ? "..." : "Enregistrer"}</button>
          </div>
        </form>)}
      </Modal>
    </div>
  );
}
