import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

function toSafeNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(request, context) {
  const gate = await requireApiPermission(request, { resource: "inventaire", action: "edit" });
  if (!gate.ok) return gate.response;

  try {
    // Récupération id (fallback URL si params capricieux)
    let id = context?.params?.id;
    if (!id) {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[parts.length - 1];
    }

    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const payload = await request.json();
    const db = await getDb();

    const $set = { updatedAt: new Date() };

    const allowedStringFields = [
      "dateCreation",
      "typeStock",
      "produit",
      "branche",
      "projet",
      "lieux",
      "zoneStockage",
      "categories",
      "fournisseur",
      "referenceUrl",
      "description",
      "commentaires",
    ];

    for (const key of allowedStringFields) {
      if (key in payload) $set[key] = payload[key] ?? "";
    }

    if ("quantiteStock" in payload) $set.quantiteStock = toSafeNumber(payload.quantiteStock);
    if ("seuilMinimum" in payload) $set.seuilMinimum = toSafeNumber(payload.seuilMinimum);
    if ("prixUnitaire" in payload) $set.prixUnitaire = toSafeNumber(payload.prixUnitaire);

    await db.collection("inventaire").updateOne(
      { _id: new ObjectId(id) },
      { $set }
    );

    const updated = await db.collection("inventaire").findOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "update",
      resource: "inventaire",
      resourceLabel: "Inventaire",
      detail: updated?.produit || id,
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/inventaire/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/inventaire/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "inventaire", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    let id = context?.params?.id;
    if (!id) {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[parts.length - 1];
    }

    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const db = await getDb();
    const toDelete = await db.collection("inventaire").findOne({ _id: new ObjectId(id) });
    await db.collection("inventaire").deleteOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "delete",
      resource: "inventaire",
      resourceLabel: "Inventaire",
      detail: toDelete?.produit || id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/inventaire/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/inventaire/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
