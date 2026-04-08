import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

const CONTRATS_STORAGE = path.join(process.cwd(), "storage", "contrats");

function sanitizeString(value) {
  return String(value || "").trim();
}

function sanitizeDate(value) {
  const raw = sanitizeString(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return raw;
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
  const gate = await requireApiPermission(request, { resource: "contrats", action: "edit" });
  if (!gate.ok) return gate.response;

  try {
    const id = getId(request, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const payload = await request.json();
    const db = await getDb();

    const $set = { updatedAt: new Date() };
    const strFields = ["nomContrat", "clientNom", "branche", "lieu", "statut", "brief"];
    for (const field of strFields) {
      if (field in payload) $set[field] = sanitizeString(payload[field]);
    }

    if ("dateDebut" in payload) $set.dateDebut = sanitizeDate(payload.dateDebut);
    if ("dateFin" in payload) $set.dateFin = sanitizeDate(payload.dateFin);

    await db.collection("contrats").updateOne({ _id: new ObjectId(id) }, { $set });
    const updated = await db.collection("contrats").findOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "update",
      resource: "contrat",
      resourceLabel: "Contrat",
      detail: updated?.nomContrat || id,
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/contrats/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/contrats/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    const id = getId(request, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const db = await getDb();
    const contrat = await db.collection("contrats").findOne({ _id: new ObjectId(id) });
    if (contrat?.files?.length) {
      const contractDir = path.join(CONTRATS_STORAGE, id);
      await fs.rm(contractDir, { recursive: true, force: true }).catch(() => {});
    }
    await db.collection("contrats").deleteOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "delete",
      resource: "contrat",
      resourceLabel: "Contrat",
      detail: contrat?.nomContrat || id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/contrats/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/contrats/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
