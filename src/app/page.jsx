"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";

function toIso(value) {
  return new Date(value).toISOString();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrow() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

function formatTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [planningLoading, setPlanningLoading] = useState(true);
  const [planningDenied, setPlanningDenied] = useState(false);
  const [planningTasks, setPlanningTasks] = useState([]);

  const [assignedDevis, setAssignedDevis] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [markingDone, setMarkingDone] = useState(null);

  const [missingDocs, setMissingDocs] = useState([]);
  const [missingDocsLoading, setMissingDocsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setAssignedLoading(true);
        const res = await fetch("/api/briefs/assigned", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setAssignedDevis(data.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setAssignedLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const toggleDoc = async (empId, docType, currentValue) => {
    const newValue = !currentValue;
    try {
      const res = await fetch(`/api/personnel/${empId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [docType]: newValue }),
      });
      if (res.ok) {
        const updated = await res.json();
        const item = updated.item;
        setMissingDocs((prev) => {
          const next = prev.map((e) => (String(e._id) === String(item._id) ? item : e));
          return next.filter((e) => !e.hasContract || !e.hasNDA);
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markDone = async (briefId, partieId) => {
    const key = `${briefId}-${partieId}`;
    if (markingDone === key) return;
    setMarkingDone(key);
    try {
      const res = await fetch("/api/briefs/assigned", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId, partieId }),
      });
      if (res.ok) {
        setAssignedDevis((prev) => prev.filter((it) => !(it.briefId === briefId && it.partieId === partieId)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingDone(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMissingDocsLoading(true);
        const res = await fetch("/api/personnel", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          const relevant = (data.items || []).filter(
            (emp) =>
              (emp.contractType === "Alternant" || emp.contractType === "Stagiaire") &&
              emp.status === "Actif" &&
              (!emp.hasContract || !emp.hasNDA)
          );
          setMissingDocs(relevant);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setMissingDocsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/inventaire", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Erreur chargement inventaire");

        if (!cancelled) {
          const mapped = (data.items || []).map((d) => ({ ...d, id: String(d._id) }));
          setItems(mapped);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPlanningLoading(true);
        setPlanningDenied(false);

        const params = new URLSearchParams({
          from: toIso(startOfToday()),
          to: toIso(startOfTomorrow()),
        });
        const res = await fetch(`/api/planning/tasks?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            if (!cancelled) {
              setPlanningDenied(true);
              setPlanningTasks([]);
            }
            return;
          }
          throw new Error(data?.error || "Erreur chargement planning perso");
        }

        if (!cancelled) {
          const mapped = Array.isArray(data.items) ? data.items : [];
          setPlanningTasks(
            mapped.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          );
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setPlanningTasks([]);
      } finally {
        if (!cancelled) setPlanningLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const alertes = useMemo(() => {
    return (items || [])
      .filter((it) => it?.seuilMinimum !== null && it?.seuilMinimum !== undefined)
      .filter((it) => Number(it.quantiteStock) < Number(it.seuilMinimum))
      .sort(
        (a, b) =>
          Number(a.quantiteStock) -
          Number(a.seuilMinimum) -
          (Number(b.quantiteStock) - Number(b.seuilMinimum))
      );
  }, [items]);

  const planningSummary = useMemo(() => {
    const now = new Date();
    const tasks = planningTasks || [];
    const ongoing = tasks.filter((task) => {
      const start = new Date(task.start);
      const end = new Date(task.end);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= now && end > now;
    });
    const next = tasks.find((task) => {
      const start = new Date(task.start);
      return !Number.isNaN(start.getTime()) && start > now;
    });

    return {
      count: tasks.length,
      ongoingCount: ongoing.length,
      next,
      preview: tasks.slice(0, 4),
    };
  }, [planningTasks]);

  // Dashboard data
  const [dash, setDash] = useState(null);
  const notifs = { pending: dash?.absences?.pending || 0, expiring: dash?.alerts?.expiringContracts?.length || 0 };
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/planning-dashboard", { cache: "no-store" });
        const d = await res.json();
        setDash(d);
      } catch {}
    })();
  }, []);

  return (
    <div className={styles.page}>
      {/* Bandeau notifications */}
      {(notifs.pending > 0 || notifs.expiring > 0) && (
        <div className={styles.notifBar}>
          {notifs.pending > 0 && <a href="/rh/pilotage" className={styles.notifItem} style={{ "--nc": "#f59e0b" }}>{notifs.pending} demande{notifs.pending > 1 ? "s" : ""} d'absence à valider</a>}
          {notifs.expiring > 0 && <a href="/rh/entreprise" className={styles.notifItem} style={{ "--nc": "#e11d48" }}>{notifs.expiring} contrat{notifs.expiring > 1 ? "s" : ""} expire{notifs.expiring > 1 ? "nt" : ""} bientôt</a>}
        </div>
      )}
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Tableau de bord</h1>
      </div>

      {/* Widgets CEO */}
      {dash && (
        <div className={styles.ceoWidgets}>
          <a href="/rh/planning-equipe" className={styles.ceoWidget}>
            <span className={styles.ceoWidgetVal}>{dash.team?.present || 0}<span className={styles.ceoWidgetTotal}>/{dash.team?.total || 0}</span></span>
            <span className={styles.ceoWidgetLabel}>Présents</span>
          </a>
          <a href="/rh/entreprise" className={styles.ceoWidget}>
            <span className={styles.ceoWidgetVal}>{dash.projects?.active || 0}</span>
            <span className={styles.ceoWidgetLabel}>Projets actifs</span>
          </a>
          <a href="/rh/pilotage" className={styles.ceoWidget} style={{ "--cwc": notifs.pending > 0 ? "#f59e0b" : undefined }}>
            <span className={styles.ceoWidgetVal}>{notifs.pending}</span>
            <span className={styles.ceoWidgetLabel}>À valider</span>
          </a>
          <a href="/rh/entreprise" className={styles.ceoWidget} style={{ "--cwc": notifs.expiring > 0 ? "#e11d48" : undefined }}>
            <span className={styles.ceoWidgetVal}>{dash.projects?.upcoming || 0}</span>
            <span className={styles.ceoWidgetLabel}>Projets à venir</span>
          </a>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Planning perso - aujourd&apos;hui</div>
            </div>
            <div className={styles.cardBody}>
              {planningLoading ? (
                <div className={styles.muted}>Chargement planning perso...</div>
              ) : planningDenied ? (
                <div className={styles.muted}>Aucun acces au planning perso.</div>
              ) : (
                <div className={styles.planWrap}>
                  <div className={styles.planStats}>
                    <div className={styles.planStat}>
                      <span className={styles.planStatLabel}>Taches du jour</span>
                      <span className={styles.planStatValue}>{planningSummary.count}</span>
                    </div>
                    <div className={styles.planStat}>
                      <span className={styles.planStatLabel}>En cours</span>
                      <span className={styles.planStatValue}>{planningSummary.ongoingCount}</span>
                    </div>
                    <div className={styles.planStat}>
                      <span className={styles.planStatLabel}>Prochaine tache</span>
                      <span className={styles.planStatValue}>
                        {planningSummary.next
                          ? `${formatTime(planningSummary.next.start)} - ${formatTime(
                              planningSummary.next.end
                            )}`
                          : "Aucune"}
                      </span>
                    </div>
                  </div>

                  {planningSummary.preview.length === 0 ? (
                    <div className={styles.muted}>Aucune tache prevue aujourd&apos;hui.</div>
                  ) : (
                    <div className={styles.planList}>
                      {planningSummary.preview.map((task) => (
                        <div key={task.id} className={styles.planItem}>
                          <div className={styles.planItemTop}>
                            <span className={styles.planTitle}>{task.title || "Tache"}</span>
                            <span className={styles.planTime}>
                              {formatTime(task.start)} - {formatTime(task.end)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className={styles.card} style={{ marginTop: "16px" }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Devis assignés</div>
              <div className={styles.badge}>{assignedLoading ? "..." : assignedDevis.length}</div>
            </div>
            <div className={styles.cardBody}>
              {assignedLoading ? (
                <div className={styles.muted}>Chargement...</div>
              ) : assignedDevis.length === 0 ? (
                <div className={styles.muted}>Aucun devis assigné.</div>
              ) : (
                <div className={styles.planList}>
                  {assignedDevis.map((item) => {
                    const key = `${item.briefId}-${item.partieId}`;
                    return (
                      <div key={key} className={styles.planItem}>
                        <div className={styles.planItemTop}>
                          <span className={styles.planTitle}>{item.partieNom}</span>
                          <div className={styles.assignedItemRight}>
                            {item.prixEstime !== null && item.prixEstime !== undefined ? (
                              <span className={styles.planTime}>{Number(item.prixEstime).toFixed(2)} EUR</span>
                            ) : null}
                            <button
                              type="button"
                              className={styles.doneBtn}
                              title="Marquer comme fait"
                              disabled={markingDone === key}
                              onClick={() => markDone(item.briefId, item.partieId)}
                            >
                              ✓
                            </button>
                          </div>
                        </div>
                        <div className={styles.muted} style={{ fontSize: "12px", marginTop: "4px" }}>
                          {item.briefNom}{item.clientNom ? ` · ${item.clientNom}` : ""}{item.branche ? ` · ${item.branche}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Alertes stock</div>
              <div className={styles.badge}>{loading ? "..." : alertes.length}</div>
            </div>

            <div className={styles.cardBody}>
              {loading ? (
                <div className={styles.muted}>Chargement...</div>
              ) : alertes.length === 0 ? (
                <div className={styles.muted}>Aucune alerte stock.</div>
              ) : (
                <div className={styles.alertList}>
                  {alertes.map((a) => (
                    <div key={a.id} className={styles.alertItem}>
                      <div className={styles.alertTop}>
                        <div className={styles.alertName}>{a.produit || "Produit sans nom"}</div>
                        <div className={styles.alertQty}>
                          {a.quantiteStock} / {a.seuilMinimum}
                        </div>
                      </div>

                      <div className={styles.alertMeta}>
                        <span>{a.projet ? `Projet: ${a.projet}` : "-"}</span>
                        <span>{a.zoneStockage ? `Zone: ${a.zoneStockage}` : ""}</span>
                      </div>

                      {a.referenceUrl ? (
                        <a className={styles.alertLink} href={a.referenceUrl} target="_blank" rel="noreferrer">
                          Recommander {"->"}
                        </a>
                      ) : (
                        <div className={styles.muted}>Pas d&apos;URL renseignee</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.card} style={{ marginTop: "16px" }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Documents manquants</div>
              <div className={missingDocs.length > 0 ? styles.badgeWarn : styles.badge}>
                {missingDocsLoading ? "..." : missingDocs.length}
              </div>
            </div>
            <div className={styles.cardBody}>
              {missingDocsLoading ? (
                <div className={styles.muted}>Chargement...</div>
              ) : missingDocs.length === 0 ? (
                <div className={styles.muted}>Tous les documents sont à jour.</div>
              ) : (
                <div className={styles.alertList}>
                  {missingDocs.map((emp) => (
                    <div key={emp._id} className={styles.docAlertItem}>
                      <div className={styles.alertTop}>
                        <div className={styles.alertName}>{emp.firstName} {emp.lastName}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className={styles.contractBadge}>{emp.contractType}</span>
                          <a
                            href={`/externes/personnel?openId=${emp._id}&tab=fichiers`}
                            className={styles.fileShortcutBtn}
                            title="Ouvrir les fichiers"
                          >
                            📁
                          </a>
                        </div>
                      </div>
                      <div className={styles.docMissingList}>
                        <label className={styles.docCheckLabel}>
                          <input
                            type="checkbox"
                            checked={emp.hasContract}
                            onChange={() => toggleDoc(emp._id, "hasContract", emp.hasContract)}
                          />
                          Convention {emp.hasContract ? "✓" : <span className={styles.docMissingHint}>manquante</span>}
                        </label>
                        <label className={styles.docCheckLabel}>
                          <input
                            type="checkbox"
                            checked={emp.hasNDA}
                            onChange={() => toggleDoc(emp._id, "hasNDA", emp.hasNDA)}
                          />
                          NDA {emp.hasNDA ? "✓" : <span className={styles.docMissingHint}>manquant</span>}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
