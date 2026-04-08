"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Fournisseurs.module.css";
import Modal from "../../../components/ui/Modal";

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toFixed(2);
}

function toSafeNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function computeLineTotal(quantite, prixUnitaireHT) {
  const q = Number(quantite);
  const pu = Number(prixUnitaireHT);
  if (!Number.isFinite(q) || !Number.isFinite(pu)) return 0;
  return Math.round(q * pu * 100) / 100;
}

const RECOMMANDER_PREFILL_STORAGE_KEY = "commandes:recommande-prefill";

export default function FournisseurPage() {
  const [items, setItems] = useState([]);

  // Modal "Ajout"
  const [addOpen, setAddOpen] = useState(false);

  // Modal "Détails fournisseur"
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("infos"); // "infos" | "historique"
  const [selected, setSelected] = useState(null); // fournisseur sélectionné
  const [historique, setHistorique] = useState([]);
  const [expandedHist, setExpandedHist] = useState({});
  const [loadingHist, setLoadingHist] = useState(false);
  const [histFilterYear, setHistFilterYear] = useState("all");
  const [histFilterMonth, setHistFilterMonth] = useState("all");

  const [search, setSearch] = useState("");


  // Edition dans le modal détail
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    nom: "",
    password: "",
    websiteUrl: "",
    siret: "",
    adresse: "",
    ville: "",
    moyenLivraison: "",
    informations: "",
    referentNom: "",
    referentEmail: "",
    referentTelephone: "",
  });

  const canSubmit = useMemo(() => String(form.nom).trim().length > 0, [form.nom]);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const resetForm = () => {
    setForm({
      nom: "",
      password: "",
      websiteUrl: "",
      siret: "",
      adresse: "",
      ville: "",
      moyenLivraison: "",
      informations: "",
      referentNom: "",
      referentEmail: "",
      referentTelephone: "",
    });
  };

  const hydrateFormFrom = (f) => {
    setForm({
      nom: f?.nom || "",
      password: f?.password || "",
      websiteUrl: f?.websiteUrl || "",
      siret: f?.siret || "",
      adresse: f?.adresse || "",
      ville: f?.ville || "",
      moyenLivraison: f?.moyenLivraison || "",
      informations: f?.informations || "",
      referentNom: f?.referentNom || "",
      referentEmail: f?.referentEmail || "",
      referentTelephone: f?.referentTelephone || "",
    });
  };

  // Load fournisseurs
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/fournisseurs", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(`${data?.error || "Erreur chargement fournisseurs"} — ${data?.details || ""}`);

        if (!cancelled) {
          const mapped = (data.items || []).map((d) => ({ ...d, id: String(d._id) }));
          setItems(mapped);
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Create fournisseur (depuis carte +)
  const openAddModal = () => {
    resetForm();
    setAddOpen(true);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      alert("Le nom du fournisseur est obligatoire.");
      return;
    }

    const res = await fetch("/api/fournisseurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur ajout fournisseur"}${data?.details ? " — " + data.details : ""}`);
      return;
    }

    const saved = { ...data.item, id: String(data.item._id) };
    setItems((prev) => [saved, ...prev]);
    setAddOpen(false);
  };

  // Open detail modal
  const openDetail = async (f) => {
    setSelected(f);
    setActiveTab("infos");
    setIsEditing(false);
    hydrateFormFrom(f);

    setDetailOpen(true);

    // charge historique en background (au moins une fois)
    setLoadingHist(true);
    try {
      const res = await fetch(`/api/commandes?fournisseur=${encodeURIComponent(String(f.nom || ""))}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur chargement historique");

      const mapped = (data.items || []).map((c) => ({
        ...c,
        id: String(c._id),
      }));

      setHistorique(mapped);
      setExpandedHist({});
      setHistFilterYear("all");
      setHistFilterMonth("all");
    } catch (e) {
      console.error(e);
      setHistorique([]);
      setExpandedHist({});
    } finally {
      setLoadingHist(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelected(null);
    setHistorique([]);
    setExpandedHist({});
    setIsEditing(false);
    setActiveTab("infos");
    setHistFilterYear("all");
    setHistFilterMonth("all");
  };

  // Save edit (dans modal détail)
  const saveEdit = async () => {
    if (!selected?.id) return;
    if (!canSubmit) {
      alert("Le nom du fournisseur est obligatoire.");
      return;
    }

    const res = await fetch(`/api/fournisseurs/${encodeURIComponent(String(selected.id))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur modification"}${data?.details ? " — " + data.details : ""}`);
      return;
    }

    const updated = { ...data.item, id: String(data.item._id) };
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setSelected(updated);
    setIsEditing(false);

    // si le nom change, l'historique via fournisseur=nom peut changer => recharge
    setLoadingHist(true);
    try {
      const resH = await fetch(`/api/commandes?fournisseur=${encodeURIComponent(String(updated.nom || ""))}`, {
        cache: "no-store",
      });
      const dataH = await resH.json();
      if (resH.ok) {
        setHistorique((dataH.items || []).map((c) => ({ ...c, id: String(c._id) })));
        setExpandedHist({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHist(false);
    }
  };

  // Delete fournisseur (dans modal détail)
  const deleteFournisseur = async () => {
    if (!selected?.id) return;

    const ok = window.confirm("Supprimer ce fournisseur ? Cette action est irréversible.");
    if (!ok) return;

    const safeId = String(selected.id);
    const res = await fetch(`/api/fournisseurs/${encodeURIComponent(safeId)}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur suppression"}${data?.details ? " — " + data.details : ""}`);
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== safeId));
    closeDetail();
  };

  // Historique format
  const histRows = useMemo(() => {
    return (historique || []).map((commande, cmdIndex) => {
      const fallbackProduits = commande?.produit
        ? [
            {
              id: `legacy-${cmdIndex}-0`,
              nomProduit: commande.produit,
              quantite: commande.quantite,
              prixUnitaireHT: commande.prixUnitaireHT,
              prixTotalHT: commande.prixTotalHT,
              referenceUrl: commande.referenceUrl,
              projet: commande.projet,
              categories: commande.categories,
              lieux: commande.lieux,
              zoneStockage: commande.zoneStockage,
            },
          ]
        : [];

      const sourceProduits =
        Array.isArray(commande?.produits) && commande.produits.length > 0
          ? commande.produits
          : fallbackProduits;

      const produits = sourceProduits
        .map((line, lineIndex) => {
          const quantite = toSafeNumber(line?.quantite, 0);
          const computedTotal = computeLineTotal(quantite, line?.prixUnitaireHT);
          const prixTotalHT =
            line?.prixTotalHT === "" || line?.prixTotalHT === null || line?.prixTotalHT === undefined
              ? computedTotal
              : toSafeNumber(line.prixTotalHT, computedTotal);

          return {
            id: String(line?.id || line?._id || `line-${cmdIndex}-${lineIndex}`),
            nomProduit: String(line?.nomProduit || line?.produit || "").trim() || "—",
            quantite,
            prixUnitaireHT:
              line?.prixUnitaireHT === "" || line?.prixUnitaireHT === null || line?.prixUnitaireHT === undefined
                ? ""
                : toSafeNumber(line.prixUnitaireHT, ""),
            prixTotalHT,
            referenceUrl: String(line?.referenceUrl || "").trim(),
            projet: String(line?.projet || "").trim(),
            categories: String(line?.categories || "").trim(),
            lieux: String(line?.lieux || "Studio").trim() || "Studio",
            zoneStockage: String(line?.zoneStockage || "").trim(),
          };
        })
        .filter((line) => line.nomProduit !== "—" || line.quantite > 0 || line.prixTotalHT > 0 || line.referenceUrl);

      const totalProduits = produits.length;
      const computedCommandeTotal = produits.reduce((sum, line) => sum + toSafeNumber(line.prixTotalHT, 0), 0);
      const totalHT =
        commande?.prixTotalHT === "" || commande?.prixTotalHT === null || commande?.prixTotalHT === undefined
          ? computedCommandeTotal
          : toSafeNumber(commande.prixTotalHT, computedCommandeTotal);

      return {
        id: String(commande.id || commande._id || `commande-${cmdIndex}`),
        date: String(commande?.dateCreation || "").trim() || "—",
        totalProduits,
        totalHT,
        fournisseur: String(commande?.fournisseur || selected?.nom || "").trim(),
        branche: String(commande?.branche || "Agency").trim() || "Agency",
        commentaires: String(commande?.commentaires || "").trim(),
        produits,
      };
    });
  }, [historique, selected?.nom]);

  // Années disponibles dans l'historique
  const availableYears = useMemo(() => {
    const years = new Set();
    for (const h of histRows) {
      const y = h.date?.slice(0, 4);
      if (y && /^\d{4}$/.test(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [histRows]);

  // Lignes filtrées par période
  const filteredHistRows = useMemo(() => {
    return histRows.filter((h) => {
      if (histFilterYear === "all") return true;
      if (!h.date || h.date === "—") return false;
      const rowYear = h.date.slice(0, 4);
      if (rowYear !== histFilterYear) return false;
      if (histFilterMonth === "all") return true;
      const rowMonth = String(Number(h.date.slice(5, 7)));
      return rowMonth === histFilterMonth;
    });
  }, [histRows, histFilterYear, histFilterMonth]);

  // Total de la période filtrée
  const periodTotal = useMemo(
    () => filteredHistRows.reduce((sum, h) => sum + h.totalHT, 0),
    [filteredHistRows]
  );

  const MONTHS_FR = [
    "Janvier","Février","Mars","Avril","Mai","Juin",
    "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
  ];

  const toggleHistRow = (commandeId) => {
    setExpandedHist((prev) => ({ ...prev, [commandeId]: !prev[commandeId] }));
  };

  const recommanderProduit = (commande, produit) => {
    if (typeof window === "undefined") return;

    const payload = {
      commande: {
        fournisseur: String(commande?.fournisseur || selected?.nom || "").trim(),
        branche: String(commande?.branche || "Agency").trim() || "Agency",
        commentaires: String(commande?.commentaires || "").trim(),
      },
      produit: {
        nomProduit: String(produit?.nomProduit || "").trim(),
        quantite: toSafeNumber(produit?.quantite, 1),
        prixUnitaireHT: produit?.prixUnitaireHT ?? "",
        referenceUrl: String(produit?.referenceUrl || "").trim(),
        projet: String(produit?.projet || "").trim(),
        categories: String(produit?.categories || "").trim(),
        lieux: String(produit?.lieux || "Studio").trim() || "Studio",
        zoneStockage: String(produit?.zoneStockage || "").trim(),
      },
    };

    try {
      window.sessionStorage.setItem(RECOMMANDER_PREFILL_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Impossible de preparer le pre-remplissage recommander:", error);
    }

    window.location.assign("/commandes");
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((f) => {
      const nom = (f?.nom || "").toString().toLowerCase();
      const contact = (f?.referentNom || "").toString().toLowerCase();
      const email = (f?.referentEmail || "").toString().toLowerCase();
      const tel = (f?.referentTelephone || "").toString().toLowerCase();
      const siret = (f?.siret || "").toString().toLowerCase();
      return nom.includes(q) || contact.includes(q) || email.includes(q) || tel.includes(q) || siret.includes(q);
    });
  }, [items, search]);


  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Fournisseur</h1>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, contact ou email…"
        />
      </div>


      <div className={styles.grid}>
        {/* Carte Ajouter */}
        <button type="button" className={styles.addCard} onClick={openAddModal}>
          <div className={styles.plus}>+</div>
          <div className={styles.addLabel}>Ajouter un fournisseur</div>
        </button>

        {/* Cartes fournisseurs */}
        {filteredItems.map((f) => (
          <button
            key={f.id}
            type="button"
            className={styles.cardButton}
            onClick={() => openDetail(f)}
            title="Ouvrir le fournisseur"
          >
            <div className={styles.card}>
              <div className={styles.cardTitle}>{f.nom || "Sans nom"}</div>

              <div className={styles.row}>
                <div className={styles.k}>Password</div>
                <div className={styles.v}>{f.password || "—"}</div>
              </div>

              <div className={styles.row}>
                <div className={styles.k}>Site</div>
                <div className={styles.v}>
                  {f.websiteUrl ? (
                    <span className={styles.linkLike}>{f.websiteUrl}</span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.k}>SIRET</div>
                <div className={styles.v}>{f.siret || "—"}</div>
              </div>

              <div className={styles.row}>
                <div className={styles.k}>Adresse</div>
                <div className={styles.vMultiline}>{f.adresse || "—"}</div>
              </div>

              <div className={styles.row}>
                <div className={styles.k}>Ville</div>
                <div className={styles.v}>{f.ville || "—"}</div>
              </div>

              <div className={styles.row}>
                <div className={styles.k}>Livraison</div>
                <div className={styles.v}>{f.moyenLivraison || "—"}</div>
              </div>

              <div className={styles.row}>
                <div className={styles.k}>Informations</div>
                <div className={styles.vMultiline}>{f.informations || "—"}</div>
              </div>

              <div className={styles.refBlock}>
                <div className={styles.refName}>{f.referentNom || "—"}</div>
                <div className={styles.refEmail}>{f.referentEmail || "—"}</div>
                <div className={styles.refEmail}>{f.referentTelephone || "—"}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal Ajout */}
      <Modal open={addOpen} title="Ajouter un fournisseur" onClose={() => setAddOpen(false)}>
        <form className={styles.form} onSubmit={submitAdd}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nom du fournisseur *</label>
              <input className={styles.input} type="text" value={form.nom} onChange={(e) => update("nom", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <input className={styles.input} type="text" value={form.password} onChange={(e) => update("password", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Numéro de SIRET</label>
              <input className={styles.input} type="text" value={form.siret} onChange={(e) => update("siret", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Ville</label>
              <input className={styles.input} type="text" value={form.ville} onChange={(e) => update("ville", e.target.value)} />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Adresse</label>
              <input className={styles.input} type="text" value={form.adresse} onChange={(e) => update("adresse", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Moyen de livraison</label>
              <input className={styles.input} type="text" value={form.moyenLivraison} onChange={(e) => update("moyenLivraison", e.target.value)} />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>URL du site</label>
              <input className={styles.input} type="url" value={form.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://…" />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Informations</label>
              <textarea className={styles.textarea} rows={4} value={form.informations} onChange={(e) => update("informations", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nom du référent</label>
              <input className={styles.input} type="text" value={form.referentNom} onChange={(e) => update("referentNom", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Email du référent</label>
              <input className={styles.input} type="email" value={form.referentEmail} onChange={(e) => update("referentEmail", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Téléphone du référent</label>
              <input className={styles.input} type="text" value={form.referentTelephone} onChange={(e) => update("referentTelephone", e.target.value)} />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setAddOpen(false)}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
              Ajouter
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Détail fournisseur */}
      <Modal
        open={detailOpen}
        title={selected?.nom ? selected.nom : "Fournisseur"}
        onClose={closeDetail}
      >
        {selected ? (
          <div className={styles.detailWrap}>
            {/* Tabs + actions */}
            <div className={styles.detailTop}>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={activeTab === "infos" ? styles.tabActive : styles.tab}
                  onClick={() => setActiveTab("infos")}
                >
                  Informations
                </button>

                <button
                  type="button"
                  className={activeTab === "historique" ? styles.tabActive : styles.tab}
                  onClick={() => setActiveTab("historique")}
                >
                  Historique d&apos;achats
                </button>
              </div>

              {activeTab === "infos" ? (
                <div className={styles.detailActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setIsEditing((v) => !v)}
                    title="Modifier"
                    aria-label="Modifier"
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={deleteFournisseur}
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    ✖
                  </button>
                </div>
              ) : null}

            </div>

            {activeTab === "infos" ? (
              <div className={styles.infoSection}>
                {isEditing ? (
                  <>
                    <div className={styles.formGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Nom *</label>
                        <input className={styles.input} value={form.nom} onChange={(e) => update("nom", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Password</label>
                        <input className={styles.input} value={form.password} onChange={(e) => update("password", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Numéro de SIRET</label>
                        <input className={styles.input} value={form.siret} onChange={(e) => update("siret", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Ville</label>
                        <input className={styles.input} value={form.ville} onChange={(e) => update("ville", e.target.value)} />
                      </div>

                      <div className={styles.fieldWide}>
                        <label className={styles.label}>Adresse</label>
                        <input className={styles.input} value={form.adresse} onChange={(e) => update("adresse", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Moyen de livraison</label>
                        <input className={styles.input} value={form.moyenLivraison} onChange={(e) => update("moyenLivraison", e.target.value)} />
                      </div>

                      <div className={styles.fieldWide}>
                        <label className={styles.label}>URL du site</label>
                        <input className={styles.input} value={form.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} />
                      </div>

                      <div className={styles.fieldWide}>
                        <label className={styles.label}>Informations</label>
                        <textarea className={styles.textarea} rows={4} value={form.informations} onChange={(e) => update("informations", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Référent</label>
                        <input className={styles.input} value={form.referentNom} onChange={(e) => update("referentNom", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Email référent</label>
                        <input className={styles.input} value={form.referentEmail} onChange={(e) => update("referentEmail", e.target.value)} />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Téléphone référent</label>
                        <input className={styles.input} value={form.referentTelephone} onChange={(e) => update("referentTelephone", e.target.value)} />
                      </div>
                    </div>

                    <div className={styles.footer}>
                      <button type="button" className={styles.secondaryBtn} onClick={() => { setIsEditing(false); hydrateFormFrom(selected); }}>
                        Annuler
                      </button>
                      <button type="button" className={styles.submitBtn} onClick={saveEdit} disabled={!canSubmit}>
                        Enregistrer
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={styles.infoGrid}>
                    <div className={styles.infoRow}>
                      <div className={styles.k}>Password</div>
                      <div className={styles.v}>{selected.password || "—"}</div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>Site</div>
                      <div className={styles.v}>
                        {selected.websiteUrl ? (
                          <a className={styles.link} href={selected.websiteUrl} target="_blank" rel="noreferrer">
                            {selected.websiteUrl}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>SIRET</div>
                      <div className={styles.v}>{selected.siret || "—"}</div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>Adresse</div>
                      <div className={styles.vMultiline}>{selected.adresse || "—"}</div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>Ville</div>
                      <div className={styles.v}>{selected.ville || "—"}</div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>Moyen de livraison</div>
                      <div className={styles.v}>{selected.moyenLivraison || "—"}</div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>Informations</div>
                      <div className={styles.vMultiline}>{selected.informations || "—"}</div>
                    </div>

                    <div className={styles.infoRow}>
                      <div className={styles.k}>Référent</div>
                      <div className={styles.v}>
                        {selected.referentNom || "—"}
                        {selected.referentEmail ? (
                          <>
                            <br />
                            <a className={styles.link} href={`mailto:${selected.referentEmail}`}>
                              {selected.referentEmail}
                            </a>
                          </>
                        ) : null}
                        {selected.referentTelephone ? (
                          <>
                            <br />
                            <a className={styles.link} href={`tel:${selected.referentTelephone}`}>
                              {selected.referentTelephone}
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.histSection}>
                {loadingHist ? (
                  <div className={styles.muted}>Chargement…</div>
                ) : histRows.length === 0 ? (
                  <div className={styles.muted}>Aucune commande trouvée pour ce fournisseur.</div>
                ) : (
                  <>
                    {/* ── Sélecteur de période ── */}
                    <div className={styles.histPeriodBar}>
                      <select
                        className={styles.histPeriodSelect}
                        value={histFilterYear}
                        onChange={(e) => {
                          setHistFilterYear(e.target.value);
                          setHistFilterMonth("all");
                        }}
                      >
                        <option value="all">Toutes les années</option>
                        {availableYears.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>

                      {histFilterYear !== "all" && (
                        <select
                          className={styles.histPeriodSelect}
                          value={histFilterMonth}
                          onChange={(e) => setHistFilterMonth(e.target.value)}
                        >
                          <option value="all">Tous les mois</option>
                          {MONTHS_FR.map((m, i) => (
                            <option key={i + 1} value={String(i + 1)}>{m}</option>
                          ))}
                        </select>
                      )}

                      <div className={styles.histPeriodTotal}>
                        Total période&nbsp;:&nbsp;
                        <strong>{formatMoney(periodTotal)} €</strong>
                        <span className={styles.histPeriodCount}>
                          &nbsp;({filteredHistRows.length} commande{filteredHistRows.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>

                  <div className={styles.histTableWrap}>
                    <table className={styles.histTable}>
                      <thead>
                        <tr>
                          <th>Voir</th>
                          <th>Date</th>
                          <th>Produits</th>
                          <th>Total HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className={styles.muted} style={{ textAlign: "center", padding: "16px" }}>
                              Aucune commande sur cette période.
                            </td>
                          </tr>
                        ) : filteredHistRows.map((h) => {
                          const expanded = !!expandedHist[h.id];
                          return (
                            <React.Fragment key={h.id}>
                              <tr>
                                <td className={styles.centerCell}>
                                  <button
                                    type="button"
                                    className={styles.histExpandBtn}
                                    onClick={() => toggleHistRow(h.id)}
                                    aria-label={expanded ? "Replier" : "Deplier"}
                                    title={expanded ? "Replier" : "Deplier"}
                                  >
                                    {expanded ? "-" : "+"}
                                  </button>
                                </td>
                                <td>{h.date}</td>
                                <td>{h.totalProduits}</td>
                                <td>{formatMoney(h.totalHT)} €</td>
                              </tr>

                              {expanded ? (
                                <tr className={styles.histDetailRow}>
                                  <td colSpan={4}>
                                    <div className={styles.histDetailWrap}>
                                      <table className={styles.histDetailTable}>
                                        <thead>
                                          <tr>
                                            <th>Produit</th>
                                            <th>Quantite</th>
                                            <th>Total HT</th>
                                            <th className={styles.centerCell}>Recommander</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {h.produits.length === 0 ? (
                                            <tr>
                                              <td colSpan={4} className={styles.muted}>
                                                Aucun produit sur cette commande.
                                              </td>
                                            </tr>
                                          ) : (
                                            h.produits.map((p) => (
                                              <tr key={p.id}>
                                                <td>{p.nomProduit}</td>
                                                <td>{p.quantite}</td>
                                                <td>{formatMoney(p.prixTotalHT)} €</td>
                                                <td className={styles.centerCell}>
                                                  <button
                                                    type="button"
                                                    className={styles.recommendIconButton}
                                                    onClick={() => recommanderProduit(h, p)}
                                                    title="Recommander"
                                                    aria-label={`Recommander ${p.nomProduit}`}
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
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
