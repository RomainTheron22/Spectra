import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";

function toSafeNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeMissionRates(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      missionType: String(row?.missionType || "").trim(),
      tarifJour: toSafeNumber(row?.tarifJour),
    }))
    .filter((row) => row.missionType || row.tarifJour !== null);
}

function normalizeMissions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const id = String(
        row?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      ).trim();
      const projet = String(row?.projet || "").trim();
      const nomMission = String(row?.nomMission || "").trim();
      const dateDebut = String(row?.dateDebut || "").trim();
      const dateFin = String(row?.dateFin || "").trim();
      const tarifTotal = toSafeNumber(row?.tarifTotal);

      return { id, projet, nomMission, dateDebut, dateFin, tarifTotal };
    })
    .filter((row) => row.nomMission && row.dateDebut && row.dateFin);
}

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "prestataires", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const docs = await db
      .collection("prestataires")
      .find({})
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    return NextResponse.json({ items: docs }, { status: 200 });
  } catch (err) {
    console.error("GET /api/prestataires error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/prestataires", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const gate = await requireApiPermission(req, { resource: "prestataires", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await req.json();
    const db = await getDb();

    const doc = {
      prenom: String(payload?.prenom || "").trim(),
      nom: String(payload?.nom || "").trim(),
      email: String(payload?.email || "").trim(),
      telephone: String(payload?.telephone || "").trim(),


      tags: Array.isArray(payload?.tags)
        ? payload.tags.map((t) => String(t).trim()).filter(Boolean)
        : [],

      statut: String(payload?.statut || "Disponible").trim(), // Disponible | Occupé | En congé
      typeTarif: String(payload?.typeTarif || "Sur facture").trim(), // Sur facture | Intermittent
      tarifJour: toSafeNumber(payload?.tarifJour),
      missionTarifs: normalizeMissionRates(payload?.missionTarifs),
      missions: normalizeMissions(payload?.missions),

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!doc.prenom || !doc.nom) {
      return NextResponse.json(
        { error: "Prénom et nom sont obligatoires" },
        { status: 400 }
      );
    }

    const result = await db.collection("prestataires").insertOne(doc);
    return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/prestataires error:", err);
    return NextResponse.json(
      { error: "Erreur POST /api/prestataires", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
