"use client";

import { useEffect, useState } from "react";
import styles from "./MeteoDuJour.module.css";

function formatDateFr(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatDateLong(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function weekLabel(weekStart, weekEnd) {
  if (!weekStart || !weekEnd) return "";
  const s = new Date(weekStart);
  const e = new Date(weekEnd);
  return `Semaine du ${s.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}


export default function MeteoDuJourPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/meteo-du-jour", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (loading) return <div className={styles.page}><p className={styles.muted}>Chargement...</p></div>;
  if (error) return <div className={styles.page}><p className={styles.muted}>Erreur : {error}</p></div>;

  const { vacances = [], arrivants = [], projets = [], briefsConvertis = [], weather, citation, weekStart, weekEnd } = data || {};

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Météo du jour</h1>
          <div className={styles.headerSub}>
            <span className={styles.todayStr}>{today.charAt(0).toUpperCase() + today.slice(1)}</span>
            <span className={styles.dot}>·</span>
            <span className={styles.weekStr}>{weekLabel(weekStart, weekEnd)}</span>
          </div>
        </div>

        {/* Weather widget */}
        {weather?.current ? (
          <div className={styles.weatherWidget} style={{ background: weather.current.gradient }}>
            <span className={styles.weatherEmoji}>{weather.current.emoji}</span>
            <div className={styles.weatherRight}>
              <span className={styles.weatherTemp}>{weather.current.temp}°C</span>
              <span className={styles.weatherDesc}>{weather.current.label}</span>
              <span className={styles.weatherMeta}>
                {weather.current.humidity}% humidité · {weather.current.wind} km/h
              </span>
              {weather.hourly?.length > 0 && (
                <div className={styles.hourlyStrip}>
                  {weather.hourly.map((h) => (
                    <div key={h.hour} className={styles.hourSlot}>
                      <span className={styles.hourLabel}>{String(h.hour).padStart(2, "0")}h</span>
                      <span className={styles.hourEmoji}>{h.emoji}</span>
                      <span className={styles.hourTemp}>{h.temp}°</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.weatherWidgetEmpty}>
            Ajoutez <code>METEOBLUE_API_KEY</code> pour la météo
          </div>
        )}
      </div>

      {/* ── Citation ── */}
      {citation && (
        <div className={styles.citationRow}>
          <blockquote className={styles.citation}>
            "{citation.quote}"
            <cite className={styles.citationAuthor}> — {citation.author}</cite>
          </blockquote>
        </div>
      )}

      <div className={styles.divider} />

      {/* ── Équipes ── */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>Équipes</div>
        <div className={styles.equipeGrid}>

          <div className={styles.equipeCol}>
            <div className={styles.colTitle}>En vacances cette semaine</div>
            {vacances.length === 0 ? (
              <p className={styles.muted}>Personne en vacances.</p>
            ) : (
              <div className={styles.personList}>
                {vacances.map((v) => (
                  <div key={v.id} className={styles.personRow}>
                    <span className={styles.personName}>{v.name}</span>
                    <span className={styles.personMeta}>
                      {v.type !== "Absence" && <span className={styles.typeBadge}>{v.type}</span>}
                      du {formatDateFr(v.startDate)} au {formatDateFr(v.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.equipeCol}>
            <div className={styles.colTitle}>Nouveaux arrivants</div>
            {arrivants.length === 0 ? (
              <p className={styles.muted}>Aucun nouvel arrivant.</p>
            ) : (
              <div className={styles.personList}>
                {arrivants.map((a) => (
                  <div key={a.id} className={styles.personRow}>
                    <span className={styles.personName}>{a.name}</span>
                    <span className={styles.personMeta}>
                      {a.role && <span className={styles.roleBadge}>{a.role}</span>}
                      Début le {formatDateLong(a.startDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

      <div className={styles.divider} />

      {/* ── Projets ── */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>Projets en cours cette semaine</div>

        {projets.length === 0 ? (
          <p className={styles.muted}>Aucun projet au calendrier cette semaine.</p>
        ) : (
          <div className={styles.projetList}>
            {projets.map((p, i) => (
              <div key={i} className={styles.projetRow}>
                <span className={styles.projetName}>{p.projet}</span>
                <span className={styles.arrow}>→</span>
                <span className={styles.phasePill} style={{ color: p.phaseColor, background: p.phaseColor + "18", borderColor: p.phaseColor + "44" }}>
                  {p.phase}
                </span>
              </div>
            ))}
          </div>
        )}

        {briefsConvertis.length > 0 && (
          <div className={styles.convertedList}>
            {briefsConvertis.map((b) => (
              <div key={b.id} className={styles.convertedRow}>
                <span className={styles.convertedTag}>Nouveau brief converti !!</span>
                <span className={styles.convertedName}>{b.briefName}</span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
