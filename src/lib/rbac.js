export const ROLE_NAMES = Object.freeze({
  INVITE: "invite",
  ADMIN: "admin",
});

export const PERMISSION_ACTIONS = Object.freeze([
  "view",
  "create",
  "edit",
  "delete",
  "export",
]);

export const PERMISSION_RESOURCES = Object.freeze([
  // ── Général ──
  { key: "dashboard",          label: "Tableau de bord",           group: "general" },
  { key: "calendrier",         label: "Calendrier Projets",         group: "general" },
  { key: "planningPerso",      label: "Planning Perso",             group: "general" },
  { key: "drive",              label: "Drive",                      group: "general" },
  // ── Projets ──
  { key: "brief",              label: "Brief",                      group: "projets" },
  { key: "contrats",           label: "Contrats / Projets",         group: "projets" },
  { key: "commandes",          label: "Commandes",                  group: "projets" },
  // ── Stock & Matériel ──
  { key: "inventaire",         label: "Inventaire",                 group: "materiel" },
  { key: "equipements",        label: "Equipements",                group: "materiel" },
  { key: "checklistsEpi",      label: "Checklists EPI",             group: "materiel" },
  { key: "kitsMachines",       label: "Kits Machines",              group: "materiel" },
  { key: "historiqueEquip",    label: "Historique Equipements",     group: "materiel" },
  // ── Externes ──
  { key: "personnel",          label: "Personnel",                  group: "externes" },
  { key: "fournisseurs",       label: "Fournisseurs",               group: "externes" },
  { key: "prestataires",       label: "Prestataires",               group: "externes" },
  // ── RH ──
  { key: "suiviActivite",      label: "Suivi d'Activité",           group: "rh" },
  // ── Finances ──
  { key: "comptabiliteProjet", label: "Comptabilité Projet",        group: "finances" },
  { key: "pilotageBudgetaire", label: "Pilotage Budgétaire",        group: "finances" },
  // ── Admin ──
  { key: "admin",              label: "Admin",                      group: "admin" },
]);

const SUPPORTED_ACTIONS_BY_RESOURCE = Object.freeze({
  dashboard:          ["view"],
  calendrier:         ["view", "create", "edit", "delete"],
  planningPerso:      ["view", "create", "edit", "delete"],
  drive:              ["view", "create", "edit", "delete"],
  brief:              ["view", "create", "edit", "delete"],
  contrats:           ["view", "create", "edit", "delete"],
  commandes:          ["view", "create", "edit", "delete"],
  inventaire:         ["view", "create", "edit", "delete"],
  equipements:        ["view", "create", "edit", "delete"],
  checklistsEpi:      ["view", "create", "edit", "delete"],
  kitsMachines:       ["view", "create", "edit", "delete"],
  historiqueEquip:    ["view"],
  personnel:          ["view", "create", "edit", "delete"],
  fournisseurs:       ["view", "create", "edit", "delete"],
  prestataires:       ["view", "create", "edit", "delete"],
  suiviActivite:      ["view", "create", "edit", "delete"],
  comptabiliteProjet: ["view"],
  pilotageBudgetaire: ["view"],
  admin:              ["view", "create", "edit", "delete"],
});

const PATH_RESOURCE_RULES = [
  { test: (pathname) => pathname === "/",                                           resource: "dashboard" },
  { test: (pathname) => pathname.startsWith("/calendrier-projets"),                 resource: "calendrier" },
  { test: (pathname) => pathname.startsWith("/calendrier"),                         resource: "calendrier" },
  { test: (pathname) => pathname.startsWith("/planning-perso"),                     resource: "planningPerso" },
  { test: (pathname) => pathname.startsWith("/drive"),                              resource: "drive" },
  { test: (pathname) => pathname.startsWith("/brief"),                              resource: "brief" },
  { test: (pathname) => pathname.startsWith("/contrats-projets"),                   resource: "contrats" },
  { test: (pathname) => pathname.startsWith("/contrats"),                           resource: "contrats" },
  { test: (pathname) => pathname.startsWith("/commandes"),                          resource: "commandes" },
  { test: (pathname) => pathname.startsWith("/inventaire"),                         resource: "inventaire" },
  { test: (pathname) => pathname.startsWith("/equipements/checklists-epi"),         resource: "checklistsEpi" },
  { test: (pathname) => pathname.startsWith("/equipements/kits-machines"),          resource: "kitsMachines" },
  { test: (pathname) => pathname.startsWith("/equipements/historique"),             resource: "historiqueEquip" },
  { test: (pathname) => pathname.startsWith("/equipements"),                        resource: "equipements" },
  { test: (pathname) => pathname.startsWith("/externes/personnel"),                 resource: "personnel" },
  { test: (pathname) => pathname.startsWith("/externes/fournisseurs"),              resource: "fournisseurs" },
  { test: (pathname) => pathname.startsWith("/externes/prestataires"),              resource: "prestataires" },
  { test: (pathname) => pathname.startsWith("/rh/suivi-activite"),                  resource: "suiviActivite" },
  { test: (pathname) => pathname.startsWith("/finances/comptabilite-projet"),       resource: "comptabiliteProjet" },
  { test: (pathname) => pathname.startsWith("/finances/pilotage_budgetaire"),       resource: "pilotageBudgetaire" },
  { test: (pathname) => pathname.startsWith("/admin"),                              resource: "admin" },
];

export function normalizeRoleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getRoleLabel(roleName) {
  const role = normalizeRoleName(roleName);
  if (role === ROLE_NAMES.ADMIN) return "Admin";
  if (role === ROLE_NAMES.INVITE) return "Invite";
  return role || "Sans role";
}

export function createPermissionMatrix(defaultValue = false) {
  const matrix = {};
  for (const resource of PERMISSION_RESOURCES) {
    matrix[resource.key] = {};
    for (const action of PERMISSION_ACTIONS) {
      matrix[resource.key][action] =
        Boolean(defaultValue) && isActionSupportedForResource(resource.key, action);
    }
  }
  return matrix;
}

export function createAdminPermissions() {
  return createPermissionMatrix(true);
}

export function createInvitePermissions() {
  const matrix = createPermissionMatrix(false);
  matrix.dashboard.view = true;
  return matrix;
}

export function normalizePermissions(input, defaultValue = false) {
  const normalized = createPermissionMatrix(defaultValue);
  if (!input || typeof input !== "object") return normalized;

  for (const resource of PERMISSION_RESOURCES) {
    const source = input[resource.key];
    if (!source || typeof source !== "object") continue;
    for (const action of PERMISSION_ACTIONS) {
      if (!isActionSupportedForResource(resource.key, action)) continue;
      if (action in source) {
        normalized[resource.key][action] = Boolean(source[action]);
      }
    }
    // Préserver les permissions de champs si présentes
    const fields = getResourceFields(resource.key);
    if (fields.length > 0) {
      normalized[resource.key].fields = {};
      for (const field of fields) {
        const stored = source?.fields?.[field.key];
        normalized[resource.key].fields[field.key] = stored === undefined ? true : Boolean(stored);
      }
    }
  }

  return normalized;
}

export function getSupportedActionsForResource(resourceKey) {
  const key = String(resourceKey || "").trim();
  const supported = SUPPORTED_ACTIONS_BY_RESOURCE[key];
  if (Array.isArray(supported) && supported.length > 0) {
    return supported.filter((action) => PERMISSION_ACTIONS.includes(action));
  }
  return [...PERMISSION_ACTIONS];
}

export function isActionSupportedForResource(resourceKey, action) {
  const supported = getSupportedActionsForResource(resourceKey);
  return supported.includes(String(action || "").trim());
}

// Permissions de champs par ressource.
// Par défaut tous les champs sont visibles (true).
// L'admin peut les restreindre par rôle.
export const RESOURCE_FIELDS = Object.freeze({
  // ── Brief ──
  brief: [
    { key: "budget",        label: "Budget / Prix" },
    { key: "clientNom",     label: "Nom du client" },
    { key: "branche",       label: "Branche" },
    { key: "contenuBrief",  label: "Contenu du brief" },
    { key: "devis",         label: "Section Devis (prix estimés)" },
    { key: "fichiers",      label: "Fichiers joints" },
    { key: "statut",        label: "Statut" },
  ],
  // ── Contrats / Projets ──
  contrats: [
    { key: "clientNom",     label: "Nom du client" },
    { key: "lieu",          label: "Lieu" },
    { key: "dateDebut",     label: "Date de début" },
    { key: "dateFin",       label: "Date de fin" },
    { key: "fichiers",      label: "Fichiers joints" },
  ],
  // ── Commandes ──
  commandes: [
    { key: "prixHT",        label: "Prix HT / Totaux" },
    { key: "fournisseur",   label: "Fournisseur" },
    { key: "qonto",         label: "Paiement Qonto" },
    { key: "commentaires",  label: "Commentaires" },
    { key: "referenceUrl",  label: "URLs de référence" },
  ],
  // ── Inventaire ──
  inventaire: [
    { key: "prix",          label: "Prix / Valeur" },
    { key: "zoneStockage",  label: "Zone de stockage" },
    { key: "serialNumber",  label: "Numéro de série" },
  ],
  // ── Equipements ──
  equipements: [
    { key: "prix",          label: "Prix / Valeur" },
    { key: "etat",          label: "État / Condition" },
    { key: "serialNumber",  label: "Numéro de série" },
    { key: "notes",         label: "Notes / Observations" },
  ],
  checklistsEpi: [
    { key: "resultats",     label: "Résultats des contrôles" },
    { key: "notes",         label: "Notes / Observations" },
  ],
  kitsMachines: [
    { key: "contenu",       label: "Contenu du kit" },
    { key: "notes",         label: "Notes" },
  ],
  // ── Personnel & Externes ──
  personnel: [
    { key: "salaire",       label: "Salaire / Rémunération" },
    { key: "contrat",       label: "Type de contrat" },
    { key: "contact",       label: "Coordonnées" },
    { key: "notes",         label: "Notes RH" },
  ],
  fournisseurs: [
    { key: "tarifs",        label: "Tarifs / Prix" },
    { key: "contact",       label: "Coordonnées" },
    { key: "notes",         label: "Notes" },
  ],
  prestataires: [
    { key: "tarifs",        label: "Tarifs / Prix" },
    { key: "contact",       label: "Coordonnées" },
    { key: "notes",         label: "Notes" },
  ],
  // ── RH ──
  suiviActivite: [
    { key: "heures",        label: "Heures travaillées" },
    { key: "absences",      label: "Absences / Congés" },
    { key: "notes",         label: "Commentaires" },
  ],
  // ── Finances ──
  comptabiliteProjet: [
    { key: "montants",      label: "Montants / Totaux" },
    { key: "details",       label: "Détails comptables" },
    { key: "marges",        label: "Marges" },
  ],
  pilotageBudgetaire: [
    { key: "budgets",       label: "Budgets / Prévisions" },
    { key: "ecarts",        label: "Écarts budgétaires" },
    { key: "previsions",    label: "Prévisions" },
  ],
  // ── Calendrier & Planning ──
  calendrier: [
    { key: "notes",         label: "Notes / Détails" },
    { key: "assignations",  label: "Assignations" },
  ],
  planningPerso: [
    { key: "notes",         label: "Notes personnelles" },
    { key: "evenements",    label: "Evénements privés" },
  ],
  // ── Drive ──
  drive: [
    { key: "fichiers",      label: "Fichiers" },
    { key: "dossiers",      label: "Dossiers" },
  ],
});

export function getResourceFields(resourceKey) {
  return RESOURCE_FIELDS[String(resourceKey || "")] || [];
}

export function hasFieldPermission(permissions, resource, fieldKey) {
  const fields = permissions?.[resource]?.fields;
  if (!fields || typeof fields !== "object") return true; // visible par défaut
  if (!(fieldKey in fields)) return true; // champ non restreint = visible
  return Boolean(fields[fieldKey]);
}

export function hasPermission(permissions, resource, action = "view") {
  if (!resource || !action) return false;
  if (!permissions || typeof permissions !== "object") return false;
  return Boolean(permissions?.[resource]?.[action]);
}

export function isPublicPath(pathname) {
  const path = String(pathname || "");
  return path.startsWith("/auth") || path === "/403";
}

export function getResourceFromPath(pathname) {
  const path = String(pathname || "/");
  for (const rule of PATH_RESOURCE_RULES) {
    if (rule.test(path)) return rule.resource;
  }
  return null;
}
