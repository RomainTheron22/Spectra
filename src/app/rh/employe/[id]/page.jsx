"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./FicheEmploye.module.css";

const CONTRAT_LABELS = { cdi: "CDI", cdd: "CDD", alternance: "Alternance", stage: "Stage" };
const CONTRAT_COLORS = { cdi: "#10b981", cdd: "#0891b2", alternance: "#8b5cf6", stage: "#f59e0b" };
const ABSENCE_LABELS = { conge: "Congé", tt: "Télétravail", maladie: "Maladie", absence_autre: "Autre" };
const ABSENCE_COLORS = { conge: "#10b981", tt: "#8b5cf6", maladie: "#f43f5e", absence_autre: "#f59e0b" };
const BRANCH_COLORS = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "default": "#6b7280" };

function toYMD(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function countWorkDays(s, e) { let c = 0; const d = new Date(s); const end = new Date(e); while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); } return c; }

export default function FicheEmployePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [journal, setJournal] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [profRes, absRes, projRes, journalRes] = await Promise.all([
        fetch(`/api/employee-profiles/${id}`, { cache: "no-store" }),
        fetch(`/api/employee-absences?all=true`, { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
        fetch(`/api/journal/${id}`, { cache: "no-store" }),
      ]);
      const profData = await profRes.json(); setProfile(profData.item || null);
      const absData = await absRes.json();
      const allAbs = absData.items || [];
      setAbsences(allAbs.filter((a) => a.employeeProfileId === id || a.userId === profData.item?.userId));
      const projData = await projRes.json(); setContrats(projData.items || []);
      try { const jData = await journalRes.json(); setJournal(jData.items || []); } catch {}
      setLoading(false);
    })();
  }, [id]);

  const today = toYMD(new Date());
  const year = new Date().getFullYear();

  // Projets assignés à cette personne
  const myProjects = useMemo(() => {
    if (!profile) return [];
    return contrats.filter((c) => {
      const assignees = c.assignees || c.equipe || [];
      return assignees.some((a) => String(a) === String(profile.userId) || String(a) === profile.email || String(a._id || a.id || a) === String(profile.userId));
    });
  }, [contrats, profile]);

  const activeProjects = myProjects.filter((c) => c.dateDebut && c.dateFin && c.dateFin >= today && c.dateDebut <= today);
  const upcomingProjects = myProjects.filter((c) => c.dateDebut && c.dateDebut > today);

  // Absences stats
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

  // Alertes
  const alerts = useMemo(() => {
    const a = [];
    if (profile?.dateFin) {
      const daysLeft = Math.ceil((new Date(profile.dateFin) - new Date()) / 86400000);
      if (daysLeft < 0) a.push({ type: "red", msg: `Contrat terminé depuis ${Math.abs(daysLeft)}j` });
      else if (daysLeft < 30) a.push({ type: "red", msg: `Contrat se termine dans ${daysLeft}j (${profile.dateFin})` });
      else if (daysLeft < 60) a.push({ type: "orange", msg: `Contrat se termine dans ${daysLeft}j` });
    }
    if (congesReste <= 5 && congesReste > 0) a.push({ type: "orange", msg: `Plus que ${congesReste}j de congés restants` });
    if (congesReste <= 0) a.push({ type: "red", msg: "Plus aucun jour de congé" });
    if (activeProjects.length >= 3) a.push({ type: "orange", msg: `Surcharge : ${activeProjects.length} projets simultanés` });
    if (absStats.pending > 0) a.push({ type: "blue", msg: `${absStats.pending} demande${absStats.pending > 1 ? "s" : ""} d'absence en attente` });
    return a;
  }, [profile, congesReste, activeProjects, absStats]);

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

  if (loading) return <div className={styles.page}><p>Chargement...</p></div>;
  if (!profile) return <div className={styles.page}><p>Profil non trouvé</p></div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.avatar}>{(profile.prenom || "?")[0].toUpperCase()}</div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{profile.prenom} {profile.nom}</h1>
          <div className={styles.meta}>
            <span className={styles.contratBadge} style={{ "--cb": CONTRAT_COLORS[profile.contrat] || "#6b7280" }}>{CONTRAT_LABELS[profile.contrat] || profile.contrat}</span>
            <span>{profile.pole || "—"}</span>
            <span>·</span>
            <span>{profile.entite || "—"}</span>
            {profile.email && <span className={styles.email}>{profile.email}</span>}
          </div>
          {profile.dateDebut && (
            <div className={styles.dates}>
              Depuis {profile.dateDebut}{profile.dateFin ? ` → ${profile.dateFin}` : ""}
              {profile.joursPresence && <span className={styles.jours}>Jours : {profile.joursPresence.join(", ")}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className={styles.alerts}>
          {alerts.map((a, i) => (
            <div key={i} className={`${styles.alert} ${styles[`alert_${a.type}`]}`}>{a.msg}</div>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {/* Colonne gauche */}
        <div className={styles.col}>
          {/* Congés */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Congés & absences — {year}</h2>
            <div className={styles.congeRow}>
              <div className={styles.congeItem} style={{ "--ci": "#10b981" }}>
                <span className={styles.congeVal}>{absStats.conge}j</span>
                <span className={styles.congeLabel}>Congés pris</span>
              </div>
              <div className={styles.congeItem} style={{ "--ci": "#8b5cf6" }}>
                <span className={styles.congeVal}>{absStats.tt}j</span>
                <span className={styles.congeLabel}>Télétravail</span>
              </div>
              <div className={styles.congeItem} style={{ "--ci": "#f43f5e" }}>
                <span className={styles.congeVal}>{absStats.maladie}j</span>
                <span className={styles.congeLabel}>Maladie</span>
              </div>
              <div className={styles.congeItem} style={{ "--ci": congesReste > 10 ? "#10b981" : congesReste > 5 ? "#f59e0b" : "#f43f5e" }}>
                <span className={styles.congeVal}>{congesReste}j</span>
                <span className={styles.congeLabel}>Restants / {congesCredit}</span>
              </div>
            </div>
            <div className={styles.congeBar}>
              <div className={styles.congeBarFill} style={{ width: `${Math.min(100, (absStats.conge / congesCredit) * 100)}%` }} />
            </div>
          </div>

          {/* Bande passante */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Bande passante</h2>
            <div className={styles.bpRow}>
              <div className={styles.bpItem}>
                <span className={`${styles.bpVal} ${activeProjects.length >= 3 ? styles.bpRed : ""}`}>{activeProjects.length}</span>
                <span className={styles.bpLabel}>Projets actifs</span>
              </div>
              <div className={styles.bpItem}>
                <span className={styles.bpVal}>{upcomingProjects.length}</span>
                <span className={styles.bpLabel}>À venir</span>
              </div>
              <div className={styles.bpItem}>
                <span className={styles.bpVal}>{myProjects.length}</span>
                <span className={styles.bpLabel}>Total</span>
              </div>
            </div>
          </div>

          {/* Compétences */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Compétences & tags</h2>
            <div className={styles.compList}>
              {(profile.competences || []).map((c, i) => (
                <span key={i} className={styles.compChip}>{c}</span>
              ))}
              {(profile.tags || []).map((t, i) => (
                <span key={`t${i}`} className={styles.tagChip}>{t}</span>
              ))}
              {!(profile.competences?.length || profile.tags?.length) && <p className={styles.empty}>Aucune compétence renseignée</p>}
            </div>
            <div className={styles.compAdd}>
              <input className={styles.compInput} placeholder="Ajouter une compétence..." onKeyDown={async (e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  const newComp = [...(profile.competences || []), e.target.value.trim()];
                  const res = await fetch(`/api/employee-profiles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competences: newComp }) });
                  if (res.ok) { const d = await res.json(); setProfile(d.item); }
                  e.target.value = "";
                }
              }} />
            </div>
          </div>

          {/* Projets */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Projets ({myProjects.length})</h2>
            {myProjects.length === 0 && <p className={styles.empty}>Aucun projet assigné</p>}
            {myProjects.map((c) => {
              const isActive = c.dateDebut <= today && c.dateFin >= today;
              const bc = BRANCH_COLORS[c.branche] || BRANCH_COLORS.default;
              return (
                <Link key={String(c._id)} href={`/projets/${String(c._id)}`} className={`${styles.projItem} ${isActive ? styles.projActive : ""}`} style={{ "--pc": bc }}>
                  <div className={styles.projName}>{c.nomContrat || c.nom}</div>
                  <div className={styles.projMeta}>
                    <span className={styles.projBranch}>{c.branche}</span>
                    <span>{c.dateDebut} → {c.dateFin}</span>
                    <span className={styles.projStatut}>{c.statut}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Colonne droite */}
        <div className={styles.col}>
          {/* Journal de bord */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Journal de bord</h2>
            <div className={styles.journalForm}>
              <div className={styles.journalTypes}>
                {[{ key: "note", label: "Note", shape: "●" }, { key: "reunion", label: "Réunion", shape: "■" }, { key: "feedback", label: "Feedback", shape: "◆" }, { key: "alerte", label: "Alerte", shape: "▲" }].map((t) => (
                  <button key={t.key} type="button" className={`${styles.journalTypeBtn} ${noteType === t.key ? styles.journalTypeBtnOn : ""}`} onClick={() => setNoteType(t.key)}>
                    <span className={styles.journalTypeShape}>{t.shape}</span> {t.label}
                  </button>
                ))}
              </div>
              <textarea className={styles.journalInput} value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} placeholder={noteType === "reunion" ? "Compte-rendu de la réunion..." : noteType === "feedback" ? "Feedback, point positif ou à améliorer..." : noteType === "alerte" ? "Point d'attention, risque..." : "Note libre, observation, idée..."} />
              <button className={styles.journalBtn} onClick={addJournalEntry} disabled={!newNote.trim()}>Ajouter</button>
            </div>
            {journal.length === 0 && <p className={styles.empty}>Aucune note pour le moment</p>}
            {journal.map((entry) => {
              const typeColors = { note: "#7c3aed", reunion: "#0891b2", feedback: "#10b981", alerte: "#f43f5e" };
              const typeShapes = { note: "●", reunion: "■", feedback: "◆", alerte: "▲" };
              const typeLabels = { note: "Note", reunion: "Réunion", feedback: "Feedback", alerte: "Alerte" };
              return (
                <div key={String(entry._id)} className={styles.journalEntry} style={{ "--jc": typeColors[entry.type] || "#7c3aed" }}>
                  <div className={styles.journalEntryHead}>
                    <span className={styles.journalTypeTag} style={{ color: typeColors[entry.type] }}>{typeShapes[entry.type] || "●"} {typeLabels[entry.type] || "Note"}</span>
                    <span className={styles.journalDate}>{entry.date}</span>
                    {entry.authorName && <span className={styles.journalAuthor}>par {entry.authorName}</span>}
                    <button className={styles.journalDel} onClick={() => deleteJournalEntry(String(entry._id))}>✕</button>
                  </div>
                  <p className={styles.journalText}>{entry.text}</p>
                </div>
              );
            })}
          </div>

          {/* Absences récentes */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Absences récentes</h2>
            {absences.length === 0 && <p className={styles.empty}>Aucune absence</p>}
            {absences.slice(0, 10).map((a) => (
              <div key={String(a._id)} className={styles.absItem} style={{ "--ac": ABSENCE_COLORS[a.type] || "#888" }}>
                <span className={styles.absType}>{ABSENCE_LABELS[a.type] || a.type}</span>
                <span className={styles.absDates}>{a.dateDebut}{a.dateDebut !== a.dateFin ? ` → ${a.dateFin}` : ""}</span>
                <span className={`${styles.absStatut} ${a.statut === "valide" ? styles.absValide : a.statut === "en_attente" ? styles.absAttente : styles.absRefuse}`}>{a.statut}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
