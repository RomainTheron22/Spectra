"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./Pilotage.module.css";
import Modal from "../../../components/ui/Modal";

const TYPE_LABELS = { conge: "Congé", tt: "Télétravail", maladie: "Maladie", absence_autre: "Absence" };
const TYPE_COLORS = { conge: "#22c55e", tt: "#0ea5e9", maladie: "#ef4444", absence_autre: "#a855f7" };

const JOURS_SEMAINE = ["lun", "mar", "mer", "jeu", "ven"];
const JOURS_LABELS = { lun: "Lun", mar: "Mar", mer: "Mer", jeu: "Jeu", ven: "Ven" };

function toYMD(date) { return date.toISOString().slice(0, 10); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

function getWeekDates(refDate) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return JOURS_SEMAINE.map((_, i) => addDays(monday, i));
}

function isAbsentOnDate(absence, dateStr) {
  return absence.dateDebut <= dateStr && absence.dateFin >= dateStr && absence.statut === "valide";
}

function isPendingOnDate(absence, dateStr) {
  return absence.dateDebut <= dateStr && absence.dateFin >= dateStr && absence.statut === "en_attente";
}

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

export default function PilotagePage() {
  const [profiles, setProfiles] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [weekRef, setWeekRef] = useState(new Date());
  const [refusModal, setRefusModal] = useState(null);
  const [motifRefus, setMotifRefus] = useState("");
  const [impactModal, setImpactModal] = useState(null);

  const reload = useCallback(async () => {
    const [profRes, absRes] = await Promise.all([
      fetch("/api/employee-profiles", { cache: "no-store" }),
      fetch("/api/employee-absences?all=true", { cache: "no-store" }),
    ]);
    const profData = await profRes.json();
    const absData = await absRes.json();
    setProfiles(profData.items || []);
    setAbsences(absData.items || []);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);

  // Demandes en attente
  const pendingRequests = useMemo(
    () => absences.filter((a) => a.statut === "en_attente").sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)),
    [absences]
  );

  // Remplissage du jour
  const todayStr = toYMD(new Date());
  const todayStats = useMemo(() => {
    const activeProfiles = profiles.filter((p) => p.isActive !== false);
    const todayJour = JOURS_SEMAINE[new Date().getDay() - 1];
    const expectedToday = activeProfiles.filter((p) => (p.joursPresence || []).includes(todayJour));
    const absentToday = expectedToday.filter((p) =>
      absences.some((a) => isAbsentOnDate(a, todayStr) && a.employeeProfileId === String(p._id))
    );
    return {
      expected: expectedToday.length,
      present: expectedToday.length - absentToday.length,
      absent: absentToday,
      total: activeProfiles.length,
    };
  }, [profiles, absences, todayStr]);

  // Zones rouges de la semaine
  const zonesRouges = useMemo(() => {
    const alerts = [];
    for (const date of weekDates) {
      const dateStr = toYMD(date);
      const jourKey = JOURS_SEMAINE[date.getDay() - 1];
      if (!jourKey) continue;
      const expected = profiles.filter((p) => p.isActive !== false && (p.joursPresence || []).includes(jourKey));
      const absentCount = expected.filter((p) =>
        absences.some((a) => isAbsentOnDate(a, dateStr) && a.employeeProfileId === String(p._id))
      ).length;
      const presentCount = expected.length - absentCount;
      if (presentCount <= 3 && expected.length > 0) {
        alerts.push({ date: dateStr, jourKey, expected: expected.length, present: presentCount, absent: absentCount });
      }
    }
    return alerts;
  }, [profiles, absences, weekDates]);

  // Fins de contrat < 60 jours
  const finsContrat = useMemo(() => {
    const now = new Date();
    return profiles
      .filter((p) => p.dateFin && p.isActive !== false)
      .filter((p) => {
        const end = new Date(p.dateFin);
        const diff = (end - now) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff < 60;
      })
      .sort((a, b) => (a.dateFin > b.dateFin ? 1 : -1));
  }, [profiles]);

  // Simulation d'impact
  function simulateImpact(absence) {
    const impacts = [];
    const d = new Date(absence.dateDebut);
    const end = new Date(absence.dateFin);
    while (d <= end) {
      const dateStr = toYMD(d);
      const jourKey = JOURS_SEMAINE[d.getDay() - 1];
      if (jourKey) {
        const expected = profiles.filter((p) => p.isActive !== false && (p.joursPresence || []).includes(jourKey));
        const alreadyAbsent = expected.filter((p) =>
          absences.some((a) => a._id !== absence._id && isAbsentOnDate(a, dateStr) && a.employeeProfileId === String(p._id))
        ).length;
        const presentIfValidated = expected.length - alreadyAbsent - 1;
        impacts.push({ date: dateStr, jour: JOURS_LABELS[jourKey], expected: expected.length, present: presentIfValidated, isRed: presentIfValidated <= 3 });
      }
      d.setDate(d.getDate() + 1);
    }
    return impacts;
  }

  async function handleValidate(absence) {
    const impact = simulateImpact(absence);
    const hasRed = impact.some((i) => i.isRed);
    if (hasRed) {
      setImpactModal({ absence, impact });
      return;
    }
    await doValidate(absence._id);
  }

  async function doValidate(id) {
    const res = await fetch(`/api/employee-absences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "valide" }),
    });
    if (res.ok) {
      setImpactModal(null);
      reload();
    }
  }

  function openRefus(absence) {
    setMotifRefus("");
    setRefusModal(absence);
  }

  async function doRefus() {
    if (!motifRefus.trim()) { alert("Le motif est obligatoire"); return; }
    const res = await fetch(`/api/employee-absences/${refusModal._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "refuse", motifRefus }),
    });
    if (res.ok) {
      setRefusModal(null);
      reload();
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Pilotage RH</h1>
          <p className={styles.subtitle}>Vue d'ensemble, validation et alertes</p>
        </div>
      </div>

      {/* Remplissage du jour */}
      <div className={styles.todayCard}>
        <div className={styles.todayHeader}>
          <h2 className={styles.sectionTitle}>Aujourd'hui</h2>
          <span className={`${styles.todayBadge} ${todayStats.present <= 3 ? styles.badgeRed : todayStats.present <= todayStats.expected * 0.6 ? styles.badgeOrange : styles.badgeGreen}`}>
            {todayStats.present}/{todayStats.expected} présents
          </span>
        </div>
        {todayStats.absent.length > 0 && (
          <div className={styles.absentList}>
            <span className={styles.absentLabel}>Absents :</span>
            {todayStats.absent.map((p) => (
              <span key={String(p._id)} className={styles.absentChip}>{p.prenom} {p.nom}</span>
            ))}
          </div>
        )}
      </div>

      {/* Zones rouges */}
      {zonesRouges.length > 0 && (
        <div className={styles.alertCard}>
          <h2 className={styles.sectionTitle}>Zones rouges cette semaine</h2>
          {zonesRouges.map((z) => (
            <div key={z.date} className={styles.alertRow}>
              <span className={styles.alertDot} />
              <span className={styles.alertText}>
                {z.date} ({JOURS_LABELS[z.jourKey]}) — seulement <strong>{z.present}/{z.expected}</strong> présents
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fins de contrat */}
      {finsContrat.length > 0 && (
        <div className={styles.finCard}>
          <h2 className={styles.sectionTitle}>Fins de contrat &lt; 60 jours</h2>
          {finsContrat.map((p) => {
            const days = Math.ceil((new Date(p.dateFin) - new Date()) / (1000 * 60 * 60 * 24));
            return (
              <div key={String(p._id)} className={styles.finRow}>
                <span className={styles.finName}>{p.prenom} {p.nom}</span>
                <span className={styles.finContrat}>{p.contrat}</span>
                <span className={`${styles.finDays} ${days < 30 ? styles.finDaysUrgent : ""}`}>{days}j restants — {p.dateFin}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Demandes en attente */}
      <div className={styles.pendingCard}>
        <h2 className={styles.sectionTitle}>
          Demandes en attente
          {pendingRequests.length > 0 && <span className={styles.pendingCount}>{pendingRequests.length}</span>}
        </h2>
        {pendingRequests.length === 0 && <p className={styles.empty}>Aucune demande en attente</p>}
        {pendingRequests.map((a) => {
          const jours = countWorkDays(a.dateDebut, a.dateFin, a.demiJournee);
          return (
            <div key={String(a._id)} className={styles.pendingRow}>
              <div className={styles.pendingInfo}>
                <span className={styles.pendingName}>{a.employeeNom}</span>
                <span className={styles.pendingType} style={{ background: `${TYPE_COLORS[a.type] || "#888"}18`, color: TYPE_COLORS[a.type] || "#888" }}>
                  {TYPE_LABELS[a.type] || a.type}
                </span>
                <span className={styles.pendingDates}>
                  {a.dateDebut === a.dateFin ? a.dateDebut : `${a.dateDebut} → ${a.dateFin}`}
                  {a.demiJournee && ` (${a.demiJournee})`}
                </span>
                <span className={styles.pendingJours}>{jours}j</span>
              </div>
              {a.commentaire && <div className={styles.pendingComment}>{a.commentaire}</div>}
              <div className={styles.pendingActions}>
                <button className={styles.validateBtn} onClick={() => handleValidate(a)}>Valider</button>
                <button className={styles.refuseBtn} onClick={() => openRefus(a)}>Refuser</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vue semaine */}
      <div className={styles.weekCard}>
        <div className={styles.weekToolbar}>
          <button className={styles.weekNav} onClick={() => setWeekRef((d) => addDays(d, -7))}>◀ Semaine préc.</button>
          <h2 className={styles.sectionTitle}>Vue semaine</h2>
          <button className={styles.weekNav} onClick={() => setWeekRef((d) => addDays(d, 7))}>Semaine suiv. ▶</button>
        </div>
        <div className={styles.weekGrid}>
          <div className={styles.weekHeaderCell}>Employé</div>
          {weekDates.map((d) => (
            <div key={toYMD(d)} className={styles.weekHeaderCell}>
              {JOURS_LABELS[JOURS_SEMAINE[d.getDay() - 1]]} {d.getDate()}/{d.getMonth() + 1}
            </div>
          ))}
          {profiles.filter((p) => p.isActive !== false).map((p) => (
            <React.Fragment key={String(p._id)}>
              <div className={styles.weekNameCell}>{p.prenom} {p.nom[0]}.</div>
              {weekDates.map((d) => {
                const dateStr = toYMD(d);
                const jourKey = JOURS_SEMAINE[d.getDay() - 1];
                const isExpected = (p.joursPresence || []).includes(jourKey);
                const absence = absences.find((a) => isAbsentOnDate(a, dateStr) && a.employeeProfileId === String(p._id));
                const pending = absences.find((a) => isPendingOnDate(a, dateStr) && a.employeeProfileId === String(p._id));
                let cellClass = styles.weekCell;
                let label = "";
                if (!isExpected) {
                  cellClass += ` ${styles.weekCellOff}`;
                  label = "—";
                } else if (absence) {
                  cellClass += ` ${styles.weekCellAbsent}`;
                  label = TYPE_LABELS[absence.type]?.[0] || "A";
                } else if (pending) {
                  cellClass += ` ${styles.weekCellPending}`;
                  label = "?";
                } else {
                  cellClass += ` ${styles.weekCellPresent}`;
                }
                return (
                  <div key={dateStr} className={cellClass} title={absence ? `${TYPE_LABELS[absence.type]} (validé)` : pending ? `${TYPE_LABELS[pending.type]} (en attente)` : isExpected ? "Présent" : "Non prévu"}>
                    {label}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Modal refus */}
      <Modal open={!!refusModal} onClose={() => setRefusModal(null)} title="Refuser la demande" size="sm">
        {refusModal && (
          <div className={styles.refusForm}>
            <p className={styles.refusInfo}>
              {refusModal.employeeNom} — {TYPE_LABELS[refusModal.type]} — {refusModal.dateDebut} → {refusModal.dateFin}
            </p>
            <label className={styles.fieldLabel}>
              Motif du refus (obligatoire)
              <textarea value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} rows={3} placeholder="Expliquez le motif..." />
            </label>
            <div className={styles.refusActions}>
              <button className={styles.secondaryBtn} onClick={() => setRefusModal(null)}>Annuler</button>
              <button className={styles.refuseConfirmBtn} onClick={doRefus}>Confirmer le refus</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal impact */}
      <Modal open={!!impactModal} onClose={() => setImpactModal(null)} title="Attention — Zone rouge détectée" size="sm">
        {impactModal && (
          <div className={styles.impactContent}>
            <p className={styles.impactWarning}>
              Si tu valides cette demande, voici l'impact sur le remplissage :
            </p>
            {impactModal.impact.map((i) => (
              <div key={i.date} className={`${styles.impactRow} ${i.isRed ? styles.impactRowRed : ""}`}>
                <span>{i.jour} {i.date}</span>
                <span className={styles.impactCount}>{i.present}/{i.expected} présents</span>
                {i.isRed && <span className={styles.impactAlert}>ZONE ROUGE</span>}
              </div>
            ))}
            <div className={styles.impactActions}>
              <button className={styles.secondaryBtn} onClick={() => setImpactModal(null)}>Annuler</button>
              <button className={styles.validateBtn} onClick={() => doValidate(impactModal.absence._id)}>
                Valider quand même
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
