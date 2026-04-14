"use client";

import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { useSidebar } from "@/components/ui/sidebar";
import styles from "./MeteoDuJour.module.css";

// ── Constants ──────────────────────────────────────────────────────────────────

const TAG_LABELS = {
  "en-cours":  "En cours",
  "prep":      "Préparation",
  "tournage":  "Tournage",
  "livraison": "Livraison",
};

const BADGE_TYPES  = ["victoire", "challenge", "alerte", "info"];
const BADGE_LABELS = { victoire: "Victoire", challenge: "Challenge", alerte: "Alerte", info: "Info" };

const DAYS   = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const DEFAULT_DATA = (date) => ({
  date,
  energie: { type: "challenge", title: "Énergie du jour", body: "" },
  rdvs: [],
  citation: { label: "Citation", text: "" },
  espaces: [
    { id: "atelier", name: "Atelier", projets: [] },
    { id: "studio",  name: "Studio",  projets: [] },
    { id: "bureau",  name: "Bureau",  projets: [] },
    { id: "fablab",  name: "Fablab",  projets: [] },
  ],
});

function uid() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function toDateStr(d) { return d.toLocaleDateString("fr-CA"); }

function formatDate(d) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const AVATAR_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#e11d48", "#0284c7", "#ec4899"];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

// Parse "14h30", "9h", "9h00", "14:30" → minutes depuis minuit (ou Infinity si vide)
function parseHeure(h) {
  if (!h) return Infinity;
  const m = h.replace(":", "h").match(/^(\d{1,2})h?(\d{0,2})$/i);
  if (!m) return Infinity;
  return parseInt(m[1], 10) * 60 + (parseInt(m[2] || "0", 10) || 0);
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function Modal({ title, fields, onConfirm, onClose }) {
  const [values, setValues] = useState(
    fields.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue || "" }), {})
  );

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const confirm = () => {
    const hasRequired = fields.filter((f) => f.required).every((f) => values[f.key]?.trim());
    if (!hasRequired) return;
    onConfirm(values);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{title}</div>
        {fields.map((f, i) =>
          f.type === "select" ? (
            <select
              key={f.key}
              className={styles.modalInput}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              key={f.key}
              className={styles.modalInput}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              autoFocus={i === 0}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
          )
        )}
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>Annuler</button>
          <button className={styles.modalConfirm} onClick={confirm}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

// ── Groupes ────────────────────────────────────────────────────────────────────

const GROUPES = ["Scéno", "Com.", "Montage", "Production", "Direction", "Studio", "Fablab", "Technique"];

// ── RdvModal ───────────────────────────────────────────────────────────────────

function RdvModal({ members, onConfirm, onClose }) {
  const [heure, setHeure]       = useState("");
  const [titre, setTitre]       = useState("");
  const [attrType, setAttrType] = useState("aucun"); // "aucun" | "groupe" | "personnes"
  const [groupe, setGroupe]     = useState(GROUPES[0]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePerson = (m) =>
    setSelected((prev) =>
      prev.find((p) => p.id === m.id) ? prev.filter((p) => p.id !== m.id) : [...prev, m]
    );

  const confirm = () => {
    if (!titre.trim()) return;
    onConfirm({
      heure,
      titre,
      attrType: attrType === "aucun" ? null : attrType,
      groupe:   attrType === "groupe" ? groupe : null,
      people:   attrType === "personnes" ? selected : [],
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>Ajouter un RDV</div>

        <input className={styles.modalInput} placeholder="Heure (ex: 14h30)" value={heure}
          onChange={(e) => setHeure(e.target.value)} autoFocus />
        <input className={styles.modalInput} placeholder="Titre…" value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm()} />

        {/* Toggle attribution */}
        <div className={styles.rdvAttrToggle}>
          {["aucun", "groupe", "personnes"].map((t) => (
            <button
              key={t}
              className={`${styles.rdvAttrBtn} ${attrType === t ? styles.rdvAttrBtnActive : ""}`}
              onClick={() => setAttrType(t)}
            >
              {t === "aucun" ? "Sans attribution" : t === "groupe" ? "Groupe" : "Personnes"}
            </button>
          ))}
        </div>

        {attrType === "groupe" && (
          <div className={styles.groupeGrid}>
            {GROUPES.map((g) => (
              <button
                key={g}
                className={`${styles.groupeBtn} ${groupe === g ? styles.groupeBtnActive : ""}`}
                onClick={() => setGroupe(g)}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {attrType === "personnes" && (
          <div className={styles.memberList}>
            {members.map((m) => {
              const active = !!selected.find((p) => p.id === m.id);
              return (
                <button
                  key={m.id}
                  className={`${styles.memberItem} ${active ? styles.memberItemActive : ""}`}
                  onClick={() => togglePerson(m)}
                >
                  <span className={styles.memberAvatar} style={{ background: avatarColor(m.name) }}>
                    {initials(m.name)}
                  </span>
                  <span className={styles.memberName}>{m.name}</span>
                  {active && <span className={styles.memberCheck}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>Annuler</button>
          <button className={styles.modalConfirm} onClick={confirm}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MeteoDuJourPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin";
  const { open: sidebarOpen, toggleSidebar } = useSidebar();

  const today     = new Date();
  const dateKey   = toDateStr(today);
  const dateLabel = formatDate(today);

  const [adminMode, setAdminMode] = useState(false);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [weather, setWeather]     = useState(null);
  const [members, setMembers]     = useState([]);
  const [modal, setModal]         = useState(null); // { type, espaceId? }

  // Load page data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/meteo-du-jour/data?date=${dateKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d.data ?? DEFAULT_DATA(dateKey)))
      .catch(() => setData(DEFAULT_DATA(dateKey)))
      .finally(() => setLoading(false));
  }, [dateKey]);

  // Load weather
  useEffect(() => {
    fetch("/api/meteo-du-jour/weather", { cache: "no-store" })
      .then((r) => r.json())
      .then(setWeather)
      .catch(() => {});
  }, []);

  // Load members
  useEffect(() => {
    fetch("/api/meteo-du-jour/members", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => {});
  }, []);

  // Auto-save when data changes in admin mode
  useEffect(() => {
    if (!adminMode || !data || loading) return;
    const timer = setTimeout(() => {
      fetch("/api/meteo-du-jour/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, ...data }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [data, adminMode, loading, dateKey]);

  const toggleAdmin = () => setAdminMode((v) => !v);

  if (loading) return <div className={styles.loading}>Chargement…</div>;

  const { energie, rdvs, citation, espaces } = data;

  // ── Handlers ──

  const patchEnergie = (patch) =>
    setData((prev) => ({ ...prev, energie: { ...prev.energie, ...patch } }));

  const patchCitation = (patch) =>
    setData((prev) => ({ ...prev, citation: { ...prev.citation, ...patch } }));

  const addRdv = (v) =>
    setData((prev) => ({
      ...prev,
      rdvs: [...(prev.rdvs || []), {
        id: uid(),
        heure: v.heure,
        titre: v.titre,
        attrType: v.attrType,
        groupe: v.groupe,
        people: v.people,
      }],
    }));

  const delRdv = (id) =>
    setData((prev) => ({ ...prev, rdvs: prev.rdvs.filter((r) => r.id !== id) }));

  const addProjet = (espaceId, v) =>
    setData((prev) => ({
      ...prev,
      espaces: prev.espaces.map((e) =>
        e.id === espaceId
          ? { ...e, projets: [...e.projets, { id: uid(), name: v.name, detail: v.detail, tag: v.tag }] }
          : e
      ),
    }));

  const delProjet = (espaceId, projId) =>
    setData((prev) => ({
      ...prev,
      espaces: prev.espaces.map((e) =>
        e.id === espaceId ? { ...e, projets: e.projets.filter((p) => p.id !== projId) } : e
      ),
    }));

  const addEspace = (v) =>
    setData((prev) => ({
      ...prev,
      espaces: [...prev.espaces, { id: uid(), name: v.name, projets: [] }],
    }));

  const delEspace = (espaceId) =>
    setData((prev) => ({
      ...prev,
      espaces: prev.espaces.filter((e) => e.id !== espaceId),
    }));

  // ── Render ──

  return (
    <div className={styles.page} style={{ left: sidebarOpen ? "var(--sidebar-width, 16rem)" : "0" }}>

      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button
            className={styles.burgerBtn}
            onClick={toggleSidebar}
            title={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <h1 className={styles.pageTitle}>Météo du jour</h1>
          <span className={styles.dateLabel}>{dateLabel}</span>
        </div>
        <div className={styles.headerRight}>
          {weather && (
            <div className={styles.weatherChip}>
              <span className={styles.weatherIcon}>{weather.icon}</span>
              <span className={styles.weatherTemp}>
                {weather.temp != null ? `${weather.temp}°C` : "—°C"}
              </span>
              <span className={styles.weatherDesc}>{weather.desc}</span>
            </div>
          )}
          {isAdmin && (
            <button
              className={`${styles.gearBtn} ${adminMode ? styles.gearBtnActive : ""}`}
              onClick={toggleAdmin}
              title={adminMode ? "Quitter le mode édition" : "Mode édition"}
            >
              ⚙
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Top zone */}
        <div className={styles.topZone}>

          {/* Énergie du jour */}
          <div className={styles.energie}>
            <div className={styles.energieBadgeRow}>
              <span className={`${styles.energieBadge} ${styles[`badge_${energie.type}`]}`}>
                {BADGE_LABELS[energie.type]}
              </span>
              <span className={styles.journalDate}>{dateLabel}</span>
              {adminMode && (
                <div className={styles.energieTypeRow}>
                  {BADGE_TYPES.map((t) => (
                    <button
                      key={t}
                      className={`${styles.energieTypeBtn} ${energie.type === t ? styles.energieTypeBtnActive : ""}`}
                      onClick={() => patchEnergie({ type: t })}
                    >
                      {BADGE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {adminMode ? (
              <input
                className={styles.energieTitleInput}
                value={energie.title}
                onChange={(e) => patchEnergie({ title: e.target.value })}
                placeholder="Titre de l'énergie du jour…"
              />
            ) : (
              <div className={styles.energieTitle}>{energie.title}</div>
            )}

            {adminMode ? (
              <textarea
                className={styles.energieBodyInput}
                value={energie.body}
                onChange={(e) => patchEnergie({ body: e.target.value })}
                placeholder="Description…"
              />
            ) : (
              energie.body && <div className={styles.energieBody}>{energie.body}</div>
            )}
          </div>

          {/* Side info */}
          <div className={styles.sideInfo}>

            {/* RDV du jour */}
            <div className={styles.rdvSection}>
              <div className={styles.sideLabel}>
                <span>RDV du jour</span>
                {adminMode && (
                  <button className={styles.sideAddBtn} onClick={() => setModal({ type: "rdv" })}>+</button>
                )}
              </div>
              <div className={styles.rdvList}>
                {rdvs.length === 0 && <span className={styles.emptyMuted}>—</span>}
                {[...rdvs].sort((a, b) => parseHeure(a.heure) - parseHeure(b.heure)).map((rdv) => (
                  <div key={rdv.id} className={styles.rdvItem}>
                    <span className={styles.rdvHeure}>{rdv.heure || "—"}</span>
                    <span className={styles.rdvTitre}>{rdv.titre}</span>
                    {rdv.attrType === "groupe" && rdv.groupe && (
                      <span className={styles.rdvGroupeTag} style={{ background: avatarColor(rdv.groupe) }}>
                        {rdv.groupe}
                      </span>
                    )}
                    {rdv.attrType === "personnes" && rdv.people?.length > 0 && (
                      <div className={styles.rdvChips}>
                        {rdv.people.map((p) => (
                          <span key={p.id} className={styles.rdvChip}
                            style={{ background: avatarColor(p.name) }} title={p.name}>
                            {initials(p.name)}
                          </span>
                        ))}
                      </div>
                    )}
                    {adminMode && (
                      <button className={styles.rdvDel} onClick={() => delRdv(rdv.id)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Citation */}
            <div className={styles.citationSection}>
              {adminMode ? (
                <input
                  className={styles.citationLabelInput}
                  value={citation.label}
                  onChange={(e) => patchCitation({ label: e.target.value })}
                />
              ) : (
                <div className={styles.citationLabel}>{citation.label}</div>
              )}
              {adminMode ? (
                <textarea
                  className={styles.citationTextInput}
                  value={citation.text}
                  onChange={(e) => patchCitation({ text: e.target.value })}
                  placeholder="Citation du jour…"
                />
              ) : (
                <div className={styles.citationText}>
                  {citation.text || <span className={styles.emptyMuted}>—</span>}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Bottom zone */}
        <div className={styles.bottomZone}>
          <div className={styles.bzHead}>
            <span className={styles.bzTitle}>Projets du jour</span>
            {adminMode && (
              <button className={styles.bzAddBtn} onClick={() => setModal({ type: "espace" })}>
                + Espace
              </button>
            )}
          </div>

          <div className={styles.espacesStrips}>
            {(espaces || []).map((espace) => (
              <div key={espace.id} className={styles.espStrip}>
                <div className={styles.espId}>
                  <div className={styles.espNameRow}>
                    <div className={styles.espName}>{espace.name}</div>
                    <div className={styles.espCount}>
                      {espace.projets.length} projet{espace.projets.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {adminMode && (
                    <button
                      className={styles.espDelBtn}
                      onClick={() => delEspace(espace.id)}
                      title="Supprimer cet espace"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className={styles.espContent}>
                  {(espace.projets || []).map((proj) => (
                    <div
                      key={proj.id}
                      className={`${styles.projPill} ${adminMode ? styles.projPillAdmin : ""}`}
                    >
                      <span className={styles.projName}>{proj.name}</span>
                      {proj.detail && (
                        <>
                          <span className={styles.projSep}>·</span>
                          <span className={styles.projDetail}>{proj.detail}</span>
                        </>
                      )}
                      <span className={`${styles.projTag} ${styles[`tag_${proj.tag}`]}`}>
                        {TAG_LABELS[proj.tag] || proj.tag}
                      </span>
                      {adminMode && (
                        <button
                          className={styles.projDel}
                          onClick={() => delProjet(espace.id, proj.id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {adminMode && (
                    <button
                      className={styles.espAddBtn}
                      onClick={() => setModal({ type: "proj", espaceId: espace.id })}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Modales ── */}
      {modal?.type === "rdv" && (
        <RdvModal members={members} onConfirm={addRdv} onClose={() => setModal(null)} />
      )}
      {modal?.type === "proj" && (
        <Modal
          title={`Ajouter — ${espaces.find((e) => e.id === modal.espaceId)?.name || ""}`}
          fields={[
            { key: "name",   placeholder: "Nom du projet…", required: true },
            { key: "detail", placeholder: "Détail…" },
            {
              key: "tag",
              type: "select",
              defaultValue: "en-cours",
              options: Object.entries(TAG_LABELS).map(([value, label]) => ({ value, label })),
            },
          ]}
          onConfirm={(v) => addProjet(modal.espaceId, v)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "espace" && (
        <Modal
          title="Nouvel espace"
          fields={[
            { key: "name", placeholder: "Nom (ex: Garage n°2)", required: true },
          ]}
          onConfirm={addEspace}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  );
}
