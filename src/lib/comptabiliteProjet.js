export function toSafeNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function ensureProject(map, name) {
  const key = String(name || "").trim();
  if (!key) return null;
  if (!map.has(key)) {
    map.set(key, {
      nomProjet: key,
      clientNom: "",
      statut: "",
      dateDebut: "",
      dateFin: "",
      budgetPrevisionnel: null,
      commandes: [],
      missions: [],
    });
  }
  return map.get(key);
}

function buildCommandeEntry(item, idx) {
  const date = String(item?.dateCreation || item?.createdAt || "").trim();
  return {
    id: String(item?.id || item?._id || `commande-${idx}`),
    date,
    dateObj: toDateOrNull(date),
    fournisseur: String(item?.fournisseur || "").trim(),
    libelle: String(item?.description || item?.produit || "Commande").trim(),
    description: String(item?.description || "").trim(),
    statut: String(item?.status || "").trim(),
    numeroFacture: String(item?.numeroFacture || "").trim(),
    categorie: String(item?.categories || "").trim(),
    typeDepense: String(item?.typeDepense || item?.type || "").trim(),
    montant: toSafeNumber(item?.prixTotalHT) + toSafeNumber(item?.fraisLivraison),
    projet: String(item?.projet || "").trim(),
  };
}

function buildCommandeEntries(item, idx) {
  const produits = Array.isArray(item?.produits) ? item.produits : [];
  const linesWithProject = produits
    .map((produit, pIndex) => {
      const projet = String(produit?.projet || "").trim();
      if (!projet) return null;

      return buildCommandeEntry(
        {
          ...item,
          id: `${String(item?._id || item?.id || `commande-${idx}`)}-p${pIndex}`,
          projet,
          produit: String(produit?.nomProduit || produit?.produit || item?.produit || "Commande").trim(),
          categories: String(produit?.categories || item?.categories || "").trim(),
          prixTotalHT: toSafeNumber(produit?.prixTotalHT),
          fraisLivraison: 0,
        },
        `${idx}-${pIndex}`
      );
    })
    .filter(Boolean);

  if (linesWithProject.length > 0) return linesWithProject;
  return [buildCommandeEntry(item, idx)];
}

function buildMissionEntry(prestataire, mission, idx) {
  const prestataireNom = `${String(prestataire?.prenom || "").trim()} ${String(prestataire?.nom || "").trim()}`.trim();
  const date = String(mission?.dateDebut || "").trim();
  return {
    id: String(mission?.id || `${prestataireNom}-${idx}`),
    date,
    dateObj: toDateOrNull(date),
    dateDebut: String(mission?.dateDebut || "").trim(),
    dateFin: String(mission?.dateFin || "").trim(),
    prestataireNom,
    mission: String(mission?.nomMission || "Mission prestataire").trim(),
    description: String(mission?.description || "").trim(),
    statut: String(mission?.statut || mission?.status || "").trim(),
    categorie: String(mission?.categorie || "").trim(),
    typeDepense: String(mission?.typeDepense || mission?.type || "").trim(),
    montant: toSafeNumber(mission?.tarifTotal),
  };
}

export function buildProjectsDataset({ contrats = [], commandes = [], prestataires = [] }) {
  const map = new Map();

  for (const contrat of contrats) {
    const project = ensureProject(map, contrat?.nomContrat);
    if (!project) continue;
    if (contrat?.clientNom) project.clientNom = String(contrat.clientNom).trim();
    if (contrat?.statut) project.statut = String(contrat.statut).trim();
    if (contrat?.dateDebut) project.dateDebut = String(contrat.dateDebut).trim();
    if (contrat?.dateFin) project.dateFin = String(contrat.dateFin).trim();
    const budgetRaw = contrat?.budgetPrevisionnel ?? contrat?.budget ?? contrat?.budgetTotal;
    if (budgetRaw !== null && budgetRaw !== undefined && budgetRaw !== "") {
      const budget = Number(budgetRaw);
      if (Number.isFinite(budget)) project.budgetPrevisionnel = budget;
    }
  }

  commandes.forEach((commande, index) => {
    const entries = buildCommandeEntries(commande, index);

    for (const entry of entries) {
      const project = ensureProject(map, entry?.projet);
      if (!project) continue;
      project.commandes.push(entry);
    }
  });

  prestataires.forEach((prestataire) => {
    const missions = Array.isArray(prestataire?.missions) ? prestataire.missions : [];
    missions.forEach((mission, index) => {
      const project = ensureProject(map, mission?.projet);
      if (!project) return;
      project.missions.push(buildMissionEntry(prestataire, mission, index));
    });
  });

  return Array.from(map.values());
}

export function toPeriodRange({ year = null, dateFrom = null, dateTo = null }) {
  const y = Number.isFinite(Number(year)) ? Number(year) : null;
  const fromDate = toDateOrNull(dateFrom);
  const toDate = toDateOrNull(dateTo);

  let rangeStart = fromDate;
  let rangeEnd = toDate;

  if (y) {
    if (!rangeStart) rangeStart = new Date(y, 0, 1, 0, 0, 0, 0);
    if (!rangeEnd) rangeEnd = new Date(y, 11, 31, 23, 59, 59, 999);
  }

  return {
    year: y,
    rangeStart,
    rangeEnd,
    hasPeriodFilter: !!(y || fromDate || toDate),
  };
}

export function entryInPeriod(entry, period) {
  if (!period?.hasPeriodFilter) return true;
  if (!entry?.dateObj) return false;
  const t = entry.dateObj.getTime();
  if (period.rangeStart && t < period.rangeStart.getTime()) return false;
  if (period.rangeEnd && t > period.rangeEnd.getTime()) return false;
  return true;
}

function projectDatesIntersectPeriod(project, period) {
  if (!period?.hasPeriodFilter) return true;
  const s = toDateOrNull(project?.dateDebut);
  const e = toDateOrNull(project?.dateFin) || s;
  if (!s && !e) return false;

  const start = s || e;
  const end = e || s;
  if (!start || !end) return false;

  if (period.rangeEnd && start.getTime() > period.rangeEnd.getTime()) return false;
  if (period.rangeStart && end.getTime() < period.rangeStart.getTime()) return false;
  return true;
}

export function summarizeProject(project, period) {
  const commandes = project.commandes.filter((entry) => entryInPeriod(entry, period));
  const missions = project.missions.filter((entry) => entryInPeriod(entry, period));

  const totalCommandes = commandes.reduce((sum, entry) => sum + toSafeNumber(entry.montant), 0);
  const totalPrestataires = missions.reduce((sum, entry) => sum + toSafeNumber(entry.montant), 0);
  const totalDepense = totalCommandes + totalPrestataires;
  const nbCommandes = commandes.length;
  const nbMissions = missions.length;
  const nbEntrees = nbCommandes + nbMissions;

  const budget = project.budgetPrevisionnel;
  const pctBudget =
    budget !== null && budget !== undefined && Number.isFinite(Number(budget)) && Number(budget) > 0
      ? (totalDepense / Number(budget)) * 100
      : null;

  return {
    nomProjet: project.nomProjet,
    clientNom: project.clientNom || "",
    statut: project.statut || "",
    dateDebut: project.dateDebut || "",
    dateFin: project.dateFin || "",
    budgetPrevisionnel: budget,
    pctBudget,
    totalCommandes,
    totalPrestataires,
    totalDepense,
    nbCommandes,
    nbMissions,
    nbEntrees,
    commandes,
    missions,
    hasSignalInPeriod: nbEntrees > 0 || projectDatesIntersectPeriod(project, period),
  };
}

export function projectMatchesFilters(project, filters) {
  const search = normalizeText(filters?.search);
  if (search) {
    const haystack = normalizeText(`${project.nomProjet} ${project.clientNom}`);
    if (!haystack.includes(search)) return false;
  }

  const client = String(filters?.client || "").trim();
  if (client && client !== "all" && String(project.clientNom || "") !== client) return false;

  const statut = String(filters?.statut || "").trim();
  if (statut && statut !== "all" && String(project.statut || "") !== statut) return false;

  return true;
}

export function sortProjectSummaries(items, sortKey) {
  const rows = [...items];
  const dateNum = (value) => {
    const d = toDateOrNull(value);
    return d ? d.getTime() : 0;
  };

  switch (sortKey) {
    case "totalAsc":
      rows.sort((a, b) => a.totalDepense - b.totalDepense);
      break;
    case "dateDesc":
      rows.sort((a, b) => dateNum(b.dateDebut) - dateNum(a.dateDebut));
      break;
    case "dateAsc":
      rows.sort((a, b) => dateNum(a.dateDebut) - dateNum(b.dateDebut));
      break;
    case "nameAsc":
      rows.sort((a, b) => String(a.nomProjet).localeCompare(String(b.nomProjet), "fr"));
      break;
    case "totalDesc":
    default:
      rows.sort((a, b) => b.totalDepense - a.totalDepense);
      break;
  }
  return rows;
}

export function buildProjectOptions(projects) {
  const clients = new Set();
  const statuts = new Set(["En cours", "Termine", "Archive"]);
  const years = new Set();

  for (const project of projects) {
    if (project.clientNom) clients.add(project.clientNom);
    if (project.statut) statuts.add(project.statut);

    const d1 = toDateOrNull(project.dateDebut);
    const d2 = toDateOrNull(project.dateFin);
    if (d1) years.add(d1.getFullYear());
    if (d2) years.add(d2.getFullYear());

    for (const c of project.commandes) {
      if (c.dateObj) years.add(c.dateObj.getFullYear());
    }
    for (const m of project.missions) {
      if (m.dateObj) years.add(m.dateObj.getFullYear());
    }
  }

  return {
    clients: Array.from(clients).sort((a, b) => a.localeCompare(b, "fr")),
    statuts: Array.from(statuts).sort((a, b) => a.localeCompare(b, "fr")),
    years: Array.from(years).sort((a, b) => b - a),
  };
}
