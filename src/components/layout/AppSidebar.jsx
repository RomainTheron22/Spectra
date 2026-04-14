"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Sun,
  CloudSun,
  CalendarDays,
  CalendarCheck,
  FolderKanban,
  HardDrive,
  Shield,
  Briefcase,
  FileText,
  FileSignature,
  CalendarRange,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  UserCheck,
  Truck,
  Handshake,
  Wallet,
  Calculator,
  PieChart,
  Receipt,
  UserCog,
  BarChart3,
  CalendarClock,
  Building2,
  Wrench,
  Cog,
  ClipboardCheck,
  History,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { getRoleLabel, hasPermission, ROLE_NAMES } from "@/lib/rbac";
import { authClient } from "@/lib/auth-client";

const MAIN_LINKS = [
  { label: "Tableau de bord", to: "/", resource: "dashboard", icon: LayoutDashboard },
  { label: "Météo du jour", to: "/meteo-du-jour", resource: "meteoQuotidien", icon: Sun },
  { label: "Météo de la semaine", to: "/meteo-de-la-semaine", resource: "meteoDuJour", icon: CloudSun },
  { label: "Planning Perso", to: "/planning-perso", resource: "planningPerso", icon: CalendarDays },
  { label: "Mon Planning", to: "/mon-planning", resource: "employeeAbsences", icon: CalendarCheck },
  { label: "Projets", to: "/projets", resource: "contrats", icon: FolderKanban },
  { label: "Drive", to: "/drive", resource: "drive", icon: HardDrive },
  { label: "Admin", to: "/admin", resource: "admin", icon: Shield },
];

const MENU = [
  {
    id: "menu-0",
    label: "Contrats & Projets",
    icon: Briefcase,
    items: [
      { label: "Brief & Devis", to: "/brief", resource: "brief", icon: FileText },
      { label: "Contrats / Projets", to: "/contrats-projets", resource: "contrats", icon: FileSignature },
      { label: "Calendrier Projets", to: "/calendrier-projets", resource: "calendrier", icon: CalendarRange },
    ],
  },
  {
    id: "menu-1",
    label: "Inventaire & Commandes",
    icon: Package,
    items: [
      { label: "Commandes", to: "/commandes", resource: "commandes", icon: ShoppingCart },
      { label: "Inventaire", to: "/inventaire", resource: "inventaire", icon: Boxes },
    ],
  },
  {
    id: "menu-2",
    label: "Réseau & Équipe",
    icon: Users,
    items: [
      { label: "Personnel", to: "/externes/personnel", resource: "personnel", icon: UserCheck },
      { label: "Fournisseurs", to: "/externes/fournisseurs", resource: "fournisseurs", icon: Truck },
      { label: "Prestataires", to: "/externes/prestataires", resource: "prestataires", icon: Handshake },
    ],
  },
  {
    id: "menu-3",
    label: "Finances",
    icon: Wallet,
    items: [
      { label: "Comptabilité Projet", to: "/finances/comptabilite-projet", resource: "comptabiliteProjet", icon: Calculator },
      { label: "Pilotage Budgétaire", to: "/finances/pilotage_budgetaire", resource: "pilotageBudgetaire", icon: PieChart },
      { label: "Facturation & Revenus", to: "/finances/facturation-revenus", resource: "facturationRevenus", icon: Receipt },
    ],
  },
  {
    id: "menu-5",
    label: "RH & Planning",
    icon: UserCog,
    items: [
      { label: "Profils Employés", to: "/rh/profils", resource: "employeeProfiles", icon: Users },
      { label: "Pilotage RH", to: "/rh/pilotage", resource: "pilotageRh", badge: true, icon: BarChart3 },
      { label: "Planning Équipe", to: "/rh/planning-equipe", resource: "pilotageRh", icon: CalendarClock },
      { label: "Vue Entreprise", to: "/rh/entreprise", resource: "pilotageRh", icon: Building2 },
    ],
  },
  {
    id: "menu-4",
    label: "Équipements",
    icon: Wrench,
    items: [
      { label: "Kits & Machines", to: "/equipements/kits-machines", resource: "kitsMachines", icon: Cog },
      { label: "Checklists & EPI", to: "/equipements/checklists-epi", resource: "checklistsEpi", icon: ClipboardCheck },
      { label: "Historique", to: "/equipements/historique", resource: "historiqueEquip", icon: History },
    ],
  },
];

export default function AppSidebar({ session, authz, loading }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const isAuthenticated = Boolean(session?.user && authz?.authenticated);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingAbsences, setPendingAbsences] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || authz?.role?.name !== ROLE_NAMES.ADMIN) return;
    (async () => {
      try {
        const res = await fetch("/api/employee-absences?all=true&statut=en_attente", { cache: "no-store" });
        const data = await res.json();
        setPendingAbsences((data.items || []).length);
      } catch { /* ignore */ }
    })();
  }, [isAuthenticated, authz]);

  const canView = (resource) => {
    if (!isAuthenticated) return false;
    if (resource === "admin" && authz?.role?.name !== ROLE_NAMES.ADMIN) return false;
    return hasPermission(authz?.permissions, resource, "view");
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleMainLinks = useMemo(
    () => MAIN_LINKS.filter((item) => canView(item.resource)),
    [isAuthenticated, authz]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleSections = useMemo(() => {
    return MENU.map((section) => ({
      ...section,
      items: section.items.filter((item) => canView(item.resource)),
    })).filter((section) => section.items.length > 0);
  }, [isAuthenticated, authz]);

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
    <Sidebar collapsible="offcanvas">
      {/* ── Header: User info ── */}
      <SidebarHeader className="p-3">
        {loading ? (
          <div className="flex items-center gap-3 rounded-lg p-3">
            <div className="flex size-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-600 to-sky-400 text-lg font-extrabold text-white shadow-lg shadow-sky-600/35">
              ...
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-white">Chargement...</span>
              <span className="mt-0.5 text-xs text-blue-200/90">Veuillez patienter</span>
            </div>
          </div>
        ) : isAuthenticated ? (
          <div className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.06]">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-600 to-sky-400 text-lg font-extrabold text-white shadow-lg shadow-sky-600/35">
              {iconLetter}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[15px] font-semibold tracking-tight text-white">
                {nameFromAuthz}
              </span>
              <span className="mt-0.5 text-xs font-medium text-blue-200/90">{roleLabel}</span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="mt-1.5 flex items-center gap-1 self-start border-0 bg-transparent p-0 text-xs font-bold text-blue-200/95 underline underline-offset-2 transition-colors hover:text-white disabled:cursor-default disabled:opacity-70"
              >
                <LogOut className="size-3" />
                {isSigningOut ? "Déconnexion..." : "Se déconnecter"}
              </button>
            </div>
          </div>
        ) : (
          <Link
            href={`/auth?next=${encodeURIComponent(pathname)}`}
            className="flex items-center gap-3 rounded-lg border border-transparent p-3 no-underline transition-all duration-150 hover:border-white/10 hover:bg-white/[0.06]"
          >
            <div className="flex size-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-600 to-sky-400 text-lg font-extrabold text-white shadow-lg shadow-sky-600/35">
              L
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold text-white">Log in / Register</span>
              <span className="mt-0.5 text-xs font-medium text-blue-200/90">Authentication</span>
            </div>
          </Link>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      {/* ── Content: Navigation ── */}
      <SidebarContent>
        {/* Main links */}
        {visibleMainLinks.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMainLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link href={item.to} />}
                        isActive={isActivePath(item.to)}
                        tooltip={item.label}
                        className="data-[active]:bg-gradient-to-r data-[active]:from-sky-700 data-[active]:to-sky-500 data-[active]:shadow-md data-[active]:shadow-sky-600/20"
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleMainLinks.length > 0 && visibleSections.length > 0 && (
          <SidebarSeparator />
        )}

        {/* Collapsible sections */}
        {visibleSections.map((section) => {
          const SectionIcon = section.icon;
          const hasActiveChild = section.items.some((item) => isActivePath(item.to));
          return (
            <Collapsible
              key={section.id}
              defaultOpen={hasActiveChild}
              className="group/collapsible"
            >
              <SidebarGroup className="py-0">
                <SidebarGroupLabel
                  render={<CollapsibleTrigger />}
                  className="h-9 cursor-pointer text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <SectionIcon className="size-4" />
                  {section.label}
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90" />
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton
                              render={<Link href={item.to} />}
                              isActive={isActivePath(item.to)}
                              className="pl-7 data-[active]:bg-gradient-to-r data-[active]:from-sky-700 data-[active]:to-sky-500 data-[active]:shadow-md data-[active]:shadow-sky-600/20"
                            >
                              <ItemIcon className="size-4" />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                            {item.badge && pendingAbsences > 0 && (
                              <SidebarMenuBadge className="rounded-full bg-rose-500 text-[10px] font-extrabold text-white">
                                {pendingAbsences}
                              </SidebarMenuBadge>
                            )}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}

        {visibleSections.length === 0 && (
          <SidebarGroup>
            <div className="rounded-[10px] border border-dashed border-white/20 px-3 py-2 text-[13px] text-blue-200/90">
              {isAuthenticated
                ? "Aucun menu accessible avec votre rôle."
                : "Connectez-vous pour afficher la navigation."}
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <span className="text-xs text-sidebar-foreground/60">
          &copy; {new Date().getFullYear()} Spectra
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
