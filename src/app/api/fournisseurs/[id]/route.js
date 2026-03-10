import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

export async function PATCH(request, context) {
  const gate = await requireApiPermission(request, { resource: "fournisseurs", action: "edit" });
  if (!gate.ok) return gate.response;

  try {
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

    const allowed = [
      "nom",
      "password",
      "websiteUrl",
      "siret",
      "adresse",
      "ville",
      "moyenLivraison",
      "informations",
      "referentNom",
      "referentEmail",
      "referentTelephone",
    ];
    for (const k of allowed) {
      if (k in payload) $set[k] = String(payload[k] ?? "").trim();
    }

    await db.collection("fournisseurs").updateOne(
      { _id: new ObjectId(id) },
      { $set }
    );

    const updated = await db.collection("fournisseurs").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/fournisseurs/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/fournisseurs/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "fournisseurs", action: "delete" });
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
    await db.collection("fournisseurs").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/fournisseurs/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/fournisseurs/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
