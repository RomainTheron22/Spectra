"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./Personnel.module.css";
import Modal from "../../../components/ui/Modal";
import { authClient } from "../../../lib/auth-client";

const POLES = ["Agency", "Creative Gen", "SFX", "Entertainment"];
const CONTRACT_TYPES = ["Salarié", "Alternant", "Stagiaire", "Freelance interne", "Intermittent"];
const ABSENCE_TYPES = ["Congés", "Congés Payés", "Maladie", "Autre / Abs. injustifiée"];

// Absences qui ne déduisent PAS du salaire (tout sauf Congés non-payés et abs. injustifiée)
const NO_DEDUCT_TYPES = ["Congés Payés", "Maladie"];
// Absences considérées comme "justifiées" (affichée dans colonne dédiée)
const JUSTIFIED_TYPES = ["Congés Payés", "Maladie"];

// Jours ouvrés entre deux dates YYYY-MM-DD (inclus)
function workingDaysBetween(startStr, endStr) {
  if (!startStr || !endStr || startStr > endStr) return 0;
  let count = 0;
  // On construit les dates à midi pour éviter les problèmes de DST
  const start = new Date(startStr + 'T12:00:00');
  const end = new Date(endStr + 'T12:00:00');
  const curr = new Date(start);
  while (curr <= end) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) count++;
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

// Retourne les bornes d'un mois en YYYY-MM-DD SANS passer par toISOString() (évite le décalage UTC)
function monthBounds(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const pad = n => String(n).padStart(2, '0');
  const first = `${y}-${pad(m)}-01`;
  // Dernier jour du mois : jour 0 du mois suivant, getDate() est local donc pas de pb timezone
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${pad(m)}-${pad(lastDay)}`;
  return { first, last };
}

function dailyRate(emp) {
  if (emp.fullMonth === false || emp.fullMonth === "false") {
    const days = Number(emp.daysPerMonth) || 1;
    return Number(emp.monthlyCost) / days;
  }
  return Number(emp.monthlyCost) / 22;
}

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export default function PersonnelPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const searchParams = useSearchParams();
  const router = useRouter();

  // ─── Vue globale ──────────────────────────────────────────────────
  const [mainView, setMainView] = useState("liste"); // "liste" | "gestionRH"

  // ─── Données ──────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ─── Modals ───────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState("infos"); // Renamed from activeTab
  const [isEditing, setIsEditing] = useState(false);
  const [absences, setAbsences] = useState([]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ─── Modal retard ─────────────────────────────────────────────────
  const [retardModalOpen, setRetardModalOpen] = useState(false);
  const [retardTarget, setRetardTarget] = useState(null); // employé concerné
  const [retardForm, setRetardForm] = useState({ date: "", hours: "0", minutes: "0", comment: "" });
  const [retardsEmployee, setRetardsEmployee] = useState([]); // retards onglet profil

  // ─── Modal absence rapide ─────────────────────────────────────────
  const [quickAbsenceOpen, setQuickAbsenceOpen] = useState(false);
  const [quickAbsenceTarget, setQuickAbsenceTarget] = useState(null);
  const [quickAbsenceForm, setQuickAbsenceForm] = useState({ type: "Congés", startDate: "", endDate: "", comment: "" });

  // ─── Formulaire employé ───────────────────────────────────────────
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    role: "", pole: "Agency", contractType: "Freelance interne",
    startDate: "", endDate: "", status: "Actif",
    fullMonth: true, daysPerMonth: "", monthlyCost: "",
    hasContract: false, hasNDA: false,
    notes: ""
  });

  // ─── Formulaire absence ───────────────────────────────────────────
  const [absenceForm, setAbsenceForm] = useState({ type: "Congés", startDate: "", endDate: "", comment: "" });
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);

  // ─── Section Gestion RH ───────────────────────────────────────────
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [adminMonth, setAdminMonth] = useState(defaultMonth);
  const [allAbsences, setAllAbsences] = useState([]);
  const [allRetards, setAllRetards] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────
  const fetchPersonnel = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/personnel");
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadAbsences = useCallback(async (employeeId) => {
    try {
      const res = await fetch(`/api/absences?employeeId=${employeeId}`);
      const data = await res.json();
      if (res.ok) setAbsences(data.items || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadFiles = useCallback(async (folderId) => {
    if (!folderId) {
      setFiles([]);
      return;
    }
    try {
      const res = await fetch(`/api/drive?folderId=${folderId}`);
      const data = await res.json();
      if (res.ok) {
        setFiles(data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadRetardsEmployee = useCallback(async (employeeId) => {
    try {
      const res = await fetch(`/api/retards?employeeId=${employeeId}`);
      const data = await res.json();
      if (res.ok) setRetardsEmployee(data.items || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadAllForMonth = useCallback(async (yearMonth) => {
    try {
      setAdminLoading(true);
      const { first, last } = monthBounds(yearMonth);
      const [absRes, retRes] = await Promise.all([
        fetch(`/api/absences?from=${first}&to=${last}`),
        fetch(`/api/retards?from=${first}&to=${last}`)
      ]);
      const [absData, retData] = await Promise.all([absRes.json(), retRes.json()]);
      if (absRes.ok) setAllAbsences(absData.items || []);
      if (retRes.ok) setAllRetards(retData.items || []);
    } catch (e) { console.error(e); }
    finally { setAdminLoading(false); }
  }, []);

  useEffect(() => { fetchPersonnel(); }, [fetchPersonnel]);

  useEffect(() => {
    const openId = searchParams.get("openId");
    const tab = searchParams.get("tab") || "fichiers";
    if (!openId || loading || items.length === 0) return;
    const emp = items.find(i => String(i._id) === openId);
    if (!emp) return;
    openDetail(emp);
    setDetailTab(tab);
    // Nettoyer l'URL sans recharger la page
    router.replace("/externes/personnel", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items, loading]);

  useEffect(() => {
    if (mainView === "gestionRH") loadAllForMonth(adminMonth);
  }, [mainView, adminMonth, loadAllForMonth]);

  // ─── Helpers ──────────────────────────────────────────────────────
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const resetForm = () => setForm({
    firstName: "", lastName: "", email: "", phone: "",
    role: "", pole: "Agency", contractType: "Freelance interne",
    startDate: "", endDate: "", status: "Actif",
    fullMonth: true, daysPerMonth: "", monthlyCost: "",
    hasContract: false, hasNDA: false,
    notes: ""
  });

  // ─── Handlers CRUD ────────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/personnel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) { setAddOpen(false); fetchPersonnel(); }
    } catch (e) { console.error(e); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await fetch(`/api/personnel/${selected._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) { setIsEditing(false); fetchPersonnel(); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!confirm("Voulez-vous vraiment supprimer ce membre du personnel ?")) return;
    try {
      const res = await fetch(`/api/personnel/${selected._id}`, { method: "DELETE" });
      if (res.ok) { setDetailOpen(false); fetchPersonnel(); }
    } catch (e) { console.error(e); }
  };

  const handleAddAbsence = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/absences", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected._id, ...absenceForm })
      });
      if (res.ok) {
        setAbsenceModalOpen(false);
        loadAbsences(selected._id);
        setAbsenceForm({ type: "Congés", startDate: "", endDate: "", comment: "" });
      }
    } catch (e) { console.error(e); }
  };

  const deleteAbsence = async (id) => {
    if (!confirm("Supprimer cette absence ?")) return;
    try {
      await fetch(`/api/absences/${id}`, { method: "DELETE" });
      loadAbsences(selected._id);
    } catch (e) { console.error(e); }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!selected?.driveFolderId) {
      alert("Aucun dossier Drive lié à ce profil. Veuillez re-sauvegarder le profil pour le générer.");
      return;
    }

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    await uploadFiles(droppedFiles);
  };

  const handleFileSelect = async (e) => {
    if (!selected?.driveFolderId) {
      alert("Aucun dossier Drive lié à ce profil.");
      return;
    }
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    await uploadFiles(selectedFiles);
  };

  const uploadFiles = async (filesToUpload) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("parentId", selected.driveFolderId);
      filesToUpload.forEach(file => {
        formData.append("files", file);
      });

      const res = await fetch("/api/drive/files", { method: "POST", body: formData });
      if (res.ok) {
        loadFiles(selected.driveFolderId);
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de l'upload");
      }
    } catch (e) {
      console.error("Erreur upload", e);
      alert("Erreur réseau lors de l'upload");
    } finally {
      setUploading(false);
      // Reset input file if exists
      const fileInput = document.getElementById("file-upload");
      if (fileInput) fileInput.value = "";
    }
  };

  const toggleDocumentStatus = async (docType) => {
    if (!selected) return;
    const newValue = !selected[docType];
    try {
      const res = await fetch(`/api/personnel/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [docType]: newValue })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated.item);
        setItems(prev => prev.map(i => i._id === updated.item._id ? updated.item : i));
        setForm(prev => ({ ...prev, [docType]: newValue }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRetard = async (id) => {
    if (!confirm("Supprimer ce retard ?")) return;
    try {
      await fetch(`/api/retards/${id}`, { method: "DELETE" });
      if (selected) loadRetardsEmployee(selected._id);
    } catch (e) { console.error(e); }
  };

  // ─── Retard modal ─────────────────────────────────────────────────
  const openRetardModal = (emp, e) => {
    e.stopPropagation();
    setRetardTarget(emp);
    const today = new Date().toISOString().split("T")[0];
    setRetardForm({ date: today, hours: "0", minutes: "15", comment: "" });
    setRetardModalOpen(true);
  };

  const handleAddRetard = async (e) => {
    e.preventDefault();
    const totalMin = Number(retardForm.hours) * 60 + Number(retardForm.minutes);
    if (totalMin <= 0) return;
    try {
      await fetch("/api/retards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: String(retardTarget._id), date: retardForm.date, minutes: totalMin, comment: retardForm.comment })
      });
      setRetardModalOpen(false);
      setRetardTarget(null);
      if (mainView === "gestionRH") loadAllForMonth(adminMonth);
    } catch (e) { console.error(e); }
  };

  // ─── Absence rapide modal ───────────────────────────────────────
  const openQuickAbsenceModal = (emp, e) => {
    e.stopPropagation();
    setQuickAbsenceTarget(emp);
    const today = new Date().toISOString().split("T")[0];
    setQuickAbsenceForm({ type: "Congés", startDate: today, endDate: today, comment: "" });
    setQuickAbsenceOpen(true);
  };

  const handleAddQuickAbsence = async (e) => {
    e.preventDefault();
    try {
      if (quickAbsenceForm.endDate < quickAbsenceForm.startDate) return;
      await fetch("/api/absences", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: String(quickAbsenceTarget._id), ...quickAbsenceForm })
      });
      setQuickAbsenceOpen(false);
      setQuickAbsenceTarget(null);
      if (mainView === "gestionRH") loadAllForMonth(adminMonth);
    } catch (e) { console.error(e); }
  };

  const openDetail = (item) => {
    setSelected(item);
    setForm({
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      email: item.email || "",
      phone: item.phone || "",
      role: item.role || "",
      pole: item.pole || "Agency",
      contractType: item.contractType || "Freelance interne",
      startDate: item.startDate ? item.startDate.substring(0, 10) : "",
      endDate: item.endDate ? item.endDate.substring(0, 10) : "",
      status: item.status || "Actif",
      fullMonth: item.fullMonth !== false,
      daysPerMonth: item.daysPerMonth || "",
      monthlyCost: item.monthlyCost || "",
      hasContract: item.hasContract || false,
      hasNDA: item.hasNDA || false,
      notes: item.notes || ""
    });
    setDetailTab("infos");
    setIsEditing(false);
    setAbsences([]);
    setRetardsEmployee([]);
    if (item.driveFolderId) {
      loadFiles(item.driveFolderId);
    } else {
      setFiles([]);
    }
    setDetailOpen(true);
    loadAbsences(item._id);
    loadRetardsEmployee(item._id);
  };

  // ─── Calculs Gestion RH ───────────────────────────────────────────
  const adminRows = useMemo(() => {
    const { first, last } = monthBounds(adminMonth);

    // Filtre : employés dont le contrat chevauche le mois sélectionné
    // Les dates sont maintenant de vraies chaînes YYYY-MM-DD → comparaison string fiable
    const activeEmployees = items.filter(emp => {
      const empStart = emp.startDate ? String(emp.startDate).substring(0, 10) : '0000-01-01';
      const empEnd = emp.endDate ? String(emp.endDate).substring(0, 10) : '9999-12-31';
      // Le contrat doit chevaucher le mois : fin >= premier jour ET début <= dernier jour
      return empEnd >= first && empStart <= last;
    });

    return activeEmployees.map(emp => {
      const empId = String(emp._id);

      // Période réelle travaillée ce mois = intersection contrat ∩ mois
      const empStart = emp.startDate ? String(emp.startDate).substring(0, 10) : first;
      const empEnd = emp.endDate ? String(emp.endDate).substring(0, 10) : last;
      const effectiveStart = empStart > first ? empStart : first;
      const effectiveEnd = empEnd < last ? empEnd : last;

      // Jours ouvrés totaux dans le mois vs jours réellement couverts
      const totalWD = workingDaysBetween(first, last) || 1;
      const workedWD = workingDaysBetween(effectiveStart, effectiveEnd);
      const proratioRatio = workedWD / totalWD; // 1.0 si mois complet

      // Coût de base proratisé
      const baseCost = Number(emp.monthlyCost) * proratioRatio;
      const isProrated = workedWD < totalWD;

      const empAbsences = allAbsences.filter(a => a.employeeId === empId);
      const empRetards = allRetards.filter(r => r.employeeId === empId);

      let totalDeductDays = 0;
      let justifiedDays = 0;
      const absenceDetails = empAbsences.map(ab => {
        // Intersection absence ∩ période effective
        const abStart = ab.startDate > effectiveStart ? ab.startDate : effectiveStart;
        const abEnd = ab.endDate < effectiveEnd ? ab.endDate : effectiveEnd;
        const days = workingDaysBetween(abStart, abEnd);
        const deducts = !NO_DEDUCT_TYPES.includes(ab.type);
        const justified = JUSTIFIED_TYPES.includes(ab.type);
        if (deducts) totalDeductDays += days;
        if (justified) justifiedDays += days;
        return { ...ab, days, deducts, justified };
      });

      const totalRetardMin = empRetards.reduce((s, r) => s + (r.minutes || 0), 0);
      // Taux journalier basé sur le coût mensuel complet / jours contractuels
      const rate = dailyRate(emp);
      const deduction = totalDeductDays * rate;
      const payment = Math.max(0, baseCost - deduction);

      return {
        emp, absenceDetails, totalDeductDays, justifiedDays, deduction, payment,
        totalRetardMin, baseCost, isProrated, workedWD, totalWD
      };
    });
  }, [items, allAbsences, allRetards, adminMonth]);

  // ─── Champ coût ───────────────────────────────────────────────────
  const CostFields = ({ isFullMonth, onToggle, daysPer, onDays, monthly, onMonthly }) => (
    <>
      <div className={styles.field} style={{ gridColumn: "span 2" }}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={!!isFullMonth} onChange={e => onToggle(e.target.checked)} className={styles.checkbox} />
          <span>Tout le mois (présent tous les jours ouvrés)</span>
        </label>
      </div>
      {!isFullMonth && (
        <div className={styles.field}>
          <label className={styles.label}>Jours travaillés / mois</label>
          <input type="number" min="1" max="31" className={styles.input} value={daysPer} onChange={e => onDays(e.target.value)} placeholder="ex: 15" />
        </div>
      )}
      <div className={styles.field}>
        <label className={styles.label}>Coût mensuel (€ HT)</label>
        <input type="number" className={styles.input} value={monthly} onChange={e => onMonthly(e.target.value)} placeholder="ex: 2000" />
      </div>
    </>
  );

  // ─── Filtre ───────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => {
      const fullName = `${i.firstName || ''} ${i.lastName || ''}`.toLowerCase();
      return fullName.includes(q) || (i.email || '').toLowerCase().includes(q)
        || (i.pole || '').toLowerCase().includes(q) || (i.role || '').toLowerCase().includes(q);
    });
  }, [items, search]);

  // ─── Rendu ────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ── En-tête ── */}
      <div className={styles.headerBlock}>
        <h1 className={styles.pageTitle}>Personnel</h1>
        {isAdmin && (
          <nav className={styles.mainNav}>
            <button
              type="button"
              className={mainView === "liste" ? styles.navItemActive : styles.navItem}
              onClick={() => setMainView("liste")}
            >
              <span className={styles.navIcon}>👥</span> Liste
            </button>
            <button
              type="button"
              className={mainView === "gestionRH" ? styles.navItemActive : styles.navItem}
              onClick={() => setMainView("gestionRH")}
            >
              <span className={styles.navIcon}>💼</span> Gestion RH
            </button>
          </nav>
        )}
      </div>

      {/* ── VUE LISTE ── */}
      {mainView === "liste" && (
        <>
          <div className={styles.searchRow}>
            <input className={styles.searchInput} type="text" value={search}
              onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, rôle ou pôle…" />
          </div>

          <div className={styles.grid}>
            <button type="button" className={styles.addCard} onClick={() => { resetForm(); setAddOpen(true); }}>
              <div className={styles.plus}>+</div>
              <div className={styles.addLabel}>Ajouter un membre</div>
            </button>

            {filteredItems.map(item => (
              <button key={item._id} className={styles.cardButton} onClick={() => openDetail(item)}>
                <div className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.cardTitle}>{item.firstName} {item.lastName}</div>
                      <div className={styles.cardRole}>{item.role || "Sans rôle"} &bull; {item.pole}</div>
                    </div>
                    <div className={`${styles.statusIndicator} ${item.status === "Actif" ? styles.actif : styles.termine}`}>
                      {item.status}
                    </div>
                  </div>
                  <div className={styles.refBlock}>
                    <div className={styles.row}>
                      <div className={styles.k}>Contrat</div>
                      <div className={styles.v}>{item.contractType}</div>
                    </div>
                    {item.startDate && (
                      <div className={styles.row}>
                        <div className={styles.k}>Début</div>
                        <div className={styles.v}>{new Date(item.startDate).toLocaleDateString()}</div>
                      </div>
                    )}
                    <div className={styles.refEmail}>{item.email}</div>
                    <div className={styles.refPhone}>{item.phone}</div>
                  </div>
                  {/* Actions rapides en bas à droite */}
                  <div className={styles.cardFooterActions}>
                    <button
                      type="button"
                      className={styles.retardBtn}
                      style={{ marginRight: "6px" }}
                      onClick={(e) => openQuickAbsenceModal(item, e)}
                      title="Ajouter une absence"
                    >
                      📅
                    </button>
                    <button
                      type="button"
                      className={styles.retardBtn}
                      onClick={(e) => openRetardModal(item, e)}
                      title="Ajouter un retard"
                    >
                      🕐
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── VUE GESTION RH ── */}
      {mainView === "gestionRH" && isAdmin && (
        <div className={styles.adminCostSection}>
          <div className={styles.adminCostHeader}>
            <div className={styles.adminCostTitle}>Tableau des paiements mensuels</div>
            {/* Bouton compact déclenchant le popover */}
            <div className={styles.monthPickerWrap}>
              <button
                type="button"
                className={styles.monthPickerTrigger}
                onClick={() => setShowMonthPicker(p => !p)}
              >
                📅 {(() => {
                  const [y, m] = adminMonth.split('-').map(Number);
                  const MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                  return `${MONTHS_FULL[m - 1]} ${y}`;
                })()} ▾
              </button>
              {showMonthPicker && (() => {
                const [selYear, selMon] = adminMonth.split('-').map(Number);
                const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                return (
                  <div className={styles.monthPickerPopover}>
                    <div className={styles.yearRow}>
                      <button type="button" className={styles.yearArrow} onClick={() => setAdminMonth(`${selYear - 1}-${String(selMon).padStart(2, '0')}`)}>‹</button>
                      <span className={styles.yearLabel}>{selYear}</span>
                      <button type="button" className={styles.yearArrow} onClick={() => setAdminMonth(`${selYear + 1}-${String(selMon).padStart(2, '0')}`)}>›</button>
                    </div>
                    <div className={styles.monthGrid}>
                      {MONTHS.map((label, idx) => {
                        const m = idx + 1;
                        const active = m === selMon;
                        return (
                          <button
                            key={m}
                            type="button"
                            className={active ? styles.monthCellActive : styles.monthCell}
                            onClick={() => { setAdminMonth(`${selYear}-${String(m).padStart(2, '0')}`); setShowMonthPicker(false); }}
                          >{label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <p className={styles.muted} style={{ marginBottom: "16px" }}>
            <strong>Congés Payés</strong> ne sont pas déduits du salaire.
            Le taux journalier = coût mensuel ÷ jours contractuels (ou 22j si tout le mois).
          </p>
          {adminLoading ? (
            <div className={styles.muted}>Chargement…</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Rôle / Pôle</th>
                    <th>Coût mensuel</th>
                    <th>Absences</th>
                    <th>Absences justifiées</th>
                    <th>Retards</th>
                    <th>Déduction</th>
                    <th className={styles.paymentCol}>Paiement dû</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRows.map(({ emp, absenceDetails, totalDeductDays, justifiedDays, deduction, payment, totalRetardMin, baseCost, isProrated, workedWD, totalWD }) => (
                    <tr key={emp._id}>
                      <td>
                        <div className={styles.empName}>{emp.firstName} {emp.lastName}</div>
                        <div className={styles.empContract}>{emp.contractType}</div>
                      </td>
                      <td>
                        <div>{emp.role || "—"}</div>
                        <div className={styles.poleBadge}>{emp.pole}</div>
                      </td>
                      <td className={styles.numCell}>
                        {Number(emp.monthlyCost) > 0 ? `${Number(emp.monthlyCost).toLocaleString("fr-FR")} €` : "—"}
                        <div className={styles.subInfo}>{emp.fullMonth === false ? `${emp.daysPerMonth}j/mois` : "Plein mois"}</div>
                        {isProrated && (
                          <div className={styles.proratedNote}>
                            Proratisé : {workedWD}j/{totalWD}j = {Math.round(baseCost)} €
                          </div>
                        )}
                      </td>

                      {/* Absences non justifiées / à déduire */}
                      <td>
                        {absenceDetails.filter(ab => ab.deducts).length === 0 ? (
                          <span className={styles.muted}>—</span>
                        ) : absenceDetails.filter(ab => ab.deducts).map((ab, i) => (
                          <div key={i} className={styles.absChip}>
                            <span>{ab.type}</span>
                            <span className={styles.absChipDays}>{ab.days}j</span>
                          </div>
                        ))}
                        {totalDeductDays > 0 && <div className={styles.totalDeduct}>{totalDeductDays}j déduits</div>}
                      </td>

                      {/* Absences justifiées (chips détaillées) */}
                      <td>
                        {absenceDetails.filter(ab => ab.justified).length === 0 ? (
                          <span className={styles.muted}>—</span>
                        ) : absenceDetails.filter(ab => ab.justified).map((ab, i) => (
                          <div key={i} className={`${styles.absChip} ${styles.absChipNoDeduct}`}>
                            <span>{ab.type}</span>
                            <span className={styles.absChipDays}>{ab.days}j</span>
                          </div>
                        ))}
                      </td>

                      {/* Retards */}
                      <td className={styles.numCell}>
                        {totalRetardMin > 0 ? (
                          <span className={styles.retardBadgeTable}>{fmtMinutes(totalRetardMin)}</span>
                        ) : <span className={styles.muted}>—</span>}
                      </td>

                      <td className={styles.numCell} style={{ color: deduction > 0 ? "#ef4444" : "inherit" }}>
                        {deduction > 0 ? `-${deduction.toFixed(0)} €` : "—"}
                      </td>
                      <td className={styles.paymentCell}>
                        {Number(emp.monthlyCost) > 0 ? `${payment.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} style={{ textAlign: "right", fontWeight: 600, padding: "10px 12px" }}>
                      Total à payer ce mois :
                    </td>
                    <td className={styles.paymentCell} style={{ fontSize: "16px" }}>
                      {adminRows.reduce((s, r) => s + r.payment, 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL RETARD ─── */}
      <Modal open={retardModalOpen} title={retardTarget ? `Retard – ${retardTarget.firstName} ${retardTarget.lastName}` : "Retard"} onClose={() => setRetardModalOpen(false)}>
        <form onSubmit={handleAddRetard} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Date</label>
              <input type="date" required className={styles.input} value={retardForm.date}
                onChange={e => setRetardForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Heures</label>
              <input type="number" min="0" max="8" className={styles.input} value={retardForm.hours}
                onChange={e => setRetardForm(p => ({ ...p, hours: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Minutes</label>
              <select className={styles.select} value={retardForm.minutes}
                onChange={e => setRetardForm(p => ({ ...p, minutes: e.target.value }))}>
                {["0", "5", "10", "15", "20", "30", "45"].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Commentaire (optionnel)</label>
              <input type="text" className={styles.input} value={retardForm.comment}
                onChange={e => setRetardForm(p => ({ ...p, comment: e.target.value }))}
                placeholder="ex: Problème de transport" />
            </div>
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setRetardModalOpen(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL ABSENCE RAPIDE ─── */}
      <Modal open={quickAbsenceOpen} title={quickAbsenceTarget ? `Absence – ${quickAbsenceTarget.firstName} ${quickAbsenceTarget.lastName}` : "Absence"} onClose={() => setQuickAbsenceOpen(false)}>
        <form onSubmit={handleAddQuickAbsence} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Type d'absence</label>
              <select className={styles.select} value={quickAbsenceForm.type}
                onChange={e => setQuickAbsenceForm(p => ({ ...p, type: e.target.value }))}>
                {ABSENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.fieldWide} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.field}>
                <label className={styles.label}>Du</label>
                <input type="date" required className={styles.input} value={quickAbsenceForm.startDate}
                  onChange={e => setQuickAbsenceForm(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Au (inclus)</label>
                <input type="date" required className={styles.input} value={quickAbsenceForm.endDate} min={quickAbsenceForm.startDate}
                  onChange={e => setQuickAbsenceForm(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Commentaire</label>
              <input type="text" className={styles.input} value={quickAbsenceForm.comment}
                onChange={e => setQuickAbsenceForm(p => ({ ...p, comment: e.target.value }))}
                placeholder="Facultatif" />
            </div>
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setQuickAbsenceOpen(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL AJOUT EMPLOYÉ ─── */}
      <Modal open={addOpen} title="Ajouter au personnel" onClose={() => setAddOpen(false)}>
        <form className={styles.form} onSubmit={handleAddSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.field}><label className={styles.label}>Prénom *</label><input required className={styles.input} value={form.firstName} onChange={e => update("firstName", e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Nom *</label><input required className={styles.input} value={form.lastName} onChange={e => update("lastName", e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Email professionnel</label><input type="email" className={styles.input} value={form.email} onChange={e => update("email", e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Téléphone</label><input className={styles.input} value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
            <div className={styles.field}>
              <label className={styles.label}>Pôle</label>
              <select className={styles.select} value={form.pole} onChange={e => update("pole", e.target.value)}>
                {POLES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Rôle / Poste</label><input className={styles.input} value={form.role} onChange={e => update("role", e.target.value)} placeholder="ex: Réalisateur, Monteur..." /></div>
            <div className={styles.field}>
              <label className={styles.label}>Type de contrat</label>
              <select className={styles.select} value={form.contractType} onChange={e => update("contractType", e.target.value)}>
                {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Statut</label>
              <select className={styles.select} value={form.status} onChange={e => update("status", e.target.value)}>
                <option>Actif</option><option>Terminé</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Date de début</label><input type="date" className={styles.input} value={form.startDate} onChange={e => update("startDate", e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Date de fin (Optionnel)</label><input type="date" className={styles.input} value={form.endDate} onChange={e => update("endDate", e.target.value)} /></div>
            {isAdmin && (
              <>
                <div className={styles.fieldWide}><div className={styles.costSeparator}>💰 Coût (admin uniquement)</div></div>
                <CostFields isFullMonth={form.fullMonth} onToggle={v => update("fullMonth", v)} daysPer={form.daysPerMonth} onDays={v => update("daysPerMonth", v)} monthly={form.monthlyCost} onMonthly={v => update("monthlyCost", v)} />
                <div className={styles.fieldWide}><div className={styles.costSeparator}>📄 Documents (admin uniquement)</div></div>
                <div className={styles.fieldWide}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={!!form.hasContract} onChange={e => update("hasContract", e.target.checked)} className={styles.checkbox} />
                    <span>Contrat signé</span>
                  </label>
                </div>
                <div className={styles.fieldWide}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={!!form.hasNDA} onChange={e => update("hasNDA", e.target.checked)} className={styles.checkbox} />
                    <span>NDA signé</span>
                  </label>
                </div>
              </>
            )}
            <div className={styles.fieldWide}><label className={styles.label}>Notes internes</label><textarea className={styles.textarea} value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} /></div>
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setAddOpen(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn}>Créer</button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL PROFIL ─── */}
      <Modal open={detailOpen} title={selected ? `${selected.firstName} ${selected.lastName}` : "Profil"} onClose={() => setDetailOpen(false)}>
        {selected && (
          <div className={styles.detailWrap}>
            <div className={styles.detailTop}>
              <div className={styles.tabs}>
                <button type="button" className={detailTab === "infos" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("infos")}>Infos</button>
                <button type="button" className={detailTab === "absences" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("absences")}>Absences</button>
                <button type="button" className={detailTab === "retards" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("retards")}>Retards</button>
                <button type="button" className={detailTab === "fichiers" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("fichiers")}>Fichiers</button>
                {isAdmin && <button type="button" className={detailTab === "couts" ? styles.tabActive : styles.tab} onClick={() => setDetailTab("couts")}>Coûts & Contrat</button>}
              </div>
              {detailTab === "infos" && (
                <div className={styles.detailActions}>
                  <button type="button" className={styles.iconButton} onClick={() => setIsEditing(!isEditing)}>✏️</button>
                  <button type="button" className={styles.deleteButton} onClick={handleDelete}>✖</button>
                </div>
              )}
              {detailTab === "absences" && (
                <button type="button" className={styles.btnSm} onClick={() => setAbsenceModalOpen(true)}>+ Ajouter</button>
              )}
              {detailTab === "retards" && (
                <button type="button" className={styles.btnSm} onClick={(e) => openRetardModal(selected, e)}>+ Retard</button>
              )}
            </div>

            {/* ─ Infos ─ */}
            {detailTab === "infos" && (
              isEditing ? (
                <form className={styles.formGrid} onSubmit={handleEditSubmit}>
                  <div className={styles.field}><label className={styles.label}>Prénom *</label><input required className={styles.input} value={form.firstName} onChange={e => update("firstName", e.target.value)} /></div>
                  <div className={styles.field}><label className={styles.label}>Nom *</label><input required className={styles.input} value={form.lastName} onChange={e => update("lastName", e.target.value)} /></div>
                  <div className={styles.field}><label className={styles.label}>Email</label><input type="email" className={styles.input} value={form.email} onChange={e => update("email", e.target.value)} /></div>
                  <div className={styles.field}><label className={styles.label}>Téléphone</label><input className={styles.input} value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
                  <div className={styles.field}>
                    <label className={styles.label}>Pôle</label>
                    <select className={styles.select} value={form.pole} onChange={e => update("pole", e.target.value)}>
                      {POLES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}><label className={styles.label}>Rôle / Poste</label><input className={styles.input} value={form.role} onChange={e => update("role", e.target.value)} /></div>
                  <div className={styles.field}>
                    <label className={styles.label}>Type de contrat</label>
                    <select className={styles.select} value={form.contractType} onChange={e => update("contractType", e.target.value)}>
                      {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Statut</label>
                    <select className={styles.select} value={form.status} onChange={e => update("status", e.target.value)}>
                      <option>Actif</option><option>Terminé</option>
                    </select>
                  </div>
                  <div className={styles.field}><label className={styles.label}>Date de début</label><input type="date" className={styles.input} value={form.startDate ? form.startDate.split("T")[0] : ""} onChange={e => update("startDate", e.target.value)} /></div>
                  <div className={styles.field}><label className={styles.label}>Date de fin</label><input type="date" className={styles.input} value={form.endDate ? form.endDate.split("T")[0] : ""} onChange={e => update("endDate", e.target.value)} /></div>
                  <div className={styles.fieldWide}><label className={styles.label}>Notes</label><textarea className={styles.textarea} value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} /></div>
                  <div className={styles.fieldWide} style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => setIsEditing(false)}>Annuler</button>
                    <button type="submit" className={styles.submitBtn}>Enregistrer</button>
                  </div>
                </form>
              ) : (
                <div className={styles.infoGrid}>
                  <div className={styles.infoRow}><div className={styles.k}>Statut</div><div className={styles.v}>{selected.status}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Contrat</div><div className={styles.v}>{selected.contractType}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Rôle</div><div className={styles.v}>{selected.role || "—"}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Pôle</div><div className={styles.v}>{selected.pole}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Email</div><div className={styles.v}>{selected.email || "—"}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Téléphone</div><div className={styles.v}>{selected.phone || "—"}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Début</div><div className={styles.v}>{selected.startDate ? new Date(selected.startDate).toLocaleDateString() : "—"}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Fin</div><div className={styles.v}>{selected.endDate ? new Date(selected.endDate).toLocaleDateString() : "—"}</div></div>
                  <div className={styles.infoRow}><div className={styles.k}>Notes</div><div className={styles.v}>{selected.notes || "—"}</div></div>
                </div>
              )
            )}

            {/* ─ Absences ─ */}
            {detailTab === "absences" && (
              <div className={styles.absencesWrap}>
                {absences.length === 0 ? (
                  <div className={styles.muted}>Aucune absence enregistrée.</div>
                ) : absences.map(ab => (
                  <div key={ab._id} className={`${styles.absenceItem} ${NO_DEDUCT_TYPES.includes(ab.type) ? styles.absencePaid : ""}`}>
                    <div>
                      <div className={styles.absenceType}>
                        {ab.type}
                        {NO_DEDUCT_TYPES.includes(ab.type) && <span className={styles.paidBadge}>✓ Sans déduction</span>}
                      </div>
                      <div className={styles.absenceDates}>
                        Du {new Date(ab.startDate).toLocaleDateString()} au {new Date(ab.endDate).toLocaleDateString()}
                      </div>
                      {ab.comment && <div className={styles.absenceComment}>{ab.comment}</div>}
                    </div>
                    <button type="button" className={styles.iconButton} onClick={() => deleteAbsence(ab._id)} title="Supprimer">✖</button>
                  </div>
                ))}
                {absenceModalOpen && (
                  <form onSubmit={handleAddAbsence} style={{ marginTop: "16px", background: "#fff", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Nouvelle Absence</h4>
                    <div className={styles.formGrid}>
                      <div className={styles.fieldWide}>
                        <label className={styles.label}>Type</label>
                        <select className={styles.select} value={absenceForm.type} onChange={e => setAbsenceForm({ ...absenceForm, type: e.target.value })}>
                          {ABSENCE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        {NO_DEDUCT_TYPES.includes(absenceForm.type) && (
                          <div className={styles.infoTip}>ℹ️ Ce type d&apos;absence ne sera pas déduit du salaire.</div>
                        )}
                      </div>
                      <div className={styles.field}><label className={styles.label}>Du</label><input type="date" required className={styles.input} value={absenceForm.startDate} onChange={e => setAbsenceForm({ ...absenceForm, startDate: e.target.value })} /></div>
                      <div className={styles.field}><label className={styles.label}>Au</label><input type="date" required className={styles.input} value={absenceForm.endDate} onChange={e => setAbsenceForm({ ...absenceForm, endDate: e.target.value })} /></div>
                      <div className={styles.fieldWide}><label className={styles.label}>Commentaire</label><input type="text" className={styles.input} value={absenceForm.comment} onChange={e => setAbsenceForm({ ...absenceForm, comment: e.target.value })} /></div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                      <button type="button" className={styles.secondaryBtn} onClick={() => setAbsenceModalOpen(false)}>Fermer</button>
                      <button type="submit" className={styles.submitBtn}>Enregistrer</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ─ Retards ─ */}
            {detailTab === "retards" && (
              <div className={styles.absencesWrap}>
                {retardsEmployee.length === 0 ? (
                  <div className={styles.muted}>Aucun retard enregistré.</div>
                ) : retardsEmployee.map(r => (
                  <div key={r._id} className={styles.absenceItem}>
                    <div>
                      <div className={styles.absenceType}>
                        🕐 {fmtMinutes(r.minutes)} de retard
                      </div>
                      <div className={styles.absenceDates}>
                        Le {new Date(r.date).toLocaleDateString("fr-FR")}
                      </div>
                      {r.comment && <div className={styles.absenceComment}>{r.comment}</div>}
                    </div>
                    <button type="button" className={styles.iconButton} onClick={() => deleteRetard(r._id)} title="Supprimer">✖</button>
                  </div>
                ))}
              </div>
            )}

            {/* ─ Fichiers ─ */}
            {detailTab === "fichiers" && (
              <div className={styles.costsWrap}>
                <h3 className={styles.costHeader}>Fichiers joints</h3>
                <div className={styles.fichiersWrap}>

                  <div
                    className={`${styles.uploadZone} ${isDragging ? styles.dragActive : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload').click()}
                  >
                    <span className={styles.uploadIcon}>☁️</span>
                    <span className={styles.uploadText}>
                      {uploading ? "Upload en cours..." : "Cliquez ou glissez vos fichiers ici"}
                    </span>
                    <span className={styles.uploadSubtext}>PDF, Word, Images acceptés</span>
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                  </div>

                  {files.length > 0 ? (
                    <div className={styles.fileList}>
                      {files.map(f => (
                        <div key={f.id} className={styles.fileItem}>
                          <div className={styles.fileInfo}>
                            <span className={styles.fileIcon}>📄</span>
                            <span className={styles.fileName}>{f.name}</span>
                          </div>
                          <a href={`/api/drive/files/${f.id}/download`} className={styles.secondaryBtn} style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none' }} download>Télécharger</a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.muted} style={{ textAlign: 'center', marginTop: '10px' }}>Aucun fichier lié à ce collaborateur.</p>
                  )}
                </div>
              </div>
            )}

            {/* ─ Coûts ─ */}
            {detailTab === "couts" && isAdmin && (
              <div className={styles.costsWrap}>
                <div className={styles.costHeader}>Données de Paie / Facturation</div>
                {isEditing ? (
                  <form className={styles.formGrid} onSubmit={handleEditSubmit}>
                    <CostFields isFullMonth={form.fullMonth} onToggle={v => update("fullMonth", v)} daysPer={form.daysPerMonth} onDays={v => update("daysPerMonth", v)} monthly={form.monthlyCost} onMonthly={v => update("monthlyCost", v)} />
                    <div className={styles.fieldWide} style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" className={styles.submitBtn}>Mettre à jour</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={styles.costCard}>
                      <div className={styles.costLabel}>Présence contractuelle</div>
                      <div className={styles.costValue}>{selected.fullMonth === false ? `${selected.daysPerMonth} jours / mois` : "Tout le mois (22j ouvrés)"}</div>
                    </div>
                    <div className={styles.costCard}>
                      <div className={styles.costLabel}>Coût Mensuel Base</div>
                      <div className={styles.costValue}>{selected.monthlyCost ? `${Number(selected.monthlyCost).toLocaleString("fr-FR")} €` : "—"}</div>
                    </div>
                    {selected.monthlyCost > 0 && (
                      <div className={styles.costCard}>
                        <div className={styles.costLabel}>Taux Journalier (calculé)</div>
                        <div className={styles.costValue}>{dailyRate(selected).toFixed(2)} €/j</div>
                      </div>
                    )}
                    <div className={styles.detailActions}>
                      {selected.driveFolderId && (
                        <a
                          href={`/drive?folderId=${selected.driveFolderId}`}
                          className={styles.secondaryBtn}
                          style={{ fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
                        >
                          Ouvrir dans Drive
                        </a>
                      )}
                      <button className={styles.secondaryBtn} style={{ fontSize: '12px', padding: '6px 10px' }} onClick={() => setIsEditing(true)}>Modifier le profil</button>
                    </div>
                  </>
                )}
                <p className={styles.muted} style={{ marginTop: "16px" }}>
                  * Ces valeurs sont utilisées dans la section Gestion RH. Les CP ne sont pas déduits.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
