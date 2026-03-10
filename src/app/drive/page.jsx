"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import styles from "./Drive.module.css";
import { PREDEFINED_FILE_GROUPS } from "../../lib/drive-constants";

const PREDEFINED_GROUPS = Object.values(PREDEFINED_FILE_GROUPS);
const KNOWN_EXTENSIONS = new Set(
  PREDEFINED_GROUPS.flatMap((group) => group.extensions).map((ext) => String(ext || "").trim().toLowerCase()),
);

function normalizeExt(value) {
  return String(value || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
}

function getExtFromName(name) {
  const value = String(name || "").trim();
  const idx = value.lastIndexOf(".");
  if (idx <= 0 || idx >= value.length - 1) return "";
  return normalizeExt(value.slice(idx + 1));
}

function formatBytes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let current = num;
  let idx = 0;
  while (current >= 1024 && idx < units.length - 1) {
    current /= 1024;
    idx += 1;
  }
  return `${current.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatUploadDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatPath(pathItems = []) {
  const names = pathItems.map((item) => item?.name).filter(Boolean);
  return names.join(" / ");
}

export default function DrivePage() {
  const [items, setItems] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [path, setPath] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(false);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  const [selectedGroups, setSelectedGroups] = useState(() =>
    PREDEFINED_GROUPS.reduce((acc, group) => {
      acc[group.key] = false;
      return acc;
    }, {}),
  );
  const [selectedDynamicExts, setSelectedDynamicExts] = useState({});

  const showFilters = Boolean(currentFolderId);

  const loadItems = async (folderId) => {
    const params = new URLSearchParams();
    if (folderId) params.set("parentId", String(folderId));
    const qs = params.toString();
    const url = qs ? `/api/drive?${qs}` : "/api/drive";

    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur chargement drive");
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPath(Array.isArray(data?.path) ? data.path : []);
      setCurrentFolder(data?.currentFolder || null);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur chargement drive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(currentFolderId);
  }, [currentFolderId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/drive/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Erreur recherche dossiers");
        if (!cancelled) {
          setSearchResults(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);


  const fileItems = useMemo(() => items.filter((item) => item.type === "file"), [items]);

  const dynamicExtensions = useMemo(() => {
    const set = new Set();
    for (const item of fileItems) {
      const ext = normalizeExt(item.ext || getExtFromName(item.name));
      if (!ext || KNOWN_EXTENSIONS.has(ext)) continue;
      set.add(ext);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [fileItems]);

  useEffect(() => {
    setSelectedDynamicExts((prev) => {
      const next = {};
      for (const ext of dynamicExtensions) {
        next[ext] = Boolean(prev[ext]);
      }
      return next;
    });
  }, [dynamicExtensions]);

  const activeExtFilters = useMemo(() => {
    const values = new Set();
    for (const group of PREDEFINED_GROUPS) {
      if (!selectedGroups[group.key]) continue;
      for (const ext of group.extensions) values.add(normalizeExt(ext));
    }
    for (const [ext, enabled] of Object.entries(selectedDynamicExts)) {
      if (enabled) values.add(normalizeExt(ext));
    }
    return values;
  }, [selectedGroups, selectedDynamicExts]);

  const visibleItems = useMemo(() => {
    if (!showFilters) return items;
    const hasFilters = activeExtFilters.size > 0;
    return items.filter((item) => {
      if (item.type === "folder") return true;
      if (!hasFilters) return true;
      const ext = normalizeExt(item.ext || getExtFromName(item.name));
      return activeExtFilters.has(ext);
    });
  }, [items, activeExtFilters, showFilters]);

  useEffect(() => {
    if (!highlightedItemId) return;
    const selectorId = highlightedItemId.replace(/"/g, '\\"');
    const node = document.querySelector(`[data-drive-item-id="${selectorId}"]`);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedItemId, items]);

  const canUploadFiles = Boolean(currentFolderId);

  const openCreateFolderModal = () => {
    setFolderName("");
    setFolderModalOpen(true);
  };

  const closeCreateFolderModal = (force = false) => {
    if (savingFolder && !force) return;
    setFolderModalOpen(false);
    setFolderName("");
  };

  const submitCreateFolder = async (e) => {
    e.preventDefault();
    const name = folderName.trim();
    if (!name) return;

    setSavingFolder(true);
    try {
      const res = await fetch("/api/drive/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parentId: currentFolderId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur creation dossier");
      closeCreateFolderModal(true);
      await loadItems(currentFolderId);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur creation dossier");
    } finally {
      setSavingFolder(false);
    }
  };

  const handleUploadClick = () => {
    if (!canUploadFiles) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!canUploadFiles || files.length === 0) return;

    const formData = new FormData();
    formData.append("parentId", String(currentFolderId));
    files.forEach((file) => formData.append("files", file));

    setUploading(true);
    try {
      const res = await fetch("/api/drive/files", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur upload fichiers");
      await loadItems(currentFolderId);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur upload fichiers");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openFolder = (folderId) => {
    if (!folderId) return;
    setCurrentFolderId(String(folderId));
  };

  const deleteItem = async (item) => {
    if (!item?.id) return;
    const label = item.type === "folder" ? "ce dossier" : "ce fichier";
    const ok = window.confirm(`Supprimer ${label} ? Cette action est irreversible.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/drive/${encodeURIComponent(String(item.id))}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur suppression");
      await loadItems(currentFolderId);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur suppression");
    }
  };

  const clearAllFilters = () => {
    setSelectedGroups(
      PREDEFINED_GROUPS.reduce((acc, group) => {
        acc[group.key] = false;
        return acc;
      }, {}),
    );
    setSelectedDynamicExts((prev) =>
      Object.keys(prev).reduce((acc, ext) => {
        acc[ext] = false;
        return acc;
      }, {}),
    );
  };

  const markItemTemporary = (itemId) => {
    const id = String(itemId || "").trim();
    if (!id) return;
    setHighlightedItemId(id);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedItemId((prev) => (prev === id ? null : prev));
      highlightTimeoutRef.current = null;
    }, 10000);
  };

  const openSearchResult = (result) => {
    if (!result?.id) return;
    clearAllFilters();
    if (result.highlightItemId) {
      markItemTemporary(result.highlightItemId);
    } else {
      setHighlightedItemId(null);
    }
    setCurrentFolderId(result.targetFolderId ? String(result.targetFolderId) : null);
    setSearch("");
    setSearchResults([]);
  };

  const resetFilters = () => {
    clearAllFilters();
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.title}>Drive</h1>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={openCreateFolderModal}>
            + Creer dossier
          </button>
          {canUploadFiles ? (
            <button type="button" className={styles.secondaryBtn} onClick={handleUploadClick} disabled={uploading}>
              {uploading ? "Upload..." : "+ Ajouter fichiers"}
            </button>
          ) : null}
          <input ref={fileInputRef} type="file" className={styles.hiddenInput} multiple onChange={handleFileInputChange} />
        </div>
      </div>

      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un dossier ou un fichier..."
        />

        {search.trim() ? (
          <div className={styles.searchResults}>
            {searchLoading ? <div className={styles.searchEmpty}>Recherche...</div> : null}
            {!searchLoading && searchResults.length === 0 ? <div className={styles.searchEmpty}>Aucun resultat.</div> : null}
            {!searchLoading
              ? searchResults.map((result) => (
                  <button key={`${result.type}-${result.id}`} type="button" className={styles.searchItem} onClick={() => openSearchResult(result)}>
                    <div className={styles.searchName}>
                      <span>{result.type === "folder" ? "📁" : "📄"}</span>
                      <span>{result.name || "Element"}</span>
                    </div>
                    <div className={styles.searchPath}>
                      {result.type === "folder" ? "Dossier" : "Fichier"}
                      {result.ext ? ` .${result.ext}` : ""}
                      {" - "}
                      {formatPath(result.path) || "Racine"}
                    </div>
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>

      <div className={styles.pathBar}>
        <button type="button" className={styles.pathBtn} onClick={() => setCurrentFolderId(null)}>
          Racine
        </button>
        {path.map((node) => (
          <React.Fragment key={node.id}>
            <span className={styles.pathSep}>/</span>
            <button type="button" className={styles.pathBtn} onClick={() => setCurrentFolderId(node.id)}>
              {node.name || "Dossier"}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className={showFilters ? styles.layout : `${styles.layout} ${styles.layoutNoFilters}`}>
        {showFilters ? (
          <aside className={styles.filters}>
            <div className={styles.filtersTop}>
              <h2 className={styles.filtersTitle}>Filtres fichiers</h2>
              <button type="button" className={styles.resetBtn} onClick={resetFilters}>
                Reinitialiser
              </button>
            </div>

            <div className={styles.checkList}>
              {PREDEFINED_GROUPS.map((group) => (
                <label key={group.key} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedGroups[group.key])}
                    onChange={(e) =>
                      setSelectedGroups((prev) => ({
                        ...prev,
                        [group.key]: e.target.checked,
                      }))
                    }
                  />
                  <span>{group.label}</span>
                </label>
              ))}

              {dynamicExtensions.length > 0 ? <div className={styles.filterDivider}>Autres extensions</div> : null}
              {dynamicExtensions.map((ext) => (
                <label key={ext} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedDynamicExts[ext])}
                    onChange={(e) =>
                      setSelectedDynamicExts((prev) => ({
                        ...prev,
                        [ext]: e.target.checked,
                      }))
                    }
                  />
                  <span>.{ext}</span>
                </label>
              ))}
              {dynamicExtensions.length === 0 ? <div className={styles.dynamicEmpty}>Aucun autre type.</div> : null}
            </div>
          </aside>
        ) : null}

        <section className={styles.content}>
          <div className={styles.contentHead}>
            <div className={styles.currentTitle}>{currentFolder?.name || "Racine"}</div>
            <div className={styles.count}>{visibleItems.length} element(s)</div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Taille</th>
                  <th>Date upload</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      Chargement...
                    </td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      Aucun dossier ou fichier.
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => {
                    const ext = normalizeExt(item.ext || getExtFromName(item.name));
                    return (
                      <tr
                        key={item.id}
                        data-drive-item-id={item.id}
                        className={`${item.type === "folder" ? styles.folderRow : ""} ${
                          highlightedItemId === item.id ? styles.highlightRow : ""
                        }`}
                        onClick={() => {
                          if (item.type === "folder") openFolder(item.id);
                        }}
                        title={item.type === "folder" ? "Cliquer pour ouvrir" : ""}
                      >
                        <td>
                          <div className={styles.nameCell}>
                            <span>{item.type === "folder" ? "📁" : "📄"}</span>
                            <span>{item.name || "-"}</span>
                          </div>
                        </td>
                        <td>{item.type === "folder" ? "Dossier" : ext ? `.${ext}` : "Fichier"}</td>
                        <td>{item.type === "folder" ? "-" : formatBytes(item.size)}</td>
                        <td>{item.type === "file" ? formatUploadDate(item.createdAt) : "-"}</td>
                        <td>
                          <div className={styles.actionsCell}>
                            {item.type === "file" ? (
                              <a
                                className={styles.downloadButton}
                                href={`/api/drive/files/${encodeURIComponent(item.id)}/download`}
                                onClick={(e) => e.stopPropagation()}
                                title="Telecharger"
                              >
                                ↓
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem(item);
                              }}
                              title="Supprimer"
                            >
                              X
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={folderModalOpen} title="Nouveau dossier" onClose={closeCreateFolderModal} size="sm">
        <form className={styles.form} onSubmit={submitCreateFolder}>
          <div className={styles.field}>
            <label className={styles.label}>Nom du dossier *</label>
            <input className={styles.input} value={folderName} onChange={(e) => setFolderName(e.target.value)} />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={closeCreateFolderModal} disabled={savingFolder}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn} disabled={savingFolder || !folderName.trim()}>
              {savingFolder ? "Creation..." : "Creer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

