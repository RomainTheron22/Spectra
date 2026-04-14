"use client";

import React, { useEffect, useMemo, useState } from "react";
/* eslint-disable react-hooks/exhaustive-deps */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";
import { getRoleLabel, hasPermission, ROLE_NAMES } from "../../lib/rbac";
import { authClient } from "../../lib/auth-client";

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const MAIN_LINKS = [
  { label: "Tableau de bord", to: "/", resource: "dashboard" },
  { label: "Météo du jour", to: "/meteo-du-jour", resource: "meteoQuotidien" },
  { label: "Météo de la semaine", to: "/meteo-de-la-semaine", resource: "meteoDuJour" },
  { label: "Planning Perso", to: "/planning-perso", resource: "planningPerso" },
  { label: "Mon Planning", to: "/mon-planning", resource: "employeeAbsences" },
  { label: "Projets", to: "/projets", resource: "contrats" },
  { label: "Drive", to: "/drive", resource: "drive" },
  { label: "Admin", to: "/admin", resource: "admin" },
];

const MENU = [
  {
    id: "menu-0",
    label: "Contrats & Projets",
    items: [
      { label: "Brief & Devis", to: "/brief", resource: "brief" },
      { label: "Contrats / Projets", to: "/contrats-projets", resource: "contrats" },
      { label: "Calendrier Projets", to: "/calendrier-projets", resource: "calendrier" },
    ],
  },
  {
    id: "menu-1",
    label: "Inventaire & Commandes",
    items: [
      { label: "Commandes", to: "/commandes", resource: "commandes" },
      { label: "Inventaire", to: "/inventaire", resource: "inventaire" },
    ],
  },
  {
    id: "menu-2",
    label: "Réseau & Équipe",
    items: [
      { label: "Personnel", to: "/externes/personnel", resource: "personnel" },
      { label: "Fournisseurs", to: "/externes/fournisseurs", resource: "fournisseurs" },
      { label: "Prestataires", to: "/externes/prestataires", resource: "prestataires" },
    ],
  },
  {
    id: "menu-3",
    label: "Finances",
    items: [
      {
        label: "Comptabilite Projet",
        to: "/finances/comptabilite-projet",
        resource: "comptabiliteProjet",
      },
      {
        label: "Pilotage Budgetaire",
        to: "/finances/pilotage_budgetaire",
        resource: "pilotageBudgetaire",
      },
      {
        label: "Facturation & Revenus",
        to: "/finances/facturation-revenus",
        resource: "facturationRevenus",
      },
    ],
  },
  {
    id: "menu-5",
    label: "RH & Planning",
    items: [
      { label: "Profils Employés", to: "/rh/profils", resource: "employeeProfiles" },
      { label: "Pilotage RH", to: "/rh/pilotage", resource: "pilotageRh", badge: true },
      { label: "Planning Équipe", to: "/rh/planning-equipe", resource: "pilotageRh" },
      { label: "Vue Entreprise", to: "/rh/entreprise", resource: "pilotageRh" },
    ],
  },
  {
    id: "menu-4",
    label: "Equipements",
    items: [
      { label: "Kits & Machines", to: "/equipements/kits-machines", resource: "kitsMachines" },
      { label: "Checklists & EPI", to: "/equipements/checklists-epi", resource: "checklistsEpi" },
      { label: "Historique", to: "/equipements/historique", resource: "historiqueEquip" },
    ],
  },
];

export default function Sidebar({ session, authz, loading }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const isAuthenticated = Boolean(session?.user && authz?.authenticated);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingAbsences, setPendingAbsences] = useState(0);

  // Fetch pending absences count for admin badge
  useEffect(() => {
    if (!isAuthenticated || authz?.role?.name !== ROLE_NAMES.ADMIN) return;
    (async () => {
      try {
        const res = await fetch("/api/employee-absences?all=true&statut=en_attente", { cache: "no-store" });
        const data = await res.json();
        setPendingAbsences((data.items || []).length);
      } catch {}
    })();
  }, [isAuthenticated, authz]);

  const canView = (resource) => {
    if (!isAuthenticated) return false;
    if (resource === "admin" && authz?.role?.name !== ROLE_NAMES.ADMIN) return false;
    return hasPermission(authz?.permissions, resource, "view");
  };

  const visibleMainLinks = useMemo(
    () => MAIN_LINKS.filter((item) => canView(item.resource)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, authz]
  );

  const visibleSections = useMemo(() => {
    return MENU.map((section) => ({
      ...section,
      items: section.items.filter((item) => canView(item.resource)),
    })).filter((section) => section.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authz]);

  const defaultOpen = useMemo(() => {
    const open = {};
    for (const section of visibleSections) {
      open[section.id] = section.items.some((it) => pathname.startsWith(it.to));
    }
    if (pathname === "/") {
      for (const k of Object.keys(open)) open[k] = false;
    }
    return open;
  }, [pathname, visibleSections]);

  const [openSections, setOpenSections] = useState(defaultOpen);

  useEffect(() => {
    setOpenSections(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const section of visibleSections) {
        const shouldOpen = section.items.some((it) => pathname.startsWith(it.to));
        if (shouldOpen) next[section.id] = true;
      }
      return next;
    });
  }, [pathname, visibleSections]);

  const toggle = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isActivePath = (to) => {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(to + "/");
  };

  const nameFromAuthz =
    authz?.user?.name ||
    `${authz?.user?.firstName || ""} ${authz?.user?.lastName || ""}`.trim() ||
    session?.user?.name ||
    "Utilisateur";
  const roleLabel = authz?.role?.label || getRoleLabel(authz?.role?.name);
  const iconLetter = String(nameFromAuthz || "U").trim().charAt(0).toUpperCase() || "U";

  const handleSignOut = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      await authClient.signOut();
      router.push(`/auth?next=${encodeURIComponent(pathname)}`);
      router.refresh();
    } catch (error) {
      console.error("sign out error:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandWrap}>
        {loading ? (
          <div className={styles.brand}>
            <div className={styles.brandIcon}>...</div>
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>Chargement...</div>
              <div className={styles.brandSubtitle}>Veuillez patienter</div>
            </div>
          </div>
        ) : isAuthenticated ? (
          <div className={styles.brand}>
            <div className={styles.brandIcon}>{iconLetter}</div>
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>{nameFromAuthz}</div>
              <div className={styles.brandSubtitle}>{roleLabel}</div>
              <button
                type="button"
                className={styles.logoutText}
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Deconnexion..." : "Se deconnecter"}
              </button>
            </div>
          </div>
        ) : (
          <Link href={`/auth?next=${encodeURIComponent(pathname)}`} className={styles.brandLink}>
            <div className={styles.brand}>
              <div className={styles.brandIcon}>L</div>
              <div className={styles.brandText}>
                <div className={styles.brandTitle}>Log in / Register</div>
                <div className={styles.brandSubtitle}>Authentication</div>
              </div>
            </div>
          </Link>
        )}

        <div className={styles.brandDivider} />
      </div>

      <nav className={styles.nav} aria-label="Navigation principale">
        {visibleMainLinks.length > 0 ? (
          <div className={styles.mainLinks}>
            {visibleMainLinks.map((item) => {
              const active = isActivePath(item.to);
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={active ? `${styles.homeLink} ${styles.active}` : styles.homeLink}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        {visibleMainLinks.length > 0 && visibleSections.length > 0 ? (
          <div className={styles.sectionDivider} />
        ) : null}

        {visibleSections.length > 0 ? (
          <div className={styles.submenusScroll}>
            {visibleSections.map((section) => {
              const isOpen = !!openSections[section.id];
              return (
                <div className={styles.section} key={section.id}>
                  <button
                    type="button"
                    className={styles.sectionButton}
                    onClick={() => toggle(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={`section-${section.id}-${slugify(section.label)}`}
                  >
                    <span className={styles.sectionLabel}>{section.label}</span>
                    <span className={isOpen ? styles.chevOpen : styles.chev} aria-hidden="true">
                      ▸
                    </span>
                  </button>

                  <div
                    id={`section-${section.id}-${slugify(section.label)}`}
                    className={isOpen ? styles.itemsOpen : styles.items}
                  >
                    {section.items.map((item) => {
                      const active = isActivePath(item.to);
                      return (
                        <Link
                          key={item.to}
                          href={item.to}
                          className={active ? `${styles.item} ${styles.active}` : styles.item}
                        >
                          {item.label}
                          {item.badge && pendingAbsences > 0 && <span className={styles.badge}>{pendingAbsences}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {isAuthenticated
              ? "Aucun menu accessible avec votre role."
              : "Connectez-vous pour afficher la navigation."}
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerHint}>© {new Date().getFullYear()} Spectra</div>
      </div>
    </aside>
  );
}
