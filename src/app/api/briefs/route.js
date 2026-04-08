import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import { logActivity } from "../../../lib/activity-log";

function sanitizeString(value) {
  return String(value || "").trim();
}

function sanitizeAmount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const items = await db
      .collection("briefs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/briefs error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/briefs", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await request.json();
    const db = await getDb();

    const doc = {
      nomBrief: sanitizeString(payload?.nomBrief),
      clientNom: sanitizeString(payload?.clientNom),
      branche: sanitizeString(payload?.branche),
      budget: sanitizeAmount(payload?.budget),
      contenuBrief: sanitizeString(payload?.contenuBrief),
      statut: sanitizeString(payload?.statut) || "Nouveau",
      convertedContratId: sanitizeString(payload?.convertedContratId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!doc.nomBrief) {
      return NextResponse.json({ error: "Le nom du brief est obligatoire" }, { status: 400 });
    }
    if (!doc.clientNom) {
      return NextResponse.json({ error: "Le client est obligatoire" }, { status: 400 });
    }
    if (!doc.branche) {
      return NextResponse.json({ error: "La branche est obligatoire" }, { status: 400 });
    }

    const result = await db.collection("briefs").insertOne(doc);

    logActivity(gate.authz.user, {
      action: "create",
      resource: "brief",
      resourceLabel: "Brief",
      detail: doc.nomBrief || "",
    });

    return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/briefs error:", err);
    return NextResponse.json(
      { error: "Erreur POST /api/briefs", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
