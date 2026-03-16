import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/authz";

function toObjId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

export async function PATCH(request, { params }) {
  const gate = await requireAdmin(request, "edit");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const _id = toObjId(id);
  if (!_id) return NextResponse.json({ error: "ID invalide." }, { status: 400 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const now = new Date();

    // Resolve / unresolve
    if ("resolved" in body) {
      await db.collection("pageComments").updateOne(
        { _id },
        { $set: { resolved: Boolean(body.resolved), updatedAt: now } }
      );
      const updated = await db.collection("pageComments").findOne({ _id });
      return NextResponse.json({ item: { id: String(updated._id), resolved: updated.resolved } });
    }

    // Add reply
    if (body.reply) {
      const content = String(body.reply).trim();
      if (!content) return NextResponse.json({ error: "Réponse vide." }, { status: 400 });
      const user = gate.authz.user;
      const reply = {
        authorId: String(user.id),
        authorName: String(user.name || user.email || "Admin"),
        content,
        createdAt: now,
      };
      await db.collection("pageComments").updateOne(
        { _id },
        { $push: { replies: reply }, $set: { updatedAt: now } }
      );
      return NextResponse.json({ reply });
    }

    return NextResponse.json({ error: "Aucune action reconnue." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const gate = await requireAdmin(request, "delete");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const _id = toObjId(id);
  if (!_id) return NextResponse.json({ error: "ID invalide." }, { status: 400 });

  try {
    const db = await getDb();
    await db.collection("pageComments").deleteOne({ _id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
