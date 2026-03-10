import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const [userDocs, roleDocs] = await Promise.all([
      db
        .collection("user")
        .find({ isActive: { $ne: false } }, { projection: { firstName: 1, lastName: 1, name: 1 } })
        .sort({ firstName: 1, lastName: 1 })
        .limit(500)
        .toArray(),
      db
        .collection("roles")
        .find({}, { projection: { name: 1, label: 1 } })
        .sort({ label: 1 })
        .toArray(),
    ]);

    const users = userDocs.map((u) => {
      const firstName = String(u.firstName || "").trim();
      const lastName = String(u.lastName || "").trim();
      const displayName = `${firstName} ${lastName}`.trim() || String(u.name || "").trim() || "Utilisateur";
      return { id: String(u._id), name: displayName };
    });

    const roles = roleDocs.map((r) => ({
      name: String(r.name || ""),
      label: String(r.label || r.name || ""),
    }));

    return NextResponse.json({ users, roles }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/users", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
