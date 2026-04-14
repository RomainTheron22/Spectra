"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./PlanningEquipe.module.css";

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_SHORT = ["L","M","M","J","V","S","D"];
const BRANCH_COLORS = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "Atelier": "#059669", "Communication": "#0284c7", "default": "#6b7280" };
const ABSENCE_COLORS = { conge: "#10b981", tt: "#8b5cf6", maladie: "#f43f5e", absence_autre: "#f59e0b" };
const ABSENCE_ICONS = { conge: "🌴", tt: "🏡", maladie: "🤧", absence_autre: "—" };

function toYMD(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }

export default function PlanningEquipePage() {
  const [profiles, setProfiles] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [calDate, setCalDate] = useState(new Date());
  const [viewWeeks, setViewWeeks] = useState(2);
  const [filterBranche, setFilterBranche] = useState("");
  const [filterPole, setFilterPole] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const [viewMode, setViewMode] = useState("person"); // person | project

  useEffect(() => {
    (async () => {
      const [profRes, absRes, projRes] = await Promise.all([
        fetch("/api/employee-profiles", { cache: "no-store" }),
        fetch("/api/employee-absences?all=true", { cache: "no-store" }),
        fetch("/api/contrats", { cache: "no-store" }),
      ]);
      const profData = await profRes.json(); setProfiles((profData.items || []).filter((p) => p.isActive !== false));
      const absData = await absRes.json(); setAbsences(absData.items || []);
      const projData = await projRes.json(); setContrats(projData.items || []);
    })();
  }, []);

  const days = useMemo(() => {
    const d = new Date(calDate); const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff);
    return Array.from({ length: viewWeeks * 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(dd.getDate() + i); return dd; });
  }, [calDate, viewWeeks]);

  // Absence map: profileId → { date → absence }
  const absMap = useMemo(() => {
    const map = {};
    for (const a of absences) {
      if (a.statut === "refuse") continue;
      const pid = a.employeeProfileId || a.userId;
      if (!map[pid]) map[pid] = {};
      const d = new Date(a.dateDebut + "T12:00:00"); const end = new Date(a.dateFin + "T12:00:00");
      while (d <= end) { map[pid][toYMD(d)] = a; d.setDate(d.getDate() + 1); }
    }
    return map;
  }, [absences]);

  // Project assignments: profileId → { date → [projects] }
  const projAssignMap = useMemo(() => {
    const map = {};
    for (const c of contrats) {
      if (!c.dateDebut || !c.dateFin) continue;
      const assignees = c.assignees || c.equipe || [];
      if (assignees.length === 0) continue;
      const d = new Date(c.dateDebut + "T12:00:00"); const end = new Date(c.dateFin + "T12:00:00");
      while (d <= end) {
        const key = toYMD(d);
        for (const aId of assignees) {
          const id = String(aId._id || aId.id || aId);
          if (!map[id]) map[id] = {};
          if (!map[id][key]) map[id][key] = [];
          map[id][key].push(c);
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [contrats]);

  // Project map by date (all projects, for charge indicator)
  const projByDate = useMemo(() => {
    const map = {};
    for (const c of contrats) {
      if (!c.dateDebut || !c.dateFin) continue;
      const d = new Date(c.dateDebut + "T12:00:00"); const end = new Date(c.dateFin + "T12:00:00");
      while (d <= end) { const k = toYMD(d); if (!map[k]) map[k] = []; map[k].push(c); d.setDate(d.getDate() + 1); }
    }
    return map;
  }, [contrats]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    let list = profiles;
    if (filterPole) list = list.filter((p) => p.pole === filterPole);
    return list;
  }, [profiles, filterPole]);

  // Get unique poles
  const poles = useMemo(() => [...new Set(profiles.map((p) => p.pole).filter(Boolean))].sort(), [profiles]);
  const branches = useMemo(() => [...new Set(contrats.map((c) => c.branche).filter(Boolean))].sort(), [contrats]);

  const today = toYMD(new Date());

  function navPrev() { setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() - viewWeeks * 7); return n; }); }
  function navNext() { setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() + viewWeeks * 7); return n; }); }

  // Charge par personne par jour
  function getPersonCharge(profileId, dateStr) {
    const userProjs = projAssignMap[profileId]?.[dateStr] || [];
    const abs = absMap[profileId]?.[dateStr];
    return { projs: userProjs, abs, projCount: userProjs.length, isAbsent: abs && abs.statut === "valide" };
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Planning Équipe</h1>
          <p className={styles.subtitle}>{filteredProfiles.length} membres · {contrats.filter((c) => c.dateDebut && c.dateFin).length} projets actifs</p>
        </div>
        <div className={styles.controls}>
          {/* Filtres */}
          <select className={styles.filterSelect} value={filterPole} onChange={(e) => setFilterPole(e.target.value)}>
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className={styles.weekSwitch}>
            <button className={`${styles.weekBtn} ${viewMode === "person" ? styles.weekBtnOn : ""}`} onClick={() => setViewMode("person")}>Par personne</button>
            <button className={`${styles.weekBtn} ${viewMode === "project" ? styles.weekBtnOn : ""}`} onClick={() => setViewMode("project")}>Par projet</button>
          </div>
          <div className={styles.weekSwitch}>
            {[1, 2, 4].map((w) => (
              <button key={w} className={`${styles.weekBtn} ${viewWeeks === w ? styles.weekBtnOn : ""}`} onClick={() => setViewWeeks(w)}>
                {w === 1 ? "1 sem" : w === 2 ? "2 sem" : "1 mois"}
              </button>
            ))}
          </div>
          <div className={styles.navGroup}>
            <button className={styles.navBtn} onClick={navPrev}>‹</button>
            <button className={styles.todayBtn} onClick={() => setCalDate(new Date())}>Aujourd'hui</button>
            <button className={styles.navBtn} onClick={navNext}>›</button>
          </div>
        </div>
      </div>

      {/* ═══ MODE PAR PROJET ═══ */}
      {viewMode === "project" && (() => {
        const activeContrats = contrats.filter((c) => c.dateDebut && c.dateFin).filter((c) => !filterBranche || c.branche === filterBranche);
        const firstDay = days[0]; const lastDay = days[days.length - 1];
        const firstStr = toYMD(firstDay); const lastStr = toYMD(lastDay);
        const visibleProjects = activeContrats.filter((c) => c.dateFin >= firstStr && c.dateDebut <= lastStr);
        const totalDays = days.length;
        return (
          <div className={styles.projTimeline}>
            {/* Header jours */}
            <div className={styles.projTimelineHeader} style={{ "--cols": totalDays }}>
              <div className={styles.projTimelineLabel}>Projet</div>
              {days.map((d) => {
                const key = toYMD(d); const isToday2 = key === today; const isWE = d.getDay() === 0 || d.getDay() === 6;
                return <div key={key} className={`${styles.projTimelineDayH} ${isToday2 ? styles.projTimelineDayHToday : ""} ${isWE ? styles.projTimelineDayHWE : ""}`}>{d.getDate()}</div>;
              })}
            </div>
            {/* Projets */}
            {visibleProjects.map((c) => {
              const bc = BRANCH_COLORS[c.branche] || BRANCH_COLORS.default;
              const startIdx = Math.max(0, days.findIndex((d) => toYMD(d) >= c.dateDebut));
              const endIdx = Math.min(totalDays - 1, days.findIndex((d) => toYMD(d) >= c.dateFin));
              const barStart = startIdx; const barWidth = Math.max(1, endIdx - startIdx + 1);
              const assignees = c.assignees || [];
              const assigneeProfiles = assignees.map((a) => profiles.find((p) => String(p._id) === String(a) || p.email === String(a))).filter(Boolean);
              return (
                <div key={String(c._id)} className={styles.projTimelineRow} style={{ "--cols": totalDays }}>
                  <Link href={`/projets/${String(c._id)}`} className={styles.projTimelineLabel} style={{ borderLeftColor: bc }}>
                    <span className={styles.projTimelineName}>{c.nomContrat || c.nom}</span>
                    <span className={styles.projTimelineBranch} style={{ color: bc }}>{c.branche}</span>
                    {assigneeProfiles.length > 0 && (
                      <div className={styles.projTimelineAvatars}>
                        {assigneeProfiles.slice(0, 4).map((p, i) => <span key={i} className={styles.projTimelineAvatar} style={{ background: bc }}>{(p.prenom || "?")[0]}</span>)}
                        {assigneeProfiles.length > 4 && <span className={styles.projTimelineAvatarMore}>+{assigneeProfiles.length - 4}</span>}
                      </div>
                    )}
                  </Link>
                  {days.map((d, di) => {
                    const key = toYMD(d); const inRange = key >= c.dateDebut && key <= c.dateFin;
                    const isFirst = key === c.dateDebut; const isLast = key === c.dateFin;
                    return <div key={key} className={`${styles.projTimelineCell} ${inRange ? styles.projTimelineCellActive : ""}`} style={inRange ? { background: `${bc}22`, borderTop: `2px solid ${bc}`, borderBottom: `2px solid ${bc}`, borderLeft: isFirst ? `2px solid ${bc}` : "none", borderRight: isLast ? `2px solid ${bc}` : "none", borderRadius: isFirst ? "6px 0 0 6px" : isLast ? "0 6px 6px 0" : "0" } : undefined} />;
                  })}
                </div>
              );
            })}
            {visibleProjects.length === 0 && <div className={styles.detailEmpty}>Aucun projet sur cette période</div>}
          </div>
        );
      })()}

      {/* ═══ MODE PAR PERSONNE ═══ */}
      {viewMode === "person" && <>
      {/* Charge globale */}
      <div className={styles.chargeRow}>
        <div className={styles.chargeLabel}>Charge</div>
        {days.map((d) => {
          const key = toYMD(d);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const absentCount = filteredProfiles.filter((p) => { const a = absMap[String(p._id)]?.[key]; return a && a.statut === "valide"; }).length;
          const presentCount = filteredProfiles.length - absentCount;
          const projCount = (projByDate[key] || []).length;
          const ratio = filteredProfiles.length > 0 ? presentCount / filteredProfiles.length : 1;
          return (
            <div key={key} className={`${styles.chargeCell} ${ratio < 0.5 && !isWeekend ? styles.chargeRed : ratio < 0.75 && !isWeekend ? styles.chargeOrange : ""} ${isWeekend ? styles.chargeWE : ""}`}>
              <span className={styles.chargePresent}>{presentCount}/{filteredProfiles.length}</span>
              {projCount > 0 && <span className={styles.chargeProj}>{projCount}p</span>}
            </div>
          );
        })}
      </div>

      {/* Grille */}
      <div className={styles.grid} style={{ "--cols": days.length }}>
        <div className={styles.cornerCell} />
        {days.map((d) => {
          const key = toYMD(d); const isToday2 = key === today; const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={key} className={`${styles.dayH} ${isToday2 ? styles.dayHToday : ""} ${isWeekend ? styles.dayHWE : ""}`}>
              <span className={styles.dayHDay}>{JOURS_SHORT[(d.getDay() + 6) % 7]}</span>
              <span className={`${styles.dayHNum} ${isToday2 ? styles.dayHNumToday : ""}`}>{d.getDate()}</span>
              {d.getDate() === 1 && <span className={styles.dayHMonth}>{MOIS[d.getMonth()].slice(0, 3)}</span>}
            </div>
          );
        })}

        {filteredProfiles.map((p) => {
          const pid = String(p._id);
          // Calculer la charge max de cette personne sur la période
          const maxCharge = Math.max(1, ...days.map((d) => getPersonCharge(pid, toYMD(d)).projCount));

          return (
            <React.Fragment key={pid}>
              <div className={styles.nameCell}>
                <Link href={`/rh/employe/${pid}`} className={styles.empLink}>
                  <span className={styles.empAvatar}>{(p.prenom || "?")[0].toUpperCase()}</span>
                  <div>
                    <span className={styles.empName}>{p.prenom} {p.nom?.[0]}.</span>
                    <span className={styles.empInfo}>{p.pole || "—"} · {p.contrat || "—"}</span>
                  </div>
                </Link>
              </div>
              {days.map((d) => {
                const key = toYMD(d); const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday2 = key === today;
                const { projs, abs, projCount, isAbsent } = getPersonCharge(pid, key);
                const isPending = abs && abs.statut === "en_attente";
                const isOverloaded = projCount >= 3;

                let cellClass = styles.cell;
                let cellContent = "";
                let cellStyle = {};
                let cellTitle = "Disponible";

                if (isWeekend) {
                  cellClass += ` ${styles.cellWE}`;
                  cellTitle = "Week-end";
                } else if (isAbsent) {
                  cellClass += ` ${styles.cellAbs}`;
                  cellStyle = { "--cc": ABSENCE_COLORS[abs.type] || "#888" };
                  cellContent = ABSENCE_ICONS[abs.type] || "—";
                  cellTitle = `${abs.type} (validé)`;
                } else if (isPending) {
                  cellClass += ` ${styles.cellPending}`;
                  cellContent = "?";
                  cellTitle = `${abs.type} (en attente)`;
                } else if (projCount > 0) {
                  cellClass += ` ${styles.cellProj}`;
                  if (isOverloaded) cellClass += ` ${styles.cellOverload}`;
                  cellStyle = { "--cc": BRANCH_COLORS[projs[0]?.branche] || BRANCH_COLORS.default, "--intensity": Math.min(1, projCount / 4) };
                  cellContent = projCount > 1 ? projCount : "";
                  cellTitle = projs.map((c) => c.nomContrat || c.nom).join(", ");
                } else {
                  cellClass += ` ${styles.cellFree}`;
                }

                if (isToday2) cellClass += ` ${styles.cellToday}`;

                return (
                  <div key={key} className={cellClass} style={cellStyle} title={cellTitle}
                    onClick={() => setSelectedCell(selectedCell?.empId === pid && selectedCell?.date === key ? null : { empId: pid, date: key })}>
                    {cellContent}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Détail cellule sélectionnée */}
      {selectedCell && (() => {
        const p = profiles.find((p) => String(p._id) === selectedCell.empId);
        const { projs, abs } = getPersonCharge(selectedCell.empId, selectedCell.date);
        return (
          <div className={styles.detail}>
            <div className={styles.detailHead}>
              <strong>{p?.prenom} {p?.nom}</strong> — {selectedCell.date}
              <button className={styles.detailClose} onClick={() => setSelectedCell(null)}>✕</button>
            </div>
            {abs && <div className={styles.detailAbs}>{ABSENCE_ICONS[abs.type]} {abs.type} ({abs.statut})</div>}
            {projs.length > 0 && (
              <div className={styles.detailProjs}>
                <strong>{projs.length} projet{projs.length > 1 ? "s" : ""} :</strong>
                {projs.map((c, i) => (
                  <div key={i} className={styles.detailProj} style={{ "--dc": BRANCH_COLORS[c.branche] || "#888" }}>
                    <span className={styles.detailProjName}>{c.nomContrat || c.nom}</span>
                    <span className={styles.detailProjBranch}>{c.branche}</span>
                  </div>
                ))}
              </div>
            )}
            {!abs && projs.length === 0 && <div className={styles.detailEmpty}>Disponible</div>}
          </div>
        );
      })()}

      </>}

      {/* Légende */}
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(16,185,129,0.08)" }} /> Disponible</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(16,185,129,0.4)" }} /> 🌴 Congé</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(139,92,246,0.4)" }} /> 🏡 TT</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(244,63,94,0.4)" }} /> 🤧 Maladie</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(124,58,237,0.15)", borderLeft: "3px solid #7c3aed" }} /> Sur projet</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(225,29,72,0.2)", border: "2px solid #e11d48" }} /> Surcharge (3+)</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(245,158,11,0.15)", borderStyle: "dashed", borderColor: "#f59e0b" }} /> ? En attente</span>
      </div>
    </div>
  );
}
