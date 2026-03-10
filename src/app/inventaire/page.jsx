"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Inventaire.module.css";
import Modal from "../../components/ui/Modal";
import SelectWithAdd from "../../components/ui/SelectWithAdd";

const RECOMMANDER_PREFILL_STORAGE_KEY = "commandes:recommande-prefill";
const LIEUX_ORDER = ["Fablab", "Atelier", "Studio", "Maison"];

const TABLE_COLUMNS = [
  "Date Creation",
  "Produit",
  "Type",
  "Quantite en Stock",
  "Seuil Minimum",
  "Projet",
  "Zone de Stockage",
  "Categories",
  "Fournisseur",
  "Actions",
];

const FILTER_FIELDS = [
  { value: "projet", label: "Projet" },
  { value: "lieux", label: "Lieux" },
  { value: "zoneStockage", label: "Zone de Stockage" },
  { value: "categories", label: "Categories" },
  { value: "fournisseur", label: "Fournisseur" },
  { value: "typeStock", label: "Type" },
];

function toYMD(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toSafeNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTypeLabel(typeStock) {
  const value = String(typeStock || "").toLowerCase();
  if (value.includes("fixe")) return "Fixe";
  if (value.includes("conso")) return "Conso.";
  return "-";
}

function normalizeRow(item = {}) {
  return {
    ...item,
    id: String(item._id || item.id || ""),
  };
}

function defaultForm(defaultCreated) {
  return {
    dateCreation: defaultCreated,
    typeStock: "Consommables",
    produit: "",
    branche: "Agency",
    projet: "",
    lieux: "Studio",
    zoneStockage: "",
    categories: "",
    fournisseur: "",
    referenceUrl: "",
    description: "",
    quantiteStock: 0,
    seuilMinimum: 0,
    prixUnitaire: "",
    commentaires: "",
  };
}

export default function InventairePage() {
  const defaultCreated = useMemo(() => toYMD(new Date()), []);

  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => defaultForm(defaultCreated));

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState([{ field: "projet", value: "" }]);
  const [inlineDrafts, setInlineDrafts] = useState({});

  const [projetOptions, setProjetOptions] = useState([]);
  const [categorieOptions, setCategorieOptions] = useState([]);
  const [fournisseurOptions, setFournisseurOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [resInventaire, resFournisseurs, resContrats] = await Promise.all([
          fetch("/api/inventaire", { cache: "no-store" }),
          fetch("/api/fournisseurs", { cache: "no-store" }),
          fetch("/api/contrats", { cache: "no-store" }),
        ]);

        const [dataInventaire, dataFournisseurs, dataContrats] = await Promise.all([
          resInventaire.json().catch(() => ({})),
          resFournisseurs.json().catch(() => ({})),
          resContrats.json().catch(() => ({})),
        ]);

        if (!resInventaire.ok) {
          throw new Error(dataInventaire?.error || "Erreur chargement inventaire");
        }
        if (cancelled) return;

        const mapped = (dataInventaire.items || []).map((item) => normalizeRow(item));
        setRows(mapped);

        const categoriesFromRows = mapped.map((item) => String(item.categories || "").trim()).filter(Boolean);
        const fournisseursFromRows = mapped.map((item) => String(item.fournisseur || "").trim()).filter(Boolean);

        const fournisseursFromApi = (dataFournisseurs.items || [])
          .map((item) => String(item.nom || "").trim())
          .filter(Boolean);
        const projetsFromApi = (dataContrats.items || [])
          .map((item) => String(item.nomContrat || "").trim())
          .filter(Boolean);

        setCategorieOptions(Array.from(new Set(categoriesFromRows)).sort((a, b) => a.localeCompare(b, "fr")));
        setFournisseurOptions(
          Array.from(new Set([...fournisseursFromRows, ...fournisseursFromApi])).sort((a, b) => a.localeCompare(b, "fr")),
        );
        setProjetOptions(Array.from(new Set(projetsFromApi)).sort((a, b) => a.localeCompare(b, "fr")));
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const optionsByField = useMemo(() => {
    const map = Object.fromEntries(FILTER_FIELDS.map((item) => [item.value, new Set()]));
    for (const row of rows) {
      for (const field of FILTER_FIELDS) {
        const value =
          field.value === "typeStock"
            ? toTypeLabel(row?.typeStock)
            : String(row?.[field.value] || "").trim();
        if (value) map[field.value].add(value);
      }
    }
    return Object.fromEntries(
      Object.entries(map).map(([field, set]) => [field, Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))]),
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const searchBase = [
        row.produit,
        row.fournisseur,
        row.projet,
        row.categories,
        row.zoneStockage,
        row.lieux,
        row.typeStock,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchBase.includes(query);
      if (!matchesSearch) return false;

      return filters.every((filter) => {
        if (!filter.value) return true;
        if (filter.field === "typeStock") {
          return toTypeLabel(row?.typeStock) === filter.value;
        }
        return String(row?.[filter.field] || "") === filter.value;
      });
    });
  }, [rows, searchQuery, filters]);

  const groupedRows = useMemo(() => {
    const map = new Map();
    for (const row of filteredRows) {
      const lieu = String(row.lieux || "").trim() || "Sans lieu";
      if (!map.has(lieu)) map.set(lieu, []);
      map.get(lieu).push(row);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      const indexA = LIEUX_ORDER.indexOf(a);
      const indexB = LIEUX_ORDER.indexOf(b);
      const rankA = indexA === -1 ? 999 : indexA;
      const rankB = indexB === -1 ? 999 : indexB;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b, "fr");
    });

    return keys.map((lieu) => ({ lieu, items: map.get(lieu) || [] }));
  }, [filteredRows]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(defaultForm(defaultCreated));
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilters([{ field: "projet", value: "" }]);
  };

  const openAddModal = () => {
    setEditingId(null);
    resetForm();
    setOpen(true);
  };

  const openEditModal = (row) => {
    setEditingId(row.id);
    setForm({
      dateCreation: row.dateCreation || defaultCreated,
      typeStock: row.typeStock || "Consommables",
      produit: row.produit || "",
      branche: row.branche || "Agency",
      projet: row.projet || "",
      lieux: row.lieux || "Studio",
      zoneStockage: row.zoneStockage || "",
      categories: row.categories || "",
      fournisseur: row.fournisseur || "",
      referenceUrl: row.referenceUrl || "",
      description: row.description || "",
      quantiteStock: row.quantiteStock ?? 0,
      seuilMinimum: row.seuilMinimum ?? 0,
      prixUnitaire: row.prixUnitaire ?? "",
      commentaires: row.commentaires || "",
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingId(null);
  };

  const patchInventaire = async (id, changes) => {
    const res = await fetch(`/api/inventaire/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur update inventaire"}${data?.details ? ` - ${data.details}` : ""}`);
    }
    return normalizeRow(data.item);
  };

  const deleteInventaire = async (id) => {
    const ok = window.confirm("Supprimer cette ligne d'inventaire ? Cette action est irreversible.");
    if (!ok) return;

    const res = await fetch(`/api/inventaire/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur suppression"}${data?.details ? ` - ${data.details}` : ""}`);
    }

    setRows((prev) => prev.filter((row) => row.id !== String(id)));
    setInlineDrafts((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  };

  const submitForm = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        const updated = await patchInventaire(editingId, form);
        setRows((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
      } else {
        const res = await fetch("/api/inventaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(`${data?.error || "Erreur ajout inventaire"}${data?.details ? ` - ${data.details}` : ""}`);
        }

        const saved = normalizeRow(data.item);
        setRows((prev) => [saved, ...prev]);
      }

      const pushOpt = (setter, value) => {
        const clean = String(value || "").trim();
        if (!clean) return;
        setter((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
      };
      pushOpt(setCategorieOptions, form.categories);
      pushOpt(setFournisseurOptions, form.fournisseur);
      pushOpt(setProjetOptions, form.projet);

      closeModal();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur sauvegarde");
    }
  };

  const setInlineDraft = (rowId, key, value) => {
    const id = String(rowId);
    setInlineDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value },
    }));
  };

  const clearInlineDraft = (rowId, key) => {
    const id = String(rowId);
    setInlineDrafts((prev) => {
      const current = prev[id];
      if (!current || !(key in current)) return prev;
      const nextRow = { ...current };
      delete nextRow[key];
      const next = { ...prev };
      if (Object.keys(nextRow).length === 0) {
        delete next[id];
      } else {
        next[id] = nextRow;
      }
      return next;
    });
  };

  const commitInlineNumber = async (row, key) => {
    const rowId = String(row.id);
    const draft = inlineDrafts[rowId]?.[key];
    if (draft === undefined) return;

    const trimmed = String(draft).trim();
    const previousValue = row?.[key] ?? null;
    let nextValue = null;

    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        clearInlineDraft(rowId, key);
        alert("Valeur numerique invalide.");
        return;
      }
      nextValue = Math.max(0, Math.round(parsed));
    }

    clearInlineDraft(rowId, key);
    if ((previousValue ?? null) === nextValue) return;

    setRows((prev) => prev.map((item) => (item.id === rowId ? { ...item, [key]: nextValue } : item)));

    try {
      const updated = await patchInventaire(rowId, { [key]: nextValue });
      setRows((prev) => prev.map((item) => (item.id === rowId ? updated : item)));
    } catch (error) {
      console.error(error);
      setRows((prev) => prev.map((item) => (item.id === rowId ? { ...item, [key]: previousValue } : item)));
      alert(error?.message || "Erreur sauvegarde");
    }
  };

  const recommanderFromInventaire = (row) => {
    if (typeof window === "undefined") return;

    const quantite = toSafeNumber(row?.quantiteStock, 1);
    const payload = {
      commande: {
        fournisseur: String(row?.fournisseur || "").trim(),
        branche: String(row?.branche || "Agency").trim() || "Agency",
        commentaires: String(row?.commentaires || "").trim(),
      },
      produit: {
        nomProduit: String(row?.produit || "").trim(),
        quantite: quantite && quantite > 0 ? quantite : 1,
        prixUnitaireHT: row?.prixUnitaire ?? "",
        referenceUrl: String(row?.referenceUrl || "").trim(),
        projet: String(row?.projet || "").trim(),
        categories: String(row?.categories || "").trim(),
        lieux: String(row?.lieux || "Studio").trim() || "Studio",
        zoneStockage: String(row?.zoneStockage || "").trim(),
      },
    };

    try {
      window.sessionStorage.setItem(RECOMMANDER_PREFILL_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Impossible de preparer le pre-remplissage recommander:", error);
    }

    window.location.assign("/commandes");
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Inventaire</h1>
        <button type="button" className={styles.primaryButton} onClick={openAddModal}>
          Ajouter Inventaire
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <div className={styles.searchBlock}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par produit, fournisseur, projet, categorie..."
            />
          </div>

          <div className={styles.filtersBlock}>
            {filters.map((filter, index) => (
              <div key={index} className={styles.filterRow}>
                <select
                  className={styles.filterSelect}
                  value={filter.field}
                  onChange={(e) => {
                    const nextField = e.target.value;
                    setFilters((prev) => prev.map((item, i) => (i === index ? { field: nextField, value: "" } : item)));
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
                    setFilters((prev) => prev.map((item, i) => (i === index ? { ...item, value: nextValue } : item)));
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
                    title="Supprimer ce filtre"
                    aria-label="Supprimer ce filtre"
                  >
                    X
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
              onClick={() => setFilters((prev) => [...prev, { field: "projet", value: "" }])}
            >
              Ajouter filtres
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

      {groupedRows.length === 0 ? (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.emptyCell} colSpan={TABLE_COLUMNS.length}>
                    Aucun resultat.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        groupedRows.map((group) => (
          <section key={group.lieu} className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Stock {group.lieu}</h2>

            <div className={styles.tableCard}>
              <div className={styles.tableWrap} role="region" aria-label={`Table inventaire ${group.lieu}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {group.items.map((row) => {
                      const quantityDraft = inlineDrafts[row.id]?.quantiteStock;
                      const thresholdDraft = inlineDrafts[row.id]?.seuilMinimum;
                      return (
                        <tr key={row.id}>
                          <td>{row.dateCreation || "-"}</td>
                          <td>
                            <span className={styles.productName}>{row.produit || "-"}</span>
                          </td>
                          <td>{toTypeLabel(row.typeStock)}</td>

                          <td>
                            <input
                              className={styles.inlineNumberInput}
                              type="number"
                              min="0"
                              step="1"
                              value={quantityDraft ?? (row.quantiteStock ?? "")}
                              onChange={(e) => setInlineDraft(row.id, "quantiteStock", e.target.value)}
                              onBlur={() => commitInlineNumber(row, "quantiteStock")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                            />
                          </td>

                          <td>
                            <input
                              className={styles.inlineNumberInput}
                              type="number"
                              min="0"
                              step="1"
                              value={thresholdDraft ?? (row.seuilMinimum ?? "")}
                              onChange={(e) => setInlineDraft(row.id, "seuilMinimum", e.target.value)}
                              onBlur={() => commitInlineNumber(row, "seuilMinimum")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                            />
                          </td>

                          <td>{row.projet || "-"}</td>
                          <td>{row.zoneStockage || "-"}</td>
                          <td>{row.categories || "-"}</td>
                          <td>{row.fournisseur || "-"}</td>

                          <td className={styles.centerCell}>
                            <div className={styles.actionButtons}>
                              <button
                                type="button"
                                className={styles.recommendButton}
                                onClick={() => recommanderFromInventaire(row)}
                                title="Recommander"
                                aria-label={`Recommander ${row.produit || "produit"}`}
                              >
                                ↻
                              </button>

                              <button
                                type="button"
                                className={styles.iconButton}
                                onClick={() => openEditModal(row)}
                                title="Modifier"
                                aria-label="Modifier"
                              >
                                ✏
                              </button>

                              <button
                                type="button"
                                className={styles.deleteButton}
                                onClick={async () => {
                                  try {
                                    await deleteInventaire(row.id);
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}

      <Modal open={open} title={editingId ? "Modifier inventaire" : "Ajouter inventaire"} onClose={closeModal}>
        <form className={styles.form} onSubmit={submitForm}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Date de creation</label>
              <input
                className={styles.input}
                type="date"
                value={form.dateCreation}
                onChange={(e) => update("dateCreation", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select className={styles.input} value={form.typeStock} onChange={(e) => update("typeStock", e.target.value)}>
                <option value="Consommables">Conso.</option>
                <option value="Fixe">Fixe</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Produit</label>
              <input className={styles.input} type="text" value={form.produit} onChange={(e) => update("produit", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Branche</label>
              <select className={styles.input} value={form.branche} onChange={(e) => update("branche", e.target.value)}>
                <option value="Agency">Agency</option>
                <option value="CreativeGen">CreativeGen</option>
                <option value="Enterntainement">Enterntainement</option>
                <option value="SFX">SFX</option>
              </select>
            </div>

            <SelectWithAdd
              label="Projet"
              value={form.projet}
              onChange={(value) => update("projet", value)}
              options={projetOptions}
              placeholder="Selectionner un contrat..."
              allowAdd={false}
            />

            <div className={styles.field}>
              <label className={styles.label}>Lieux</label>
              <select className={styles.input} value={form.lieux} onChange={(e) => update("lieux", e.target.value)}>
                <option value="Studio">Studio</option>
                <option value="Atelier">Atelier</option>
                <option value="Fablab">Fablab</option>
                <option value="Maison">Maison</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Zone de Stockage</label>
              <input
                className={styles.input}
                type="text"
                value={form.zoneStockage}
                onChange={(e) => update("zoneStockage", e.target.value)}
              />
            </div>

            <SelectWithAdd
              label="Categories"
              value={form.categories}
              onChange={(value) => update("categories", value)}
              options={categorieOptions}
              addLabel="Ajouter une categorie..."
              onAddOption={(value) => {
                setCategorieOptions((prev) => (prev.includes(value) ? prev : [...prev, value]));
              }}
            />

            <SelectWithAdd
              label="Fournisseur"
              value={form.fournisseur}
              onChange={(value) => update("fournisseur", value)}
              options={fournisseurOptions}
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

                  setFournisseurOptions((prev) => (prev.includes(name) ? prev : [...prev, name]));
                } catch (error) {
                  console.error(error);
                  alert(error?.message || "Erreur creation fournisseur");
                }
              }}
            />

            <div className={styles.field}>
              <label className={styles.label}>Reference (URL)</label>
              <input
                className={styles.input}
                type="url"
                value={form.referenceUrl}
                onChange={(e) => update("referenceUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Quantite en Stock</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="1"
                value={form.quantiteStock}
                onChange={(e) => update("quantiteStock", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Seuil Minimum</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="1"
                value={form.seuilMinimum}
                onChange={(e) => update("seuilMinimum", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Prix unitaire</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.prixUnitaire}
                onChange={(e) => update("prixUnitaire", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Commentaires</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.commentaires}
                onChange={(e) => update("commentaires", e.target.value)}
              />
            </div>
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
    </div>
  );
}
