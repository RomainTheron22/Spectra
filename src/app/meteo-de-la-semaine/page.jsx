"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useSidebar } from "../../lib/sidebar-context";
import styles from "./MeteoSemaine.module.css";

// ── Constants ──────────────────────────────────────────────────────────────────

const POLES = [
  { key: "agency",        label: "Agency",        accent: "#0ea5e9" },
  { key: "entertainment", label: "Entertainment", accent: "#e11d48" },
  { key: "sfx",           label: "SFX",           accent: "#10b981" },
  { key: "creativgen",    label: "CreativGen",    accent: "#f59e0b" },
];

const STATUSES = [
  "En cours", "Nouveau", "Urgent", "En pause", "Terminé",
  "En attente", "En construction", "Tournage", "Design",
];

const STATUS_STYLE = {
  "En cours":        { bg: "#dbeafe", color: "#1d4ed8" },
  "Nouveau":         { bg: "#ede9fe", color: "#6d28d9" },
  "Urgent":          { bg: "#fee2e2", color: "#dc2626" },
  "En pause":        { bg: "#fef3c7", color: "#92400e" },
  "Terminé":         { bg: "#dcfce7", color: "#166534" },
  "En attente":      { bg: "#f1f5f9", color: "#475569" },
  "En construction": { bg: "#fff7ed", color: "#c2410c" },
  "Tournage":        { bg: "#fdf4ff", color: "#7e22ce" },
  "Design":          { bg: "#ecfdf5", color: "#065f46" },
};

const AVATAR_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#e11d48", "#0284c7"];

const DEFAULT_DATA = (date) => ({
  date,
  columns: {
    agency:        { projets: [], briefs: [] },
    entertainment: { projets: [], briefs: [] },
    sfx:           { projets: [], briefs: [] },
    creativgen:    { projets: [], briefs: [] },
  },
  blocs: [
    { id: "left",   title: "Rendez-vous importants", items: [] },
    { id: "center", title: "Intervenants",            items: [] },
    { id: "right",  title: "Info / Anecdote",         items: [] },
  ],
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateStr(d) { return d.toLocaleDateString("fr-CA"); }

function getISOWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function formatWeekRange(monday) {
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const startDay = monday.getDate();
  const endStr = saturday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `${startDay} — ${endStr}`;
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

// ── AddModal ───────────────────────────────────────────────────────────────────

function AddModal({ title, withStatus = false, onAdd, onClose }) {
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("En cours");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const confirm = () => {
    if (!name.trim()) return;
    onAdd({ id: uid(), name: name.trim(), detail: detail.trim(), ...(withStatus ? { status } : {}) });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{title}</div>
        <input
          className={styles.modalInput} placeholder="Nom…" value={name}
          onChange={(e) => setName(e.target.value)} autoFocus
          onKeyDown={(e) => e.key === "Enter" && confirm()}
        />
        <input
          className={styles.modalInput} placeholder="Détail…" value={detail}
          onChange={(e) => setDetail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm()}
        />
        {withStatus && (
          <select className={styles.modalInput} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>Annuler</button>
          <button className={styles.modalConfirm} onClick={confirm}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE["En attente"];
  return <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>{status}</span>;
}

// ── InfoBloc (horizontal variant of SidebarBloc) ──────────────────────────────

function InfoBloc({ bloc, adminMode, onChange }) {
  const [adding, setAdding] = useState(false);
  const items = bloc.items ?? [];
  const isIntervenants = bloc.id === "center";

  const deleteItem = (id) => onChange({ ...bloc, items: items.filter((it) => it.id !== id) });
  const addItem = (item) => onChange({ ...bloc, items: [...items, item] });

  return (
    <div className={styles.infoBloc}>
      <div className={styles.infoBlocHeader}>
        {adminMode
          ? <input className={styles.infoBlocTitleInput} value={bloc.title} onChange={(e) => onChange({ ...bloc, title: e.target.value })} />
          : <span className={styles.infoBlocLabel}>{bloc.title}</span>
        }
        {adminMode && <button className={styles.plusBtn} onClick={() => setAdding(true)}>+</button>}
      </div>

      <div className={styles.infoBlocBody}>
        {items.length === 0 && <span className={styles.emptyMuted}>—</span>}

        {isIntervenants ? (
          <div className={styles.chipsWrap}>
            {items.map((item) => {
              const color = getAvatarColor(item.name);
              return (
                <div key={item.id} className={styles.avatarChip}>
                  <span className={styles.avatarCircle} style={{ background: color }}>{getInitials(item.name)}</span>
                  <span className={styles.avatarName}>{item.name}</span>
                  {adminMode && <button className={styles.chipDelete} onClick={() => deleteItem(item.id)}>×</button>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.rdvList}>
            {items.map((item) => (
              <div key={item.id} className={styles.rdvItem}>
                <div className={styles.rdvContent}>
                  <span className={styles.rdvName}>{item.name}</span>
                  {item.detail && <span className={styles.rdvDate}>{item.detail}</span>}
                </div>
                {adminMode && <button className={styles.rdvDelete} onClick={() => deleteItem(item.id)}>×</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && (
        <AddModal
          title={`Ajouter — ${bloc.title}`}
          withStatus={false}
          onAdd={addItem}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

// ── PoleCol ────────────────────────────────────────────────────────────────────

function PoleCol({ pole, projets, briefs, adminMode, onUpdateProjets, onUpdateBriefs }) {
  const [modal, setModal] = useState(null);

  return (
    <div className={styles.poleCol}>
      {/* Header */}
      <div className={styles.poleColHeader} style={{ borderTopColor: pole.accent }}>
        <div className={styles.poleName}>{pole.label}</div>
      </div>

      {/* Body: projets + divider + briefs */}
      <div className={styles.poleColBody}>

        {/* Projets */}
        <div className={styles.poleSection}>
          <div className={styles.poleSectionHeader}>
            <span className={styles.poleSectionLabel}>Projets</span>
            {adminMode && <button className={styles.colPlusBtn} onClick={() => setModal("projets")}>+</button>}
          </div>
          <div className={styles.projectList}>
            {projets.length === 0 && <span className={styles.emptyMutedLight}>—</span>}
            {projets.map((item) => (
              <div key={item.id} className={`${styles.projectItem} ${adminMode ? styles.projectItemAdmin : ""}`}>
                <span className={styles.dot} style={{ background: pole.accent }} />
                <div className={styles.projectInfo}>
                  <span className={styles.projectName}>{item.name}</span>
                  {item.detail && <span className={styles.projectDetail}>{item.detail}</span>}
                </div>
                <StatusBadge status={item.status} />
                {adminMode && (
                  <button className={styles.deleteX} onClick={() => onUpdateProjets(projets.filter((p) => p.id !== item.id))}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.poleDivider} />

        {/* Briefs */}
        <div className={styles.poleSection}>
          <div className={styles.poleSectionHeader}>
            <span className={styles.poleSectionLabel}>Briefs actifs</span>
            {adminMode && <button className={styles.colPlusBtn} onClick={() => setModal("briefs")}>+</button>}
          </div>
          <div className={styles.briefList}>
            {briefs.length === 0 && <span className={styles.emptyMutedLight}>—</span>}
            {briefs.map((item) => (
              <div key={item.id} className={`${styles.briefChip} ${adminMode ? styles.briefChipAdmin : ""}`}>
                <span className={styles.dot} style={{ background: pole.accent }} />
                <div className={styles.projectInfo}>
                  <span className={styles.briefName}>{item.name}</span>
                  {item.detail && <span className={styles.projectDetail}>{item.detail}</span>}
                </div>
                {adminMode && (
                  <button className={styles.chipDelete} onClick={() => onUpdateBriefs(briefs.filter((b) => b.id !== item.id))}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {modal === "projets" && (
        <AddModal
          title={`Nouveau projet — ${pole.label}`}
          withStatus
          onAdd={(item) => { onUpdateProjets([...projets, item]); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "briefs" && (
        <AddModal
          title={`Nouveau brief — ${pole.label}`}
          withStatus={false}
          onAdd={(item) => { onUpdateBriefs([...briefs, item]); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MeteoDeSemainePage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const today = new Date();
  const monday = getMonday(today);
  const weekKey = toDateStr(monday);
  const weekNum = getISOWeek(today);
  const weekRange = formatWeekRange(monday);

  const [adminMode, setAdminMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState([]);

  useEffect(() => {
    fetch("/api/meteo-de-la-semaine/weather", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setForecast(d.days ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meteo-de-la-semaine/data?date=${weekKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d.data ?? DEFAULT_DATA(weekKey)))
      .catch(() => setData(DEFAULT_DATA(weekKey)))
      .finally(() => setLoading(false));
  }, [weekKey]);

  useEffect(() => {
    if (!adminMode || !data || loading) return;
    const timer = setTimeout(() => {
      fetch("/api/meteo-de-la-semaine/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: weekKey, columns: data.columns, blocs: data.blocs }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [data, adminMode, loading, weekKey]);

  const updateColumn = useCallback((colKey, sectionKey, items) => {
    setData((prev) => ({
      ...prev,
      columns: { ...prev.columns, [colKey]: { ...prev.columns[colKey], [sectionKey]: items } },
    }));
  }, []);

  const updateBloc = useCallback((updatedBloc) => {
    setData((prev) => ({ ...prev, blocs: prev.blocs.map((b) => b.id === updatedBloc.id ? updatedBloc : b) }));
  }, []);

  const toggleAdmin = () => setAdminMode((v) => !v);

  if (loading) return <div className={styles.loadingPage}>Chargement…</div>;

  const blocs = data?.blocs ?? DEFAULT_DATA(weekKey).blocs;
  const columns = data?.columns ?? DEFAULT_DATA(weekKey).columns;

  const totalProjets = POLES.reduce((sum, pole) => sum + (columns[pole.key]?.projets?.length ?? 0), 0);
  const totalBriefs = POLES.reduce((sum, pole) => sum + (columns[pole.key]?.briefs?.length ?? 0), 0);

  return (
    <div className={styles.page} style={sidebarOpen ? { left: "224px" } : undefined}>

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.burgerBtn} onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}>
          {sidebarOpen ? "✕" : "☰"}
        </button>
        <span className={styles.weekLabel}>Météo de la Semaine</span>
        <div className={styles.topBarDivider} />
        <span className={styles.topBarStats}>S{weekNum} · {totalProjets} Projet{totalProjets !== 1 ? "s" : ""} · {totalBriefs} Brief{totalBriefs !== 1 ? "s" : ""}</span>
        <div className={styles.topBarSpacer} />
        {forecast.length > 0 && (
          <div className={styles.forecastStrip}>
            {forecast.map((f, i) => (
              <div key={i} className={styles.forecastDay}>
                <span className={styles.forecastIcon}>{f.icon}</span>
                <span className={styles.forecastLabel}>{f.day}</span>
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <button className={`${styles.gearBtn} ${adminMode ? styles.gearBtnActive : ""}`} onClick={toggleAdmin} title={adminMode ? "Quitter le mode édition" : "Mode édition"}>
            ⚙
          </button>
        )}
      </div>

      {/* ── Main ── */}
      <div className={styles.main}>

        {/* Info row: week header + 3 blocs */}
        <div className={styles.infoRow}>
          <div className={styles.weekHeader}>
            <div className={styles.weekNumDisplay}>S{weekNum}</div>
            <div className={styles.weekRange}>{weekRange}</div>
          </div>
          {blocs.map((bloc) => (
            <InfoBloc key={bloc.id} bloc={bloc} adminMode={adminMode} onChange={updateBloc} />
          ))}
        </div>

        {/* Poles grid: 4 columns */}
        <div className={styles.polesGrid}>
          {POLES.map((pole) => (
            <PoleCol
              key={pole.key}
              pole={pole}
              projets={columns?.[pole.key]?.projets ?? []}
              briefs={columns?.[pole.key]?.briefs ?? []}
              adminMode={adminMode}
              onUpdateProjets={(items) => updateColumn(pole.key, "projets", items)}
              onUpdateBriefs={(items) => updateColumn(pole.key, "briefs", items)}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
