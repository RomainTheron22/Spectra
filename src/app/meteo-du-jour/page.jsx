"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useSidebar } from "../../lib/sidebar-context";
import styles from "./MeteoDuJour.module.css";

// ── Constants ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "agency",        label: "Agency",        accent: "#0ea5e9" },
  { key: "entertainment", label: "Entertainment", accent: "#8b5cf6" },
  { key: "sfx",           label: "SFX",           accent: "#f59e0b" },
  { key: "creativgen",    label: "CreativGen",    accent: "#22c55e" },
];

const STATUSES = ["En cours", "Nouveau", "Urgent", "En pause", "Terminé", "En attente"];

const STATUS_STYLE = {
  "En cours":   { bg: "#dbeafe", color: "#1d4ed8" },
  "Nouveau":    { bg: "#ede9fe", color: "#6d28d9" },
  "Urgent":     { bg: "#fee2e2", color: "#dc2626" },
  "En pause":   { bg: "#fef3c7", color: "#92400e" },
  "Terminé":    { bg: "#dcfce7", color: "#166534" },
  "En attente": { bg: "#f1f5f9", color: "#475569" },
};

const DEFAULT_DATA = (date) => ({
  date,
  columns: {
    agency:        { projets: [], briefs: [] },
    entertainment: { projets: [], briefs: [] },
    sfx:           { projets: [], briefs: [] },
    creativgen:    { projets: [], briefs: [] },
  },
  blocs: [
    { id: "left",   title: "Notes équipe",      content: "" },
    { id: "center", title: "Infos importantes", content: "" },
    { id: "right",  title: "À surveiller",      content: "" },
  ],
});

function toDateStr(d) {
  return d.toLocaleDateString("fr-CA"); // YYYY-MM-DD
}

function formatHeaderDate(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function uid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE["En attente"];
  return (
    <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

// ── AddItemForm ───────────────────────────────────────────────────────────────
function AddItemForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("En cours");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: uid(), name: name.trim(), detail: detail.trim(), status });
    setName(""); setDetail(""); setStatus("En cours");
  };

  return (
    <form className={styles.addForm} onSubmit={submit}>
      <input
        className={styles.addInput}
        placeholder="Nom…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className={styles.addInput}
        placeholder="Détail…"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <select className={styles.addSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className={styles.addActions}>
        <button type="submit" className={styles.addConfirm}>Ajouter</button>
        <button type="button" className={styles.addCancel} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

// ── ColumnSection ──────────────────────────────────────────────────────────────
function ColumnSection({ colKey, sectionKey, label, items, adminMode, onChange }) {
  const [adding, setAdding] = useState(false);

  const addItem = (item) => {
    onChange([...items, item]);
    setAdding(false);
  };

  const deleteItem = (id) => onChange(items.filter((it) => it.id !== id));

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{label}</div>
      {items.length === 0 && <div className={styles.empty}>Aucun élément</div>}
      <div className={styles.itemList}>
        {items.map((item) => (
          <div key={item.id} className={styles.item}>
            <div className={styles.itemTop}>
              <span className={styles.itemName}>{item.name}</span>
              <div className={styles.itemRight}>
                <StatusBadge status={item.status} />
                {adminMode && (
                  <button className={styles.deleteBtn} onClick={() => deleteItem(item.id)} title="Supprimer">×</button>
                )}
              </div>
            </div>
            {item.detail && <div className={styles.itemDetail}>{item.detail}</div>}
          </div>
        ))}
      </div>
      {adminMode && (
        adding
          ? <AddItemForm onAdd={addItem} onCancel={() => setAdding(false)} />
          : <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Ajouter</button>
      )}
    </div>
  );
}

// ── BlocCard ──────────────────────────────────────────────────────────────────
function BlocCard({ bloc, adminMode, onChange }) {
  const setTitle = (t) => onChange({ ...bloc, title: t });
  const setContent = (c) => onChange({ ...bloc, content: c });

  return (
    <div className={styles.bloc}>
      {adminMode ? (
        <input
          className={styles.blocTitleInput}
          value={bloc.title}
          onChange={(e) => setTitle(e.target.value)}
        />
      ) : (
        <div className={styles.blocTitle}>{bloc.title}</div>
      )}
      {adminMode ? (
        <textarea
          className={styles.blocTextarea}
          value={bloc.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Contenu libre…"
        />
      ) : (
        <div className={styles.blocContent}>
          {bloc.content || <span className={styles.empty}>Aucun contenu</span>}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MeteoDuJourPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const [showTomorrow, setShowTomorrow] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const currentDate = showTomorrow ? tomorrow : today;
  const dateStr = toDateStr(currentDate);

  // ── Fetch ──
  useEffect(() => {
    setLoading(true);
    setIsDirty(false);
    fetch(`/api/meteo-du-jour/data?date=${dateStr}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d.data ?? DEFAULT_DATA(dateStr)))
      .catch(() => setData(DEFAULT_DATA(dateStr)))
      .finally(() => setLoading(false));
  }, [dateStr]);

  // ── Mutations ──
  const updateColumn = useCallback((colKey, sectionKey, items) => {
    setData((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [colKey]: { ...prev.columns[colKey], [sectionKey]: items },
      },
    }));
    setIsDirty(true);
  }, []);

  const updateBloc = useCallback((updatedBloc) => {
    setData((prev) => ({
      ...prev,
      blocs: prev.blocs.map((b) => (b.id === updatedBloc.id ? updatedBloc : b)),
    }));
    setIsDirty(true);
  }, []);

  // ── Save ──
  const save = async () => {
    if (!data || !isDirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/meteo-du-jour/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, columns: data.columns, blocs: data.blocs }),
      });
      if (res.ok) setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const headerDate = formatHeaderDate(currentDate);

  return (
    <div className={styles.page}>

      {/* ── Sticky header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {!sidebarOpen && (
            <button className={styles.burger} onClick={() => setSidebarOpen(true)} title="Afficher la sidebar">
              ☰
            </button>
          )}
          <span className={styles.headerDate}>
            {headerDate.charAt(0).toUpperCase() + headerDate.slice(1)}
          </span>
        </div>

        <h1 className={styles.headerTitle}>Météo du jour</h1>

        <div className={styles.headerRight}>
          <button
            className={`${styles.toggleBtn} ${showTomorrow ? styles.toggleBtnActive : ""}`}
            onClick={() => setShowTomorrow((v) => !v)}
          >
            {showTomorrow ? "← Voir aujourd'hui" : "Voir demain →"}
          </button>

          {isAdmin && (
            <button
              className={`${styles.adminBtn} ${adminMode ? styles.adminBtnActive : ""}`}
              onClick={() => { if (adminMode && isDirty) save(); setAdminMode((v) => !v); }}
            >
              {adminMode ? (isDirty ? "💾 Sauvegarder" : "✓ Terminer") : "⚙ Mode admin"}
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className={styles.loading}>Chargement…</div>
      ) : (
        <>
          {/* ── 4 columns ── */}
          <div className={styles.grid}>
            {COLUMNS.map((col) => (
              <div key={col.key} className={styles.column} style={{ "--col-accent": col.accent }}>
                <div className={styles.colHeader} style={{ borderTopColor: col.accent }}>
                  <span className={styles.colLabel} style={{ color: col.accent }}>{col.label}</span>
                </div>
                <div className={styles.colBody}>
                  <ColumnSection
                    colKey={col.key}
                    sectionKey="projets"
                    label="Projets en cours"
                    items={data?.columns?.[col.key]?.projets ?? []}
                    adminMode={adminMode}
                    onChange={(items) => updateColumn(col.key, "projets", items)}
                  />
                  <div className={styles.sectionDivider} />
                  <ColumnSection
                    colKey={col.key}
                    sectionKey="briefs"
                    label="Briefs en cours"
                    items={data?.columns?.[col.key]?.briefs ?? []}
                    adminMode={adminMode}
                    onChange={(items) => updateColumn(col.key, "briefs", items)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Bottom blocs ── */}
          <div className={styles.blocs}>
            {(data?.blocs ?? []).map((bloc) => (
              <BlocCard
                key={bloc.id}
                bloc={bloc}
                adminMode={adminMode}
                onChange={updateBloc}
              />
            ))}
          </div>

          {/* ── Floating save indicator ── */}
          {adminMode && isDirty && (
            <div className={styles.saveBar}>
              <span>Modifications non sauvegardées</span>
              <button className={styles.saveBarBtn} onClick={save} disabled={saving}>
                {saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
