"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Users, UserCheck, UserX, Briefcase, UserPlus, ChevronDown, ChevronLeft, ChevronRight,
  CalendarDays, LayoutGrid, Layers, AlertTriangle, ExternalLink, ArrowRight, Calendar, Zap, Eye, X,
} from "lucide-react";

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const JOURS_SHORT = ["D","L","M","M","J","V","S"];
const ABSENCE_META = {
  conge: { color: "#10b981", icon: "🌴", label: "Congé", bg: "bg-emerald-50/80", text: "text-emerald-600", border: "border-emerald-200/60" },
  tt: { color: "#8b5cf6", icon: "🏡", label: "Télétravail", bg: "bg-violet-50/80", text: "text-violet-600", border: "border-violet-200/60" },
  maladie: { color: "#f43f5e", icon: "🤧", label: "Maladie", bg: "bg-rose-50/80", text: "text-rose-600", border: "border-rose-200/60" },
  absence_autre: { color: "#f59e0b", icon: "—", label: "Autre absence", bg: "bg-amber-50/80", text: "text-amber-600", border: "border-amber-200/60" },
};
const DEFAULT_BRANCHES = [
  { key: "Agency", label: "Agency", color: "#e11d48", poles: ["Production Audiovisuelle"] },
  { key: "CreativeGen", label: "CreativeGen", color: "#7c3aed", poles: ["Production Audiovisuelle", "Scénographie"] },
  { key: "Entertainment", label: "Entertainment", color: "#0891b2", poles: ["Scénographie", "Atelier"] },
  { key: "SFX", label: "SFX", color: "#ca8a04", poles: ["FabLab", "Atelier"] },
  { key: "Atelier", label: "Atelier", color: "#059669", poles: ["Atelier", "FabLab"] },
  { key: "Communication", label: "Communication", color: "#0284c7", poles: ["Communication"] },
];
const BRANCH_COLORS_FALLBACK = { Agency: "#e11d48", CreativeGen: "#7c3aed", Entertainment: "#0891b2", SFX: "#ca8a04", Atelier: "#059669", Communication: "#0284c7", default: "#6b7280" };

function toYMD(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return toYMD(d); }

function generateMockData() {
  const profiles = [
    { _id: "m1", prenom: "Thomas", nom: "Bernard", pole: "Production Audiovisuelle", contrat: "CDI", isActive: true },
    { _id: "m2", prenom: "Marie", nom: "Dupont", pole: "Production Audiovisuelle", contrat: "CDI", isActive: true },
    { _id: "m3", prenom: "Lucas", nom: "Martin", pole: "Scénographie", contrat: "CDD", isActive: true },
    { _id: "m4", prenom: "Emma", nom: "Leroy", pole: "Scénographie", contrat: "CDI", isActive: true },
    { _id: "m5", prenom: "Hugo", nom: "Moreau", pole: "Communication", contrat: "CDI", isActive: true },
    { _id: "m6", prenom: "Léa", nom: "Simon", pole: "Communication", contrat: "Alternance", isActive: true },
    { _id: "m7", prenom: "Nathan", nom: "Laurent", pole: "Atelier", contrat: "CDI", isActive: true },
    { _id: "m8", prenom: "Chloé", nom: "Garcia", pole: "Atelier", contrat: "CDD", isActive: true },
    { _id: "m9", prenom: "Jules", nom: "Roux", pole: "FabLab", contrat: "CDI", isActive: true },
    { _id: "m10", prenom: "Alice", nom: "Petit", pole: "Administration", contrat: "CDI", isActive: true },
    { _id: "m11", prenom: "Raphaël", nom: "Blanc", pole: "Production Audiovisuelle", contrat: "CDD", isActive: true },
    { _id: "m12", prenom: "Camille", nom: "Faure", pole: "Scénographie", contrat: "CDI", isActive: true },
  ];
  const contrats = [
    { _id: "p1", nomContrat: "Festival Lumières", branche: "Entertainment", dateDebut: daysFromNow(-3), dateFin: daysFromNow(8), assignees: ["m1", "m3", "m4", "m7", "m8"] },
    { _id: "p2", nomContrat: "Clip Artiste X", branche: "CreativeGen", dateDebut: daysFromNow(-1), dateFin: daysFromNow(5), assignees: ["m1", "m2", "m11", "m9"] },
    { _id: "p3", nomContrat: "Campagne Été", branche: "Agency", dateDebut: daysFromNow(0), dateFin: daysFromNow(12), assignees: ["m5", "m6", "m1", "m10"] },
    { _id: "p4", nomContrat: "Expo Immersive", branche: "Entertainment", dateDebut: daysFromNow(2), dateFin: daysFromNow(14), assignees: ["m3", "m4", "m7", "m12"] },
    { _id: "p5", nomContrat: "Podcast Studio", branche: "CreativeGen", dateDebut: daysFromNow(-5), dateFin: daysFromNow(3), assignees: ["m2", "m11", "m1"] },
    { _id: "p6", nomContrat: "Décor Spectacle", branche: "SFX", dateDebut: daysFromNow(1), dateFin: daysFromNow(7), assignees: ["m7", "m8", "m9"] },
  ];
  const absences = [
    { _id: "a1", employeeProfileId: "m1", type: "conge", dateDebut: daysFromNow(2), dateFin: daysFromNow(4), statut: "valide" },
    { _id: "a2", employeeProfileId: "m5", type: "maladie", dateDebut: daysFromNow(0), dateFin: daysFromNow(2), statut: "valide" },
    { _id: "a3", employeeProfileId: "m6", type: "maladie", dateDebut: daysFromNow(0), dateFin: daysFromNow(1), statut: "valide" },
    { _id: "a4", employeeProfileId: "m3", type: "tt", dateDebut: daysFromNow(1), dateFin: daysFromNow(1), statut: "valide" },
    { _id: "a5", employeeProfileId: "m8", type: "conge", dateDebut: daysFromNow(3), dateFin: daysFromNow(6), statut: "valide" },
    { _id: "a6", employeeProfileId: "m12", type: "conge", dateDebut: daysFromNow(5), dateFin: daysFromNow(9), statut: "valide" },
    { _id: "a7", employeeProfileId: "m9", type: "absence_autre", dateDebut: daysFromNow(4), dateFin: daysFromNow(4), statut: "valide" },
    { _id: "a8", employeeProfileId: "m4", type: "conge", dateDebut: daysFromNow(7), dateFin: daysFromNow(10), statut: "valide" },
    { _id: "a9", employeeProfileId: "m2", type: "tt", dateDebut: daysFromNow(3), dateFin: daysFromNow(3), statut: "valide" },
    { _id: "a10", employeeProfileId: "m10", type: "conge", dateDebut: daysFromNow(6), dateFin: daysFromNow(8), statut: "en_attente" },
  ];
  return { profiles, contrats, absences };
}
function getBranchColor(br, db) { if (db?.length) { const f = db.find((b) => b.key === br); if (f) return f.color; } return BRANCH_COLORS_FALLBACK[br] || BRANCH_COLORS_FALLBACK.default; }
function getWeekNumber(d) { const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7)); return Math.ceil(((dt - new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7); }

export default function PlanningEquipePage() {
  const [profiles, setProfiles] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calDate, setCalDate] = useState(new Date());
  const [viewWeeks, setViewWeeks] = useState(2);
  const [filterPole, setFilterPole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState("branche");
  const [openGroups, setOpenGroups] = useState({});
  const [sheetEmployee, setSheetEmployee] = useState(null);
  const [sheetDate, setSheetDate] = useState(null);
  // (miniCalDate removed — replaced by horizontal calendar strip)
  const [focusDay, setFocusDay] = useState(() => toYMD(new Date()));
  const [selectedProject, setSelectedProject] = useState(null);

  const openSheet = useCallback((emp, date = null) => { setSheetEmployee(emp); setSheetDate(date); }, []);
  const closeSheet = useCallback(() => { setSheetEmployee(null); setSheetDate(null); }, []);

  useEffect(() => {
    (async () => {
      const [profRes, absRes, projRes] = await Promise.all([
        fetch("/api/employee-profiles", { cache: "no-store" }),
        fetch("/api/employee-absences?all=true", { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
      ]);
      const realProfiles = ((await profRes.json()).items || []).filter((p) => p.isActive !== false);
      const realAbsences = (await absRes.json()).items || [];
      const realContrats = (await projRes.json()).items || [];

      // Si pas de données réelles, injecter le mock pour preview UX
      if (realProfiles.length === 0) {
        const mock = generateMockData();
        setProfiles(mock.profiles);
        setAbsences(mock.absences);
        setContrats(mock.contrats);
      } else {
        setProfiles(realProfiles);
        setAbsences(realAbsences);
        setContrats(realContrats);
      }

      try { const r = await fetch("/api/branches", { cache: "no-store" }); if (r.ok) { const d = await r.json(); setBranches(d.items?.length ? d.items : DEFAULT_BRANCHES); } else setBranches(DEFAULT_BRANCHES); } catch { setBranches(DEFAULT_BRANCHES); }
      setLoading(false);
    })();
  }, []);

  const days = useMemo(() => {
    const d = new Date(calDate), day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff);
    return Array.from({ length: viewWeeks * 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(dd.getDate() + i); return dd; });
  }, [calDate, viewWeeks]);

  const periodLabel = useMemo(() => {
    if (!days.length) return "";
    const f = days[0], l = days[days.length - 1], w1 = getWeekNumber(f), w2 = getWeekNumber(l);
    return `S${w1}${w1 !== w2 ? `–${w2}` : ""} · ${f.getDate()} ${MOIS[f.getMonth()].slice(0, 3)} — ${l.getDate()} ${MOIS[l.getMonth()].slice(0, 3)} ${l.getFullYear()}`;
  }, [days]);

  const absMap = useMemo(() => {
    const map = {};
    for (const a of absences) { if (a.statut === "refuse") continue; const pid = a.employeeProfileId || a.userId; if (!map[pid]) map[pid] = {}; const d = new Date(a.dateDebut + "T12:00:00"), end = new Date(a.dateFin + "T12:00:00"); while (d <= end) { map[pid][toYMD(d)] = a; d.setDate(d.getDate() + 1); } }
    return map;
  }, [absences]);

  const projAssignMap = useMemo(() => {
    const map = {};
    for (const c of contrats) { if (!c.dateDebut || !c.dateFin) continue; const assignees = c.assignees || c.equipe || []; if (!assignees.length) continue; const d = new Date(c.dateDebut + "T12:00:00"), end = new Date(c.dateFin + "T12:00:00"); while (d <= end) { const key = toYMD(d); for (const aId of assignees) { const id = String(aId._id || aId.id || aId); if (!map[id]) map[id] = {}; if (!map[id][key]) map[id][key] = []; map[id][key].push(c); } d.setDate(d.getDate() + 1); } }
    return map;
  }, [contrats]);

  const today = toYMD(new Date());

  const filteredProfiles = useMemo(() => {
    let list = profiles;
    if (filterPole) list = list.filter((p) => p.pole === filterPole);
    if (filterStatus) { list = list.filter((p) => { const pid = String(p._id), abs = absMap[pid]?.[today], projs = projAssignMap[pid]?.[today] || [], isAbs = abs && abs.statut === "valide"; switch (filterStatus) { case "present": return !isAbs; case "absent": return isAbs; case "projet": return !isAbs && projs.length > 0; case "dispo": return !isAbs && projs.length === 0; default: return true; } }); }
    return list;
  }, [profiles, filterPole, filterStatus, absMap, projAssignMap, today]);

  const poles = useMemo(() => [...new Set(profiles.map((p) => p.pole).filter(Boolean))].sort(), [profiles]);

  const employeeGroups = useMemo(() => {
    const groups = {};
    for (const p of filteredProfiles) { const pole = p.pole || "Sans pôle"; if (!groups[pole]) { const branch = branches.find((b) => (b.poles || []).includes(pole)); groups[pole] = { key: pole, label: pole, color: branch?.color || "#6b7280", branchLabel: branch?.label || null, employees: [] }; } groups[pole].employees.push(p); }
    return Object.values(groups).sort((a, b) => b.employees.length - a.employees.length);
  }, [filteredProfiles, branches]);

  const todayStats = useMemo(() => {
    let present = 0, absent = 0, onProject = 0, available = 0;
    for (const p of profiles.filter((x) => x.isActive !== false)) { const pid = String(p._id), abs = absMap[pid]?.[today], projs = projAssignMap[pid]?.[today] || []; if (abs && abs.statut === "valide") absent++; else { present++; if (projs.length > 0) onProject++; else available++; } }
    return { present, absent, onProject, available, total: profiles.filter((x) => x.isActive !== false).length };
  }, [profiles, absMap, projAssignMap, today]);

  /* ── Computed: friction points ── */
  const friction = useMemo(() => {
    const overloads = []; // Employés surchargés
    const understaffed = []; // Jours sous-effectif
    const conflicts = []; // Conflits projet (membre absent pendant projet)
    const poleEmpty = []; // Pôle entier absent

    // 1. Surcharges — par employé, on garde le pire jour
    const seenOverload = {};
    for (const p of profiles) {
      const pid = String(p._id);
      let worst = 0, worstDate = "";
      for (const d of days) {
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const k = toYMD(d), cnt = (projAssignMap[pid]?.[k] || []).length;
        if (cnt >= 3 && cnt > worst) { worst = cnt; worstDate = k; }
      }
      if (worst >= 3) overloads.push({ emp: p, count: worst, date: worstDate });
    }

    // 2. Sous-effectif — jours < 60% présents
    for (const d of days) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const k = toYMD(d), absC = profiles.filter((p) => { const a = absMap[String(p._id)]?.[k]; return a && a.statut === "valide"; }).length;
      const ratio = profiles.length > 0 ? (profiles.length - absC) / profiles.length : 1;
      if (ratio < 0.6) understaffed.push({ date: k, present: profiles.length - absC, total: profiles.length, ratio });
    }

    // 3. Conflits projets — un membre absent pendant un projet actif
    const seenConflict = new Set();
    for (const c of contrats) {
      if (!c.dateDebut || !c.dateFin || c.dateFin < today) continue;
      const team = (c.assignees || []).map((a) => profiles.find((p) => String(p._id) === String(a))).filter(Boolean);
      for (const emp of team) {
        const pid = String(emp._id), ck = `${pid}:${String(c._id)}`;
        if (seenConflict.has(ck)) continue;
        const d = new Date(Math.max(new Date(c.dateDebut + "T12:00:00"), new Date(today + "T12:00:00")));
        const end = new Date(c.dateFin + "T12:00:00");
        while (d <= end) {
          if (d.getDay() !== 0 && d.getDay() !== 6) {
            const abs = absMap[pid]?.[toYMD(d)];
            if (abs && abs.statut === "valide") {
              seenConflict.add(ck);
              conflicts.push({ emp, project: c, date: toYMD(d), absType: abs.type, projectColor: getBranchColor(c.branche, branches) });
              break;
            }
          }
          d.setDate(d.getDate() + 1);
        }
      }
    }

    // 4. Pôle vide — tous les membres d'un pôle absents le même jour
    const allGroups = {};
    for (const p of profiles) { const pole = p.pole || "Sans pôle"; if (!allGroups[pole]) { const branch = branches.find((b) => (b.poles || []).includes(pole)); allGroups[pole] = { label: pole, color: branch?.color || "#6b7280", employees: [] }; } allGroups[pole].employees.push(p); }
    for (const [, group] of Object.entries(allGroups)) {
      if (group.employees.length < 2) continue;
      for (const d of days) {
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const k = toYMD(d), allAbsent = group.employees.every((e) => { const a = absMap[String(e._id)]?.[k]; return a && a.statut === "valide"; });
        if (allAbsent) { poleEmpty.push({ pole: group.label, color: group.color, date: k, count: group.employees.length }); break; }
      }
    }

    const total = overloads.length + understaffed.length + conflicts.length + poleEmpty.length;
    const score = total === 0 ? 100 : Math.max(0, 100 - overloads.length * 15 - understaffed.length * 10 - conflicts.length * 8 - poleEmpty.length * 20);
    return { overloads, understaffed, conflicts, poleEmpty, total, score };
  }, [profiles, projAssignMap, absMap, days, today, contrats, branches]);

  /* ── Calendar strip (horizontal, swipeable) ── */
  const stripRef = useRef(null);
  const calStrip = useMemo(() => {
    const result = [];
    const start = new Date(); start.setDate(start.getDate() - 30);
    const rS = days.length ? toYMD(days[0]) : "", rE = days.length ? toYMD(days[days.length - 1]) : "";
    for (let i = 0; i < 120; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = toYMD(d);
      let pC = 0, aC = 0;
      for (const p of profiles) { const pid = String(p._id); if (projAssignMap[pid]?.[key]?.length) pC++; const abs = absMap[pid]?.[key]; if (abs && abs.statut === "valide") aC++; }
      result.push({ date: d, key, projectCount: pC, absenceCount: aC, inRange: key >= rS && key <= rE, isNewMonth: i === 0 || d.getDate() === 1 });
    }
    return result;
  }, [profiles, projAssignMap, absMap, days]);

  // Auto-scroll strip to focused day
  useEffect(() => {
    if (!stripRef.current || !focusDay) return;
    const el = stripRef.current.querySelector(`[data-strip="${focusDay}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [focusDay]);

  /* Projects with health data */
  const projectsHealth = useMemo(() => {
    return contrats.filter((c) => c.dateDebut && c.dateFin && c.dateFin >= today).map((c) => {
      const bc = getBranchColor(c.branche, branches);
      const team = (c.assignees || []).map((a) => profiles.find((p) => String(p._id) === String(a))).filter(Boolean);
      let absentDays = 0, overloaded = 0;
      for (const emp of team) {
        const pid = String(emp._id);
        const d = new Date(c.dateDebut + "T12:00:00"), end = new Date(c.dateFin + "T12:00:00");
        let empAbsent = false, empOverloaded = false;
        while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) { const k = toYMD(d); const abs = absMap[pid]?.[k]; if (abs && abs.statut === "valide") empAbsent = true; if ((projAssignMap[pid]?.[k] || []).length >= 3) empOverloaded = true; } d.setDate(d.getDate() + 1); }
        if (empAbsent) absentDays++;
        if (empOverloaded) overloaded++;
      }
      return { ...c, color: bc, team, absentMembers: absentDays, overloadedMembers: overloaded, hasIssue: absentDays > 0 || overloaded > 0 };
    }).sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  }, [contrats, profiles, branches, absMap, projAssignMap, today]);

  /* Selected project detail */
  const selectedProjectDetail = useMemo(() => {
    if (!selectedProject) return null;
    const c = selectedProject;
    const teamStatus = c.team.map((emp) => {
      const pid = String(emp._id);
      const dayStatuses = [];
      const d = new Date(c.dateDebut + "T12:00:00"), end = new Date(c.dateFin + "T12:00:00");
      while (d <= end) {
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          const k = toYMD(d), abs = absMap[pid]?.[k], projs = projAssignMap[pid]?.[k] || [];
          dayStatuses.push({ date: k, absent: abs && abs.statut === "valide", absType: abs?.type, projCount: projs.length });
        }
        d.setDate(d.getDate() + 1);
      }
      return { emp, days: dayStatuses, hasAbsence: dayStatuses.some((s) => s.absent), isOverloaded: dayStatuses.some((s) => s.projCount >= 3) };
    });
    return { teamStatus };
  }, [selectedProject, absMap, projAssignMap]);

  const sheetData = useMemo(() => {
    if (!sheetEmployee) return null;
    const pid = String(sheetEmployee._id);
    let daysOnProject = 0, daysAbsent = 0, daysFree = 0; const periodProjects = {};
    for (const d of days) { if (d.getDay() === 0 || d.getDay() === 6) continue; const key = toYMD(d), abs = absMap[pid]?.[key], projs = projAssignMap[pid]?.[key] || []; if (abs && abs.statut === "valide") daysAbsent++; else if (projs.length > 0) { daysOnProject++; for (const proj of projs) periodProjects[String(proj._id)] = proj; } else daysFree++; }
    const workDays = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;
    let dayDetail = null;
    if (sheetDate) { const abs = absMap[pid]?.[sheetDate], projs = projAssignMap[pid]?.[sheetDate] || []; dayDetail = { date: sheetDate, abs, projs, isAbsent: abs && abs.statut === "valide" }; }
    const upcoming = absences.filter((a) => (a.employeeProfileId === pid || a.userId === pid) && a.statut === "valide" && a.dateFin >= today).sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)).slice(0, 3);
    return { daysOnProject, daysAbsent, daysFree, workDays, periodProjects: Object.values(periodProjects), dayDetail, upcoming };
  }, [sheetEmployee, days, absMap, projAssignMap, absences, sheetDate, today]);

  const navPrev = useCallback(() => { if (viewMode === "jour") setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); else setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() - viewWeeks * 7); return n; }); }, [viewMode, viewWeeks]);
  const navNext = useCallback(() => { if (viewMode === "jour") setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); else setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() + viewWeeks * 7); return n; }); }, [viewMode, viewWeeks]);

  function getCellData(pid, dateStr) { const projs = projAssignMap[pid]?.[dateStr] || [], abs = absMap[pid]?.[dateStr]; return { projs, abs, projCount: projs.length, isAbsent: abs && abs.statut === "valide", isPending: abs && abs.statut === "en_attente", isOverloaded: projs.length >= 3 }; }
  const isGroupOpen = (key) => openGroups[key] !== false;
  const gridCols = `164px repeat(${days.length}, minmax(24px, 1fr))`;

  if (loading) return (
    <div className="p-6 max-w-[1800px] mx-auto flex gap-5 animate-in fade-in duration-300">
      <div className="w-[272px] flex-shrink-0 space-y-3"><div className="h-52 rounded-lg bg-muted animate-pulse" /><div className="h-40 rounded-lg bg-muted animate-pulse" /></div>
      <div className="flex-1 space-y-3"><div className="h-10 rounded-lg bg-muted animate-pulse" /><div className="h-[500px] rounded-lg bg-muted animate-pulse" /></div>
    </div>
  );

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground !bg-none !text-foreground" style={{ background: "none", WebkitTextFillColor: "unset" }}>Planning Équipe</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">{filteredProfiles.length} membre{filteredProfiles.length > 1 ? "s" : ""} · {contrats.filter((c) => c.dateDebut && c.dateFin).length} projets</p>
        </div>
        {viewMode !== "jour" && <span className="text-[13px] font-medium text-muted-foreground">{periodLabel}</span>}
      </div>

      {/* ── STAT + ALERTS ── */}
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
        {[
          { key: "present", label: "Présents", value: todayStats.present, color: "text-emerald-600", icon: UserCheck },
          { key: "absent", label: "Absents", value: todayStats.absent, color: "text-rose-500", icon: UserX },
          { key: "projet", label: "En projet", value: todayStats.onProject, color: "text-violet-600", icon: Briefcase },
          { key: "dispo", label: "Disponibles", value: todayStats.available, color: "text-sky-600", icon: UserPlus },
        ].map(({ key, label, value, color, icon: Ic }) => (
          <button key={key} onClick={() => setFilterStatus((s) => s === key ? "" : key)}
            className={cn("flex items-center gap-2 flex-1 px-3 py-2 rounded-md text-left transition-all", filterStatus === key ? "bg-accent shadow-sm" : "hover:bg-accent/50")}>
            <Ic className={cn("w-4 h-4", color)} strokeWidth={1.8} />
            <span className={cn("text-lg font-bold tabular-nums leading-none", color)}>{value}</span>
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      {friction.total > 0 && (
        <div className={cn("flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] font-medium", friction.score >= 70 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            {friction.total} point{friction.total > 1 ? "s" : ""} de friction
            {friction.overloads.length > 0 && ` · ${friction.overloads.length} surcharge${friction.overloads.length > 1 ? "s" : ""}`}
            {friction.understaffed.length > 0 && ` · ${friction.understaffed.length}j sous-effectif`}
            {friction.conflicts.length > 0 && ` · ${friction.conflicts.length} conflit${friction.conflicts.length > 1 ? "s" : ""}`}
          </span>
          <span className="ml-auto text-[11px] font-bold tabular-nums">Score {friction.score}/100</span>
        </div>
      )}

      {/* ── CONTROLS ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border bg-card p-0.5">
          {[{ key: "branche", icon: Layers, label: "Branche" }, { key: "projet", icon: LayoutGrid, label: "Projet" }, { key: "jour", icon: CalendarDays, label: "Jour" }].map(({ key, icon: Ic, label }) => (
            <button key={key} onClick={() => { setViewMode(key); closeSheet(); }} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all", viewMode === key ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Ic className="w-3.5 h-3.5" />{label}</button>
          ))}
        </div>
        <select value={filterPole} onChange={(e) => setFilterPole(e.target.value)} className="text-xs font-medium px-2.5 py-1.5 rounded-md border bg-card text-foreground cursor-pointer">
          <option value="">Tous les pôles</option>
          {poles.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {viewMode !== "jour" && <div className="flex rounded-md border bg-card p-0.5">
          {[{ w: 1, l: "1S" }, { w: 2, l: "2S" }, { w: 4, l: "1M" }].map(({ w, l }) => <button key={w} onClick={() => setViewWeeks(w)} className={cn("px-2 py-1 rounded text-xs font-medium transition-all", viewWeeks === w ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
        </div>}
        <div className="flex-1" />
        {filterStatus && <button onClick={() => setFilterStatus("")} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">Réinitialiser ✕</button>}
        <div className="flex items-center gap-0.5">
          <button onClick={() => { navPrev(); setFocusDay(""); }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { setCalDate(new Date()); setFocusDay(toYMD(new Date())); }} className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">Aujourd&apos;hui</button>
          <button onClick={() => { navNext(); setFocusDay(""); }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ── CALENDAR STRIP (swipeable) ── */}
      <div className="rounded-lg border bg-card">
        <div
          ref={stripRef}
          className="flex overflow-x-auto py-1.5 px-1 gap-px"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {calStrip.map((day) => {
            const isWE = day.date.getDay() === 0 || day.date.getDay() === 6;
            const isFocus = day.key === focusDay;
            const isT = day.key === today;
            return (
              <React.Fragment key={day.key}>
                {day.isNewMonth && (
                  <div className="flex items-center px-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold text-violet-500 whitespace-nowrap -rotate-0">{MOIS[day.date.getMonth()].slice(0, 3)}</span>
                  </div>
                )}
                <button
                  data-strip={day.key}
                  onClick={() => { setCalDate(new Date(day.date)); setFocusDay(day.key); }}
                  className={cn(
                    "flex flex-col items-center w-9 py-1 rounded-md flex-shrink-0 transition-all",
                    isFocus && "bg-violet-600 text-white shadow-sm",
                    !isFocus && day.inRange && "bg-violet-50",
                    isT && !isFocus && "ring-1 ring-violet-400 font-bold",
                    !isFocus && !day.inRange && "hover:bg-accent/50",
                    isWE && !isFocus && !day.inRange && "opacity-35",
                  )}
                >
                  <span className={cn("text-[9px] font-medium", isFocus ? "text-violet-200" : "text-muted-foreground")}>{JOURS_SHORT[day.date.getDay()]}</span>
                  <span className={cn("text-[13px] font-bold tabular-nums leading-tight", isFocus ? "text-white" : isT ? "text-violet-600" : "text-foreground")}>{day.date.getDate()}</span>
                  {(day.projectCount > 0 || day.absenceCount > 0) && (
                    <div className="flex gap-[2px] mt-0.5 h-[5px] items-center">
                      {day.projectCount > 0 && <span className={cn("w-[4px] h-[4px] rounded-full", isFocus ? "bg-violet-200" : "bg-violet-500")} />}
                      {day.absenceCount > 0 && <span className={cn("w-[4px] h-[4px] rounded-full", isFocus ? "bg-rose-200" : "bg-rose-400")} />}
                    </div>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DEUX COLONNES : SIDEBAR + MAIN
          ══════════════════════════════════════════════ */}
      <div className="flex gap-4 items-start">

        {/* ── SIDEBAR ── */}
        <div className="w-[272px] flex-shrink-0 space-y-3 hidden lg:block">

          {/* (mini calendar moved to horizontal strip above) */}

          {/* Santé de l'équipe */}
          {friction.total > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Santé équipe</div>
                <div className={cn("text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded", friction.score >= 80 ? "bg-emerald-50 text-emerald-600" : friction.score >= 50 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600")}>{friction.score}/100</div>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {/* Surcharges */}
                {friction.overloads.length > 0 && (
                  <div className="px-3 py-1.5 border-t">
                    <div className="text-[10px] font-semibold text-rose-600 mb-1 flex items-center gap-1"><Zap className="w-3 h-3" />Surcharges ({friction.overloads.length})</div>
                    {friction.overloads.map((o, i) => (
                      <button key={i} onClick={() => { setFocusDay(o.date); setCalDate(new Date(o.date + "T12:00:00")); openSheet(o.emp, o.date); }}
                        className="flex items-center gap-2 w-full text-left py-1 px-1 rounded hover:bg-accent/50 transition-colors cursor-pointer">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold bg-rose-100 text-rose-600">{o.count}</span>
                        <span className="text-[11px] font-medium text-foreground truncate">{o.emp.prenom} {o.emp.nom?.[0]}.</span>
                        <span className="text-[9px] text-muted-foreground ml-auto">{new Date(o.date + "T12:00:00").getDate()} {MOIS[new Date(o.date + "T12:00:00").getMonth()].slice(0, 3)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Sous-effectif */}
                {friction.understaffed.length > 0 && (
                  <div className="px-3 py-1.5 border-t">
                    <div className="text-[10px] font-semibold text-amber-600 mb-1 flex items-center gap-1"><Users className="w-3 h-3" />Sous-effectif ({friction.understaffed.length}j)</div>
                    {friction.understaffed.slice(0, 5).map((u, i) => {
                      const dt = new Date(u.date + "T12:00:00");
                      return (
                        <button key={i} onClick={() => { setFocusDay(u.date); setCalDate(new Date(u.date + "T12:00:00")); }}
                          className="flex items-center gap-2 w-full text-left py-1 px-1 rounded hover:bg-accent/50 transition-colors cursor-pointer">
                          <span className={cn("text-[11px] font-medium", u.ratio < 0.4 ? "text-rose-600" : "text-amber-600")}>{u.present}/{u.total}</span>
                          <span className="text-[11px] text-foreground">{JOURS[dt.getDay()].slice(0, 3)} {dt.getDate()} {MOIS[dt.getMonth()].slice(0, 3)}</span>
                          <div className="ml-auto w-8 h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${u.ratio * 100}%`, backgroundColor: u.ratio < 0.4 ? "#f43f5e" : "#f59e0b" }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Conflits projets */}
                {friction.conflicts.length > 0 && (
                  <div className="px-3 py-1.5 border-t">
                    <div className="text-[10px] font-semibold text-violet-600 mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" />Conflits ({friction.conflicts.length})</div>
                    {friction.conflicts.slice(0, 5).map((c, i) => {
                      const meta = ABSENCE_META[c.absType] || ABSENCE_META.absence_autre;
                      return (
                        <button key={i} onClick={() => { setFocusDay(c.date); setCalDate(new Date(c.date + "T12:00:00")); openSheet(c.emp, c.date); }}
                          className="flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-accent/50 transition-colors cursor-pointer">
                          <span className="text-xs">{meta.icon}</span>
                          <span className="text-[11px] font-medium text-foreground truncate">{c.emp.prenom} {c.emp.nom?.[0]}.</span>
                          <span className="text-[9px] text-muted-foreground truncate">sur {c.project.nomContrat || c.project.nom}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Pôle vide */}
                {friction.poleEmpty.length > 0 && (
                  <div className="px-3 py-1.5 border-t">
                    <div className="text-[10px] font-semibold text-rose-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Pôle vide</div>
                    {friction.poleEmpty.map((pe, i) => {
                      const dt = new Date(pe.date + "T12:00:00");
                      return (
                        <button key={i} onClick={() => { setFocusDay(pe.date); setCalDate(new Date(pe.date + "T12:00:00")); }}
                          className="flex items-center gap-2 w-full text-left py-1 px-1 rounded hover:bg-accent/50 transition-colors cursor-pointer">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pe.color }} />
                          <span className="text-[11px] font-medium text-foreground">{pe.pole}</span>
                          <span className="text-[9px] text-muted-foreground ml-auto">{JOURS[dt.getDay()].slice(0, 3)} {dt.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Project List / Detail */}
          <div className="rounded-lg border bg-card">
            {selectedProject ? (
              /* ── Project Detail ── */
              <div className="p-3 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProject.color }} />
                      <span className="text-[13px] font-semibold text-foreground">{selectedProject.nomContrat || selectedProject.nom}</span>
                    </div>
                    <div className="text-[11px] font-medium mt-0.5" style={{ color: selectedProject.color }}>{selectedProject.branche}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{selectedProject.dateDebut} → {selectedProject.dateFin}</div>
                  </div>
                  <button onClick={() => setSelectedProject(null)} className="p-1 rounded hover:bg-accent text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>

                {selectedProject.hasIssue && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-[10px] font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    {selectedProject.absentMembers > 0 && `${selectedProject.absentMembers} absent${selectedProject.absentMembers > 1 ? "s" : ""}`}
                    {selectedProject.absentMembers > 0 && selectedProject.overloadedMembers > 0 && " · "}
                    {selectedProject.overloadedMembers > 0 && `${selectedProject.overloadedMembers} surchargé${selectedProject.overloadedMembers > 1 ? "s" : ""}`}
                  </div>
                )}

                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Équipe ({selectedProject.team.length})</div>
                {selectedProjectDetail?.teamStatus.map(({ emp, days: dStat, hasAbsence, isOverloaded }) => (
                  <button key={String(emp._id)} onClick={() => openSheet(emp)} className="flex items-center gap-2 w-full text-left p-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0" style={{ backgroundColor: `${selectedProject.color}18`, color: selectedProject.color }}>{(emp.prenom || "?")[0]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground truncate">{emp.prenom} {emp.nom?.[0]}.</div>
                      {/* Mini availability bar */}
                      <div className="flex gap-px mt-0.5">
                        {dStat.slice(0, 15).map((s, j) => (
                          <div key={j} className={cn("w-2 h-1 rounded-[1px]",
                            s.absent ? "bg-rose-400" : s.projCount >= 3 ? "bg-amber-400" : "bg-emerald-400"
                          )} title={`${s.date}: ${s.absent ? "absent" : s.projCount + "p"}`} />
                        ))}
                      </div>
                    </div>
                    {(hasAbsence || isOverloaded) && <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />}
                  </button>
                ))}

                <Link href={`/projets/${String(selectedProject._id)}`} className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border">
                  Voir le projet <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              /* ── Project List ── */
              <div>
                <div className="px-3 pt-3 pb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Projets actifs ({projectsHealth.length})</div>
                <div className="max-h-[320px] overflow-y-auto">
                  {projectsHealth.map((c) => (
                    <button key={String(c._id)} onClick={() => setSelectedProject(c)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent/40 transition-colors border-b last:border-b-0 cursor-pointer">
                      <span className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-foreground truncate">{c.nomContrat || c.nom}</div>
                        <div className="text-[10px] text-muted-foreground">{c.team.length} membre{c.team.length > 1 ? "s" : ""} · {new Date(c.dateDebut + "T12:00:00").getDate()} {MOIS[new Date(c.dateDebut + "T12:00:00").getMonth()].slice(0, 3)} → {new Date(c.dateFin + "T12:00:00").getDate()} {MOIS[new Date(c.dateFin + "T12:00:00").getMonth()].slice(0, 3)}</div>
                      </div>
                      {c.hasIssue && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />}
                    </button>
                  ))}
                  {projectsHealth.length === 0 && <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">Aucun projet actif</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* VUE: PAR BRANCHE */}
          {viewMode === "branche" && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="grid sticky top-0 z-20 bg-card border-b" style={{ gridTemplateColumns: gridCols }}>
                <div className="sticky left-0 z-30 bg-card px-3 py-2 border-r text-[11px] font-medium text-muted-foreground">Équipe</div>
                {days.map((d) => { const key = toYMD(d), isT = key === today, isFocus = key === focusDay, isWE = d.getDay() === 0 || d.getDay() === 6;
                  return <div key={key} className={cn("text-center py-1.5 select-none", isFocus && "bg-violet-100", isT && !isFocus && "bg-violet-50/60", isWE && !isFocus && "bg-muted/30")}>
                    <div className={cn("text-[9px] font-medium", isFocus ? "text-violet-600" : isWE ? "text-muted-foreground/40" : "text-muted-foreground")}>{JOURS_SHORT[d.getDay()]}</div>
                    <div className={cn("text-[11px] font-semibold", isFocus ? "text-violet-700" : isT ? "text-violet-600" : isWE ? "text-muted-foreground/40" : "text-foreground")}>{d.getDate()}</div>
                    {d.getDate() === 1 && <div className="text-[8px] font-medium text-violet-500">{MOIS[d.getMonth()].slice(0, 3)}</div>}
                  </div>;
                })}
              </div>
              <div className="grid border-b bg-muted/10" style={{ gridTemplateColumns: gridCols }}>
                <div className="sticky left-0 z-10 bg-muted/10 px-3 py-0.5 border-r text-[10px] font-medium text-muted-foreground">Charge</div>
                {days.map((d) => { const key = toYMD(d), isWE = d.getDay() === 0 || d.getDay() === 6, absC = filteredProfiles.filter((p) => { const a = absMap[String(p._id)]?.[key]; return a && a.statut === "valide"; }).length, presC = filteredProfiles.length - absC, ratio = filteredProfiles.length > 0 ? presC / filteredProfiles.length : 1;
                  return <div key={key} className={cn("text-center py-0.5 text-[9px] font-medium tabular-nums", isWE && "opacity-20", !isWE && ratio < 0.5 && "text-rose-500", !isWE && ratio >= 0.5 && ratio < 0.75 && "text-amber-500", !isWE && ratio >= 0.75 && "text-muted-foreground")}>{presC}/{filteredProfiles.length}</div>;
                })}
              </div>
              {employeeGroups.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun membre</div>}
              {employeeGroups.map((group) => {
                const gP = group.employees.filter((e) => { const a = absMap[String(e._id)]?.[today]; return !(a && a.statut === "valide"); }).length;
                return (
                  <Collapsible key={group.key} open={isGroupOpen(group.key)} onOpenChange={(o) => setOpenGroups((p) => ({ ...p, [group.key]: o }))}>
                    <CollapsibleTrigger className="flex items-center w-full px-3 py-1.5 border-b bg-muted/5 hover:bg-muted/20 transition-colors cursor-pointer gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="text-[13px] font-semibold text-foreground">{group.label}</span>
                      <span className="text-[11px] text-muted-foreground">{group.employees.length}</span>
                      <div className="flex items-center gap-1 ml-1.5">
                        <div className="w-10 h-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${group.employees.length > 0 ? (gP / group.employees.length) * 100 : 0}%`, backgroundColor: gP / group.employees.length >= 0.75 ? "#10b981" : gP / group.employees.length >= 0.5 ? "#f59e0b" : "#f43f5e" }} /></div>
                        <span className="text-[9px] font-medium text-muted-foreground tabular-nums">{gP}/{group.employees.length}</span>
                      </div>
                      <ChevronDown className={cn("ml-auto w-3.5 h-3.5 text-muted-foreground transition-transform duration-150", isGroupOpen(group.key) ? "" : "-rotate-90")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {group.employees.map((emp) => { const pid = String(emp._id);
                        return (
                          <div key={pid} className="grid border-b last:border-b-0 group/row hover:bg-accent/30 transition-colors" style={{ gridTemplateColumns: gridCols }}>
                            <button onClick={() => openSheet(emp)} className="sticky left-0 z-10 bg-card group-hover/row:bg-accent/30 flex items-center gap-2 px-3 py-1 border-r text-left transition-colors cursor-pointer">
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ backgroundColor: `${group.color}18`, color: group.color }}>{(emp.prenom || "?")[0].toUpperCase()}</span>
                              <div className="min-w-0"><div className="text-[12px] font-medium text-foreground truncate">{emp.prenom} {emp.nom?.[0]}.</div><div className="text-[10px] text-muted-foreground truncate">{emp.contrat || "—"}</div></div>
                            </button>
                            {days.map((d) => { const key = toYMD(d), isWE = d.getDay() === 0 || d.getDay() === 6, isT = key === today, isFocus = key === focusDay, { projs, abs, projCount, isAbsent, isPending, isOverloaded } = getCellData(pid, key);
                              let cls = "h-8 flex items-center justify-center text-[10px] font-medium cursor-pointer transition-all select-none", content = null, style = {};
                              if (isWE && !isFocus) cls += " bg-muted/20";
                              else if (isAbsent) { const m = ABSENCE_META[abs.type] || ABSENCE_META.absence_autre; style = { backgroundColor: isFocus ? `${m.color}25` : `${m.color}12` }; content = <span className="text-xs leading-none">{m.icon}</span>; }
                              else if (isPending) { cls += " bg-amber-50/40 text-amber-500"; content = "?"; }
                              else if (projCount > 0) { const bc = getBranchColor(projs[0]?.branche, branches); style = { backgroundColor: isFocus ? `${bc}18` : `${bc}0c` }; content = projCount > 1 ? <span className="text-[9px]" style={{ color: bc }}>{projCount}</span> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bc }} />; if (isOverloaded) cls += " ring-1 ring-inset ring-rose-300"; }
                              else if (isFocus) { cls += " bg-violet-50"; }
                              if (isFocus) cls += " border-b-2 border-violet-500";
                              else if (isT) cls += " border-b-2 border-violet-400/50";
                              return <div key={key} className={cls} style={style} onClick={() => { openSheet(emp, key); setFocusDay(key); }}>{content}</div>;
                            })}
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* VUE: PAR PROJET */}
          {viewMode === "projet" && (() => {
            const active = contrats.filter((c) => c.dateDebut && c.dateFin), fStr = toYMD(days[0]), lStr = toYMD(days[days.length - 1]);
            const visible = active.filter((c) => c.dateFin >= fStr && c.dateDebut <= lStr);
            const pCols = `192px repeat(${days.length}, minmax(24px, 1fr))`;
            return (
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="grid border-b bg-muted/10" style={{ gridTemplateColumns: pCols }}>
                  <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground border-r">Projet</div>
                  {days.map((d) => { const key = toYMD(d), isT = key === today, isWE = d.getDay() === 0 || d.getDay() === 6;
                    return <div key={key} className={cn("text-center py-1.5 text-[9px] font-medium", isT ? "text-violet-600 bg-violet-50/60" : "text-muted-foreground", isWE && "opacity-20")}><div>{JOURS_SHORT[d.getDay()]}</div><div className="text-[11px] font-semibold">{d.getDate()}</div></div>;
                  })}
                </div>
                {visible.map((c) => { const bc = getBranchColor(c.branche, branches), ap = (c.assignees || []).map((a) => profiles.find((p) => String(p._id) === String(a) || p.email === String(a))).filter(Boolean);
                  return (
                    <div key={String(c._id)} className="grid border-b last:border-b-0 hover:bg-accent/20 transition-colors" style={{ gridTemplateColumns: pCols }}>
                      <Link href={`/projets/${String(c._id)}`} className="flex flex-col gap-0.5 px-3 py-2 border-r group/proj" style={{ borderLeftWidth: 3, borderLeftColor: bc }}>
                        <span className="text-[12px] font-medium text-foreground group-hover/proj:text-violet-600 truncate transition-colors">{c.nomContrat || c.nom}</span>
                        <span className="text-[10px] font-medium" style={{ color: bc }}>{c.branche}</span>
                        {ap.length > 0 && <div className="flex -space-x-1 mt-0.5">{ap.slice(0, 4).map((p, i) => <button key={i} onClick={(e) => { e.preventDefault(); openSheet(p); }} className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-semibold ring-1 ring-card hover:ring-violet-300 transition-all" style={{ backgroundColor: bc }}>{(p.prenom || "?")[0]}</button>)}{ap.length > 4 && <span className="ml-1.5 text-[9px] text-muted-foreground self-center">+{ap.length - 4}</span>}</div>}
                      </Link>
                      {days.map((d) => { const key = toYMD(d), inR = key >= c.dateDebut && key <= c.dateFin, isF = key === c.dateDebut, isL = key === c.dateFin, isWE = d.getDay() === 0 || d.getDay() === 6;
                        if (!inR) return <div key={key} className={cn("h-11", isWE && "bg-muted/10")} />;
                        return <div key={key} className="h-11" style={{ backgroundColor: `${bc}0c`, borderTop: `2px solid ${bc}`, borderBottom: `2px solid ${bc}`, borderLeft: isF ? `2px solid ${bc}` : "none", borderRight: isL ? `2px solid ${bc}` : "none", borderRadius: isF && isL ? "4px" : isF ? "4px 0 0 4px" : isL ? "0 4px 4px 0" : "0" }} />;
                      })}
                    </div>
                  );
                })}
                {visible.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun projet sur cette période</div>}
              </div>
            );
          })()}

          {/* VUE: JOUR */}
          {viewMode === "jour" && (() => {
            const fd = toYMD(calDate), fDay = calDate, absentT = [], onProjT = [], availT = [], projT = {};
            for (const p of filteredProfiles) { const pid = String(p._id), abs = absMap[pid]?.[fd], projs = projAssignMap[pid]?.[fd] || []; if (abs && abs.statut === "valide") absentT.push({ ...p, absence: abs }); else if (projs.length > 0) { onProjT.push({ ...p, projects: projs }); for (const proj of projs) { const k = String(proj._id); if (!projT[k]) projT[k] = { ...proj, members: [] }; projT[k].members.push(p); } } else availT.push(p); }
            const pList = Object.values(projT);
            return (
              <div className="space-y-5">
                <div><div className="text-lg font-semibold text-foreground">{JOURS[fDay.getDay()]} {fDay.getDate()} {MOIS[fDay.getMonth()]} {fDay.getFullYear()}</div><p className="text-[13px] text-muted-foreground">{filteredProfiles.length} membres</p></div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-rose-500" /><span className="text-lg font-bold text-rose-500 tabular-nums">{absentT.length}</span><span className="text-[13px] text-muted-foreground">absents</span></div>
                  <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-violet-600" /><span className="text-lg font-bold text-violet-600 tabular-nums">{onProjT.length}</span><span className="text-[13px] text-muted-foreground">en projet</span></div>
                  <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-emerald-600" /><span className="text-lg font-bold text-emerald-600 tabular-nums">{availT.length}</span><span className="text-[13px] text-muted-foreground">disponibles</span></div>
                </div>
                {pList.length > 0 && <div className="space-y-2"><div className="text-[13px] font-medium text-muted-foreground">Projets du jour</div>
                  {pList.map((proj) => { const bc = getBranchColor(proj.branche, branches), absMem = proj.members.filter((m) => { const a = absMap[String(m._id)]?.[fd]; return a && a.statut === "valide"; });
                    return <div key={String(proj._id)} className="rounded-lg border bg-card p-3"><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: bc }} /><Link href={`/projets/${String(proj._id)}`} className="text-[13px] font-medium text-foreground hover:text-violet-600 transition-colors">{proj.nomContrat || proj.nom}</Link><span className="text-[11px] font-medium" style={{ color: bc }}>{proj.branche}</span></div>
                      <div className="flex flex-wrap gap-1">{proj.members.map((m) => { const isAbs = absMem.some((a) => String(a._id) === String(m._id)); return <button key={String(m._id)} onClick={() => openSheet(m, fd)} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:ring-1 hover:ring-violet-300 transition-all", isAbs ? "bg-rose-50 text-rose-500 line-through" : "bg-muted text-foreground")}><span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-semibold" style={{ backgroundColor: isAbs ? "#f43f5e" : bc }}>{(m.prenom || "?")[0]}</span>{m.prenom} {m.nom?.[0]}.</button>; })}</div>
                      {absMem.length > 0 && <div className="mt-1.5 text-[10px] font-medium text-rose-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{absMem.length} absent{absMem.length > 1 ? "s" : ""}</div>}
                    </div>;
                  })}
                </div>}
                {absentT.length > 0 && <div className="space-y-2"><div className="text-[13px] font-medium text-muted-foreground">Absents</div><div className="flex flex-wrap gap-1.5">{absentT.map((emp) => { const meta = ABSENCE_META[emp.absence?.type] || ABSENCE_META.absence_autre; return <button key={String(emp._id)} onClick={() => openSheet(emp, fd)} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer hover:shadow-sm transition-colors", meta.bg, meta.border)}><span className="text-sm leading-none">{meta.icon}</span><span className="text-[12px] font-medium text-foreground">{emp.prenom} {emp.nom?.[0]}.</span></button>; })}</div></div>}
                {availT.length > 0 && <div className="space-y-2"><div className="text-[13px] font-medium text-muted-foreground">Disponibles</div><div className="flex flex-wrap gap-1.5">{availT.map((emp) => <button key={String(emp._id)} onClick={() => openSheet(emp, fd)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50/50 border border-emerald-100/60 hover:border-emerald-200 transition-all cursor-pointer"><span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold bg-emerald-500">{(emp.prenom || "?")[0]}</span><span className="text-[12px] font-medium text-foreground">{emp.prenom} {emp.nom?.[0]}.</span></button>)}</div></div>}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── SHEET EMPLOYÉ ── */}
      <Sheet open={!!sheetEmployee} onOpenChange={(o) => { if (!o) closeSheet(); }}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px] overflow-y-auto">
          {sheetEmployee && sheetData && (() => { const emp = sheetEmployee, pid = String(emp._id), group = employeeGroups.find((g) => g.employees.some((e) => String(e._id) === pid)), gc = group?.color || "#6b7280";
            return (<>
              <SheetHeader className="pb-0"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: `${gc}18`, color: gc }}>{(emp.prenom || "?")[0].toUpperCase()}</span><div><SheetTitle className="text-[15px]">{emp.prenom} {emp.nom}</SheetTitle><SheetDescription className="text-[12px]">{emp.pole || "—"} · {emp.contrat || "—"}</SheetDescription></div></div></SheetHeader>
              <div className="px-4 pb-4 space-y-4 mt-1">
                <div><div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Période</div><div className="flex gap-px h-2 rounded-full overflow-hidden bg-muted">{sheetData.workDays > 0 && <><div className="bg-violet-500" style={{ width: `${(sheetData.daysOnProject / sheetData.workDays) * 100}%` }} /><div className="bg-rose-400" style={{ width: `${(sheetData.daysAbsent / sheetData.workDays) * 100}%` }} /><div className="bg-emerald-400" style={{ width: `${(sheetData.daysFree / sheetData.workDays) * 100}%` }} /></>}</div>
                  <div className="flex gap-3 mt-1 text-[10px] font-medium text-muted-foreground"><span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" />{sheetData.daysOnProject}j projet</span><span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{sheetData.daysAbsent}j absent</span><span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{sheetData.daysFree}j dispo</span></div></div>
                {sheetData.dayDetail && (() => { const dd = sheetData.dayDetail, dt = new Date(dd.date + "T12:00:00");
                  return <div><div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{JOURS[dt.getDay()]} {dt.getDate()} {MOIS[dt.getMonth()]}</div>
                    {dd.isAbsent && dd.abs && (() => { const meta = ABSENCE_META[dd.abs.type] || ABSENCE_META.absence_autre; return <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md", meta.bg)}><span className="text-base">{meta.icon}</span><span className={cn("text-[13px] font-medium", meta.text)}>{meta.label}</span></div>; })()}
                    {dd.projs.length > 0 && <div className="space-y-1">{dd.projs.map((c, i) => { const bc = getBranchColor(c.branche, branches); return <Link key={i} href={`/projets/${String(c._id)}`} className="flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-accent transition-all" style={{ borderLeft: `2px solid ${bc}` }}><span className="text-[12px] font-medium text-foreground">{c.nomContrat || c.nom}</span><span className="text-[10px] font-medium" style={{ color: bc }}>{c.branche}</span></Link>; })}</div>}
                    {!dd.isAbsent && dd.projs.length === 0 && <div className="px-3 py-2 rounded-md bg-emerald-50/60 text-emerald-600 text-[13px] font-medium">Disponible</div>}
                  </div>; })()}
                {sheetData.periodProjects.length > 0 && <div><div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Projets ({sheetData.periodProjects.length})</div><div className="space-y-1">{sheetData.periodProjects.map((c) => { const bc = getBranchColor(c.branche, branches); return <Link key={String(c._id)} href={`/projets/${String(c._id)}`} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-all group/p"><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: bc }} /><span className="text-[12px] font-medium text-foreground flex-1 truncate">{c.nomContrat || c.nom}</span><ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover/p:opacity-100 transition-opacity" /></Link>; })}</div></div>}
                {sheetData.upcoming.length > 0 && <div><div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Absences à venir</div>{sheetData.upcoming.map((a, i) => { const meta = ABSENCE_META[a.type] || ABSENCE_META.absence_autre, s = new Date(a.dateDebut + "T12:00:00"), e = new Date(a.dateFin + "T12:00:00"); return <div key={i} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px]", meta.bg)}><span>{meta.icon}</span><span className="font-medium">{s.getDate()} {MOIS[s.getMonth()].slice(0, 3)}</span>{a.dateDebut !== a.dateFin && <><span className="text-muted-foreground">→</span><span className="font-medium">{e.getDate()} {MOIS[e.getMonth()].slice(0, 3)}</span></>}<span className={cn("ml-auto text-[10px] font-medium", meta.text)}>{meta.label}</span></div>; })}</div>}
                <Link href={`/rh/employe/${pid}`} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border text-[13px] font-medium text-foreground hover:bg-accent transition-colors">Voir la fiche complète <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>
            </>);
          })()}
        </SheetContent>
      </Sheet>

      {/* ── LEGEND ── */}
      <div className="flex flex-wrap gap-3 text-[10px] font-medium text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border" /> Dispo</span>
        <span className="flex items-center gap-1">🌴 Congé</span>
        <span className="flex items-center gap-1">🏡 TT</span>
        <span className="flex items-center gap-1">🤧 Maladie</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Projet</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm ring-1 ring-rose-300" /> 3+</span>
      </div>
    </div>
  );
}
