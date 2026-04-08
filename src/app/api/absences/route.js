import { auth } from "../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { logActivity } from "../../../lib/activity-log";

// GET /api/absences?employeeId=...&from=...&to=...
export async function GET(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get("employeeId");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const query = {};
        if (employeeId) {
            query.employeeId = employeeId;
        }

        if (from && to) {
            query.$or = [
                { startDate: { $lte: to }, endDate: { $gte: from } }
            ];
        } else if (from) {
            query.endDate = { $gte: from };
        } else if (to) {
            query.startDate = { $lte: to };
        }

        const db = await getDb();
        const absences = await db.collection("absences").find(query).sort({ startDate: 1 }).toArray();

        return Response.json({ items: absences });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const data = await request.json();
        const db = await getDb();

        if (!data.employeeId || !data.startDate || !data.endDate) {
            return Response.json({ error: "Champs requis manquants" }, { status: 400 });
        }

        const newAbsence = {
            employeeId: data.employeeId,
            type: data.type || "Absence",
            startDate: data.startDate,
            endDate: data.endDate,
            comment: data.comment || "",
            createdAt: new Date(),
        };

        const result = await db.collection("absences").insertOne(newAbsence);

        const sessionUser = session?.user;
        logActivity(
          { id: sessionUser?.id, name: sessionUser?.name, email: sessionUser?.email },
          {
            action: "create",
            resource: "absence",
            resourceLabel: "Absence",
            detail: `${newAbsence.type} (${newAbsence.startDate} → ${newAbsence.endDate})`,
          }
        );

        return Response.json({ item: { _id: result.insertedId, ...newAbsence } });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
