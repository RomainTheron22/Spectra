"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Modal from "../../components/ui/Modal";
import EventForm from "./components/EventForm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Plus, X, Settings2, ZoomIn, ZoomOut, Pencil, Trash2, Calendar, ExternalLink, PanelRightOpen, PanelRightClose } from "lucide-react";

/* ═══ CONSTANTS ═══ */
const ABSENCE_TYPES = [
  { value: "conge", label: "Congé", color: "#10b981", icon: "🌴", desc: "Vacances, repos, journée perso", gradient: "linear-gradient(135deg, #d1fae5, #a7f3d0)" },
  { value: "tt", label: "Télétravail", color: "#8b5cf6", icon: "🏡", desc: "Je bosse de chez moi", gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)" },
  { value: "maladie", label: "Maladie", color: "#f43f5e", icon: "🤧", desc: "Arrêt maladie", gradient: "linear-gradient(135deg, #ffe4e6, #fecdd3)" },
  { value: "absence_autre", label: "Autre", color: "#f59e0b", icon: "✨", desc: "RDV, formation, perso...", gradient: "linear-gradient(135deg, #fef3c7, #fde68a)" },
];
const STATUT_LABELS = { en_attente: { label: "En attente", variant: "outline", color: "#b45309", bg: "rgba(245,158,11,0.08)" }, valide: { label: "Validé", variant: "default", color: "#065f46", bg: "rgba(16,185,129,0.08)" }, refuse: { label: "Refusé", variant: "destructive", color: "#9f1239", bg: "rgba(244,63,94,0.08)" } };
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_HEAD = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const JOURS_FULL = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DEFAULT_CONGES = 30;
const HOUR_START_WEEK = 1;
const HOUR_END_WEEK = 24;
const HOUR_START_DAY = 0;
const HOUR_END_DAY = 24;
const DAY_SCROLL_TO = 8; // scroll auto vers 8h à l'ouverture

const BRANCH_COLORS_FALLBACK = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "Atelier": "#059669", "Communication": "#0284c7", "default": "#6b7280" };
function projectColor(b, branchesDb) {
  if (branchesDb?.length) { const found = branchesDb.find((br) => br.key === b); if (found) return found.color; }
  return BRANCH_COLORS_FALLBACK[b] || BRANCH_COLORS_FALLBACK.default;
}
function normalizeProject(c, bDb) { return { id: String(c._id), title: c.nomContrat || c.nom || "Sans nom", branche: c.branche || "—", color: projectColor(c.branche, bDb), statut: c.statut || "—", dateDebut: c.dateDebut || null, dateFin: c.dateFin || null, assignees: c.assignees || c.equipe || [], clientNom: c.clientNom || "", lieu: c.lieu || "" }; }

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

  // Projets en cours
  const active = upcoming.filter((p) => p.dateDebut <= todayStr);
  if (active.length >= 3) return { msg: `${active.length} projets en parallèle — ${active.slice(0, 3).map((p) => p.title).join(", ")}`, icon: "🔥", color: active[0].color };

  const hot = upcoming[0];
  const daysUntil = Math.ceil((new Date(hot.dateDebut) - now) / 86400000);
  const daysLeft = Math.ceil((new Date(hot.dateFin) - now) / 86400000);
  const isActive = hot.dateDebut <= todayStr;

  if (isActive && daysLeft <= 3) return { msg: `${hot.title} — dernière ligne droite !${active.length > 1 ? ` + ${active.length - 1} autre${active.length > 2 ? "s" : ""} en cours` : ""}`, icon: "🔥", color: hot.color };
  if (isActive) return { msg: `${hot.title} en cours${active.length > 1 ? ` + ${active.length - 1} autre${active.length > 2 ? "s" : ""}` : ""} — on tient un truc`, icon: "🎬", color: hot.color };
  if (daysUntil <= 2) return { msg: `${hot.title} dans ${daysUntil}j — préparez-vous !`, icon: "⚡", color: hot.color };
  if (daysUntil <= 7) return { msg: `${hot.title} arrive cette semaine — la team est prête`, icon: "🚀", color: hot.color };
  return { msg: `Prochain : ${hot.title} — ${hot.branche}`, icon: "📌", color: hot.color };
}

// IA catégorisation — détecte le type d'event + tag
const ABSENCE_KEYWORDS = ["absence", "congé", "conge", "congés", "vacances", "off", "repos", "jour off", "indispo", "indisponible", "maladie", "malade", "arrêt", "arret"];
const TT_KEYWORDS = ["télétravail", "teletravail", "tt", "remote", "home office", "wfh", "travail maison"];
const REUNION_KEYWORDS = ["réunion", "reunion", "meeting", "point", "standup", "stand-up", "sync", "debrief", "brief"];
const VISIO_KEYWORDS = ["visio", "zoom", "meet", "google meet", "teams", "discord", "call"];
const TOURNAGE_KEYWORDS = ["tournage", "shoot", "prod", "production", "montage", "clip"];

const EVENT_TAGS = {
  reunion: { label: "Réunion", shape: "square", color: "#7c3aed" },
  visio: { label: "Visio", shape: "diamond", color: "#0891b2" },
  tournage: { label: "Tournage", shape: "triangle", color: "#e11d48" },
  rdv: { label: "RDV", shape: "circle", color: "#6b7280" },
  tt: { label: "TT", shape: "dash", color: "#8b5cf6" },
  absence: { label: "Absent", shape: "dash", color: "#10b981" },
  maladie: { label: "Maladie", shape: "dash", color: "#f43f5e" },
};

function classifyGcalEvent(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("maladie") || t.includes("malade")) return "maladie";
  if (TT_KEYWORDS.some((kw) => t.includes(kw))) return "tt";
  if (ABSENCE_KEYWORDS.some((kw) => t.includes(kw))) return "absence";
  if (TOURNAGE_KEYWORDS.some((kw) => t.includes(kw))) return "tournage";
  if (VISIO_KEYWORDS.some((kw) => t.includes(kw))) return "visio";
  if (REUNION_KEYWORDS.some((kw) => t.includes(kw))) return "reunion";
  return "rdv";
}

function Sparkles({ active }) {
  if (!active) return null;
  const positions = [
    { top: "20%", left: "15%", sx: "10px", sy: "-18px", ex: "20px", ey: "-36px", delay: "0s" },
    { top: "50%", left: "30%", sx: "-14px", sy: "-10px", ex: "-24px", ey: "-20px", delay: "0.2s" },
    { top: "30%", left: "55%", sx: "8px", sy: "-20px", ex: "16px", ey: "-40px", delay: "0.4s" },
    { top: "60%", left: "70%", sx: "-10px", sy: "-14px", ex: "-18px", ey: "-30px", delay: "0.6s" },
    { top: "40%", left: "85%", sx: "14px", sy: "-8px", ex: "28px", ey: "-18px", delay: "0.8s" },
    { top: "50%", left: "45%", sx: "-8px", sy: "-20px", ex: "-14px", ey: "-36px", delay: "1s" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]" aria-hidden="true">
      {positions.map((p, i) => (
        <span
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-yellow-300/80"
          style={{
            top: p.top, left: p.left,
            boxShadow: "0 0 6px 1px rgba(250,204,21,0.6)",
            animation: "sparkle-float 1.2s ease-out infinite",
            animationDelay: p.delay,
            "--sx": p.sx, "--sy": p.sy, "--ex": p.ex, "--ey": p.ey,
          }}
        />
      ))}
    </div>
  );
}

/* Shape component for event tags */
function EventShape({ shape, color }) {
  const base = "inline-block shrink-0 mr-1 align-middle";
  if (shape === "square") return <span className={base} style={{ width: 8, height: 8, background: color || "currentColor", borderRadius: 2 }} />;
  if (shape === "circle") return <span className={base} style={{ width: 8, height: 8, background: color || "currentColor", borderRadius: "50%" }} />;
  if (shape === "diamond") return <span className={base} style={{ width: 8, height: 8, background: color || "currentColor", transform: "rotate(45deg)", borderRadius: 1 }} />;
  if (shape === "triangle") return <span className={base} style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `8px solid ${color || "currentColor"}` }} />;
  if (shape === "dash") return <span className={base} style={{ width: 12, height: 3, background: color || "currentColor", borderRadius: 2 }} />;
  return null;
}

/* ═══ COMPONENT ═══ */
export default function MonPlanning() {
  const [absences, setAbsences] = useState([]);
  const [profile, setProfile] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null); // event cliqué dans la grille
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
  const [branchesDb, setBranchesDb] = useState([]);
  const [filterBranche, setFilterBranche] = useState("");
  const dayGridRef = useRef(null);
  const weekGridRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [slotHeight, setSlotHeight] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("planning-zoom");
      return saved ? parseInt(saved, 10) : 48;
    }
    return 48;
  });
  const zoomPct = Math.round((slotHeight / 48) * 100);

  // Persist zoom
  useEffect(() => {
    localStorage.setItem("planning-zoom", String(slotHeight));
  }, [slotHeight]);

  const myMissions = useMemo(() => {
    if (!profile?.userId) return [];
    return projects.filter((p) => Array.isArray(p.assignees) && p.assignees.some((a) => String(a) === String(profile.userId) || String(a._id || a.id || a) === String(profile.userId)));
  }, [projects, profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [absRes, profRes, projRes, brRes] = await Promise.all([
        fetch("/api/employee-absences", { cache: "no-store" }),
        fetch("/api/employee-profiles?mine=true", { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
        fetch("/api/branches", { cache: "no-store" }).catch(() => ({ json: () => ({ items: [] }) })),
      ]);
      if (cancelled) return;
      const absData = await absRes.json(); setAbsences(absData.items || []);
      try { const profData = await profRes.json(); if (profData.items?.length) setProfile(profData.items[0]); } catch {}
      try { const brData = await brRes.json(); setBranchesDb(brData.items || []); } catch {}
      try { const projData = await projRes.json(); setProjects((projData.items || []).map((c) => normalizeProject(c, [])).filter((p) => p.dateDebut && p.dateFin)); } catch {}
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
    if (showProjets) { for (const p of projects) { if (filterBranche && p.branche !== filterBranche) continue; const d = new Date(p.dateDebut + "T12:00:00"); const end = new Date(p.dateFin + "T12:00:00"); while (d <= end) { add(toYMD(d), { type: "projet", ...p }); d.setDate(d.getDate() + 1); } } }
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
        // Filtre par branche — match le nom du calendrier avec le keyword de la branche
        if (filterBranche) {
          const branchMatch = branchesDb.find((br) => br.key === filterBranche);
          if (branchMatch?.gcalKeyword && !calName.toLowerCase().includes(branchMatch.gcalKeyword.toLowerCase())) continue;
        }
        const classification = classifyGcalEvent(ev.title);
        const forceAllDay = classification === "absence" || classification === "tt" || classification === "maladie" || isAllDay;
        const tag = EVENT_TAGS[classification] || EVENT_TAGS.rdv;
        const d = new Date(startDate + "T12:00:00"); const end = new Date(endDate + "T12:00:00");
        while (d <= end) { add(toYMD(d), { type: "gcal", title: ev.title, color: evColor, gcalId: ev.gcalId, calendarName: calName, startHour: forceAllDay ? null : startHour, endHour: forceAllDay ? null : endHour, isAllDay: forceAllDay, classification, tag }); d.setDate(d.getDate() + 1); }
      }
    }
    return map;
  }, [projects, myMissions, absences, gcalEvents, gcalCalendars, branchesDb, showProjets, showMissions, showAbsences, showGcal, filterBranche]);

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

  // Smart scroll: first event of the day, or 8h by default
  useEffect(() => {
    const ref = view === "day" ? dayGridRef : weekGridRef;
    if (!ref.current) return;
    // Find earliest event on the focused day
    const focusKey = toYMD(calDate);
    const dayEvts = calEvents[focusKey] || [];
    let earliest = DAY_SCROLL_TO;
    for (const ev of dayEvts) {
      if (ev.startHour !== undefined && ev.startHour < earliest) earliest = Math.max(0, Math.floor(ev.startHour) - 1);
    }
    const scrollToHour = view === "day" ? earliest - HOUR_START_DAY : earliest - HOUR_START_WEEK;
    ref.current.scrollTop = Math.max(0, scrollToHour) * slotHeight;
  }, [view, calDate, slotHeight, calEvents]);

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

  function handleEventClick(e, ev) {
    if (e) e.stopPropagation();
    setSelectedEvent(ev);
    const dateStr = selectedDate ? toYMD(selectedDate) : toYMD(new Date());

    if (ev.type === "gcal" && ev.gcalId) {
      setNoteForm({
        contenu: ev.title || "", dateDebut: dateStr,
        heureDebut: ev.startHour != null ? `${String(Math.floor(ev.startHour)).padStart(2,"0")}:${String(Math.round((ev.startHour%1)*60)).padStart(2,"0")}` : "09:00",
        heureFin: ev.endHour != null ? `${String(Math.floor(ev.endHour)).padStart(2,"0")}:${String(Math.round((ev.endHour%1)*60)).padStart(2,"0")}` : "10:00",
        lieu: ev.location || "", participants: "", allDay: ev.isAllDay || false, gcalEditId: ev.gcalId,
      });
      setForm({ type: "", dateDebut: dateStr, dateFin: dateStr, demiJournee: "", commentaire: "" });
      setProjForm({ nomContrat: "", clientNom: "", branche: "", dateDebut: dateStr, dateFin: dateStr, lieu: "", brief: "" });
      setEditId(null); setModalType("editGcal"); setModalOpen(true);
    } else if (ev.type === "absence") {
      if (ev.statut === "en_attente" && ev.dateDebut >= today) {
        openEdit(ev);
      }
      // Si validé/passé, on pourrait afficher un détail read-only — pour l'instant on ne fait rien
    } else if (ev.type === "projet" || ev.type === "mission") {
      // Ouvrir en mode projet avec les données pré-remplies
      setProjForm({
        nomContrat: ev.title || "", clientNom: ev.clientNom || "", branche: ev.branche || "",
        dateDebut: ev.dateDebut || dateStr, dateFin: ev.dateFin || dateStr,
        lieu: ev.lieu || "", brief: "",
      });
      setForm({ type: "", dateDebut: dateStr, dateFin: dateStr, demiJournee: "", commentaire: "" });
      setNoteForm({ contenu: "", dateDebut: dateStr, heureDebut: "09:00", heureFin: "10:00", lieu: "", participants: "", allDay: true });
      setEditId(null); setModalType("projet"); setModalOpen(true);
    }
  }

  // Render cell events for MONTH view — compact, hierarchical, CLICKABLE
  function renderMonthCell(events) {
    const projs = events.filter((e) => e.type === "projet" || e.type === "mission");
    const abs = events.filter((e) => e.type === "absence");
    const gcals = events.filter((e) => e.type === "gcal");
    return (
      <>
        {projs.slice(0, 3).map((p, j) => (
          <div
            key={`p${j}`}
            className="text-[10px] font-bold py-0.5 px-1.5 rounded border-l-[3px] whitespace-nowrap overflow-hidden text-ellipsis leading-snug text-white cursor-pointer transition-all duration-150 hover:brightness-[1.1]"
            style={{ backgroundColor: `color-mix(in srgb, ${p.color} 82%, white)`, borderLeftColor: p.color }}
            onClick={(e) => handleEventClick(e, p)}
          >
            {p.isMine ? "👤 " : ""}{p.title.length > 14 ? p.title.slice(0, 14) + "..." : p.title}
          </div>
        ))}
        {abs.slice(0, 1).map((a, j) => (
          <div
            key={`a${j}`}
            className="text-[10px] font-bold py-0.5 px-1.5 rounded border-l-2 whitespace-nowrap overflow-hidden text-ellipsis leading-snug text-white cursor-pointer transition-all duration-150 hover:brightness-[1.1]"
            style={{ backgroundColor: `color-mix(in srgb, ${a.absType?.color || "#888"} 75%, white)`, borderLeftColor: a.absType?.color || "#888" }}
            onClick={(e) => handleEventClick(e, a)}
          >
            {a.absType?.icon} {a.absType?.label}
          </div>
        ))}
        {gcals.slice(0, 3).map((g, j) => (
          <div
            key={`g${j}`}
            className="text-[10px] font-semibold py-0.5 px-1.5 rounded whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1 leading-snug cursor-pointer transition-all duration-150 hover:brightness-95"
            style={{ backgroundColor: `color-mix(in srgb, ${g.color} 14%, white)`, color: g.color }}
            onClick={(e) => handleEventClick(e, g)}
          >
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: g.color }} />
            {g.title.length > 14 ? g.title.slice(0, 14) + "..." : g.title}
          </div>
        ))}
        {(projs.length + abs.length + gcals.length) > 7 && (
          <div className="text-[9px] text-muted-foreground font-extrabold py-0.5 px-1">+{projs.length + abs.length + gcals.length - 7}</div>
        )}
      </>
    );
  }

  return (
    <div className="px-6 py-5 max-w-[1440px] mx-auto relative font-sans bg-slate-50/60 min-h-screen -m-6 p-6">

      {/* ═══ VIBE BAR — Project Hot Quote ═══ */}
      <div
        className={`relative flex items-center gap-4 py-4 px-6 rounded-2xl mb-4 border border-violet-100 overflow-hidden transition-all duration-300 ease-out bg-gradient-to-r from-violet-50 via-purple-50/60 to-fuchsia-50/30 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
        onMouseEnter={() => setVibeHover(true)}
        onMouseLeave={() => setVibeHover(false)}
      >
        <Sparkles active={vibeHover} />
        <span className="text-xl shrink-0 animate-[float-gentle_3s_ease-in-out_infinite] relative z-[2]">{projectQuote.icon}</span>
        <span className="text-sm font-bold text-foreground flex-1 leading-snug relative z-[2]">{projectQuote.msg}</span>
        {projectQuote.color && <span className="w-2 h-2 rounded-full shrink-0 relative z-[2]" style={{ background: projectQuote.color }} />}
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap items-center">
          {/* Toggle: Projets */}
          <button
            className={`flex items-center gap-2 py-2 px-3.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 select-none ${showProjets ? "bg-rose-50 border border-rose-200 text-rose-700 shadow-sm" : "bg-muted/50 border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            onClick={() => setShowProjets((v) => !v)}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${showProjets ? "scale-125" : "scale-100"}`} style={{ background: showProjets ? "#e11d48" : "#9ca3af" }} />
            Projets
            <Badge variant="outline" className="text-[9px] font-extrabold h-4 px-1.5 rounded-full bg-transparent border-current/20">{projects.length}</Badge>
          </button>
          {/* Toggle: Missions */}
          <button
            className={`flex items-center gap-2 py-2 px-3.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 select-none ${showMissions ? "bg-violet-50 border border-violet-200 text-violet-700 shadow-sm" : "bg-muted/50 border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            onClick={() => setShowMissions((v) => !v)}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${showMissions ? "scale-125" : "scale-100"}`} style={{ background: showMissions ? "#7c3aed" : "#9ca3af" }} />
            Missions
            <Badge variant="outline" className="text-[9px] font-extrabold h-4 px-1.5 rounded-full bg-transparent border-current/20">{myMissions.length}</Badge>
          </button>
          {/* Toggle: Absences */}
          <button
            className={`flex items-center gap-2 py-2 px-3.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 select-none ${showAbsences ? "bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm" : "bg-muted/50 border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            onClick={() => setShowAbsences((v) => !v)}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${showAbsences ? "scale-125" : "scale-100"}`} style={{ background: showAbsences ? "#10b981" : "#9ca3af" }} />
            Absences
            <Badge variant="outline" className="text-[9px] font-extrabold h-4 px-1.5 rounded-full bg-transparent border-current/20">{absences.length}</Badge>
          </button>
          {/* Toggle: Agenda */}
          {gcalConnected && (
            <button
              className={`flex items-center gap-2 py-2 px-3.5 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 select-none ${showGcal ? "bg-blue-50 border border-blue-200 text-blue-700 shadow-sm" : "bg-muted/50 border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              onClick={() => setShowGcal((v) => !v)}
            >
              <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${showGcal ? "scale-125" : "scale-100"}`} style={{ background: showGcal ? "#4285f4" : "#9ca3af" }} />
              Agenda
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-[11px] font-bold py-2 px-3 border border-border rounded-xl bg-background text-foreground cursor-pointer transition-all duration-200 hover:border-violet-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 appearance-none pr-7"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.2em 1.2em" }}
            value={filterBranche}
            onChange={(e) => setFilterBranche(e.target.value)}
          >
            <option value="">Toutes les branches</option>
            {branchesDb.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            {branchesDb.length === 0 && ["Agency","CreativeGen","Entertainment","SFX","Atelier","Communication"].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <Button
            className="bg-gradient-to-r from-violet-600 to-purple-500 text-white font-extrabold text-[11px] border-0 rounded-xl px-4 py-2 cursor-pointer shadow-lg shadow-violet-500/25 hover:-translate-y-0.5 hover:shadow-violet-500/40 active:translate-y-0 transition-all duration-200"
            onClick={openNew}
          >
            <Plus className="size-3.5" /> Ajouter
          </Button>
        </div>
      </div>

      {/* ═══ MAIN: MiniCal + Calendar + Panel ═══ */}
      <div className="flex gap-4 items-start mb-5 max-md:flex-col">

        {/* ─── Mini calendar ─── */}
        <Card className="w-56 shrink-0 sticky top-4 rounded-2xl border-border/60 p-4 overflow-hidden max-[900px]:hidden" style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.04)" }}>
          <div className="flex items-center justify-between mb-3">
            <button className="bg-transparent border-none text-base font-black text-muted-foreground cursor-pointer p-1 px-2 rounded-lg transition-all duration-200 hover:text-foreground hover:bg-violet-50" onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-xs font-extrabold text-foreground tracking-tight">{MOIS[calDate.getMonth()].slice(0, 3)} {calDate.getFullYear()}</span>
            <button className="bg-transparent border-none text-base font-black text-muted-foreground cursor-pointer p-1 px-2 rounded-lg transition-all duration-200 hover:text-foreground hover:bg-violet-50" onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} className="text-center text-[9px] font-extrabold text-muted-foreground py-1 uppercase tracking-wider">{d}</div>)}
            {(() => {
              const y = calDate.getFullYear(), m = calDate.getMonth();
              const first = new Date(y, m, 1); let start = (first.getDay() + 6) % 7;
              const sd = new Date(first); sd.setDate(sd.getDate() - start);
              const days = [];
              for (let i = 0; i < 42; i++) { const d = new Date(sd); d.setDate(d.getDate() + i); days.push(d); }
              return days.map((d, i) => {
                const key = toYMD(d); const isMonth = d.getMonth() === m; const isToday2 = key === today;
                const dayEvts = calEvents[key] || [];
                const hasEvents = dayEvts.length > 0;
                const hasProj = dayEvts.some((e) => e.type === "projet" || e.type === "mission");
                const hasAbs = dayEvts.some((e) => e.type === "absence");
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5 py-px">
                    <button
                      className={[
                        "bg-transparent border-none text-[11px] font-semibold text-foreground w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150",
                        isToday2 && "!font-bold !text-white",
                        !isMonth && "text-muted-foreground opacity-25",
                        selectedDate && toYMD(selectedDate) === key && !isToday2 && "bg-violet-100 text-violet-700 font-bold",
                        !isToday2 && !(selectedDate && toYMD(selectedDate) === key) && isMonth && "hover:bg-violet-50",
                      ].filter(Boolean).join(" ")}
                      style={isToday2 ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)" } : {}}
                      onClick={() => { setCalDate(d); if (view === "day") setCalDate(d); handleDayClick(d); }}
                    >
                      {d.getDate()}
                    </button>
                    {hasEvents ? (
                      <div className="flex gap-px h-1 items-center">
                        {hasProj && <span className="w-1 h-1 rounded-full bg-rose-500" />}
                        {hasAbs && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                        {!hasProj && !hasAbs && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                      </div>
                    ) : (
                      <div className="h-1" />
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {/* Calendriers Google — toggles par branche */}
          {gcalConnected && gcalCalendars.length > 0 && (
            <div className="mt-4">
              <Separator className="mb-3" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Agendas</span>
                <button className="bg-transparent border-none text-xs cursor-pointer text-muted-foreground p-1 rounded-lg transition-all duration-200 hover:text-violet-600 hover:bg-violet-50" onClick={() => setShowCalPicker((v) => !v)}>
                  <Settings2 className="size-3.5" />
                </button>
              </div>
              {gcalCalendars.filter((c) => gcalSelectedIds.includes(c.id)).map((cal) => (
                <button key={cal.id} className="flex items-center gap-2 py-1.5 px-2 w-full border-none bg-transparent cursor-pointer rounded-lg transition-all duration-200 text-left hover:bg-violet-50/50" onClick={() => toggleGcalCalendar(cal.id)}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: cal.backgroundColor || "#4285f4" }} />
                  <span className="text-[11px] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{cal.summary.length > 18 ? cal.summary.slice(0, 18) + "..." : cal.summary}</span>
                </button>
              ))}
              {showCalPicker && gcalCalendars.filter((c) => !gcalSelectedIds.includes(c.id)).length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  {gcalCalendars.filter((c) => !gcalSelectedIds.includes(c.id)).map((cal) => (
                    <button key={cal.id} className="flex items-center gap-2 py-1.5 px-2 w-full border-none bg-transparent cursor-pointer rounded-lg transition-all duration-200 text-left hover:bg-violet-50/50" onClick={() => toggleGcalCalendar(cal.id)}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 opacity-40" style={{ background: cal.backgroundColor || "#4285f4" }} />
                      <span className="text-[11px] font-semibold text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{cal.summary.length > 18 ? cal.summary.slice(0, 18) + "..." : cal.summary}</span>
                      <span className="text-sm font-black text-violet-600 ml-auto">
                        <Plus className="size-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ─── Main Calendar ─── */}
        <Card className={`flex-1 min-w-0 rounded-2xl border-border overflow-hidden ${loaded ? "animate-[fade-up_300ms_ease_0.08s_both]" : "opacity-0"}`} style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>

          {/* ── Calendar header (nav intégrée) ── */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-wrap bg-slate-50/80">
            <div className="flex gap-1.5 items-center flex-1 min-w-0">
              <Button variant="outline" size="sm" onClick={goToday} className="text-[11px] font-bold text-muted-foreground rounded-xl hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-all duration-200 shrink-0">
                Aujourd&apos;hui
              </Button>
              <Button variant="outline" size="icon-sm" onClick={navPrev} className="rounded-xl hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-all duration-200">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={navNext} className="rounded-xl hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-all duration-200">
                <ChevronRight className="size-4" />
              </Button>
              <h2 className="text-lg font-black tracking-tight m-0 text-foreground ml-2">{calLabel()}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {view !== "month" && (
                <div className="flex items-center gap-1 rounded-xl border bg-card px-1 py-0.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => setSlotHeight((h) => Math.max(32, h - 8))} title="Réduire" className="rounded-lg h-7 w-7">
                    <ZoomOut className="size-3.5" />
                  </Button>
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-10 text-center">{zoomPct}%</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSlotHeight((h) => Math.min(120, h + 8))} title="Agrandir" className="rounded-lg h-7 w-7">
                    <ZoomIn className="size-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex bg-muted/60 rounded-xl p-1 gap-0.5">
                {["day", "week", "month"].map((v) => (
                  <button
                    key={v}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer border-none ${view === v ? "bg-white shadow-sm text-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setView(v)}
                  >
                    {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
                  </button>
                ))}
              </div>
              <div className="w-px h-5 bg-border" />
              <Button
                variant={selectedDate ? "default" : "outline"}
                size="icon-sm"
                onClick={() => selectedDate ? setSelectedDate(null) : setSelectedDate(new Date())}
                className={`rounded-xl transition-all duration-200 ${selectedDate ? "bg-violet-600 hover:bg-violet-700 text-white" : "text-muted-foreground hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600"}`}
                title={selectedDate ? "Fermer le panneau" : "Voir le détail du jour"}
              >
                {selectedDate ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
              </Button>
            </div>
          </div>

          {/* ── Calendar content ── */}
          <div className="p-5">

          {/* VUE MOIS */}
          {view === "month" && (
            <div className="grid grid-cols-7 border border-border rounded-xl overflow-hidden">
              {JOURS_HEAD.map((j, ji) => <div key={j} className={`text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground py-2.5 border-b border-border bg-slate-50 ${ji > 0 ? "border-l border-border" : ""}`}>{j}</div>)}
              {calDays.map((d, i) => {
                const key = toYMD(d); const isMonth = d.getMonth() === month; const isToday2 = key === today;
                const events = calEvents[key] || []; const isSelected = selectedDate && toYMD(selectedDate) === key;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const col = i % 7;
                return (
                  <div
                    key={i}
                    className={[
                      "min-h-[100px] p-2 cursor-pointer transition-all duration-150 flex flex-col gap-0.5 border-b border-border",
                      col > 0 && "border-l border-border",
                      isWeekend && isMonth ? "bg-slate-50/80" : "bg-white",
                      "hover:bg-violet-50/40",
                      isToday2 && "!bg-violet-50 animate-[pulse-ring_2.5s_ease-in-out_infinite]",
                      !isMonth && "!bg-slate-100/50 opacity-40 pointer-events-none",
                      isSelected && "!bg-violet-100/60 ring-2 ring-inset ring-violet-400/30",
                    ].filter(Boolean).join(" ")}
                    onClick={() => isMonth && handleDayClick(d)}
                    role={isMonth ? "button" : undefined}
                    tabIndex={isMonth ? 0 : undefined}
                    onKeyDown={(e) => { if (isMonth && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleDayClick(d); } }}
                  >
                    <span className={`text-xs font-extrabold leading-none mb-1 ${isToday2 ? "text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-[11px] font-bold shadow-md" : "text-foreground"}`} style={isToday2 ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 3px 10px rgba(124,58,237,0.3)" } : {}}>
                      {d.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">{renderMonthCell(events)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VUE SEMAINE — TIME GRID */}
          {view === "week" && (
            <div className="flex flex-col">
              {/* All-day row */}
              <div className="grid border-b border-border bg-slate-50/40" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                <div className="w-12 shrink-0 border-r border-border" />
                {weekDays.map((d, i) => {
                  const key = toYMD(d); const events = calEvents[key] || [];
                  const allDay = events.filter((e) => (e.type === "gcal" && e.isAllDay) || e.type === "projet" || e.type === "mission" || e.type === "absence");
                  return (
                    <div key={i} className="flex flex-col gap-0.5 px-0.5 py-1 border-l border-border">
                      {allDay.slice(0, 4).map((ev, j) => {
                        const c = ev.type === "absence" ? (ev.absType?.color || "#888") : ev.color || "#4285f4";
                        const label = ev.type === "projet" || ev.type === "mission" ? `${ev.isMine ? "👤 " : ""}${ev.title}` : ev.type === "absence" ? `${ev.absType?.icon} ${ev.absType?.label}` : ev.title;
                        return (
                          <div
                            key={j}
                            className="text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap overflow-hidden text-ellipsis border-l-[3px] text-white cursor-pointer transition-all duration-150 hover:brightness-[1.1]"
                            style={{ backgroundColor: `color-mix(in srgb, ${c} 80%, white)`, borderLeftColor: c }}
                            title={label}
                            onClick={(e) => { e.stopPropagation(); handleEventClick(e, ev); }}
                          >
                            {label.length > 16 ? label.slice(0, 16) + "..." : label}
                          </div>
                        );
                      })}
                      {allDay.length > 4 && <div className="text-[9px] text-muted-foreground font-bold py-0.5 px-1">+{allDay.length - 4}</div>}
                    </div>
                  );
                })}
              </div>
              {/* Header */}
              <div className="grid border-b border-border bg-slate-50/80" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                <div className="w-12 shrink-0 border-r border-border" />
                {weekDays.map((d, i) => {
                  const key = toYMD(d); const isToday2 = key === today; const isSel = selectedDate && toYMD(selectedDate) === key;
                  return (
                    <div
                      key={i}
                      className={`text-center py-2.5 px-0.5 cursor-pointer transition-all duration-200 border-l border-border ${isToday2 ? "bg-violet-50" : ""} ${isSel ? "bg-violet-100/50" : ""} hover:bg-violet-50/60`}
                      onClick={() => handleDayClick(d)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="block text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mb-0.5">{JOURS_HEAD[i]}</span>
                      <span className={`inline-flex items-center justify-center text-base font-black w-8 h-8 rounded-full transition-all duration-200 ${isToday2 ? "text-white text-[13px] shadow-md" : "text-foreground"}`} style={isToday2 ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 3px 10px rgba(124,58,237,0.3)" } : {}}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Time body */}
              <div className="grid max-h-[560px] overflow-y-auto" style={{ gridTemplateColumns: "48px 1fr", scrollbarWidth: "thin" }} ref={weekGridRef}>
                <div className="flex flex-col border-r border-zinc-200" style={{ backgroundColor: "#f8f8fa" }}>
                  {hoursWeek.map((h) => (
                    <div key={h} className="flex items-start justify-end pr-2 border-b border-zinc-200" style={{ height: `${slotHeight}px` }}>
                      <span className={`text-[10px] font-bold tabular-nums -translate-y-1.5 ${h >= 8 && h <= 19 ? "text-zinc-600" : "text-zinc-300"}`}>{String(h).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
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
                    return (
                      <div
                        key={i}
                        className={`relative border-l border-border cursor-pointer transition-colors duration-200 ${isToday2 ? "bg-violet-50/40" : ""} hover:bg-violet-50/20`}
                        onClick={() => handleDayClick(d)}
                      >
                        {hoursWeek.map((h) => (
                          <div key={h} className={`border-b border-zinc-200 relative cursor-crosshair ${h % 2 === 0 ? "bg-zinc-50/60" : "bg-white"}`} style={{ height: `${slotHeight}px` }}>
                            <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-zinc-200/70" />
                          </div>
                        ))}
                        {/* Ligne heure actuelle */}
                        {isToday2 && (() => {
                          const now = new Date();
                          const currentHour = now.getHours() + now.getMinutes() / 60;
                          if (currentHour < HOUR_START_WEEK || currentHour > HOUR_END_WEEK) return null;
                          const topPct = ((currentHour - HOUR_START_WEEK) / (HOUR_END_WEEK - HOUR_START_WEEK)) * 100;
                          return (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${topPct}%` }}>
                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                              <div className="flex-1 h-[2px] bg-red-500" />
                            </div>
                          );
                        })()}
                        {laid.map((ev, j) => {
                          const top = ((ev.startHour - HOUR_START_WEEK) / (HOUR_END_WEEK - HOUR_START_WEEK)) * 100;
                          const height = Math.max(2.5, ((ev.endHour - ev.startHour) / (HOUR_END_WEEK - HOUR_START_WEEK)) * 100);
                          const width = 100 / ev.totalCols;
                          const left = ev.col * width;
                          const ttStart = `${String(Math.floor(ev.startHour)).padStart(2,"0")}:${String(Math.round((ev.startHour%1)*60)).padStart(2,"0")}`;
                          const ttEnd = `${String(Math.floor(ev.endHour)).padStart(2,"0")}:${String(Math.round((ev.endHour%1)*60)).padStart(2,"0")}`;
                          const tooltip = `${ev.title}\n${ttStart} — ${ttEnd}${ev.calendarName ? `\n${ev.calendarName}` : ""}${ev.tag?.label ? ` · ${ev.tag.label}` : ""}`;
                          return (
                            <div
                              key={j}
                              className="absolute rounded-lg px-2 py-1.5 overflow-hidden z-[1] cursor-pointer flex flex-col gap-px border-l-4 shadow-sm text-white transition-all duration-150 hover:shadow-md hover:z-10 min-w-0"
                              style={{
                                top: `${top}%`, height: `${height}%`,
                                left: `calc(${left}% + ${ev.col > 0 ? "2px" : "0px"})`,
                                width: `calc(${width}% - ${ev.totalCols > 1 ? "3px" : "0px"})`,
                                backgroundColor: `color-mix(in srgb, ${ev.color} 85%, white)`,
                                borderLeftColor: ev.color,
                              }}
                              title={tooltip}
                              onClick={(e) => { e.stopPropagation(); handleEventClick(e, ev); }}
                            >
                              <span className="text-[11px] font-bold leading-snug whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
                                {ev.tag?.shape && <EventShape shape={ev.tag.shape} />} {ev.title}
                              </span>
                              <span className="text-[9px] font-semibold opacity-70">{ttStart} {ev.calendarName ? `· ${ev.calendarName}` : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
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
              <div className="flex flex-col">
                {allDay.length > 0 && (
                  <div className="py-2 border-b border-border/50 mb-1.5 flex flex-wrap gap-1.5">
                    {allDay.map((ev, j) => {
                      const c = ev.type === "absence" ? (ev.absType?.color || "#888") : ev.color || "#4285f4";
                      const label = ev.type === "projet" || ev.type === "mission" ? `${ev.isMine ? "👤 " : "🎬 "}${ev.title} · ${ev.branche}` : ev.type === "absence" ? `${ev.absType?.icon} ${ev.absType?.label}` : ev.title;
                      return (
                        <div
                          key={j}
                          className="text-[11px] font-bold py-1.5 px-3 rounded-lg border-l-4 text-white shadow-sm transition-all duration-150 hover:brightness-[1.1]"
                          style={{ backgroundColor: `color-mix(in srgb, ${c} 80%, white)`, borderLeftColor: c }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div
                  className="grid max-h-[560px] overflow-y-auto"
                  style={{ gridTemplateColumns: "48px 1fr", scrollbarWidth: "thin", "--slot-h": `${slotHeight}px` }}
                  ref={dayGridRef}
                  onMouseUp={handleGridMouseUp}
                  onMouseLeave={() => { if (isDragging) handleGridMouseUp(); }}
                >
                  <div className="flex flex-col border-r border-zinc-200" style={{ backgroundColor: "#f8f8fa" }}>
                    {hoursDay.map((h) => (
                      <div key={h} className="flex items-start justify-end pr-2 border-b border-zinc-200" style={{ height: `${slotHeight}px` }}>
                        <span className={`text-[10px] font-bold tabular-nums -translate-y-1.5 ${h >= 8 && h <= 19 ? "text-zinc-600" : "text-zinc-300"}`}>{String(h).padStart(2, "0")}:00</span>
                      </div>
                    ))}
                  </div>
                  <div className="relative border-l border-zinc-200">
                    {hoursDay.map((h) => (
                      <div
                        key={h}
                        className={`border-b border-zinc-200 relative cursor-crosshair ${h % 2 === 0 ? "bg-zinc-50/60" : "bg-white"}`}
                        style={{ height: `${slotHeight}px` }}
                        onMouseDown={(e) => { e.preventDefault(); handleGridMouseDown(calDate, h); }}
                        onMouseMove={() => handleGridMouseMove(h + 0.5)}
                      >
                        {/* Demi-heure */}
                        <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-zinc-200/70" />
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1/2"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleGridMouseDown(calDate, h + 0.5); }}
                          onMouseMove={(e) => { e.stopPropagation(); handleGridMouseMove(h + 1); }}
                        />
                      </div>
                    ))}
                    {/* ── Ligne heure actuelle ── */}
                    {toYMD(calDate) === today && (() => {
                      const now = new Date();
                      const currentHour = now.getHours() + now.getMinutes() / 60;
                      if (currentHour < HOUR_START_DAY || currentHour > HOUR_END_DAY) return null;
                      const topPct = ((currentHour - HOUR_START_DAY) / (HOUR_END_DAY - HOUR_START_DAY)) * 100;
                      return (
                        <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${topPct}%` }}>
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shrink-0 shadow-sm" />
                          <div className="flex-1 h-[2px] bg-red-500 shadow-sm" />
                        </div>
                      );
                    })()}
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
                      return (
                        <>
                          {dragPreview && (() => {
                            const dTop = ((dragStart.hour - HOUR_START_DAY) / (HOUR_END_DAY - HOUR_START_DAY)) * 100;
                            const dH = Math.max(1, ((dragEnd.hour - dragStart.hour) / (HOUR_END_DAY - HOUR_START_DAY)) * 100);
                            return <div className="absolute left-1 right-1 bg-violet-100 border-2 border-dashed border-violet-400/50 rounded-xl z-[5] pointer-events-none" style={{ top: `${dTop}%`, height: `${dH}%` }} />;
                          })()}
                          {laid.map((ev, j) => {
                            const top = ((ev.startHour - HOUR_START_DAY) / (HOUR_END_DAY - HOUR_START_DAY)) * 100;
                            const height = Math.max(2, ((ev.endHour - ev.startHour) / (HOUR_END_DAY - HOUR_START_DAY)) * 100);
                            const width = 100 / ev.totalCols;
                            const left = ev.col * width;
                            const ttS = `${String(Math.floor(ev.startHour)).padStart(2,"0")}:${String(Math.round((ev.startHour%1)*60)).padStart(2,"0")}`;
                            const ttE = `${String(Math.floor(ev.endHour)).padStart(2,"0")}:${String(Math.round((ev.endHour%1)*60)).padStart(2,"0")}`;
                            return (
                              <div
                                key={j}
                                className="absolute rounded-lg px-3 py-2 overflow-hidden z-[1] cursor-pointer flex flex-col gap-0.5 border-l-4 text-white shadow-sm transition-all duration-150 hover:shadow-md hover:z-10"
                                style={{
                                  top: `${top}%`, height: `${height}%`,
                                  left: `calc(${left}% + ${ev.col > 0 ? "2px" : "0px"})`,
                                  width: `calc(${width}% - ${ev.totalCols > 1 ? "3px" : "0px"})`,
                                  backgroundColor: `color-mix(in srgb, ${ev.color} 85%, white)`,
                                  borderLeftColor: ev.color,
                                }}
                                title={`${ev.title}\n${ttS} — ${ttE}${ev.calendarName ? `\n${ev.calendarName}` : ""}${ev.tag?.label ? ` · ${ev.tag.label}` : ""}`}
                                onClick={(e) => { e.stopPropagation(); handleEventClick(e, ev); }}
                              >
                                <span className="text-[13px] font-extrabold leading-snug whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
                                  {ev.tag?.shape && <EventShape shape={ev.tag.shape} />} {ev.title}
                                </span>
                                <span className="text-[11px] font-bold opacity-75">{ttS} — {ttE}</span>
                                {ev.calendarName && <span className="text-[10px] font-semibold opacity-55">{ev.calendarName} {ev.tag ? `· ${ev.tag.label}` : ""}</span>}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
          </div>
        </Card>

        {/* ═══ SIDE PANEL ═══ */}
        {selectedDate && (() => {
          const dateStr = toYMD(selectedDate); const isFuture = dateStr >= today;
          return (
            <Card className="w-80 shrink-0 rounded-2xl border-border/60 p-5 animate-[slide-in-right_200ms_ease] sticky top-4 max-[900px]:w-full max-[900px]:static" style={{ boxShadow: "0 8px 30px rgba(124,58,237,0.06)" }}>
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500 mb-0.5">{dayOfWeekFr(selectedDate)}</div>
                  <div className="text-3xl font-black text-foreground leading-none tracking-tight">{selectedDate.getDate()} <span className="text-lg font-bold text-muted-foreground">{MOIS[selectedDate.getMonth()]}</span></div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setSelectedDate(null)} className="rounded-lg text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </Button>
              </div>

              {/* Projets */}
              {selectedEvents.projs.length > 0 && (
                <div className="mb-4">
                  <Separator className="mb-3" />
                  <h3 className="text-[10px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">🎬 Projets</h3>
                  {selectedEvents.projs.map((p, j) => (
                    <div
                      key={j}
                      className="py-2.5 px-3 rounded-xl border-l-4 mb-1.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                      style={{ background: `color-mix(in srgb, ${p.color} 6%, white)`, borderLeftColor: p.color }}
                      onClick={() => handleEventClick(null, p)}
                    >
                      <div className="text-xs font-extrabold text-foreground">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.branche} · {p.statut}</div>
                      {p.id && <a href={`/projets/${p.id}`} className="flex items-center gap-1 text-[10px] font-bold text-violet-600 no-underline mt-1.5 transition-opacity hover:opacity-70" onClick={(e) => e.stopPropagation()}><ExternalLink className="size-3" /> Voir le projet</a>}
                    </div>
                  ))}
                </div>
              )}

              {/* Missions */}
              {selectedEvents.missions.length > 0 && (
                <div className="mb-4">
                  <Separator className="mb-3" />
                  <h3 className="text-[10px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">👤 Mes missions</h3>
                  {selectedEvents.missions.map((p, j) => (
                    <div
                      key={j}
                      className="py-2.5 px-3 rounded-xl border-l-4 mb-1.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                      style={{ background: `color-mix(in srgb, ${p.color} 6%, white)`, borderLeftColor: p.color }}
                      onClick={() => handleEventClick(null, p)}
                    >
                      <div className="text-xs font-extrabold text-foreground">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.branche} · {p.statut}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Absences */}
              {selectedEvents.abs.length > 0 && (
                <div className="mb-4">
                  <Separator className="mb-3" />
                  <h3 className="text-[10px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">🌴 Absences</h3>
                  {selectedEvents.abs.map((a, j) => {
                    const s = STATUT_LABELS[a.statut] || { label: a.statut, color: "#6b7280", bg: "transparent" };
                    return (
                      <div
                        key={j}
                        className="py-2.5 px-3 rounded-xl border-l-4 mb-1.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                        style={{ background: `color-mix(in srgb, ${a.absType?.color || "#888"} 6%, white)`, borderLeftColor: a.absType?.color || "#888" }}
                        onClick={() => handleEventClick(null, a)}
                      >
                        <div className="text-xs font-extrabold text-foreground">{a.absType?.icon} {a.absType?.label}{a.employeeNom ? ` — ${a.employeeNom}` : ""}</div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-extrabold mt-1 h-auto py-0.5 px-2 rounded-full"
                          style={{ background: s.bg, color: s.color, borderColor: "transparent" }}
                        >
                          {s.label}
                        </Badge>
                        {a.employeeProfileId && <a href={`/rh/employe/${a.employeeProfileId}`} className="flex items-center gap-1 text-[10px] font-bold text-violet-600 no-underline mt-1.5 transition-opacity hover:opacity-70" onClick={(e) => e.stopPropagation()}><ExternalLink className="size-3" /> Voir la fiche</a>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Agenda */}
              {Object.keys(selectedEvents.gcalByBranch).length > 0 && (
                <div className="mb-4">
                  <Separator className="mb-3" />
                  <h3 className="text-[10px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">📅 Agenda</h3>
                  {Object.entries(selectedEvents.gcalByBranch).map(([branch, data]) => (
                    <div key={branch} className="mb-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: data.color }} />
                        <span className="text-[10px] font-extrabold text-foreground uppercase tracking-tight">{branch}</span>
                        <Badge variant="outline" className="text-[8px] font-extrabold h-4 px-1.5 rounded-full bg-transparent">{data.events.length}</Badge>
                      </div>
                      {data.events.map((g, j) => (
                        <div
                          key={j}
                          className="text-[11px] text-muted-foreground py-1.5 pl-4 border-l-2 border-border ml-1 font-semibold flex items-center gap-1 cursor-pointer rounded-r-lg transition-all duration-200 hover:bg-violet-50/50 hover:text-foreground hover:pl-5 hover:border-violet-300"
                          onClick={() => handleEventClick(null, g)}
                        >
                          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{g.title}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {selectedEvents.projs.length === 0 && selectedEvents.missions.length === 0 && selectedEvents.abs.length === 0 && Object.keys(selectedEvents.gcalByBranch).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8 font-medium">
                  <span className="text-2xl block mb-2">📭</span>
                  Rien de prevu
                </div>
              )}

              {/* Add section */}
              {isFuture && (
                <div className="pt-3 mt-3">
                  <Separator className="mb-3" />
                  <h3 className="text-[10px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wider">Ajouter</h3>
                  <div className="flex gap-1.5">
                    <button
                      className="flex-1 py-2.5 px-2 border border-border rounded-xl bg-card text-foreground font-bold text-[11px] cursor-pointer text-center transition-all duration-200 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 hover:-translate-y-0.5 hover:shadow-sm"
                      onClick={() => openAbsenceForm(dateStr)}
                    >
                      🌴<br /><span className="text-[10px]">Absence</span>
                    </button>
                    <button
                      className="flex-1 py-2.5 px-2 border border-border rounded-xl bg-card text-foreground font-bold text-[11px] cursor-pointer text-center transition-all duration-200 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 hover:-translate-y-0.5 hover:shadow-sm"
                      onClick={() => openProjForm(dateStr)}
                    >
                      🎬<br /><span className="text-[10px]">Projet</span>
                    </button>
                    <button
                      className="flex-1 py-2.5 px-2 border border-border rounded-xl bg-card text-foreground font-bold text-[11px] cursor-pointer text-center transition-all duration-200 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 hover:-translate-y-0.5 hover:shadow-sm"
                      onClick={() => openNoteForm(dateStr)}
                    >
                      📅<br /><span className="text-[10px]">Event</span>
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })()}
      </div>

      {/* ═══ MES ABSENCES ═══ */}
      {absences.length > 0 && (
        <section className="mb-5 animate-[fade-up_300ms_ease_0.25s_both]">
          <h2 className="text-sm font-black mb-3 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent tracking-tight">Mes absences</h2>
          <div className="flex flex-col gap-1.5">
            {absences.map((a, idx) => {
              const t = ABSENCE_TYPES.find((t) => t.value === a.type); const s = STATUT_LABELS[a.statut] || { label: a.statut, color: "#6b7280", bg: "transparent" };
              const canEdit = a.statut === "en_attente" && a.dateDebut >= today; const jours = countWorkDays(a.dateDebut, a.dateFin, a.demiJournee);
              return (
                <Card
                  key={String(a._id)}
                  className="flex-row items-center gap-3 py-3 px-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
                  style={{ borderLeftColor: t?.color || "#888", animationDelay: `${idx * 50}ms` }}
                >
                  <span className="text-2xl">{t?.icon || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-extrabold" style={{ color: t?.color }}>{t?.label}</span>
                      <Badge
                        variant="outline"
                        className="text-[8px] font-extrabold h-auto py-0.5 px-2 rounded-full"
                        style={{ background: s.bg, color: s.color, borderColor: "transparent" }}
                      >
                        {s.label}
                      </Badge>
                      <span className="text-[10px] font-semibold text-muted-foreground">{a.dateDebut === a.dateFin ? a.dateDebut : `${a.dateDebut} → ${a.dateFin}`}</span>
                      <Badge variant="outline" className="text-[8px] font-extrabold h-4 px-1.5 rounded-full bg-muted/50 text-muted-foreground border-transparent">{jours}j</Badge>
                    </div>
                    {a.commentaire && <p className="text-[9px] text-muted-foreground italic mt-1 mb-0">{a.commentaire}</p>}
                    {a.motifRefus && <p className="text-[9px] text-rose-700 mt-1 mb-0 font-medium">Motif : {a.motifRefus}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} className="text-muted-foreground hover:text-violet-600 hover:bg-violet-50 rounded-lg" title="Modifier">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(String(a._id))} className="text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Supprimer">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ MODALE — EventForm universel ═══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalType === "choose" ? "Ajouter" : modalType === "absence" ? (editId ? "Modifier" : "Absence") : modalType === "projet" ? "Projet" : modalType === "editGcal" ? "Modifier" : "Evenement"} size="sm">
        <EventForm
          key={`${modalType}-${editId || "new"}`}
          mode={modalType === "note" ? "event" : modalType || "choose"}
          initialData={{
            title: modalType === "editGcal" ? noteForm.contenu : modalType === "projet" ? projForm.nomContrat : noteForm.contenu || "",
            dateDebut: form.dateDebut || projForm.dateDebut || noteForm.dateDebut || "",
            dateFin: form.dateFin || projForm.dateFin || noteForm.dateDebut || "",
            heureDebut: noteForm.heureDebut || "09:00",
            heureFin: noteForm.heureFin || "10:00",
            allDay: noteForm.allDay ?? true,
            lieu: projForm.lieu || noteForm.lieu || "",
            branche: projForm.branche || "",
            clientNom: projForm.clientNom || "",
            absenceType: form.type || "",
            demiJournee: form.demiJournee || "",
            commentaire: form.commentaire || "",
            description: projForm.brief || "",
            gcalEditId: noteForm.gcalEditId || null,
          }}
          onSubmit={async (data) => {
            setSaving(true);
            if (data.mode === "absence") {
              const body = { type: data.absenceType, dateDebut: data.dateDebut, dateFin: data.dateFin, demiJournee: data.demiJournee || null, commentaire: data.commentaire };
              const url = editId ? `/api/employee-absences/${editId}` : "/api/employee-absences";
              const res = await fetch(url, { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              const result = await res.json(); setSaving(false); if (!res.ok) { alert(result.error || "Erreur"); return; }
              if (editId) setAbsences((prev) => prev.map((a) => (String(a._id) === editId ? result.item : a)));
              else {
                setAbsences((prev) => [result.item, ...prev]);
                const typeLabel = ABSENCE_TYPES.find((t) => t.value === data.absenceType)?.label || data.absenceType;
                const planningCal = gcalCalendars.find((c) => c.summary.toLowerCase().includes("planning"));
                try { await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: typeLabel, start: data.dateDebut, end: data.dateFin, allDay: true, calendarId: planningCal?.id, attendees: data.assignees || [] }) }); await refetchGcalEvents(); } catch {}
              }
            } else if (data.mode === "projet") {
              const body = { nomContrat: data.title, clientNom: data.clientNom, branche: data.branche, dateDebut: data.dateDebut, dateFin: data.dateFin, lieu: data.lieu, brief: data.description, statut: "En cours", assignees: data.assignees || [] };
              const res = await fetch("/api/contrats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              const result = await res.json(); setSaving(false); if (!res.ok) { alert(result.error || "Erreur"); return; }
              const np = normalizeProject(result.item || result); if (np.dateDebut && np.dateFin) setProjects((prev) => [...prev, np]);
              const branchCal = data.branche ? gcalCalendars.find((c) => c.summary.toLowerCase().includes(data.branche.toLowerCase())) : null;
              try { await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `🎬 ${data.title}`, start: data.dateDebut, end: data.dateFin, allDay: true, calendarId: branchCal?.id, attendees: data.assignees || [] }) }); await refetchGcalEvents(); } catch {}
            } else if (data.mode === "event") {
              const body = { title: data.title, allDay: data.allDay, start: data.allDay ? data.dateDebut : `${data.dateDebut}T${data.heureDebut}:00`, end: data.allDay ? data.dateDebut : `${data.dateDebut}T${data.heureFin}:00`, location: data.lieu, attendees: data.assignees || [], description: data.description, recurrence: data.recurrence || "none" };
              const res = await fetch("/api/planning/google-calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              const result = await res.json(); setSaving(false); if (!res.ok) { alert(result.error || "Erreur Google Agenda"); return; }
              if (result.item) setGcalEvents((prev) => [...prev, result.item]);
            } else if (data.mode === "editGcal") {
              const body = { title: data.title, start: data.allDay ? data.dateDebut : `${data.dateDebut}T${data.heureDebut}:00`, end: data.allDay ? data.dateDebut : `${data.dateDebut}T${data.heureFin}:00` };
              const res = await fetch(`/api/planning/google-calendar/${data.gcalEditId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              setSaving(false); if (!res.ok) { alert("Erreur modification"); return; }
              await refetchGcalEvents();
            }
            setSaving(false); setModalOpen(false);
          }}
          onDelete={modalType === "editGcal" ? () => { handleDeleteGcalEvent(noteForm.gcalEditId); setModalOpen(false); } : undefined}
          onBack={editId ? () => setModalOpen(false) : undefined}
          onCancel={() => setModalOpen(false)}
          saving={saving}
          absRecap={!editId ? absRecap : undefined}
          vibeMsg={!editId ? `${vibe.emoji} ${vibe.msg}` : undefined}
          soldeReste={solde.reste}
        />
      </Modal>

      {/* Shimmer keyframe for vibe bar */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
