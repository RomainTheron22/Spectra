"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import styles from "./Contrats.module.css";

const BRANCHES = ["Agency", "CreativeGen", "Enterntainement", "SFX"];
const DEFAULT_STATUSES = ["En attente", "En cours", "Terminé", "Archivé"];
const PAGE_SIZE = 5;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function normalizeFileVersionKey(name) {
  return String(name || "").trim().toLowerCase();
}

function getDateTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildFileVersionGroups(files = []) {
  const groups = new Map();

  files.forEach((file, index) => {
    const key = normalizeFileVersionKey(file?.name) || `file-${file?.id || index}`;
    const current = groups.get(key) || { key, versions: [] };
    current.versions.push(file);
    groups.set(key, current);
  });

  return Array.from(groups.values())
    .map((group) => {
      const chronological = [...group.versions].sort((a, b) => {
        const versionA = Number(a?.versionNumber);
        const versionB = Number(b?.versionNumber);
        if (Number.isInteger(versionA) && Number.isInteger(versionB) && versionA !== versionB) {
          return versionA - versionB;
        }
        const timeDiff = getDateTimestamp(a?.uploadedAt) - getDateTimestamp(b?.uploadedAt);
        if (timeDiff !== 0) return timeDiff;
        return String(a?.id || "").localeCompare(String(b?.id || ""));
      });

      const versions = chronological
        .map((file, index) => ({
          ...file,
          displayVersion: Number.isInteger(Number(file?.versionNumber)) && Number(file.versionNumber) > 0
            ? Number(file.versionNumber)
            : index + 1,
        }))
        .sort((a, b) => {
          const versionDiff = (b.displayVersion || 0) - (a.displayVersion || 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateTimestamp(b?.uploadedAt) - getDateTimestamp(a?.uploadedAt);
        });

      return {
        key: group.key,
        versions,
        latestUploadedAt: versions[0]?.uploadedAt || null,
      };
    })
    .sort((a, b) => getDateTimestamp(b.latestUploadedAt) - getDateTimestamp(a.latestUploadedAt));
}

function normalizeContractFromApi(raw = {}) {
  return {
    ...raw,
    id: String(raw?._id || raw?.id || ""),
    statut: normalizeContractStatus(raw?.statut),
    files: Array.isArray(raw?.files) ? raw.files : [],
  };
}

function listFromFileInput(fileList) {
  return Array.from(fileList || []).filter(Boolean);
}

function statusClass(statut) {
  const lower = String(statut || "").toLowerCase();
  if (lower.includes("cours")) return "statusBlue";
  if (lower.includes("termin")) return "statusGreen";
  if (lower.includes("archiv")) return "statusGray";
  if (lower.includes("attente")) return "statusOrange";
  return "statusPurple";
}

function normalizeContractStatus(rawStatus) {
  const value = String(rawStatus || "").trim();
  if (!value) return DEFAULT_STATUSES[0];
  const lower = value.toLowerCase();
  if (lower.includes("cours")) return "En cours";
  if (lower.includes("termin") || lower.includes("signe")) return "Terminé";
  if (lower.includes("archiv")) return "Archivé";
  if (lower.includes("attente") || lower.includes("brouillon") || lower.includes("preparation")) return "En attente";
  return DEFAULT_STATUSES[0];
}

function StatusDropdown({ value, options, onChange, disabled = false, ariaLabel = "Statut", inline = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const safeOptions = options?.length ? options : DEFAULT_STATUSES;

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className={`${styles.statusDropdown} ${inline ? styles.statusDropdownInline : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`${styles.statusDropdownTrigger} ${inline ? styles.statusDropdownTriggerInline : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {inline ? (
          <span className={`${styles.statusPill} ${styles[statusClass(value)]}`}>
            <span>{value || "-"}</span>
            <span className={`${styles.statusChevron} ${styles.statusChevronHint}`} aria-hidden="true">
              ▾
            </span>
          </span>
        ) : (
          <>
            <span className={`${styles.statusPill} ${styles[statusClass(value)]}`}>{value || "-"}</span>
            <span className={styles.statusChevron} aria-hidden="true">
              ▾
            </span>
          </>
        )}
      </button>

      {open ? (
        <div className={styles.statusDropdownMenu} role="listbox" aria-label={ariaLabel}>
          {safeOptions.map((status) => {
            const active = status === value;
            return (
              <button
                key={status}
                type="button"
                role="option"
                aria-selected={active}
                className={active ? `${styles.statusDropdownOption} ${styles.statusDropdownOptionActive}` : styles.statusDropdownOption}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onChange(status);
                }}
              >
                <span className={`${styles.statusPill} ${styles[statusClass(status)]}`}>{status}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function ContratsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterBranche, setFilterBranche] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState("infos");
  const [editingId, setEditingId] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("infos");
  const [selected, setSelected] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFileVersions, setSelectedFileVersions] = useState({});
  const fileInputRef = useRef(null);
  const addFileInputRef = useRef(null);
  const [addFiles, setAddFiles] = useState([]);
  const fileVersionGroups = useMemo(() => buildFileVersionGroups(selected?.files || []), [selected?.files]);

  const [form, setForm] = useState({
    nomContrat: "",
    clientNom: "",
    branche: BRANCHES[0],
    lieu: "",
    statut: DEFAULT_STATUSES[0],
    dateDebut: "",
    dateFin: "",
    brief: "",
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const replaceAddFiles = (fileList) => {
    const nextFiles = listFromFileInput(fileList);
    if (!nextFiles.length) return;
    setAddFiles((prev) => [...prev, ...nextFiles]);
  };

  useEffect(() => {
    setSelectedFileVersions((prev) => {
      const next = {};
      fileVersionGroups.forEach((group) => {
        const previousSelection = prev[group.key];
        next[group.key] = group.versions.some((version) => version.id === previousSelection)
          ? previousSelection
          : group.versions[0]?.id || "";
      });
      return next;
    });
  }, [fileVersionGroups]);

  const resetForm = () => {
    setForm({
      nomContrat: "",
      clientNom: "",
      branche: BRANCHES[0],
      lieu: "",
      statut: DEFAULT_STATUSES[0],
      dateDebut: "",
      dateFin: "",
      brief: "",
    });
    setAddTab("infos");
    setEditingId(null);
    setAddFiles([]);
  };

  const canSubmit = useMemo(() => {
    return String(form.nomContrat).trim() && String(form.clientNom).trim() && String(form.branche).trim();
  }, [form.nomContrat, form.clientNom, form.branche]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/contrats", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Erreur chargement contrats");

        if (!cancelled) {
          const mapped = (data.items || []).map((d) => normalizeContractFromApi(d));
          setItems(mapped);
        }
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openAdd = () => {
    resetForm();
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    resetForm();
  };

  const openEdit = (item) => {
    setForm({
      nomContrat: item?.nomContrat || "",
      clientNom: item?.clientNom || "",
      branche: item?.branche || BRANCHES[0],
      lieu: item?.lieu || "",
      statut: normalizeContractStatus(item?.statut),
      dateDebut: item?.dateDebut || "",
      dateFin: item?.dateFin || "",
      brief: item?.brief || "",
    });
    setEditingId(item?.id || null);
    setAddTab("infos");
    setAddFiles([]);
    setAddOpen(true);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = {
      nomContrat: form.nomContrat,
      clientNom: form.clientNom,
      branche: form.branche,
      lieu: form.lieu,
      statut: normalizeContractStatus(form.statut),
      dateDebut: form.dateDebut,
      dateFin: form.dateFin,
      brief: form.brief,
    };

    const isEdit = Boolean(editingId);
    const filesToUpload = addFiles;
    const url = isEdit ? `/api/contrats/${encodeURIComponent(String(editingId))}` : "/api/contrats";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`${data?.error || (isEdit ? "Erreur modification contrat" : "Erreur ajout contrat")}${data?.details ? " - " + data.details : ""}`);
      }

      let saved = normalizeContractFromApi(data.item);
      if (filesToUpload.length && saved?.id) {
        const uploadedFiles = await uploadContratFilesForId(saved.id, filesToUpload);
        saved = { ...saved, files: [...(saved.files || []), ...uploadedFiles] };
      }
      if (isEdit) {
        setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        setSelected((prev) => (prev?.id === saved.id ? saved : prev));
      } else {
        setItems((prev) => [saved, ...prev]);
      }
      closeAdd();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur sauvegarde contrat");
    }
  };

  const deleteContrat = async (id) => {
    const ok = window.confirm("Supprimer ce contrat ? Cette action est irreversible.");
    if (!ok) return;
    const removingCurrentDetail = selected?.id === String(id);

    const res = await fetch(`/api/contrats/${encodeURIComponent(String(id))}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur suppression contrat"}${data?.details ? " - " + data.details : ""}`);
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== String(id)));
    if (removingCurrentDetail) {
      closeDetail();
    }
  };

  const updateContratStatus = async (item, nextStatus) => {
    const normalizedStatus = normalizeContractStatus(nextStatus);
    if (!item?.id || !normalizedStatus || normalizedStatus === item.statut) return;

    try {
      const res = await fetch(`/api/contrats/${encodeURIComponent(String(item.id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: normalizedStatus }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`${data?.error || "Erreur modification statut"}${data?.details ? ` - ${data.details}` : ""}`);
      }

      const updated = normalizeContractFromApi(data.item);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur modification statut");
    }
  };

  const uploadContratFilesForId = async (contratId, fileList) => {
    if (!fileList?.length || !contratId) return [];
    const formData = new FormData();
    for (const file of fileList) formData.append("files", file);
    const res = await fetch(`/api/contrats/${encodeURIComponent(contratId)}/files`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Erreur upload");
    return data.items || [];
  };

  const uploadContratFiles = async (fileList) => {
    if (!fileList?.length || !selected?.id) return;
    setUploadingFiles(true);
    try {
      const newFiles = await uploadContratFilesForId(selected.id, fileList);
      setSelected((prev) => ({ ...prev, files: [...(prev.files || []), ...newFiles] }));
      setItems((prev) =>
        prev.map((item) =>
          item.id === selected.id ? { ...item, files: [...(item.files || []), ...newFiles] } : item
        )
      );
      if (newFiles.length) {
        setSelectedFileVersions((prev) => {
          const next = { ...prev };
          newFiles.forEach((file) => {
            const key = normalizeFileVersionKey(file?.name);
            if (key) next[key] = file.id;
          });
          return next;
        });
      }
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur upload fichiers");
    } finally {
      setUploadingFiles(false);
    }
  };

  const deleteContratFile = async (fileId) => {
    const ok = window.confirm("Supprimer ce fichier ?");
    if (!ok || !selected?.id) return;
    try {
      const res = await fetch(
        `/api/contrats/${encodeURIComponent(selected.id)}/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erreur suppression");
      }
      setSelected((prev) => ({ ...prev, files: (prev.files || []).filter((file) => file.id !== fileId) }));
      setItems((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? { ...item, files: (item.files || []).filter((file) => file.id !== fileId) }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur suppression fichier");
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        `${item.nomContrat || ""} ${item.clientNom || ""} ${item.lieu || ""} ${item.branche || ""} ${item.statut || ""} ${item.brief || ""}`
          .toLowerCase()
          .includes(q);
      const matchesBranche = filterBranche === "all" || item.branche === filterBranche;
      const matchesStatut = filterStatut === "all" || item.statut === filterStatut;
      return matchesSearch && matchesBranche && matchesStatut;
    });
  }, [items, search, filterBranche, filterStatut]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, filterBranche, filterStatut]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }, [totalPages]);

  const resetFilters = () => {
    setFilterBranche("all");
    setFilterStatut("all");
    setSearch("");
  };

  const openDetail = (item) => {
    setSelected(item);
    setDetailTab("infos");
    setSelectedFileVersions({});
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelected(null);
    setDetailTab("infos");
    setSelectedFileVersions({});
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Contrats / Projets</h1>
        <div className={styles.headerAction}>
        <button type="button" className={styles.addButton} onClick={openAdd}>
          + Nouveau Contrats
        </button>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.filters}>
          <div className={styles.filtersTop}>
            <div className={styles.filtersTitle}>Filtres</div>
            <button type="button" className={styles.resetBtn} onClick={resetFilters}>
              Reinitialiser
            </button>
          </div>

          <div className={styles.filterField}>
            <label className={styles.label}>Branche</label>
            <select className={styles.input} value={filterBranche} onChange={(e) => setFilterBranche(e.target.value)}>
              <option value="all">Toutes</option>
              {BRANCHES.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.label}>Statut</label>
            <select className={styles.input} value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
              <option value="all">Tous</option>
              {DEFAULT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <section className={styles.content}>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un contrat..."
            />
          </div>

          <div className={styles.cardsWrap}>
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className={styles.cardButton}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail(item);
                  }
                }}
              >
                <article className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardLeft}>
                      <div className={styles.cardName}>{item.nomContrat || "-"}</div>
                      <StatusDropdown
                        value={item.statut}
                        options={DEFAULT_STATUSES}
                        onChange={(nextStatus) => updateContratStatus(item, nextStatus)}
                        ariaLabel={`Statut de ${item.nomContrat || "contrat"}`}
                        inline
                      />
                      <span className={styles.branchPill}>{item.branche || "-"}</span>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        title="Modifier"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(item);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteContrat(item.id);
                        }}
                      >
                        ✖
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      <span className={styles.metaIcon}>📅</span>
                      {formatDate(item.dateDebut)} - {formatDate(item.dateFin)}
                    </span>
                    <span className={styles.metaItem}>
                      <span className={styles.metaIcon}>📍</span>
                      {item.lieu || "-"}
                    </span>
                    <span className={styles.metaItem}>
                      <span className={styles.metaIcon}>👤</span>
                      {item.clientNom || "-"}
                    </span>
                  </div>
                </article>
              </div>
            ))}

            {paginatedItems.length === 0 ? <div className={styles.empty}>Aucun contrat trouve.</div> : null}
          </div>

          <div className={styles.pagination}>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? styles.pageBtnActive : styles.pageBtn}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      </div>

      <Modal open={addOpen} title={editingId ? "Modifier le contrat" : "Nouveau contrat"} onClose={closeAdd} size="sm">
        <form className={styles.form} onSubmit={submitAdd}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={addTab === "infos" ? styles.tabActive : styles.tab}
              onClick={() => setAddTab("infos")}
            >
              Informations
            </button>
            <button
              type="button"
              className={addTab === "brief" ? styles.tabActive : styles.tab}
              onClick={() => setAddTab("brief")}
            >
              Brief
            </button>
          </div>

          {addTab === "infos" ? (
            <div className={styles.formGrid}>
              <div className={styles.fieldWide}>
                <label className={styles.label}>Nom du contrat *</label>
                <input className={styles.input} value={form.nomContrat} onChange={(e) => update("nomContrat", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Nom du client *</label>
                <input className={styles.input} value={form.clientNom} onChange={(e) => update("clientNom", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Branche *</label>
                <select className={styles.input} value={form.branche} onChange={(e) => update("branche", e.target.value)}>
                  {BRANCHES.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Lieu</label>
                <input className={styles.input} value={form.lieu} onChange={(e) => update("lieu", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Statut</label>
                <select className={styles.input} value={form.statut} onChange={(e) => update("statut", e.target.value)}>
                  {DEFAULT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Date de debut</label>
                <input className={styles.input} type="date" value={form.dateDebut} onChange={(e) => update("dateDebut", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Date de fin</label>
                <input className={styles.input} type="date" value={form.dateFin} onChange={(e) => update("dateFin", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className={styles.fieldWide}>
              <label className={styles.label}>Brief</label>
              <textarea
                className={styles.textarea}
                rows={12}
                value={form.brief}
                onChange={(e) => update("brief", e.target.value)}
                placeholder="Brief long..."
              />
              <div className={styles.uploadPanel}>
                <div className={styles.uploadPanelHeader}>
                  <span className={styles.label}>Fichiers</span>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => addFileInputRef.current?.click()}
                  >
                    + Ajouter des fichiers
                  </button>
                  <input
                    ref={addFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => { replaceAddFiles(e.target.files); e.target.value = ""; }}
                  />
                </div>
                {addFiles.length > 0 ? (
                  <div className={styles.uploadSummary}>
                    {addFiles.length} fichier{addFiles.length > 1 ? "s" : ""} prêt{addFiles.length > 1 ? "s" : ""} à être ajouté{addFiles.length > 1 ? "s" : ""}
                    <div className={styles.uploadList}>
                      {addFiles.map((file, index) => (
                        <span key={`${file.name}-${index}`} className={styles.uploadItem}>
                          {file.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.empty}>Aucun fichier sélectionné.</div>
                )}
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={closeAdd}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
              {editingId ? "Enregistrer" : "Ajouter le contrat"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={detailOpen} title={selected?.nomContrat || "Contrat"} onClose={closeDetail} size="md">
        {selected ? (
          <div className={styles.detailWrap}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={detailTab === "infos" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("infos")}
              >
                Informations
              </button>
              <button
                type="button"
                className={detailTab === "brief" ? styles.tabActive : styles.tab}
                onClick={() => setDetailTab("brief")}
              >
                Brief
              </button>
            </div>

            {detailTab === "infos" ? (
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Nom du contrat</div>
                  <div className={styles.v}>{selected.nomContrat || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Nom du client</div>
                  <div className={styles.v}>{selected.clientNom || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Branche</div>
                  <div className={styles.v}>{selected.branche || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Lieu</div>
                  <div className={styles.v}>{selected.lieu || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Statut</div>
                  <div className={styles.v}>{selected.statut || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Periode</div>
                  <div className={styles.v}>
                    {formatDate(selected.dateDebut)} - {formatDate(selected.dateFin)}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.briefTabWrap}>
                {String(selected.brief || "").trim() ? (
                  <div className={styles.briefBlock}>{selected.brief}</div>
                ) : (selected.files || []).length === 0 ? (
                  <div className={styles.briefBlock}>Aucun brief.</div>
                ) : null}

                <div className={styles.devisWrap}>
                  <div className={styles.devisHeader}>
                    <span className={styles.devisTotal}>
                      Fichiers du brief{(selected.files || []).length > 0 ? ` (${(selected.files || []).length})` : ""}
                    </span>
                    <button
                      type="button"
                      className={styles.addButton}
                      disabled={uploadingFiles}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingFiles ? "Upload..." : "+ Ajouter des fichiers"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => { uploadContratFiles(e.target.files); e.target.value = ""; }}
                    />
                  </div>

                  {fileVersionGroups.length === 0 && !uploadingFiles ? (
                    <div className={styles.empty}>
                      Aucun fichier. Cliquez sur &quot;+ Ajouter des fichiers&quot; pour commencer.
                    </div>
                  ) : (
                    <div className={styles.fichierGrid}>
                      {fileVersionGroups.map((group) => {
                        const selectedFileId = selectedFileVersions[group.key] || group.versions[0]?.id;
                        const file = group.versions.find((version) => version.id === selectedFileId) || group.versions[0];
                        const isImage = file?.mimeType?.startsWith("image/");
                        const isPdf = file?.mimeType === "application/pdf";
                        const fileUrl = `/api/contrats/${encodeURIComponent(selected.id)}/files/${encodeURIComponent(file?.id || "")}`;
                        if (!file) return null;

                        return (
                          <div key={group.key} className={styles.fichierCard}>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.fichierPreview}
                            >
                              {isImage ? (
                                <img src={fileUrl} alt={file.name} className={styles.fichierImg} loading="lazy" />
                              ) : (
                                <span className={styles.fichierIcon}>{isPdf ? "📄" : "📎"}</span>
                              )}
                            </a>
                            <div className={styles.fichierMeta}>
                              <span className={styles.fichierName} title={file.name}>{file.name}</span>
                              <span className={styles.fichierSize}>{formatFileSize(file.size)}</span>
                              {group.versions.length > 1 ? (
                                <div className={styles.fichierVersionRow}>
                                  <select
                                    className={`${styles.input} ${styles.fichierVersionSelect}`}
                                    value={file.id}
                                    onChange={(e) =>
                                      setSelectedFileVersions((prev) => ({ ...prev, [group.key]: e.target.value }))
                                    }
                                  >
                                    {group.versions.map((version) => (
                                      <option key={version.id} value={version.id}>
                                        {`Version ${version.displayVersion}`}
                                      </option>
                                    ))}
                                  </select>
                                  <span className={styles.fichierVersionDate}>{formatDateTime(file.uploadedAt)}</span>
                                </div>
                              ) : file.uploadedAt ? (
                                <span className={styles.fichierVersionDate}>{formatDateTime(file.uploadedAt)}</span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              title="Supprimer"
                              onClick={() => deleteContratFile(file.id)}
                            >
                              ✖
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
