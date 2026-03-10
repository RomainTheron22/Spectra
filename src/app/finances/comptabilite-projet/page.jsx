"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./ComptabiliteProjet.module.css";

const SORT_OPTIONS = [
  { value: "totalDesc", label: "Montant dépensé (desc)" },
  { value: "totalAsc", label: "Montant dépensé (asc)" },
  { value: "dateDesc", label: "Date de début (desc)" },
  { value: "dateAsc", label: "Date de début (asc)" },
  { value: "nameAsc", label: "Nom (A-Z)" },
];

function formatMoney(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toFixed(2)} €`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

function formatPeriode(dateDebut, dateFin) {
  if (!dateDebut && !dateFin) return "-";
  return `${formatDate(dateDebut)} - ${formatDate(dateFin)}`;
}

export default function ComptabiliteProjetPage() {
  const currentYear = new Date().getFullYear();

  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [years, setYears] = useState([currentYear]);

  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortBy, setSortBy] = useState("totalDesc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (filterClient !== "all") params.set("client", filterClient);
    if (filterStatut !== "all") params.set("statut", filterStatut);
    if (filterYear) params.set("year", String(filterYear));
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    params.set("sort", sortBy);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params;
  }, [search, filterClient, filterStatut, filterYear, filterDateFrom, filterDateTo, sortBy, page]);

  const fetchProjects = async (isExport = false) => {
    if (!isExport) {
      setLoading(true);
      setError("");
    }

    const params = new URLSearchParams(queryParams.toString());
    if (isExport) {
      params.set("page", "1");
      params.set("pageSize", "5000");
    }

    const res = await fetch(`/api/finances/comptabilite-projet?${params.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur chargement"}${data?.details ? " - " + data.details : ""}`);
    }

    if (isExport) return data;

    setRows(Array.isArray(data?.items) ? data.items : []);
    setTotalPages(Number(data?.meta?.totalPages || 1));
    setTotalItems(Number(data?.meta?.total || 0));
    setClients(Array.isArray(data?.meta?.options?.clients) ? data.meta.options.clients : []);
    setStatuts(Array.isArray(data?.meta?.options?.statuts) ? data.meta.options.statuts : ["En cours", "Termine", "Archive"]);
    const ys = Array.isArray(data?.meta?.options?.years) && data.meta.options.years.length ? data.meta.options.years : [currentYear];
    setYears(ys);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchProjects(false);
      } catch (err) {
        if (!cancelled) setError(String(err?.message || err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  const resetFilters = () => {
    setSearch("");
    setFilterClient("all");
    setFilterStatut("all");
    setFilterYear(currentYear);
    setFilterDateFrom("");
    setFilterDateTo("");
    setSortBy("totalDesc");
    setPage(1);
  };

  const statusOptions = useMemo(() => {
    const base = ["En cours", "Termine", "Archive"];
    const merged = new Set([...base, ...statuts]);
    return Array.from(merged);
  }, [statuts]);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Comptabilité Projet</h1>
      </div>

      <div className={styles.filtersCard}>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un projet..."
          />
        </div>

        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Client</label>
            <select
              className={styles.select}
              value={filterClient}
              onChange={(e) => {
                setFilterClient(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tous</option>
              {clients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Statut projet</label>
            <select
              className={styles.select}
              value={filterStatut}
              onChange={(e) => {
                setFilterStatut(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tous</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Année</label>
            <select
              className={styles.select}
              value={filterYear}
              onChange={(e) => {
                setFilterYear(Number(e.target.value));
                setPage(1);
              }}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Date début min</label>
            <input
              className={styles.input}
              type="date"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Date fin max</label>
            <input
              className={styles.input}
              type="date"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className={styles.fieldWide}>
            <label className={styles.label}>Tri</label>
            <select
              className={styles.select}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.secondaryBtn} onClick={resetFilters}>
            Réinitialiser
          </button>
        </div>
      </div>

      {error ? <div className={styles.errorBox}>Erreur: {error}</div> : null}

      <div className={styles.cards}>
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className={`${styles.card} ${styles.skeletonCard}`} />
            ))
          : null}

        {!loading && !error && rows.length === 0 ? (
          <div className={styles.emptyCard}>
            <div>Aucun projet trouvé.</div>
            <button type="button" className={styles.secondaryBtn} onClick={resetFilters}>
              Réinitialiser
            </button>
          </div>
        ) : null}

        {!loading && !error
          ? rows.map((row) => (
              <Link
                key={row.nomProjet}
                href={`/finances/comptabilite-projet/${encodeURIComponent(row.nomProjet)}`}
                className={styles.cardLink}
                role="link"
                aria-label={`Ouvrir la comptabilité du projet ${row.nomProjet}`}
              >
                <article className={styles.card}>
                  <div className={styles.topRow}>
                    <h2 className={styles.projetName}>{row.nomProjet}</h2>
                    <div className={styles.totalPill}>{formatMoney(row.totalDepense)}</div>
                  </div>

                  <div className={styles.metaLine}>
                    <span>Client: {row.clientNom || "-"}</span>
                    <span>Statut: {row.statut || "-"}</span>
                    <span>Dates: {formatPeriode(row.dateDebut, row.dateFin)}</span>
                  </div>

                  <div className={styles.badges}>
                    <span className={styles.badge}>Commandes: {row.nbCommandes}</span>
                    <span className={styles.badge}>Missions: {row.nbMissions}</span>
                    {row.pctBudget === null || row.pctBudget === undefined ? null : (
                      <span className={styles.badge}>Budget consommé: {row.pctBudget.toFixed(1)}%</span>
                    )}
                  </div>
                </article>
              </Link>
            ))
          : null}
      </div>

      {!loading && !error && totalPages > 1 ? (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Précédent
          </button>
          <span className={styles.pageInfo}>
            Page {page} / {totalPages} ({totalItems} projets)
          </span>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Suivant
          </button>
        </div>
      ) : null}
    </div>
  );
}
