"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Users,
  UserCheck,
  UserX,
  Briefcase,
  UserPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Layers,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  Calendar,
  Clock,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const JOURS_SHORT = ["D", "L", "M", "M", "J", "V", "S"];

const ABSENCE_META = {
  conge: { color: "#10b981", icon: "🌴", label: "Congé", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  tt: { color: "#8b5cf6", icon: "🏡", label: "Télétravail", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  maladie: { color: "#f43f5e", icon: "🤧", label: "Maladie", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  absence_autre: { color: "#f59e0b", icon: "—", label: "Autre absence", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

const DEFAULT_BRANCHES = [
  { key: "Agency", label: "Agency", color: "#e11d48", poles: ["Production Audiovisuelle"] },
  { key: "CreativeGen", label: "CreativeGen", color: "#7c3aed", poles: ["Production Audiovisuelle", "Scénographie"] },
  { key: "Entertainment", label: "Entertainment", color: "#0891b2", poles: ["Scénographie", "Atelier"] },
  { key: "SFX", label: "SFX", color: "#ca8a04", poles: ["FabLab", "Atelier"] },
  { key: "Atelier", label: "Atelier", color: "#059669", poles: ["Atelier", "FabLab"] },
  { key: "Communication", label: "Communication", color: "#0284c7", poles: ["Communication"] },
];

const BRANCH_COLORS_FALLBACK = {
  Agency: "#e11d48", CreativeGen: "#7c3aed", Entertainment: "#0891b2",
  SFX: "#ca8a04", Atelier: "#059669", Communication: "#0284c7", default: "#6b7280",
};

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getBranchColor(branche, branchesDb) {
  if (branchesDb?.length) {
    const found = branchesDb.find((b) => b.key === branche);
    if (found) return found.color;
  }
  return BRANCH_COLORS_FALLBACK[branche] || BRANCH_COLORS_FALLBACK.default;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/* ═══════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════ */

function StatCard({ icon: Icon, label, value, total, colorClass, iconBg, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 text-left transition-all hover:shadow-md cursor-pointer w-full",
        active ? "ring-2 ring-violet-400 shadow-md border-violet-200" : "border-border hover:border-border/80"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={cn("text-3xl font-black mt-0.5 tracking-tight", colorClass)}>{value}</p>
          {total !== undefined && (
            <p className="text-[10px] text-muted-foreground mt-0.5">sur {total}</p>
          )}
        </div>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-sm", iconBg)}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */

export default function PlanningEquipePage() {
  /* ── State ── */
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

  // Sheet state — replaces old selectedCell
  const [sheetEmployee, setSheetEmployee] = useState(null);
  const [sheetDate, setSheetDate] = useState(null);

  // Mini calendar
  const [showMiniCal, setShowMiniCal] = useState(false);
  const [miniCalDate, setMiniCalDate] = useState(() => new Date());

  const openSheet = useCallback((emp, date = null) => {
    setSheetEmployee(emp);
    setSheetDate(date);
  }, []);
  const closeSheet = useCallback(() => {
    setSheetEmployee(null);
    setSheetDate(null);
  }, []);

  /* ── Data fetching ── */
  useEffect(() => {
    (async () => {
      const [profRes, absRes, projRes] = await Promise.all([
        fetch("/api/employee-profiles", { cache: "no-store" }),
        fetch("/api/employee-absences?all=true", { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
      ]);
      const profData = await profRes.json();
      setProfiles((profData.items || []).filter((p) => p.isActive !== false));
      const absData = await absRes.json();
      setAbsences(absData.items || []);
      const projData = await projRes.json();
      setContrats(projData.items || []);

      try {
        const brRes = await fetch("/api/branches", { cache: "no-store" });
        if (brRes.ok) {
          const brData = await brRes.json();
          if (brData.items?.length) { setBranches(brData.items); }
          else { setBranches(DEFAULT_BRANCHES); }
        } else { setBranches(DEFAULT_BRANCHES); }
      } catch { setBranches(DEFAULT_BRANCHES); }

      setLoading(false);
    })();
  }, []);

  /* ── Computed: days ── */
  const days = useMemo(() => {
    const d = new Date(calDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    return Array.from({ length: viewWeeks * 7 }, (_, i) => {
      const dd = new Date(mon);
      dd.setDate(dd.getDate() + i);
      return dd;
    });
  }, [calDate, viewWeeks]);

  /* ── Computed: period label ── */
  const periodLabel = useMemo(() => {
    if (!days.length) return "";
    const first = days[0];
    const last = days[days.length - 1];
    const w1 = getWeekNumber(first);
    const w2 = getWeekNumber(last);
    const weekPart = w1 === w2 ? `Sem. ${w1}` : `Sem. ${w1}–${w2}`;
    const firstStr = `${first.getDate()} ${MOIS[first.getMonth()].slice(0, 3)}`;
    const lastStr = `${last.getDate()} ${MOIS[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
    return `${weekPart} · ${firstStr} — ${lastStr}`;
  }, [days]);

  /* ── Computed: absence map ── */
  const absMap = useMemo(() => {
    const map = {};
    for (const a of absences) {
      if (a.statut === "refuse") continue;
      const pid = a.employeeProfileId || a.userId;
      if (!map[pid]) map[pid] = {};
      const d = new Date(a.dateDebut + "T12:00:00");
      const end = new Date(a.dateFin + "T12:00:00");
      while (d <= end) {
        map[pid][toYMD(d)] = a;
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [absences]);

  /* ── Computed: project assignment map ── */
  const projAssignMap = useMemo(() => {
    const map = {};
    for (const c of contrats) {
      if (!c.dateDebut || !c.dateFin) continue;
      const assignees = c.assignees || c.equipe || [];
      if (assignees.length === 0) continue;
      const d = new Date(c.dateDebut + "T12:00:00");
      const end = new Date(c.dateFin + "T12:00:00");
      while (d <= end) {
        const key = toYMD(d);
        for (const aId of assignees) {
          const id = String(aId._id || aId.id || aId);
          if (!map[id]) map[id] = {};
          if (!map[id][key]) map[id][key] = [];
          map[id][key].push(c);
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [contrats]);

  const today = toYMD(new Date());

  /* ── Computed: filtered profiles ── */
  const filteredProfiles = useMemo(() => {
    let list = profiles;
    if (filterPole) list = list.filter((p) => p.pole === filterPole);
    if (filterStatus) {
      list = list.filter((p) => {
        const pid = String(p._id);
        const abs = absMap[pid]?.[today];
        const projs = projAssignMap[pid]?.[today] || [];
        const isAbsent = abs && abs.statut === "valide";
        switch (filterStatus) {
          case "present": return !isAbsent;
          case "absent": return isAbsent;
          case "projet": return !isAbsent && projs.length > 0;
          case "dispo": return !isAbsent && projs.length === 0;
          default: return true;
        }
      });
    }
    return list;
  }, [profiles, filterPole, filterStatus, absMap, projAssignMap, today]);

  const poles = useMemo(
    () => [...new Set(profiles.map((p) => p.pole).filter(Boolean))].sort(),
    [profiles]
  );

  /* ── Computed: employee groups ── */
  const employeeGroups = useMemo(() => {
    const groups = {};
    for (const p of filteredProfiles) {
      const pole = p.pole || "Sans pôle";
      if (!groups[pole]) {
        const branch = branches.find((b) => (b.poles || []).includes(pole));
        groups[pole] = {
          key: pole,
          label: pole,
          color: branch?.color || "#6b7280",
          branchLabel: branch?.label || null,
          employees: [],
        };
      }
      groups[pole].employees.push(p);
    }
    return Object.values(groups).sort((a, b) => b.employees.length - a.employees.length);
  }, [filteredProfiles, branches]);

  /* ── Computed: today stats ── */
  const todayStats = useMemo(() => {
    let present = 0, absent = 0, onProject = 0, available = 0;
    for (const p of profiles.filter((x) => x.isActive !== false)) {
      const pid = String(p._id);
      const abs = absMap[pid]?.[today];
      const projs = projAssignMap[pid]?.[today] || [];
      if (abs && abs.statut === "valide") { absent++; }
      else {
        present++;
        if (projs.length > 0) onProject++;
        else available++;
      }
    }
    return { present, absent, onProject, available, total: profiles.filter((x) => x.isActive !== false).length };
  }, [profiles, absMap, projAssignMap, today]);

  /* ── Computed: CEO alerts ── */
  const alerts = useMemo(() => {
    const items = [];
    // Overloaded employees today
    for (const p of profiles) {
      const pid = String(p._id);
      const projs = projAssignMap[pid]?.[today] || [];
      if (projs.length >= 3) {
        items.push({ type: "overload", emp: p, count: projs.length });
      }
    }
    // Under-staffed days in period
    for (const d of days) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const key = toYMD(d);
      const absentCount = profiles.filter((p) => {
        const a = absMap[String(p._id)]?.[key];
        return a && a.statut === "valide";
      }).length;
      const ratio = profiles.length > 0 ? (profiles.length - absentCount) / profiles.length : 1;
      if (ratio < 0.5) {
        items.push({ type: "understaffed", date: key, day: d, present: profiles.length - absentCount, total: profiles.length });
      }
    }
    return items;
  }, [profiles, projAssignMap, absMap, today, days]);

  /* ── Computed: mini calendar days ── */
  const miniCalDays = useMemo(() => {
    const year = miniCalDate.getFullYear();
    const month = miniCalDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDow = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const startDate = new Date(firstOfMonth);
    startDate.setDate(startDate.getDate() - startDow);

    const rangeStart = days.length > 0 ? toYMD(days[0]) : "";
    const rangeEnd = days.length > 0 ? toYMD(days[days.length - 1]) : "";

    const result = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = toYMD(d);
      const inMonth = d.getMonth() === month;

      let projectCount = 0;
      let absenceCount = 0;
      if (inMonth) {
        for (const p of profiles) {
          const pid = String(p._id);
          if (projAssignMap[pid]?.[key]?.length > 0) projectCount++;
          const abs = absMap[pid]?.[key];
          if (abs && abs.statut === "valide") absenceCount++;
        }
      }

      const isDeadline = contrats.some((c) => c.dateDebut === key || c.dateFin === key);
      const inRange = key >= rangeStart && key <= rangeEnd;

      result.push({ date: d, key, inMonth, projectCount, absenceCount, isDeadline, inRange });
    }
    return result;
  }, [miniCalDate, profiles, projAssignMap, absMap, contrats, days]);

  /* ── Computed: Sheet employee data ── */
  const sheetData = useMemo(() => {
    if (!sheetEmployee) return null;
    const pid = String(sheetEmployee._id);

    // Period summary
    let daysOnProject = 0, daysAbsent = 0, daysFree = 0;
    const periodProjects = {};
    for (const d of days) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const key = toYMD(d);
      const abs = absMap[pid]?.[key];
      const projs = projAssignMap[pid]?.[key] || [];
      if (abs && abs.statut === "valide") {
        daysAbsent++;
      } else if (projs.length > 0) {
        daysOnProject++;
        for (const proj of projs) {
          periodProjects[String(proj._id)] = proj;
        }
      } else {
        daysFree++;
      }
    }
    const workDays = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;

    // Selected day detail
    let dayDetail = null;
    if (sheetDate) {
      const abs = absMap[pid]?.[sheetDate];
      const projs = projAssignMap[pid]?.[sheetDate] || [];
      dayDetail = { date: sheetDate, abs, projs, isAbsent: abs && abs.statut === "valide" };
    }

    // Upcoming absences
    const upcoming = absences
      .filter((a) => (a.employeeProfileId === pid || a.userId === pid) && a.statut === "valide" && a.dateFin >= today)
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .slice(0, 3);

    return {
      daysOnProject,
      daysAbsent,
      daysFree,
      workDays,
      periodProjects: Object.values(periodProjects),
      dayDetail,
      upcoming,
    };
  }, [sheetEmployee, days, absMap, projAssignMap, absences, sheetDate, today]);

  /* ── Navigation ── */
  const navPrev = useCallback(() => {
    if (viewMode === "jour") {
      setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
    } else {
      setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() - viewWeeks * 7); return n; });
    }
  }, [viewMode, viewWeeks]);

  const navNext = useCallback(() => {
    if (viewMode === "jour") {
      setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
    } else {
      setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() + viewWeeks * 7); return n; });
    }
  }, [viewMode, viewWeeks]);

  /* ── Cell data helper ── */
  function getCellData(profileId, dateStr) {
    const projs = projAssignMap[profileId]?.[dateStr] || [];
    const abs = absMap[profileId]?.[dateStr];
    return {
      projs, abs,
      projCount: projs.length,
      isAbsent: abs && abs.statut === "valide",
      isPending: abs && abs.statut === "en_attente",
      isOverloaded: projs.length >= 3,
    };
  }

  const isGroupOpen = (key) => openGroups[key] !== false;
  const gridCols = `180px repeat(${days.length}, minmax(28px, 1fr))`;

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="p-6 max-w-[1800px] mx-auto space-y-4">
        <div className="h-8 w-56 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-6 max-w-[1800px] mx-auto space-y-5">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <div className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-600 to-rose-600 bg-clip-text text-transparent">
            Planning Équipe
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredProfiles.length} membre{filteredProfiles.length > 1 ? "s" : ""} · {contrats.filter((c) => c.dateDebut && c.dateFin).length} projets actifs
          </p>
        </div>
        {/* Period label + mini cal toggle */}
        <div className="flex items-center gap-2">
          {viewMode !== "jour" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Calendar className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-bold text-foreground">{periodLabel}</span>
            </div>
          )}
          <button
            onClick={() => { setShowMiniCal((v) => !v); setMiniCalDate(new Date(calDate)); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
              showMiniCal
                ? "bg-violet-50 border-violet-200 text-violet-700"
                : "bg-background border-border text-muted-foreground hover:border-violet-300 hover:text-violet-600"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mini-cal</span>
          </button>
        </div>
      </div>

      {/* ═══ DASHBOARD MACROS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={UserCheck} label="Présents" value={todayStats.present} total={todayStats.total}
          colorClass="text-emerald-600" iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
          active={filterStatus === "present"}
          onClick={() => setFilterStatus((s) => s === "present" ? "" : "present")}
        />
        <StatCard
          icon={UserX} label="Absents" value={todayStats.absent} total={todayStats.total}
          colorClass="text-rose-600" iconBg="bg-gradient-to-br from-rose-500 to-rose-600"
          active={filterStatus === "absent"}
          onClick={() => setFilterStatus((s) => s === "absent" ? "" : "absent")}
        />
        <StatCard
          icon={Briefcase} label="Sur projet" value={todayStats.onProject}
          colorClass="text-violet-600" iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
          active={filterStatus === "projet"}
          onClick={() => setFilterStatus((s) => s === "projet" ? "" : "projet")}
        />
        <StatCard
          icon={UserPlus} label="Disponibles" value={todayStats.available}
          colorClass="text-sky-600" iconBg="bg-gradient-to-br from-sky-500 to-sky-600"
          active={filterStatus === "dispo"}
          onClick={() => setFilterStatus((s) => s === "dispo" ? "" : "dispo")}
        />
      </div>

      {/* ═══ CEO ALERTS ═══ */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.slice(0, 5).map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold",
                a.type === "overload"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              )}
            >
              {a.type === "overload" ? (
                <>
                  <Zap className="w-3 h-3" />
                  {a.emp.prenom} {a.emp.nom?.[0]}. — {a.count} projets
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  {new Date(a.date + "T12:00:00").getDate()} {MOIS[new Date(a.date + "T12:00:00").getMonth()].slice(0, 3)} — {a.present}/{a.total} présents
                </>
              )}
            </div>
          ))}
          {alerts.length > 5 && (
            <span className="text-[10px] font-semibold text-muted-foreground self-center">
              +{alerts.length - 5} alertes
            </span>
          )}
        </div>
      )}

      {/* ═══ MINI CALENDAR ═══ */}
      {showMiniCal && (
        <div className="rounded-xl border bg-background p-4 max-w-xs">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMiniCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground">
              {MOIS[miniCalDate.getMonth()]} {miniCalDate.getFullYear()}
            </span>
            <button
              onClick={() => setMiniCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} className="text-center text-[9px] font-bold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {miniCalDays.map((day, i) => {
              const isToday = day.key === today;
              const isWE = day.date.getDay() === 0 || day.date.getDay() === 6;
              const hasHeavyActivity = day.projectCount >= 3;

              return (
                <button
                  key={i}
                  onClick={() => {
                    setCalDate(new Date(day.date));
                    if (viewMode === "jour") setShowMiniCal(false);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    !day.inMonth && "opacity-20",
                    day.inMonth && !day.inRange && "text-foreground hover:bg-muted",
                    day.inRange && "bg-violet-50 text-violet-700",
                    isToday && "ring-1 ring-violet-500 text-violet-600 font-black",
                    isWE && day.inMonth && !day.inRange && "text-muted-foreground",
                    hasHeavyActivity && day.inMonth && "bg-violet-100",
                  )}
                >
                  {day.date.getDate()}
                  {/* Activity dots */}
                  {day.inMonth && (
                    <div className="flex gap-[2px] mt-[1px] h-[5px] items-center">
                      {day.projectCount > 0 && <span className="w-[4px] h-[4px] rounded-full bg-violet-500" />}
                      {day.absenceCount > 0 && <span className="w-[4px] h-[4px] rounded-full bg-rose-400" />}
                      {day.isDeadline && <span className="w-[4px] h-[4px] rounded-full bg-amber-500" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-3 pt-2 border-t">
            <span className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
              <span className="w-[5px] h-[5px] rounded-full bg-violet-500" /> Projets
            </span>
            <span className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
              <span className="w-[5px] h-[5px] rounded-full bg-rose-400" /> Absences
            </span>
            <span className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
              <span className="w-[5px] h-[5px] rounded-full bg-amber-500" /> Deadline
            </span>
          </div>
        </div>
      )}

      {/* ═══ CONTROLS ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View mode */}
        <div className="flex bg-muted/60 rounded-lg p-0.5">
          {[
            { key: "branche", icon: Layers, label: "Par branche" },
            { key: "projet", icon: LayoutGrid, label: "Par projet" },
            { key: "jour", icon: CalendarDays, label: "Vue du jour" },
          ].map(({ key, icon: Ic, label }) => (
            <button
              key={key}
              onClick={() => { setViewMode(key); closeSheet(); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                viewMode === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Ic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Pole filter */}
        <select
          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border bg-background text-foreground cursor-pointer hover:border-violet-300 transition-colors"
          value={filterPole}
          onChange={(e) => setFilterPole(e.target.value)}
        >
          <option value="">Tous les pôles</option>
          {poles.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Week range */}
        {viewMode !== "jour" && (
          <div className="flex bg-muted/60 rounded-lg p-0.5">
            {[
              { w: 1, label: "1 sem" },
              { w: 2, label: "2 sem" },
              { w: 4, label: "1 mois" },
            ].map(({ w, label }) => (
              <button
                key={w}
                onClick={() => setViewWeeks(w)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold transition-all",
                  viewWeeks === w
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {filterStatus && (
          <button
            onClick={() => setFilterStatus("")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
          >
            Filtre actif
            <span className="ml-0.5">✕</span>
          </button>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={navPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:border-violet-300 hover:text-violet-600 text-muted-foreground transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCalDate(new Date())} className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:border-violet-300 hover:text-violet-600 transition-all">
            Aujourd&apos;hui
          </button>
          <button onClick={navNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:border-violet-300 hover:text-violet-600 text-muted-foreground transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          VIEW: PAR BRANCHE
          ═══════════════════════════════════════════ */}
      {viewMode === "branche" && (
        <div className="rounded-xl border overflow-hidden bg-background">
          {/* Day headers */}
          <div className="grid sticky top-0 z-20 bg-background border-b" style={{ gridTemplateColumns: gridCols }}>
            <div className="sticky left-0 z-30 bg-background px-3 py-2 flex items-center border-r">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="ml-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Équipe</span>
            </div>
            {days.map((d) => {
              const key = toYMD(d);
              const isToday = key === today;
              const isWE = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={key} className={cn("text-center py-1.5 px-0.5 select-none", isToday && "bg-violet-50", isWE && "bg-muted/40")}>
                  <div className="text-[8px] font-bold text-muted-foreground uppercase">{JOURS_SHORT[d.getDay()]}</div>
                  <div className={cn("text-xs font-black", isToday ? "text-violet-600" : "text-foreground")}>{d.getDate()}</div>
                  {d.getDate() === 1 && <div className="text-[7px] font-bold text-violet-500">{MOIS[d.getMonth()].slice(0, 3)}</div>}
                </div>
              );
            })}
          </div>

          {/* Charge row */}
          <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: gridCols }}>
            <div className="sticky left-0 z-10 bg-muted/20 px-3 py-1 flex items-center border-r">
              <span className="text-[10px] font-bold text-muted-foreground">Charge</span>
            </div>
            {days.map((d) => {
              const key = toYMD(d);
              const isWE = d.getDay() === 0 || d.getDay() === 6;
              const absentCount = filteredProfiles.filter((p) => { const a = absMap[String(p._id)]?.[key]; return a && a.statut === "valide"; }).length;
              const presentCount = filteredProfiles.length - absentCount;
              const ratio = filteredProfiles.length > 0 ? presentCount / filteredProfiles.length : 1;
              return (
                <div key={key} className={cn("text-center py-1 text-[9px] font-bold", isWE && "opacity-30", !isWE && ratio < 0.5 && "text-rose-600 bg-rose-50", !isWE && ratio >= 0.5 && ratio < 0.75 && "text-amber-600 bg-amber-50", !isWE && ratio >= 0.75 && "text-muted-foreground")}>
                  {presentCount}/{filteredProfiles.length}
                </div>
              );
            })}
          </div>

          {/* Employee groups */}
          {employeeGroups.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun membre trouvé</div>
          )}
          {employeeGroups.map((group) => {
            // Group-level stats for the period
            const groupPresent = group.employees.filter((e) => {
              const a = absMap[String(e._id)]?.[today];
              return !(a && a.statut === "valide");
            }).length;
            const groupTotal = group.employees.length;

            return (
              <Collapsible
                key={group.key}
                open={isGroupOpen(group.key)}
                onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.key]: open }))}
              >
                <CollapsibleTrigger className="flex items-center w-full px-3 py-2 border-b hover:bg-muted/30 transition-colors cursor-pointer">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="ml-2 text-sm font-bold text-foreground">{group.label}</span>
                  {group.branchLabel && group.branchLabel !== group.label && (
                    <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">({group.branchLabel})</span>
                  )}
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{groupTotal}</Badge>

                  {/* Mini presence bar */}
                  <div className="ml-3 flex items-center gap-1.5">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${groupTotal > 0 ? (groupPresent / groupTotal) * 100 : 0}%`,
                          backgroundColor: groupPresent / groupTotal >= 0.75 ? "#10b981" : groupPresent / groupTotal >= 0.5 ? "#f59e0b" : "#f43f5e",
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground">{groupPresent}/{groupTotal}</span>
                  </div>

                  <ChevronDown className={cn("ml-auto w-4 h-4 text-muted-foreground transition-transform duration-200", isGroupOpen(group.key) ? "rotate-0" : "-rotate-90")} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {group.employees.map((emp) => {
                    const pid = String(emp._id);
                    return (
                      <div key={pid} className="grid border-b last:border-b-0 hover:bg-muted/10 transition-colors" style={{ gridTemplateColumns: gridCols }}>
                        {/* Name cell — opens Sheet instead of navigating */}
                        <button
                          onClick={() => openSheet(emp)}
                          className="sticky left-0 z-10 bg-background flex items-center gap-2 px-3 py-1 border-r min-w-0 text-left cursor-pointer hover:bg-violet-50/50 transition-colors group/emp"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${group.color}, ${group.color}dd)` }}
                          >
                            {(emp.prenom || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate group-hover/emp:text-violet-600 transition-colors">
                              {emp.prenom} {emp.nom?.[0]}.
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">{emp.contrat || "—"}</div>
                          </div>
                        </button>

                        {/* Day cells — opens Sheet with date context */}
                        {days.map((d) => {
                          const key = toYMD(d);
                          const isWE = d.getDay() === 0 || d.getDay() === 6;
                          const isToday = key === today;
                          const { projs, abs, projCount, isAbsent, isPending, isOverloaded } = getCellData(pid, key);

                          let cellClass = "h-8 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all select-none relative";
                          let cellContent = null;
                          let cellStyle = {};
                          let cellTitle = "Disponible";

                          if (isWE) {
                            cellClass += " bg-muted/30";
                            cellTitle = "Week-end";
                          } else if (isAbsent) {
                            const meta = ABSENCE_META[abs.type] || ABSENCE_META.absence_autre;
                            cellStyle = { backgroundColor: `${meta.color}20` };
                            cellContent = <span className="text-sm leading-none">{meta.icon}</span>;
                            cellTitle = `${meta.label} (validé)`;
                          } else if (isPending) {
                            cellClass += " border border-dashed border-amber-300 bg-amber-50/60 text-amber-600";
                            cellContent = "?";
                            cellTitle = `${ABSENCE_META[abs.type]?.label || "Absence"} (en attente)`;
                          } else if (projCount > 0) {
                            const bc = getBranchColor(projs[0]?.branche, branches);
                            cellStyle = { backgroundColor: `${bc}15`, borderLeft: `3px solid ${bc}` };
                            cellContent = projCount > 1 ? <span style={{ color: bc }}>{projCount}</span> : null;
                            cellTitle = projs.map((c) => c.nomContrat || c.nom).join(", ");
                            if (isOverloaded) {
                              cellClass += " ring-2 ring-rose-400/60";
                              cellStyle.backgroundColor = `${bc}20`;
                            }
                          } else {
                            cellClass += " bg-emerald-50/40";
                          }

                          if (isToday) cellClass += " ring-1 ring-inset ring-violet-300/50";

                          return (
                            <div
                              key={key}
                              className={cellClass}
                              style={cellStyle}
                              title={cellTitle}
                              onClick={() => openSheet(emp, key)}
                            >
                              {cellContent}
                            </div>
                          );
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

      {/* ═══════════════════════════════════════════
          VIEW: PAR PROJET
          ═══════════════════════════════════════════ */}
      {viewMode === "projet" && (() => {
        const activeContrats = contrats.filter((c) => c.dateDebut && c.dateFin);
        const firstStr = toYMD(days[0]);
        const lastStr = toYMD(days[days.length - 1]);
        const visibleProjects = activeContrats.filter((c) => c.dateFin >= firstStr && c.dateDebut <= lastStr);
        const projGridCols = `220px repeat(${days.length}, minmax(28px, 1fr))`;

        return (
          <div className="rounded-xl border overflow-hidden bg-background">
            <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: projGridCols }}>
              <div className="px-3 py-2 font-bold text-[10px] text-muted-foreground uppercase tracking-wider border-r">Projet</div>
              {days.map((d) => {
                const key = toYMD(d);
                const isToday = key === today;
                const isWE = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={key} className={cn("text-center py-1.5 text-[9px] font-bold", isToday ? "text-violet-600 bg-violet-50" : "text-muted-foreground", isWE && "opacity-30")}>
                    <div>{JOURS_SHORT[d.getDay()]}</div>
                    <div className="text-xs font-black">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {visibleProjects.map((c) => {
              const bc = getBranchColor(c.branche, branches);
              const assignees = c.assignees || [];
              const assigneeProfiles = assignees
                .map((a) => profiles.find((p) => String(p._id) === String(a) || p.email === String(a)))
                .filter(Boolean);

              return (
                <div key={String(c._id)} className="grid border-b last:border-b-0 hover:bg-muted/10 transition-colors" style={{ gridTemplateColumns: projGridCols }}>
                  <Link href={`/projets/${String(c._id)}`} className="flex flex-col gap-1 px-3 py-2 border-r group/proj" style={{ borderLeftWidth: 4, borderLeftColor: bc }}>
                    <span className="text-xs font-bold text-foreground group-hover/proj:text-violet-600 truncate transition-colors">{c.nomContrat || c.nom}</span>
                    <span className="text-[10px] font-semibold" style={{ color: bc }}>{c.branche}</span>
                    {assigneeProfiles.length > 0 && (
                      <div className="flex -space-x-1.5 mt-0.5">
                        {assigneeProfiles.slice(0, 5).map((p, i) => (
                          <button key={i} onClick={(e) => { e.preventDefault(); openSheet(p); }} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold ring-2 ring-background hover:ring-violet-300 transition-all cursor-pointer" style={{ backgroundColor: bc }} title={`${p.prenom} ${p.nom}`}>
                            {(p.prenom || "?")[0]}
                          </button>
                        ))}
                        {assigneeProfiles.length > 5 && <span className="ml-2 text-[9px] font-bold text-muted-foreground self-center">+{assigneeProfiles.length - 5}</span>}
                      </div>
                    )}
                  </Link>
                  {days.map((d) => {
                    const key = toYMD(d);
                    const inRange = key >= c.dateDebut && key <= c.dateFin;
                    const isFirst = key === c.dateDebut;
                    const isLast = key === c.dateFin;
                    const isWE = d.getDay() === 0 || d.getDay() === 6;
                    if (!inRange) return <div key={key} className={cn("h-12", isWE && "bg-muted/20")} />;
                    return (
                      <div key={key} className="h-12" style={{
                        backgroundColor: `${bc}15`, borderTop: `2px solid ${bc}`, borderBottom: `2px solid ${bc}`,
                        borderLeft: isFirst ? `2px solid ${bc}` : "none", borderRight: isLast ? `2px solid ${bc}` : "none",
                        borderRadius: isFirst && isLast ? "6px" : isFirst ? "6px 0 0 6px" : isLast ? "0 6px 6px 0" : "0",
                      }} />
                    );
                  })}
                </div>
              );
            })}
            {visibleProjects.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun projet sur cette période</div>}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════
          VIEW: VUE DU JOUR
          ═══════════════════════════════════════════ */}
      {viewMode === "jour" && (() => {
        const focusDate = toYMD(calDate);
        const focusDay = calDate;
        const absentToday = [], onProjectToday = [], availableToday = [];
        const projectsToday = {};

        for (const p of filteredProfiles) {
          const pid = String(p._id);
          const abs = absMap[pid]?.[focusDate];
          const projs = projAssignMap[pid]?.[focusDate] || [];
          if (abs && abs.statut === "valide") {
            absentToday.push({ ...p, absence: abs });
          } else if (projs.length > 0) {
            onProjectToday.push({ ...p, projects: projs });
            for (const proj of projs) {
              const k = String(proj._id);
              if (!projectsToday[k]) projectsToday[k] = { ...proj, members: [] };
              projectsToday[k].members.push(p);
            }
          } else {
            availableToday.push(p);
          }
        }
        const projectsList = Object.values(projectsToday);

        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-lg font-black text-foreground">{JOURS[focusDay.getDay()]} {focusDay.getDate()} {MOIS[focusDay.getMonth()]} {focusDay.getFullYear()}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredProfiles.length} membres dans l&apos;équipe</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card size="sm"><CardContent className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center"><UserX className="w-4 h-4 text-white" strokeWidth={2.5} /></div>
                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Absents</p><p className="text-xl font-black text-rose-600">{absentToday.length}</p></div>
              </CardContent></Card>
              <Card size="sm"><CardContent className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center"><Briefcase className="w-4 h-4 text-white" strokeWidth={2.5} /></div>
                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase">En projet</p><p className="text-xl font-black text-violet-600">{onProjectToday.length}</p></div>
              </CardContent></Card>
              <Card size="sm"><CardContent className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center"><UserPlus className="w-4 h-4 text-white" strokeWidth={2.5} /></div>
                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase">Disponibles</p><p className="text-xl font-black text-emerald-600">{availableToday.length}</p></div>
              </CardContent></Card>
            </div>

            {/* Projects */}
            {projectsList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-bold text-foreground">Projets du jour ({projectsList.length})</span>
                </div>
                <div className="space-y-2">
                  {projectsList.map((proj) => {
                    const bc = getBranchColor(proj.branche, branches);
                    const absentMembers = proj.members.filter((m) => { const a = absMap[String(m._id)]?.[focusDate]; return a && a.statut === "valide"; });
                    return (
                      <Card key={String(proj._id)} size="sm">
                        <CardContent>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: bc }} />
                            <Link href={`/projets/${String(proj._id)}`} className="text-sm font-bold text-foreground hover:text-violet-600 transition-colors">{proj.nomContrat || proj.nom}</Link>
                            <Badge variant="secondary" className="text-[10px]" style={{ color: bc }}>{proj.branche}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {proj.members.map((m) => {
                              const isAbsent = absentMembers.some((a) => String(a._id) === String(m._id));
                              return (
                                <button key={String(m._id)} onClick={() => openSheet(m, focusDate)} className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold cursor-pointer hover:ring-1 hover:ring-violet-300 transition-all", isAbsent ? "bg-rose-50 text-rose-600 line-through" : "bg-muted text-foreground")}>
                                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: isAbsent ? "#f43f5e" : bc }}>{(m.prenom || "?")[0]}</span>
                                  {m.prenom} {m.nom?.[0]}.
                                </button>
                              );
                            })}
                          </div>
                          {absentMembers.length > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                              <AlertTriangle className="w-3 h-3" />{absentMembers.length} absent{absentMembers.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Absents */}
            {absentToday.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3"><UserX className="w-4 h-4 text-rose-500" /><span className="text-sm font-bold text-foreground">Absents ({absentToday.length})</span></div>
                <div className="flex flex-wrap gap-2">
                  {absentToday.map((emp) => {
                    const meta = ABSENCE_META[emp.absence?.type] || ABSENCE_META.absence_autre;
                    return (
                      <button key={String(emp._id)} onClick={() => openSheet(emp, focusDate)} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:shadow-sm cursor-pointer", meta.bg, meta.border)}>
                        <span className="text-base leading-none">{meta.icon}</span>
                        <div className="text-left">
                          <div className="text-xs font-bold text-foreground">{emp.prenom} {emp.nom?.[0]}.</div>
                          <div className={cn("text-[10px] font-semibold", meta.text)}>{meta.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available */}
            {availableToday.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3"><UserPlus className="w-4 h-4 text-emerald-600" /><span className="text-sm font-bold text-foreground">Disponibles ({availableToday.length})</span></div>
                <div className="flex flex-wrap gap-2">
                  {availableToday.map((emp) => (
                    <button key={String(emp._id)} onClick={() => openSheet(emp, focusDate)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-100 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: "#10b981" }}>{(emp.prenom || "?")[0]}</div>
                      <div className="text-xs font-bold text-foreground">{emp.prenom} {emp.nom?.[0]}.</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredProfiles.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun membre trouvé</div>}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════
          EMPLOYEE SHEET (right side panel)
          ═══════════════════════════════════════════ */}
      <Sheet open={!!sheetEmployee} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          {sheetEmployee && sheetData && (() => {
            const emp = sheetEmployee;
            const pid = String(emp._id);
            const group = employeeGroups.find((g) => g.employees.some((e) => String(e._id) === pid));
            const groupColor = group?.color || "#6b7280";

            return (
              <>
                <SheetHeader className="pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${groupColor}, ${groupColor}cc)` }}>
                      {(emp.prenom || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <SheetTitle className="text-base">{emp.prenom} {emp.nom}</SheetTitle>
                      <SheetDescription>{emp.pole || "—"} · {emp.contrat || "—"}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="px-4 pb-4 space-y-5">

                  {/* Period summary bar */}
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Résumé de la période</div>
                    <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-muted">
                      {sheetData.workDays > 0 && (
                        <>
                          <div className="bg-violet-500 transition-all" style={{ width: `${(sheetData.daysOnProject / sheetData.workDays) * 100}%` }} title={`${sheetData.daysOnProject}j en projet`} />
                          <div className="bg-rose-400 transition-all" style={{ width: `${(sheetData.daysAbsent / sheetData.workDays) * 100}%` }} title={`${sheetData.daysAbsent}j absent`} />
                          <div className="bg-emerald-400 transition-all" style={{ width: `${(sheetData.daysFree / sheetData.workDays) * 100}%` }} title={`${sheetData.daysFree}j dispo`} />
                        </>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[10px] font-semibold">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />{sheetData.daysOnProject}j projet</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />{sheetData.daysAbsent}j absent</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />{sheetData.daysFree}j dispo</span>
                    </div>
                  </div>

                  {/* Selected day detail */}
                  {sheetData.dayDetail && (() => {
                    const dd = sheetData.dayDetail;
                    const dateObj = new Date(dd.date + "T12:00:00");
                    return (
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          {JOURS[dateObj.getDay()]} {dateObj.getDate()} {MOIS[dateObj.getMonth()]}
                        </div>
                        {dd.isAbsent && dd.abs && (() => {
                          const meta = ABSENCE_META[dd.abs.type] || ABSENCE_META.absence_autre;
                          return (
                            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", meta.bg)}>
                              <span className="text-lg">{meta.icon}</span>
                              <span className={cn("text-sm font-bold", meta.text)}>{meta.label}</span>
                              <Badge variant="outline" className="ml-auto text-[10px]">{dd.abs.statut === "valide" ? "Validé" : "En attente"}</Badge>
                            </div>
                          );
                        })()}
                        {dd.projs.length > 0 && (
                          <div className="space-y-1.5">
                            {dd.projs.map((c, i) => {
                              const bc = getBranchColor(c.branche, branches);
                              return (
                                <Link key={i} href={`/projets/${String(c._id)}`} className="flex items-center justify-between px-3 py-2 rounded-lg hover:shadow-sm transition-all" style={{ backgroundColor: `${bc}10`, borderLeft: `3px solid ${bc}` }}>
                                  <span className="text-xs font-bold text-foreground">{c.nomContrat || c.nom}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold" style={{ color: bc }}>{c.branche}</span>
                                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                        {!dd.isAbsent && dd.projs.length === 0 && (
                          <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold">
                            ✓ Disponible — peut être assigné
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Projects this period */}
                  {sheetData.periodProjects.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Projets sur la période ({sheetData.periodProjects.length})
                      </div>
                      <div className="space-y-1.5">
                        {sheetData.periodProjects.map((c) => {
                          const bc = getBranchColor(c.branche, branches);
                          return (
                            <Link key={String(c._id)} href={`/projets/${String(c._id)}`} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:shadow-sm transition-all group/proj" style={{ backgroundColor: `${bc}08` }}>
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bc }} />
                              <span className="text-xs font-bold text-foreground group-hover/proj:text-violet-600 transition-colors flex-1 truncate">{c.nomContrat || c.nom}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover/proj:opacity-100 transition-opacity" />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Upcoming absences */}
                  {sheetData.upcoming.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Absences à venir</div>
                      <div className="space-y-1.5">
                        {sheetData.upcoming.map((a, i) => {
                          const meta = ABSENCE_META[a.type] || ABSENCE_META.absence_autre;
                          const dStart = new Date(a.dateDebut + "T12:00:00");
                          const dEnd = new Date(a.dateFin + "T12:00:00");
                          return (
                            <div key={i} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs", meta.bg)}>
                              <span>{meta.icon}</span>
                              <span className="font-bold">{dStart.getDate()} {MOIS[dStart.getMonth()].slice(0, 3)}</span>
                              {a.dateDebut !== a.dateFin && <><span className="text-muted-foreground">→</span><span className="font-bold">{dEnd.getDate()} {MOIS[dEnd.getMonth()].slice(0, 3)}</span></>}
                              <span className={cn("ml-auto text-[10px] font-semibold", meta.text)}>{meta.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Full profile link */}
                  <Link
                    href={`/rh/employe/${pid}`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 transition-colors"
                  >
                    Voir la fiche complète
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ═══ LEGEND ═══ */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2">
        {[
          { label: "Disponible", cls: "bg-emerald-50/60 border-emerald-100" },
          { label: "🌴 Congé", cls: "bg-emerald-100/60 border-emerald-200" },
          { label: "🏡 Télétravail", cls: "bg-violet-100/60 border-violet-200" },
          { label: "🤧 Maladie", cls: "bg-rose-100/60 border-rose-200" },
          { label: "Sur projet", cls: "bg-violet-50 border-l-[3px] border-l-violet-500 border-t-0 border-b-0 border-r-0" },
          { label: "Surcharge (3+)", cls: "ring-2 ring-rose-400/60 bg-rose-50/60" },
          { label: "? En attente", cls: "border border-dashed border-amber-300 bg-amber-50/60" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <span className={cn("w-4 h-4 rounded inline-block border border-border", cls)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
