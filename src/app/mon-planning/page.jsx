"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./MonPlanning.module.css";
import Modal from "../../components/ui/Modal";

const TYPE_OPTIONS = [
  { value: "conge", label: "Congé", color: "#22c55e", icon: "🌴", desc: "Vacances, repos, journée perso" },
  { value: "tt", label: "Télétravail", color: "#0ea5e9", icon: "🏠", desc: "Je bosse de chez moi" },
  { value: "maladie", label: "Maladie", color: "#ef4444", icon: "🤒", desc: "Arrêt maladie" },
  { value: "absence_autre", label: "Autre", color: "#a855f7", icon: "📋", desc: "RDV, formation, perso..." },
];

const STATUT_LABELS = {
  en_attente: { label: "En attente", className: "statutAttente" },
  valide: { label: "Validé", className: "statutValide" },
  refuse: { label: "Refusé", className: "statutRefuse" },
};

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS_SEMAINE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Métaphores bien-être pour les congés restants
const CONGE_VIBES = [
  { min: 25, emoji: "🌍", message: "Un tour du monde t'attend" },
  { min: 20, emoji: "⛩️", message: "Cap sur le Japon — 3 semaines d'évasion" },
  { min: 15, emoji: "🚗", message: "Road trip sur la côte californienne" },
  { min: 10, emoji: "🌴", message: "Deux semaines sous les cocotiers" },
  { min: 7, emoji: "🏝️", message: "Une semaine à Bali, ça te dit ?" },
  { min: 4, emoji: "✈️", message: "Un city-trip à Lisbonne" },
  { min: 2, emoji: "⛰️", message: "Un week-end prolongé à la montagne" },
  { min: 1, emoji: "🧘", message: "Une journée pour toi, juste pour toi" },
  { min: 0, emoji: "⚡", message: "Recharge terminée — full power !" },
];

function getCongeVibe(jours) {
  for (const v of CONGE_VIBES) {
    if (jours >= v.min) return v;
  }
  return CONGE_VIBES[CONGE_VIBES.length - 1];
}

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

function countWorkDays(start, end, demiJournee) {
  if (demiJournee) return 0.5;
  let count = 0;
  const d = new Date(start);
  const endDate = new Date(end);
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export default function MonPlanning() {
  const [absences, setAbsences] = useState([]);
  const [profile, setProfile] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [absRes, profRes] = await Promise.all([
        fetch("/api/employee-absences", { cache: "no-store" }),
        fetch("/api/employee-profiles?mine=true", { cache: "no-store" }),
      ]);
      if (cancelled) return;
      const absData = await absRes.json();
      setAbsences(absData.items || []);
      try {
        const profData = await profRes.json();
        if (profData.items?.length) setProfile(profData.items[0]);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const soldeConges = useMemo(() => {
    const credit = profile?.congesAnnuels || 25;
    const year = new Date().getFullYear();
    const pris = absences
      .filter((a) => a.type === "conge" && a.statut === "valide" && a.dateDebut?.startsWith(String(year)))
      .reduce((sum, a) => sum + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0);
    return { credit, pris, reste: credit - pris };
  }, [absences, profile]);

  const vibe = useMemo(() => getCongeVibe(soldeConges.reste), [soldeConges.reste]);

  const absencesByDate = useMemo(() => {
    const map = {};
    for (const a of absences) {
      const d = new Date(a.dateDebut);
      const end = new Date(a.dateFin);
      while (d <= end) {
        const key = toYMD(d);
        if (!map[key]) map[key] = [];
        map[key].push(a);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [absences]);

  const calendarDays = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDay = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDay);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d);
      if (i >= 27 && d.getMonth() !== month) break;
    }
    return days;
  }, [calDate]);

  // Clic sur un jour du calendrier
  function handleDayClick(date, dayAbsences) {
    const dateStr = toYMD(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) return;

    // S'il y a une absence en attente, on l'ouvre en édition
    const pendingAbsence = dayAbsences.find((a) => a.statut === "en_attente");
    if (pendingAbsence) {
      openEdit(pendingAbsence);
      return;
    }

    // Sinon on ouvre le formulaire pré-rempli
    setEditId(null);
    setForm({ type: "", dateDebut: dateStr, dateFin: dateStr, demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openNew() {
    setEditId(null);
    setForm({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openEdit(absence) {
    setEditId(String(absence._id));
    setForm({
      type: absence.type,
      dateDebut: absence.dateDebut,
      dateFin: absence.dateFin,
      demiJournee: absence.demiJournee || "",
      commentaire: absence.commentaire || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type) { alert("Choisis un type d'absence"); return; }
    setSaving(true);
    const body = {
      type: form.type,
      dateDebut: form.dateDebut,
      dateFin: form.dateFin,
      demiJournee: form.demiJournee || null,
      commentaire: form.commentaire,
    };

    const url = editId ? `/api/employee-absences/${editId}` : "/api/employee-absences";
    const method = editId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(data.error || "Erreur");
      return;
    }

    if (editId) {
      setAbsences((prev) => prev.map((a) => (String(a._id) === editId ? data.item : a)));
    } else {
      setAbsences((prev) => [data.item, ...prev]);
    }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette demande ?")) return;
    const res = await fetch(`/api/employee-absences/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAbsences((prev) => prev.filter((a) => String(a._id) !== id));
    }
  }

  const today = toYMD(new Date());
  const month = calDate.getMonth();

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Mon Planning</h1>
          <p className={styles.subtitle}>Gérez vos absences et congés</p>
        </div>
        <button className={styles.primaryButton} onClick={openNew}>+ Poser une absence</button>
      </div>

      {/* Vibe congés */}
      <div className={styles.vibeCard}>
        <div className={styles.vibeEmoji}>{vibe.emoji}</div>
        <div className={styles.vibeContent}>
          <span className={styles.vibeMessage}>{vibe.message}</span>
          <span className={styles.vibeDetail}>{soldeConges.reste}j disponibles sur {soldeConges.credit}</span>
        </div>
        <div className={styles.vibeBar}>
          <div
            className={styles.vibeBarFill}
            style={{ width: `${Math.max(2, (soldeConges.reste / soldeConges.credit) * 100)}%` }}
          />
        </div>
      </div>

      {/* Calendrier */}
      <div className={styles.calendarCard}>
        <div className={styles.calToolbar}>
          <button className={styles.calNav} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>◀</button>
          <span className={styles.calTitle}>{MOIS[month]} {calDate.getFullYear()}</span>
          <button className={styles.calNav} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>▶</button>
        </div>

        <div className={styles.legend}>
          {TYPE_OPTIONS.map((t) => (
            <span key={t.value} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "#f59e0b", opacity: 0.5 }} />
            En attente
          </span>
        </div>

        <div className={styles.calGrid}>
          {JOURS_SEMAINE.map((j) => (
            <div key={j} className={styles.calHeader}>{j}</div>
          ))}
          {calendarDays.map((d, i) => {
            const key = toYMD(d);
            const isMonth = d.getMonth() === month;
            const isToday = key === today;
            const dayAbsences = absencesByDate[key] || [];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const hasAbsence = dayAbsences.length > 0;

            return (
              <div
                key={i}
                className={`${styles.calDay} ${isToday ? styles.calDayToday : ""} ${!isMonth ? styles.calDayOther : ""} ${isWeekend ? styles.calDayWeekend : ""} ${!isWeekend && isMonth ? styles.calDayClickable : ""}`}
                onClick={() => isMonth && !isWeekend && handleDayClick(d, dayAbsences)}
                role={isMonth && !isWeekend ? "button" : undefined}
                tabIndex={isMonth && !isWeekend ? 0 : undefined}
              >
                <span className={styles.calDayNum}>{d.getDate()}</span>
                {dayAbsences.map((a, j) => {
                  const typeOpt = TYPE_OPTIONS.find((t) => t.value === a.type);
                  const isPending = a.statut === "en_attente";
                  return (
                    <div
                      key={j}
                      className={`${styles.calEvent} ${isPending ? styles.calEventPending : ""}`}
                      style={{ background: `${typeOpt?.color || "#888"}22`, color: typeOpt?.color || "#888" }}
                      title={`${typeOpt?.label || a.type} — ${STATUT_LABELS[a.statut]?.label || a.statut}`}
                    >
                      {typeOpt?.icon || "?"} {typeOpt?.label || a.type}
                    </div>
                  );
                })}
                {!hasAbsence && !isWeekend && isMonth && (
                  <span className={styles.calDayHint}>+</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste des demandes */}
      <div className={styles.listCard}>
        <h2 className={styles.listTitle}>Mes demandes</h2>
        {absences.length === 0 && <p className={styles.empty}>Aucune absence enregistrée — clique sur un jour du calendrier pour commencer</p>}
        {absences.map((a) => {
          const typeOpt = TYPE_OPTIONS.find((t) => t.value === a.type);
          const statut = STATUT_LABELS[a.statut] || { label: a.statut, className: "" };
          const canEdit = a.statut === "en_attente";
          return (
            <div key={String(a._id)} className={styles.absenceRow}>
              <span className={styles.absenceIcon}>{typeOpt?.icon || "📋"}</span>
              <div className={styles.absenceInfo}>
                <div className={styles.absenceTop}>
                  <span className={styles.absenceType} style={{ background: `${typeOpt?.color || "#888"}14`, color: typeOpt?.color || "#888" }}>
                    {typeOpt?.label || a.type}
                  </span>
                  <span className={styles.absenceDates}>
                    {a.dateDebut === a.dateFin ? a.dateDebut : `${a.dateDebut} → ${a.dateFin}`}
                    {a.demiJournee && <span className={styles.demiTag}>{a.demiJournee}</span>}
                  </span>
                  <span className={`${styles.absenceStatut} ${styles[statut.className] || ""}`}>
                    {statut.label}
                  </span>
                </div>
                {a.motifRefus && <div className={styles.motifRefus}>Motif : {a.motifRefus}</div>}
                {a.commentaire && <div className={styles.commentaire}>{a.commentaire}</div>}
              </div>
              {canEdit && (
                <div className={styles.absenceActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(a)}>Modifier</button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(String(a._id))}>Supprimer</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modale — sélection type par cartes */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Modifier l'absence" : "Poser une absence"} size="sm">
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Type selector — cartes visuelles */}
          <div className={styles.typeLabel}>Quel type ?</div>
          <div className={styles.typeGrid}>
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${styles.typeCard} ${form.type === t.value ? styles.typeCardActive : ""}`}
                style={{
                  "--type-color": t.color,
                  borderColor: form.type === t.value ? t.color : undefined,
                  background: form.type === t.value ? `${t.color}10` : undefined,
                }}
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
              >
                <span className={styles.typeCardIcon}>{t.icon}</span>
                <span className={styles.typeCardLabel}>{t.label}</span>
                <span className={styles.typeCardDesc}>{t.desc}</span>
              </button>
            ))}
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Date début
              <input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} required />
            </label>
            <label className={styles.fieldLabel}>
              Date fin
              <input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} required />
            </label>
          </div>

          <label className={styles.fieldLabel}>
            Demi-journée (optionnel)
            <select value={form.demiJournee} onChange={(e) => setForm((f) => ({ ...f, demiJournee: e.target.value }))}>
              <option value="">Journée complète</option>
              <option value="matin">Matin uniquement</option>
              <option value="apres-midi">Après-midi uniquement</option>
            </select>
          </label>

          <label className={styles.fieldLabel}>
            Un petit mot ? (optionnel)
            <textarea value={form.commentaire} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))} rows={2} placeholder="Ex: Voyage en famille, RDV médical..." />
          </label>

          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={saving || !form.type}>
              {saving ? "Envoi..." : editId ? "Modifier" : "Envoyer la demande"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
