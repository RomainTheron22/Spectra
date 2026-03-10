import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function DELETE(request, { params }) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const { id } = await params;
        if (!ObjectId.isValid(id)) return Response.json({ error: "ID invalide" }, { status: 400 });

        const db = await getDb();
        await db.collection("retards").deleteOne({ _id: new ObjectId(id) });
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
