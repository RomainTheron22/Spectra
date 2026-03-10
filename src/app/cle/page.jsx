"use client";

import React, { useState } from "react";
import styles from "./SetupPage.module.css";

const CATEGORIES_ORDER = ["Base de données", "Authentification", "OAuth Google"];
const PASSWORD = "2212";

export default function SetupPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // Valeurs editées par l'utilisateur { KEY: "nouvelle valeur" }
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { ok, saved } ou { error }

  const fetchData = async (pwd) => {
    const res = await fetch("/api/setup", {
      headers: { "x-setup-password": pwd },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Erreur serveur.");
    return json;
  };

  const unlock = async (e) => {
    e.preventDefault();
    if (password !== PASSWORD) { setWrongPassword(true); return; }
    setWrongPassword(false);
    setLoading(true);
    setError("");
    try {
      const json = await fetchData(password);
      setData(json);
      setUnlocked(true);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    setSaveResult(null);
    try {
      const json = await fetchData(PASSWORD);
      setData(json);
      setEdits({});
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const updates = {};
    for (const [key, val] of Object.entries(edits)) {
      if (String(val).trim()) updates[key] = String(val).trim();
    }
    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-password": PASSWORD,
        },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Erreur sauvegarde.");
      setSaveResult({ ok: true, saved: json.saved || [] });
      setEdits({});
      // Rafraichir pour voir les nouvelles valeurs
      const fresh = await fetchData(PASSWORD);
      setData(fresh);
    } catch (err) {
      setSaveResult({ error: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  const hasEdits = Object.values(edits).some((v) => String(v).trim().length > 0);

  // ── Écran mot de passe ──
  if (!unlocked) {
    return (
      <div className={styles.gateWrap}>
        <div className={styles.gateCard}>
          <div className={styles.gateLogo}>🔐</div>
          <h1 className={styles.gateTitle}>Configuration</h1>
          <p className={styles.gateDesc}>Page de diagnostic réservée. Entrez le mot de passe pour continuer.</p>
          <form onSubmit={unlock} className={styles.gateForm}>
            <input
              className={`${styles.gateInput} ${wrongPassword ? styles.gateInputError : ""}`}
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setWrongPassword(false); }}
              autoFocus
            />
            {wrongPassword && <p className={styles.gateError}>Mot de passe incorrect.</p>}
            {error && <p className={styles.gateError}>{error}</p>}
            <button type="submit" className={styles.gateBtn} disabled={loading}>
              {loading ? "Vérification..." : "Accéder"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Page principale ──
  const items = data?.items || [];
  const missing = data?.missing || [];
  const localhostIssues = data?.localhostIssues || [];
  const allGood = missing.length === 0 && localhostIssues.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Configuration & Diagnostic</h1>
          <p className={styles.pageDesc}>Variables d&apos;environnement de l&apos;application.</p>
        </div>
        <div className={styles.headerActions}>
          {hasEdits && (
            <button type="button" className={styles.saveBtn} onClick={save} disabled={saving}>
              {saving ? "Sauvegarde..." : "Sauvegarder les modifications"}
            </button>
          )}
          <button type="button" className={styles.refreshBtn} onClick={refresh} disabled={loading || saving}>
            {loading ? "..." : "Actualiser"}
          </button>
        </div>
      </div>

      {error && <div className={styles.alertError}>{error}</div>}

      {saveResult?.ok && (
        <div className={styles.alertSuccess}>
          <strong>Sauvegardé !</strong> Variables mises à jour :{" "}
          {saveResult.saved.map((k) => <code key={k} className={styles.inlineCode}>{k}</code>)}
          <span> — Redémarrez le serveur pour que les variables d&apos;authentification prennent effet.</span>
        </div>
      )}
      {saveResult?.error && <div className={styles.alertError}>{saveResult.error}</div>}

      {!allGood && (
        <>
          {missing.length > 0 && (
            <div className={styles.alertError}>
              <strong>Variables manquantes :</strong>{" "}
              {missing.map((k) => <code key={k} className={styles.inlineCode}>{k}</code>)}
            </div>
          )}
          {localhostIssues.length > 0 && (
            <div className={styles.alertWarn}>
              <strong>Attention :</strong>{" "}
              {localhostIssues.map((k) => <code key={k} className={styles.inlineCode}>{k}</code>)}
              <span> contient <code className={styles.inlineCode}>localhost</code> — corriger avant de déployer.</span>
            </div>
          )}
        </>
      )}

      {allGood && !saveResult && (
        <div className={styles.alertSuccess}>
          Toutes les variables requises sont configurées. Aucun problème détecté.
        </div>
      )}

      {CATEGORIES_ORDER.map((cat) => {
        const catItems = items.filter((v) => v.category === cat);
        if (catItems.length === 0) return null;
        return (
          <section key={cat} className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{cat}</h2>
            </div>
            <div className={styles.varList}>
              {catItems.map((v) => {
                const editValue = edits[v.key] ?? "";
                return (
                  <div
                    key={v.key}
                    className={`${styles.varRow} ${!v.isSet ? styles.varRowMissing : v.isLocalhost ? styles.varRowWarn : ""}`}
                  >
                    <div className={styles.varTop}>
                      <div className={styles.varLeft}>
                        <div className={styles.varKeyRow}>
                          <code className={styles.varKey}>{v.key}</code>
                          {v.required && <span className={styles.badgeRequired}>requis</span>}
                          {!v.canSetInDb && <span className={styles.badgePlatformOnly}>plateforme uniquement</span>}
                          {v.canSetInDb && v.needsRestart && <span className={styles.badgeRestart}>redémarrage requis</span>}
                          {v.hasDbOverride && <span className={styles.badgeDbOverride}>surchargé en DB</span>}
                          {v.isSet && v.isLocalhost && <span className={styles.badgeWarn}>localhost détecté</span>}
                        </div>
                        <div className={styles.varDesc}>{v.description}</div>
                        <div className={styles.varHint}>{v.hint}</div>
                      </div>
                      <div className={styles.varRight}>
                        {v.isSet ? (
                          <>
                            <span className={v.isLocalhost ? styles.badgeStatusWarn : styles.badgeStatusOk}>
                              {v.isLocalhost ? "Attention" : "Configuré"}
                            </span>
                            {v.value && <span className={styles.varValue}>{v.value}</span>}
                          </>
                        ) : (
                          <span className={styles.badgeStatusMissing}>Non défini</span>
                        )}
                      </div>
                    </div>

                    {v.canSetInDb && (
                      <div className={styles.varEditRow}>
                        <input
                          className={styles.varInput}
                          type={v.sensitive ? "password" : "text"}
                          placeholder={v.sensitive ? "Nouvelle valeur (laissez vide pour ne pas modifier)" : `Nouvelle valeur…`}
                          value={editValue}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [v.key]: e.target.value }))}
                          autoComplete="off"
                        />
                      </div>
                    )}

                    {!v.canSetInDb && (
                      <div className={styles.varPlatformNote}>
                        Cette variable doit être définie dans le dashboard de votre plateforme (Railway, Vercel…) — elle ne peut pas être modifiée depuis l&apos;interface.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Comment appliquer les changements</h2>
        </div>
        <div className={styles.guideBody}>
          <div className={styles.guideStep}>
            <div className={styles.guideStepNum}>1</div>
            <div>
              Modifiez les valeurs dans les champs ci-dessus et cliquez <strong>Sauvegarder</strong>. Les valeurs sont stockées dans MongoDB (<code className={styles.inlineCode}>app_config</code>).
            </div>
          </div>
          <div className={styles.guideStep}>
            <div className={styles.guideStepNum}>2</div>
            <div>
              <strong>Redémarrez le serveur</strong> — Railway : Dashboard → votre service → bouton <em>Restart</em>. Les nouvelles valeurs sont injectées au démarrage avant l&apos;initialisation de l&apos;authentification.
            </div>
          </div>
          <div className={styles.guideStep}>
            <div className={styles.guideStepNum}>3</div>
            <div>
              <strong>MONGODB_URI / MONGODB_DB</strong> sont des dépendances bootstrap — elles doivent être dans le dashboard de la plateforme car elles sont nécessaires pour se connecter à MongoDB (et donc lire le reste de la config).
            </div>
          </div>
          <div className={styles.guideStep}>
            <div className={styles.guideStepNum}>4</div>
            <div>
              <strong>Google OAuth</strong> — dans{" "}
              <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className={styles.link}>
                Google Cloud Console
              </a>{" "}
              → Identifiants → votre app → ajouter{" "}
              <code className={styles.inlineCode}>https://votre-domaine/api/auth/callback/google</code>{" "}
              dans les URIs de redirection autorisées.
            </div>
          </div>
          <div className={styles.guideStep}>
            <div className={styles.guideStepNum}>5</div>
            <div>
              <strong>MongoDB Atlas</strong> — Network Access → ajouter{" "}
              <code className={styles.inlineCode}>0.0.0.0/0</code> pour autoriser les IPs dynamiques.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
