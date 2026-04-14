"use client";

import React, { useEffect, useState } from "react";
import styles from "./Branches.module.css";
import Modal from "../../../components/ui/Modal";

const PRESET_COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#ca8a04", "#059669", "#0284c7", "#f43f5e", "#8b5cf6", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ key: "", label: "", color: "#7c3aed", description: "", poles: "", gcalKeyword: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/branches", { cache: "no-store" });
      const data = await res.json();
      setBranches(data.items || []);
    })();
  }, []);

  function openNew() {
    setEditId(null);
    setForm({ key: "", label: "", color: "#7c3aed", description: "", poles: "", gcalKeyword: "" });
    setModalOpen(true);
  }

  function openEdit(b) {
    setEditId(String(b._id));
    setForm({
      key: b.key || "",
      label: b.label || "",
      color: b.color || "#7c3aed",
      description: b.description || "",
      poles: (b.poles || []).join(", "),
      gcalKeyword: b.gcalKeyword || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const body = {
      key: form.key,
      label: form.label,
      color: form.color,
      description: form.description,
      poles: form.poles.split(",").map((s) => s.trim()).filter(Boolean),
      gcalKeyword: form.gcalKeyword || form.key.toLowerCase(),
    };

    const url = editId ? `/api/branches/${editId}` : "/api/branches";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }

    if (editId) {
      setBranches((prev) => prev.map((b) => String(b._id) === editId ? data.item : b));
    } else {
      setBranches((prev) => [...prev, data.item]);
    }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette branche ?")) return;
    const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
    if (res.ok) setBranches((prev) => prev.filter((b) => String(b._id) !== id));
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Configuration des branches</h1>
          <p className={styles.subtitle}>Les branches définissent les pôles d'activité du groupe. Elles sont utilisées dans le calendrier, les projets, et les profils.</p>
        </div>
        <button className={styles.addBtn} onClick={openNew}>+ Ajouter une branche</button>
      </div>

      <div className={styles.grid}>
        {branches.map((b) => (
          <div key={String(b._id)} className={styles.card} style={{ "--bc": b.color }} onClick={() => openEdit(b)}>
            <div className={styles.cardHeader}>
              <span className={styles.cardColor} style={{ background: b.color }} />
              <span className={styles.cardLabel}>{b.label}</span>
              <span className={styles.cardKey}>{b.key}</span>
            </div>
            {b.description && <p className={styles.cardDesc}>{b.description}</p>}
            {b.poles?.length > 0 && (
              <div className={styles.cardPoles}>
                {b.poles.map((p, i) => <span key={i} className={styles.cardPole}>{p}</span>)}
              </div>
            )}
            {b.gcalKeyword && <div className={styles.cardGcal}>Google Agenda : recherche "{b.gcalKeyword}"</div>}
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Modifier la branche" : "Nouvelle branche"} size="sm">
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>Nom affiché *
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, key: editId ? f.key : e.target.value.replace(/\s+/g, "") }))} required placeholder="Entertainment, Agency..." />
          </label>
          <label className={styles.field}>Clé technique
            <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} required placeholder="Entertainment" disabled={!!editId} />
          </label>
          <div className={styles.field}>Couleur
            <div className={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" className={`${styles.colorBtn} ${form.color === c ? styles.colorBtnOn : ""}`} style={{ background: c }} onClick={() => setForm((f) => ({ ...f, color: c }))} />
              ))}
            </div>
          </div>
          <label className={styles.field}>Description
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Ce que fait cette branche..." />
          </label>
          <label className={styles.field}>Pôles associés <span className={styles.hint}>(séparés par des virgules)</span>
            <input value={form.poles} onChange={(e) => setForm((f) => ({ ...f, poles: e.target.value }))} placeholder="Production Audiovisuelle, Scénographie..." />
          </label>
          <label className={styles.field}>Mot-clé Google Agenda <span className={styles.hint}>(pour associer un calendrier Google)</span>
            <input value={form.gcalKeyword} onChange={(e) => setForm((f) => ({ ...f, gcalKeyword: e.target.value }))} placeholder="agency, entertainment..." />
          </label>
          <div className={styles.formActions}>
            {editId && <button type="button" className={styles.deleteBtn} onClick={() => { setModalOpen(false); handleDelete(editId); }}>Supprimer</button>}
            <div style={{ flex: 1 }} />
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={saving || !form.label}>{saving ? "..." : editId ? "Enregistrer" : "Créer"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
