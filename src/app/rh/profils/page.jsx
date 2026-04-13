"use client";

import React, { useEffect, useState } from "react";
import styles from "./Profils.module.css";
import Modal from "../../../components/ui/Modal";

const CONTRAT_OPTIONS = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "alternance", label: "Alternance" },
  { value: "stage", label: "Stage" },
];

const POLE_OPTIONS = [
  "Communication",
  "Scénographie",
  "Atelier",
  "FabLab",
  "Production Audiovisuelle",
  "Administration",
  "Direction",
];

const ENTITE_OPTIONS = ["CreativGen", "Fantasmagorie"];

const JOURS = [
  { key: "lun", label: "Lun" },
  { key: "mar", label: "Mar" },
  { key: "mer", label: "Mer" },
  { key: "jeu", label: "Jeu" },
  { key: "ven", label: "Ven" },
];

const CONTRAT_COLORS = {
  cdi: { bg: "rgba(34,197,94,0.12)", color: "#166534", border: "rgba(34,197,94,0.25)" },
  cdd: { bg: "rgba(14,165,233,0.12)", color: "#0c4a6e", border: "rgba(14,165,233,0.25)" },
  alternance: { bg: "rgba(139,92,246,0.12)", color: "#6d28d9", border: "rgba(139,92,246,0.25)" },
  stage: { bg: "rgba(249,115,22,0.12)", color: "#9a3412", border: "rgba(249,115,22,0.25)" },
};

function emptyForm() {
  return { nom: "", prenom: "", email: "", contrat: "cdi", joursPresence: ["lun", "mar", "mer", "jeu", "ven"], dateDebut: "", dateFin: "", pole: "", entite: "", congesAnnuels: 25 };
}

export default function ProfilsPage() {
  const [profiles, setProfiles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/employee-profiles?active=${!showInactive ? "true" : "false"}`, { cache: "no-store" });
      const data = await res.json();
      if (!cancelled) setProfiles(data.items || []);
    })();
    return () => { cancelled = true; };
  }, [showInactive]);

  function openNew() {
    setEditId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditId(String(p._id));
    setForm({
      nom: p.nom || "",
      prenom: p.prenom || "",
      email: p.email || "",
      contrat: p.contrat || "cdi",
      joursPresence: p.joursPresence || ["lun", "mar", "mer", "jeu", "ven"],
      dateDebut: p.dateDebut || "",
      dateFin: p.dateFin || "",
      pole: p.pole || "",
      entite: p.entite || "",
      congesAnnuels: p.congesAnnuels ?? 25,
    });
    setModalOpen(true);
  }

  function toggleJour(jour) {
    setForm((f) => ({
      ...f,
      joursPresence: f.joursPresence.includes(jour)
        ? f.joursPresence.filter((j) => j !== jour)
        : [...f.joursPresence, jour],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const url = editId ? `/api/employee-profiles/${editId}` : "/api/employee-profiles";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }

    if (editId) {
      setProfiles((prev) => prev.map((p) => (String(p._id) === editId ? data.item : p)));
    } else {
      setProfiles((prev) => [...prev, data.item]);
    }
    setModalOpen(false);
  }

  async function handleDeactivate(id) {
    if (!confirm("Désactiver ce profil ?")) return;
    const res = await fetch(`/api/employee-profiles/${id}`, { method: "DELETE" });
    if (res.ok) setProfiles((prev) => prev.filter((p) => String(p._id) !== id));
  }

  const stats = {
    total: profiles.length,
    cdi: profiles.filter((p) => p.contrat === "cdi").length,
    alternance: profiles.filter((p) => p.contrat === "alternance").length,
    stage: profiles.filter((p) => p.contrat === "stage").length,
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Profils Employés</h1>
          <p className={styles.subtitle}>Gestion des profils, contrats et jours de présence</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primaryButton} onClick={openNew}>+ Ajouter un employé</button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Employés</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue} style={{ color: "#166534" }}>{stats.cdi}</span>
          <span className={styles.statLabel}>CDI</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue} style={{ color: "#6d28d9" }}>{stats.alternance}</span>
          <span className={styles.statLabel}>Alternants</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue} style={{ color: "#9a3412" }}>{stats.stage}</span>
          <span className={styles.statLabel}>Stagiaires</span>
        </div>
      </div>

      {/* Toggle inactifs */}
      <label className={styles.toggleLabel}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Afficher les inactifs
      </label>

      {/* Liste */}
      <div className={styles.grid}>
        {profiles.map((p) => {
          const cc = CONTRAT_COLORS[p.contrat] || CONTRAT_COLORS.cdi;
          const joursLabel = (p.joursPresence || []).join(", ");
          return (
            <div key={String(p._id)} className={styles.profileCard} onClick={() => openEdit(p)}>
              <div className={styles.profileHeader}>
                <span className={styles.profileName}>{p.prenom} {p.nom}</span>
                <span className={styles.contratBadge} style={{ background: cc.bg, color: cc.color, borderColor: cc.border }}>
                  {CONTRAT_OPTIONS.find((c) => c.value === p.contrat)?.label || p.contrat}
                </span>
              </div>
              {p.pole && <div className={styles.profileMeta}>{p.pole}{p.entite ? ` · ${p.entite}` : ""}</div>}
              <div className={styles.profileMeta}>Jours : {joursLabel || "—"}</div>
              {p.dateDebut && (
                <div className={styles.profileMeta}>
                  {p.dateDebut}{p.dateFin ? ` → ${p.dateFin}` : " → en cours"}
                </div>
              )}
              <div className={styles.profileMeta}>Congés : {p.congesAnnuels ?? 25}j/an</div>
              {!p.isActive && p.isActive !== undefined && (
                <span className={styles.inactiveBadge}>Inactif</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Modale */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Modifier le profil" : "Nouvel employé"} size="md">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Prénom
              <input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} required />
            </label>
            <label className={styles.fieldLabel}>
              Nom
              <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} required />
            </label>
          </div>

          <label className={styles.fieldLabel}>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Type de contrat
              <select value={form.contrat} onChange={(e) => setForm((f) => ({ ...f, contrat: e.target.value }))}>
                {CONTRAT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Pôle
              <select value={form.pole} onChange={(e) => setForm((f) => ({ ...f, pole: e.target.value }))}>
                <option value="">— Choisir —</option>
                {POLE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Entité
              <select value={form.entite} onChange={(e) => setForm((f) => ({ ...f, entite: e.target.value }))}>
                <option value="">— Choisir —</option>
                {ENTITE_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.fieldLabel}>
            Jours de présence
            <div className={styles.joursRow}>
              {JOURS.map((j) => (
                <button
                  key={j.key}
                  type="button"
                  className={`${styles.jourBtn} ${form.joursPresence.includes(j.key) ? styles.jourBtnActive : ""}`}
                  onClick={() => toggleJour(j.key)}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Date d'entrée
              <input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} />
            </label>
            <label className={styles.fieldLabel}>
              Date de fin (si applicable)
              <input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} />
            </label>
            <label className={styles.fieldLabel}>
              Congés annuels (jours)
              <input type="number" value={form.congesAnnuels} onChange={(e) => setForm((f) => ({ ...f, congesAnnuels: parseInt(e.target.value) || 25 }))} min={0} />
            </label>
          </div>

          <div className={styles.formActions}>
            {editId && (
              <button type="button" className={styles.dangerBtn} onClick={() => { setModalOpen(false); handleDeactivate(editId); }}>
                Désactiver
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? "Enregistrement..." : editId ? "Modifier" : "Créer le profil"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
