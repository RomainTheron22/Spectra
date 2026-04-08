import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

const BRIEFS_STORAGE = path.join(process.cwd(), "storage", "briefs");

function sanitizeString(value) {
  return String(value || "").trim();
}

function sanitizeAmount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
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
    const strFields = ["nomBrief", "clientNom", "branche", "contenuBrief", "statut", "convertedContratId"];
    for (const field of strFields) {
      if (field in payload) $set[field] = sanitizeString(payload[field]);
    }
    if ("budget" in payload) $set.budget = sanitizeAmount(payload.budget);
    if ("devis" in payload) $set.devis = Array.isArray(payload.devis) ? payload.devis : [];
    if ("devisDetaille" in payload) $set.devisDetaille = Array.isArray(payload.devisDetaille) ? payload.devisDetaille : [];

    const updateOp = { $set };

    if ("addVersion" in payload) {
      const contenu = sanitizeString(payload.addVersion?.contenu ?? "");
      const newVersion = { id: randomUUID(), contenu, createdAt: new Date() };
      $set.contenuBrief = contenu;
      updateOp.$push = { versions: newVersion };
    }

    await db.collection("briefs").updateOne({ _id: new ObjectId(id) }, updateOp);
    const updated = await db.collection("briefs").findOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "update",
      resource: "brief",
      resourceLabel: "Brief",
      detail: updated?.nomBrief || id,
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/briefs/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/briefs/[id]", details: String(err?.message || err) },
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

    const brief = await db.collection("briefs").findOne({ _id: new ObjectId(id) });
    if (brief?.files?.length) {
      const briefDir = path.join(BRIEFS_STORAGE, id);
      await fs.rm(briefDir, { recursive: true, force: true }).catch(() => {});
    }

    await db.collection("briefs").deleteOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "delete",
      resource: "brief",
      resourceLabel: "Brief",
      detail: brief?.nomBrief || id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/briefs/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/briefs/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
