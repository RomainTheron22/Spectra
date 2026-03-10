"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./ChecklistsEpi.module.css";
import Modal from "../../../components/ui/Modal";

const TYPES = ["Tournage", "Podcast", "Evenement SFX", "Autre"];
const STATUTS = ["Brouillon", "Pret", "Utilise", "Archive"];

const EPI_CATALOGUE = [
    "Casque de chantier",
    "Lunettes de protection",
    "Gants de manutention",
    "Gants isolants",
    "Chaussures de securite",
    "Gilet haute visibilite",
    "Harnais antichute",
    "Bouchons d'oreilles",
    "Casque anti-bruit",
    "Extincteur",
    "Trousse de premiers secours",
    "Lampe frontale",
    "Talkie-walkie",
];

function statusClass(statut) {
    const lower = String(statut || "").toLowerCase();
    if (lower.includes("brouillon")) return "statusBrouillon";
    if (lower.includes("pret")) return "statusPret";
    if (lower.includes("utilis")) return "statusUtilise";
    if (lower.includes("archiv")) return "statusArchive";
    return "statusBrouillon";
}

function makeItem(text = "", checked = false) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        checked,
    };
}

export default function ChecklistsEpiPage() {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");

    // Add modal
    const [addOpen, setAddOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Detail modal
    const [detailOpen, setDetailOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [detailTab, setDetailTab] = useState("checklist");

    const [form, setForm] = useState({
        nom: "",
        type: TYPES[0],
        projet: "",
        statut: STATUTS[0],
        commentaires: "",
        items: [makeItem()],
        epiItems: [],
    });

    const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const canSubmit = useMemo(() => String(form.nom).trim().length > 0, [form.nom]);

    const resetForm = () => {
        setForm({
            nom: "",
            type: TYPES[0],
            projet: "",
            statut: STATUTS[0],
            commentaires: "",
            items: [makeItem()],
            epiItems: [],
        });
        setEditingId(null);
    };

    // Load
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/equipements/checklists", { cache: "no-store" });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Erreur chargement checklists");
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
            const blob = `${item.nom || ""} ${item.type || ""} ${item.projet || ""} ${item.statut || ""} ${item.commentaires || ""}`.toLowerCase();
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
            projet: item?.projet || "",
            statut: item?.statut || STATUTS[0],
            commentaires: item?.commentaires || "",
            items: Array.isArray(item?.items) && item.items.length > 0
                ? item.items.map((i) => makeItem(i.text || "", !!i.checked))
                : [makeItem()],
            epiItems: Array.isArray(item?.epiItems) ? [...item.epiItems] : [],
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
            projet: form.projet,
            statut: form.statut,
            commentaires: form.commentaires,
            items: (form.items || []).filter((i) => String(i.text).trim()).map((i) => ({
                id: i.id,
                text: String(i.text).trim(),
                checked: !!i.checked,
            })),
            epiItems: form.epiItems || [],
        };

        const isEdit = Boolean(editingId);
        const url = isEdit ? `/api/equipements/checklists/${encodeURIComponent(String(editingId))}` : "/api/equipements/checklists";
        const method = isEdit ? "PATCH" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            alert(`${data?.error || "Erreur sauvegarde checklist"}${data?.details ? " - " + data.details : ""}`);
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

    const deleteChecklist = async (id) => {
        const ok = window.confirm("Supprimer cette checklist ? Cette action est irréversible.");
        if (!ok) return;

        const res = await fetch(`/api/equipements/checklists/${encodeURIComponent(String(id))}`, { method: "DELETE" });
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
        setDetailTab("checklist");
        setDetailOpen(true);
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setSelected(null);
        setDetailTab("checklist");
    };

    // Toggle check in detail (live save)
    const toggleCheck = async (itemId) => {
        if (!selected?.id) return;
        const nextItems = (selected.items || []).map((i) =>
            String(i.id) === String(itemId) ? { ...i, checked: !i.checked } : i
        );

        const res = await fetch(`/api/equipements/checklists/${encodeURIComponent(String(selected.id))}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: nextItems }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) return;

        const saved = { ...data.item, id: String(data.item._id) };
        setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        setSelected(saved);
    };

    // Generate EPI
    const generateEpi = () => {
        const type = String(form.type).toLowerCase();
        let suggestions = [];

        if (type.includes("tournage")) {
            suggestions = [
                "Casque de chantier",
                "Chaussures de securite",
                "Gilet haute visibilite",
                "Gants de manutention",
                "Extincteur",
                "Trousse de premiers secours",
                "Talkie-walkie",
            ];
        } else if (type.includes("sfx")) {
            suggestions = [
                "Casque de chantier",
                "Lunettes de protection",
                "Gants isolants",
                "Chaussures de securite",
                "Casque anti-bruit",
                "Extincteur",
                "Trousse de premiers secours",
                "Harnais antichute",
            ];
        } else if (type.includes("podcast")) {
            suggestions = [
                "Extincteur",
                "Trousse de premiers secours",
            ];
        } else {
            suggestions = [
                "Casque de chantier",
                "Chaussures de securite",
                "Gilet haute visibilite",
                "Extincteur",
                "Trousse de premiers secours",
            ];
        }

        setForm((p) => ({ ...p, epiItems: suggestions }));
    };

    // Form helpers
    const addFormItem = () => setForm((p) => ({ ...p, items: [...(p.items || []), makeItem()] }));
    const removeFormItem = (idx) => setForm((p) => {
        const next = [...(p.items || [])];
        next.splice(idx, 1);
        return { ...p, items: next.length ? next : [makeItem()] };
    });
    const updateFormItem = (idx, value) => setForm((p) => {
        const next = [...(p.items || [])];
        next[idx] = { ...next[idx], text: value };
        return { ...p, items: next };
    });

    const addEpiItem = (epi) => {
        setForm((p) => ({
            ...p,
            epiItems: (p.epiItems || []).includes(epi) ? p.epiItems : [...(p.epiItems || []), epi],
        }));
    };
    const removeEpiItem = (epi) => {
        setForm((p) => ({ ...p, epiItems: (p.epiItems || []).filter((e) => e !== epi) }));
    };

    // Progress
    const getProgress = (checklist) => {
        const allItems = checklist?.items || [];
        if (allItems.length === 0) return { done: 0, total: 0, pct: 0 };
        const done = allItems.filter((i) => i.checked).length;
        return { done, total: allItems.length, pct: Math.round((done / allItems.length) * 100) };
    };

    return (
        <div className={styles.page}>
            <div className={styles.headerRow}>
                <h1 className={styles.pageTitle}>Checklists & EPI</h1>
                <button type="button" className={styles.addButton} onClick={openAdd}>
                    + Nouvelle Checklist
                </button>
            </div>

            <div className={styles.searchRow}>
                <input
                    className={styles.searchInput}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, type, projet..."
                />
            </div>

            <div className={styles.grid}>
                {filteredItems.map((item) => {
                    const prog = getProgress(item);
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={styles.cardButton}
                            onClick={() => openDetail(item)}
                        >
                            <div className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div className={styles.cardLeft}>
                                        <div className={styles.cardName}>{item.nom || "-"}</div>
                                        <span className={`${styles.statusPill} ${styles[statusClass(item.statut)]}`}>
                                            {item.statut || "Brouillon"}
                                        </span>
                                        <span className={styles.typePill}>{item.type || "Tournage"}</span>
                                    </div>
                                    <div className={styles.cardActions}>
                                        <button type="button" className={styles.iconButton} title="Modifier" onClick={(e) => { e.stopPropagation(); openEdit(item); }}>
                                            ✏️
                                        </button>
                                        <button type="button" className={styles.deleteButton} title="Supprimer" onClick={(e) => { e.stopPropagation(); deleteChecklist(item.id); }}>
                                            ✖
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.cardMeta}>
                                    {item.projet ? (
                                        <span className={styles.metaItem}>
                                            <span className={styles.metaIcon}>📋</span> {item.projet}
                                        </span>
                                    ) : null}
                                    <span className={styles.metaItem}>
                                        <span className={styles.metaIcon}>✅</span> {prog.done}/{prog.total} items
                                    </span>
                                    {Array.isArray(item.epiItems) && item.epiItems.length > 0 ? (
                                        <span className={styles.metaItem}>
                                            <span className={styles.metaIcon}>🦺</span> {item.epiItems.length} EPI
                                        </span>
                                    ) : null}
                                </div>

                                {prog.total > 0 ? (
                                    <div className={styles.progress}>
                                        <div className={styles.progressBar}>
                                            <div className={styles.progressFill} style={{ width: `${prog.pct}%` }} />
                                        </div>
                                        <span className={styles.progressText}>{prog.pct}%</span>
                                    </div>
                                ) : null}
                            </div>
                        </button>
                    );
                })}

                {filteredItems.length === 0 ? (
                    <div className={styles.empty}>Aucune checklist trouvee.</div>
                ) : null}
            </div>

            {/* Modal Ajout / Edit */}
            <Modal open={addOpen} title={editingId ? "Modifier la checklist" : "Nouvelle Checklist"} onClose={closeAdd} size="sm">
                <form className={styles.form} onSubmit={submitAdd}>
                    <div className={styles.formGrid}>
                        <div className={styles.fieldWide}>
                            <label className={styles.label}>Nom *</label>
                            <input className={styles.input} value={form.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Ex: Checklist Tournage Extérieur" />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Type de tournage</label>
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
                            <label className={styles.label}>Projet</label>
                            <input className={styles.input} value={form.projet} onChange={(e) => update("projet", e.target.value)} placeholder="Nom du projet / contrat" />
                        </div>

                        <div className={styles.fieldWide}>
                            <label className={styles.label}>Commentaires</label>
                            <textarea className={styles.textarea} rows={3} value={form.commentaires} onChange={(e) => update("commentaires", e.target.value)} />
                        </div>

                        {/* Items checklist */}
                        <div className={styles.fieldWide}>
                            <div className={styles.sectionTitle}>Elements de la checklist</div>
                            <div className={styles.itemsList}>
                                {(form.items || []).map((item, idx) => (
                                    <div key={item.id} className={styles.itemRow}>
                                        <input
                                            className={styles.itemInput}
                                            value={item.text}
                                            onChange={(e) => updateFormItem(idx, e.target.value)}
                                            placeholder={`Element ${idx + 1}`}
                                        />
                                        <button type="button" className={styles.removeBtn} onClick={() => removeFormItem(idx)}>✖</button>
                                    </div>
                                ))}
                                <button type="button" className={styles.addItemBtn} onClick={addFormItem}>+ Ajouter un element</button>
                            </div>
                        </div>

                        {/* EPI */}
                        <div className={styles.fieldWide}>
                            <div className={styles.epiSection}>
                                <div className={styles.epiTitle}>🦺 Equipements de Protection Individuelle</div>
                                <button type="button" className={styles.secondaryBtn} onClick={generateEpi} style={{ marginBottom: 8 }}>
                                    Generer les EPI recommandes
                                </button>
                                <div className={styles.itemsList}>
                                    {(form.epiItems || []).map((epi) => (
                                        <div key={epi} className={styles.itemRow}>
                                            <span className={styles.itemText}>{epi}</span>
                                            <button type="button" className={styles.removeBtn} onClick={() => removeEpiItem(epi)}>✖</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <select
                                        className={styles.input}
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value) addEpiItem(e.target.value);
                                            e.target.value = "";
                                        }}
                                    >
                                        <option value="">+ Ajouter un EPI...</option>
                                        {EPI_CATALOGUE.filter((e) => !(form.epiItems || []).includes(e)).map((epi) => (
                                            <option key={epi} value={epi}>{epi}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.secondaryBtn} onClick={closeAdd}>Annuler</button>
                        <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
                            {editingId ? "Enregistrer" : "Creer la checklist"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Detail */}
            <Modal open={detailOpen} title={selected?.nom || "Checklist"} onClose={closeDetail} size="sm">
                {selected ? (
                    <div className={styles.detailWrap}>
                        <div className={styles.detailTop}>
                            <div className={styles.tabs}>
                                <button type="button" className={detailTab === "checklist" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("checklist")}>
                                    Checklist
                                </button>
                                <button type="button" className={detailTab === "epi" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("epi")}>
                                    EPI ({(selected.epiItems || []).length})
                                </button>
                                <button type="button" className={detailTab === "infos" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("infos")}>
                                    Infos
                                </button>
                            </div>
                            <div className={styles.detailActions}>
                                <button type="button" className={styles.iconButton} onClick={() => openEdit(selected)} title="Modifier">✏️</button>
                                <button type="button" className={styles.deleteButton} onClick={() => deleteChecklist(selected.id)} title="Supprimer">✖</button>
                            </div>
                        </div>

                        {detailTab === "checklist" ? (
                            <>
                                {(() => {
                                    const prog = getProgress(selected);
                                    return prog.total > 0 ? (
                                        <div className={styles.progress}>
                                            <div className={styles.progressBar}>
                                                <div className={styles.progressFill} style={{ width: `${prog.pct}%` }} />
                                            </div>
                                            <span className={styles.progressText}>{prog.done}/{prog.total} — {prog.pct}%</span>
                                        </div>
                                    ) : null;
                                })()}

                                <div className={styles.itemsList}>
                                    {(selected.items || []).length === 0 ? (
                                        <div className={styles.muted}>Aucun element dans cette checklist.</div>
                                    ) : (
                                        (selected.items || []).map((item) => (
                                            <div key={item.id} className={styles.itemRow}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.itemCheck}
                                                    checked={!!item.checked}
                                                    onChange={() => toggleCheck(item.id)}
                                                />
                                                <span className={item.checked ? styles.itemTextChecked : styles.itemText}>
                                                    {item.text || "-"}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : detailTab === "epi" ? (
                            <div className={styles.epiSection}>
                                <div className={styles.epiTitle}>🦺 Liste EPI</div>
                                {(selected.epiItems || []).length === 0 ? (
                                    <div className={styles.muted}>Aucun EPI defini pour cette checklist.</div>
                                ) : (
                                    <div className={styles.itemsList}>
                                        {selected.epiItems.map((epi) => (
                                            <div key={epi} className={styles.itemRow}>
                                                <span className={styles.itemText}>• {epi}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.infoGrid}>
                                <div className={styles.infoRow}>
                                    <div className={styles.k}>Type</div>
                                    <div className={styles.v}>{selected.type || "-"}</div>
                                </div>
                                <div className={styles.infoRow}>
                                    <div className={styles.k}>Statut</div>
                                    <div className={styles.v}>
                                        <span className={`${styles.statusPill} ${styles[statusClass(selected.statut)]}`}>
                                            {selected.statut || "Brouillon"}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.infoRow}>
                                    <div className={styles.k}>Projet</div>
                                    <div className={styles.v}>{selected.projet || "-"}</div>
                                </div>
                                <div className={styles.infoRow}>
                                    <div className={styles.k}>Commentaires</div>
                                    <div className={styles.v}>{selected.commentaires || "-"}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}
