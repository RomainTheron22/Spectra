import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(request, { params }) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const db = await getDb();
        const { id } = await params;

        if (!ObjectId.isValid(id)) return Response.json({ error: "ID invalide" }, { status: 400 });

        const employee = await db.collection("employees").findOne({ _id: new ObjectId(id) });
        if (!employee) return Response.json({ error: "Employé non trouvé" }, { status: 404 });

        return Response.json({ item: employee });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const { id } = await params;
        if (!ObjectId.isValid(id)) return Response.json({ error: "ID invalide" }, { status: 400 });

        const data = await request.json();
        const db = await getDb();

        const updateDoc = {
            $set: {
                ...data, // includes hasContract, hasNDA
                updatedAt: new Date()
            }
        };

        // Cleanup de l'ID si présent dans le body
        if (updateDoc.$set._id) delete updateDoc.$set._id;

        await db.collection("employees").updateOne({ _id: new ObjectId(id) }, updateDoc);
        const updated = await db.collection("employees").findOne({ _id: new ObjectId(id) });

        return Response.json({ item: updated });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const { id } = await params;
        if (!ObjectId.isValid(id)) return Response.json({ error: "ID invalide" }, { status: 400 });

        const db = await getDb();
        await db.collection("employees").deleteOne({ _id: new ObjectId(id) });
        // Optionnel : Supprimer les absences liées
        await db.collection("absences").deleteMany({ employeeId: id });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
