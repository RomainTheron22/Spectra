"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./ComptabiliteProjetDetail.module.css";

const PAGE_SIZE = 20;

function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return `${toSafeNumber(value).toFixed(2)} €`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

function formatPeriode(start, end) {
  if (!start && !end) return "-";
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function ComptabiliteProjetDetailPage() {
  const params = useParams();
  const projetName = decodeURIComponent(String(params?.projet || ""));

  const [project, setProject] = useState(null);
  const [commandes, setCommandes] = useState([]);
  const [missions, setMissions] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openCommandes, setOpenCommandes] = useState(true);
  const [openPrestataires, setOpenPrestataires] = useState(true);

  const [searchCommandes, setSearchCommandes] = useState("");
  const [searchMissions, setSearchMissions] = useState("");
  const [sortCommandes, setSortCommandes] = useState("dateDesc");
  const [sortMissions, setSortMissions] = useState("dateDesc");
  const [pageCommandes, setPageCommandes] = useState(1);
  const [pageMissions, setPageMissions] = useState(1);

  const [groupCommandes, setGroupCommandes] = useState(false);
  const [groupMissions, setGroupMissions] = useState(false);
  const [openCmdGroups, setOpenCmdGroups] = useState({});
  const [openMissionGroups, setOpenMissionGroups] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/finances/comptabilite-projet/${encodeURIComponent(projetName)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(`${data?.error || "Erreur chargement"}${data?.details ? " - " + data.details : ""}`);
        }
        if (!cancelled) {
          setProject(data.project || null);
          setCommandes(Array.isArray(data.commandes) ? data.commandes : []);
          setMissions(Array.isArray(data.missions) ? data.missions : []);
          setTotals(data.totals || null);
        }
      } catch (err) {
        if (!cancelled) setError(String(err?.message || err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projetName]);

  const filteredCommandes = useMemo(() => {
    const q = normalizeText(searchCommandes);
    const rows = commandes.filter((item) => {
      if (!q) return true;
      const hay = normalizeText(`${item.fournisseur} ${item.libelle} ${item.description} ${item.statut}`);
      return hay.includes(q);
    });

    const sorted = [...rows];
    if (sortCommandes === "dateAsc") sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sortCommandes === "dateDesc") sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sortCommandes === "amountDesc") sorted.sort((a, b) => b.montant - a.montant);
    if (sortCommandes === "amountAsc") sorted.sort((a, b) => a.montant - b.montant);
    return sorted;
  }, [commandes, searchCommandes, sortCommandes]);

  const filteredMissions = useMemo(() => {
    const q = normalizeText(searchMissions);
    const rows = missions.filter((item) => {
      if (!q) return true;
      const hay = normalizeText(`${item.prestataireNom} ${item.mission} ${item.description} ${item.statut}`);
      return hay.includes(q);
    });

    const sorted = [...rows];
    if (sortMissions === "dateAsc") sorted.sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());
    if (sortMissions === "dateDesc") sorted.sort((a, b) => new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime());
    if (sortMissions === "amountDesc") sorted.sort((a, b) => b.montant - a.montant);
    if (sortMissions === "amountAsc") sorted.sort((a, b) => a.montant - b.montant);
    return sorted;
  }, [missions, searchMissions, sortMissions]);

  useEffect(() => setPageCommandes(1), [searchCommandes, sortCommandes, groupCommandes]);
  useEffect(() => setPageMissions(1), [searchMissions, sortMissions, groupMissions]);

  const cmdSubtotal = filteredCommandes.reduce((sum, item) => sum + toSafeNumber(item.montant), 0);
  const missionSubtotal = filteredMissions.reduce((sum, item) => sum + toSafeNumber(item.montant), 0);

  const totalCmdPages = Math.max(1, Math.ceil(filteredCommandes.length / PAGE_SIZE));
  const safeCmdPage = Math.min(pageCommandes, totalCmdPages);
  const pagedCommandes = filteredCommandes.slice((safeCmdPage - 1) * PAGE_SIZE, safeCmdPage * PAGE_SIZE);

  const totalMissionPages = Math.max(1, Math.ceil(filteredMissions.length / PAGE_SIZE));
  const safeMissionPage = Math.min(pageMissions, totalMissionPages);
  const pagedMissions = filteredMissions.slice((safeMissionPage - 1) * PAGE_SIZE, safeMissionPage * PAGE_SIZE);

  const groupedCommandes = useMemo(() => {
    const source = groupCommandes ? pagedCommandes : [];
    const map = new Map();
    for (const row of source) {
      const key = row.fournisseur || "Fournisseur inconnu";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
      total: items.reduce((sum, item) => sum + item.montant, 0),
      count: items.length,
    }));
  }, [groupCommandes, pagedCommandes]);

  const groupedMissions = useMemo(() => {
    const source = groupMissions ? pagedMissions : [];
    const map = new Map();
    for (const row of source) {
      const key = row.prestataireNom || "Prestataire inconnu";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
      total: items.reduce((sum, item) => sum + item.montant, 0),
      count: items.length,
    }));
  }, [groupMissions, pagedMissions]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`${styles.skeleton} ${styles.titleSkeleton}`} />
        <div className={styles.kpiGrid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`kpi-s-${idx}`} className={`${styles.skeleton} ${styles.kpiSkeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Link href="/finances/comptabilite-projet" className={styles.backLink}>
          ← Retour à Comptabilité Projet
        </Link>
        <div className={styles.errorBox}>Erreur: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/finances/comptabilite-projet" className={styles.backLink}>
        ← Retour à Comptabilité Projet
      </Link>

      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Comptabilité - {project?.nomProjet || projetName}</h1>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total commandes</div>
          <div className={styles.kpiValue}>{formatMoney(totals?.totalCommandes || 0)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total prestataires</div>
          <div className={styles.kpiValue}>{formatMoney(totals?.totalPrestataires || 0)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total dépensé</div>
          <div className={styles.kpiValue}>{formatMoney(totals?.totalDepense || 0)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Nombre total d&apos;entrées</div>
          <div className={styles.kpiValue}>{totals?.nbEntrees || 0}</div>
        </div>
      </div>

      <div className={styles.accordion}>
        <button type="button" className={styles.accordionButton} onClick={() => setOpenCommandes((v) => !v)}>
          <span>Commandes - {project?.nomProjet || projetName}</span>
          <span>
            ({filteredCommandes.length}) - {formatMoney(cmdSubtotal)}
          </span>
        </button>

        {openCommandes ? (
          <div className={styles.sectionBody}>
            <div className={styles.sectionToolbar}>
              <input
                className={styles.searchInput}
                type="text"
                value={searchCommandes}
                onChange={(e) => setSearchCommandes(e.target.value)}
                placeholder="Rechercher dans commandes"
              />
              <select className={styles.select} value={sortCommandes} onChange={(e) => setSortCommandes(e.target.value)}>
                <option value="dateDesc">Date desc</option>
                <option value="dateAsc">Date asc</option>
                <option value="amountDesc">Montant desc</option>
                <option value="amountAsc">Montant asc</option>
              </select>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={groupCommandes}
                  onChange={(e) => setGroupCommandes(e.target.checked)}
                />
                <span>Regrouper par fournisseur</span>
              </label>
            </div>

            {!groupCommandes ? (
              <div className={styles.rows}>
                {pagedCommandes.map((item) => (
                  <article key={item.id} className={styles.rowCard}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{item.description || item.libelle || "-"}</div>
                      <div className={styles.rowMeta}>
                        Date: {formatDate(item.date)} | Fournisseur: {item.fournisseur || "-"} | Statut:{" "}
                        {item.statut || "-"}
                      </div>
                    </div>
                    <div className={styles.rowAmount}>{formatMoney(item.montant)}</div>
                  </article>
                ))}
                {pagedCommandes.length === 0 ? <div className={styles.emptyBlock}>Aucune commande.</div> : null}
              </div>
            ) : (
              <div className={styles.groupList}>
                {groupedCommandes.map((group) => (
                  <div key={group.name} className={styles.groupCard}>
                    <button
                      type="button"
                      className={styles.groupHeader}
                      onClick={() =>
                        setOpenCmdGroups((prev) => ({
                          ...prev,
                          [group.name]: !prev[group.name],
                        }))
                      }
                    >
                      <span>
                        {group.name} ({group.count})
                      </span>
                      <span>{formatMoney(group.total)}</span>
                    </button>
                    {openCmdGroups[group.name] ? (
                      <div className={styles.groupBody}>
                        {group.items.map((item) => (
                          <article key={item.id} className={styles.rowCard}>
                            <div className={styles.rowMain}>
                              <div className={styles.rowTitle}>{item.description || item.libelle || "-"}</div>
                              <div className={styles.rowMeta}>
                                Date: {formatDate(item.date)} | Statut: {item.statut || "-"}
                              </div>
                            </div>
                            <div className={styles.rowAmount}>{formatMoney(item.montant)}</div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {groupedCommandes.length === 0 ? <div className={styles.emptyBlock}>Aucune commande.</div> : null}
              </div>
            )}

            {totalCmdPages > 1 ? (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={safeCmdPage <= 1}
                  onClick={() => setPageCommandes((prev) => Math.max(1, prev - 1))}
                >
                  Précédent
                </button>
                <span className={styles.pageInfo}>
                  Page {safeCmdPage} / {totalCmdPages}
                </span>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={safeCmdPage >= totalCmdPages}
                  onClick={() => setPageCommandes((prev) => Math.min(totalCmdPages, prev + 1))}
                >
                  Suivant
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.accordion}>
        <button type="button" className={styles.accordionButton} onClick={() => setOpenPrestataires((v) => !v)}>
          <span>Prestataires - {project?.nomProjet || projetName}</span>
          <span>
            ({filteredMissions.length}) - {formatMoney(missionSubtotal)}
          </span>
        </button>

        {openPrestataires ? (
          <div className={styles.sectionBody}>
            <div className={styles.sectionToolbar}>
              <input
                className={styles.searchInput}
                type="text"
                value={searchMissions}
                onChange={(e) => setSearchMissions(e.target.value)}
                placeholder="Rechercher dans prestataires"
              />
              <select className={styles.select} value={sortMissions} onChange={(e) => setSortMissions(e.target.value)}>
                <option value="dateDesc">Date desc</option>
                <option value="dateAsc">Date asc</option>
                <option value="amountDesc">Montant desc</option>
                <option value="amountAsc">Montant asc</option>
              </select>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={groupMissions}
                  onChange={(e) => setGroupMissions(e.target.checked)}
                />
                <span>Regrouper par prestataire</span>
              </label>
            </div>

            {!groupMissions ? (
              <div className={styles.rows}>
                {pagedMissions.map((item) => (
                  <article key={item.id} className={styles.rowCard}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{item.description || item.mission || "-"}</div>
                      <div className={styles.rowMeta}>
                        Période: {formatPeriode(item.dateDebut, item.dateFin)} | Prestataire: {item.prestataireNom || "-"}
                      </div>
                    </div>
                    <div className={styles.rowAmount}>{formatMoney(item.montant)}</div>
                  </article>
                ))}
                {pagedMissions.length === 0 ? <div className={styles.emptyBlock}>Aucune mission.</div> : null}
              </div>
            ) : (
              <div className={styles.groupList}>
                {groupedMissions.map((group) => (
                  <div key={group.name} className={styles.groupCard}>
                    <button
                      type="button"
                      className={styles.groupHeader}
                      onClick={() =>
                        setOpenMissionGroups((prev) => ({
                          ...prev,
                          [group.name]: !prev[group.name],
                        }))
                      }
                    >
                      <span>
                        {group.name} ({group.count})
                      </span>
                      <span>{formatMoney(group.total)}</span>
                    </button>
                    {openMissionGroups[group.name] ? (
                      <div className={styles.groupBody}>
                        {group.items.map((item) => (
                          <article key={item.id} className={styles.rowCard}>
                            <div className={styles.rowMain}>
                              <div className={styles.rowTitle}>{item.description || item.mission || "-"}</div>
                              <div className={styles.rowMeta}>
                                Période: {formatPeriode(item.dateDebut, item.dateFin)}
                              </div>
                            </div>
                            <div className={styles.rowAmount}>{formatMoney(item.montant)}</div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {groupedMissions.length === 0 ? <div className={styles.emptyBlock}>Aucune mission.</div> : null}
              </div>
            )}

            {totalMissionPages > 1 ? (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={safeMissionPage <= 1}
                  onClick={() => setPageMissions((prev) => Math.max(1, prev - 1))}
                >
                  Précédent
                </button>
                <span className={styles.pageInfo}>
                  Page {safeMissionPage} / {totalMissionPages}
                </span>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={safeMissionPage >= totalMissionPages}
                  onClick={() => setPageMissions((prev) => Math.min(totalMissionPages, prev + 1))}
                >
                  Suivant
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
