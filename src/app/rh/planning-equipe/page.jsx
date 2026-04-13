"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./PlanningEquipe.module.css";

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_SHORT = ["L","M","M","J","V","S","D"];
const BRANCH_COLORS = { "Agency": "#e11d48", "CreativeGen": "#7c3aed", "Entertainment": "#0891b2", "SFX": "#ca8a04", "default": "#6b7280" };
const ABSENCE_COLORS = { conge: "#10b981", tt: "#8b5cf6", maladie: "#f43f5e", absence_autre: "#f59e0b" };

function toYMD(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }

export default function PlanningEquipePage() {
  const [profiles, setProfiles] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [calDate, setCalDate] = useState(new Date());
  const [viewWeeks, setViewWeeks] = useState(2); // 1, 2, or 4 weeks

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

  // Generate days for the view
  const days = useMemo(() => {
    const d = new Date(calDate); const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff);
    return Array.from({ length: viewWeeks * 7 }, (_, i) => {
      const dd = new Date(mon); dd.setDate(dd.getDate() + i); return dd;
    });
  }, [calDate, viewWeeks]);

  // Build absence map: employeeProfileId → { dateStr → absence }
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

  // Build project map: dateStr → [{ project, assignees }]
  const projMap = useMemo(() => {
    const map = {};
    for (const c of contrats) {
      if (!c.dateDebut || !c.dateFin) continue;
      const d = new Date(c.dateDebut + "T12:00:00"); const end = new Date(c.dateFin + "T12:00:00");
      while (d <= end) {
        const key = toYMD(d);
        if (!map[key]) map[key] = [];
        map[key].push(c);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [contrats]);

  // Charge par jour
  const chargeByDay = useMemo(() => {
    const map = {};
    for (const d of days) {
      const key = toYMD(d);
      const presentCount = profiles.filter((p) => {
        const pid = String(p._id);
        const abs = absMap[pid]?.[key];
        return !abs || abs.statut !== "valide";
      }).length;
      const projCount = (projMap[key] || []).length;
      map[key] = { present: presentCount, total: profiles.length, projets: projCount };
    }
    return map;
  }, [days, profiles, absMap, projMap]);

  const today = toYMD(new Date());

  function navPrev() { setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() - viewWeeks * 7); return n; }); }
  function navNext() { setCalDate((d) => { const n = new Date(d); n.setDate(n.getDate() + viewWeeks * 7); return n; }); }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Planning Équipe</h1>
          <p className={styles.subtitle}>Vue d'ensemble — qui fait quoi, qui est là</p>
        </div>
        <div className={styles.controls}>
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

      {/* Charge indicator */}
      <div className={styles.chargeRow}>
        <div className={styles.chargeLabel}>Charge</div>
        {days.map((d) => {
          const key = toYMD(d);
          const ch = chargeByDay[key] || { present: 0, total: 0, projets: 0 };
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const ratio = ch.total > 0 ? ch.present / ch.total : 1;
          const isRed = ratio < 0.5 && !isWeekend;
          const isOrange = ratio < 0.75 && ratio >= 0.5 && !isWeekend;
          return (
            <div key={key} className={`${styles.chargeCell} ${isRed ? styles.chargeRed : isOrange ? styles.chargeOrange : ""} ${isWeekend ? styles.chargeWeekend : ""}`}>
              <span className={styles.chargeNum}>{ch.present}/{ch.total}</span>
              {ch.projets > 0 && <span className={styles.chargeProjets}>{ch.projets}p</span>}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className={styles.grid} style={{ "--cols": days.length }}>
        {/* Header */}
        <div className={styles.nameCol} />
        {days.map((d) => {
          const key = toYMD(d); const isToday2 = key === today;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={key} className={`${styles.dayHeader} ${isToday2 ? styles.dayHeaderToday : ""} ${isWeekend ? styles.dayHeaderWeekend : ""}`}>
              <span className={styles.dayHeaderDay}>{JOURS_SHORT[(d.getDay() + 6) % 7]}</span>
              <span className={styles.dayHeaderNum}>{d.getDate()}</span>
              {d.getDate() === 1 && <span className={styles.dayHeaderMonth}>{MOIS[d.getMonth()].slice(0, 3)}</span>}
            </div>
          );
        })}

        {/* Employees */}
        {profiles.map((p) => {
          const pid = String(p._id);
          return (
            <React.Fragment key={pid}>
              <div className={styles.nameCol}>
                <span className={styles.empName}>{p.prenom} {p.nom?.[0]}.</span>
                <span className={styles.empPole}>{p.pole || "—"}</span>
              </div>
              {days.map((d) => {
                const key = toYMD(d);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday2 = key === today;
                const abs = absMap[pid]?.[key];
                const dayProjs = (projMap[key] || []).filter((c) => {
                  const assignees = c.assignees || c.equipe || [];
                  return assignees.some((a) => String(a) === String(p.userId) || String(a._id || a.id || a) === String(p.userId));
                });

                let cellClass = styles.cell;
                let content = "";
                let cellStyle = {};

                if (isWeekend) {
                  cellClass += ` ${styles.cellWeekend}`;
                } else if (abs && abs.statut === "valide") {
                  cellClass += ` ${styles.cellAbsence}`;
                  cellStyle = { "--cc": ABSENCE_COLORS[abs.type] || "#888" };
                  content = abs.type === "tt" ? "🏡" : abs.type === "conge" ? "🌴" : abs.type === "maladie" ? "🤧" : "—";
                } else if (abs && abs.statut === "en_attente") {
                  cellClass += ` ${styles.cellPending}`;
                  content = "?";
                } else if (dayProjs.length > 0) {
                  cellClass += ` ${styles.cellProjet}`;
                  cellStyle = { "--cc": BRANCH_COLORS[dayProjs[0].branche] || BRANCH_COLORS.default };
                  content = dayProjs.length > 1 ? `${dayProjs.length}p` : "";
                } else {
                  cellClass += ` ${styles.cellPresent}`;
                }

                if (isToday2) cellClass += ` ${styles.cellToday}`;

                return (
                  <div key={key} className={cellClass} style={cellStyle} title={abs ? `${abs.type} (${abs.statut})` : dayProjs.length > 0 ? dayProjs.map((c) => c.nomContrat || c.nom).join(", ") : "Disponible"}>
                    {content}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Légende */}
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(16,185,129,0.15)" }} /> Présent</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(16,185,129,0.5)" }} /> 🌴 Congé</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(139,92,246,0.5)" }} /> 🏡 TT</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(244,63,94,0.5)" }} /> 🤧 Maladie</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(225,29,72,0.15)", borderLeft: "3px solid #e11d48" }} /> Sur projet</span>
        <span className={styles.legendItem}><span className={styles.legendBox} style={{ background: "rgba(245,158,11,0.15)", borderStyle: "dashed" }} /> ? En attente</span>
      </div>
    </div>
  );
}
