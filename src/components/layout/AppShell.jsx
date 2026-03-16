"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";
import Sidebar from "./Sidebar";
import ForbiddenView from "../auth/ForbiddenView";
import CommentLayer from "../comments/CommentLayer";
import { authClient } from "../../lib/auth-client";
import {
  ROLE_NAMES,
  getResourceFromPath,
  hasPermission,
  isPublicPath,
} from "../../lib/rbac";

export default function AppShell({ children }) {
  const pathname = usePathname() || "/";
  const { data: session, isPending } = authClient.useSession();
  const [authz, setAuthz] = useState(null);
  const [authzLoading, setAuthzLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setAuthzLoading(true);
        const res = await fetch("/api/authz/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!cancelled) {
          setAuthz(data);
        }
      } catch (error) {
        console.error("authz load error:", error);
        if (!cancelled) setAuthz(null);
      } finally {
        if (!cancelled) setAuthzLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const requiredResource = useMemo(() => getResourceFromPath(pathname), [pathname]);
  const isPublic = isPublicPath(pathname);
  const isAdminPage = pathname.startsWith("/admin");

  const accessState = useMemo(() => {
    if (isPublic) return { type: "allowed" };
    if (isPending || authzLoading) return { type: "loading" };
    if (!session?.user) return { type: "login-required" };
    if (!authz?.authenticated || !authz?.user) return { type: "login-required" };
    if (!authz.isActive) return { type: "inactive" };
    if (isAdminPage && authz?.role?.name !== ROLE_NAMES.ADMIN) return { type: "forbidden" };
    if (requiredResource && !hasPermission(authz.permissions, requiredResource, "view")) {
      return { type: "forbidden" };
    }
    return { type: "allowed" };
  }, [
    isPublic,
    isPending,
    authzLoading,
    session?.user,
    authz,
    isAdminPage,
    requiredResource,
  ]);

  let renderedContent = children;
  if (accessState.type === "loading") {
    renderedContent = <div className={styles.statusText}>Chargement...</div>;
  } else if (accessState.type === "login-required") {
    renderedContent = (
      <div className={styles.statusWrap}>
        <div className={styles.statusCard}>
          <h1 className={styles.statusTitle}>Connexion requise</h1>
          <p className={styles.statusText}>
            Vous devez vous connecter pour acceder a cette page.
          </p>
          <Link href={`/auth?next=${encodeURIComponent(pathname)}`} className={styles.statusBtn}>
            Log in / Register
          </Link>
        </div>
      </div>
    );
  } else if (accessState.type === "inactive") {
    renderedContent = (
      <ForbiddenView
        title="403 - Compte desactive"
        message="Votre compte est desactive. Contactez un administrateur."
      />
    );
  } else if (accessState.type === "forbidden") {
    renderedContent = <ForbiddenView />;
  }

  const isAdmin = authz?.role?.name === ROLE_NAMES.ADMIN;

  return (
    <div className={styles.shell}>
      <Sidebar session={session} authz={authz} loading={isPending || authzLoading} />
      <div className={styles.main}>
        <main className={styles.content}>{renderedContent}</main>
      </div>
      {isAdmin && !isPublic && <CommentLayer />}
    </div>
  );
}
