import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";

function toSafeNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "inventaire", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const docs = await db
      .collection("inventaire")
      .find({})
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();

    return NextResponse.json({ items: docs });
  } catch (err) {
    console.error("GET /api/inventaire error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/inventaire", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const gate = await requireApiPermission(req, { resource: "inventaire", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await req.json();
    const db = await getDb();

    const doc = {
      dateCreation: payload.dateCreation || null,
      typeStock: payload.typeStock || "Consommables", // Consommables | Fixe

      produit: payload.produit || "",
      branche: payload.branche || "Agency",
      projet: payload.projet || "",
      lieux: payload.lieux || "Studio",
      zoneStockage: payload.zoneStockage || "",
      categories: payload.categories || "",
      fournisseur: payload.fournisseur || "",
      referenceUrl: payload.referenceUrl || "",
      description: payload.description || "",

      quantiteStock: toSafeNumber(payload.quantiteStock),
      seuilMinimum: toSafeNumber(payload.seuilMinimum),
      prixUnitaire: toSafeNumber(payload.prixUnitaire),

      commentaires: payload.commentaires || "",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("inventaire").insertOne(doc);

    return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/inventaire error:", err);
    return NextResponse.json(
      { error: "Erreur POST /api/inventaire", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
