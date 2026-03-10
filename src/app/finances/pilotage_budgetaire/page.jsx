"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./PilotageBudgetaire.module.css";

const MONTHS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Fevrier" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Aout" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Decembre" },
];

const DEFAULT_CATEGORY_OPTIONS = ["Outils", "Consommable", "Logistique", "Materiel", "Autre"];
const PIE_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#f97316"];

function toSafeNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value) {
  return `${toSafeNumber(value).toFixed(2)} EUR`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("fr-FR");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toMonthInputValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseMonthValue(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [y, m] = raw.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function countMonthsBetween(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const sy = startDate.getFullYear();
  const sm = startDate.getMonth();
  const ey = endDate.getFullYear();
  const em = endDate.getMonth();
  const diff = (ey - sy) * 12 + (em - sm) + 1;
  return Math.max(1, diff);
}

function monthLabel(year, month) {
  const label = MONTHS.find((item) => item.value === month)?.label || `M${month}`;
  return `${label} ${year}`;
}

async function fetchItems(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Erreur chargement ${url}`);
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.items) ? data.items : [];
}

export default function PilotageBudgetairePage() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [contrats, setContrats] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [inventaire, setInventaire] = useState([]);

  const [periodMode, setPeriodMode] = useState("year");
  const [periodYear, setPeriodYear] = useState(currentYear);
  const [periodMonth, setPeriodMonth] = useState(toMonthInputValue(now));
  const [periodFrom, setPeriodFrom] = useState(`${currentYear}-01-01`);
  const [periodTo, setPeriodTo] = useState(`${currentYear}-12-31`);

  const [selectedProjet, setSelectedProjet] = useState("all");
  const [selectedCategorie, setSelectedCategorie] = useState("all");
  const [selectedBranche, setSelectedBranche] = useState("all");
  const [selectedLieu, setSelectedLieu] = useState("all");
  const [topPage, setTopPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [resContrats, resCommandes, resPrestataires, resInventaire] = await Promise.allSettled([
        fetchItems("/api/contrats"),
        fetchItems("/api/commandes"),
        fetchItems("/api/prestataires"),
        fetchItems("/api/inventaire"),
      ]);

      if (cancelled) return;

      setContrats(resContrats.status === "fulfilled" ? resContrats.value : []);
      setCommandes(resCommandes.status === "fulfilled" ? resCommandes.value : []);
      setPrestataires(resPrestataires.status === "fulfilled" ? resPrestataires.value : []);
      setInventaire(resInventaire.status === "fulfilled" ? resInventaire.value : []);
    })().catch((error) => {
      console.error(error);
      if (cancelled) return;
      setContrats([]);
      setCommandes([]);
      setPrestataires([]);
      setInventaire([]);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const projetMetaMap = useMemo(() => {
    const map = new Map();
    for (const contrat of contrats) {
      const projet = String(contrat?.nomContrat || "").trim();
      if (!projet) continue;
      map.set(projet, {
        branche: String(contrat?.branche || "").trim(),
        lieu: String(contrat?.lieu || "").trim(),
      });
    }
    return map;
  }, [contrats]);

  const allTransactions = useMemo(() => {
    const rows = [];

    for (const commande of commandes) {
      const dateRaw = String(commande?.dateCreation || commande?.createdAt || "").trim();
      const dateObj = new Date(dateRaw);
      if (Number.isNaN(dateObj.getTime())) continue;

      const baseId = String(commande?._id || commande?.id || `commande-${rows.length}`);
      const produits = Array.isArray(commande?.produits) ? commande.produits : [];
      const produitsAvecProjet = produits
        .map((produit, index) => ({ produit, index }))
        .filter(({ produit }) => String(produit?.projet || "").trim());

      if (produitsAvecProjet.length === 0) {
        const projet = String(commande?.projet || "").trim();
        if (!projet) continue;

        rows.push({
          id: baseId,
          source: "Commande",
          date: dateRaw,
          dateObj,
          year: dateObj.getFullYear(),
          month: dateObj.getMonth() + 1,
          projet,
          branche: String(commande?.branche || "").trim(),
          lieu: String(commande?.lieux || commande?.zoneStockage || "").trim(),
          categorie: String(commande?.categories || "").trim(),
          acteur: String(commande?.fournisseur || "").trim(),
          libelle: String(commande?.produit || commande?.description || "Commande").trim(),
          montant: toSafeNumber(commande?.prixTotalHT) + toSafeNumber(commande?.fraisLivraison),
        });
        continue;
      }

      for (const { produit, index } of produitsAvecProjet) {
        rows.push({
          id: `${baseId}-p${index}`,
          source: "Commande",
          date: dateRaw,
          dateObj,
          year: dateObj.getFullYear(),
          month: dateObj.getMonth() + 1,
          projet: String(produit?.projet || "").trim(),
          branche: String(commande?.branche || "").trim(),
          lieu: String(produit?.lieux || produit?.zoneStockage || commande?.lieux || commande?.zoneStockage || "").trim(),
          categorie: String(produit?.categories || commande?.categories || "").trim(),
          acteur: String(commande?.fournisseur || "").trim(),
          libelle: String(produit?.nomProduit || produit?.produit || commande?.produit || commande?.description || "Commande").trim(),
          montant:
            toSafeNumber(produit?.prixTotalHT) +
            (index === 0 ? toSafeNumber(commande?.fraisLivraison) : 0),
        });
      }
    }

    for (const prestataire of prestataires) {
      const fullName = `${String(prestataire?.prenom || "").trim()} ${String(
        prestataire?.nom || ""
      ).trim()}`.trim();
      const missions = Array.isArray(prestataire?.missions) ? prestataire.missions : [];

      for (const mission of missions) {
        const projet = String(mission?.projet || "").trim();
        if (!projet) continue;

        const dateRaw = String(mission?.dateDebut || "").trim();
        const dateObj = new Date(dateRaw);
        if (Number.isNaN(dateObj.getTime())) continue;

        const meta = projetMetaMap.get(projet);

        rows.push({
          id: `${String(prestataire?._id || prestataire?.id || "prestataire")}-${String(
            mission?.id || rows.length
          )}`,
          source: "Prestataire",
          date: dateRaw,
          dateObj,
          year: dateObj.getFullYear(),
          month: dateObj.getMonth() + 1,
          projet,
          branche: String(meta?.branche || "").trim(),
          lieu: String(meta?.lieu || "").trim(),
          categorie: String(mission?.categorie || "").trim(),
          acteur: fullName,
          libelle: String(mission?.nomMission || "Mission prestataire").trim(),
          montant: toSafeNumber(mission?.tarifTotal),
        });
      }
    }

    return rows;
  }, [commandes, prestataires, projetMetaMap]);

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    for (const transaction of allTransactions) years.add(transaction.year);
    return Array.from(years).sort((a, b) => b - a);
  }, [allTransactions, currentYear]);

  const availableProjects = useMemo(() => {
    const projects = new Set();
    for (const contrat of contrats) {
      const name = String(contrat?.nomContrat || "").trim();
      if (name) projects.add(name);
    }
    for (const transaction of allTransactions) {
      if (transaction.projet) projects.add(transaction.projet);
    }
    return Array.from(projects).sort((a, b) => a.localeCompare(b, "fr"));
  }, [contrats, allTransactions]);

  const availableCategories = useMemo(() => {
    const categories = new Set();
    for (const transaction of allTransactions) {
      if (transaction.categorie) categories.add(transaction.categorie);
    }
    if (categories.size === 0) return DEFAULT_CATEGORY_OPTIONS;
    return Array.from(categories).sort((a, b) => a.localeCompare(b, "fr"));
  }, [allTransactions]);

  const availableBranches = useMemo(() => {
    const branches = new Set();
    for (const contrat of contrats) {
      const value = String(contrat?.branche || "").trim();
      if (value) branches.add(value);
    }
    for (const commande of commandes) {
      const value = String(commande?.branche || "").trim();
      if (value) branches.add(value);
    }
    for (const item of inventaire) {
      const value = String(item?.branche || "").trim();
      if (value) branches.add(value);
    }
    for (const transaction of allTransactions) {
      if (transaction.branche) branches.add(transaction.branche);
    }
    return Array.from(branches).sort((a, b) => a.localeCompare(b, "fr"));
  }, [contrats, commandes, inventaire, allTransactions]);

  const availableLieux = useMemo(() => {
    const lieux = new Set();
    for (const contrat of contrats) {
      const value = String(contrat?.lieu || "").trim();
      if (value) lieux.add(value);
    }
    for (const commande of commandes) {
      const primary = String(commande?.lieux || "").trim();
      const secondary = String(commande?.zoneStockage || "").trim();
      if (primary) lieux.add(primary);
      if (secondary) lieux.add(secondary);

      const produits = Array.isArray(commande?.produits) ? commande.produits : [];
      for (const produit of produits) {
        const ligneLieu = String(produit?.lieux || "").trim();
        const ligneZone = String(produit?.zoneStockage || "").trim();
        if (ligneLieu) lieux.add(ligneLieu);
        if (ligneZone) lieux.add(ligneZone);
      }
    }
    for (const item of inventaire) {
      const primary = String(item?.lieux || "").trim();
      const secondary = String(item?.zoneStockage || "").trim();
      if (primary) lieux.add(primary);
      if (secondary) lieux.add(secondary);
    }
    for (const transaction of allTransactions) {
      if (transaction.lieu) lieux.add(transaction.lieu);
    }
    return Array.from(lieux).sort((a, b) => a.localeCompare(b, "fr"));
  }, [contrats, commandes, inventaire, allTransactions]);

  const periodRange = useMemo(() => {
    if (periodMode === "year") {
      const start = new Date(periodYear, 0, 1);
      const end = new Date(periodYear, 11, 31, 23, 59, 59, 999);
      return { start, end, label: `Annee ${periodYear}` };
    }

    if (periodMode === "month") {
      const parsed = parseMonthValue(periodMonth);
      if (!parsed) return { start: null, end: null, label: "Mois invalide" };
      const start = new Date(parsed.year, parsed.month - 1, 1);
      const end = new Date(parsed.year, parsed.month, 0, 23, 59, 59, 999);
      return { start, end, label: monthLabel(parsed.year, parsed.month) };
    }

    const start = periodFrom ? startOfDay(periodFrom) : null;
    const end = periodTo ? endOfDay(periodTo) : null;
    return {
      start,
      end,
      label:
        start && end
          ? `${formatDate(start)} - ${formatDate(end)}`
          : "Plage de dates",
    };
  }, [periodMode, periodYear, periodMonth, periodFrom, periodTo]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((transaction) => {
      if (periodRange.start && transaction.dateObj < periodRange.start) return false;
      if (periodRange.end && transaction.dateObj > periodRange.end) return false;
      if (selectedProjet !== "all" && transaction.projet !== selectedProjet) return false;
      if (selectedCategorie !== "all" && transaction.categorie !== selectedCategorie) return false;
      if (selectedBranche !== "all" && transaction.branche !== selectedBranche) return false;
      if (selectedLieu !== "all" && transaction.lieu !== selectedLieu) return false;
      return true;
    });
  }, [
    allTransactions,
    periodRange.start,
    periodRange.end,
    selectedProjet,
    selectedCategorie,
    selectedBranche,
    selectedLieu,
  ]);

  const totalDepense = useMemo(() => {
    return filteredTransactions.reduce((sum, transaction) => sum + transaction.montant, 0);
  }, [filteredTransactions]);

  const monthlyAverage = useMemo(() => {
    if (periodMode === "year") return totalDepense / 12;
    if (periodMode === "month") return totalDepense;
    return totalDepense / countMonthsBetween(periodRange.start, periodRange.end);
  }, [periodMode, totalDepense, periodRange.start, periodRange.end]);

  const transactionCount = filteredTransactions.length;

  const categoryTotals = useMemo(() => {
    const map = new Map();
    for (const transaction of filteredTransactions) {
      if (!transaction.categorie) continue;
      map.set(transaction.categorie, (map.get(transaction.categorie) || 0) + transaction.montant);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const projectTotals = useMemo(() => {
    const map = new Map();
    for (const transaction of filteredTransactions) {
      map.set(transaction.projet, (map.get(transaction.projet) || 0) + transaction.montant);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const topCardLabel = categoryTotals.length > 0 ? "Top categorie" : "Top projet";
  const topCardValue =
    categoryTotals.length > 0 ? categoryTotals[0]?.label || "-" : projectTotals[0]?.label || "-";

  const monthlyChartData = useMemo(() => {
    if (periodMode === "year") {
      return MONTHS.map((month) => {
        const amount = filteredTransactions
          .filter((transaction) => transaction.month === month.value)
          .reduce((sum, transaction) => sum + transaction.montant, 0);
        return { label: month.label, amount };
      });
    }

    if (periodMode === "month") {
      const parsed = parseMonthValue(periodMonth);
      const label = parsed ? monthLabel(parsed.year, parsed.month) : "Mois";
      return [{ label, amount: totalDepense }];
    }

    const map = new Map();
    for (const transaction of filteredTransactions) {
      const y = transaction.dateObj.getFullYear();
      const m = transaction.dateObj.getMonth() + 1;
      const key = `${y}-${pad2(m)}`;
      map.set(key, (map.get(key) || 0) + transaction.montant);
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, amount]) => {
        const [year, month] = key.split("-").map(Number);
        return { label: monthLabel(year, month), amount };
      });
  }, [periodMode, periodMonth, filteredTransactions, totalDepense]);

  const pieData = useMemo(() => {
    if (categoryTotals.length > 0) return categoryTotals;
    const sourceMap = new Map();
    for (const transaction of filteredTransactions) {
      sourceMap.set(transaction.source, (sourceMap.get(transaction.source) || 0) + transaction.montant);
    }
    return Array.from(sourceMap.entries()).map(([label, value]) => ({ label, value }));
  }, [categoryTotals, filteredTransactions]);

  const pieTotal = useMemo(() => {
    return pieData.reduce((sum, item) => sum + item.value, 0);
  }, [pieData]);

  const sortedTopTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => b.montant - a.montant);
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(sortedTopTransactions.length / pageSize));
  const safeTopPage = Math.min(topPage, totalPages);
  const pagedTransactions = sortedTopTransactions.slice(
    (safeTopPage - 1) * pageSize,
    safeTopPage * pageSize
  );

  const resetFilters = () => {
    setPeriodMode("year");
    setPeriodYear(currentYear);
    setPeriodMonth(toMonthInputValue(now));
    setPeriodFrom(`${currentYear}-01-01`);
    setPeriodTo(`${currentYear}-12-31`);
    setSelectedProjet("all");
    setSelectedCategorie("all");
    setSelectedBranche("all");
    setSelectedLieu("all");
    setTopPage(1);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Pilotage Budgetaire</h1>
      </div>

      <section className={styles.filtersCard}>
        <div className={styles.filtersGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Periode</label>
            <select
              className={styles.select}
              value={periodMode}
              onChange={(e) => {
                setPeriodMode(e.target.value);
                setTopPage(1);
              }}
            >
              <option value="year">Toute l&apos;annee</option>
              <option value="month">Tout le mois</option>
              <option value="custom">De date a date</option>
            </select>
          </div>

          {periodMode === "year" ? (
            <div className={styles.field}>
              <label className={styles.label}>Annee</label>
              <select
                className={styles.select}
                value={periodYear}
                onChange={(e) => {
                  setPeriodYear(Number(e.target.value));
                  setTopPage(1);
                }}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {periodMode === "month" ? (
            <div className={styles.field}>
              <label className={styles.label}>Mois</label>
              <input
                className={styles.select}
                type="month"
                value={periodMonth}
                onChange={(e) => {
                  setPeriodMonth(e.target.value);
                  setTopPage(1);
                }}
              />
            </div>
          ) : null}

          {periodMode === "custom" ? (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Date debut</label>
                <input
                  className={styles.select}
                  type="date"
                  value={periodFrom}
                  onChange={(e) => {
                    setPeriodFrom(e.target.value);
                    setTopPage(1);
                  }}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Date fin</label>
                <input
                  className={styles.select}
                  type="date"
                  value={periodTo}
                  onChange={(e) => {
                    setPeriodTo(e.target.value);
                    setTopPage(1);
                  }}
                />
              </div>
            </>
          ) : null}

          <div className={styles.field}>
            <label className={styles.label}>Projet</label>
            <select
              className={styles.select}
              value={selectedProjet}
              onChange={(e) => {
                setSelectedProjet(e.target.value);
                setTopPage(1);
              }}
            >
              <option value="all">Tous les projets</option>
              {availableProjects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Categorie</label>
            <select
              className={styles.select}
              value={selectedCategorie}
              onChange={(e) => {
                setSelectedCategorie(e.target.value);
                setTopPage(1);
              }}
            >
              <option value="all">Toutes</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Branche</label>
            <select
              className={styles.select}
              value={selectedBranche}
              onChange={(e) => {
                setSelectedBranche(e.target.value);
                setTopPage(1);
              }}
            >
              <option value="all">Toutes les branches</option>
              {availableBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Lieux</label>
            <select
              className={styles.select}
              value={selectedLieu}
              onChange={(e) => {
                setSelectedLieu(e.target.value);
                setTopPage(1);
              }}
            >
              <option value="all">Tous les lieux</option>
              {availableLieux.map((lieu) => (
                <option key={lieu} value={lieu}>
                  {lieu}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button type="button" className={styles.secondaryBtn} onClick={resetFilters}>
            Reinitialiser
          </button>
        </div>
      </section>

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total depense sur la periode</div>
          <div className={styles.kpiValue}>{formatMoney(totalDepense)}</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Depenses moyennes mensuelles</div>
          <div className={styles.kpiValue}>{formatMoney(monthlyAverage)}</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Nombre de transactions</div>
          <div className={styles.kpiValue}>{transactionCount}</div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{topCardLabel}</div>
          <div className={styles.kpiValue}>{topCardValue}</div>
        </article>
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Depenses par mois ({periodRange.label})</h2>
          <div className={styles.chartCanvas}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.12)" />
                <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                <YAxis tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value || 0)), "Depenses"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.14)" }}
                />
                <Bar dataKey="amount" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={styles.chartCard}>
          <h2 className={styles.chartTitle}>
            {categoryTotals.length > 0
              ? "Repartition par categorie"
              : "Repartition par type: Commandes vs Prestataires"}
          </h2>
          <div className={styles.chartCanvas}>
            {pieData.length === 0 ? (
              <div className={styles.emptyLegend}>Aucune donnee pour la periode.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="label" innerRadius={52} outerRadius={86} paddingAngle={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={`${entry.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const numeric = Number(value || 0);
                      const ratio = pieTotal > 0 ? (numeric / pieTotal) * 100 : 0;
                      return [`${formatMoney(numeric)} (${ratio.toFixed(1)}%)`, "Montant"];
                    }}
                    contentStyle={{ borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.14)" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => <span style={{ color: "#0f172a", fontWeight: 700 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>Top depenses</h2>
          <div className={styles.listHint}>Tri: montant decroissant ({sortedTopTransactions.length} elements)</div>
        </div>

        <div className={styles.items}>
          {pagedTransactions.length === 0 ? (
            <div className={styles.emptyItem}>Aucune depense sur cette selection.</div>
          ) : (
            pagedTransactions.map((item) => (
              <article key={item.id} className={styles.itemCard}>
                <div className={styles.itemMeta}>
                  <span className={styles.badge}>{formatDate(item.date)}</span>
                  <span className={styles.badge}>{item.projet}</span>
                  <span className={styles.badge}>{item.source}</span>
                  {item.branche ? <span className={styles.badge}>{item.branche}</span> : null}
                  {item.lieu ? <span className={styles.badge}>{item.lieu}</span> : null}
                </div>
                <div className={styles.itemMain}>
                  <div className={styles.itemTitle}>{item.libelle || "-"}</div>
                  <div className={styles.itemSub}>
                    {item.acteur || "-"} {item.categorie ? `- ${item.categorie}` : ""}
                  </div>
                </div>
                <div className={styles.itemAmount}>{formatMoney(item.montant)}</div>
              </article>
            ))
          )}
        </div>

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setTopPage((prev) => Math.max(1, prev - 1))}
            disabled={safeTopPage <= 1}
          >
            Precedent
          </button>
          <span className={styles.pageInfo}>
            Page {safeTopPage} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setTopPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safeTopPage >= totalPages}
          >
            Suivant
          </button>
        </div>
      </section>
    </div>
  );
}
