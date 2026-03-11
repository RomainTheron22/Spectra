"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "../../lib/auth-client";
import styles from "./AuthPage.module.css";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const next = String(searchParams.get("next") || "").trim();
    return next.startsWith("/") ? next : "/";
  }, [searchParams]);

  const { data: session, isPending } = authClient.useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [profileStatus, setProfileStatus] = useState(null);

  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "" });
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
  });

  useEffect(() => {
    if (!session?.user?.id) {
      setProfileStatus(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/users/profile", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setProfileStatus(Boolean(data.needsProfile));
      } catch {
        setProfileStatus(false);
      }
    })();
  }, [session?.user?.id]);

  const signInWithGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/auth" });
    } catch (e) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  };

  const signInWithEmail = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({
        email: signInForm.email,
        password: signInForm.password,
      });
      if (err) {
        setError(err.message || "Email ou mot de passe incorrect.");
        setBusy(false);
        return;
      }
      router.push(nextPath || "/");
      router.refresh();
    } catch (e) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  };

  const signUp = async (e) => {
    e.preventDefault();
    setError("");
    if (signUpForm.password !== signUpForm.confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (signUpForm.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.signUp.email({
        email: signUpForm.email,
        password: signUpForm.password,
        name: `${signUpForm.firstName.trim()} ${signUpForm.lastName.trim()}`,
        firstName: signUpForm.firstName.trim(),
        lastName: signUpForm.lastName.trim(),
      });
      if (err) {
        setError(err.message || "Erreur lors de la création du compte.");
        setBusy(false);
        return;
      }
      router.push(nextPath || "/");
      router.refresh();
    } catch (e) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur lors de la mise a jour du profil.");
        return;
      }
      router.push(nextPath || "/");
      router.refresh();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (isPending) return <div className={styles.loading}>Chargement...</div>;

  if (session?.user && profileStatus === null)
    return <div className={styles.loading}>Chargement...</div>;

  if (session?.user && profileStatus === false) {
    router.push(nextPath || "/");
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Vous etes deja connecte.</h1>
          <p className={styles.subtitle}>Redirection en cours...</p>
        </div>
      </div>
    );
  }

  if (session?.user && profileStatus === true) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Completer votre profil</h1>
          <p className={styles.subtitle}>Renseignez votre prenom et nom pour continuer.</p>
          {error ? <div className={styles.errorBox}>{error}</div> : null}
          <form className={styles.form} onSubmit={submitProfile}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Prenom</label>
                <input
                  className={styles.input}
                  type="text"
                  required
                  autoFocus
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Nom</label>
                <input
                  className={styles.input}
                  type="text"
                  required
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className={styles.primaryBtn} disabled={busy}>
              {busy ? "Enregistrement..." : "Continuer"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {mode === "signin" ? "Bienvenue sur Spectra" : "Créer un compte"}
        </h1>
        <p className={styles.subtitle}>
          {mode === "signin"
            ? "Connectez-vous pour accéder à votre espace."
            : "Renseignez vos informations pour créer votre compte."}
        </p>

        {error ? <div className={styles.errorBox}>{error}</div> : null}

        {mode === "signin" ? (
          <>
            <div className={styles.form}>
              <button
                type="button"
                className={styles.googleBtn}
                onClick={signInWithGoogle}
                disabled={busy}
              >
                <svg className={styles.googleIcon} viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {busy ? "Connexion en cours..." : "Se connecter avec Google"}
              </button>
            </div>

            <div className={styles.divider}>
              <span>ou</span>
            </div>

            <form className={styles.form} onSubmit={signInWithEmail}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  required
                  value={signInForm.email}
                  onChange={(e) => setSignInForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Mot de passe</label>
                <input
                  className={styles.input}
                  type="password"
                  required
                  value={signInForm.password}
                  onChange={(e) => setSignInForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? "Connexion..." : "Se connecter"}
              </button>
            </form>

            <p className={styles.switchText}>
              Pas encore de compte ?{" "}
              <button
                type="button"
                className={styles.switchLink}
                onClick={() => { setError(""); setMode("signup"); }}
              >
                Créer un compte
              </button>
            </p>
          </>
        ) : (
          <>
            <form className={styles.form} onSubmit={signUp}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Prénom</label>
                  <input
                    className={styles.input}
                    type="text"
                    required
                    autoFocus
                    value={signUpForm.firstName}
                    onChange={(e) => setSignUpForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Nom</label>
                  <input
                    className={styles.input}
                    type="text"
                    required
                    value={signUpForm.lastName}
                    onChange={(e) => setSignUpForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  required
                  value={signUpForm.email}
                  onChange={(e) => setSignUpForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Mot de passe</label>
                <input
                  className={styles.input}
                  type="password"
                  required
                  value={signUpForm.password}
                  onChange={(e) => setSignUpForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirmer le mot de passe</label>
                <input
                  className={styles.input}
                  type="password"
                  required
                  value={signUpForm.confirm}
                  onChange={(e) => setSignUpForm((p) => ({ ...p, confirm: e.target.value }))}
                />
              </div>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? "Création..." : "Créer mon compte"}
              </button>
            </form>

            <p className={styles.switchText}>
              Déjà un compte ?{" "}
              <button
                type="button"
                className={styles.switchLink}
                onClick={() => { setError(""); setMode("signin"); }}
              >
                Se connecter
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
