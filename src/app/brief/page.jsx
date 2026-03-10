"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import styles from "../contrats/Contrats.module.css";

const BRANCHES = ["Agency", "CreativeGen", "Enterntainement", "SFX"];
const BRIEF_STATUSES = ["Nouveau", "En cours", "Abandonne", "Converti"];
const DEFAULT_CONTRAT_STATUT = "Brouillon";
const PAGE_SIZE = 5;

function normalizeId(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const oid = value?.$oid;
    if (typeof oid === "string" && oid.trim()) return oid.trim();
    if (typeof value.toString === "function") {
      const raw = value.toString();
      if (raw && raw !== "[object Object]") return raw;
    }
  }
  return String(value);
}

function toSafeNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(2)} EUR`;
}

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

function formatFileSize(bytes) {
  if (!bytes) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
        const explicitA = toSafeNumber(a?.versionNumber, null);
        const explicitB = toSafeNumber(b?.versionNumber, null);
        if (explicitA !== null && explicitB !== null && explicitA !== explicitB) return explicitA - explicitB;
        const timeDiff = getDateTimestamp(a?.uploadedAt) - getDateTimestamp(b?.uploadedAt);
        if (timeDiff !== 0) return timeDiff;
        return String(a?.id || "").localeCompare(String(b?.id || ""));
      });

      const versions = chronological
        .map((file, index) => ({
          ...file,
          displayVersion: toSafeNumber(file?.versionNumber, index + 1) || index + 1,
        }))
        .sort((a, b) => {
          const versionDiff = (b.displayVersion || 0) - (a.displayVersion || 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateTimestamp(b?.uploadedAt) - getDateTimestamp(a?.uploadedAt);
        });

      return {
        key: group.key,
        name: String(versions[0]?.name || ""),
        versions,
        latestUploadedAt: versions[0]?.uploadedAt || null,
      };
    })
    .sort((a, b) => getDateTimestamp(b.latestUploadedAt) - getDateTimestamp(a.latestUploadedAt));
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintHtml({ title, meta, body }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; color: #0f172a; padding: 32px; }
    h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; font-size: 11px; font-weight: 800; color: #64748b; padding: 6px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tfoot td { border-top: 2px solid #e2e8f0; border-bottom: 0; padding-top: 10px; }
    .partie { margin-bottom: 28px; }
    .partie-header { font-size: 15px; font-weight: 800; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #0f172a; display: flex; gap: 12px; align-items: center; }
    .assigne { font-size: 11px; font-weight: 700; background: rgba(14,165,233,0.12); border: 1px solid rgba(14,165,233,0.25); color: #0c4a6e; border-radius: 999px; padding: 2px 8px; }
    .partie-total { margin-left: auto; font-size: 13px; font-weight: 700; }
    .grand-total { font-size: 14px; font-weight: 700; text-align: right; margin-top: 8px; padding-top: 12px; border-top: 2px solid #0f172a; }
    .empty { color: #94a3b8; font-size: 12px; padding: 4px 0; }
    a { color: #0284c7; word-break: break-all; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${meta}</div>
  ${body}
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

function openPrint(html) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Autorisez les popups pour exporter en PDF."); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function statusClass(statut) {
  const lower = String(statut || "").toLowerCase();
  if (lower.includes("cours")) return "statusBlue";
  if (lower.includes("converti")) return "statusGreen";
  if (lower.includes("abandon")) return "statusGray";
  if (lower.includes("nouveau")) return "statusOrange";
  return "statusPurple";
}

function StatusDropdown({ value, onChange, disabled = false, ariaLabel = "Statut", inline = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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
          <span className={`${styles.statusPill} ${styles[statusClass(value)]} ${styles.statusPillWithChevron}`}>
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
          {BRIEF_STATUSES.map((status) => {
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

function normalizeBriefFromApi(raw = {}) {
  return {
    id: normalizeId(raw?._id || raw?.id || ""),
    nomBrief: String(raw?.nomBrief || "").trim(),
    clientNom: String(raw?.clientNom || "").trim(),
    branche: String(raw?.branche || BRANCHES[0]).trim() || BRANCHES[0],
    budget: toSafeNumber(raw?.budget, null),
    contenuBrief: String(raw?.contenuBrief || "").trim(),
    statut: String(raw?.statut || "Nouveau").trim() || "Nouveau",
    convertedContratId: String(raw?.convertedContratId || "").trim(),
    devis: Array.isArray(raw?.devis) ? raw.devis : [],
    devisDetaille: Array.isArray(raw?.devisDetaille) ? raw.devisDetaille : [],
    files: Array.isArray(raw?.files) ? raw.files : [],
    versions: Array.isArray(raw?.versions) ? raw.versions : [],
  };
}

function createEmptyForm() {
  return {
    nomBrief: "",
    clientNom: "",
    branche: BRANCHES[0],
    budget: "",
    contenuBrief: "",
    statut: "Nouveau",
  };
}

function createConvertForm(brief) {
  return {
    nomContrat: String(brief?.nomBrief || "").trim(),
    clientNom: String(brief?.clientNom || "").trim(),
    branche: String(brief?.branche || BRANCHES[0]).trim() || BRANCHES[0],
    lieu: "",
    statut: DEFAULT_CONTRAT_STATUT,
    dateDebut: "",
    dateFin: "",
    brief: String(brief?.contenuBrief || "").trim(),
  };
}

function listFromFileInput(fileList) {
  return Array.from(fileList || []).filter(Boolean);
}

export default function BriefPage() {
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

  const [converting, setConverting] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertForm, setConvertForm] = useState(() => createConvertForm(null));
  const [form, setForm] = useState(() => createEmptyForm());

  const [devisFormOpen, setDevisFormOpen] = useState(false);
  const [devisEditId, setDevisEditId] = useState(null);
  const [devisForm, setDevisForm] = useState({ nom: "", assigneAKey: "", prixEstime: "" });
  const [assignOptions, setAssignOptions] = useState({ users: [], roles: [], loaded: false });

  const [openPartiesMap, setOpenPartiesMap] = useState({});
  const [addingLigne, setAddingLigne] = useState(null);
  const [editingLigneId, setEditingLigneId] = useState(null);
  const [editingLigneData, setEditingLigneData] = useState(null);

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFileVersions, setSelectedFileVersions] = useState({});
  const fileInputRef = useRef(null);
  const addFileInputRef = useRef(null);
  const [addFiles, setAddFiles] = useState([]);
  const fileVersionGroups = useMemo(() => buildFileVersionGroups(selected?.files || []), [selected?.files]);

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

  useEffect(() => {
    if (!devisFormOpen || assignOptions.loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setAssignOptions({ users: data.users || [], roles: data.roles || [], loaded: true });
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [devisFormOpen, assignOptions.loaded]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateDevisForm = (key, value) => setDevisForm((prev) => ({ ...prev, [key]: value }));
  const togglePartie = (id) => setOpenPartiesMap((prev) => ({ ...prev, [id]: !prev[id] }));
  const replaceAddFiles = (fileList) => {
    const nextFiles = listFromFileInput(fileList);
    if (!nextFiles.length) return;
    setAddFiles((prev) => [...prev, ...nextFiles]);
  };

  const saveDevis = async (newDevis) => {
    try {
      const updated = await patchBrief(selected.id, { devis: newDevis });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur sauvegarde devis");
    }
  };

  const uploadBriefFilesForId = async (briefId, fileList) => {
    if (!fileList?.length || !briefId) return [];
    const formData = new FormData();
    for (const file of fileList) formData.append("files", file);
    const res = await fetch(`/api/briefs/${encodeURIComponent(briefId)}/files`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Erreur upload");
    return data.items || [];
  };

  const printDevis = () => {
    if (!selected) return;
    const parties = selected.devis || [];
    const total = parties.reduce((sum, p) => sum + (toSafeNumber(p.prixEstime) || 0), 0);
    const rows = parties
      .map(
        (p) => `<tr>
          <td>${escHtml(p.nom)}</td>
          <td>${escHtml(p.assigneA || "—")}</td>
          <td style="text-align:right">${escHtml(formatMoney(p.prixEstime))}</td>
        </tr>`
      )
      .join("");
    const html = buildPrintHtml({
      title: `Devis — ${escHtml(selected.nomBrief)}`,
      meta: `${escHtml(selected.nomBrief)} · ${escHtml(selected.clientNom)} · ${escHtml(selected.branche)}`,
      body: `<table>
        <thead><tr><th>Partie</th><th>Assigné à</th><th style="text-align:right">Prix estimé</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="2"><strong>Total estimé</strong></td>
          <td style="text-align:right"><strong>${escHtml(formatMoney(total))}</strong></td>
        </tr></tfoot>
      </table>`,
    });
    openPrint(html);
  };

  const printDevisDetaille = () => {
    if (!selected) return;
    const parties = selected.devis || [];
    const allLignes = selected.devisDetaille || [];
    const grandTotal = allLignes.reduce(
      (sum, l) => sum + (toSafeNumber(l.quantite) || 1) * (toSafeNumber(l.prixUnitaire) || 0),
      0
    );
    const sections = parties
      .map((partie) => {
        const lignes = allLignes.filter((l) => l.partieId === partie.id);
        const partieTotal = lignes.reduce(
          (sum, l) => sum + (toSafeNumber(l.quantite) || 1) * (toSafeNumber(l.prixUnitaire) || 0),
          0
        );
        const rows = lignes
          .map(
            (l) => `<tr>
            <td>${escHtml(l.nom)}</td>
            <td style="text-align:center">${toSafeNumber(l.quantite) ?? 1}</td>
            <td style="text-align:right">${escHtml(formatMoney(toSafeNumber(l.prixUnitaire) || 0))}</td>
            <td style="text-align:right">${escHtml(formatMoney((toSafeNumber(l.quantite) || 1) * (toSafeNumber(l.prixUnitaire) || 0)))}</td>
            <td>${l.lien ? `<a href="${escHtml(l.lien)}">${escHtml(l.lien)}</a>` : "—"}</td>
            <td>${escHtml(l.notes || "—")}</td>
          </tr>`
          )
          .join("");
        return `<div class="partie">
          <div class="partie-header">
            ${escHtml(partie.nom)}
            ${partie.assigneA ? `<span class="assigne">${escHtml(partie.assigneA)}</span>` : ""}
            <span class="partie-total">${escHtml(formatMoney(partieTotal))}</span>
          </div>
          ${
            lignes.length > 0
              ? `<table>
              <thead><tr><th>Composant</th><th>Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Total</th><th>Lien</th><th>Notes</th></tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr>
                <td colspan="3"><strong>Sous-total ${escHtml(partie.nom)}</strong></td>
                <td style="text-align:right"><strong>${escHtml(formatMoney(partieTotal))}</strong></td>
                <td colspan="2"></td>
              </tr></tfoot>
            </table>`
              : `<p class="empty">Aucun composant.</p>`
          }
        </div>`;
      })
      .join("");
    const html = buildPrintHtml({
      title: `Devis Détaillé — ${escHtml(selected.nomBrief)}`,
      meta: `${escHtml(selected.nomBrief)} · ${escHtml(selected.clientNom)} · ${escHtml(selected.branche)}`,
      body: `${sections}<div class="grand-total">Total général : <strong>${escHtml(formatMoney(grandTotal))}</strong></div>`,
    });
    openPrint(html);
  };

  const uploadBriefFiles = async (fileList) => {
    if (!fileList?.length || !selected?.id) return;
    setUploadingFiles(true);
    try {
      const newFiles = await uploadBriefFilesForId(selected.id, fileList);
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
    } catch (err) {
      console.error(err);
      alert(err?.message || "Erreur upload fichiers");
    } finally {
      setUploadingFiles(false);
    }
  };

  const deleteBriefFile = async (fileId) => {
    const ok = window.confirm("Supprimer ce fichier ?");
    if (!ok || !selected?.id) return;
    try {
      const res = await fetch(
        `/api/briefs/${encodeURIComponent(selected.id)}/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erreur suppression");
      }
      setSelected((prev) => ({ ...prev, files: (prev.files || []).filter((f) => f.id !== fileId) }));
      setItems((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? { ...item, files: (item.files || []).filter((f) => f.id !== fileId) }
            : item
        )
      );
    } catch (err) {
      console.error(err);
      alert(err?.message || "Erreur suppression fichier");
    }
  };

  const saveDevisDetaille = async (newDevisDetaille) => {
    try {
      const updated = await patchBrief(selected.id, { devisDetaille: newDevisDetaille });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur sauvegarde devis détaillé");
    }
  };

  const openAddDevisPartie = () => {
    setDevisForm({ nom: "", assigneAKey: "", prixEstime: "" });
    setDevisEditId(null);
    setDevisFormOpen(true);
  };

  const openEditDevisPartie = (partie) => {
    let assigneAKey = "";
    if (partie.assigneAType === "user" && partie.assigneAId) assigneAKey = `user:${partie.assigneAId}`;
    else if (partie.assigneAType === "role" && partie.assigneAId) assigneAKey = `role:${partie.assigneAId}`;
    setDevisForm({
      nom: partie.nom || "",
      assigneAKey,
      prixEstime: partie.prixEstime === null || partie.prixEstime === undefined ? "" : String(partie.prixEstime),
    });
    setDevisEditId(partie.id);
    setDevisFormOpen(true);
  };

  const parseAssigneAKey = (key) => {
    if (!key) return { assigneA: "", assigneAId: null, assigneAType: null };
    const colonIdx = key.indexOf(":");
    if (colonIdx === -1) return { assigneA: "", assigneAId: null, assigneAType: null };
    const type = key.slice(0, colonIdx);
    const id = key.slice(colonIdx + 1);
    if (type === "user") {
      const user = assignOptions.users.find((u) => u.id === id);
      return { assigneA: user?.name || id, assigneAId: id, assigneAType: "user" };
    }
    if (type === "role") {
      const role = assignOptions.roles.find((r) => r.name === id);
      return { assigneA: role?.label || id, assigneAId: id, assigneAType: "role" };
    }
    return { assigneA: "", assigneAId: null, assigneAType: null };
  };

  const submitDevisPartie = async (e) => {
    e.preventDefault();
    if (!devisForm.nom.trim()) return;
    const { assigneA, assigneAId, assigneAType } = parseAssigneAKey(devisForm.assigneAKey);
    const existing = selected?.devis || [];
    if (devisEditId) {
      const newDevis = existing.map((p) =>
        p.id === devisEditId
          ? { ...p, nom: devisForm.nom.trim(), assigneA, assigneAId, assigneAType, prixEstime: toSafeNumber(devisForm.prixEstime, null) }
          : p
      );
      await saveDevis(newDevis);
    } else {
      await saveDevis([...existing, { id: genId(), nom: devisForm.nom.trim(), assigneA, assigneAId, assigneAType, prixEstime: toSafeNumber(devisForm.prixEstime, null) }]);
    }
    setDevisFormOpen(false);
    setDevisEditId(null);
  };

  const deleteDevisPartie = async (partieId) => {
    const ok = window.confirm("Supprimer cette partie ? Les composants associés seront aussi supprimés.");
    if (!ok) return;
    const newDevis = (selected?.devis || []).filter((p) => p.id !== partieId);
    const newDevisDetaille = (selected?.devisDetaille || []).filter((l) => l.partieId !== partieId);
    try {
      const updated = await patchBrief(selected.id, { devis: newDevis, devisDetaille: newDevisDetaille });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur suppression partie");
    }
  };

  const startAddLigne = (partieId) => {
    setAddingLigne({ partieId, nom: "", quantite: "1", prixUnitaire: "", lien: "", notes: "" });
    setEditingLigneId(null);
    setEditingLigneData(null);
    setOpenPartiesMap((prev) => ({ ...prev, [partieId]: true }));
  };

  const updateAddingLigne = (key, value) => setAddingLigne((prev) => (prev ? { ...prev, [key]: value } : null));

  const confirmAddLigne = async () => {
    if (!addingLigne || !addingLigne.nom.trim()) return;
    const existing = selected?.devisDetaille || [];
    await saveDevisDetaille([
      ...existing,
      {
        id: genId(),
        partieId: addingLigne.partieId,
        nom: addingLigne.nom.trim(),
        quantite: toSafeNumber(addingLigne.quantite, 1),
        prixUnitaire: toSafeNumber(addingLigne.prixUnitaire, null),
        lien: addingLigne.lien.trim(),
        notes: addingLigne.notes.trim(),
      },
    ]);
    setAddingLigne(null);
  };

  const startEditLigne = (ligne) => {
    setEditingLigneId(ligne.id);
    setEditingLigneData({
      nom: ligne.nom || "",
      quantite: ligne.quantite === null || ligne.quantite === undefined ? "1" : String(ligne.quantite),
      prixUnitaire: ligne.prixUnitaire === null || ligne.prixUnitaire === undefined ? "" : String(ligne.prixUnitaire),
      lien: ligne.lien || "",
      notes: ligne.notes || "",
    });
    setAddingLigne(null);
  };

  const updateEditingLigne = (key, value) => setEditingLigneData((prev) => (prev ? { ...prev, [key]: value } : null));

  const confirmEditLigne = async () => {
    if (!editingLigneId || !editingLigneData || !editingLigneData.nom.trim()) return;
    const existing = selected?.devisDetaille || [];
    await saveDevisDetaille(
      existing.map((l) =>
        l.id === editingLigneId
          ? {
              ...l,
              nom: editingLigneData.nom.trim(),
              quantite: toSafeNumber(editingLigneData.quantite, 1),
              prixUnitaire: toSafeNumber(editingLigneData.prixUnitaire, null),
              lien: editingLigneData.lien.trim(),
              notes: editingLigneData.notes.trim(),
            }
          : l
      )
    );
    setEditingLigneId(null);
    setEditingLigneData(null);
  };

  const deleteDevisDetailleLigne = async (ligneId) => {
    const ok = window.confirm("Supprimer ce composant ?");
    if (!ok) return;
    await saveDevisDetaille((selected?.devisDetaille || []).filter((l) => l.id !== ligneId));
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setAddTab("infos");
    setEditingId(null);
    setAddFiles([]);
  };

  const canSubmit = useMemo(() => {
    return String(form.nomBrief).trim() && String(form.clientNom).trim() && String(form.branche).trim();
  }, [form.nomBrief, form.clientNom, form.branche]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/briefs", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Erreur chargement briefs");
        if (cancelled) return;
        const mapped = (data.items || []).map((item) => normalizeBriefFromApi(item));
        setItems(mapped);
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const patchBrief = async (id, changes) => {
    const res = await fetch(`/api/briefs/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`${data?.error || "Erreur modification brief"}${data?.details ? ` - ${data.details}` : ""}`);
    }
    return normalizeBriefFromApi(data.item);
  };

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
      nomBrief: item?.nomBrief || "",
      clientNom: item?.clientNom || "",
      branche: item?.branche || BRANCHES[0],
      budget: item?.budget === null || item?.budget === undefined ? "" : String(item.budget),
      contenuBrief: item?.contenuBrief || "",
      statut: item?.statut || "Nouveau",
    });
    setEditingId(item?.id || null);
    setAddTab("infos");
    setAddFiles([]);
    setAddOpen(true);
  };

  const openDetail = (item) => {
    setSelected(item);
    setDetailTab("infos");
    setDevisFormOpen(false);
    setDevisEditId(null);
    setAddingLigne(null);
    setEditingLigneId(null);
    setEditingLigneData(null);
    setVersionsOpen(false);
    setSelectedFileVersions({});
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelected(null);
    setDetailTab("infos");
    setDevisFormOpen(false);
    setDevisEditId(null);
    setAddingLigne(null);
    setEditingLigneId(null);
    setEditingLigneData(null);
    setOpenPartiesMap({});
    setVersionsOpen(false);
    setSelectedFileVersions({});
  };

  const openConvertModal = (brief) => {
    if (!brief?.id) return;
    setConvertTarget(brief);
    setConvertForm(createConvertForm(brief));
    setConvertOpen(true);
  };

  const closeConvertModal = (force = false) => {
    if (converting && !force) return;
    setConvertOpen(false);
    setConvertTarget(null);
    setConvertForm(createConvertForm(null));
  };

  const updateConvert = (key, value) => {
    setConvertForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmitConversion = useMemo(() => {
    return (
      String(convertForm.nomContrat || "").trim() &&
      String(convertForm.clientNom || "").trim() &&
      String(convertForm.branche || "").trim()
    );
  }, [convertForm.nomContrat, convertForm.clientNom, convertForm.branche]);

  const submitConversion = async (e) => {
    e.preventDefault();
    if (converting) return;
    const target = convertTarget;
    if (!target?.id) return;

    const contractPayload = {
      nomContrat: String(convertForm.nomContrat || "").trim(),
      clientNom: String(convertForm.clientNom || "").trim(),
      branche: String(convertForm.branche || BRANCHES[0]).trim() || BRANCHES[0],
      lieu: String(convertForm.lieu || "").trim(),
      statut: String(convertForm.statut || DEFAULT_CONTRAT_STATUT).trim() || DEFAULT_CONTRAT_STATUT,
      dateDebut: String(convertForm.dateDebut || "").trim(),
      dateFin: String(convertForm.dateFin || "").trim(),
      brief: String(convertForm.brief || "").trim(),
      sourceBriefId: target.id,
    };

    if (!contractPayload.nomContrat || !contractPayload.clientNom || !contractPayload.branche) {
      alert("Renseigne les informations obligatoires pour convertir ce brief.");
      return;
    }

    try {
      setConverting(true);

      const resContract = await fetch("/api/contrats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contractPayload),
      });
      const dataContract = await resContract.json().catch(() => null);
      if (!resContract.ok) {
        throw new Error(
          `${dataContract?.error || "Erreur conversion vers contrat"}${dataContract?.details ? ` - ${dataContract.details}` : ""}`
        );
      }

      const contractId = normalizeId(dataContract?.item?._id || dataContract?.item?.id || "");
      const updated = await patchBrief(target.id, {
        statut: "Converti",
        convertedContratId: contractId,
      });

      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
      closeConvertModal(true);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur lors de la conversion");
    } finally {
      setConverting(false);
    }
  };

  const updateStatus = async (item, nextStatus) => {
    if (!item?.id || nextStatus === item.statut) return;

    if (nextStatus === "Converti" && !item.convertedContratId) {
      openConvertModal(item);
      return;
    }

    try {
      const updated = await patchBrief(item.id, { statut: nextStatus });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur changement de statut");
    }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = {
      nomBrief: String(form.nomBrief || "").trim(),
      clientNom: String(form.clientNom || "").trim(),
      branche: String(form.branche || BRANCHES[0]).trim() || BRANCHES[0],
      budget: form.budget === "" ? null : toSafeNumber(form.budget, null),
      contenuBrief: String(form.contenuBrief || "").trim(),
      statut: String(form.statut || "Nouveau").trim() || "Nouveau",
    };

    const isEdit = Boolean(editingId);
    const filesToUpload = addFiles;

    try {
      let saved = null;

      if (isEdit) {
        saved = await patchBrief(editingId, payload);
      } else {
        const res = await fetch("/api/briefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(`${data?.error || "Erreur creation brief"}${data?.details ? ` - ${data.details}` : ""}`);
        }

        saved = normalizeBriefFromApi(data.item);
      }

      if (filesToUpload.length && saved?.id) {
        const uploadedFiles = await uploadBriefFilesForId(saved.id, filesToUpload);
        saved = { ...saved, files: [...(saved.files || []), ...uploadedFiles] };
      }

      if (isEdit) {
        setItems((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
        setSelected((prev) => (prev?.id === saved.id ? saved : prev));
      } else {
        setItems((prev) => [saved, ...prev]);
      }

      closeAdd();
      if (payload.statut === "Converti" && !saved.convertedContratId) {
        openConvertModal(saved);
      }
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur sauvegarde brief");
    }
  };

  const deleteBrief = async (id) => {
    const ok = window.confirm("Supprimer ce brief ? Cette action est irreversible.");
    if (!ok) return;
    const removingCurrentDetail = selected?.id === String(id);

    try {
      const res = await fetch(`/api/briefs/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`${data?.error || "Erreur suppression brief"}${data?.details ? ` - ${data.details}` : ""}`);
      }

      setItems((prev) => prev.filter((item) => item.id !== String(id)));
      if (removingCurrentDetail) closeDetail();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Erreur suppression");
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        `${item.nomBrief || ""} ${item.clientNom || ""} ${item.branche || ""} ${item.statut || ""} ${item.contenuBrief || ""}`
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

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Brief & Devis</h1>
        <div className={styles.headerAction}>
          <button type="button" className={styles.addButton} onClick={openAdd}>
            + Nouveau Brief & Devis
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
              {BRIEF_STATUSES.map((status) => (
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
              placeholder="Rechercher un brief..."
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
                      <div className={styles.cardName}>{item.nomBrief || "-"}</div>
                      <StatusDropdown
                        value={item.statut}
                        onChange={(nextStatus) => updateStatus(item, nextStatus)}
                        ariaLabel={`Statut de ${item.nomBrief || "brief"}`}
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
                          deleteBrief(item.id);
                        }}
                      >
                        ✖
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      <span className={styles.metaIcon}>👤</span>
                      {item.clientNom || "-"}
                    </span>
                    <span className={styles.metaItem}>
                      <span className={styles.metaIcon}>💰</span>
                      {formatMoney(item.budget)}
                    </span>
                    <span className={styles.metaItem}>
                      <span className={styles.metaIcon}>📝</span>
                      {item.contenuBrief || "-"}
                    </span>
                  </div>
                </article>
              </div>
            ))}

            {paginatedItems.length === 0 ? <div className={styles.empty}>Aucun brief trouve.</div> : null}
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

      <Modal open={addOpen} title={editingId ? "Modifier le brief" : "Nouveau brief"} onClose={closeAdd} size="sm">
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
                <label className={styles.label}>Nom *</label>
                <input className={styles.input} value={form.nomBrief} onChange={(e) => update("nomBrief", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Client *</label>
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
                <label className={styles.label}>Budget</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => update("budget", e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Statut</label>
                <StatusDropdown
                  value={form.statut}
                  onChange={(nextStatus) => update("statut", nextStatus)}
                  ariaLabel="Statut du brief"
                />
              </div>
            </div>
          ) : (
            <div className={styles.fieldWide}>
              <label className={styles.label}>Contenu du brief</label>
              <textarea
                className={styles.textarea}
                rows={12}
                value={form.contenuBrief}
                onChange={(e) => update("contenuBrief", e.target.value)}
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
              {editingId ? "Enregistrer" : "Ajouter le brief"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={detailOpen} title={selected?.nomBrief || "Brief"} onClose={closeDetail} size="md">
        {selected ? (
          <div className={styles.detailWrap}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={detailTab === "infos" ? styles.tabActive : styles.tab}
                onClick={() => { setDetailTab("infos"); setDevisFormOpen(false); setAddingLigne(null); setEditingLigneId(null); }}
              >
                Informations
              </button>
              <button
                type="button"
                className={detailTab === "brief" ? styles.tabActive : styles.tab}
                onClick={() => { setDetailTab("brief"); setDevisFormOpen(false); setAddingLigne(null); setEditingLigneId(null); }}
              >
                Brief
              </button>
              <button
                type="button"
                className={detailTab === "devis" ? styles.tabActive : styles.tab}
                onClick={() => { setDetailTab("devis"); setAddingLigne(null); setEditingLigneId(null); }}
              >
                Devis
              </button>
              <button
                type="button"
                className={detailTab === "devisDetaille" ? styles.tabActive : styles.tab}
                onClick={() => { setDetailTab("devisDetaille"); setDevisFormOpen(false); }}
              >
                Devis Détaillé
              </button>
            </div>

            {detailTab === "infos" ? (
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Nom</div>
                  <div className={styles.v}>{selected.nomBrief || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Client</div>
                  <div className={styles.v}>{selected.clientNom || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Branche</div>
                  <div className={styles.v}>{selected.branche || "-"}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Budget</div>
                  <div className={styles.v}>{formatMoney(selected.budget)}</div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Statut</div>
                  <div className={styles.v}>
                    <StatusDropdown
                      value={selected.statut}
                      onChange={(nextStatus) => updateStatus(selected, nextStatus)}
                      ariaLabel={`Statut de ${selected.nomBrief || "brief"}`}
                    />
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.k}>Contrat converti</div>
                  <div className={styles.v}>{selected.convertedContratId || "-"}</div>
                </div>
              </div>
            ) : null}

            {detailTab === "brief" ? (
              <div className={styles.briefTabWrap}>
                {String(selected.contenuBrief || "").trim() ? (
                  <div className={styles.briefBlock}>{selected.contenuBrief}</div>
                ) : (selected.files || []).length === 0 ? (
                  <div className={styles.briefBlock}>Aucun contenu.</div>
                ) : null}

                {(selected.versions || []).length > 0 ? (
                  <div className={styles.versionsWrap}>
                    <button
                      type="button"
                      className={styles.versionsToggle}
                      onClick={() => setVersionsOpen((prev) => !prev)}
                    >
                      {versionsOpen ? "▼" : "▶"} Versions précédentes ({(selected.versions || []).length})
                    </button>
                    {versionsOpen ? (
                      <div className={styles.versionsList}>
                        {[...(selected.versions || [])].reverse().map((v, idx) => (
                          <div key={v.id || idx} className={styles.versionItem}>
                            <div className={styles.versionMeta}>
                              Version {(selected.versions || []).length - idx} &middot; {formatDate(v.createdAt)}
                            </div>
                            <div className={styles.versionPreview}>
                              {v.contenu?.slice(0, 180)}{(v.contenu?.length || 0) > 180 ? "…" : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                      onChange={(e) => { uploadBriefFiles(e.target.files); e.target.value = ""; }}
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
                        const fileUrl = `/api/briefs/${encodeURIComponent(selected.id)}/files/${encodeURIComponent(file?.id || "")}`;
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
                                  <span className={styles.fichierVersionDate}>
                                    {formatDate(file.uploadedAt)}
                                  </span>
                                </div>
                              ) : file.uploadedAt ? (
                                <span className={styles.fichierVersionDate}>
                                  {formatDate(file.uploadedAt)}
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              title="Supprimer"
                              onClick={() => deleteBriefFile(file.id)}
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
            ) : null}

            {detailTab === "devis" ? (
              <div className={styles.devisWrap}>
                <div className={styles.devisHeader}>
                  <span className={styles.devisTotal}>
                    Total estimé :{" "}
                    {formatMoney((selected.devis || []).reduce((sum, p) => sum + (toSafeNumber(p.prixEstime) || 0), 0))}
                  </span>
                  <div className={styles.partieActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={printDevis}>
                      Exporter PDF
                    </button>
                    <button type="button" className={styles.addButton} onClick={openAddDevisPartie}>
                      + Ajouter une partie
                    </button>
                  </div>
                </div>

                {devisFormOpen ? (
                  <form className={styles.devisInlineForm} onSubmit={submitDevisPartie}>
                    <div className={styles.field}>
                      <label className={styles.label}>Nom de la partie *</label>
                      <input
                        className={styles.input}
                        placeholder="ex : Construction, Électronique…"
                        value={devisForm.nom}
                        onChange={(e) => updateDevisForm("nom", e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Assigné à</label>
                      <select
                        className={styles.input}
                        value={devisForm.assigneAKey}
                        onChange={(e) => updateDevisForm("assigneAKey", e.target.value)}
                      >
                        <option value="">Non assigné</option>
                        {assignOptions.users.length > 0 ? (
                          <optgroup label="Utilisateurs">
                            {assignOptions.users.map((u) => (
                              <option key={u.id} value={`user:${u.id}`}>{u.name}</option>
                            ))}
                          </optgroup>
                        ) : null}
                        {assignOptions.roles.length > 0 ? (
                          <optgroup label="Rôles">
                            {assignOptions.roles.map((r) => (
                              <option key={r.name} value={`role:${r.name}`}>{r.label}</option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Prix estimé (EUR)</label>
                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={devisForm.prixEstime}
                        onChange={(e) => updateDevisForm("prixEstime", e.target.value)}
                      />
                    </div>
                    <div className={styles.devisInlineActions}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => { setDevisFormOpen(false); setDevisEditId(null); }}
                      >
                        Annuler
                      </button>
                      <button type="submit" className={styles.submitBtn} disabled={!devisForm.nom.trim()}>
                        {devisEditId ? "Enregistrer" : "Ajouter"}
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className={styles.partiesList}>
                  {(selected.devis || []).map((partie) => (
                    <div key={partie.id} className={styles.partieRow}>
                      <div className={styles.partieNom}>{partie.nom}</div>
                      <div className={styles.partieAssigne}>
                        {partie.assigneA ? (
                          <span className={styles.assignePill}>{partie.assigneA}</span>
                        ) : (
                          <span className={styles.partieAssigneVide}>Non assigné</span>
                        )}
                      </div>
                      <div className={styles.partiePrix}>{formatMoney(partie.prixEstime)}</div>
                      <div className={styles.partieActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Modifier"
                          onClick={() => openEditDevisPartie(partie)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          title="Supprimer"
                          onClick={() => deleteDevisPartie(partie.id)}
                        >
                          ✖
                        </button>
                      </div>
                    </div>
                  ))}
                  {(selected.devis || []).length === 0 ? (
                    <div className={styles.empty}>Aucune partie ajoutée. Cliquez sur &quot;Ajouter une partie&quot; pour commencer.</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {detailTab === "devisDetaille" ? (
              <div className={styles.devisWrap}>
                <div className={styles.devisHeader}>
                  <span className={styles.devisTotal}>
                    Total :{" "}
                    {formatMoney(
                      (selected.devisDetaille || []).reduce(
                        (sum, l) => sum + (toSafeNumber(l.quantite) || 1) * (toSafeNumber(l.prixUnitaire) || 0),
                        0
                      )
                    )}
                  </span>
                  <button type="button" className={styles.secondaryBtn} onClick={printDevisDetaille}>
                    Exporter PDF
                  </button>
                </div>

                {(selected.devis || []).length === 0 ? (
                  <div className={styles.empty}>Ajoutez d&apos;abord des parties dans l&apos;onglet Devis.</div>
                ) : (
                  <div className={styles.accordionList}>
                    {(selected.devis || []).map((partie) => {
                      const lignes = (selected.devisDetaille || []).filter((l) => l.partieId === partie.id);
                      const partieTotal = lignes.reduce(
                        (sum, l) => sum + (toSafeNumber(l.quantite) || 1) * (toSafeNumber(l.prixUnitaire) || 0),
                        0
                      );
                      const isOpen = !!openPartiesMap[partie.id];
                      const isAdding = addingLigne?.partieId === partie.id;

                      return (
                        <div key={partie.id} className={styles.accordionSection}>
                          <button
                            type="button"
                            className={styles.accordionHeader}
                            onClick={() => togglePartie(partie.id)}
                          >
                            <span className={styles.accordionChevron}>{isOpen ? "▼" : "▶"}</span>
                            <span className={styles.accordionNom}>{partie.nom}</span>
                            {partie.assigneA ? <span className={styles.assignePill}>{partie.assigneA}</span> : null}
                            <span className={styles.accordionTotal}>{formatMoney(partieTotal)}</span>
                            <span className={styles.accordionCount}>
                              {lignes.length} composant{lignes.length !== 1 ? "s" : ""}
                            </span>
                          </button>

                          {isOpen ? (
                            <div className={styles.accordionBody}>
                              <table className={styles.inlineTable}>
                                <thead>
                                  <tr>
                                    <th>Composant</th>
                                    <th>Qté</th>
                                    <th>Prix unit.</th>
                                    <th>Total</th>
                                    <th>Lien</th>
                                    <th>Notes</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lignes.map((ligne) =>
                                    editingLigneId === ligne.id ? (
                                      <tr key={ligne.id} className={styles.editingRow}>
                                        <td>
                                          <input
                                            className={styles.lineInput}
                                            value={editingLigneData.nom}
                                            onChange={(e) => updateEditingLigne("nom", e.target.value)}
                                            placeholder="Composant *"
                                            autoFocus
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.lineInputSm}
                                            type="number"
                                            min="1"
                                            value={editingLigneData.quantite}
                                            onChange={(e) => updateEditingLigne("quantite", e.target.value)}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.lineInputSm}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={editingLigneData.prixUnitaire}
                                            onChange={(e) => updateEditingLigne("prixUnitaire", e.target.value)}
                                          />
                                        </td>
                                        <td className={styles.tdNum}>
                                          {formatMoney(
                                            (toSafeNumber(editingLigneData.quantite) || 1) *
                                              (toSafeNumber(editingLigneData.prixUnitaire) || 0)
                                          )}
                                        </td>
                                        <td>
                                          <input
                                            className={styles.lineInput}
                                            type="url"
                                            placeholder="https://..."
                                            value={editingLigneData.lien}
                                            onChange={(e) => updateEditingLigne("lien", e.target.value)}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.lineInput}
                                            placeholder="Notes…"
                                            value={editingLigneData.notes}
                                            onChange={(e) => updateEditingLigne("notes", e.target.value)}
                                          />
                                        </td>
                                        <td>
                                          <div className={styles.partieActions}>
                                            <button
                                              type="button"
                                              className={styles.confirmBtn}
                                              onClick={confirmEditLigne}
                                              disabled={!editingLigneData.nom.trim()}
                                              title="Confirmer"
                                            >
                                              ✓
                                            </button>
                                            <button
                                              type="button"
                                              className={styles.cancelEditBtn}
                                              onClick={() => { setEditingLigneId(null); setEditingLigneData(null); }}
                                              title="Annuler"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      <tr key={ligne.id}>
                                        <td className={styles.tdNom}>{ligne.nom}</td>
                                        <td className={styles.tdNum}>{toSafeNumber(ligne.quantite) ?? 1}</td>
                                        <td className={styles.tdNum}>{formatMoney(toSafeNumber(ligne.prixUnitaire) || 0)}</td>
                                        <td className={styles.tdNum}>
                                          {formatMoney(
                                            (toSafeNumber(ligne.quantite) || 1) * (toSafeNumber(ligne.prixUnitaire) || 0)
                                          )}
                                        </td>
                                        <td>
                                          {ligne.lien ? (
                                            <a
                                              href={ligne.lien}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={styles.devisLink}
                                            >
                                              Ouvrir ↗
                                            </a>
                                          ) : (
                                            <span className={styles.partieAssigneVide}>—</span>
                                          )}
                                        </td>
                                        <td className={styles.tdNotes}>
                                          {ligne.notes || <span className={styles.partieAssigneVide}>—</span>}
                                        </td>
                                        <td>
                                          <div className={styles.partieActions}>
                                            <button
                                              type="button"
                                              className={styles.iconButton}
                                              title="Modifier"
                                              onClick={() => startEditLigne(ligne)}
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              type="button"
                                              className={styles.deleteButton}
                                              title="Supprimer"
                                              onClick={() => deleteDevisDetailleLigne(ligne.id)}
                                            >
                                              ✖
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  )}

                                  {isAdding ? (
                                    <tr className={styles.editingRow}>
                                      <td>
                                        <input
                                          className={styles.lineInput}
                                          value={addingLigne.nom}
                                          onChange={(e) => updateAddingLigne("nom", e.target.value)}
                                          placeholder="Composant *"
                                          autoFocus
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.lineInputSm}
                                          type="number"
                                          min="1"
                                          value={addingLigne.quantite}
                                          onChange={(e) => updateAddingLigne("quantite", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.lineInputSm}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="0.00"
                                          value={addingLigne.prixUnitaire}
                                          onChange={(e) => updateAddingLigne("prixUnitaire", e.target.value)}
                                        />
                                      </td>
                                      <td className={styles.tdNum}>
                                        {formatMoney(
                                          (toSafeNumber(addingLigne.quantite) || 1) *
                                            (toSafeNumber(addingLigne.prixUnitaire) || 0)
                                        )}
                                      </td>
                                      <td>
                                        <input
                                          className={styles.lineInput}
                                          type="url"
                                          placeholder="https://..."
                                          value={addingLigne.lien}
                                          onChange={(e) => updateAddingLigne("lien", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className={styles.lineInput}
                                          placeholder="Notes…"
                                          value={addingLigne.notes}
                                          onChange={(e) => updateAddingLigne("notes", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <div className={styles.partieActions}>
                                          <button
                                            type="button"
                                            className={styles.confirmBtn}
                                            onClick={confirmAddLigne}
                                            disabled={!addingLigne.nom.trim()}
                                            title="Confirmer"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.cancelEditBtn}
                                            onClick={() => setAddingLigne(null)}
                                            title="Annuler"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>

                              {!isAdding ? (
                                <button
                                  type="button"
                                  className={styles.addLigneBtn}
                                  onClick={() => startAddLigne(partie.id)}
                                >
                                  + Ajouter un composant
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={convertOpen} title="Convertir en Contrat / Projet" onClose={closeConvertModal} size="sm">
        <form className={styles.form} onSubmit={submitConversion}>
          <div className={styles.formGrid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Nom du contrat *</label>
              <input
                className={styles.input}
                value={convertForm.nomContrat}
                onChange={(e) => updateConvert("nomContrat", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Client *</label>
              <input
                className={styles.input}
                value={convertForm.clientNom}
                onChange={(e) => updateConvert("clientNom", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Branche *</label>
              <select
                className={styles.input}
                value={convertForm.branche}
                onChange={(e) => updateConvert("branche", e.target.value)}
              >
                {BRANCHES.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Lieu</label>
              <input className={styles.input} value={convertForm.lieu} onChange={(e) => updateConvert("lieu", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Statut du contrat</label>
              <input
                className={styles.input}
                value={convertForm.statut}
                onChange={(e) => updateConvert("statut", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date de debut</label>
              <input
                className={styles.input}
                type="date"
                value={convertForm.dateDebut}
                onChange={(e) => updateConvert("dateDebut", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date de fin</label>
              <input
                className={styles.input}
                type="date"
                value={convertForm.dateFin}
                onChange={(e) => updateConvert("dateFin", e.target.value)}
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Brief</label>
              <textarea
                className={styles.textarea}
                rows={6}
                value={convertForm.brief}
                onChange={(e) => updateConvert("brief", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={closeConvertModal} disabled={converting}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmitConversion || converting}>
              {converting ? "Conversion..." : "Confirmer"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
