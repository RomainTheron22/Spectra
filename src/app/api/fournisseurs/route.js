import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import { logActivity } from "../../../lib/activity-log";

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "fournisseurs", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const docs = await db
      .collection("fournisseurs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    return NextResponse.json({ items: docs }, { status: 200 });
  } catch (err) {
    console.error("GET /api/fournisseurs error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/fournisseurs", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const gate = await requireApiPermission(req, { resource: "fournisseurs", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await req.json();
    const db = await getDb();

    const doc = {
      nom: String(payload?.nom || "").trim(),
      password: String(payload?.password || "").trim(),
      websiteUrl: String(payload?.websiteUrl || "").trim(),
      siret: String(payload?.siret || "").trim(),
      adresse: String(payload?.adresse || "").trim(),
      ville: String(payload?.ville || "").trim(),
      moyenLivraison: String(payload?.moyenLivraison || "").trim(),
      informations: String(payload?.informations || "").trim(),
      referentNom: String(payload?.referentNom || "").trim(),
      referentEmail: String(payload?.referentEmail || "").trim(),
      referentTelephone: String(payload?.referentTelephone || "").trim(),

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // (optionnel) validation minimaliste
    if (!doc.nom) {
      return NextResponse.json({ error: "Le nom du fournisseur est obligatoire" }, { status: 400 });
    }

    const result = await db.collection("fournisseurs").insertOne(doc);

    logActivity(gate.authz.user, {
      action: "create",
      resource: "fournisseur",
      resourceLabel: "Fournisseur",
      detail: doc.nom || "",
    });

    return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/fournisseurs error:", err);
    return NextResponse.json(
      { error: "Erreur POST /api/fournisseurs", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
