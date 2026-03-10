import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";

export async function GET(request) {
    const gate = await requireApiPermission(request, { resource: "equipements", action: "view" });
    if (!gate.ok) return gate.response;

    try {
        const db = await getDb();
        const docs = await db
            .collection("equipements_kits")
            .find({})
            .sort({ createdAt: -1 })
            .limit(1000)
            .toArray();

        return NextResponse.json({ items: docs });
    } catch (err) {
        console.error("GET /api/equipements/kits error:", err);
        return NextResponse.json(
            { error: "Erreur GET /api/equipements/kits", details: String(err?.message || err) },
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
            type: payload.type || "Kit", // Kit | Machine | Accessoire
            description: payload.description || "",
            contenu: Array.isArray(payload.contenu) ? payload.contenu : [],
            statut: payload.statut || "Disponible", // Disponible | En tournage | En maintenance | Hors service
            photos: Array.isArray(payload.photos) ? payload.photos : [],
            sorties: Array.isArray(payload.sorties) ? payload.sorties : [],
            nombreSorties: 0,
            derniereSortie: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("equipements_kits").insertOne(doc);

        return NextResponse.json({ item: { ...doc, _id: result.insertedId } }, { status: 201 });
    } catch (err) {
        console.error("POST /api/equipements/kits error:", err);
        return NextResponse.json(
            { error: "Erreur POST /api/equipements/kits", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}
