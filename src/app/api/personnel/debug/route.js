import { getDb } from "../../../../lib/mongodb";

export async function GET(request) {
    const db = await getDb();
    const employees = await db.collection("employees").find({}).toArray();
    return Response.json({ items: employees });
}
