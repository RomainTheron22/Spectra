import { auth } from "../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../lib/mongodb";

// GET /api/retards?employeeId=...&from=...&to=...
export async function GET(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get("employeeId");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const query = {};
        if (employeeId) query.employeeId = employeeId;
        if (from && to) {
            query.date = { $gte: from, $lte: to };
        } else if (from) {
            query.date = { $gte: from };
        } else if (to) {
            query.date = { $lte: to };
        }

        const db = await getDb();
        const retards = await db.collection("retards").find(query).sort({ date: -1 }).toArray();
        return Response.json({ items: retards });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/retards
export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const data = await request.json();
        if (!data.employeeId || !data.date || !data.minutes) {
            return Response.json({ error: "Champs requis manquants" }, { status: 400 });
        }

        const db = await getDb();
        const newRetard = {
            employeeId: data.employeeId,
            date: data.date,
            minutes: Number(data.minutes),
            comment: data.comment || "",
            createdAt: new Date(),
        };

        const result = await db.collection("retards").insertOne(newRetard);
        return Response.json({ item: { _id: result.insertedId, ...newRetard } });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
