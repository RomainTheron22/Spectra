"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import styles from "./MonPlanning.module.css";
import Modal from "../../components/ui/Modal";

const TYPE_OPTIONS = [
  { value: "conge", label: "Congé", color: "#10b981", icon: "🌴", desc: "Vacances, repos, journée perso", gradient: "linear-gradient(135deg, #d1fae5, #a7f3d0)" },
  { value: "tt", label: "Télétravail", color: "#06b6d4", icon: "🏡", desc: "Je bosse de chez moi", gradient: "linear-gradient(135deg, #cffafe, #a5f3fc)" },
  { value: "maladie", label: "Maladie", color: "#f43f5e", icon: "🤧", desc: "Arrêt maladie", gradient: "linear-gradient(135deg, #ffe4e6, #fecdd3)" },
  { value: "absence_autre", label: "Autre", color: "#8b5cf6", icon: "✨", desc: "RDV, formation, perso...", gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)" },
];

const STATUT_LABELS = {
  en_attente: { label: "En attente", className: "statutAttente" },
  valide: { label: "Validé", className: "statutValide" },
  refuse: { label: "Refusé", className: "statutRefuse" },
};

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS_SEMAINE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

const DEFAULT_CONGES = 30;

const CONGE_VIBES = [
  { min: 30, emoji: "🌏", message: "Le monde entier est à toi", sub: "Six semaines d'aventure — où tu veux, quand tu veux", tone: "ocean" },
  { min: 25, emoji: "🌅", message: "Un mois de soleil t'attend", sub: "Ferme les yeux. Tu entends les vagues ?", tone: "ocean" },
  { min: 20, emoji: "🗾", message: "Trois semaines au Japon", sub: "Tokyo, Kyoto, ramen, cerisiers en fleur...", tone: "ocean" },
  { min: 15, emoji: "🛤️", message: "Road trip sans fin", sub: "La route, la musique, zéro notification", tone: "warm" },
  { min: 10, emoji: "🏖️", message: "Deux semaines les pieds dans le sable", sub: "Ton seul agenda : lever de soleil, coucher de soleil", tone: "warm" },
  { min: 7, emoji: "🌺", message: "Une semaine à Bali", sub: "Temples, rizières et massages au coucher du soleil", tone: "warm" },
  { min: 4, emoji: "🛫", message: "City-trip à Lisbonne", sub: "Pastéis de nata, azulejos et rooftops", tone: "sunset" },
  { min: 2, emoji: "🏔️", message: "Week-end à la montagne", sub: "L'air pur, le silence, les étoiles", tone: "sunset" },
  { min: 1, emoji: "🧘‍♀️", message: "24h rien que pour toi", sub: "Prends soin de toi. Tu le mérites.", tone: "sunset" },
  { min: 0, emoji: "💫", message: "Full energy — tu es incroyable", sub: "Tu as tout donné. La team est fière.", tone: "energy" },
];

function getCongeVibe(jours) {
  for (const v of CONGE_VIBES) {
    if (jours >= v.min) return v;
  }
  return CONGE_VIBES[CONGE_VIBES.length - 1];
}

function toYMD(date) { return date.toISOString().slice(0, 10); }

function countWorkDays(start, end, demiJournee) {
  if (demiJournee) return 0.5;
  let count = 0;
  const d = new Date(start);
  const endDate = new Date(end);
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Sparkles component
function Sparkles({ active }) {
  if (!active) return null;
  return (
    <div className={styles.sparklesWrap} aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={styles.sparkle} style={{ "--i": i }} />
      ))}
    </div>
  );
}

export default function MonPlanning() {
  const [absences, setAbsences] = useState([]);
  const [profile, setProfile] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [vibeHover, setVibeHover] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeTab, setActiveTab] = useState("absences");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [absRes, profRes] = await Promise.all([
        fetch("/api/employee-absences", { cache: "no-store" }),
        fetch("/api/employee-profiles?mine=true", { cache: "no-store" }),
      ]);
      if (cancelled) return;
      const absData = await absRes.json();
      setAbsences(absData.items || []);
      try {
        const profData = await profRes.json();
        if (profData.items?.length) setProfile(profData.items[0]);
      } catch {}
      setTimeout(() => setLoaded(true), 100);
    })();
    return () => { cancelled = true; };
  }, []);

  const soldeConges = useMemo(() => {
    const credit = profile?.congesAnnuels || DEFAULT_CONGES;
    const year = new Date().getFullYear();
    const pris = absences
      .filter((a) => a.type === "conge" && a.statut === "valide" && a.dateDebut?.startsWith(String(year)))
      .reduce((sum, a) => sum + countWorkDays(a.dateDebut, a.dateFin, a.demiJournee), 0);
    return { credit, pris, reste: credit - pris };
  }, [absences, profile]);

  const vibe = useMemo(() => getCongeVibe(soldeConges.reste), [soldeConges.reste]);

  const absencesByDate = useMemo(() => {
    const map = {};
    for (const a of absences) {
      const d = new Date(a.dateDebut);
      const end = new Date(a.dateFin);
      while (d <= end) {
        const key = toYMD(d);
        if (!map[key]) map[key] = [];
        map[key].push(a);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [absences]);

  const calendarDays = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDay = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDay);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d);
      if (i >= 27 && d.getMonth() !== month) break;
    }
    return days;
  }, [calDate]);

  // Vue semaine
  const weekDays = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  function handleDayClick(date, dayAbsences) {
    const dateStr = toYMD(date);
    const pendingAbsence = dayAbsences.find((a) => a.statut === "en_attente");
    if (pendingAbsence) { openEdit(pendingAbsence); return; }
    setEditId(null);
    setForm({ type: "", dateDebut: dateStr, dateFin: dateStr, demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openNew() {
    setEditId(null);
    setForm({ type: "", dateDebut: "", dateFin: "", demiJournee: "", commentaire: "" });
    setModalOpen(true);
  }

  function openEdit(absence) {
    setEditId(String(absence._id));
    setForm({
      type: absence.type,
      dateDebut: absence.dateDebut,
      dateFin: absence.dateFin,
      demiJournee: absence.demiJournee || "",
      commentaire: absence.commentaire || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type) { alert("Choisis un type d'absence"); return; }
    if (form.dateDebut > form.dateFin) { alert("La date de fin doit être après la date de début"); return; }
    setSaving(true);
    const body = { type: form.type, dateDebut: form.dateDebut, dateFin: form.dateFin, demiJournee: form.demiJournee || null, commentaire: form.commentaire };
    const url = editId ? `/api/employee-absences/${editId}` : "/api/employee-absences";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || "Erreur"); return; }

    if (editId) {
      setAbsences((prev) => prev.map((a) => (String(a._id) === editId ? data.item : a)));
    } else {
      setAbsences((prev) => [data.item, ...prev]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
    setModalOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette demande ?")) return;
    const res = await fetch(`/api/employee-absences/${id}`, { method: "DELETE" });
    if (res.ok) setAbsences((prev) => prev.filter((a) => String(a._id) !== id));
  }

  const today = toYMD(new Date());
  const month = calDate.getMonth();
  const pct = Math.max(3, (soldeConges.reste / soldeConges.credit) * 100);

  return (
    <div className={styles.page}>

      {/* Confetti overlay */}
      {showConfetti && (
        <div className={styles.confettiWrap} aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className={styles.confetti} style={{ "--ci": i }} />
          ))}
        </div>
      )}

      {/* ═══ VIBE HERO ═══ */}
      <div
        className={`${styles.vibeHero} ${styles[`vibe_${vibe.tone}`] || ""} ${loaded ? styles.vibeLoaded : ""}`}
        onMouseEnter={() => setVibeHover(true)}
        onMouseLeave={() => setVibeHover(false)}
      >
        <Sparkles active={vibeHover} />
        <div className={styles.vibeEmojiWrap}>
          <span className={`${styles.vibeEmoji} ${loaded ? styles.vibeEmojiLoaded : ""}`}>{vibe.emoji}</span>
        </div>
        <div className={styles.vibeCenter}>
          <h1 className={styles.vibeMessage}>{vibe.message}</h1>
          <p className={styles.vibeSub}>{vibe.sub}</p>
          <div className={styles.vibeBarWrap}>
            <div className={styles.vibeBar}>
              <div className={`${styles.vibeBarFill} ${loaded ? styles.vibeBarFillLoaded : ""}`} style={{ "--target-width": `${pct}%` }} />
            </div>
            <span className={styles.vibeCount}>{soldeConges.reste}j / {soldeConges.credit}</span>
          </div>
        </div>
        <button className={styles.vibeAction} onClick={openNew}>
          <span className={styles.vibeActionPlus}>+</span>
          Poser une absence
        </button>
      </div>

      {/* ═══ TABS ═══ */}
      <div className={styles.tabBar}>
        <button className={`${styles.tab} ${activeTab === "absences" ? styles.tabActive : ""}`} onClick={() => setActiveTab("absences")}>
          🌴 Mes absences
        </button>
        <button className={`${styles.tab} ${activeTab === "projets" ? styles.tabActive : ""}`} onClick={() => setActiveTab("projets")}>
          🎬 Mes projets
        </button>
        <button className={`${styles.tab} ${activeTab === "semaine" ? styles.tabActive : ""}`} onClick={() => setActiveTab("semaine")}>
          📅 Ma semaine
        </button>
      </div>

      {/* ═══ TAB: ABSENCES ═══ */}
      {activeTab === "absences" && (
        <>
          {/* Calendrier */}
          <section className={styles.calSection}>
            <div className={styles.calToolbar}>
              <button className={styles.calNav} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}>
                <span className={styles.calNavArrow}>‹</span>
              </button>
              <h2 className={styles.calTitle}>{MOIS[month]} {calDate.getFullYear()}</h2>
              <button className={styles.calNav} onClick={() => setCalDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}>
                <span className={styles.calNavArrow}>›</span>
              </button>
            </div>

            <div className={styles.legend}>
              {TYPE_OPTIONS.map((t) => (
                <span key={t.value} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: t.color }} />
                  {t.label}
                </span>
              ))}
            </div>

            <div className={styles.calGrid}>
              {JOURS_SEMAINE.map((j) => <div key={j} className={styles.calHeader}>{j}</div>)}
              {calendarDays.map((d, i) => {
                const key = toYMD(d);
                const isMonth = d.getMonth() === month;
                const isToday = key === today;
                const dayAbsences = absencesByDate[key] || [];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const canClick = isMonth && !isWeekend;
                const mainAbsence = dayAbsences[0];
                const mainType = mainAbsence ? TYPE_OPTIONS.find((t) => t.value === mainAbsence.type) : null;
                const isPending = mainAbsence?.statut === "en_attente";

                return (
                  <div
                    key={i}
                    className={[styles.calDay, isToday && styles.calDayToday, !isMonth && styles.calDayOther, isWeekend && styles.calDayWeekend, canClick && styles.calDayClickable, mainAbsence && styles.calDayHasAbsence, isPending && styles.calDayPending].filter(Boolean).join(" ")}
                    style={mainType && !isPending ? { "--day-color": mainType.color } : undefined}
                    onClick={() => canClick && handleDayClick(d, dayAbsences)}
                    role={canClick ? "button" : undefined}
                    tabIndex={canClick ? 0 : undefined}
                    onKeyDown={(e) => { if (canClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleDayClick(d, dayAbsences); } }}
                  >
                    <span className={styles.calDayNum}>{d.getDate()}</span>
                    {mainAbsence && <span className={styles.calDayLabel}>{mainType?.icon} {mainType?.label}</span>}
                    {!mainAbsence && canClick && <span className={styles.calDayPlus}>+</span>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Liste */}
          <section className={styles.listSection}>
            <h2 className={styles.sectionTitle}>Mes demandes</h2>
            {absences.length === 0 && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🌈</span>
                <p className={styles.emptyText}>Rien de prévu pour le moment</p>
                <p className={styles.emptyHint}>Clique sur un jour du calendrier pour poser ta première absence</p>
              </div>
            )}
            <div className={styles.absenceList}>
              {absences.map((a) => {
                const typeOpt = TYPE_OPTIONS.find((t) => t.value === a.type);
                const statut = STATUT_LABELS[a.statut] || { label: a.statut, className: "" };
                const canEdit = a.statut === "en_attente";
                const jours = countWorkDays(a.dateDebut, a.dateFin, a.demiJournee);
                return (
                  <div key={String(a._id)} className={styles.absenceCard} style={{ "--card-color": typeOpt?.color || "#888" }}>
                    <div className={styles.absenceCardIcon}>{typeOpt?.icon || "📋"}</div>
                    <div className={styles.absenceCardBody}>
                      <div className={styles.absenceCardTop}>
                        <span className={styles.absenceCardType}>{typeOpt?.label || a.type}</span>
                        <span className={`${styles.absenceCardStatut} ${styles[statut.className] || ""}`}>{statut.label}</span>
                      </div>
                      <div className={styles.absenceCardDates}>
                        {a.dateDebut === a.dateFin ? a.dateDebut : `${a.dateDebut} → ${a.dateFin}`}
                        <span className={styles.absenceCardJours}>{jours}j</span>
                        {a.demiJournee && <span className={styles.demiTag}>{a.demiJournee}</span>}
                      </div>
                      {a.commentaire && <p className={styles.absenceCardComment}>{a.commentaire}</p>}
                      {a.motifRefus && <p className={styles.absenceCardRefus}>Motif : {a.motifRefus}</p>}
                    </div>
                    {canEdit && (
                      <div className={styles.absenceCardActions}>
                        <button className={styles.editBtn} onClick={() => openEdit(a)}>Modifier</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(String(a._id))}>Supprimer</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ═══ TAB: PROJETS (design-ready) ═══ */}
      {activeTab === "projets" && (
        <section className={styles.comingSoonSection}>
          <div className={styles.comingSoonCard}>
            <span className={styles.comingSoonEmoji}>🎬</span>
            <h2 className={styles.comingSoonTitle}>Tes projets arrivent ici</h2>
            <p className={styles.comingSoonDesc}>
              Bientôt tu pourras voir tous les projets sur lesquels tu es assigné,
              leur avancement, et les dates clés — directement depuis ton planning.
            </p>
            <div className={styles.comingSoonPreview}>
              <div className={styles.previewCard}>
                <span className={styles.previewDot} style={{ background: "#10b981" }} />
                <div>
                  <div className={styles.previewTitle}>Tournage Clip Artiste X</div>
                  <div className={styles.previewMeta}>En production · 15 → 20 mai</div>
                </div>
              </div>
              <div className={styles.previewCard}>
                <span className={styles.previewDot} style={{ background: "#06b6d4" }} />
                <div>
                  <div className={styles.previewTitle}>Scénographie Salon Y</div>
                  <div className={styles.previewMeta}>Conception · 1 → 12 juin</div>
                </div>
              </div>
              <div className={styles.previewCard}>
                <span className={styles.previewDot} style={{ background: "#8b5cf6" }} />
                <div>
                  <div className={styles.previewTitle}>Podcast Saison 3</div>
                  <div className={styles.previewMeta}>Stand-by · Date TBD</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ TAB: MA SEMAINE ═══ */}
      {activeTab === "semaine" && (
        <section className={styles.weekSection}>
          <h2 className={styles.sectionTitle}>Cette semaine</h2>
          <div className={styles.weekCards}>
            {weekDays.map((d, i) => {
              const dateStr = toYMD(d);
              const isToday = dateStr === today;
              const dayAbs = absencesByDate[dateStr] || [];
              const mainAbs = dayAbs[0];
              const mainType = mainAbs ? TYPE_OPTIONS.find((t) => t.value === mainAbs.type) : null;
              return (
                <div
                  key={i}
                  className={`${styles.weekDayCard} ${isToday ? styles.weekDayToday : ""} ${mainAbs ? styles.weekDayAbsent : ""}`}
                  style={mainType ? { "--wk-color": mainType.color } : undefined}
                  onClick={() => handleDayClick(d, dayAbs)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDayClick(d, dayAbs); } }}
                >
                  <div className={styles.weekDayName}>{JOURS_FULL[i]}</div>
                  <div className={styles.weekDayDate}>{d.getDate()} {MOIS[d.getMonth()].slice(0, 3)}</div>
                  {mainAbs ? (
                    <div className={styles.weekDayStatus}>
                      <span className={styles.weekDayIcon}>{mainType?.icon}</span>
                      <span>{mainType?.label}</span>
                    </div>
                  ) : (
                    <div className={styles.weekDayFree}>
                      <span>Au bureau</span>
                      <span className={styles.weekDayAddHint}>+ ajouter</span>
                    </div>
                  )}
                  {isToday && <span className={styles.weekDayBadge}>Aujourd'hui</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ MODALE ═══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Modifier l'absence" : "Poser une absence"} size="sm">
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.formHint}>Quel type ?</p>
          <div className={styles.typeGrid}>
            {TYPE_OPTIONS.map((t) => (
              <button key={t.value} type="button" className={`${styles.typeCard} ${form.type === t.value ? styles.typeCardActive : ""}`} style={{ "--tc": t.color, "--tc-bg": t.gradient }} onClick={() => setForm((f) => ({ ...f, type: t.value }))}>
                <span className={styles.typeCardIcon}>{t.icon}</span>
                <span className={styles.typeCardLabel}>{t.label}</span>
                <span className={styles.typeCardDesc}>{t.desc}</span>
              </button>
            ))}
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Du<input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} required /></label>
            <label className={styles.fieldLabel}>Au<input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} required /></label>
          </div>

          <label className={styles.fieldLabel}>Demi-journée ?
            <select value={form.demiJournee} onChange={(e) => setForm((f) => ({ ...f, demiJournee: e.target.value }))}>
              <option value="">Journée complète</option>
              <option value="matin">Matin uniquement</option>
              <option value="apres-midi">Après-midi uniquement</option>
            </select>
          </label>

          <label className={styles.fieldLabel}>Un petit mot ?
            <textarea value={form.commentaire} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))} rows={2} placeholder="Voyage en famille, recharge, aventure..." />
          </label>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)} disabled={saving}>Annuler</button>
            <button type="submit" className={styles.submitBtn} disabled={saving || !form.type}>
              {saving ? "Envoi..." : editId ? "Modifier" : "C'est parti ! 🚀"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
