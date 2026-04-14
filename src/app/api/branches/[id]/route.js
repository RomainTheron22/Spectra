import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

const COLLECTION = "branches";

function toOid(id) { try { return new ObjectId(id); } catch { return null; } }

export async function PATCH(request, { params }) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "edit" });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const payload = await request.json();
  const updates = {};
  const allowed = ["label", "color", "description", "poles", "gcalKeyword", "order", "isActive"];
  for (const k of allowed) { if (k in payload) updates[k] = payload[k]; }
  updates.updatedAt = new Date();

  const db = await getDb();
  const result = await db.collection(COLLECTION).findOneAndUpdate({ _id: oid }, { $set: updates }, { returnDocument: "after" });
  if (!result) return NextResponse.json({ error: "Branche non trouvée" }, { status: 404 });

  return NextResponse.json({ item: result });
}

export async function DELETE(request, { params }) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "delete" });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ _id: oid });
  return NextResponse.json({ ok: true });
}
