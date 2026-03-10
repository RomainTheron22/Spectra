"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./KitsMachines.module.css";
import Modal from "../../../components/ui/Modal";

const TYPES = ["Kit", "Machine", "Accessoire", "Decor Podcast"];
const STATUTS = ["Disponible", "En tournage", "En maintenance", "Hors service"];
const ETATS_RETOUR = [
    { value: "ras", label: "✅ RAS" },
    { value: "a_revoir", label: "⚠️ À revoir" },
    { value: "a_reparer", label: "🔧 À réparer" },
    { value: "a_refaire", label: "♻️ À refaire" },
];

function statusClass(statut) {
    const lower = String(statut || "").toLowerCase();
    if (lower.includes("disponible")) return "statusGreen";
    if (lower.includes("tournage")) return "statusBlue";
    if (lower.includes("maintenance")) return "statusOrange";
    if (lower.includes("hors")) return "statusRed";
    return "statusGreen";
}

function etatClass(etat) {
    if (etat === "ras") return "etatRas";
    if (etat === "a_revoir") return "etatRevoir";
    if (etat === "a_reparer") return "etatReparer";
    if (etat === "a_refaire") return "etatRefaire";
    return "";
}

function etatLabel(etat) {
    const found = ETATS_RETOUR.find((e) => e.value === etat);
    return found?.label || etat || "-";
}

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("fr-FR");
}

export default function KitsMachinesPage() {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");

    // Add/Edit Modal
    const [addOpen, setAddOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Detail Modal
    const [detailOpen, setDetailOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [detailTab, setDetailTab] = useState("infos");

    // Sortie Modal (enregistrer une sortie/retour)
    const [sortieOpen, setSortieOpen] = useState(false);
    const [sortieForm, setSortieForm] = useState({
        type: "sortie",
        projet: "",
        commentaire: "",
        etatRetour: "ras",
        date: "",
    });

    const [form, setForm] = useState({
        nom: "",
        type: TYPES[0],
        description: "",
        statut: STATUTS[0],
        contenu: [""],
    });

    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const canSubmit = useMemo(() => String(form.nom).trim().length > 0, [form.nom]);

    const resetForm = () => {
        setForm({
            nom: "",
            type: TYPES[0],
            description: "",
            statut: STATUTS[0],
            contenu: [""],
        });
        setEditingId(null);
    };

    // Load items
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/equipements/kits", { cache: "no-store" });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Erreur chargement kits");
                if (!cancelled) {
                    const mapped = (data.items || []).map((d) => ({ ...d, id: String(d._id) }));
                    setItems(mapped);
                }
            } catch (e) {
                console.error(e);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => {
            const blob = `${item.nom || ""} ${item.type || ""} ${item.description || ""} ${item.statut || ""} ${(item.contenu || []).join(" ")}`.toLowerCase();
            return blob.includes(q);
        });
    }, [items, search]);

    // CRUD
    const openAdd = () => { resetForm(); setAddOpen(true); };
    const closeAdd = () => { setAddOpen(false); resetForm(); };

    const openEdit = (item) => {
        setForm({
            nom: item?.nom || "",
            type: item?.type || TYPES[0],
            description: item?.description || "",
            statut: item?.statut || STATUTS[0],
            contenu: Array.isArray(item?.contenu) && item.contenu.length > 0 ? [...item.contenu] : [""],
        });
        setEditingId(item?.id || null);
        setAddOpen(true);
    };

    const submitAdd = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;

        const payload = {
            nom: form.nom,
            type: form.type,
            description: form.description,
            statut: form.statut,
            contenu: (form.contenu || []).map((c) => String(c).trim()).filter(Boolean),
        };

        const isEdit = Boolean(editingId);
        const url = isEdit ? `/api/equipements/kits/${encodeURIComponent(String(editingId))}` : "/api/equipements/kits";
        const method = isEdit ? "PATCH" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            alert(`${data?.error || "Erreur sauvegarde kit"}${data?.details ? " - " + data.details : ""}`);
            return;
        }

        const saved = { ...data.item, id: String(data.item._id) };
        if (isEdit) {
            setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
            setSelected((prev) => (prev?.id === saved.id ? saved : prev));
        } else {
            setItems((prev) => [saved, ...prev]);
        }
        closeAdd();
    };

    const deleteKit = async (id) => {
        const ok = window.confirm("Supprimer ce kit/machine ? Cette action est irréversible.");
        if (!ok) return;

        const res = await fetch(`/api/equipements/kits/${encodeURIComponent(String(id))}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            alert(`${data?.error || "Erreur suppression"}${data?.details ? " - " + data.details : ""}`);
            return;
        }

        setItems((prev) => prev.filter((x) => x.id !== String(id)));
        if (selected?.id === String(id)) closeDetail();
    };

    // Detail
    const openDetail = (item) => {
        setSelected(item);
        setDetailTab("infos");
        setDetailOpen(true);
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setSelected(null);
        setDetailTab("infos");
    };

    // Sorties (enregistrer sortie/retour)
    const openSortie = (type) => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
        setSortieForm({
            type,
            projet: "",
            commentaire: "",
            etatRetour: "ras",
            date: ymd,
        });
        setSortieOpen(true);
    };

    const submitSortie = async (e) => {
        e.preventDefault();
        if (!selected?.id) return;

        const currentSorties = Array.isArray(selected.sorties) ? [...selected.sorties] : [];
        const newSortie = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: sortieForm.type,
            projet: sortieForm.projet,
            commentaire: sortieForm.commentaire,
            etatRetour: sortieForm.type === "retour" ? sortieForm.etatRetour : "",
            date: sortieForm.date || new Date().toISOString(),
        };

        const nextSorties = [...currentSorties, newSortie];
        const nextStatut = sortieForm.type === "sortie" ? "En tournage" : "Disponible";

        const res = await fetch(`/api/equipements/kits/${encodeURIComponent(String(selected.id))}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sorties: nextSorties,
                statut: nextStatut,
            }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            alert(`${data?.error || "Erreur enregistrement sortie"}${data?.details ? " - " + data.details : ""}`);
            return;
        }

        const saved = { ...data.item, id: String(data.item._id) };
        setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        setSelected(saved);

        // Ajouter à l'historique global
        try {
            await fetch("/api/equipements/historique", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kitId: selected.id,
                    kitNom: selected.nom,
                    type: sortieForm.type,
                    projet: sortieForm.projet,
                    description: sortieForm.type === "sortie"
                        ? `${selected.nom} est parti en tournage`
                        : `${selected.nom} est revenu de tournage`,
                    commentaire: sortieForm.commentaire,
                    etatRetour: sortieForm.type === "retour" ? sortieForm.etatRetour : "",
                    date: sortieForm.date,
                }),
            });
        } catch (err) {
            console.error("Erreur ajout historique:", err);
        }

        setSortieOpen(false);
    };

    // Contenu form helpers
    const addContenuLine = () => setForm((p) => ({ ...p, contenu: [...(p.contenu || []), ""] }));
    const removeContenuLine = (idx) => setForm((p) => {
        const next = [...(p.contenu || [])];
        next.splice(idx, 1);
        return { ...p, contenu: next.length ? next : [""] };
    });
    const updateContenuLine = (idx, value) => setForm((p) => {
        const next = [...(p.contenu || [])];
        next[idx] = value;
        return { ...p, contenu: next };
    });

    const sortiesSorted = useMemo(() => {
        if (!selected?.sorties) return [];
        return [...selected.sorties].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [selected?.sorties]);

    return (
        <div className={styles.page}>
            <div className={styles.headerRow}>
                <h1 className={styles.pageTitle}>Kits & Machines</h1>
                <button type="button" className={styles.addButton} onClick={openAdd}>
                    + Nouveau Kit / Machine
                </button>
            </div>

            <div className={styles.searchRow}>
                <input
                    className={styles.searchInput}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, type, contenu..."
                />
            </div>

            <div className={styles.grid}>
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className={styles.cardButton}
                        onClick={() => openDetail(item)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openDetail(item); }}
                    >
                        <div className={styles.card}>
                            <div className={styles.cardTop}>
                                <div className={styles.cardLeft}>
                                    <div className={styles.cardName}>{item.nom || "-"}</div>
                                    <span className={`${styles.statusPill} ${styles[statusClass(item.statut)]}`}>
                                        {item.statut || "Disponible"}
                                    </span>
                                    <span className={styles.typePill}>{item.type || "Kit"}</span>
                                </div>
                                <div className={styles.cardActions}>
                                    <button
                                        type="button"
                                        className={styles.iconButton}
                                        title="Modifier"
                                        onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.deleteButton}
                                        title="Supprimer"
                                        onClick={(e) => { e.stopPropagation(); deleteKit(item.id); }}
                                    >
                                        ✖
                                    </button>
                                </div>
                            </div>

                            <div className={styles.cardMeta}>
                                <span className={styles.metaItem}>
                                    <span className={styles.metaIcon}>🔄</span>
                                    <span className={styles.sortiesCount}>{item.nombreSorties || 0} sortie{(item.nombreSorties || 0) > 1 ? "s" : ""}</span>
                                </span>
                                {item.derniereSortie?.date ? (
                                    <span className={styles.metaItem}>
                                        <span className={styles.metaIcon}>📅</span>
                                        Derniere: {formatDate(item.derniereSortie.date)}
                                        {item.derniereSortie.projet ? ` — ${item.derniereSortie.projet}` : ""}
                                    </span>
                                ) : null}
                            </div>

                            {Array.isArray(item.contenu) && item.contenu.length > 0 ? (
                                <div className={styles.contenuList}>
                                    {item.contenu.slice(0, 5).map((c, i) => (
                                        <span key={i} className={styles.contenuTag}>{c}</span>
                                    ))}
                                    {item.contenu.length > 5 ? (
                                        <span className={styles.contenuTag}>+{item.contenu.length - 5}</span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}

                {filteredItems.length === 0 ? (
                    <div className={styles.empty}>Aucun kit ou machine trouve.</div>
                ) : null}
            </div>

            {/* Modal Ajout / Edit */}
            <Modal open={addOpen} title={editingId ? "Modifier" : "Nouveau Kit / Machine"} onClose={closeAdd} size="sm">
                <form className={styles.form} onSubmit={submitAdd}>
                    <div className={styles.formGrid}>
                        <div className={styles.fieldWide}>
                            <label className={styles.label}>Nom *</label>
                            <input className={styles.input} value={form.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Ex: Kit Podcast Bibliothèque" />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Type</label>
                            <select className={styles.input} value={form.type} onChange={(e) => update("type", e.target.value)}>
                                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Statut</label>
                            <select className={styles.input} value={form.statut} onChange={(e) => update("statut", e.target.value)}>
                                {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className={styles.fieldWide}>
                            <label className={styles.label}>Description</label>
                            <textarea className={styles.textarea} rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Description du kit ou de la machine..." />
                        </div>

                        <div className={styles.fieldWide}>
                            <div className={styles.contenuSection}>
                                <div className={styles.contenuSectionTitle}>Contenu du kit</div>
                                <div className={styles.contenuRows}>
                                    {(form.contenu || [""]).map((item, idx) => (
                                        <div key={idx} className={styles.contenuRow}>
                                            <input
                                                className={styles.contenuRowInput}
                                                value={item}
                                                onChange={(e) => updateContenuLine(idx, e.target.value)}
                                                placeholder={`Element ${idx + 1}`}
                                            />
                                            <button type="button" className={styles.removeBtn} onClick={() => removeContenuLine(idx)}>✖</button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" className={styles.addItemBtn} onClick={addContenuLine}>+ Ajouter un element</button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.secondaryBtn} onClick={closeAdd}>Annuler</button>
                        <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
                            {editingId ? "Enregistrer" : "Ajouter"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Detail */}
            <Modal open={detailOpen} title={selected?.nom || "Kit / Machine"} onClose={closeDetail} size="sm">
                {selected ? (
                    <div className={styles.detailWrap}>
                        <div className={styles.detailTop}>
                            <div className={styles.tabs}>
                                <button type="button" className={detailTab === "infos" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("infos")}>
                                    Informations
                                </button>
                                <button type="button" className={detailTab === "contenu" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("contenu")}>
                                    Contenu
                                </button>
                                <button type="button" className={detailTab === "sorties" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("sorties")}>
                                    Sorties ({selected.nombreSorties || 0})
                                </button>
                            </div>

                            <div className={styles.detailActions}>
                                <button type="button" className={styles.iconButton} onClick={() => openEdit(selected)} title="Modifier">✏️</button>
                                <button type="button" className={styles.deleteButton} onClick={() => deleteKit(selected.id)} title="Supprimer">✖</button>
                            </div>
                        </div>

                        {detailTab === "infos" ? (
                            <>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoRow}>
                                        <div className={styles.k}>Type</div>
                                        <div className={styles.v}>{selected.type || "-"}</div>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <div className={styles.k}>Statut</div>
                                        <div className={styles.v}>
                                            <span className={`${styles.statusPill} ${styles[statusClass(selected.statut)]}`}>
                                                {selected.statut || "Disponible"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <div className={styles.k}>Description</div>
                                        <div className={styles.v}>{selected.description || "-"}</div>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <div className={styles.k}>Nb. sorties</div>
                                        <div className={styles.v}>
                                            <span className={styles.sortiesCount}>{selected.nombreSorties || 0}</span>
                                        </div>
                                    </div>
                                    {selected.derniereSortie?.date ? (
                                        <div className={styles.infoRow}>
                                            <div className={styles.k}>Derniere sortie</div>
                                            <div className={styles.v}>
                                                {formatDate(selected.derniereSortie.date)}
                                                {selected.derniereSortie.projet ? ` — ${selected.derniereSortie.projet}` : ""}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className={styles.footer}>
                                    <button type="button" className={styles.submitBtn} onClick={() => openSortie("sortie")}>
                                        📤 Enregistrer une sortie
                                    </button>
                                    <button type="button" className={styles.secondaryBtn} onClick={() => openSortie("retour")}>
                                        📥 Enregistrer un retour
                                    </button>
                                </div>
                            </>
                        ) : detailTab === "contenu" ? (
                            <div className={styles.contenuSection}>
                                {Array.isArray(selected.contenu) && selected.contenu.length > 0 ? (
                                    <div className={styles.contenuList}>
                                        {selected.contenu.map((c, i) => (
                                            <span key={i} className={styles.contenuTag}>{c}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.muted}>Aucun element dans ce kit.</div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.sortiesList}>
                                {sortiesSorted.length === 0 ? (
                                    <div className={styles.muted}>Aucune sortie enregistree.</div>
                                ) : (
                                    sortiesSorted.map((sortie) => (
                                        <div key={sortie.id} className={styles.sortieCard}>
                                            <div className={styles.sortieHeader}>
                                                <div>
                                                    <span className={styles.sortieDate}>{formatDate(sortie.date)}</span>
                                                    {sortie.projet ? <span className={styles.sortieProjet}> — {sortie.projet}</span> : null}
                                                </div>
                                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                    <span className={`${styles.statusPill} ${sortie.type === "sortie" ? styles.statusBlue : styles.statusGreen}`}>
                                                        {sortie.type === "sortie" ? "📤 Sortie" : "📥 Retour"}
                                                    </span>
                                                    {sortie.type === "retour" && sortie.etatRetour ? (
                                                        <span className={`${styles.etatPill} ${styles[etatClass(sortie.etatRetour)]}`}>
                                                            {etatLabel(sortie.etatRetour)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            {sortie.commentaire ? (
                                                <div className={styles.sortieComment}>{sortie.commentaire}</div>
                                            ) : null}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </Modal>

            {/* Modal Sortie / Retour */}
            <Modal open={sortieOpen} title={sortieForm.type === "sortie" ? "📤 Enregistrer une sortie" : "📥 Enregistrer un retour"} onClose={() => setSortieOpen(false)} size="sm">
                <form className={styles.form} onSubmit={submitSortie}>
                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label className={styles.label}>Date</label>
                            <input className={styles.input} type="date" value={sortieForm.date} onChange={(e) => setSortieForm((p) => ({ ...p, date: e.target.value }))} />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Projet</label>
                            <input className={styles.input} value={sortieForm.projet} onChange={(e) => setSortieForm((p) => ({ ...p, projet: e.target.value }))} placeholder="Nom du projet / tournage" />
                        </div>

                        {sortieForm.type === "retour" ? (
                            <div className={styles.field}>
                                <label className={styles.label}>Etat au retour</label>
                                <select className={styles.input} value={sortieForm.etatRetour} onChange={(e) => setSortieForm((p) => ({ ...p, etatRetour: e.target.value }))}>
                                    {ETATS_RETOUR.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                                </select>
                            </div>
                        ) : null}

                        <div className={styles.fieldWide}>
                            <label className={styles.label}>Commentaire</label>
                            <textarea className={styles.textarea} rows={4} value={sortieForm.commentaire} onChange={(e) => setSortieForm((p) => ({ ...p, commentaire: e.target.value }))} placeholder={sortieForm.type === "retour" ? "Ex: Cable XLR #3 a remplacer, micro OK..." : "Notes pour cette sortie..."} />
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.secondaryBtn} onClick={() => setSortieOpen(false)}>Annuler</button>
                        <button type="submit" className={styles.submitBtn}>Enregistrer</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
