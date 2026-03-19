import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

    const db = await getDb();
    const docs = await db
      .collection("user")
      .find({ isActive: { $ne: false } }, { projection: { name: 1, image: 1 } })
      .sort({ name: 1 })
      .toArray();

    const members = docs.map((u) => ({
      id: String(u._id),
      name: String(u.name || "").trim() || "Utilisateur",
      image: u.image || null,
    }));

    return Response.json({ members });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
