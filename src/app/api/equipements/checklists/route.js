import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

export async function GET(request) {
    const gate = await requireApiPermission(request, { resource: "equipements", action: "view" });
    if (!gate.ok) return gate.response;

    try {
        const db = await getDb();
        const docs = await db
            .collection("equipements_checklists")
            .find({})
            .sort({ createdAt: -1 })
            .limit(1000)
            .toArray();

        return NextResponse.json({ items: docs });
    } catch (err) {
        console.error("GET /api/equipements/checklists error:", err);
        return NextResponse.json(
            { error: "Erreur GET /api/equipements/checklists", details: String(err?.message || err) },
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
            nom: payload.nom || "",
            type: payload.type || "Tournage", // Tournage | Podcast | Evenement SFX | Autre
            projet: payload.projet || "",
            items: Array.isArray(payload.items) ? payload.items : [],
            epiItems: Array.isArray(payload.epiItems) ? payload.epiItems : [],
            statut: payload.statut || "Brouillon", // Brouillon | Pret | Utilise | Archive
            commentaires: payload.commentaires || "",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("equipements_checklists").insertOne(doc);

        return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
    } catch (err) {
        console.error("POST /api/equipements/checklists error:", err);
        return NextResponse.json(
            { error: "Erreur POST /api/equipements/checklists", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}
