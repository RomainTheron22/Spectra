import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

export async function GET(request) {
    const gate = await requireApiPermission(request, { resource: "equipements", action: "view" });
    if (!gate.ok) return gate.response;

    try {
        const { searchParams } = new URL(request.url);
        const kitId = searchParams.get("kitId") || "";
        const type = searchParams.get("type") || "";

        const filter = {};
        if (kitId) filter.kitId = kitId;
        if (type) filter.type = type;

        const db = await getDb();
        const docs = await db
            .collection("equipements_historique")
            .find(filter)
            .sort({ date: -1 })
            .limit(500)
            .toArray();

        return NextResponse.json({ items: docs });
    } catch (err) {
        console.error("GET /api/equipements/historique error:", err);
        return NextResponse.json(
            { error: "Erreur GET /api/equipements/historique", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}

export async function POST(req) {
    const gate = await requireApiPermission(req, { resource: "equipements", action: "create" });
    if (!gate.ok) return gate.response;

    try {
        const payload = await req.json();
        const db = await getDb();

        const doc = {
            kitId: payload.kitId || "",
            kitNom: payload.kitNom || "",
            type: payload.type || "modification", // sortie | retour | modification | reparation | ajout | retrait
            projet: payload.projet || "",
            description: payload.description || "",
            commentaire: payload.commentaire || "",
            etatRetour: payload.etatRetour || "", // ras | a_revoir | a_reparer | a_refaire
            date: payload.date || new Date().toISOString(),
            createdAt: new Date(),
        };

        const result = await db.collection("equipements_historique").insertOne(doc);

        return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
    } catch (err) {
        console.error("POST /api/equipements/historique error:", err);
        return NextResponse.json(
            { error: "Erreur POST /api/equipements/historique", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}
