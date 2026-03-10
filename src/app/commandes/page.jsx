"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Commandes.module.css";
import Modal from "../../components/ui/Modal";
import SelectWithAdd from "../../components/ui/SelectWithAdd";

const BRANCH_OPTIONS = ["Agency", "CreativeGen", "Enterntainement", "SFX"];
const STATUS_OPTIONS = ["En attente", "A acheter", "Commande", "Partiellement recue", "Recue"];
const LIEUX_OPTIONS = ["Studio", "Atelier", "Fablab", "Maison"];

const FILTER_FIELDS = [
  { value: "fournisseur", label: "Fournisseur" },
  { value: "branche", label: "Branche" },
  { value: "status", label: "Status" },
  { value: "projet", label: "Projet" },
  { value: "categories", label: "Categorie" },
  { value: "lieux", label: "Lieu" },
  { value: "zoneStockage", label: "Zone de stockage" },
];

const MAIN_COLUMNS = [
  "Voir",
  "Date",
  "Fournisseur",
  "Branche",
  "Status",
  "Qonto",
  "Produits",
  "Total HT",
  "Commentaires",
  "Actions",
];

const RECOMMANDER_PREFILL_STORAGE_KEY = "commandes:recommande-prefill";

function createTempId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toYMD(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toSafeNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatMoney(value) {
  return toSafeNumber(value, 0).toFixed(2);
}

function computeLineTotal(quantite, prixUnitaireHT) {
  const q = Number(quantite);
  const pu = Number(prixUnitaireHT);
  if (!Number.isFinite(q) || !Number.isFinite(pu)) return 0;
  return Math.round(q * pu * 100) / 100;
}

function createEmptyProduct() {
  return {
    id: createTempId(),
    nomProduit: "",
    quantite: 1,
    prixUnitaireHT: "",
    referenceUrl: "",
    projet: "",
    categories: "",
    lieux: "Studio",
    zoneStockage: "",
    recu: false,
    inventaireCreated: false,
  };
}

function createEmptyForm(defaultDate) {
  return {
    dateCreation: defaultDate,
    fournisseur: "",
    branche: "Agency",
    status: "En attente",
    qonto: false,
    commentaires: "",
    produits: [createEmptyProduct()],
  };
}

function mergeUniqueSorted(a, b) {
  const values = [...(a || []), ...(b || [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(values)).sort((x, y) => x.localeCompare(y, "fr"));
}

function normalizeProduitFromApi(raw = {}, index = 0) {
  return {
    id: String(raw.id || raw._id || `legacy-${index}`),
    nomProduit: String(raw.nomProduit || raw.produit || "").trim(),
    quantite: toSafeNumber(raw.quantite, 0),
    prixUnitaireHT:
      raw.prixUnitaireHT === "" || raw.prixUnitaireHT === null || raw.prixUnitaireHT === undefined
        ? null
        : toSafeNumber(raw.prixUnitaireHT, null),
    prixTotalHT:
      raw.prixTotalHT === "" || raw.prixTotalHT === null || raw.prixTotalHT === undefined
        ? computeLineTotal(raw.quantite, raw.prixUnitaireHT)
        : toSafeNumber(raw.prixTotalHT, 0),
    referenceUrl: String(raw.referenceUrl || "").trim(),
    projet: String(raw.projet || "").trim(),
    categories: String(raw.categories || "").trim(),
    lieux: String(raw.lieux || "Studio").trim() || "Studio",
    zoneStockage: String(raw.zoneStockage || "").trim(),
    recu: !!raw.recu,
    inventaireCreated: !!raw.inventaireCreated,
  };
}

function normalizeCommandeFromApi(raw = {}) {
  const fallbackProduits = raw.produit
    ? [
        {
          id: "legacy-0",
          nomProduit: raw.produit,
          quantite: raw.quantite,
          prixUnitaireHT: raw.prixUnitaireHT,
          prixTotalHT: raw.prixTotalHT,
          referenceUrl: raw.referenceUrl,
          projet: raw.projet,
          categories: raw.categories,
          lieux: raw.lieux,
          zoneStockage: raw.zoneStockage,
          recu: raw.status === "En stock" || !!raw.inventaireCreated,
          inventaireCreated: !!raw.inventaireCreated,
        },
      ]
    : [];

  const produits = (Array.isArray(raw.produits) && raw.produits.length > 0 ? raw.produits : fallbackProduits)
    .map((line, index) => normalizeProduitFromApi(line, index))
    .filter((line) => line.nomProduit || line.projet || line.categories || line.referenceUrl || line.quantite || line.prixUnitaireHT);

  const totalProduits = produits.length;
  const computedTotal = produits.reduce((sum, line) => sum + toSafeNumber(line.prixTotalHT, 0), 0);

  return {
    ...raw,
    id: String(raw._id || raw.id),
    dateCreation: String(raw.dateCreation || "").trim(),
    fournisseur: String(raw.fournisseur || "").trim(),
    branche: String(raw.branche || "Agency").trim() || "Agency",
    status: String(raw.status || "En attente").trim() || "En attente",
    qonto: !!raw.qonto,
    commentaires: String(raw.commentaires || "").trim(),
    produits,
    totalProduits,
    prixTotalHT:
      raw.prixTotalHT === "" || raw.prixTotalHT === null || raw.prixTotalHT === undefined
        ? computedTotal
        : toSafeNumber(raw.prixTotalHT, computedTotal),
  };
}

function findCommandeAndProduit(rows, pendingReception) {
  if (!pendingReception?.commandeId || !pendingReception?.produitId) return null;
  const commande = rows.find((row) => row.id === pendingReception.commandeId);
  if (!commande) return null;
  const produit = commande.produits.find((line) => line.id === pendingReception.produitId);
  if (!produit) return null;
  return { commande, produit };
}

export default function CommandesPage() {
  const defaultDate = useMemo(() => toYMD(new Date()), []);

  const [rows, setRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState([{ field: "fournisseur", value: "" }]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm(defaultDate));

  const [expandedMap, setExpandedMap] = useState({});

  const [projetOptions, setProjetOptions] = useState([]);
  const [categorieOptions, setCategorieOptions] = useState([]);
  const [fournisseurOptions, setFournisseurOptions] = useState([]);

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockType, setStockType] = useState("Consommables");
  const [stockSeuilMin, setStockSeuilMin] = useState("");
  const [pendingReception, setPendingReception] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [resCommandes, resFournisseurs, resContrats] = await Promise.all([
          fetch("/api/commandes", { cache: "no-store" }),
          fetch("/api/fournisseurs", { cache: "no-store" }),
          fetch("/api/contrats", { cache: "no-store" }),
        ]);

        const [dataCommandes, dataFournisseurs, dataContrats] = await Promise.all([
          resCommandes.json().catch(() => ({})),
          resFournisseurs.json().catch(() => ({})),
          resContrats.json().catch(() => ({})),
        ]);

        if (!resCommandes.ok) {
          throw new Error(dataCommandes?.error || "Erreur chargement commandes");
        }

        if (cancelled) return;

        const mappedRows = (dataCommandes.items || []).map((item) => normalizeCommandeFromApi(item));
        setRows(mappedRows);

        const fournisseursFromRows = mappedRows.map((item) => item.fournisseur);
        const fournisseursFromApi = (dataFournisseurs.items || []).map((item) => String(item.nom || "").trim());
        setFournisseurOptions(mergeUniqueSorted(fournisseursFromRows, fournisseursFromApi));

        const projetsFromRows = mappedRows.flatMap((item) => item.produits.map((line) => line.projet));
        const projetsFromApi = (dataContrats.items || []).map((item) => String(item.nomContrat || "").trim());
        setProjetOptions(mergeUniqueSorted(projetsFromRows, projetsFromApi));

        const categoriesFromRows = mappedRows.flatMap((item) => item.produits.map((line) => line.categories));
        setCategorieOptions(mergeUniqueSorted(categoriesFromRows, []));
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawPayload = window.sessionStorage.getItem(RECOMMANDER_PREFILL_STORAGE_KEY);
    if (!rawPayload) return;

    window.sessionStorage.removeItem(RECOMMANDER_PREFILL_STORAGE_KEY);

    try {
      const parsed = JSON.parse(rawPayload);
      const commandeRaw = parsed?.commande || {};
      const produitRaw = parsed?.produit || {};

      const commande = {
        fournisseur: String(commandeRaw?.fournisseur || "").trim(),
        branche: String(commandeRaw?.branche || "Agency").trim() || "Agency",
        commentaires: String(commandeRaw?.commentaires || "").trim(),
      };

      const quantite = toSafeNumber(produitRaw?.quantite, 1);
      const prixUnitaireRaw = produitRaw?.prixUnitaireHT;
      const produit = {
        nomProduit: String(produitRaw?.nomProduit || "").trim(),
        quantite: quantite > 0 ? quantite : 1,
        prixUnitaireHT:
          prixUnitaireRaw === "" || prixUnitaireRaw === null || prixUnitaireRaw === undefined
            ? ""
            : toSafeNumber(prixUnitaireRaw, ""),
        referenceUrl: String(produitRaw?.referenceUrl || "").trim(),
        projet: String(produitRaw?.projet || "").trim(),
        categories: String(produitRaw?.categories || "").trim(),
        lieux: String(produitRaw?.lieux || "Studio").trim() || "Studio",
        zoneStockage: String(produitRaw?.zoneStockage || "").trim(),
      };

      if (produit.referenceUrl) {
        window.open(produit.referenceUrl, "_blank", "noopener,noreferrer");
      }

      setEditingId(null);
      setForm({
        dateCreation: defaultDate,
        fournisseur: commande.fournisseur,
        branche: commande.branche,
        status: "A acheter",
        qonto: false,
        commentaires: commande.commentaires,
        produits: [
          {
            id: createTempId(),
            nomProduit: produit.nomProduit,
            quantite: produit.quantite,
            prixUnitaireHT: produit.prixUnitaireHT,
            referenceUrl: produit.referenceUrl,
            projet: produit.projet,
            categories: produit.categories,
            lieux: produit.lieux,
            zoneStockage: produit.zoneStockage,
            recu: false,
            inventaireCreated: false,
          },
        ],
      });
      setOpen(true);
    } catch (error) {
      console.error("Impossible de lire le pre-remplissage recommander:", error);
    }
  }, [defaultDate]);

  const optionsByField = useMemo(() => {
    const map = {
      fournisseur: new Set(),
      branche: new Set(),
      status: new Set(),
      projet: new Set(),
      categories: new Set(),
      lieux: new Set(),
      zoneStockage: new Set(),
    };

    for (const row of rows) {
      if (row.fournisseur) map.fournisseur.add(row.fournisseur);
      if (row.branche) map.branche.add(row.branche);
      if (row.status) map.status.add(row.status);

      for (const line of row.produits || []) {
        if (line.projet) map.projet.add(line.projet);
        if (line.categories) map.categories.add(line.categories);
        if (line.lieux) map.lieux.add(line.lieux);
        if (line.zoneStockage) map.zoneStockage.add(line.zoneStockage);
      }
    }

    return Object.fromEntries(
      Object.entries(map).map(([key, set]) => [key, Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))])
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const searchBase = [
        row.fournisseur,
        row.commentaires,
        row.branche,
        row.status,
        ...row.produits.flatMap((line) => [line.nomProduit, line.projet, line.categories, line.referenceUrl]),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchBase.includes(query);
      if (!matchesSearch) return false;

      return filters.every((filter) => {
        if (!filter.value) return true;
        const value = filter.value;

        if (filter.field === "fournisseur") return row.fournisseur === value;
        if (filter.field === "branche") return row.branche === value;
        if (filter.field === "status") return row.status === value;

        return row.produits.some((line) => String(line?.[filter.field] || "") === value);
      });
    });
  }, [rows, searchQuery, filters]);

  const formTotal = useMemo(() => {
    return form.produits.reduce(
      (sum, line) => sum + computeLineTotal(line.quantite, line.prixUnitaireHT),
      0
    );
  }, [form.produits]);

  const pendingTarget = useMemo(
    () => findCommandeAndProduit(rows, pendingReception),
    [rows, pendingReception]
  );

  const updateFormField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateProduitField = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.produits];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, produits: next };
    });
  };

  const addProduitLine = () => {
    setForm((prev) => ({ ...prev, produits: [...prev.produits, createEmptyProduct()] }));
  };

  const removeProduitLine = (index) => {
    setForm((prev) => {
      if (prev.produits.length <= 1) return prev;
      return { ...prev, produits: prev.produits.filter((_, i) => i !== index) };
    });
  };

  const resetForm = () => {
    setForm(createEmptyForm(defaultDate));
  };

  const openAddModal = () => {
    setEditingId(null);
    resetForm();
    setOpen(true);
  };

  const openEditModal = (row) => {
    setEditingId(row.id);
    setForm({
      dateCreation: row.dateCreation || defaultDate,
      fournisseur: row.fournisseur || "",
      branche: row.branche || "Agency",
      status: row.status || "En attente",
      qonto: !!row.qonto,
      commentaires: row.commentaires || "",
      produits:
        row.produits.length > 0
          ? row.produits.map((line) => ({
              id: line.id || createTempId(),
              nomProduit: line.nomProduit || "",
              quantite: line.quantite ?? 0,
              prixUnitaireHT: line.prixUnitaireHT ?? "",
              referenceUrl: line.referenceUrl || "",
              projet: line.projet || "",
              categories: line.categories || "",
              lieux: line.lieux || "Studio",
              zoneStockage: line.zoneStockage || "",
              recu: !!line.recu,
              inventaireCreated: !!line.inventaireCreated,
            }))
          : [createEmptyProduct()],
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingId(null);
  };

  const patchCommande = async (id, changes) => {
    const res = await fetch(`/api/commandes/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur mise a jour commande"}${data?.details ? ` - ${data.details}` : ""}`);
    }

    return normalizeCommandeFromApi(data.item);
  };

  const persistProduits = async (commandeId, produits) => {
    const updated = await patchCommande(commandeId, { produits });
    setRows((prev) => prev.map((row) => (row.id === commandeId ? updated : row)));
    return updated;
  };

  const buildPayloadFromForm = () => {
    const produits = form.produits
      .map((line) => ({
        id: String(line.id || createTempId()),
        nomProduit: String(line.nomProduit || "").trim(),
        quantite: toSafeNumber(line.quantite, 0),
        prixUnitaireHT:
          line.prixUnitaireHT === "" || line.prixUnitaireHT === null || line.prixUnitaireHT === undefined
            ? null
            : toSafeNumber(line.prixUnitaireHT, null),
        prixTotalHT: computeLineTotal(line.quantite, line.prixUnitaireHT),
        referenceUrl: String(line.referenceUrl || "").trim(),
        projet: String(line.projet || "").trim(),
        categories: String(line.categories || "").trim(),
        lieux: String(line.lieux || "Studio").trim() || "Studio",
        zoneStockage: String(line.zoneStockage || "").trim(),
        recu: !!line.recu,
        inventaireCreated: !!line.inventaireCreated,
      }))
      .filter((line) => line.nomProduit);

    return {
      dateCreation: form.dateCreation,
      fournisseur: String(form.fournisseur || "").trim(),
      branche: form.branche,
      status: form.status,
      qonto: !!form.qonto,
      commentaires: String(form.commentaires || "").trim(),
      produits,
    };
  };

  const submitForm = async (e) => {
    e.preventDefault();

    const payload = buildPayloadFromForm();

    if (!payload.fournisseur) {
      alert("Le fournisseur est obligatoire.");
      return;
    }

    if (!payload.produits.length) {
      alert("Ajoute au moins un produit avec un nom.");
      return;
    }

    try {
      if (editingId) {
        const updated = await patchCommande(editingId, payload);
        setRows((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
      } else {
        const res = await fetch("/api/commandes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(`${data?.error || "Erreur creation commande"}${data?.details ? ` - ${data.details}` : ""}`);
        }

        const saved = normalizeCommandeFromApi(data.item);
        setRows((prev) => [saved, ...prev]);
      }

      setFournisseurOptions((prev) => mergeUniqueSorted(prev, [payload.fournisseur]));
      setProjetOptions((prev) => mergeUniqueSorted(prev, payload.produits.map((line) => line.projet)));
      setCategorieOptions((prev) => mergeUniqueSorted(prev, payload.produits.map((line) => line.categories)));

      closeModal();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur lors de la sauvegarde");
    }
  };

  const deleteCommande = async (id) => {
    const confirmed = window.confirm("Supprimer cette commande ?");
    if (!confirmed) return;

    const res = await fetch(`/api/commandes/${encodeURIComponent(String(id))}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur suppression commande"}${data?.details ? ` - ${data.details}` : ""}`);
    }

    setRows((prev) => prev.filter((row) => row.id !== id));
    setExpandedMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleExpanded = (id) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openRecommandeModal = (commande, produit) => {
    const quantite = toSafeNumber(produit?.quantite, 1);

    setEditingId(null);
    setForm({
      dateCreation: defaultDate,
      fournisseur: commande?.fournisseur || "",
      branche: commande?.branche || "Agency",
      status: "A acheter",
      qonto: false,
      commentaires: commande?.commentaires || "",
      produits: [
        {
          id: createTempId(),
          nomProduit: produit?.nomProduit || "",
          quantite: quantite > 0 ? quantite : 1,
          prixUnitaireHT:
            produit?.prixUnitaireHT === null || produit?.prixUnitaireHT === undefined
              ? ""
              : produit.prixUnitaireHT,
          referenceUrl: String(produit?.referenceUrl || "").trim(),
          projet: produit?.projet || "",
          categories: produit?.categories || "",
          lieux: produit?.lieux || "Studio",
          zoneStockage: produit?.zoneStockage || "",
          recu: false,
          inventaireCreated: false,
        },
      ],
    });
    setOpen(true);
  };

  const handleRecommanderProduit = (commande, produit) => {
    const referenceUrl = String(produit?.referenceUrl || "").trim();
    if (referenceUrl) {
      window.open(referenceUrl, "_blank", "noopener,noreferrer");
    }

    openRecommandeModal(commande, produit);
  };

  const updateStatusInline = async (row, nextStatus) => {
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));

    try {
      await patchCommande(row.id, { status: nextStatus });
    } catch (error) {
      console.error(error);
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: row.status } : item)));
      alert("Erreur sauvegarde status");
    }
  };

  const updateQontoInline = async (row, nextQonto) => {
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, qonto: nextQonto } : item)));

    try {
      await patchCommande(row.id, { qonto: nextQonto });
    } catch (error) {
      console.error(error);
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, qonto: row.qonto } : item)));
      alert("Erreur sauvegarde Qonto");
    }
  };

  const createInventaireFromProduit = async (commande, produit, typeStock, seuilMinimum) => {
    const payload = {
      dateCreation: commande.dateCreation,
      typeStock,
      produit: produit.nomProduit,
      branche: commande.branche || "Agency",
      projet: produit.projet || "",
      lieux: produit.lieux || "Studio",
      zoneStockage: produit.zoneStockage || "",
      categories: produit.categories || "",
      fournisseur: commande.fournisseur || "",
      referenceUrl: produit.referenceUrl || "",
      description: commande.commentaires || "",
      quantiteStock: toSafeNumber(produit.quantite, 0),
      seuilMinimum: typeStock === "Consommables" ? toSafeNumber(seuilMinimum, 0) : null,
      prixUnitaire: produit.prixUnitaireHT,
      commentaires: commande.commentaires || "",
    };

    const res = await fetch("/api/inventaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur creation inventaire"}${data?.details ? ` - ${data.details}` : ""}`);
    }

    return data.item;
  };

  const toggleProduitRecu = async (commande, produit, checked) => {
    if (!checked) {
      const nextProduits = commande.produits.map((line) =>
        line.id === produit.id ? { ...line, recu: false } : line
      );
      await persistProduits(commande.id, nextProduits);
      return;
    }

    if (produit.inventaireCreated) {
      const nextProduits = commande.produits.map((line) =>
        line.id === produit.id ? { ...line, recu: true } : line
      );
      await persistProduits(commande.id, nextProduits);
      return;
    }

    setPendingReception({ commandeId: commande.id, produitId: produit.id });
    setStockType("Consommables");
    setStockSeuilMin("");
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setPendingReception(null);
    setStockType("Consommables");
    setStockSeuilMin("");
  };

  const confirmStockModal = async () => {
    if (!pendingTarget) return;

    if (stockType === "Consommables" && stockSeuilMin === "") {
      alert("Renseigne un seuil minimum.");
      return;
    }

    try {
      const { commande, produit } = pendingTarget;
      await createInventaireFromProduit(commande, produit, stockType, stockSeuilMin);

      const nextProduits = commande.produits.map((line) =>
        line.id === produit.id
          ? { ...line, recu: true, inventaireCreated: true }
          : line
      );

      await persistProduits(commande.id, nextProduits);
      closeStockModal();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilters([{ field: "fournisseur", value: "" }]);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Commandes materiel</h1>

        <div className={styles.headerActions}>
          <button type="button" className={styles.primaryButton} onClick={openAddModal}>
            Ajouter commande
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <div className={styles.searchBlock}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher fournisseur, produit, projet..."
            />
          </div>

          <div className={styles.filtersBlock}>
            {filters.map((filter, index) => (
              <div key={`${filter.field}-${index}`} className={styles.filterRow}>
                <select
                  className={styles.filterSelect}
                  value={filter.field}
                  onChange={(e) => {
                    const nextField = e.target.value;
                    setFilters((prev) =>
                      prev.map((item, i) => (i === index ? { field: nextField, value: "" } : item))
                    );
                  }}
                >
                  {FILTER_FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.filterSelect}
                  value={filter.value}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setFilters((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, value: nextValue } : item))
                    );
                  }}
                >
                  <option value="">Tous</option>
                  {(optionsByField[filter.field] || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                {filters.length > 1 ? (
                  <button
                    type="button"
                    className={styles.removeFilterBtn}
                    onClick={() => setFilters((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Supprimer ce filtre"
                    title="Supprimer"
                  >
                    x
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.toolbarBottom}>
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.addFilterBtn}
              onClick={() => setFilters((prev) => [...prev, { field: "fournisseur", value: "" }])}
            >
              Ajouter filtre
            </button>
            <button type="button" className={styles.resetFilterBtn} onClick={resetFilters}>
              Reset filtres
            </button>
          </div>

          <div className={styles.resultsHint}>
            {filteredRows.length} resultat{filteredRows.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrap} role="region" aria-label="Table des commandes">
          <table className={styles.table}>
            <thead>
              <tr>
                {MAIN_COLUMNS.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={MAIN_COLUMNS.length}>
                    Aucune commande.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const expanded = !!expandedMap[row.id];

                  return (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td className={styles.centerCell}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            onClick={() => toggleExpanded(row.id)}
                            aria-label={expanded ? "Replier" : "Deplier"}
                            title={expanded ? "Replier" : "Deplier"}
                          >
                            {expanded ? "-" : "+"}
                          </button>
                        </td>

                        <td>{row.dateCreation || "-"}</td>
                        <td>{row.fournisseur || "-"}</td>
                        <td>{row.branche || "-"}</td>

                        <td>
                          <select
                            className={styles.inlineSelect}
                            value={row.status || "En attente"}
                            onChange={(e) => updateStatusInline(row, e.target.value)}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className={styles.centerCell}>
                          <input
                            type="checkbox"
                            checked={!!row.qonto}
                            onChange={(e) => updateQontoInline(row, e.target.checked)}
                            aria-label="Qonto"
                          />
                        </td>

                        <td>{row.totalProduits}</td>
                        <td>{formatMoney(row.prixTotalHT)}</td>
                        <td className={styles.wrapCell}>{row.commentaires || "-"}</td>

                        <td className={styles.centerCell}>
                          <div className={styles.actionButtons}>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => openEditModal(row)}
                              title="Modifier"
                              aria-label="Modifier"
                            >
                              ✏️
                            </button>

                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={async () => {
                                try {
                                  await deleteCommande(row.id);
                                } catch (error) {
                                  console.error(error);
                                  alert(error?.message || "Erreur suppression");
                                }
                              }}
                              title="Supprimer"
                              aria-label="Supprimer"
                            >
                              ✖
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expanded ? (
                        <tr className={styles.detailRow}>
                          <td colSpan={MAIN_COLUMNS.length}>
                            <div className={styles.detailWrap}>
                              <table className={styles.detailTable}>
                                <thead>
                                  <tr>
                                    <th>Produit</th>
                                    <th>Recu</th>
                                    <th>Projet</th>
                                    <th>Categorie</th>
                                    <th>Quantite</th>
                                    <th>Prix HT</th>
                                    <th>Total HT</th>
                                    <th>URL</th>
                                    <th>Lieu</th>
                                    <th>Zone</th>
                                    <th className={styles.centerCell}>Recommander</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.produits.length === 0 ? (
                                    <tr>
                                      <td colSpan={11} className={styles.emptyCellSmall}>
                                        Aucun produit sur cette commande.
                                      </td>
                                    </tr>
                                  ) : (
                                    row.produits.map((line) => (
                                      <tr key={`${row.id}-${line.id}`}>
                                        <td>
                                          <span className={styles.productName}>{line.nomProduit || "-"}</span>
                                        </td>
                                        <td className={styles.centerCell}>
                                          <input
                                            type="checkbox"
                                            checked={!!line.recu}
                                            onChange={async (e) => {
                                              try {
                                                await toggleProduitRecu(row, line, e.target.checked);
                                              } catch (error) {
                                                console.error(error);
                                                alert(error?.message || "Erreur mise a jour reception");
                                              }
                                            }}
                                            aria-label={`Reception ${line.nomProduit || "produit"}`}
                                          />
                                        </td>
                                        <td>{line.projet || "-"}</td>
                                        <td>{line.categories || "-"}</td>
                                        <td>{line.quantite}</td>
                                        <td>{formatMoney(line.prixUnitaireHT)}</td>
                                        <td>{formatMoney(line.prixTotalHT)}</td>
                                        <td className={styles.wrapCell}>{line.referenceUrl || "-"}</td>
                                        <td>{line.lieux || "-"}</td>
                                        <td>{line.zoneStockage || "-"}</td>
                                        <td className={styles.centerCell}>
                                          <button
                                            type="button"
                                            className={styles.recommendButton}
                                            onClick={() => handleRecommanderProduit(row, line)}
                                            title="Recommander"
                                            aria-label={`Recommander ${line.nomProduit || "produit"}`}
                                          >
                                            ↻
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title={editingId ? "Modifier une commande" : "Ajouter une commande"}
        onClose={closeModal}
      >
        <form className={styles.form} onSubmit={submitForm}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Date</label>
              <input
                className={styles.input}
                type="date"
                value={form.dateCreation}
                onChange={(e) => updateFormField("dateCreation", e.target.value)}
              />
            </div>

            <SelectWithAdd
              label="Fournisseur"
              value={form.fournisseur}
              onChange={(value) => updateFormField("fournisseur", value)}
              options={fournisseurOptions}
              required
              addLabel="Ajouter un fournisseur..."
              onAddOption={async (value) => {
                const name = String(value || "").trim();
                if (!name) return;

                try {
                  const res = await fetch("/api/fournisseurs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nom: name }),
                  });

                  const data = await res.json().catch(() => null);
                  if (!res.ok) throw new Error(data?.error || "Erreur creation fournisseur");

                  setFournisseurOptions((prev) => mergeUniqueSorted(prev, [name]));
                } catch (error) {
                  console.error(error);
                  alert(error?.message || "Erreur creation fournisseur");
                }
              }}
            />

            <div className={styles.field}>
              <label className={styles.label}>Branche</label>
              <select
                className={styles.input}
                value={form.branche}
                onChange={(e) => updateFormField("branche", e.target.value)}
              >
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Status commande</label>
              <select
                className={styles.input}
                value={form.status}
                onChange={(e) => updateFormField("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.qonto}
                  onChange={(e) => updateFormField("qonto", e.target.checked)}
                />
                <span>Deja enregistre dans Qonto</span>
              </label>
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Commentaires</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.commentaires}
                onChange={(e) => updateFormField("commentaires", e.target.value)}
                placeholder="Commentaires internes"
              />
            </div>
          </div>

          <div className={styles.linesBlock}>
            <div className={styles.linesHeader}>
              <div className={styles.linesTitle}>Produits de la commande</div>
              <button type="button" className={styles.addLineBtn} onClick={addProduitLine}>
                Ajouter produit
              </button>
            </div>

            <div className={styles.lineTableWrap}>
              <table className={styles.lineTable}>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantite</th>
                    <th>Prix HT</th>
                    <th>Total HT</th>
                    <th>URL</th>
                    <th>Projet</th>
                    <th>Categorie</th>
                    <th>Lieu</th>
                    <th>Zone</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {form.produits.map((line, index) => (
                    <tr key={line.id || index}>
                      <td>
                        <input
                          className={styles.lineInput}
                          type="text"
                          value={line.nomProduit}
                          onChange={(e) => updateProduitField(index, "nomProduit", e.target.value)}
                          placeholder="Nom produit"
                        />
                      </td>

                      <td>
                        <input
                          className={styles.lineInput}
                          type="number"
                          min="0"
                          step="1"
                          value={line.quantite}
                          onChange={(e) =>
                            updateProduitField(
                              index,
                              "quantite",
                              e.target.value === "" ? "" : Number(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          className={styles.lineInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.prixUnitaireHT ?? ""}
                          onChange={(e) =>
                            updateProduitField(
                              index,
                              "prixUnitaireHT",
                              e.target.value === "" ? "" : Number(e.target.value)
                            )
                          }
                          placeholder="0.00"
                        />
                      </td>

                      <td>
                        <input
                          className={styles.lineTotal}
                          type="text"
                          value={formatMoney(computeLineTotal(line.quantite, line.prixUnitaireHT))}
                          readOnly
                        />
                      </td>

                      <td>
                        <input
                          className={styles.lineInput}
                          type="url"
                          value={line.referenceUrl}
                          onChange={(e) => updateProduitField(index, "referenceUrl", e.target.value)}
                          placeholder="https://"
                        />
                      </td>

                      <td>
                        <select
                          className={styles.lineSelect}
                          value={line.projet}
                          onChange={(e) => updateProduitField(index, "projet", e.target.value)}
                        >
                          <option value="">Aucun projet</option>
                          {projetOptions.map((projet) => (
                            <option key={projet} value={projet}>
                              {projet}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          className={styles.lineInput}
                          list="commandes-categories"
                          type="text"
                          value={line.categories}
                          onChange={(e) => updateProduitField(index, "categories", e.target.value)}
                          placeholder="Categorie"
                        />
                      </td>

                      <td>
                        <select
                          className={styles.lineSelect}
                          value={line.lieux}
                          onChange={(e) => updateProduitField(index, "lieux", e.target.value)}
                        >
                          {LIEUX_OPTIONS.map((lieu) => (
                            <option key={lieu} value={lieu}>
                              {lieu}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          className={styles.lineInput}
                          type="text"
                          value={line.zoneStockage}
                          onChange={(e) => updateProduitField(index, "zoneStockage", e.target.value)}
                          placeholder="Zone"
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className={styles.lineDeleteBtn}
                          onClick={() => removeProduitLine(index)}
                          disabled={form.produits.length <= 1}
                        >
                          Suppr
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <datalist id="commandes-categories">
              {categorieOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <div className={styles.totalBar}>Total commande HT: {formatMoney(formTotal)} EUR</div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn}>
              {editingId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={stockModalOpen} title="Ajouter en inventaire" onClose={closeStockModal}>
        <div className={styles.form}>
          {pendingTarget ? (
            <div className={styles.pendingLine}>
              Produit: <strong>{pendingTarget.produit.nomProduit || "Produit"}</strong> - Fournisseur:{" "}
              <strong>{pendingTarget.commande.fournisseur || "-"}</strong>
            </div>
          ) : null}

          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Type stock</label>
              <select
                className={styles.input}
                value={stockType}
                onChange={(e) => setStockType(e.target.value)}
              >
                <option value="Consommables">Consommables</option>
                <option value="Fixe">Fixe</option>
              </select>
            </div>

            {stockType === "Consommables" ? (
              <div className={styles.field}>
                <label className={styles.label}>Seuil minimum</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  value={stockSeuilMin}
                  onChange={(e) => setStockSeuilMin(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={closeStockModal}>
              Annuler
            </button>
            <button type="button" className={styles.submitBtn} onClick={confirmStockModal}>
              Valider
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
