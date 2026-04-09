import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../lib/authz";

export async function PATCH(request, context) {
    const gate = await requireApiPermission(request, { resource: "equipements", action: "edit" });
    if (!gate.ok) return gate.response;

    try {
        let id = context?.params?.id;
        if (!id) {
            const url = new URL(request.url);
            const parts = url.pathname.split("/").filter(Boolean);
            id = parts[parts.length - 1];
        }

        if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

        const payload = await request.json();
        const db = await getDb();

        const $set = { updatedAt: new Date() };

        const allowedStringFields = [
            "nom",
            "type",
            "description",
            "statut",
        ];

        for (const key of allowedStringFields) {
            if (key in payload) $set[key] = payload[key] ?? "";
        }

        if ("contenu" in payload) $set.contenu = Array.isArray(payload.contenu) ? payload.contenu : [];
        if ("modules" in payload) $set.modules = Array.isArray(payload.modules) ? payload.modules : [];
        if ("photos" in payload) $set.photos = Array.isArray(payload.photos) ? payload.photos : [];
        if ("sorties" in payload) {
            $set.sorties = Array.isArray(payload.sorties) ? payload.sorties : [];
            $set.nombreSorties = $set.sorties.length;
            $set.derniereSortie = $set.sorties.length > 0 ? $set.sorties[$set.sorties.length - 1] : null;
        }

        await db.collection("equipements_kits").updateOne(
            { _id: new ObjectId(id) },
            { $set }
        );

        const updated = await db.collection("equipements_kits").findOne({ _id: new ObjectId(id) });
        return NextResponse.json({ item: updated }, { status: 200 });
    } catch (err) {
        console.error("PATCH /api/equipements/kits/[id] error:", err);
        return NextResponse.json(
            { error: "Erreur PATCH /api/equipements/kits/[id]", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}

export async function DELETE(request, context) {
    const gate = await requireApiPermission(request, { resource: "equipements", action: "delete" });
    if (!gate.ok) return gate.response;

    try {
        let id = context?.params?.id;
        if (!id) {
            const url = new URL(request.url);
            const parts = url.pathname.split("/").filter(Boolean);
            id = parts[parts.length - 1];
        }

        if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

        const db = await getDb();
        await db.collection("equipements_kits").deleteOne({ _id: new ObjectId(id) });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
        console.error("DELETE /api/equipements/kits/[id] error:", err);
        return NextResponse.json(
            { error: "Erreur DELETE /api/equipements/kits/[id]", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}
