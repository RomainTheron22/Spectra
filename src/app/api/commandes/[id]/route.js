import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import {
  computeCommandeAggregates,
  ensureCommandeProduits,
  normalizeCommandeDocument,
  normalizeProduit,
  normalizeProduits,
  toSafeNumber,
} from "../../../../lib/commandes";

function getIdFromContextOrUrl(request, context) {
  const fromParams = context?.params?.id;
  if (fromParams) return String(fromParams);

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return String(parts[parts.length - 1] || "");
}

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

function applyLegacyProductPatch(currentProduits, payload) {
  const base = [...currentProduits];
  if (!base[0]) base.push(normalizeProduit({}, 0));

  const first = { ...base[0] };

  if ("produit" in payload) first.nomProduit = String(payload.produit || "").trim();
  if ("quantite" in payload) first.quantite = toSafeNumber(payload.quantite) ?? 0;
  if ("prixUnitaireHT" in payload) first.prixUnitaireHT = toSafeNumber(payload.prixUnitaireHT);
  if ("prixTotalHT" in payload) first.prixTotalHT = toSafeNumber(payload.prixTotalHT) ?? first.prixTotalHT;
  if ("referenceUrl" in payload) first.referenceUrl = String(payload.referenceUrl || "").trim();
  if ("projet" in payload) first.projet = String(payload.projet || "").trim();
  if ("categories" in payload) first.categories = String(payload.categories || "").trim();
  if ("lieux" in payload) first.lieux = String(payload.lieux || "").trim() || "Studio";
  if ("zoneStockage" in payload) first.zoneStockage = String(payload.zoneStockage || "").trim();
  if ("recu" in payload) first.recu = !!payload.recu;
  if ("inventaireCreated" in payload) first.inventaireCreated = !!payload.inventaireCreated;

  base[0] = normalizeProduit(first, 0);
  return base;
}

export async function PATCH(request, context) {
  const gate = await requireApiPermission(request, { resource: "commandes", action: "edit" });
  if (!gate.ok) return gate.response;

  try {
    const id = getIdFromContextOrUrl(request, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const objectId = toObjectId(id);
    if (!objectId) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const payload = await request.json();
    const db = await getDb();

    const existing = await db.collection("commandes").findOne({ _id: objectId });
    if (!existing) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const $set = { updatedAt: new Date() };

    const allowedStringFields = ["dateCreation", "fournisseur", "branche", "status", "commentaires", "numeroFacture", "description"];
    for (const key of allowedStringFields) {
      if (key in payload) $set[key] = payload[key] == null ? "" : String(payload[key]).trim();
    }

    if ("qonto" in payload) $set.qonto = !!payload.qonto;
    if ("fraisLivraison" in payload) $set.fraisLivraison = toSafeNumber(payload.fraisLivraison);

    let produitsUpdated = false;

    if ("produits" in payload) {
      const produits = normalizeProduits(payload.produits);
      if (produits.length === 0) {
        return NextResponse.json(
          { error: "Ajoutez au moins un produit dans la commande" },
          { status: 400 }
        );
      }

      $set.produits = produits;
      Object.assign($set, computeCommandeAggregates(produits));
      produitsUpdated = true;
    }

    const hasLegacyProductPatch = [
      "produit",
      "quantite",
      "prixUnitaireHT",
      "prixTotalHT",
      "referenceUrl",
      "projet",
      "categories",
      "lieux",
      "zoneStockage",
      "recu",
      "inventaireCreated",
    ].some((key) => key in payload);

    if (!produitsUpdated && hasLegacyProductPatch) {
      const produits = applyLegacyProductPatch(ensureCommandeProduits(existing), payload);
      $set.produits = produits;
      Object.assign($set, computeCommandeAggregates(produits));
      produitsUpdated = true;
    }

    if (!produitsUpdated && "inventaireCreated" in payload) {
      $set.inventaireCreated = !!payload.inventaireCreated;
    }

    await db.collection("commandes").updateOne({ _id: objectId }, { $set });
    const updated = await db.collection("commandes").findOne({ _id: objectId });

    return NextResponse.json({ item: normalizeCommandeDocument(updated) }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/commandes/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/commandes/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "commandes", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    const id = getIdFromContextOrUrl(request, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const objectId = toObjectId(id);
    if (!objectId) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const db = await getDb();
    await db.collection("commandes").deleteOne({ _id: objectId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/commandes/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/commandes/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
