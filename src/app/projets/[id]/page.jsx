"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./Projet.module.css";

const BRANCH_COLORS = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "Atelier": "#059669", "Communication": "#0284c7", "default": "#6b7280" };

function toYMD(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }

export default function ProjetPage() {
  const { id } = useParams();
  const [projet, setProjet] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [projRes, profRes, absRes] = await Promise.all([
        fetch(`/api/contrats/${id}`, { cache: "no-store" }),
        fetch("/api/employee-profiles", { cache: "no-store" }),
        fetch("/api/employee-absences?all=true", { cache: "no-store" }),
      ]);
      try { const d = await projRes.json(); setProjet(d.item || d); } catch {}
      try { const d = await profRes.json(); setProfiles(d.items || []); } catch {}
      try { const d = await absRes.json(); setAbsences(d.items || []); } catch {}
      setLoading(false);
    })();
  }, [id]);

  const today = toYMD(new Date());
  const bc = BRANCH_COLORS[projet?.branche] || BRANCH_COLORS.default;

  // Équipe assignée — matcher les emails/ids avec les profils
  const team = useMemo(() => {
    if (!projet?.assignees?.length) return [];
    return projet.assignees.map((a) => {
      const aid = String(a._id || a.id || a);
      const prof = profiles.find((p) => String(p._id) === aid || p.email === aid || String(p.userId) === aid);
      return prof || { _id: aid, prenom: aid, nom: "" };
    });
  }, [projet, profiles]);

  // Conflits — quelqu'un de l'équipe est absent pendant le projet
  const conflicts = useMemo(() => {
    if (!projet?.dateDebut || !projet?.dateFin || !team.length) return [];
    return team.map((member) => {
      const pid = String(member._id);
      const uid = member.userId;
      const memberAbs = absences.filter((a) =>
        a.statut === "valide" &&
        (a.employeeProfileId === pid || a.userId === uid) &&
        a.dateDebut <= projet.dateFin && a.dateFin >= projet.dateDebut
      );
      return memberAbs.length > 0 ? { member, absences: memberAbs } : null;
    }).filter(Boolean);
  }, [team, absences, projet]);

  // Timeline du projet
  const totalDays = projet?.dateDebut && projet?.dateFin ? Math.ceil((new Date(projet.dateFin) - new Date(projet.dateDebut)) / 86400000) : 0;
  const daysPassed = projet?.dateDebut ? Math.max(0, Math.ceil((new Date() - new Date(projet.dateDebut)) / 86400000)) : 0;
  const progress = totalDays > 0 ? Math.min(100, Math.round((daysPassed / totalDays) * 100)) : 0;
  const isActive = projet?.dateDebut <= today && projet?.dateFin >= today;
  const isPast = projet?.dateFin < today;

  if (loading) return <div className={styles.page}><p>Chargement...</p></div>;
  if (!projet) return <div className={styles.page}><p>Projet non trouvé</p></div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header} style={{ "--bc": bc }}>
        <div className={styles.headerLeft}>
          <span className={styles.branchBadge}>{projet.branche}</span>
          <h1 className={styles.title}>{projet.nomContrat || projet.nom}</h1>
          {projet.clientNom && <p className={styles.client}>Client : {projet.clientNom}</p>}
          <div className={styles.meta}>
            <span className={styles.statut}>{projet.statut}</span>
            <span>{projet.dateDebut} → {projet.dateFin}</span>
            {projet.lieu && <span>📍 {projet.lieu}</span>}
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.progressCircle}>
            <span className={styles.progressVal}>{progress}%</span>
            <span className={styles.progressLabel}>{isPast ? "Terminé" : isActive ? "En cours" : "À venir"}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressBarFill} style={{ width: `${progress}%`, background: bc }} />
        <span className={styles.progressText}>{daysPassed}j / {totalDays}j</span>
      </div>

      {/* Conflits */}
      {conflicts.length > 0 && (
        <div className={styles.conflictsCard}>
          <h2 className={styles.cardTitle}>⚠ Conflits d'absence</h2>
          {conflicts.map((c, i) => (
            <div key={i} className={styles.conflict}>
              <Link href={`/rh/employe/${String(c.member._id)}`} className={styles.conflictName}>{c.member.prenom} {c.member.nom}</Link>
              <div className={styles.conflictAbs}>
                {c.absences.map((a, j) => (
                  <span key={j} className={styles.conflictAbsBadge}>{a.type} : {a.dateDebut} → {a.dateFin}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {/* Équipe */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Équipe ({team.length})</h2>
          {team.length === 0 && <p className={styles.empty}>Aucun membre assigné</p>}
          {team.map((m) => (
            <Link key={String(m._id)} href={`/rh/employe/${String(m._id)}`} className={styles.teamMember}>
              <span className={styles.teamAvatar}>{(m.prenom || "?")[0].toUpperCase()}</span>
              <div>
                <span className={styles.teamName}>{m.prenom} {m.nom}</span>
                <span className={styles.teamMeta}>{m.pole || "—"} · {m.contrat || "—"}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Détails */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Détails</h2>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Branche</span><span className={styles.detailVal} style={{ color: bc }}>{projet.branche}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Client</span><span className={styles.detailVal}>{projet.clientNom || "—"}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Statut</span><span className={styles.detailVal}>{projet.statut}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Dates</span><span className={styles.detailVal}>{projet.dateDebut} → {projet.dateFin}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Lieu</span><span className={styles.detailVal}>{projet.lieu || "—"}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Durée</span><span className={styles.detailVal}>{totalDays}j</span></div>
          {projet.brief && (
            <div className={styles.brief}>
              <span className={styles.detailLabel}>Brief</span>
              <p className={styles.briefText}>{projet.brief}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
