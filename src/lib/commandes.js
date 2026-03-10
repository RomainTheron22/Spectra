function normalizeSimpleString(value) {
  return String(value ?? "").trim();
}

export function toSafeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function computePrixTotalHT(quantite, prixUnitaireHT) {
  const q = Number(quantite);
  const pu = Number(prixUnitaireHT);
  if (!Number.isFinite(q) || !Number.isFinite(pu)) return null;
  return roundMoney(q * pu);
}

function createProduitId(index = 0) {
  return `prd-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasAnyContent(value) {
  if (!value) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return String(value).trim().length > 0;
}

function normalizeLieu(value) {
  const normalized = normalizeSimpleString(value);
  return normalized || "Studio";
}

export function normalizeProduit(input = {}, index = 0) {
  const quantite = toSafeNumber(input.quantite ?? input.quantiteStock) ?? 0;
  const prixUnitaireHT = toSafeNumber(input.prixUnitaireHT ?? input.prixUnitaire);
  const rawTotal = toSafeNumber(input.prixTotalHT);
  const prixTotalHT = rawTotal ?? computePrixTotalHT(quantite, prixUnitaireHT) ?? 0;

  return {
    id: normalizeSimpleString(input.id) || createProduitId(index),
    nomProduit: normalizeSimpleString(input.nomProduit ?? input.produit),
    quantite,
    prixUnitaireHT,
    prixTotalHT,
    referenceUrl: normalizeSimpleString(input.referenceUrl),
    projet: normalizeSimpleString(input.projet),
    categories: normalizeSimpleString(input.categories),
    lieux: normalizeLieu(input.lieux),
    zoneStockage: normalizeSimpleString(input.zoneStockage),
    recu: !!input.recu,
    inventaireCreated: !!input.inventaireCreated,
  };
}

export function produitHasContent(produit = {}) {
  return (
    hasAnyContent(produit.nomProduit) ||
    hasAnyContent(produit.quantite) ||
    hasAnyContent(produit.prixUnitaireHT) ||
    hasAnyContent(produit.referenceUrl) ||
    hasAnyContent(produit.projet) ||
    hasAnyContent(produit.categories) ||
    hasAnyContent(produit.lieux) ||
    hasAnyContent(produit.zoneStockage)
  );
}

export function normalizeProduits(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => normalizeProduit(item, index))
    .filter((item) => produitHasContent(item));
}

export function buildLegacyProduitFromCommande(raw = {}) {
  const legacyCandidate = {
    id: normalizeSimpleString(raw.productId) || "legacy-0",
    nomProduit: normalizeSimpleString(raw.produit),
    quantite: raw.quantite,
    prixUnitaireHT: raw.prixUnitaireHT,
    prixTotalHT: raw.prixTotalHT,
    referenceUrl: raw.referenceUrl,
    projet: raw.projet,
    categories: raw.categories,
    lieux: raw.lieux,
    zoneStockage: raw.zoneStockage,
    recu: raw.status === "En stock" || raw.status === "Livre" || raw.status === "Livree" || !!raw.recu,
    inventaireCreated: !!raw.inventaireCreated,
  };

  const normalized = normalizeProduit(legacyCandidate, 0);
  return produitHasContent(normalized) ? normalized : null;
}

export function ensureCommandeProduits(raw = {}) {
  const fromArray = normalizeProduits(raw.produits);
  if (fromArray.length > 0) return fromArray;

  const legacy = buildLegacyProduitFromCommande(raw);
  return legacy ? [legacy] : [];
}

function uniqueNonEmpty(values = []) {
  return Array.from(new Set(values.map((value) => normalizeSimpleString(value)).filter(Boolean)));
}

export function computeCommandeAggregates(produits = []) {
  const safeProduits = Array.isArray(produits) ? produits : [];

  const prixTotalHT = roundMoney(
    safeProduits.reduce((sum, produit) => sum + (toSafeNumber(produit?.prixTotalHT) ?? 0), 0)
  );

  const quantite = safeProduits.reduce((sum, produit) => sum + (toSafeNumber(produit?.quantite) ?? 0), 0);
  const projets = uniqueNonEmpty(safeProduits.map((produit) => produit.projet));
  const categories = uniqueNonEmpty(safeProduits.map((produit) => produit.categories));
  const lieux = uniqueNonEmpty(safeProduits.map((produit) => produit.lieux));
  const zones = uniqueNonEmpty(safeProduits.map((produit) => produit.zoneStockage));

  const produit =
    safeProduits.length === 0
      ? ""
      : safeProduits.length === 1
        ? safeProduits[0].nomProduit
        : `${safeProduits.length} produits`;

  const referenceUrl = safeProduits.find((item) => item.referenceUrl)?.referenceUrl || "";

  return {
    prixTotalHT,
    quantite,
    prixUnitaireHT: safeProduits.length === 1 ? safeProduits[0].prixUnitaireHT : null,
    produit,
    projet: projets.join(", "),
    categories: categories.join(", "),
    lieux: lieux.join(", "),
    zoneStockage: zones.join(", "),
    referenceUrl,
    totalProduits: safeProduits.length,
    inventaireCreated: safeProduits.length > 0 && safeProduits.every((item) => item.inventaireCreated),
  };
}

export function normalizeCommandeDocument(raw = {}) {
  const produits = ensureCommandeProduits(raw);
  const derived = computeCommandeAggregates(produits);

  return {
    ...raw,
    dateCreation: normalizeSimpleString(raw.dateCreation ?? raw.dateCommande) || null,
    fournisseur: normalizeSimpleString(raw.fournisseur),
    branche: normalizeSimpleString(raw.branche) || "Agency",
    status: normalizeSimpleString(raw.status) || "En attente",
    qonto: !!raw.qonto,
    commentaires: normalizeSimpleString(raw.commentaires),
    numeroFacture: normalizeSimpleString(raw.numeroFacture),
    description: normalizeSimpleString(raw.description),
    fraisLivraison: toSafeNumber(raw.fraisLivraison),
    produits,
    ...derived,
  };
}

export function buildCommandeDoc(payload = {}) {
  const normalized = normalizeCommandeDocument(payload);

  return {
    dateCreation: normalized.dateCreation,
    fournisseur: normalized.fournisseur,
    branche: normalized.branche,
    status: normalized.status,
    qonto: normalized.qonto,
    commentaires: normalized.commentaires,
    produits: normalized.produits,
    prixTotalHT: normalized.prixTotalHT,
    quantite: normalized.quantite,
    prixUnitaireHT: normalized.prixUnitaireHT,
    produit: normalized.produit,
    projet: normalized.projet,
    categories: normalized.categories,
    lieux: normalized.lieux,
    zoneStockage: normalized.zoneStockage,
    referenceUrl: normalized.referenceUrl,
    totalProduits: normalized.totalProduits,
    inventaireCreated: normalized.inventaireCreated,
    numeroFacture: normalized.numeroFacture,
    description: normalized.description,
    fraisLivraison: normalized.fraisLivraison,
  };
}

export function isMeaningfulString(value) {
  return normalizeSimpleString(value).length > 0;
}
