import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { getRoleLabel } from "../../../../lib/rbac";

function toRegex(value) {
  const escaped = String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function toUser(item) {
  const firstName = String(item.firstName || "").trim();
  const lastName = String(item.lastName || "").trim();
  const fallbackName = String(item.name || "").trim();
  const name = `${firstName} ${lastName}`.trim() || fallbackName || "Utilisateur";
  return {
    id: String(item._id),
    name,
    email: String(item.email || "").trim(),
    role: String(item.role || "").trim(),
    roleLabel: getRoleLabel(item.role),
    isActive: item.isActive !== false,
  };
}

export async function GET(request) {
  const gate = await requireApiPermission(request, {
    resource: "planningPerso",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();

    const filter = { isActive: { $ne: false } };
    if (q) {
      const rx = toRegex(q);
      filter.$or = [{ name: rx }, { firstName: rx }, { lastName: rx }, { email: rx }];
    }

    const users = await db
      .collection("user")
      .find(filter)
      .project({
        email: 1,
        firstName: 1,
        lastName: 1,
        name: 1,
        role: 1,
        isActive: 1,
      })
      .sort({ firstName: 1, lastName: 1, email: 1 })
      .limit(2000)
      .toArray();

    return NextResponse.json({ items: users.map(toUser) }, { status: 200 });
  } catch (error) {
    console.error("GET /api/planning/users error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/planning/users", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
