import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

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

function getId(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.length - 1];
  }
  return id;
}

export async function PATCH(request, context) {
  const gate = await requireApiPermission(request, { resource: "prestataires", action: "edit" });
  if (!gate.ok) return gate.response;

  try {
    const id = getId(request, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const payload = await request.json();
    const db = await getDb();

    const $set = { updatedAt: new Date() };

    const strFields = ["prenom", "nom", "email", "telephone", "statut", "typeTarif"];
    for (const k of strFields) {
      if (k in payload) $set[k] = String(payload[k] ?? "").trim();
    }

    if ("tags" in payload) {
      $set.tags = Array.isArray(payload.tags)
        ? payload.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];
    }

    if ("tarifJour" in payload) $set.tarifJour = toSafeNumber(payload.tarifJour);
    if ("missionTarifs" in payload) $set.missionTarifs = normalizeMissionRates(payload.missionTarifs);
    if ("missions" in payload) $set.missions = normalizeMissions(payload.missions);

    await db.collection("prestataires").updateOne(
      { _id: new ObjectId(id) },
      { $set }
    );

    const updated = await db.collection("prestataires").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/prestataires/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/prestataires/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "prestataires", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    const id = getId(request, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const db = await getDb();
    await db.collection("prestataires").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/prestataires/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/prestataires/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
