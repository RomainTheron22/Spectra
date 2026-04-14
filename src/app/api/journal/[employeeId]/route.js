import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

const COLLECTION = "journal_entries";

function toOid(id) { try { return new ObjectId(id); } catch { return null; } }

export async function GET(request, { params }) {
  const gate = await requireApiPermission(request, { resource: "employeeProfiles", action: "view" });
  if (!gate.ok) return gate.response;

  const { employeeId } = await params;
  const db = await getDb();
  const entries = await db.collection(COLLECTION).find({ employeeId }).sort({ date: -1, createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({ items: entries });
}

export async function POST(request, { params }) {
  const gate = await requireApiPermission(request, { resource: "employeeProfiles", action: "edit" });
  if (!gate.ok) return gate.response;

  const { employeeId } = await params;
  const payload = await request.json();
  if (!payload.text?.trim()) return NextResponse.json({ error: "Texte obligatoire" }, { status: 400 });

  const db = await getDb();
  const doc = {
    employeeId,
    text: payload.text.trim(),
    date: payload.date || new Date().toISOString().slice(0, 10),
    type: payload.type || "note", // note, reunion, feedback, alerte, rappel
    rappelDate: payload.rappelDate || null, // date du rappel si type = rappel
    authorId: String(gate.authz?.user?.id || ""),
    authorName: gate.authz?.user?.name || "Admin",
    createdAt: new Date(),
  };

  const result = await db.collection(COLLECTION).insertOne(doc);
  return NextResponse.json({ item: { _id: result.insertedId, ...doc } }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const gate = await requireApiPermission(request, { resource: "employeeProfiles", action: "delete" });
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "entryId requis" }, { status: 400 });

  const oid = toOid(entryId);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ _id: oid });
  return NextResponse.json({ ok: true });
}
