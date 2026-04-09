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

    // Modules
    const [modulesInput, setModulesInput] = useState("");

    // Sortie Modal
    const [sortieOpen, setSortieOpen] = useState(false);
    const [sortieForm, setSortieForm] = useState({
        type: "sortie",
        projet: "",
        commentaire: "",
        etatRetour: "ras",
        date: "",
        dateRetourPrevue: "",
        checklistItems: [],
        retourItems: [],
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
        setForm({ nom: "", type: TYPES[0], description: "", statut: STATUTS[0], contenu: [""] });
        setEditingId(null);
    };

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
            const blob = `${item.nom || ""} ${item.type || ""} ${item.description || ""} ${item.statut || ""} ${(item.contenu || []).join(" ")} ${(item.modules || []).join(" ")}`.toLowerCase();
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
        setModulesInput("");
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setSelected(null);
        setDetailTab("infos");
        setModulesInput("");
    };

    // Modules management
    const handleAddModule = async () => {
        const nom = modulesInput.trim();
        if (!nom || !selected?.id) return;
        setModulesInput("");
        const nextModules = [...(selected.modules || []), nom];
        const optimistic = { ...selected, modules: nextModules };
        setSelected(optimistic);
        setItems((prev) => prev.map((x) => (x.id === selected.id ? optimistic : x)));

        await fetch(`/api/equipements/kits/${encodeURIComponent(selected.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modules: nextModules }),
        });
    };

    const handleRemoveModule = async (idx) => {
        if (!selected?.id) return;
        const nextModules = (selected.modules || []).filter((_, i) => i !== idx);
        const optimistic = { ...selected, modules: nextModules };
        setSelected(optimistic);
        setItems((prev) => prev.map((x) => (x.id === selected.id ? optimistic : x)));

        await fetch(`/api/equipements/kits/${encodeURIComponent(selected.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modules: nextModules }),
        });
    };

    // PDF export
    const exportChecklistPDF = () => {
        if (!selected) return;
        const contenuItems = selected.contenu || [];
        const moduleItems = selected.modules || [];
        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Checklist — ${selected.nom || "Kit"}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #0f172a; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 8px 0; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .checkbox { width: 16px; height: 16px; border: 2px solid #94a3b8; border-radius: 3px; flex-shrink: 0; }
  .label { font-size: 14px; flex: 1; }
  .badge { font-size: 10px; font-weight: 700; background: #dbeafe; color: #1e40af; border-radius: 4px; padding: 2px 6px; }
  .signature-row { display: flex; gap: 32px; margin-top: 48px; padding-top: 16px; border-top: 2px solid #e2e8f0; }
  .sig-block { flex: 1; }
  .sig-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 28px; }
  .sig-line { border-bottom: 1px solid #94a3b8; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>${selected.nom || "Checklist Kit"}</h1>
<div class="subtitle">Type : ${selected.type || "Kit"}&nbsp;&nbsp;|&nbsp;&nbsp;Statut : ${selected.statut || ""}&nbsp;&nbsp;|&nbsp;&nbsp;Imprimé le : ${new Date().toLocaleDateString("fr-FR")}</div>
<div class="section-title">Contenu de base (${contenuItems.length} élément${contenuItems.length > 1 ? "s" : ""})</div>
${contenuItems.map((c) => `<div class="item"><div class="checkbox"></div><div class="label">${c}</div></div>`).join("") || '<div style="font-size:13px;color:#94a3b8;padding:8px 0;">Aucun élément</div>'}
${moduleItems.length > 0 ? `
<div class="section-title">Modules optionnels (${moduleItems.length})</div>
${moduleItems.map((m) => `<div class="item"><div class="checkbox"></div><div class="label">${m} <span class="badge">Module</span></div></div>`).join("")}
` : ""}
<div class="signature-row">
  <div class="sig-block"><div class="sig-label">Sorti par</div><div class="sig-line"></div></div>
  <div class="sig-block"><div class="sig-label">Date de sortie</div><div class="sig-line"></div></div>
  <div class="sig-block"><div class="sig-label">Projet</div><div class="sig-line"></div></div>
</div>
</body>
</html>`;
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
    };

    // Sorties
    const openSortie = (type) => {
        const today = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        const contenuItems = (selected?.contenu || []).map((nom) => ({ nom, checked: true, isModule: false }));
        const moduleItems = (selected?.modules || []).map((nom) => ({ nom, checked: false, isModule: true }));
        const allItems = [...contenuItems, ...moduleItems];

        setSortieForm({
            type,
            projet: "",
            commentaire: "",
            etatRetour: "ras",
            date: ymd,
            dateRetourPrevue: "",
            checklistItems: type === "sortie" ? allItems : [],
            retourItems: type === "retour" ? allItems.map((item) => ({ ...item, present: true, etat: "bon" })) : [],
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
            dateRetourPrevue: sortieForm.type === "sortie" ? sortieForm.dateRetourPrevue : "",
            checklistItems: sortieForm.type === "sortie" ? sortieForm.checklistItems : [],
            retourItems: sortieForm.type === "retour" ? sortieForm.retourItems : [],
        };

        const nextSorties = [...currentSorties, newSortie];
        const nextStatut = sortieForm.type === "sortie" ? "En tournage" : "Disponible";

        const res = await fetch(`/api/equipements/kits/${encodeURIComponent(String(selected.id))}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sorties: nextSorties, statut: nextStatut }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            alert(`${data?.error || "Erreur enregistrement sortie"}${data?.details ? " - " + data.details : ""}`);
            return;
        }

        const saved = { ...data.item, id: String(data.item._id) };
        setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        setSelected(saved);

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
                                    {(item.modules || []).length > 0 ? (
                                        <span className={styles.moduleCountPill}>
                                            {item.modules.length} module{item.modules.length > 1 ? "s" : ""}
                                        </span>
                                    ) : null}
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
                                <button type="button" className={detailTab === "modules" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("modules")}>
                                    Modules ({(selected.modules || []).length})
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
                                    <button type="button" className={styles.iconButton} onClick={exportChecklistPDF} title="Exporter checklist PDF">
                                        📄 PDF
                                    </button>
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
                        ) : detailTab === "modules" ? (
                            <div className={styles.modulesSection}>
                                <div className={styles.modulesList}>
                                    {(selected.modules || []).length === 0 ? (
                                        <div className={styles.muted}>Aucun module optionnel. Ajoutez des modules ci-dessous.</div>
                                    ) : (
                                        (selected.modules || []).map((mod, idx) => (
                                            <div key={idx} className={styles.moduleRow}>
                                                <span className={styles.moduleRowName}>{mod}</span>
                                                <button
                                                    type="button"
                                                    className={styles.removeBtn}
                                                    onClick={() => handleRemoveModule(idx)}
                                                >
                                                    ✖
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className={styles.moduleAddRow}>
                                    <input
                                        className={styles.contenuRowInput}
                                        value={modulesInput}
                                        onChange={(e) => setModulesInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddModule(); } }}
                                        placeholder="Ex: Micro cravate, Lumière annulaire..."
                                    />
                                    <button
                                        type="button"
                                        className={styles.submitBtn}
                                        onClick={handleAddModule}
                                        style={{ padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                                    >
                                        Ajouter
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.sortiesList}>
                                {sortiesSorted.length === 0 ? (
                                    <div className={styles.muted}>Aucune sortie enregistree.</div>
                                ) : (
                                    sortiesSorted.map((sortie) => {
                                        const manquants = (sortie.retourItems || []).filter((i) => !i.present).length;
                                        const abimes = (sortie.retourItems || []).filter((i) => i.present && i.etat !== "bon").length;
                                        return (
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
                                                {sortie.type === "sortie" && sortie.dateRetourPrevue ? (
                                                    <div className={styles.sortieComment} style={{ color: "var(--color-text-muted)" }}>
                                                        Retour prévu : {formatDate(sortie.dateRetourPrevue)}
                                                    </div>
                                                ) : null}
                                                {sortie.type === "retour" && (manquants > 0 || abimes > 0) ? (
                                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                        {manquants > 0 ? (
                                                            <span className={`${styles.etatPill} ${styles.etatReparer}`}>
                                                                {manquants} manquant{manquants > 1 ? "s" : ""}
                                                            </span>
                                                        ) : null}
                                                        {abimes > 0 ? (
                                                            <span className={`${styles.etatPill} ${styles.etatRevoir}`}>
                                                                {abimes} abimé/cassé{abimes > 1 ? "s" : ""}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {sortie.commentaire ? (
                                                    <div className={styles.sortieComment}>{sortie.commentaire}</div>
                                                ) : null}
                                            </div>
                                        );
                                    })
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

                        {sortieForm.type === "sortie" ? (
                            <div className={styles.field}>
                                <label className={styles.label}>Date de retour prévue</label>
                                <input className={styles.input} type="date" value={sortieForm.dateRetourPrevue} onChange={(e) => setSortieForm((p) => ({ ...p, dateRetourPrevue: e.target.value }))} />
                            </div>
                        ) : (
                            <div className={styles.field}>
                                <label className={styles.label}>Etat global au retour</label>
                                <select className={styles.input} value={sortieForm.etatRetour} onChange={(e) => setSortieForm((p) => ({ ...p, etatRetour: e.target.value }))}>
                                    {ETATS_RETOUR.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                                </select>
                            </div>
                        )}

                        {sortieForm.type === "sortie" && sortieForm.checklistItems.length > 0 ? (
                            <div className={styles.fieldWide}>
                                <div className={styles.checklistSection}>
                                    <div className={styles.checklistTitle}>Checklist de départ</div>
                                    <div className={styles.checklistItems}>
                                        {sortieForm.checklistItems.map((item, idx) => (
                                            <label key={idx} className={styles.checklistItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={(e) => setSortieForm((p) => {
                                                        const next = [...p.checklistItems];
                                                        next[idx] = { ...next[idx], checked: e.target.checked };
                                                        return { ...p, checklistItems: next };
                                                    })}
                                                />
                                                <span className={styles.checklistItemName}>{item.nom}</span>
                                                {item.isModule ? <span className={styles.moduleBadge}>Module</span> : null}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {sortieForm.type === "retour" && sortieForm.retourItems.length > 0 ? (
                            <div className={styles.fieldWide}>
                                <div className={styles.checklistSection}>
                                    <div className={styles.checklistTitle}>État des éléments au retour</div>
                                    <div className={styles.checklistItems}>
                                        {sortieForm.retourItems.map((item, idx) => (
                                            <div key={idx} className={styles.retourItemRow}>
                                                <label className={styles.retourItemLabel}>
                                                    <input
                                                        type="checkbox"
                                                        checked={item.present}
                                                        onChange={(e) => setSortieForm((p) => {
                                                            const next = [...p.retourItems];
                                                            next[idx] = { ...next[idx], present: e.target.checked };
                                                            return { ...p, retourItems: next };
                                                        })}
                                                    />
                                                    <span className={styles.checklistItemName}>{item.nom}</span>
                                                    {item.isModule ? <span className={styles.moduleBadge}>Module</span> : null}
                                                </label>
                                                {item.present ? (
                                                    <select
                                                        className={styles.retourEtatSelect}
                                                        value={item.etat}
                                                        onChange={(e) => setSortieForm((p) => {
                                                            const next = [...p.retourItems];
                                                            next[idx] = { ...next[idx], etat: e.target.value };
                                                            return { ...p, retourItems: next };
                                                        })}
                                                    >
                                                        <option value="bon">✅ Bon état</option>
                                                        <option value="abimé">⚠️ Abîmé</option>
                                                        <option value="cassé">❌ Cassé</option>
                                                    </select>
                                                ) : (
                                                    <span className={styles.manquantBadge}>Manquant</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className={styles.fieldWide}>
                            <label className={styles.label}>Commentaire</label>
                            <textarea className={styles.textarea} rows={3} value={sortieForm.commentaire} onChange={(e) => setSortieForm((p) => ({ ...p, commentaire: e.target.value }))} placeholder={sortieForm.type === "retour" ? "Ex: Cable XLR #3 a remplacer, micro OK..." : "Notes pour cette sortie..."} />
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
