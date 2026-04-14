"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Palette, Plus, Pencil, Trash2, Eye, Calendar, Briefcase, Users, Check } from "lucide-react";

const PRESET_COLORS = [
  "#e11d48", "#f43f5e", "#fb7185", "#ec4899", "#d946ef", "#a855f6",
  "#7c3aed", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#0891b2",
  "#14b8a6", "#10b981", "#059669", "#22c55e", "#84cc16", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#78716c", "#6b7280", "#0284c7",
];

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ key: "", label: "", color: "#7c3aed", description: "", poles: "", gcalKeyword: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/branches", { cache: "no-store" });
      const data = await res.json();
      setBranches(data.items || []);
      setLoading(false);
    })();
  }, []);

  function openNew() {
    setEditId(null);
    setForm({ key: "", label: "", color: "#7c3aed", description: "", poles: "", gcalKeyword: "" });
    setSheetOpen(true);
  }

  function openEdit(b) {
    setEditId(String(b._id));
    setForm({ key: b.key || "", label: b.label || "", color: b.color || "#7c3aed", description: b.description || "", poles: (b.poles || []).join(", "), gcalKeyword: b.gcalKeyword || "" });
    setSheetOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const body = { key: form.key, label: form.label, color: form.color, description: form.description, poles: form.poles.split(",").map((s) => s.trim()).filter(Boolean), gcalKeyword: form.gcalKeyword || form.key.toLowerCase() };
    const url = editId ? `/api/branches/${editId}` : "/api/branches";
    const res = await fetch(url, { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }
    if (editId) setBranches((prev) => prev.map((b) => String(b._id) === editId ? data.item : b));
    else setBranches((prev) => [...prev, data.item]);
    setSheetOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette branche ?")) return;
    const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
    if (res.ok) { setBranches((prev) => prev.filter((b) => String(b._id) !== id)); setSheetOpen(false); }
  }

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground !bg-none !text-foreground" style={{ background: "none", WebkitTextFillColor: "unset" }}>
            Branches & Couleurs
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-lg">
            Les couleurs des branches sont utilisées partout : Planning Équipe, Mon Planning, Projets, Calendrier. Modifier une couleur ici la change dans toute l&apos;application.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nouvelle branche
        </Button>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[12px] font-medium" style={{ backgroundColor: "#ede9fe", color: "#5b21b6", border: "1px solid #ddd6fe" }}>
        <Palette className="w-4 h-4 flex-shrink-0" />
        <span>Ces couleurs s&apos;appliquent à : <strong>Planning Équipe</strong>, <strong>Mon Planning</strong>, <strong>Vue Projets</strong>, <strong>Calendrier</strong>, <strong>Google Agenda</strong></span>
      </div>

      {/* Branches grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {branches.map((b) => (
            <button key={String(b._id)} onClick={() => openEdit(b)} className="text-left group">
              <Card className="transition-all hover:shadow-md group-hover:border-zinc-300 overflow-hidden">
                {/* Color bar */}
                <div className="h-2" style={{ backgroundColor: b.color }} />
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: b.color }}>
                      {(b.label || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-zinc-800">{b.label}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">{b.key}</div>
                    </div>
                    <Pencil className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                  </div>
                  {b.description && <p className="text-[12px] text-zinc-500 mb-2 line-clamp-2">{b.description}</p>}
                  {b.poles?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {b.poles.map((p, i) => (
                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: `${b.color}12`, color: b.color }}>{p}</span>
                      ))}
                    </div>
                  )}
                  {/* Preview strip */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                    <Eye className="w-3 h-3 text-zinc-400" />
                    <span className="text-[10px] text-zinc-400">Aperçu :</span>
                    <div className="flex gap-1 items-center">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="w-8 h-1.5 rounded-full" style={{ backgroundColor: `${b.color}40` }} />
                      <span className="w-5 h-1.5 rounded-full" style={{ backgroundColor: `${b.color}20` }} />
                    </div>
                    <span className="text-[10px] font-medium ml-auto" style={{ color: b.color }}>{b.color}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}

          {/* Add button card */}
          <button onClick={openNew} className="text-left group">
            <Card className="transition-all hover:shadow-md hover:border-violet-300 border-dashed h-full">
              <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[140px] text-muted-foreground group-hover:text-violet-600">
                <Plus className="w-6 h-6 mb-2" />
                <span className="text-[13px] font-semibold">Ajouter une branche</span>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {/* Edit/Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Modifier la branche" : "Nouvelle branche"}</SheetTitle>
            <SheetDescription>La couleur sera appliquée partout dans Spectra.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Live preview */}
            <div className="rounded-lg p-4" style={{ backgroundColor: "#f4f4f5" }}>
              <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Aperçu en direct</div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-sm" style={{ backgroundColor: form.color }}>
                  {(form.label || "?")[0]}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-zinc-800">{form.label || "Nom de la branche"}</div>
                  <div className="text-[11px] font-mono text-zinc-400">{form.key || "cle"}</div>
                </div>
              </div>
              {/* Mini calendar preview */}
              <div className="flex gap-1 items-center mb-1">
                <Calendar className="w-3 h-3 text-zinc-400" />
                <span className="text-[10px] text-zinc-400">Planning</span>
              </div>
              <div className="flex gap-px">
                {["L", "M", "M", "J", "V"].map((d, i) => (
                  <div key={i} className="flex-1 h-7 rounded-sm flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: i < 3 ? `${form.color}15` : "#fff", borderLeft: i < 3 ? `2px solid ${form.color}` : "none", color: i < 3 ? form.color : "#a1a1aa" }}>
                    {i < 3 ? <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: form.color }} /> : d}
                  </div>
                ))}
              </div>
              {/* Project preview */}
              <div className="flex items-center gap-2 mt-2">
                <Briefcase className="w-3 h-3 text-zinc-400" />
                <div className="flex-1 h-3 rounded-full" style={{ backgroundColor: `${form.color}30` }}>
                  <div className="h-full w-3/5 rounded-full" style={{ backgroundColor: form.color }} />
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Nom affiché *</label>
                <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, key: editId ? f.key : e.target.value.replace(/\s+/g, "") }))} required placeholder="Entertainment" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Clé technique</label>
                <Input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} required placeholder="Entertainment" disabled={!!editId} className="mt-1 h-9 text-sm" />
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Couleur de la branche</label>
              <div className="flex items-center gap-3 mt-2">
                {/* Native color input */}
                <div className="relative">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-zinc-200 p-0.5"
                  />
                </div>
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#7c3aed"
                  className="h-9 text-sm font-mono w-28"
                />
                <div className="w-6 h-6 rounded-md shadow-inner" style={{ backgroundColor: form.color }} />
              </div>
              {/* Preset palette */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={cn("w-7 h-7 rounded-lg transition-all hover:scale-110 relative", form.color === c ? "ring-2 ring-offset-2 ring-zinc-800 scale-110" : "ring-1 ring-black/10")}
                    style={{ backgroundColor: c }}
                  >
                    {form.color === c && <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Ce que fait cette branche..." className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Pôles associés <span className="normal-case text-zinc-400">(séparés par des virgules)</span></label>
              <Input value={form.poles} onChange={(e) => setForm((f) => ({ ...f, poles: e.target.value }))} placeholder="Production Audiovisuelle, Scénographie..." className="mt-1 h-9 text-sm" />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Mot-clé Google Agenda</label>
              <Input value={form.gcalKeyword} onChange={(e) => setForm((f) => ({ ...f, gcalKeyword: e.target.value }))} placeholder="agency, entertainment..." className="mt-1 h-9 text-sm" />
              <p className="text-[10px] text-zinc-400 mt-1">Utilisé pour associer automatiquement les événements Google Agenda à cette branche.</p>
            </div>

            {/* Where it's used */}
            <div className="rounded-lg p-3" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider mb-1.5">Cette couleur sera visible dans</div>
              <div className="flex flex-wrap gap-1.5">
                {["Planning Équipe", "Mon Planning", "Projets", "Calendrier", "Google Agenda"].map((place) => (
                  <span key={place} className="text-[10px] font-medium text-emerald-600 bg-white px-2 py-0.5 rounded border border-emerald-200">{place}</span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {editId && (
                <Button type="button" variant="outline" onClick={() => handleDelete(editId)} className="text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                </Button>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving || !form.label}>{saving ? "..." : editId ? "Enregistrer" : "Créer"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
