"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Historique.module.css";

const TYPE_OPTIONS = [
    { value: "", label: "Tous les types" },
    { value: "sortie", label: "📤 Sortie" },
    { value: "retour", label: "📥 Retour" },
    { value: "modification", label: "🔧 Modification" },
    { value: "reparation", label: "🛠️ Reparation" },
    { value: "ajout", label: "➕ Ajout" },
    { value: "retrait", label: "➖ Retrait" },
];

const ETAT_LABELS = {
    ras: "✅ RAS",
    a_revoir: "⚠️ À revoir",
    a_reparer: "🔧 À réparer",
    a_refaire: "♻️ À refaire",
};

function typeClass(type) {
    const lower = String(type || "").toLowerCase();
    if (lower === "sortie") return "typeSortie";
    if (lower === "retour") return "typeRetour";
    if (lower === "modification") return "typeModification";
    if (lower === "reparation") return "typeReparation";
    if (lower === "ajout") return "typeAjout";
    if (lower === "retrait") return "typeRetrait";
    return "typeModification";
}

function dotClass(type) {
    const lower = String(type || "").toLowerCase();
    if (lower === "sortie") return "dotSortie";
    if (lower === "retour") return "dotRetour";
    if (lower === "modification") return "dotModification";
    if (lower === "reparation") return "dotReparation";
    if (lower === "ajout") return "dotAjout";
    if (lower === "retrait") return "dotRetrait";
    return "dotDefault";
}

function etatClass(etat) {
    if (etat === "ras") return "etatRas";
    if (etat === "a_revoir") return "etatRevoir";
    if (etat === "a_reparer") return "etatReparer";
    if (etat === "a_refaire") return "etatRefaire";
    return "";
}

function typeLabel(type) {
    const found = TYPE_OPTIONS.find((t) => t.value === type);
    return found?.label || type || "-";
}

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function HistoriquePage() {
    const [items, setItems] = useState([]);
    const [kits, setKits] = useState([]);
    const [filterType, setFilterType] = useState("");
    const [filterKit, setFilterKit] = useState("");
    const [search, setSearch] = useState("");

    // Load
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [resHist, resKits] = await Promise.all([
                    fetch("/api/equipements/historique", { cache: "no-store" }),
                    fetch("/api/equipements/kits", { cache: "no-store" }),
                ]);

                const [dataHist, dataKits] = await Promise.all([
                    resHist.json().catch(() => ({})),
                    resKits.json().catch(() => ({})),
                ]);

                if (!cancelled) {
                    if (resHist.ok) {
                        const mapped = (dataHist.items || []).map((d) => ({ ...d, id: String(d._id) }));
                        setItems(mapped);
                    }
                    if (resKits.ok) {
                        const mapped = (dataKits.items || []).map((d) => ({ ...d, id: String(d._id) }));
                        setKits(mapped);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const kitOptions = useMemo(() => {
        const names = kits.map((k) => ({ id: k.id, nom: k.nom || "Sans nom" }));
        return names;
    }, [kits]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((item) => {
            if (filterType && item.type !== filterType) return false;
            if (filterKit && item.kitId !== filterKit) return false;
            if (q) {
                const blob = `${item.kitNom || ""} ${item.description || ""} ${item.commentaire || ""} ${item.projet || ""} ${item.type || ""}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [items, filterType, filterKit, search]);

    const resetFilters = () => {
        setFilterType("");
        setFilterKit("");
        setSearch("");
    };

    return (
        <div className={styles.page}>
            <div className={styles.headerRow}>
                <h1 className={styles.pageTitle}>Historique Equipements</h1>
            </div>

            <div className={styles.filtersRow}>
                <select
                    className={styles.filterSelect}
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    {TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>

                <select
                    className={styles.filterSelect}
                    value={filterKit}
                    onChange={(e) => setFilterKit(e.target.value)}
                >
                    <option value="">Tous les kits</option>
                    {kitOptions.map((k) => (
                        <option key={k.id} value={k.id}>{k.nom}</option>
                    ))}
                </select>

                <input
                    className={styles.searchInput}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par kit, projet, description..."
                />

                <button type="button" className={styles.resetBtn} onClick={resetFilters}>
                    Reinitialiser
                </button>
            </div>

            {filteredItems.length === 0 ? (
                <div className={styles.empty}>
                    Aucun evenement dans l&apos;historique.
                </div>
            ) : (
                <div className={styles.timeline}>
                    {filteredItems.map((item) => (
                        <div key={item.id} className={styles.timelineItem}>
                            <div className={`${styles.timelineDot} ${styles[dotClass(item.type)]}`} />
                            <div className={styles.timelineCard}>
                                <div className={styles.timelineHeader}>
                                    <div>
                                        <span className={styles.timelineDate}>{formatDate(item.date)}</span>
                                        {item.kitNom ? (
                                            <span className={styles.timelineKitName}> — {item.kitNom}</span>
                                        ) : null}
                                    </div>
                                    <div className={styles.timelineMeta}>
                                        <span className={`${styles.typePill} ${styles[typeClass(item.type)]}`}>
                                            {typeLabel(item.type)}
                                        </span>
                                        {item.projet ? (
                                            <span className={styles.projetPill}>{item.projet}</span>
                                        ) : null}
                                        {item.etatRetour ? (
                                            <span className={`${styles.etatPill} ${styles[etatClass(item.etatRetour)]}`}>
                                                {ETAT_LABELS[item.etatRetour] || item.etatRetour}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {item.description ? (
                                    <div className={styles.timelineDescription}>{item.description}</div>
                                ) : null}

                                {item.commentaire ? (
                                    <div className={styles.timelineComment}>💬 {item.commentaire}</div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
