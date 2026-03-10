import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/authz";
import { listRoles } from "../../../../lib/rbac-store";
import { ROLE_NAMES, normalizeRoleName } from "../../../../lib/rbac";

function toRegex(value) {
  const escaped = String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function toPublicUser(user) {
  const firstName = String(user.firstName || "").trim();
  const lastName = String(user.lastName || "").trim();
  const fallbackName = String(user.name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || fallbackName || "Utilisateur";

  return {
    id: String(user._id),
    email: String(user.email || ""),
    firstName,
    lastName,
    name: fullName,
    role: normalizeRoleName(user.role || ROLE_NAMES.INVITE),
    isActive: user.isActive !== false,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

export async function GET(request) {
  const gate = await requireAdmin(request, "view");
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const roleFilter = normalizeRoleName(url.searchParams.get("role"));
    const activeParam = String(url.searchParams.get("active") || "all").trim().toLowerCase();

    const filter = {};
    if (q) {
      const rx = toRegex(q);
      filter.$or = [
        { email: rx },
        { firstName: rx },
        { lastName: rx },
        { name: rx },
      ];
    }
    if (roleFilter && roleFilter !== "all") {
      filter.role = roleFilter;
    }
    if (activeParam === "active") {
      filter.isActive = { $ne: false };
    } else if (activeParam === "disabled") {
      filter.isActive = false;
    }

    const [users, roles] = await Promise.all([
      db
        .collection("user")
        .find(filter)
        .project({
          email: 1,
          firstName: 1,
          lastName: 1,
          name: 1,
          role: 1,
          isActive: 1,
          lastLoginAt: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .sort({ createdAt: -1 })
        .limit(2000)
        .toArray(),
      listRoles(db),
    ]);

    return NextResponse.json(
      {
        items: users.map(toPublicUser),
        roles: roles.map((role) => ({
          id: String(role._id),
          name: role.name,
          label: role.label,
          isSystem: Boolean(role.isSystem),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/admin/users", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
