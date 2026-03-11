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
  { key: "dashboard", label: "Tableau de bord" },
  { key: "calendrier", label: "Calendrier Projets" },
  { key: "planningPerso", label: "Planning Perso" },
  { key: "drive", label: "Drive" },
  { key: "contrats", label: "Contrats / Projets" },
  { key: "commandes", label: "Commandes" },
  { key: "inventaire", label: "Inventaire" },
  { key: "equipements", label: "Equipements" },
  { key: "personnel", label: "Personnel" },
  { key: "fournisseurs", label: "Fournisseurs" },
  { key: "prestataires", label: "Prestataires" },
  { key: "coutsPersonnel", label: "Coûts Personnel" },
  { key: "suiviActivite", label: "Suivi d'Activité" },
  { key: "comptabiliteProjet", label: "Comptabilite Projet" },
  { key: "pilotageBudgetaire", label: "Pilotage Budgetaire" },
  { key: "facturationRevenus", label: "Facturation & Revenus" },
  { key: "admin", label: "Admin" },
]);

const SUPPORTED_ACTIONS_BY_RESOURCE = Object.freeze({
  dashboard: ["view"],
  calendrier: ["view", "create", "edit", "delete"],
  planningPerso: ["view", "create", "edit", "delete"],
  drive: ["view", "create", "edit", "delete"],
  contrats: ["view", "create", "edit", "delete"],
  commandes: ["view", "create", "edit", "delete"],
  inventaire: ["view", "create", "edit", "delete"],
  equipements: ["view", "create", "edit", "delete"],
  personnel: ["view", "create", "edit", "delete"],
  fournisseurs: ["view", "create", "edit", "delete"],
  prestataires: ["view", "create", "edit", "delete"],
  coutsPersonnel: ["view", "create", "edit", "delete"],
  suiviActivite: ["view", "create", "edit", "delete"],
  comptabiliteProjet: ["view"],
  pilotageBudgetaire: ["view"],
  facturationRevenus: ["view"],
  admin: ["view", "create", "edit", "delete"],
});

const PATH_RESOURCE_RULES = [
  { test: (pathname) => pathname === "/", resource: "dashboard" },
  { test: (pathname) => pathname.startsWith("/calendrier-projets"), resource: "calendrier" },
  { test: (pathname) => pathname.startsWith("/calendrier"), resource: "calendrier" },
  { test: (pathname) => pathname.startsWith("/planning-perso"), resource: "planningPerso" },
  { test: (pathname) => pathname.startsWith("/drive"), resource: "drive" },
  { test: (pathname) => pathname.startsWith("/commandes"), resource: "commandes" },
  { test: (pathname) => pathname.startsWith("/inventaire"), resource: "inventaire" },
  { test: (pathname) => pathname.startsWith("/equipements"), resource: "equipements" },
  { test: (pathname) => pathname.startsWith("/contrats-projets"), resource: "contrats" },
  { test: (pathname) => pathname.startsWith("/brief"), resource: "contrats" },
  { test: (pathname) => pathname.startsWith("/contrats"), resource: "contrats" },
  { test: (pathname) => pathname.startsWith("/externes/personnel"), resource: "personnel" },
  { test: (pathname) => pathname.startsWith("/externes/fournisseurs"), resource: "fournisseurs" },
  { test: (pathname) => pathname.startsWith("/externes/prestataires"), resource: "prestataires" },
  { test: (pathname) => pathname.startsWith("/rh/suivi-activite"), resource: "suiviActivite" },
  { test: (pathname) => pathname.startsWith("/finances/comptabilite-projet"), resource: "comptabiliteProjet" },
  { test: (pathname) => pathname.startsWith("/finances/pilotage_budgetaire"), resource: "pilotageBudgetaire" },
  { test: (pathname) => pathname.startsWith("/finances/facturation-revenus"), resource: "facturationRevenus" },
  { test: (pathname) => pathname.startsWith("/admin"), resource: "admin" },
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
  contrats: [
    { key: "budget", label: "Budget / Prix" },
    { key: "clientNom", label: "Nom du client" },
    { key: "contenuBrief", label: "Contenu du brief" },
    { key: "devis", label: "Section Devis" },
    { key: "fichiers", label: "Fichiers joints" },
  ],
  commandes: [
    { key: "prixHT", label: "Prix HT / Totaux" },
    { key: "fournisseur", label: "Fournisseur" },
    { key: "qonto", label: "Paiement Qonto" },
    { key: "commentaires", label: "Commentaires" },
    { key: "referenceUrl", label: "URLs de référence" },
  ],
  inventaire: [
    { key: "prix", label: "Prix / Valeur" },
    { key: "zoneStockage", label: "Zone de stockage" },
  ],
  equipements: [
    { key: "prix", label: "Prix / Valeur" },
  ],
  personnel: [
    { key: "salaire", label: "Salaire / Rémunération" },
    { key: "contrat", label: "Type de contrat" },
    { key: "contact", label: "Coordonnées" },
  ],
  fournisseurs: [
    { key: "tarifs", label: "Tarifs / Prix" },
    { key: "contact", label: "Coordonnées" },
  ],
  prestataires: [
    { key: "tarifs", label: "Tarifs / Prix" },
    { key: "contact", label: "Coordonnées" },
  ],
  coutsPersonnel: [
    { key: "montants", label: "Montants / Coûts" },
  ],
  comptabiliteProjet: [
    { key: "montants", label: "Montants" },
    { key: "details", label: "Détails comptables" },
  ],
  pilotageBudgetaire: [
    { key: "budgets", label: "Budgets / Prévisions" },
    { key: "ecarts", label: "Écarts" },
  ],
  facturationRevenus: [
    { key: "montants", label: "Montants / Revenus" },
    { key: "factures", label: "Factures" },
  ],
  calendrier: [
    { key: "notes", label: "Notes / Détails" },
    { key: "assignations", label: "Assignations" },
  ],
  planningPerso: [
    { key: "notes", label: "Notes personnelles" },
  ],
  drive: [
    { key: "fichiers", label: "Fichiers" },
    { key: "dossiers", label: "Dossiers" },
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
