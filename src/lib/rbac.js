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

// Structure miroir de la sidebar : group = menu, resources = sous-menus
export const PERMISSION_RESOURCES = Object.freeze([
  // ── Général (liens directs, pas de menu déroulant) ──
  { key: "dashboard",          label: "Tableau de bord",         group: "general" },
  { key: "meteoDuJour",        label: "Météo de la semaine",      group: "general" },
  { key: "meteoQuotidien",     label: "Météo du jour",            group: "general" },
  { key: "planningPerso",      label: "Planning Perso",           group: "general" },
  { key: "drive",              label: "Drive",                    group: "general" },
  { key: "admin",              label: "Admin",                    group: "general" },
  // ── Contrats & Projets ──
  { key: "brief",              label: "Brief & Devis",            group: "contrats" },
  { key: "contrats",           label: "Contrats / Projets",       group: "contrats" },
  { key: "calendrier",         label: "Calendrier Projets",       group: "contrats" },
  // ── Inventaire & Commandes ──
  { key: "commandes",          label: "Commandes",                group: "inventaire" },
  { key: "inventaire",         label: "Inventaire",               group: "inventaire" },
  // ── Réseau & Équipe ──
  { key: "personnel",          label: "Personnel",                group: "reseau" },
  { key: "fournisseurs",       label: "Fournisseurs",             group: "reseau" },
  { key: "prestataires",       label: "Prestataires",             group: "reseau" },
  // ── Finances ──
  { key: "comptabiliteProjet", label: "Comptabilité Projet",      group: "finances" },
  { key: "pilotageBudgetaire", label: "Pilotage Budgétaire",      group: "finances" },
  { key: "facturationRevenus", label: "Facturation & Revenus",    group: "finances" },
  // ── Equipements ──
  { key: "kitsMachines",       label: "Kits & Machines",          group: "equipements" },
  { key: "checklistsEpi",      label: "Checklists & EPI",         group: "equipements" },
  { key: "historiqueEquip",    label: "Historique Equipements",   group: "equipements" },
  // ── RH & Planning ──
  { key: "employeeProfiles",   label: "Profils Employés",         group: "rh" },
  { key: "employeeAbsences",   label: "Absences & Congés",        group: "rh" },
  { key: "pilotageRh",         label: "Pilotage RH",              group: "rh" },
]);

export const GROUP_LABELS = Object.freeze({
  general:      "Général",
  contrats:     "Contrats & Projets",
  inventaire:   "Inventaire & Commandes",
  reseau:       "Réseau & Équipe",
  finances:     "Finances",
  equipements:  "Equipements",
  rh:           "RH & Planning",
});

const SUPPORTED_ACTIONS_BY_RESOURCE = Object.freeze({
  dashboard:          ["view"],
  meteoDuJour:        ["view"],
  meteoQuotidien:     ["view"],
  planningPerso:      ["view", "create", "edit", "delete"],
  drive:              ["view", "create", "edit", "delete"],
  admin:              ["view", "create", "edit", "delete"],
  brief:              ["view", "create", "edit", "delete", "export"],
  contrats:           ["view", "create", "edit", "delete", "export"],
  calendrier:         ["view", "create", "edit", "delete"],
  commandes:          ["view", "create", "edit", "delete", "export"],
  inventaire:         ["view", "create", "edit", "delete", "export"],
  personnel:          ["view", "create", "edit", "delete", "export"],
  fournisseurs:       ["view", "create", "edit", "delete", "export"],
  prestataires:       ["view", "create", "edit", "delete", "export"],
  comptabiliteProjet: ["view", "export"],
  pilotageBudgetaire: ["view", "export"],
  facturationRevenus: ["view", "create", "edit", "delete", "export"],
  kitsMachines:       ["view", "create", "edit", "delete"],
  checklistsEpi:      ["view", "create", "edit", "delete"],
  historiqueEquip:    ["view", "export"],
  employeeProfiles:   ["view", "create", "edit", "delete"],
  employeeAbsences:   ["view", "create", "edit", "delete"],
  pilotageRh:         ["view"],
});

const PATH_RESOURCE_RULES = [
  { test: (p) => p === "/",                                         resource: "dashboard" },
  { test: (p) => p.startsWith("/meteo-du-jour"),                    resource: "meteoQuotidien" },
  { test: (p) => p.startsWith("/meteo-de-la-semaine"),              resource: "meteoDuJour" },
  { test: (p) => p.startsWith("/planning-perso"),                   resource: "planningPerso" },
  { test: (p) => p.startsWith("/drive"),                            resource: "drive" },
  { test: (p) => p.startsWith("/admin"),                            resource: "admin" },
  { test: (p) => p.startsWith("/brief"),                            resource: "brief" },
  { test: (p) => p.startsWith("/contrats-projets"),                 resource: "contrats" },
  { test: (p) => p.startsWith("/contrats"),                         resource: "contrats" },
  { test: (p) => p.startsWith("/calendrier-projets"),               resource: "calendrier" },
  { test: (p) => p.startsWith("/calendrier"),                       resource: "calendrier" },
  { test: (p) => p.startsWith("/commandes"),                        resource: "commandes" },
  { test: (p) => p.startsWith("/inventaire"),                       resource: "inventaire" },
  { test: (p) => p.startsWith("/externes/personnel"),               resource: "personnel" },
  { test: (p) => p.startsWith("/externes/fournisseurs"),            resource: "fournisseurs" },
  { test: (p) => p.startsWith("/externes/prestataires"),            resource: "prestataires" },
  { test: (p) => p.startsWith("/finances/comptabilite-projet"),     resource: "comptabiliteProjet" },
  { test: (p) => p.startsWith("/finances/pilotage_budgetaire"),     resource: "pilotageBudgetaire" },
  { test: (p) => p.startsWith("/finances/facturation-revenus"),     resource: "facturationRevenus" },
  { test: (p) => p.startsWith("/equipements/kits-machines"),        resource: "kitsMachines" },
  { test: (p) => p.startsWith("/equipements/checklists-epi"),       resource: "checklistsEpi" },
  { test: (p) => p.startsWith("/equipements/historique"),           resource: "historiqueEquip" },
  { test: (p) => p.startsWith("/equipements"),                      resource: "kitsMachines" },
  { test: (p) => p.startsWith("/rh/profils"),                       resource: "employeeProfiles" },
  { test: (p) => p.startsWith("/rh/absences"),                      resource: "employeeAbsences" },
  { test: (p) => p.startsWith("/rh/pilotage"),                      resource: "pilotageRh" },
  { test: (p) => p.startsWith("/mon-planning"),                     resource: "employeeAbsences" },
  { test: (p) => p.startsWith("/rh/planning-equipe"),               resource: "pilotageRh" },
];

export function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
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
  matrix.employeeAbsences.view = true;
  matrix.employeeAbsences.create = true;
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
    // Préserver les permissions de champs
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

// ─────────────────────────────────────────────
// Permissions de champs — par défaut tous visible (true)
// ─────────────────────────────────────────────
export const RESOURCE_FIELDS = Object.freeze({
  // ── Brief & Devis ──
  brief: [
    { key: "nomBrief",        label: "Nom du brief" },
    { key: "clientNom",       label: "Nom du client" },
    { key: "branche",         label: "Branche" },
    { key: "budget",          label: "Budget / Prix global" },
    { key: "statut",          label: "Statut" },
    { key: "contenuBrief",    label: "Contenu / Description du brief" },
    { key: "devisPrix",       label: "Prix estimés dans les devis" },
    { key: "devisAssigne",    label: "Assignations des devis" },
    { key: "devisComposants", label: "Détail composants devis (qté, prix unit.)" },
    { key: "fichiers",        label: "Fichiers joints" },
  ],
  // ── Contrats / Projets ──
  contrats: [
    { key: "nomContrat",      label: "Nom du contrat" },
    { key: "clientNom",       label: "Nom du client" },
    { key: "branche",         label: "Branche" },
    { key: "lieu",            label: "Lieu" },
    { key: "statut",          label: "Statut" },
    { key: "dateDebut",       label: "Date de début" },
    { key: "dateFin",         label: "Date de fin" },
    { key: "brief",           label: "Brief / Description" },
    { key: "fichiers",        label: "Fichiers joints" },
  ],
  // ── Calendrier Projets ──
  calendrier: [
    { key: "titre",           label: "Titre de l'événement" },
    { key: "dateHeure",       label: "Date & Heure" },
    { key: "lieu",            label: "Lieu" },
    { key: "assignations",    label: "Assignations (qui participe)" },
    { key: "notes",           label: "Notes / Détails" },
    { key: "projet",          label: "Projet lié" },
  ],
  // ── Commandes ──
  commandes: [
    { key: "dateCreation",    label: "Date de commande" },
    { key: "fournisseur",     label: "Fournisseur" },
    { key: "branche",         label: "Branche" },
    { key: "statut",          label: "Statut de la commande" },
    { key: "qonto",           label: "Paiement Qonto" },
    { key: "commentaires",    label: "Commentaires" },
    { key: "prixTotalHT",     label: "Prix total HT" },
    { key: "prixUnitaires",   label: "Prix unitaires des produits" },
    { key: "referenceUrl",    label: "URLs de référence" },
    { key: "zoneStockage",    label: "Zone de stockage" },
    { key: "projet",          label: "Projet lié" },
  ],
  // ── Inventaire ──
  inventaire: [
    { key: "nomArticle",      label: "Nom de l'article" },
    { key: "quantite",        label: "Quantité en stock" },
    { key: "prixUnitaire",    label: "Prix unitaire" },
    { key: "valeurTotale",    label: "Valeur totale du stock" },
    { key: "categorie",       label: "Catégorie" },
    { key: "zoneStockage",    label: "Zone de stockage" },
    { key: "fournisseur",     label: "Fournisseur" },
    { key: "referenceUrl",    label: "Référence / URL" },
    { key: "notes",           label: "Notes" },
  ],
  // ── Personnel ──
  personnel: [
    { key: "nomPrenom",       label: "Nom & Prénom" },
    { key: "poste",           label: "Poste / Fonction" },
    { key: "typeContrat",     label: "Type de contrat" },
    { key: "salaire",         label: "Salaire / Rémunération" },
    { key: "email",           label: "Email professionnel" },
    { key: "telephone",       label: "Téléphone" },
    { key: "adresse",         label: "Adresse" },
    { key: "dateEntree",      label: "Date d'entrée" },
    { key: "dateSortie",      label: "Date de sortie" },
    { key: "notes",           label: "Notes RH" },
  ],
  // ── Fournisseurs ──
  fournisseurs: [
    { key: "nomSociete",      label: "Nom de la société" },
    { key: "contact",         label: "Contact (nom, email, tél.)" },
    { key: "adresse",         label: "Adresse" },
    { key: "tarifs",          label: "Tarifs / Grille de prix" },
    { key: "conditionsPaiement", label: "Conditions de paiement" },
    { key: "notes",           label: "Notes" },
    { key: "documents",       label: "Documents / Contrats" },
  ],
  // ── Prestataires ──
  prestataires: [
    { key: "nomSociete",      label: "Nom de la société / Personne" },
    { key: "contact",         label: "Contact (nom, email, tél.)" },
    { key: "adresse",         label: "Adresse" },
    { key: "tarifs",          label: "Tarifs / Taux journalier" },
    { key: "specialite",      label: "Spécialité / Domaine" },
    { key: "notes",           label: "Notes" },
    { key: "documents",       label: "Documents / Contrats" },
  ],
  // ── Comptabilité Projet ──
  comptabiliteProjet: [
    { key: "recettes",        label: "Recettes / Revenus" },
    { key: "depenses",        label: "Dépenses" },
    { key: "marge",           label: "Marge brute" },
    { key: "margePercent",    label: "Marge en %" },
    { key: "detailLignes",    label: "Détail des lignes comptables" },
    { key: "tva",             label: "TVA" },
  ],
  // ── Pilotage Budgétaire ──
  pilotageBudgetaire: [
    { key: "budgetPrevu",     label: "Budget prévu" },
    { key: "budgetRealise",   label: "Budget réalisé" },
    { key: "ecart",           label: "Écart budget vs réalisé" },
    { key: "ecartPercent",    label: "Écart en %" },
    { key: "previsions",      label: "Prévisions fin de projet" },
    { key: "alertes",         label: "Alertes dépassement" },
  ],
  // ── Facturation & Revenus ──
  facturationRevenus: [
    { key: "numeroFacture",   label: "Numéro de facture" },
    { key: "client",          label: "Client facturé" },
    { key: "montantHT",       label: "Montant HT" },
    { key: "montantTTC",      label: "Montant TTC" },
    { key: "statut",          label: "Statut (payé, en attente…)" },
    { key: "dateEmission",    label: "Date d'émission" },
    { key: "dateEcheance",    label: "Date d'échéance" },
    { key: "notes",           label: "Notes" },
  ],
  // ── Kits & Machines ──
  kitsMachines: [
    { key: "nomKit",          label: "Nom du kit" },
    { key: "contenu",         label: "Contenu du kit (liste)" },
    { key: "etat",            label: "État / Disponibilité" },
    { key: "valeur",          label: "Valeur estimée" },
    { key: "localisation",    label: "Localisation / Stockage" },
    { key: "notes",           label: "Notes" },
  ],
  // ── Checklists & EPI ──
  checklistsEpi: [
    { key: "nomChecklist",    label: "Nom de la checklist" },
    { key: "items",           label: "Items / Points de contrôle" },
    { key: "resultat",        label: "Résultat de la vérification" },
    { key: "operateur",       label: "Opérateur / Responsable" },
    { key: "dateControle",    label: "Date du contrôle" },
    { key: "notes",           label: "Notes / Observations" },
  ],
  // ── Historique Equipements ──
  historiqueEquip: [
    { key: "dateEvenement",   label: "Date de l'événement" },
    { key: "typeEvenement",   label: "Type (maintenance, panne, prêt…)" },
    { key: "responsable",     label: "Responsable" },
    { key: "cout",            label: "Coût de l'intervention" },
    { key: "description",     label: "Description" },
  ],
  // ── RH & Planning ──
  employeeProfiles: [
    { key: "nomPrenom",       label: "Nom & Prénom" },
    { key: "contrat",         label: "Type de contrat" },
    { key: "pole",            label: "Pôle" },
    { key: "entite",          label: "Entité" },
    { key: "joursPresence",   label: "Jours de présence" },
    { key: "dateDebut",       label: "Date d'entrée" },
    { key: "dateFin",         label: "Date de fin de contrat" },
    { key: "congesAnnuels",   label: "Crédit congés annuel" },
  ],
  employeeAbsences: [
    { key: "type",            label: "Type d'absence" },
    { key: "dates",           label: "Dates" },
    { key: "statut",          label: "Statut" },
    { key: "commentaire",     label: "Commentaire" },
    { key: "motifRefus",      label: "Motif de refus" },
  ],
  pilotageRh: [
    { key: "remplissage",     label: "Taux de remplissage" },
    { key: "zonesRouges",     label: "Zones rouges" },
    { key: "demandes",        label: "Demandes en attente" },
    { key: "finsContrat",     label: "Fins de contrat proches" },
    { key: "tendances",       label: "Tendances absences" },
  ],
  // ── Planning Perso ──
  planningPerso: [
    { key: "evenements",      label: "Mes événements" },
    { key: "disponibilites",  label: "Disponibilités" },
    { key: "notesPerso",      label: "Notes personnelles" },
  ],
  // ── Drive ──
  drive: [
    { key: "fichiers",        label: "Fichiers" },
    { key: "dossiers",        label: "Dossiers" },
    { key: "partages",        label: "Partages / Accès" },
  ],
});

export function getResourceFields(resourceKey) {
  return RESOURCE_FIELDS[String(resourceKey || "")] || [];
}

export function hasFieldPermission(permissions, resource, fieldKey) {
  const fields = permissions?.[resource]?.fields;
  if (!fields || typeof fields !== "object") return true;
  if (!(fieldKey in fields)) return true;
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
