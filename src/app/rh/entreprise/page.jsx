"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./Entreprise.module.css";

const BRANCHES = [
  { key: "Agency", label: "Agency", color: "#e11d48", icon: "🎬", desc: "Production audiovisuelle, films, clips, podcasts" },
  { key: "CreativeGen", label: "CreativeGen", color: "#7c3aed", icon: "🎙️", desc: "Studio podcast, vidéo, coaching, décors" },
  { key: "Entertainment", label: "Entertainment", color: "#0891b2", icon: "🎭", desc: "Scénographie, événements, spectacles, expos" },
  { key: "SFX", label: "SFX", color: "#ca8a04", icon: "✨", desc: "Effets spéciaux, installations créatives" },
  { key: "Atelier", label: "Atelier", color: "#059669", icon: "🔧", desc: "FabLab, construction décors, prototypage" },
  { key: "Communication", label: "Communication", color: "#0284c7", icon: "📢", desc: "Stratégie com, personal branding, réseaux" },
];

export default function EntreprisePage() {
  const [profiles, setProfiles] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [absences, setAbsences] = useState([]);

  useEffect(() => {
    (async () => {
      const [profRes, projRes, absRes] = await Promise.all([
        fetch("/api/employee-profiles", { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
        fetch("/api/employee-absences?all=true", { cache: "no-store" }),
      ]);
      let profData = await profRes.json();
      let profs = (profData.items || []).filter((p) => p.isActive !== false);
      // Auto-seed si aucun profil
      if (profs.length === 0) {
        try {
          await fetch("/api/seed-employees", { method: "POST" });
          const refetch = await fetch("/api/employee-profiles", { cache: "no-store" });
          profData = await refetch.json();
          profs = (profData.items || []).filter((p) => p.isActive !== false);
        } catch {}
      }
      setProfiles(profs);
      const projData = await projRes.json(); setContrats(projData.items || []);
      const absData = await absRes.json(); setAbsences(absData.items || []);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // Stats globales
  const stats = useMemo(() => {
    const activeProjects = contrats.filter((c) => c.dateDebut && c.dateFin && c.dateFin >= today && c.dateDebut <= today);
    const upcomingProjects = contrats.filter((c) => c.dateDebut && c.dateDebut > today);
    const completedProjects = contrats.filter((c) => c.dateFin && c.dateFin < today);
    const todayAbsent = absences.filter((a) => a.statut === "valide" && a.dateDebut <= today && a.dateFin >= today);

    // Par branche
    const byBranch = {};
    for (const b of BRANCHES) {
      const bProjects = contrats.filter((c) => c.branche === b.key);
      const bActive = bProjects.filter((c) => c.dateDebut && c.dateFin && c.dateFin >= today && c.dateDebut <= today);
      const bTeam = profiles.filter((p) => p.entite === b.key || p.pole === b.key);
      byBranch[b.key] = { total: bProjects.length, active: bActive.length, team: bTeam.length };
    }

    return {
      totalEmployees: profiles.length,
      activeProjects: activeProjects.length,
      upcomingProjects: upcomingProjects.length,
      completedProjects: completedProjects.length,
      todayAbsent: todayAbsent.length,
      todayPresent: profiles.length - todayAbsent.length,
      byBranch,
      cdi: profiles.filter((p) => p.contrat === "cdi").length,
      alternance: profiles.filter((p) => p.contrat === "alternance").length,
      stage: profiles.filter((p) => p.contrat === "stage").length,
    };
  }, [profiles, contrats, absences, today]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Fantasmagorie</h1>
      <p className={styles.subtitle}>Vue d'ensemble du groupe — pôles, équipe, projets</p>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{stats.totalEmployees}</span>
          <span className={styles.kpiLabel}>Membres</span>
          <span className={styles.kpiDetail}>{stats.cdi} CDI · {stats.alternance} alt. · {stats.stage} stag.</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{stats.activeProjects}</span>
          <span className={styles.kpiLabel}>Projets actifs</span>
          <span className={styles.kpiDetail}>{stats.upcomingProjects} à venir · {stats.completedProjects} terminés</span>
        </div>
        <div className={styles.kpi}>
          <span className={`${styles.kpiValue} ${stats.todayPresent < stats.totalEmployees * 0.5 ? styles.kpiRed : ""}`}>{stats.todayPresent}/{stats.totalEmployees}</span>
          <span className={styles.kpiLabel}>Présents aujourd'hui</span>
          <span className={styles.kpiDetail}>{stats.todayAbsent} absent{stats.todayAbsent > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Branches */}
      <h2 className={styles.secTitle}>Les pôles</h2>
      <div className={styles.branchGrid}>
        {BRANCHES.map((b) => {
          const data = stats.byBranch[b.key] || { total: 0, active: 0, team: 0 };
          return (
            <div key={b.key} className={styles.branchCard} style={{ "--bc": b.color }}>
              <div className={styles.branchHead}>
                <span className={styles.branchIcon}>{b.icon}</span>
                <div>
                  <span className={styles.branchName}>{b.label}</span>
                  <span className={styles.branchDesc}>{b.desc}</span>
                </div>
              </div>
              <div className={styles.branchStats}>
                <div className={styles.branchStat}>
                  <span className={styles.branchStatVal}>{data.active}</span>
                  <span className={styles.branchStatLabel}>projets actifs</span>
                </div>
                <div className={styles.branchStat}>
                  <span className={styles.branchStatVal}>{data.total}</span>
                  <span className={styles.branchStatLabel}>projets total</span>
                </div>
                <div className={styles.branchStat}>
                  <span className={styles.branchStatVal}>{data.team}</span>
                  <span className={styles.branchStatLabel}>membres</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Équipe */}
      <h2 className={styles.secTitle}>L'équipe</h2>
      <div className={styles.teamGrid}>
        {profiles.map((p) => (
          <Link key={String(p._id)} href={`/rh/employe/${String(p._id)}`} className={styles.teamCard}>
            <span className={styles.teamAvatar}>{(p.prenom || "?")[0].toUpperCase()}</span>
            <div>
              <span className={styles.teamName}>{p.prenom} {p.nom}</span>
              <span className={styles.teamMeta}>{p.pole || "—"} · {p.contrat || "—"}</span>
              {p.entite && <span className={styles.teamEntite}>{p.entite}</span>}
            </div>
          </Link>
        ))}
      </div>

      {/* Projets récents */}
      <h2 className={styles.secTitle}>Projets actifs</h2>
      <div className={styles.projList}>
        {contrats.filter((c) => c.dateDebut && c.dateFin && c.dateFin >= today).slice(0, 15).map((c) => (
          <div key={String(c._id)} className={styles.projCard} style={{ "--pc": BRANCHES.find((b) => b.key === c.branche)?.color || "#6b7280" }}>
            <div className={styles.projHead}>
              <span className={styles.projName}>{c.nomContrat || c.nom}</span>
              <span className={styles.projBranch}>{c.branche}</span>
            </div>
            <div className={styles.projMeta}>
              {c.clientNom && <span>Client : {c.clientNom}</span>}
              <span>{c.dateDebut} → {c.dateFin}</span>
              <span className={styles.projStatut}>{c.statut}</span>
            </div>
            {(c.assignees || []).length > 0 && (
              <div className={styles.projAssignees}>
                {c.assignees.slice(0, 5).map((a, i) => <span key={i} className={styles.projAssignee}>{String(a).slice(0, 2)}</span>)}
                {c.assignees.length > 5 && <span className={styles.projAssigneeMore}>+{c.assignees.length - 5}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
