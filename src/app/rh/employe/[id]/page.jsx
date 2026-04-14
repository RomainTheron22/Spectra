"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Pencil, Save, X, Plus, Trash2, Phone, Mail, MapPin,
  Calendar, CalendarDays, Briefcase, Building2, Clock, Heart, FileText, AlertTriangle,
  ChevronDown, ChevronLeft, ChevronRight, User, Shield, Euro, Hash
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────
const CONTRAT_CONFIG = {
  cdi:          { label: "CDI",          color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cdd:          { label: "CDD",          color: "bg-sky-50 text-sky-700 border-sky-200",           dot: "bg-sky-500" },
  alternance:   { label: "Alternance",   color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  stage:        { label: "Stage",        color: "bg-amber-50 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  intermittent: { label: "Intermittent", color: "bg-rose-50 text-rose-700 border-rose-200",       dot: "bg-rose-500" },
  facture:      { label: "Facture",      color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
};

const ABSENCE_CONFIG = {
  conge:         { label: "Congé",       color: "text-emerald-600" },
  tt:            { label: "Télétravail", color: "text-violet-600" },
  maladie:       { label: "Maladie",     color: "text-rose-600" },
  absence_autre: { label: "Autre",       color: "text-amber-600" },
};

const POLE_OPTIONS = ["Communication", "Scénographie", "Atelier", "FabLab", "Production Audiovisuelle", "Administration", "Direction"];
const ENTITE_OPTIONS = ["CreativGen", "Fantasmagorie"];
const CONTRAT_TYPES = ["cdi", "cdd", "alternance", "stage", "intermittent", "facture"];
const JOURS = [
  { key: "lun", label: "L" }, { key: "mar", label: "M" }, { key: "mer", label: "Me" },
  { key: "jeu", label: "J" }, { key: "ven", label: "V" }, { key: "sam", label: "S" }, { key: "dim", label: "D" },
];

const JOURNAL_TYPES = [
  { key: "note",    label: "Note",    icon: "●", color: "text-violet-600" },
  { key: "reunion", label: "Réunion", icon: "■", color: "text-cyan-600" },
  { key: "feedback",label: "Feedback",icon: "◆", color: "text-emerald-600" },
  { key: "alerte",  label: "Alerte",  icon: "▲", color: "text-rose-600" },
  { key: "rappel",  label: "Rappel",  icon: "⏰", color: "text-amber-600" },
];

const PLANNING_ABSENCE_TYPES = [
  { value: "conge", label: "Congé", color: "#10b981", icon: "🌴" },
  { value: "tt", label: "Télétravail", color: "#8b5cf6", icon: "🏡" },
  { value: "maladie", label: "Maladie", color: "#f43f5e", icon: "🤧" },
  { value: "absence_autre", label: "Autre", color: "#f59e0b", icon: "✨" },
];
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_HEAD = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function planningToYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = (first.getDay() + 6) % 7; // Monday = 0
  const days = [];
  // Previous month padding
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, currentMonth: false });
  }
  // Current month
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ date: new Date(year, month, i), currentMonth: true });
  }
  // Next month padding
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), currentMonth: false });
    }
  }
  return days;
}

// ─── Helpers ─────────────────────────────────────────────────────
function toYMD(d) { return d.toISOString().split("T")[0]; }
function countWorkDays(s, e) { let c = 0; const d = new Date(s); const end = new Date(e); while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); } return c; }
function daysBetween(a, b) { return Math.ceil((new Date(b) - new Date(a)) / 86400000); }
function formatDate(d) { if (!d) return "—"; return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }

// ─── Editable Field ──────────────────────────────────────────────
function EditableField({ label, value, field, editing, form, setForm, icon: Icon, type = "text" }) {
  if (!editing) {
    return (
      <div className="flex items-start gap-2 py-1.5">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-sm text-foreground">{value || "—"}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 py-1">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-3 shrink-0" />}
      <div className="flex-1 min-w-0">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <Input
          type={type}
          value={form[field] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          className="mt-0.5 h-8 text-sm"
        />
      </div>
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────
function SectionCard({ title, children, editing, onEdit, onSave, onCancel, saving }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <div className="flex gap-1">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs"><X className="w-3 h-3 mr-1" />Annuler</Button>
              <Button size="sm" onClick={onSave} disabled={saving} className="h-7 text-xs"><Save className="w-3 h-3 mr-1" />{saving ? "..." : "Enregistrer"}</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 text-xs"><Pencil className="w-3 h-3 mr-1" />Modifier</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function FicheEmployePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [contrats, setContrats] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [projets, setProjets] = useState([]);
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit states per section
  const [editSection, setEditSection] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Contract sheet
  const [contratSheet, setContratSheet] = useState({ open: false, editId: null });
  const [contratForm, setContratForm] = useState({});
  const [contratSaving, setContratSaving] = useState(false);

  // Journal
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("note");

  // Planning tab
  const [planningDate, setPlanningDate] = useState(new Date());

  // ─── Data loading ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [profRes, contratsRes, absRes, projRes, journalRes] = await Promise.all([
        fetch(`/api/employee-profiles/${id}`, { cache: "no-store" }),
        fetch(`/api/employee-profiles/${id}/contrats`, { cache: "no-store" }),
        fetch(`/api/employee-absences?all=true`, { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
        fetch(`/api/journal/${id}`, { cache: "no-store" }),
      ]);
      const profData = await profRes.json();
      setProfile(profData.item || null);
      const contratsData = await contratsRes.json();
      setContrats(contratsData.items || []);
      const absData = await absRes.json();
      const allAbs = absData.items || [];
      setAbsences(allAbs.filter((a) => a.employeeProfileId === id || a.userId === profData.item?.userId));
      const projData = await projRes.json();
      setProjets(projData.items || []);
      try { const jData = await journalRes.json(); setJournal(jData.items || []); } catch {}
      setLoading(false);
    })();
  }, [id]);

  const today = toYMD(new Date());
  const year = new Date().getFullYear();

  // ─── Computed data ───────────────────────────────────────────
  const myProjects = useMemo(() => {
    if (!profile) return [];
    return projets.filter((c) => {
      const assignees = c.assignees || c.equipe || [];
      return assignees.some((a) => String(a) === String(profile.userId) || String(a) === profile.email || String(a._id || a.id || a) === String(profile.userId));
    });
  }, [projets, profile]);

  const activeProjects = myProjects.filter((c) => c.dateDebut && c.dateFin && c.dateFin >= today && c.dateDebut <= today);
  const upcomingProjects = myProjects.filter((c) => c.dateDebut && c.dateDebut > today);

  const absStats = useMemo(() => {
    const thisYear = absences.filter((a) => a.statut === "valide" && a.dateDebut?.startsWith(String(year)));
    return {
      conge: thisYear.filter((a) => a.type === "conge").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin), 0),
      tt: thisYear.filter((a) => a.type === "tt").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin), 0),
      maladie: thisYear.filter((a) => a.type === "maladie").reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin), 0),
      pending: absences.filter((a) => a.statut === "en_attente").length,
    };
  }, [absences, year]);

  const congesCredit = profile?.congesAnnuels || 30;
  const congesReste = congesCredit - absStats.conge;

  const currentContrat = useMemo(() => contrats.find((c) => c.isActive), [contrats]);

  const alerts = useMemo(() => {
    if (!profile) return [];
    const a = [];
    const fin = currentContrat?.dateFin || profile.dateFin;
    if (fin) {
      const daysLeft = daysBetween(today, fin);
      if (daysLeft < 0) a.push({ type: "destructive", msg: `Contrat terminé depuis ${Math.abs(daysLeft)}j` });
      else if (daysLeft < 30) a.push({ type: "destructive", msg: `Contrat se termine dans ${daysLeft}j (${formatDate(fin)})` });
      else if (daysLeft < 60) a.push({ type: "warning", msg: `Contrat se termine dans ${daysLeft}j` });
    }
    if (congesReste <= 5 && congesReste > 0) a.push({ type: "warning", msg: `Plus que ${congesReste}j de congés restants` });
    if (congesReste <= 0) a.push({ type: "destructive", msg: "Plus aucun jour de congé" });
    if (activeProjects.length >= 3) a.push({ type: "warning", msg: `Surcharge : ${activeProjects.length} projets simultanés` });
    if (absStats.pending > 0) a.push({ type: "info", msg: `${absStats.pending} demande${absStats.pending > 1 ? "s" : ""} d'absence en attente` });
    return a;
  }, [profile, currentContrat, congesReste, activeProjects, absStats, today]);

  // ─── Planning events map ──────────────────────────────────────
  const planningEvents = useMemo(() => {
    const map = {};
    const add = (dateStr, event) => {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(event);
    };

    // Absences
    for (const a of absences) {
      if (a.statut !== "valide" && a.statut !== "en_attente") continue;
      const d = new Date(a.dateDebut + "T12:00:00");
      const end = new Date(a.dateFin + "T12:00:00");
      const absType = PLANNING_ABSENCE_TYPES.find((t) => t.value === a.type);
      while (d <= end) {
        add(planningToYMD(d), { type: "absence", ...a, absType });
        d.setDate(d.getDate() + 1);
      }
    }

    // Projects
    for (const p of myProjects) {
      if (!p.dateDebut || !p.dateFin) continue;
      const d = new Date(p.dateDebut + "T12:00:00");
      const end = new Date(p.dateFin + "T12:00:00");
      while (d <= end) {
        add(planningToYMD(d), { type: "projet", ...p });
        d.setDate(d.getDate() + 1);
      }
    }

    return map;
  }, [absences, myProjects]);

  const planningCalendarDays = useMemo(() => {
    return getCalendarDays(planningDate.getFullYear(), planningDate.getMonth());
  }, [planningDate]);

  // ─── Edit handlers ───────────────────────────────────────────
  function startEdit(section, fields) {
    setEditSection(section);
    setEditForm(fields);
  }

  async function saveSection(section) {
    setSaving(true);
    const payload = { ...editForm };
    const res = await fetch(`/api/employee-profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.item);
    }
    setSaving(false);
    setEditSection(null);
  }

  // ─── Contract handlers ───────────────────────────────────────
  function openNewContrat() {
    setContratForm({
      type: profile?.contrat || "cdi",
      dateDebut: today,
      dateFin: "",
      poste: profile?.poste || "",
      pole: profile?.pole || "",
      entite: profile?.entite || "",
      commentaire: "",
      gusoNumber: "", typeIntermittent: "technicien", tarifJournalier: "",
      siret: "", raisonSociale: "",
    });
    setContratSheet({ open: true, editId: null });
  }

  function openEditContrat(c) {
    setContratForm({
      type: c.type, dateDebut: c.dateDebut || "", dateFin: c.dateFin || "",
      poste: c.poste || "", pole: c.pole || "", entite: c.entite || "",
      commentaire: c.commentaire || "",
      gusoNumber: c.gusoNumber || "", typeIntermittent: c.typeIntermittent || "technicien",
      tarifJournalier: c.tarifJournalier ?? "",
      siret: c.siret || "", raisonSociale: c.raisonSociale || "",
    });
    setContratSheet({ open: true, editId: String(c._id) });
  }

  async function saveContrat() {
    setContratSaving(true);
    const payload = {
      ...contratForm,
      tarifJournalier: contratForm.tarifJournalier !== "" ? Number(contratForm.tarifJournalier) : null,
    };

    const isEdit = contratSheet.editId;
    const url = isEdit
      ? `/api/employee-profiles/${id}/contrats/${contratSheet.editId}`
      : `/api/employee-profiles/${id}/contrats`;
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      // Reload contrats + profile
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/employee-profiles/${id}/contrats`, { cache: "no-store" }),
        fetch(`/api/employee-profiles/${id}`, { cache: "no-store" }),
      ]);
      const cData = await cRes.json(); setContrats(cData.items || []);
      const pData = await pRes.json(); setProfile(pData.item || profile);
    }
    setContratSaving(false);
    setContratSheet({ open: false, editId: null });
  }

  async function deleteContrat(contratId) {
    if (!confirm("Supprimer ce contrat ?")) return;
    const res = await fetch(`/api/employee-profiles/${id}/contrats/${contratId}`, { method: "DELETE" });
    if (res.ok) {
      setContrats((prev) => prev.filter((c) => String(c._id) !== contratId));
      const pRes = await fetch(`/api/employee-profiles/${id}`, { cache: "no-store" });
      const pData = await pRes.json(); setProfile(pData.item || profile);
    }
  }

  // ─── Journal handlers ────────────────────────────────────────
  async function addJournalEntry() {
    if (!newNote.trim()) return;
    const res = await fetch(`/api/journal/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newNote.trim(), type: noteType }),
    });
    const data = await res.json();
    if (res.ok && data.item) {
      setJournal((prev) => [data.item, ...prev]);
      setNewNote("");
      setNoteType("note");
    }
  }

  async function deleteJournalEntry(entryId) {
    const res = await fetch(`/api/journal/${id}?entryId=${entryId}`, { method: "DELETE" });
    if (res.ok) setJournal((prev) => prev.filter((j) => String(j._id) !== entryId));
  }

  // ─── Jours de presence toggle ────────────────────────────────
  function toggleJour(jour) {
    setEditForm((f) => ({
      ...f,
      joursPresence: (f.joursPresence || []).includes(jour)
        ? f.joursPresence.filter((j) => j !== jour)
        : [...(f.joursPresence || []), jour],
    }));
  }

  // ─── Loading / Not found ─────────────────────────────────────
  if (loading) return <div className="p-8 text-muted-foreground">Chargement...</div>;
  if (!profile) return <div className="p-8 text-muted-foreground">Profil non trouvé</div>;

  const cc = CONTRAT_CONFIG[profile.contrat] || CONTRAT_CONFIG.cdi;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">

      {/* Back link */}
      <Link href="/rh/profils" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour aux profils
      </Link>

      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex items-start gap-5 p-5 rounded-xl border bg-card">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {(profile.prenom || "?")[0].toUpperCase()}{(profile.nom || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">{profile.prenom} {profile.nom}</h1>
            <Badge variant="outline" className={cn("text-xs border", cc.color)}>
              {cc.label}
            </Badge>
          </div>
          {profile.poste && <p className="text-sm text-muted-foreground mt-0.5">{profile.poste}</p>}
          <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
            {profile.pole && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{profile.pole}</span>}
            {profile.entite && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{profile.entite}</span>}
            {profile.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{profile.email}</span>}
            {profile.telephone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{profile.telephone}</span>}
            {profile.dateDebut && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Depuis {formatDate(profile.dateDebut)}
                {(currentContrat?.dateFin || profile.dateFin) ? ` → ${formatDate(currentContrat?.dateFin || profile.dateFin)}` : ""}
              </span>
            )}
          </div>
          {/* Jours de presence */}
          <div className="flex gap-1 mt-2">
            {JOURS.map((j) => (
              <span key={j.key} className={cn(
                "w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center",
                (profile.joursPresence || []).includes(j.key)
                  ? "bg-sky-100 text-sky-700 border border-sky-200"
                  : "bg-muted text-muted-foreground/40"
              )}>
                {j.label}
              </span>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openNewContrat}>
            <Plus className="w-3.5 h-3.5 mr-1" />Contrat
          </Button>
        </div>
      </div>

      {/* ─── Alerts ───────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border-l-4",
              a.type === "destructive" && "bg-rose-50 border-rose-500 text-rose-700",
              a.type === "warning" && "bg-amber-50 border-amber-500 text-amber-700",
              a.type === "info" && "bg-sky-50 border-sky-500 text-sky-700",
            )}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="infos">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="infos"><User className="w-3.5 h-3.5 mr-1" />Infos</TabsTrigger>
          <TabsTrigger value="contrats"><FileText className="w-3.5 h-3.5 mr-1" />Contrats & Périodes</TabsTrigger>
          <TabsTrigger value="planning"><CalendarDays className="w-3.5 h-3.5 mr-1" />Planning</TabsTrigger>
          <TabsTrigger value="activite"><Briefcase className="w-3.5 h-3.5 mr-1" />Activité</TabsTrigger>
          <TabsTrigger value="journal"><FileText className="w-3.5 h-3.5 mr-1" />Journal</TabsTrigger>
        </TabsList>

        {/* ═══ TAB: INFOS ═══════════════════════════════════ */}
        <TabsContent value="infos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

            {/* Identité */}
            <SectionCard
              title="Identité"
              editing={editSection === "identity"}
              saving={saving}
              onEdit={() => startEdit("identity", { nom: profile.nom, prenom: profile.prenom, email: profile.email || "", poste: profile.poste || "", dateNaissance: profile.dateNaissance || "" })}
              onCancel={() => setEditSection(null)}
              onSave={() => saveSection("identity")}
            >
              <div className="space-y-1">
                <EditableField label="Prénom" value={profile.prenom} field="prenom" editing={editSection === "identity"} form={editForm} setForm={setEditForm} icon={User} />
                <EditableField label="Nom" value={profile.nom} field="nom" editing={editSection === "identity"} form={editForm} setForm={setEditForm} icon={User} />
                <EditableField label="Email" value={profile.email} field="email" editing={editSection === "identity"} form={editForm} setForm={setEditForm} icon={Mail} type="email" />
                <EditableField label="Poste" value={profile.poste} field="poste" editing={editSection === "identity"} form={editForm} setForm={setEditForm} icon={Briefcase} />
                <EditableField label="Date de naissance" value={formatDate(profile.dateNaissance)} field="dateNaissance" editing={editSection === "identity"} form={editForm} setForm={setEditForm} icon={Calendar} type="date" />
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard
              title="Contact & Adresse"
              editing={editSection === "contact"}
              saving={saving}
              onEdit={() => startEdit("contact", { telephone: profile.telephone || "", adresse: profile.adresse || { rue: "", codePostal: "", ville: "" } })}
              onCancel={() => setEditSection(null)}
              onSave={() => saveSection("contact")}
            >
              <div className="space-y-1">
                <EditableField label="Téléphone" value={profile.telephone} field="telephone" editing={editSection === "contact"} form={editForm} setForm={setEditForm} icon={Phone} type="tel" />
                {editSection === "contact" ? (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-start gap-2 py-1">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-3 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Adresse</label>
                        <Input value={editForm.adresse?.rue || ""} onChange={(e) => setEditForm((f) => ({ ...f, adresse: { ...f.adresse, rue: e.target.value } }))} placeholder="Rue" className="h-8 text-sm" />
                        <div className="flex gap-2">
                          <Input value={editForm.adresse?.codePostal || ""} onChange={(e) => setEditForm((f) => ({ ...f, adresse: { ...f.adresse, codePostal: e.target.value } }))} placeholder="Code postal" className="h-8 text-sm w-28" />
                          <Input value={editForm.adresse?.ville || ""} onChange={(e) => setEditForm((f) => ({ ...f, adresse: { ...f.adresse, ville: e.target.value } }))} placeholder="Ville" className="h-8 text-sm flex-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 py-1.5">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Adresse</div>
                      <div className="text-sm text-foreground">
                        {profile.adresse ? `${profile.adresse.rue || ""} ${profile.adresse.codePostal || ""} ${profile.adresse.ville || ""}`.trim() || "—" : "—"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Contact d'urgence */}
            <SectionCard
              title="Contact d'urgence"
              editing={editSection === "urgence"}
              saving={saving}
              onEdit={() => startEdit("urgence", { contactUrgence: profile.contactUrgence || { nom: "", telephone: "", lien: "" } })}
              onCancel={() => setEditSection(null)}
              onSave={() => saveSection("urgence")}
            >
              {editSection === "urgence" ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-muted-foreground mt-3 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Input value={editForm.contactUrgence?.nom || ""} onChange={(e) => setEditForm((f) => ({ ...f, contactUrgence: { ...f.contactUrgence, nom: e.target.value } }))} placeholder="Nom" className="h-8 text-sm" />
                      <Input value={editForm.contactUrgence?.telephone || ""} onChange={(e) => setEditForm((f) => ({ ...f, contactUrgence: { ...f.contactUrgence, telephone: e.target.value } }))} placeholder="Téléphone" className="h-8 text-sm" type="tel" />
                      <Input value={editForm.contactUrgence?.lien || ""} onChange={(e) => setEditForm((f) => ({ ...f, contactUrgence: { ...f.contactUrgence, lien: e.target.value } }))} placeholder="Lien (Conjoint, Parent...)" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <EditableField label="Nom" value={profile.contactUrgence?.nom} field="" editing={false} form={{}} setForm={() => {}} icon={Heart} />
                  <EditableField label="Téléphone" value={profile.contactUrgence?.telephone} field="" editing={false} form={{}} setForm={() => {}} icon={Phone} />
                  <EditableField label="Lien" value={profile.contactUrgence?.lien} field="" editing={false} form={{}} setForm={() => {}} icon={User} />
                </div>
              )}
            </SectionCard>

            {/* Jours de présence */}
            <SectionCard
              title="Jours de présence & Congés"
              editing={editSection === "jours"}
              saving={saving}
              onEdit={() => startEdit("jours", { joursPresence: [...(profile.joursPresence || [])], congesAnnuels: profile.congesAnnuels ?? 30 })}
              onCancel={() => setEditSection(null)}
              onSave={() => saveSection("jours")}
            >
              {editSection === "jours" ? (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    {JOURS.map((j) => (
                      <button key={j.key} type="button" onClick={() => toggleJour(j.key)} className={cn(
                        "w-9 h-9 rounded-lg text-xs font-bold transition-all",
                        (editForm.joursPresence || []).includes(j.key) ? "bg-sky-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}>
                        {j.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Congés annuels (jours)</label>
                    <Input type="number" value={editForm.congesAnnuels} onChange={(e) => setEditForm((f) => ({ ...f, congesAnnuels: parseInt(e.target.value) || 0 }))} className="h-8 text-sm w-24 mt-0.5" min={0} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {JOURS.map((j) => (
                      <span key={j.key} className={cn(
                        "w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center",
                        (profile.joursPresence || []).includes(j.key) ? "bg-sky-100 text-sky-700 border border-sky-200" : "bg-muted text-muted-foreground/40"
                      )}>
                        {j.label}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{profile.congesAnnuels ?? 30} jours de congés / an</span>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Notes RH */}
            <SectionCard
              title="Notes RH"
              editing={editSection === "rh"}
              saving={saving}
              onEdit={() => startEdit("rh", { notesRH: profile.notesRH || "" })}
              onCancel={() => setEditSection(null)}
              onSave={() => saveSection("rh")}
            >
              {editSection === "rh" ? (
                <textarea
                  value={editForm.notesRH}
                  onChange={(e) => setEditForm((f) => ({ ...f, notesRH: e.target.value }))}
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  placeholder="Notes internes RH..."
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{profile.notesRH || "Aucune note"}</p>
              )}
            </SectionCard>

            {/* Compétences */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Compétences & Tags</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {(profile.competences || []).map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">{c}</Badge>
                  ))}
                  {(profile.tags || []).map((t, i) => (
                    <Badge key={`t${i}`} variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200">{t}</Badge>
                  ))}
                  {!(profile.competences?.length || profile.tags?.length) && <p className="text-sm text-muted-foreground">Aucune compétence renseignée</p>}
                </div>
                <Input
                  className="mt-3 h-8 text-sm"
                  placeholder="Ajouter une compétence (Entrée)..."
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      const newComp = [...(profile.competences || []), e.target.value.trim()];
                      const res = await fetch(`/api/employee-profiles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competences: newComp }) });
                      if (res.ok) { const d = await res.json(); setProfile(d.item); }
                      e.target.value = "";
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: CONTRATS & PÉRIODES ══════════════════════ */}
        <TabsContent value="contrats">
          <div className="mt-4 space-y-4">

            {/* Current contract card */}
            {currentContrat && (
              <Card className="border-2 border-sky-200 bg-sky-50/30">
                <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", CONTRAT_CONFIG[currentContrat.type]?.dot || "bg-gray-400")} />
                    <CardTitle className="text-sm font-semibold">Contrat actuel</CardTitle>
                    <Badge variant="outline" className={cn("text-xs border", CONTRAT_CONFIG[currentContrat.type]?.color)}>
                      {CONTRAT_CONFIG[currentContrat.type]?.label || currentContrat.type}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditContrat(currentContrat)} className="h-7 text-xs"><Pencil className="w-3 h-3 mr-1" />Modifier</Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Début</span>{formatDate(currentContrat.dateDebut)}</div>
                    <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Fin</span>{formatDate(currentContrat.dateFin)}</div>
                    {currentContrat.poste && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Poste</span>{currentContrat.poste}</div>}
                    {currentContrat.pole && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Pôle</span>{currentContrat.pole}</div>}
                    {currentContrat.entite && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Entité</span>{currentContrat.entite}</div>}
                    {currentContrat.tarifJournalier && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Tarif / jour</span>{currentContrat.tarifJournalier} €</div>}
                    {currentContrat.gusoNumber && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">N° GUSO</span>{currentContrat.gusoNumber}</div>}
                    {currentContrat.typeIntermittent && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Type</span>{currentContrat.typeIntermittent === "technicien" ? "Technicien" : "Artiste"}</div>}
                    {currentContrat.siret && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">SIRET</span>{currentContrat.siret}</div>}
                    {currentContrat.raisonSociale && <div><span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Société</span>{currentContrat.raisonSociale}</div>}
                  </div>
                  {currentContrat.commentaire && <p className="text-sm text-muted-foreground mt-2 italic">{currentContrat.commentaire}</p>}
                </CardContent>
              </Card>
            )}

            {/* Add contract button */}
            <Button variant="outline" onClick={openNewContrat} className="w-full border-dashed">
              <Plus className="w-4 h-4 mr-2" /> Ajouter une période / contrat
            </Button>

            {/* Contract timeline */}
            {contrats.length > 0 && (
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />

                {contrats.map((c, i) => {
                  const cfg = CONTRAT_CONFIG[c.type] || CONTRAT_CONFIG.cdi;
                  const duration = c.dateFin ? daysBetween(c.dateDebut, c.dateFin) : null;
                  return (
                    <div key={String(c._id)} className={cn("relative pb-4", c.isActive && "")}>
                      {/* Dot */}
                      <div className={cn("absolute -left-6 top-1.5 w-[18px] h-[18px] rounded-full border-2 border-background", cfg.dot)} />
                      <div className={cn(
                        "rounded-lg border p-3 transition-all hover:shadow-sm",
                        c.isActive ? "bg-sky-50/50 border-sky-200" : "bg-card"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs border", cfg.color)}>{cfg.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(c.dateDebut)} → {formatDate(c.dateFin)}
                              {duration && <span className="ml-1">({duration}j)</span>}
                            </span>
                            {c.isActive && <Badge className="text-[10px] bg-emerald-500 text-white h-5">Actuel</Badge>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditContrat(c)} className="h-6 w-6 p-0"><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteContrat(String(c._id))} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        {(c.poste || c.pole || c.entite) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {[c.poste, c.pole, c.entite].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {c.commentaire && <p className="text-xs text-muted-foreground mt-1 italic">{c.commentaire}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {contrats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun contrat enregistré. Ajoute le premier contrat pour démarrer l'historique.</p>
            )}
          </div>
        </TabsContent>

        {/* ═══ TAB: PLANNING ════════════════════════════════ */}
        <TabsContent value="planning">
          <div className="mt-4 space-y-4">

            {/* Calendar Card */}
            <Card className="rounded-2xl border-border">
              <CardContent className="p-4">

                {/* Month navigation */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPlanningDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-medium"
                      onClick={() => setPlanningDate(new Date())}
                    >
                      Aujourd&apos;hui
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPlanningDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <h3 className="text-base font-bold tracking-tight">
                    {MOIS[planningDate.getMonth()]} {planningDate.getFullYear()}
                  </h3>
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
                  {/* Header */}
                  {JOURS_HEAD.map((j) => (
                    <div key={j} className="bg-muted/50 text-center py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {j}
                    </div>
                  ))}
                  {/* Day cells */}
                  {planningCalendarDays.map((day, i) => {
                    const ymd = planningToYMD(day.date);
                    const isToday = ymd === today;
                    const events = planningEvents[ymd] || [];
                    return (
                      <div
                        key={i}
                        className={cn(
                          "min-h-[80px] p-1.5 rounded-lg border border-transparent cursor-default bg-card",
                          isToday && "bg-violet-50/80 border-violet-200/50",
                          !day.currentMonth && "opacity-[0.15]"
                        )}
                      >
                        {/* Day number */}
                        <div className="flex justify-end mb-0.5">
                          <span
                            className={cn(
                              "text-xs font-bold w-6 h-6 flex items-center justify-center",
                              isToday && "bg-violet-600 text-white rounded-full"
                            )}
                          >
                            {day.date.getDate()}
                          </span>
                        </div>
                        {/* Events */}
                        <div className="space-y-0.5">
                          {events.slice(0, 3).map((ev, ei) => {
                            if (ev.type === "absence" && ev.absType) {
                              return (
                                <div
                                  key={`a${ei}`}
                                  className="text-[9px] font-bold py-0.5 px-1.5 rounded text-white truncate"
                                  style={{ backgroundColor: ev.absType.color }}
                                  title={`${ev.absType.icon} ${ev.absType.label}`}
                                >
                                  {ev.absType.icon} {ev.absType.label}
                                </div>
                              );
                            }
                            if (ev.type === "projet") {
                              const bgColor = ev.color || (ev.branche === "audiovisuel" ? "#0ea5e9" : ev.branche === "scenographie" ? "#8b5cf6" : ev.branche === "communication" ? "#f59e0b" : "#64748b");
                              const title = ev.nomContrat || ev.nom || ev.title || "Projet";
                              return (
                                <div
                                  key={`p${ei}`}
                                  className="text-[9px] font-bold py-0.5 px-1.5 rounded border-l-2 text-white truncate"
                                  style={{ backgroundColor: bgColor, borderLeftColor: bgColor }}
                                  title={title}
                                >
                                  {title.length > 12 ? title.slice(0, 12) + "…" : title}
                                </div>
                              );
                            }
                            return null;
                          })}
                          {events.length > 3 && (
                            <div className="text-[8px] text-muted-foreground font-medium pl-1">
                              +{events.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Summary stat cards */}
            <div className="grid grid-cols-4 gap-3">
              {/* Congés restants */}
              <Card className="p-4 rounded-xl">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Congés restants</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={cn("text-2xl font-bold", congesReste > 10 ? "text-emerald-600" : congesReste > 5 ? "text-amber-600" : "text-rose-600")}>
                    {congesReste}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {congesCredit}j</span>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (congesReste / congesCredit) * 100))}%`,
                      background: congesReste > 10 ? "#10b981" : congesReste > 5 ? "#f59e0b" : "#f43f5e"
                    }}
                  />
                </div>
              </Card>

              {/* Télétravail */}
              <Card className="p-4 rounded-xl">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Télétravail</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-violet-600">{absStats.tt}</span>
                  <span className="text-xs text-muted-foreground">jours</span>
                </div>
                <Badge variant="outline" className="mt-2 text-[10px] bg-violet-50 text-violet-600 border-violet-200">
                  🏡 {year}
                </Badge>
              </Card>

              {/* Maladie */}
              <Card className="p-4 rounded-xl">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Maladie</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-rose-600">{absStats.maladie}</span>
                  <span className="text-xs text-muted-foreground">jours</span>
                </div>
                <Badge variant="outline" className="mt-2 text-[10px] bg-rose-50 text-rose-600 border-rose-200">
                  🤧 {year}
                </Badge>
              </Card>

              {/* Projets actifs */}
              <Card className="p-4 rounded-xl">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Projets actifs</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={cn("text-2xl font-bold", activeProjects.length >= 3 ? "text-rose-600" : "text-sky-600")}>
                    {activeProjects.length}
                  </span>
                  <span className="text-xs text-muted-foreground">en cours</span>
                </div>
                <Badge variant="outline" className="mt-2 text-[10px] bg-sky-50 text-sky-600 border-sky-200">
                  📋 {myProjects.length} total
                </Badge>
              </Card>
            </div>

          </div>
        </TabsContent>

        {/* ═══ TAB: ACTIVITÉ ════════════════════════════════ */}
        <TabsContent value="activite">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

            {/* Congés & Absences */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Congés & Absences — {year}</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <div className="text-lg font-bold text-emerald-700">{absStats.conge}j</div>
                    <div className="text-[10px] text-emerald-600">Congés</div>
                  </div>
                  <div className="p-2 rounded-lg bg-violet-50">
                    <div className="text-lg font-bold text-violet-700">{absStats.tt}j</div>
                    <div className="text-[10px] text-violet-600">Télétravail</div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50">
                    <div className="text-lg font-bold text-rose-700">{absStats.maladie}j</div>
                    <div className="text-[10px] text-rose-600">Maladie</div>
                  </div>
                  <div className={cn("p-2 rounded-lg", congesReste > 10 ? "bg-emerald-50" : congesReste > 5 ? "bg-amber-50" : "bg-rose-50")}>
                    <div className={cn("text-lg font-bold", congesReste > 10 ? "text-emerald-700" : congesReste > 5 ? "text-amber-700" : "text-rose-700")}>{congesReste}j</div>
                    <div className="text-[10px] text-muted-foreground">Restants/{congesCredit}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (absStats.conge / congesCredit) * 100)}%` }} />
                </div>
                {/* Recent absences */}
                <Separator className="my-3" />
                <div className="space-y-1.5">
                  {absences.length === 0 && <p className="text-xs text-muted-foreground">Aucune absence</p>}
                  {absences.slice(0, 8).map((a) => (
                    <div key={String(a._id)} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", ABSENCE_CONFIG[a.type]?.color || "text-muted-foreground")}>{ABSENCE_CONFIG[a.type]?.label || a.type}</span>
                        <span className="text-muted-foreground">{formatDate(a.dateDebut)}{a.dateDebut !== a.dateFin ? ` → ${formatDate(a.dateFin)}` : ""}</span>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] h-5",
                        a.statut === "valide" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                        a.statut === "en_attente" && "bg-amber-50 text-amber-600 border-amber-200",
                        a.statut === "refuse" && "bg-rose-50 text-rose-600 border-rose-200",
                      )}>
                        {a.statut === "valide" ? "Validé" : a.statut === "en_attente" ? "En attente" : "Refusé"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bande passante */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Bande passante</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <div className={cn("text-lg font-bold", activeProjects.length >= 3 ? "text-rose-600" : "text-foreground")}>{activeProjects.length}</div>
                    <div className="text-[10px] text-muted-foreground">Actifs</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <div className="text-lg font-bold text-foreground">{upcomingProjects.length}</div>
                    <div className="text-[10px] text-muted-foreground">À venir</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <div className="text-lg font-bold text-foreground">{myProjects.length}</div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                  </div>
                </div>
                {/* Charge bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Charge</span>
                    <span>{activeProjects.length >= 4 ? "Surcharge" : activeProjects.length >= 3 ? "Chargé" : activeProjects.length >= 1 ? "Normal" : "Disponible"}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.min(100, activeProjects.length * 25)}%`,
                      background: activeProjects.length >= 4 ? "#e11d48" : activeProjects.length >= 3 ? "#f59e0b" : "#10b981"
                    }} />
                  </div>
                </div>

                {/* Projects list */}
                <Separator className="my-3" />
                {myProjects.length === 0 && <p className="text-xs text-muted-foreground">Aucun projet assigné</p>}
                {myProjects.slice(0, 6).map((c) => {
                  const isActive = c.dateDebut <= today && c.dateFin >= today;
                  const total = Math.max(1, daysBetween(c.dateDebut, c.dateFin));
                  const passed = Math.max(0, daysBetween(c.dateDebut, today));
                  const pct = Math.min(100, Math.round((passed / total) * 100));
                  return (
                    <div key={String(c._id)} className="py-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <Link href={`/projets/${String(c._id)}`} className={cn("font-medium hover:underline", isActive ? "text-foreground" : "text-muted-foreground")}>
                          {c.nomContrat || c.nom}
                        </Link>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: JOURNAL ═════════════════════════════════ */}
        <TabsContent value="journal">
          <div className="mt-4 max-w-2xl space-y-4">
            {/* Add entry form */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-1 flex-wrap">
                  {JOURNAL_TYPES.map((t) => (
                    <button key={t.key} type="button" onClick={() => setNoteType(t.key)} className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                      noteType === t.key ? "bg-accent shadow-sm text-foreground" : "text-muted-foreground hover:bg-accent/50"
                    )}>
                      <span className={t.color}>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  placeholder={noteType === "reunion" ? "Compte-rendu de la réunion..." : noteType === "alerte" ? "Point d'attention, risque..." : "Note libre, observation, idée..."}
                />
                <Button size="sm" onClick={addJournalEntry} disabled={!newNote.trim()}>Ajouter</Button>
              </CardContent>
            </Card>

            {/* Journal entries */}
            {journal.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune note</p>}
            {journal.map((entry) => {
              const jt = JOURNAL_TYPES.find((t) => t.key === entry.type) || JOURNAL_TYPES[0];
              return (
                <div key={String(entry._id)} className="flex gap-3 group">
                  <div className={cn("w-1 rounded-full shrink-0", jt.color.replace("text-", "bg-"))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn("font-medium", jt.color)}>{jt.icon} {jt.label}</span>
                      <span className="text-muted-foreground">{entry.date}</span>
                      {entry.authorName && <span className="text-muted-foreground">par {entry.authorName}</span>}
                      <button onClick={() => deleteJournalEntry(String(entry._id))} className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{entry.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Contract Sheet ───────────────────────────────── */}
      <Sheet open={contratSheet.open} onOpenChange={(open) => setContratSheet((s) => ({ ...s, open }))}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{contratSheet.editId ? "Modifier le contrat" : "Nouveau contrat"}</SheetTitle>
            <SheetDescription>
              {contratSheet.editId ? "Modifie les informations de cette période." : "Ajoute une nouvelle période contractuelle."}
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type de contrat</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CONTRAT_TYPES.map((t) => {
                  const cfg = CONTRAT_CONFIG[t];
                  return (
                    <button key={t} type="button" onClick={() => setContratForm((f) => ({ ...f, type: t }))}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        contratForm.type === t ? cn(cfg.color, "ring-2 ring-offset-1 ring-sky-300") : "bg-muted text-muted-foreground hover:bg-accent"
                      )}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date de début</label>
                <Input type="date" value={contratForm.dateDebut} onChange={(e) => setContratForm((f) => ({ ...f, dateDebut: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date de fin</label>
                <Input type="date" value={contratForm.dateFin} onChange={(e) => setContratForm((f) => ({ ...f, dateFin: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
            </div>

            {/* Poste / Pole / Entite */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Poste</label>
              <Input value={contratForm.poste} onChange={(e) => setContratForm((f) => ({ ...f, poste: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Ex: Chargé de production" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pôle</label>
                <select value={contratForm.pole} onChange={(e) => setContratForm((f) => ({ ...f, pole: e.target.value }))}
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">—</option>
                  {POLE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entité</label>
                <select value={contratForm.entite} onChange={(e) => setContratForm((f) => ({ ...f, entite: e.target.value }))}
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">—</option>
                  {ENTITE_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Intermittent fields */}
            {contratForm.type === "intermittent" && (
              <div className="space-y-3 p-3 rounded-lg border border-rose-200 bg-rose-50/30">
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Intermittent du spectacle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">N° GUSO</label>
                    <Input value={contratForm.gusoNumber} onChange={(e) => setContratForm((f) => ({ ...f, gusoNumber: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="9 chiffres" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tarif / jour (€)</label>
                    <Input type="number" value={contratForm.tarifJournalier} onChange={(e) => setContratForm((f) => ({ ...f, tarifJournalier: e.target.value }))} className="mt-1 h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <div className="flex gap-2 mt-1">
                    {["technicien", "artiste"].map((t) => (
                      <button key={t} type="button" onClick={() => setContratForm((f) => ({ ...f, typeIntermittent: t }))}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          contratForm.typeIntermittent === t ? "bg-rose-100 text-rose-700 border-rose-300" : "bg-white text-muted-foreground hover:bg-rose-50"
                        )}>
                        {t === "technicien" ? "Technicien" : "Artiste"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Facture fields */}
            {contratForm.type === "facture" && (
              <div className="space-y-3 p-3 rounded-lg border border-orange-200 bg-orange-50/30">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Prestataire sur facture</p>
                <div>
                  <label className="text-xs text-muted-foreground">SIRET</label>
                  <Input value={contratForm.siret} onChange={(e) => setContratForm((f) => ({ ...f, siret: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="14 chiffres" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Raison sociale</label>
                  <Input value={contratForm.raisonSociale} onChange={(e) => setContratForm((f) => ({ ...f, raisonSociale: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Nom de la société" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tarif / jour (€)</label>
                  <Input type="number" value={contratForm.tarifJournalier} onChange={(e) => setContratForm((f) => ({ ...f, tarifJournalier: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
              </div>
            )}

            {/* Commentaire */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Commentaire</label>
              <textarea
                value={contratForm.commentaire}
                onChange={(e) => setContratForm((f) => ({ ...f, commentaire: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                placeholder="Notes sur cette période..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setContratSheet({ open: false, editId: null })} className="flex-1">Annuler</Button>
              <Button onClick={saveContrat} disabled={contratSaving || !contratForm.type || !contratForm.dateDebut} className="flex-1">
                {contratSaving ? "Enregistrement..." : contratSheet.editId ? "Modifier" : "Créer le contrat"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
