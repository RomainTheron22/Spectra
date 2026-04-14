"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Plus, Search, Users, Briefcase, Building2, Filter,
  UserCheck, GraduationCap, Clock, FileText, Euro, Clapperboard,
  Mail, Phone, Calendar, ChevronRight, ChevronDown, Layers, LayoutGrid, ArrowDownAZ, ArrowUpAZ,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────
const CONTRAT_CONFIG = {
  cdi:          { label: "CDI",          color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: UserCheck },
  cdd:          { label: "CDD",          color: "bg-sky-50 text-sky-700 border-sky-200",           icon: Clock },
  alternance:   { label: "Alternance",   color: "bg-violet-50 text-violet-700 border-violet-200", icon: GraduationCap },
  stage:        { label: "Stage",        color: "bg-amber-50 text-amber-700 border-amber-200",     icon: GraduationCap },
  intermittent: { label: "Intermittent", color: "bg-rose-50 text-rose-700 border-rose-200",       icon: Clapperboard },
  facture:      { label: "Facture",      color: "bg-orange-50 text-orange-700 border-orange-200", icon: Euro },
};

const POLE_OPTIONS = ["Communication", "Scénographie", "Atelier", "FabLab", "Production Audiovisuelle", "Administration", "Direction"];
const ENTITE_OPTIONS = ["CreativGen", "Fantasmagorie"];
const CONTRAT_TYPES = Object.keys(CONTRAT_CONFIG);
const JOURS_LABELS = { lun: "L", mar: "M", mer: "Me", jeu: "J", ven: "V", sam: "S", dim: "D" };
const JOURS = [
  { key: "lun", label: "L" }, { key: "mar", label: "M" }, { key: "mer", label: "Me" },
  { key: "jeu", label: "J" }, { key: "ven", label: "V" }, { key: "sam", label: "S" }, { key: "dim", label: "D" },
];

const POLE_COLORS = {
  "Production Audiovisuelle": "#7c3aed", "Scénographie": "#0891b2", "Atelier": "#059669",
  "FabLab": "#ca8a04", "Communication": "#0284c7", "Administration": "#6b7280", "Direction": "#e11d48",
};

function emptyForm() {
  return {
    nom: "", prenom: "", email: "", contrat: "cdi",
    joursPresence: ["lun", "mar", "mer", "jeu", "ven"],
    dateDebut: "", dateFin: "", pole: "", entite: "", congesAnnuels: 25,
    telephone: "", poste: "",
    // Intermittent
    numeroGuso: "", typeIntermittent: "technicien", tarifJournalier: "",
    // Facture
    siret: "", societe: "",
  };
}

export default function ProfilsPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Filters & view
  const [search, setSearch] = useState("");
  const [filterContrat, setFilterContrat] = useState("");
  const [filterPole, setFilterPole] = useState("");
  const [filterEntite, setFilterEntite] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "branch"
  const [sortOrder, setSortOrder] = useState("az"); // "az" | "za"
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/employee-profiles?active=${!showInactive ? "true" : "false"}`, { cache: "no-store" });
      const data = await res.json();
      if (!cancelled) { setProfiles(data.items || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [showInactive]);

  const filtered = useMemo(() => {
    let list = profiles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        `${p.prenom} ${p.nom} ${p.email || ""} ${p.poste || ""}`.toLowerCase().includes(q)
      );
    }
    if (filterContrat) list = list.filter((p) => p.contrat === filterContrat);
    if (filterPole) list = list.filter((p) => p.pole === filterPole);
    if (filterEntite) list = list.filter((p) => p.entite === filterEntite);
    list = [...list].sort((a, b) => {
      const cmp = (a.nom || "").localeCompare(b.nom || "", "fr");
      return sortOrder === "az" ? cmp : -cmp;
    });
    return list;
  }, [profiles, search, filterContrat, filterPole, filterEntite, sortOrder]);

  const groupedByPole = useMemo(() => {
    const groups = {};
    for (const p of filtered) {
      const pole = p.pole || "Sans pôle";
      if (!groups[pole]) groups[pole] = { label: pole, color: POLE_COLORS[pole] || "#6b7280", employees: [] };
      groups[pole].employees.push(p);
    }
    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [filtered]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: profiles.length };
    for (const t of CONTRAT_TYPES) s[t] = profiles.filter((p) => p.contrat === t).length;
    s.fantasmagorie = profiles.filter((p) => p.entite === "Fantasmagorie").length;
    s.creativgen = profiles.filter((p) => p.entite === "CreativGen").length;
    return s;
  }, [profiles]);

  function toggleJour(jour) {
    setForm((f) => ({
      ...f,
      joursPresence: f.joursPresence.includes(jour)
        ? f.joursPresence.filter((j) => j !== jour)
        : [...f.joursPresence, jour],
    }));
  }

  function openNew() {
    setForm(emptyForm());
    setSheetOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      congesAnnuels: parseInt(form.congesAnnuels) || 25,
      tarifJournalier: form.tarifJournalier !== "" ? Number(form.tarifJournalier) : undefined,
    };
    // Clean up type-specific fields
    if (form.contrat !== "intermittent") { delete payload.numeroGuso; delete payload.typeIntermittent; }
    if (form.contrat !== "facture") { delete payload.siret; delete payload.societe; }
    if (form.contrat !== "intermittent" && form.contrat !== "facture") { delete payload.tarifJournalier; }

    const res = await fetch("/api/employee-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }
    setProfiles((prev) => [...prev, data.item]);
    setSheetOpen(false);
  }

  const hasFilters = filterContrat || filterPole || filterEntite;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Profils Employés</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestion des profils, contrats et périodes</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1.5" /> Ajouter un employé
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-bold">{stats.total}</span>
          <span className="text-muted-foreground">total</span>
        </div>
        {CONTRAT_TYPES.map((t) => stats[t] > 0 && (
          <button key={t} onClick={() => setFilterContrat(filterContrat === t ? "" : t)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
              filterContrat === t ? cn(CONTRAT_CONFIG[t].color, "ring-2 ring-offset-1 ring-sky-300") : CONTRAT_CONFIG[t].color
            )}>
            <span className="font-bold">{stats[t]}</span>
            <span>{CONTRAT_CONFIG[t].label}</span>
          </button>
        ))}
        <Separator orientation="vertical" className="h-8 mx-1" />
        {[{ key: "fantasmagorie", label: "Fantasmagorie" }, { key: "creativgen", label: "CreativGen" }].map((e) => stats[e.key] > 0 && (
          <button key={e.key} onClick={() => setFilterEntite(filterEntite === e.label ? "" : e.label)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
              filterEntite === e.label ? "bg-sky-50 text-sky-700 border-sky-200 ring-2 ring-offset-1 ring-sky-300" : "bg-muted text-muted-foreground"
            )}>
            <span className="font-bold">{stats[e.key]}</span>
            <span>{e.label}</span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, email, poste..." className="pl-8 h-9 text-sm" />
        </div>
        <select value={filterPole} onChange={(e) => setFilterPole(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground">
          <option value="">Tous les pôles</option>
          {POLE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Vue: grille / branche */}
        <div className="flex rounded-md border bg-card p-0.5">
          <button onClick={() => setViewMode("grid")} className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all", viewMode === "grid" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <LayoutGrid className="w-3.5 h-3.5" />Grille
          </button>
          <button onClick={() => setViewMode("branch")} className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all", viewMode === "branch" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Layers className="w-3.5 h-3.5" />Branche
          </button>
        </div>

        {/* Tri A-Z / Z-A */}
        <button onClick={() => setSortOrder((s) => s === "az" ? "za" : "az")}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
          {sortOrder === "az" ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpAZ className="w-3.5 h-3.5" />}
          {sortOrder === "az" ? "A → Z" : "Z → A"}
        </button>

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Inactifs
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterContrat(""); setFilterPole(""); setFilterEntite(""); }} className="text-xs h-7">
            Effacer filtres
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {search || hasFilters ? "Aucun résultat pour ces filtres" : "Aucun employé. Commence par en ajouter un."}
        </div>
      ) : viewMode === "branch" ? (
        /* ── Vue par branche ── */
        <div className="space-y-3">
          {groupedByPole.map((group) => {
            const isOpen = openGroups[group.label] !== false;
            return (
              <Collapsible key={group.label} open={isOpen} onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.label]: open }))}>
                <CollapsibleTrigger className="flex items-center w-full px-4 py-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="text-[14px] font-semibold text-foreground">{group.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5">{group.employees.length}</Badge>
                  <ChevronDown className={cn("ml-auto w-4 h-4 text-muted-foreground transition-transform duration-150", isOpen ? "" : "-rotate-90")} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 pl-5 border-l-2" style={{ borderLeftColor: group.color }}>
                    {group.employees.map((p) => {
                      const cc = CONTRAT_CONFIG[p.contrat] || CONTRAT_CONFIG.cdi;
                      return (
                        <Link key={String(p._id)} href={`/rh/employe/${String(p._id)}`} className="group">
                          <Card className="transition-all hover:shadow-md hover:border-sky-200 group-hover:border-sky-200">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2.5">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: `${group.color}18`, color: group.color }}>
                                  {(p.prenom || "?")[0].toUpperCase()}{(p.nom || "?")[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[13px] truncate">{p.prenom} {p.nom}</span>
                                    <Badge variant="outline" className={cn("text-[10px] border shrink-0", cc.color)}>{cc.label}</Badge>
                                  </div>
                                  {p.poste && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.poste}</p>}
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                    {p.entite && <span>{p.entite}</span>}
                                  </div>
                                  <div className="flex gap-0.5 mt-1">
                                    {JOURS.map((j) => (
                                      <span key={j.key} className={cn("w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center",
                                        (p.joursPresence || []).includes(j.key) ? "bg-sky-100 text-sky-600" : "bg-muted text-muted-foreground/30"
                                      )}>{j.label}</span>
                                    ))}
                                  </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        /* ── Vue grille plate ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const cc = CONTRAT_CONFIG[p.contrat] || CONTRAT_CONFIG.cdi;
            const poleColor = POLE_COLORS[p.pole] || "#6b7280";
            return (
              <Link key={String(p._id)} href={`/rh/employe/${String(p._id)}`} className="group">
                <Card className="transition-all hover:shadow-md hover:border-sky-200 group-hover:border-sky-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: `${poleColor}18`, color: poleColor }}>
                        {(p.prenom || "?")[0].toUpperCase()}{(p.nom || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{p.prenom} {p.nom}</span>
                          <Badge variant="outline" className={cn("text-[10px] border shrink-0", cc.color)}>{cc.label}</Badge>
                        </div>
                        {p.poste && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.poste}</p>}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          {p.pole && <span>{p.pole}</span>}
                          {p.entite && <span>· {p.entite}</span>}
                        </div>
                        <div className="flex gap-0.5 mt-1.5">
                          {JOURS.map((j) => (
                            <span key={j.key} className={cn("w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center",
                              (p.joursPresence || []).includes(j.key) ? "bg-sky-100 text-sky-600" : "bg-muted text-muted-foreground/30"
                            )}>{j.label}</span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                    </div>
                    {!p.isActive && p.isActive !== undefined && (
                      <Badge variant="outline" className="mt-2 text-[10px] bg-muted text-muted-foreground">Inactif</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* ─── Creation Sheet ───────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nouvel employé</SheetTitle>
            <SheetDescription>Ajoute un nouveau profil employé.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Prenom / Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prénom *</label>
                <Input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} required className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nom *</label>
                <Input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} required className="mt-1 h-8 text-sm" />
              </div>
            </div>

            {/* Email / Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Téléphone</label>
                <Input type="tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
            </div>

            {/* Poste */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Poste</label>
              <Input value={form.poste} onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Ex: Chargé de production" />
            </div>

            {/* Contrat type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type de contrat *</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CONTRAT_TYPES.map((t) => {
                  const cfg = CONTRAT_CONFIG[t];
                  return (
                    <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, contrat: t }))}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        form.contrat === t ? cn(cfg.color, "ring-2 ring-offset-1 ring-sky-300") : "bg-muted text-muted-foreground hover:bg-accent"
                      )}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pole / Entite */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pôle</label>
                <select value={form.pole} onChange={(e) => setForm((f) => ({ ...f, pole: e.target.value }))}
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">— Choisir —</option>
                  {POLE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entité</label>
                <select value={form.entite} onChange={(e) => setForm((f) => ({ ...f, entite: e.target.value }))}
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">— Choisir —</option>
                  {ENTITE_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Jours de présence */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Jours de présence</label>
              <div className="flex gap-1.5 mt-1.5">
                {JOURS.map((j) => (
                  <button key={j.key} type="button" onClick={() => toggleJour(j.key)}
                    className={cn("w-9 h-9 rounded-lg text-xs font-bold transition-all",
                      form.joursPresence.includes(j.key) ? "bg-sky-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}>
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates / Congés */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date d'entrée</label>
                <Input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date de fin</label>
                <Input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Congés / an</label>
                <Input type="number" value={form.congesAnnuels} onChange={(e) => setForm((f) => ({ ...f, congesAnnuels: e.target.value }))} min={0} className="mt-1 h-8 text-sm" />
              </div>
            </div>

            {/* Intermittent fields */}
            {form.contrat === "intermittent" && (
              <div className="space-y-3 p-3 rounded-lg border border-rose-200 bg-rose-50/30">
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Intermittent du spectacle</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">N° GUSO</label>
                    <Input value={form.numeroGuso} onChange={(e) => setForm((f) => ({ ...f, numeroGuso: e.target.value }))} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tarif / jour (€)</label>
                    <Input type="number" value={form.tarifJournalier} onChange={(e) => setForm((f) => ({ ...f, tarifJournalier: e.target.value }))} className="mt-1 h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <div className="flex gap-2 mt-1">
                    {["technicien", "artiste"].map((t) => (
                      <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, typeIntermittent: t }))}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          form.typeIntermittent === t ? "bg-rose-100 text-rose-700 border-rose-300" : "bg-white text-muted-foreground hover:bg-rose-50"
                        )}>
                        {t === "technicien" ? "Technicien" : "Artiste"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Facture fields */}
            {form.contrat === "facture" && (
              <div className="space-y-3 p-3 rounded-lg border border-orange-200 bg-orange-50/30">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Prestataire sur facture</p>
                <div>
                  <label className="text-xs text-muted-foreground">SIRET</label>
                  <Input value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Société</label>
                  <Input value={form.societe} onChange={(e) => setForm((f) => ({ ...f, societe: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tarif / jour (€)</label>
                  <Input type="number" value={form.tarifJournalier} onChange={(e) => setForm((f) => ({ ...f, tarifJournalier: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">Annuler</Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Création..." : "Créer le profil"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
