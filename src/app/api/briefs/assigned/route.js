import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const userId = gate.authz.user.id;
    const db = await getDb();

    const briefs = await db
      .collection("briefs")
      .find(
        { "devis": { $elemMatch: { assigneAId: userId, doneBy: { $nin: [userId] } } } },
        { projection: { nomBrief: 1, clientNom: 1, branche: 1, statut: 1, devis: 1 } }
      )
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    const items = [];
    for (const brief of briefs) {
      const matched = (brief.devis || []).filter(
        (p) => p.assigneAId === userId && !(p.doneBy || []).includes(userId)
      );
      for (const partie of matched) {
        items.push({
          briefId: String(brief._id),
          briefNom: String(brief.nomBrief || ""),
          clientNom: String(brief.clientNom || ""),
          branche: String(brief.branche || ""),
          statut: String(brief.statut || ""),
          partieId: partie.id,
          partieNom: String(partie.nom || ""),
          prixEstime: partie.prixEstime ?? null,
        });
      }
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/briefs/assigned error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/briefs/assigned", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const userId = gate.authz.user.id;
    const { briefId, partieId } = await request.json();
    if (!briefId || !partieId) {
      return NextResponse.json({ error: "briefId et partieId requis" }, { status: 400 });
    }

    const db = await getDb();
    await db.collection("briefs").updateOne(
      { _id: new ObjectId(briefId) },
      { $addToSet: { "devis.$[elem].doneBy": userId } },
      { arrayFilters: [{ "elem.id": partieId, "elem.assigneAId": userId }] }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/briefs/assigned error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/briefs/assigned", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
