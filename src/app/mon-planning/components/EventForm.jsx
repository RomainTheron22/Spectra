"use client";

import React, { useState } from "react";
import styles from "./EventForm.module.css";

const ABSENCE_TYPES = [
  { value: "conge", label: "Congé", color: "#10b981", icon: "🌴" },
  { value: "tt", label: "Télétravail", color: "#8b5cf6", icon: "🏡" },
  { value: "maladie", label: "Maladie", color: "#f43f5e", icon: "🤧" },
  { value: "absence_autre", label: "Autre", color: "#f59e0b", icon: "✨" },
];

const BRANCHES = ["Agency", "CreativeGen", "Entertainment", "SFX", "Atelier", "Communication"];

// Groupes d'équipe — pour assigner une équipe entière en un clic
const TEAM_GROUPS = [
  { label: "Direction", members: ["tom@fantasmagorie.com", "laurent@fantasmagorie.com"] },
  { label: "Production AV", members: ["alexis@creativgen.com", "clement@creativgen.com", "derhen@fantasmagorie.com", "lilibirambeau@gmail.com", "perrine.esteben@efap.com", "theronone22@gmail.com", "thuanh2128@gmail.com"] },
  { label: "Scénographie", members: ["lucas@creativgen.com", "ondinecharon@msn.com"] },
  { label: "Communication", members: ["julie@fantasmagorie.com", "amanndynelheureux@gmail.com", "lucie.garrigues@emicparis.com", "daniotmarilou@gmail.com"] },
  { label: "Atelier / FabLab", members: ["theo.unterstock@gmail.com", "a.duret@live.fr", "restoux.mathis@gmail.com", "justineculie5@gmail.com"] },
  { label: "Studio CreativGen", members: ["alexis@creativgen.com", "lucas@creativgen.com", "clement@creativgen.com", "milan.salachas@gmail.com", "tiagofs0904@gmail.com"] },
];

// L'équipe Fantasmagorie
const TEAM = [
  { id: "tom", name: "Tom", email: "tom@fantasmagorie.com" },
  { id: "laurent", name: "Laurent Sasha", email: "laurent@fantasmagorie.com" },
  { id: "fany", name: "Fany Coquillat", email: "fany@fantasmagorie.com" },
  { id: "derhen", name: "Derhen", email: "derhen@fantasmagorie.com" },
  { id: "julie", name: "Julie Mourgue", email: "julie@fantasmagorie.com" },
  { id: "alexis", name: "Alexis Barta", email: "alexis@creativgen.com" },
  { id: "lucas", name: "Lucas Coquoin", email: "lucas@creativgen.com" },
  { id: "clement", name: "Clément Josse", email: "clement@creativgen.com" },
  { id: "milan", name: "Milan SLC", email: "milan.salachas@gmail.com" },
  { id: "theo", name: "Théo Unterstock", email: "theo.unterstock@gmail.com" },
  { id: "antoine", name: "Antoine Duret", email: "a.duret@live.fr" },
  { id: "amandyne", name: "Amandyne L'Heureux", email: "amanndynelheureux@gmail.com" },
  { id: "lili", name: "Lili Birambeau", email: "lilibirambeau@gmail.com" },
  { id: "mailys", name: "Mailys Teale", email: "mailys.teale@gmail.com" },
  { id: "justine", name: "Justine Culié", email: "justineculie5@gmail.com" },
  { id: "perrine", name: "Perrine Esteben", email: "perrine.esteben@efap.com" },
  { id: "tiago", name: "Tiago Silva", email: "tiagofs0904@gmail.com" },
  { id: "mathis", name: "Mathis Restoux", email: "restoux.mathis@gmail.com" },
  { id: "lucie", name: "Lucie Garrigues", email: "lucie.garrigues@emicparis.com" },
  { id: "ondine", name: "Ondine Charon", email: "ondinecharon@msn.com" },
];

/**
 * EventForm — formulaire universel pour créer/éditer un event
 *
 * Props:
 * - mode: "choose" | "absence" | "projet" | "event" | "editGcal"
 * - initialData: données pré-remplies
 * - onSubmit: callback(data)
 * - onDelete: callback() — si édition
 * - onBack: callback() — retour au choix
 * - onCancel: callback()
 * - saving: boolean
 * - absRecap: { conge, tt, maladie } — pour le mode absence
 * - vibeMsg: string — pour le mode absence
 * - soldeReste: number
 */
export default function EventForm({ mode: initialMode, initialData = {}, onSubmit, onDelete, onBack, onCancel, saving, absRecap, vibeMsg, soldeReste }) {
  const [mode, setMode] = useState(initialMode || "choose");
  const [data, setData] = useState({
    // Common
    title: initialData.title || "",
    dateDebut: initialData.dateDebut || "",
    dateFin: initialData.dateFin || "",
    heureDebut: initialData.heureDebut || "09:00",
    heureFin: initialData.heureFin || "10:00",
    allDay: initialData.allDay ?? true,
    description: initialData.description || "",
    lieu: initialData.lieu || "",
    assignees: initialData.assignees || [],
    branche: initialData.branche || "",
    // Absence specific
    absenceType: initialData.absenceType || "",
    demiJournee: initialData.demiJournee || "",
    commentaire: initialData.commentaire || "",
    // Project specific
    clientNom: initialData.clientNom || "",
    // Google Calendar
    gcalEditId: initialData.gcalEditId || null,
    // Récurrence
    recurrence: initialData.recurrence || "none", // none, daily, weekly, biweekly, monthly
    // Temporaire / permanent
    eventNature: initialData.eventNature || "permanent", // permanent, temporaire
  });

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const filteredTeam = TEAM.filter((m) =>
    !data.assignees.includes(m.email) &&
    (m.name.toLowerCase().includes(assigneeSearch.toLowerCase()) || m.email.toLowerCase().includes(assigneeSearch.toLowerCase()))
  );

  function set(key, val) { setData((d) => ({ ...d, [key]: val })); }
  function addAssignee(email) { set("assignees", [...data.assignees, email]); setAssigneeSearch(""); }
  function removeAssignee(email) { set("assignees", data.assignees.filter((e) => e !== email)); }
  function getTeamMember(email) { return TEAM.find((m) => m.email === email); }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ ...data, mode });
  }

  // ═══ CHOOSE ═══
  if (mode === "choose") {
    return (
      <div className={styles.chooseGrid}>
        <button type="button" className={styles.chooseCard} style={{ "--cc": "#10b981" }} onClick={() => setMode("absence")}>
          <span className={styles.chooseIcon}>🌴</span>
          <span className={styles.chooseLabel}>Absence</span>
          <span className={styles.chooseDesc}>Congé, TT, maladie</span>
        </button>
        <button type="button" className={styles.chooseCard} style={{ "--cc": "#7c3aed" }} onClick={() => setMode("projet")}>
          <span className={styles.chooseIcon}>🎬</span>
          <span className={styles.chooseLabel}>Projet</span>
          <span className={styles.chooseDesc}>Tournage, scéno, event</span>
        </button>
        <button type="button" className={styles.chooseCard} style={{ "--cc": "#f59e0b" }} onClick={() => setMode("event")}>
          <span className={styles.chooseIcon}>📅</span>
          <span className={styles.chooseLabel}>Événement</span>
          <span className={styles.chooseDesc}>RDV, réunion, rappel</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>

      {/* ═══ ABSENCE ═══ */}
      {mode === "absence" && (
        <>
          {absRecap && (
            <div className={styles.recap}>
              <div className={styles.recapItem} style={{ "--rc": "#10b981" }}>🌴 <strong>{absRecap.conge}j</strong></div>
              <div className={styles.recapItem} style={{ "--rc": "#8b5cf6" }}>🏡 <strong>{absRecap.tt}j</strong></div>
              <div className={styles.recapItem} style={{ "--rc": "#f43f5e" }}>🤧 <strong>{absRecap.maladie}j</strong></div>
              {vibeMsg && <div className={styles.recapVibe}>{vibeMsg} — <strong>{soldeReste}j restants</strong></div>}
            </div>
          )}
          <div className={styles.typeGrid}>
            {ABSENCE_TYPES.map((t) => (
              <button key={t.value} type="button" className={`${styles.typeBtn} ${data.absenceType === t.value ? styles.typeBtnOn : ""}`}
                style={{ "--tc": t.color }} onClick={() => set("absenceType", t.value)}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ═══ PROJET ═══ */}
      {mode === "projet" && (
        <>
          <label className={styles.field}>Nom du projet *
            <input value={data.title} onChange={(e) => set("title", e.target.value)} required placeholder="Tournage Clip X, Scéno Festival..." />
          </label>
          <label className={styles.field}>Client *
            <input value={data.clientNom} onChange={(e) => set("clientNom", e.target.value)} required placeholder="Nom du client" />
          </label>
          <label className={styles.field}>Branche *
            <select value={data.branche} onChange={(e) => set("branche", e.target.value)} required>
              <option value="">— Choisir —</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </>
      )}

      {/* ═══ EVENT / EDIT GCAL ═══ */}
      {(mode === "event" || mode === "editGcal") && (
        <label className={styles.field}>Titre *
          <input value={data.title} onChange={(e) => set("title", e.target.value)} required placeholder="Réunion, RDV, rappel..." />
        </label>
      )}

      {/* ═══ CHAMPS COMMUNS ═══ */}

      {/* Dates */}
      <div className={styles.fieldRow}>
        <label className={styles.field}>Du *
          <input type="date" value={data.dateDebut} onChange={(e) => set("dateDebut", e.target.value)} required />
        </label>
        <label className={styles.field}>{mode === "absence" ? "Au *" : "Au"}
          <input type="date" value={data.dateFin} onChange={(e) => set("dateFin", e.target.value)} required={mode === "absence" || mode === "projet"} />
        </label>
      </div>

      {/* Toute la journée + heures */}
      {mode !== "absence" && (
        <>
          <label className={styles.checkField}>
            <input type="checkbox" checked={data.allDay} onChange={(e) => set("allDay", e.target.checked)} />
            Toute la journée
          </label>
          {!data.allDay && (
            <div className={styles.fieldRow}>
              <label className={styles.field}>De <input type="time" value={data.heureDebut} onChange={(e) => set("heureDebut", e.target.value)} required /></label>
              <label className={styles.field}>À <input type="time" value={data.heureFin} onChange={(e) => set("heureFin", e.target.value)} required /></label>
            </div>
          )}
        </>
      )}

      {/* Demi-journée (absence only) */}
      {mode === "absence" && (
        <label className={styles.field}>Demi-journée ?
          <select value={data.demiJournee} onChange={(e) => set("demiJournee", e.target.value)}>
            <option value="">Journée complète</option>
            <option value="matin">Matin</option>
            <option value="apres-midi">Après-midi</option>
          </select>
        </label>
      )}

      {/* Lieu */}
      <label className={styles.field}>Lieu <span className={styles.opt}>(optionnel)</span>
        <input value={data.lieu} onChange={(e) => set("lieu", e.target.value)} placeholder="Studio, extérieur, visio, adresse..." />
      </label>

      {/* ═══ ASSIGNEES ═══ */}
      <div className={styles.assigneesSection}>
        <label className={styles.fieldLabel}>Équipe assignée</label>
        <div className={styles.assigneesList}>
          {data.assignees.map((email) => {
            const m = getTeamMember(email);
            return (
              <span key={email} className={styles.assigneeChip}>
                <span className={styles.assigneeAvatar}>{(m?.name || email)[0].toUpperCase()}</span>
                <span className={styles.assigneeName}>{m?.name || email}</span>
                <button type="button" className={styles.assigneeRemove} onClick={() => removeAssignee(email)}>✕</button>
              </span>
            );
          })}
        </div>
        <div className={styles.assigneeSearch}>
          <input value={assigneeSearch} onChange={(e) => setAssigneeSearch(e.target.value)} placeholder="Rechercher un membre..." className={styles.assigneeInput} />
          {assigneeSearch && (
            <div className={styles.assigneeDropdown}>
              {filteredTeam.slice(0, 6).map((m) => (
                <button key={m.id} type="button" className={styles.assigneeOption} onClick={() => addAssignee(m.email)}>
                  <span className={styles.assigneeAvatar}>{m.name[0].toUpperCase()}</span>
                  <div>
                    <div className={styles.assigneeOptName}>{m.name}</div>
                    <div className={styles.assigneeOptEmail}>{m.email}</div>
                  </div>
                </button>
              ))}
              {filteredTeam.length === 0 && <div className={styles.assigneeNoResult}>Aucun résultat</div>}
            </div>
          )}
        </div>
      </div>

      {/* Boutons équipe rapide */}
      {mode !== "absence" && (
        <div className={styles.teamGroups}>
          <span className={styles.teamGroupsLabel}>Ajouter une équipe :</span>
          {TEAM_GROUPS.map((g) => (
            <button key={g.label} type="button" className={styles.teamGroupBtn}
              onClick={() => { const newAssignees = [...new Set([...data.assignees, ...g.members])]; set("assignees", newAssignees); }}>
              {g.label} ({g.members.length})
            </button>
          ))}
        </div>
      )}

      {/* Récurrence */}
      {mode !== "absence" && (
        <label className={styles.field}>Récurrence
          <select value={data.recurrence} onChange={(e) => set("recurrence", e.target.value)}>
            <option value="none">Unique (pas de récurrence)</option>
            <option value="daily">Tous les jours</option>
            <option value="weekly">Chaque semaine</option>
            <option value="biweekly">Toutes les 2 semaines</option>
            <option value="monthly">Chaque mois</option>
          </select>
        </label>
      )}

      {/* Temporaire / Permanent */}
      {mode !== "absence" && (
        <div className={styles.natureRow}>
          <button type="button" className={`${styles.natureBtn} ${data.eventNature === "permanent" ? styles.natureBtnOn : ""}`} onClick={() => set("eventNature", "permanent")}>
            Permanent
          </button>
          <button type="button" className={`${styles.natureBtn} ${data.eventNature === "temporaire" ? styles.natureBtnOn : ""}`} onClick={() => set("eventNature", "temporaire")}>
            Temporaire
          </button>
        </div>
      )}

      {/* Description / commentaire */}
      <label className={styles.field}>{mode === "absence" ? "Un petit mot ?" : "Description"} <span className={styles.opt}>(optionnel)</span>
        <textarea value={mode === "absence" ? data.commentaire : data.description}
          onChange={(e) => set(mode === "absence" ? "commentaire" : "description", e.target.value)}
          rows={2} placeholder={mode === "absence" ? "Voyage, recharge..." : "Contexte, objectifs, notes..."} />
      </label>

      {/* Branche (pour events — optionnel) */}
      {mode === "event" && (
        <label className={styles.field}>Branche <span className={styles.opt}>(optionnel)</span>
          <select value={data.branche} onChange={(e) => set("branche", e.target.value)}>
            <option value="">— Aucune —</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      )}

      {/* ═══ ACTIONS ═══ */}
      <div className={styles.actions}>
        {onBack && <button type="button" className={styles.backBtn} onClick={initialMode === "choose" ? () => setMode("choose") : onBack}>← Retour</button>}
        {onDelete && <button type="button" className={styles.deleteBtn} onClick={onDelete}>Supprimer</button>}
        <div className={styles.actionsSpacer} />
        {onCancel && <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>Annuler</button>}
        <button type="submit" className={styles.submitBtn} disabled={saving || (mode === "absence" && !data.absenceType) || (mode === "projet" && (!data.title || !data.clientNom || !data.branche)) || ((mode === "event" || mode === "editGcal") && !data.title)}>
          {saving ? "..." : mode === "absence" ? "C'est parti 🚀" : mode === "projet" ? "Créer le projet 🎬" : mode === "editGcal" ? "Enregistrer" : "Créer l'événement 📅"}
        </button>
      </div>
    </form>
  );
}

export { ABSENCE_TYPES, BRANCHES, TEAM };
