"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./Projets.module.css";

const BRANCH_COLORS = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "Atelier": "#059669", "Communication": "#0284c7", "default": "#6b7280" };
const STATUTS = ["En cours", "Stand-by", "Livré", "En production", "Conception", "Terminé"];

function toYMD(d) { return d.toISOString().slice(0, 10); }

export default function ProjetsPage() {
  const [contrats, setContrats] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [filterBranche, setFilterBranche] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("dateDebut");

  useEffect(() => {
    (async () => {
      const [projRes, profRes] = await Promise.all([
        fetch("/api/contrats", { cache: "no-store" }),
        fetch("/api/employee-profiles", { cache: "no-store" }),
      ]);
      const projData = await projRes.json(); setContrats(projData.items || []);
      const profData = await profRes.json(); setProfiles(profData.items || []);
    })();
  }, []);

  const today = toYMD(new Date());
  const branches = useMemo(() => [...new Set(contrats.map((c) => c.branche).filter(Boolean))].sort(), [contrats]);

  const filtered = useMemo(() => {
    let list = contrats;
    if (filterBranche) list = list.filter((c) => c.branche === filterBranche);
    if (filterStatut) list = list.filter((c) => c.statut === filterStatut);
    if (search) { const s = search.toLowerCase(); list = list.filter((c) => (c.nomContrat || c.nom || "").toLowerCase().includes(s) || (c.clientNom || "").toLowerCase().includes(s)); }
    list = [...list].sort((a, b) => {
      if (sort === "dateDebut") return (b.dateDebut || "").localeCompare(a.dateDebut || "");
      if (sort === "dateFin") return (a.dateFin || "").localeCompare(b.dateFin || "");
      if (sort === "nom") return (a.nomContrat || a.nom || "").localeCompare(b.nomContrat || b.nom || "");
      return 0;
    });
    return list;
  }, [contrats, filterBranche, filterStatut, search, sort]);

  const stats = {
    total: contrats.length,
    active: contrats.filter((c) => c.dateDebut && c.dateFin && c.dateDebut <= today && c.dateFin >= today).length,
    upcoming: contrats.filter((c) => c.dateDebut && c.dateDebut > today).length,
    completed: contrats.filter((c) => c.dateFin && c.dateFin < today).length,
  };

  function getAssigneeProfiles(assignees) {
    if (!assignees?.length) return [];
    return assignees.map((a) => profiles.find((p) => String(p._id) === String(a) || p.email === String(a))).filter(Boolean);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projets</h1>
          <p className={styles.subtitle}>{stats.total} projets · {stats.active} actifs · {stats.upcoming} à venir · {stats.completed} terminés</p>
        </div>
      </div>

      {/* Filtres */}
      <div className={styles.filters}>
        <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un projet ou un client..." />
        <select className={styles.filterSelect} value={filterBranche} onChange={(e) => setFilterBranche(e.target.value)}>
          <option value="">Toutes les branches</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={styles.filterSelect} value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={styles.filterSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="dateDebut">Plus récent</option>
          <option value="dateFin">Fin proche</option>
          <option value="nom">Alphabétique</option>
        </select>
      </div>

      {/* Liste */}
      <div className={styles.projList}>
        {filtered.map((c) => {
          const bc = BRANCH_COLORS[c.branche] || BRANCH_COLORS.default;
          const isActive = c.dateDebut && c.dateFin && c.dateDebut <= today && c.dateFin >= today;
          const isPast = c.dateFin && c.dateFin < today;
          const totalDays = c.dateDebut && c.dateFin ? Math.max(1, Math.ceil((new Date(c.dateFin) - new Date(c.dateDebut)) / 86400000)) : 0;
          const daysPassed = c.dateDebut ? Math.max(0, Math.ceil((new Date() - new Date(c.dateDebut)) / 86400000)) : 0;
          const pct = totalDays > 0 ? Math.min(100, Math.round((daysPassed / totalDays) * 100)) : 0;
          const team = getAssigneeProfiles(c.assignees);

          return (
            <Link key={String(c._id)} href={`/projets/${String(c._id)}`} className={styles.projCard} style={{ "--bc": bc }}>
              <div className={styles.projLeft}>
                <div className={styles.projHeader}>
                  <span className={styles.projName}>{c.nomContrat || c.nom}</span>
                  <span className={styles.projBranch}>{c.branche}</span>
                </div>
                <div className={styles.projMeta}>
                  {c.clientNom && <span>Client : {c.clientNom}</span>}
                  <span>{c.dateDebut || "—"} → {c.dateFin || "—"}</span>
                  <span className={`${styles.projStatut} ${isActive ? styles.projStatutActive : isPast ? styles.projStatutPast : ""}`}>{c.statut}</span>
                </div>
                {isActive && (
                  <div className={styles.projProgress}>
                    <div className={styles.projProgressBar}><div className={styles.projProgressFill} style={{ width: `${pct}%`, background: bc }} /></div>
                    <span className={styles.projProgressPct}>{pct}%</span>
                  </div>
                )}
              </div>
              {team.length > 0 && (
                <div className={styles.projTeam}>
                  {team.slice(0, 5).map((p, i) => <span key={i} className={styles.projAvatar} style={{ background: bc }}>{(p.prenom || "?")[0]}</span>)}
                  {team.length > 5 && <span className={styles.projAvatarMore}>+{team.length - 5}</span>}
                </div>
              )}
            </Link>
          );
        })}
        {filtered.length === 0 && <p className={styles.empty}>Aucun projet trouvé</p>}
      </div>
    </div>
  );
}
