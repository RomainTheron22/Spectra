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
  return `Semaine du ${s.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
}

function getWeatherGradient(weatherId) {
  if (!weatherId) return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
  if (weatherId === 800) return "linear-gradient(135deg, #f6d365 0%, #fda085 100%)"; // clear
  if (weatherId >= 801 && weatherId <= 804) return "linear-gradient(135deg, #a8c0d6 0%, #778ca3 100%)"; // clouds
  if (weatherId >= 500 && weatherId < 600) return "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"; // rain
  if (weatherId >= 600 && weatherId < 700) return "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)"; // snow
  if (weatherId >= 200 && weatherId < 300) return "linear-gradient(135deg, #373b44 0%, #4286f4 100%)"; // thunder
  return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
}

function WeatherIcon({ id }) {
  if (!id) return <span className={styles.weatherEmoji}>🌡️</span>;
  if (id === 800) return <span className={styles.weatherEmoji}>☀️</span>;
  if (id >= 801 && id <= 804) return <span className={styles.weatherEmoji}>☁️</span>;
  if (id >= 500 && id < 600) return <span className={styles.weatherEmoji}>🌧️</span>;
  if (id >= 600 && id < 700) return <span className={styles.weatherEmoji}>❄️</span>;
  if (id >= 200 && id < 300) return <span className={styles.weatherEmoji}>⛈️</span>;
  if (id >= 700 && id < 800) return <span className={styles.weatherEmoji}>🌫️</span>;
  return <span className={styles.weatherEmoji}>🌡️</span>;
}

export default function MeteoDuJourPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/meteo-du-jour", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (loading) return <div className={styles.page}><div className={styles.loading}>Chargement...</div></div>;
  if (error) return <div className={styles.page}><div className={styles.loading}>Erreur : {error}</div></div>;

  const { vacances = [], arrivants = [], projets = [], briefsConvertis = [], weather, citation, weekStart, weekEnd } = data || {};

  const weatherId = weather?.weather?.[0]?.id;
  const weatherGradient = getWeatherGradient(weatherId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Météo du jour</h1>
        <div className={styles.dateInfo}>
          <span className={styles.todayLabel}>{today.charAt(0).toUpperCase() + today.slice(1)}</span>
          <span className={styles.weekLabel}>{weekLabel(weekStart, weekEnd)}</span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* ── Météo Paris ── */}
        <div className={styles.weatherCard} style={{ background: weatherGradient }}>
          <div className={styles.weatherTitle}>Paris 13e</div>
          {weather && weather.main ? (
            <>
              <div className={styles.weatherMain}>
                <WeatherIcon id={weatherId} />
                <span className={styles.weatherTemp}>{Math.round(weather.main.temp)}°C</span>
              </div>
              <div className={styles.weatherDesc}>
                {weather.weather?.[0]?.description?.charAt(0).toUpperCase() + weather.weather?.[0]?.description?.slice(1)}
              </div>
              <div className={styles.weatherDetails}>
                <span>Ressenti {Math.round(weather.main.feels_like)}°C</span>
                <span>Humidité {weather.main.humidity}%</span>
                <span>Vent {Math.round((weather.wind?.speed || 0) * 3.6)} km/h</span>
              </div>
            </>
          ) : (
            <div className={styles.weatherNoKey}>
              Configurez <code>OPENWEATHERMAP_API_KEY</code> pour afficher la météo.
            </div>
          )}
        </div>

        {/* ── Citation du jour ── */}
        <div className={styles.citationCard}>
          <div className={styles.citationLabel}>Citation du jour</div>
          {citation ? (
            <>
              <blockquote className={styles.citationText}>"{citation.quote}"</blockquote>
              <div className={styles.citationAuthor}>— {citation.author}</div>
            </>
          ) : (
            <div className={styles.empty}>Citation indisponible.</div>
          )}
        </div>

        {/* ── Équipes ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>👥</span>
            <span className={styles.cardTitle}>Équipes</span>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>En vacances cette semaine</div>
            {vacances.length === 0 ? (
              <div className={styles.empty}>Personne en vacances cette semaine.</div>
            ) : (
              <div className={styles.list}>
                {vacances.map((v) => (
                  <div key={v.id} className={styles.listItem}>
                    <div className={styles.listItemName}>{v.name}</div>
                    <div className={styles.listItemSub}>
                      <span className={styles.absenceBadge}>{v.type}</span>
                      <span className={styles.dateRange}>
                        du {formatDateFr(v.startDate)} au {formatDateFr(v.endDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Nouveaux arrivants cette semaine</div>
            {arrivants.length === 0 ? (
              <div className={styles.empty}>Aucun nouvel arrivant cette semaine.</div>
            ) : (
              <div className={styles.list}>
                {arrivants.map((a) => (
                  <div key={a.id} className={styles.listItem}>
                    <div className={styles.listItemName}>{a.name}</div>
                    <div className={styles.listItemSub}>
                      {a.role && <span className={styles.roleBadge}>{a.role}</span>}
                      <span className={styles.dateRange}>Début le {formatDateLong(a.startDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Projets ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>📁</span>
            <span className={styles.cardTitle}>Projets</span>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>En cours cette semaine</div>
            {projets.length === 0 ? (
              <div className={styles.empty}>Aucun projet au calendrier cette semaine.</div>
            ) : (
              <div className={styles.list}>
                {projets.map((p, i) => (
                  <div key={i} className={styles.listItem}>
                    <div className={styles.listItemName}>{p.projet}</div>
                    <div className={styles.listItemSub}>
                      <span
                        className={styles.phaseBadge}
                        style={{ background: p.phaseColor + "22", color: p.phaseColor, borderColor: p.phaseColor + "55" }}
                      >
                        {p.phase}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {briefsConvertis.length > 0 && (
            <>
              <div className={styles.divider} />
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Briefs convertis cette semaine</div>
                <div className={styles.list}>
                  {briefsConvertis.map((b) => (
                    <div key={b.id} className={`${styles.listItem} ${styles.listItemConverted}`}>
                      <div className={styles.convertedBadge}>Nouveau brief converti !!</div>
                      <div className={styles.listItemName}>{b.briefName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
