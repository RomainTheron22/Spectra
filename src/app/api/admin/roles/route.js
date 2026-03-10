import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/authz";
import { ROLE_NAMES, createPermissionMatrix, normalizePermissions } from "../../../../lib/rbac";
import {
  isValidRoleName,
  listRoles,
  sanitizeRoleLabel,
  sanitizeRoleName,
} from "../../../../lib/rbac-store";

export async function GET(request) {
  const gate = await requireAdmin(request, "view");
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const roles = await listRoles(db);
    return NextResponse.json(
      {
        items: roles.map((role) => ({
          id: String(role._id),
          name: role.name,
          label: role.label,
          permissions: normalizePermissions(
            role.permissions,
            role.name === ROLE_NAMES.ADMIN
          ),
          isSystem: Boolean(role.isSystem),
          createdAt: role.createdAt || null,
          updatedAt: role.updatedAt || null,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/admin/roles error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/admin/roles", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const gate = await requireAdmin(request, "create");
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const payload = await request.json();
    const name = sanitizeRoleName(payload.name);
    const label = sanitizeRoleLabel(payload.label || payload.name || "");

    if (!name || !isValidRoleName(name)) {
      return NextResponse.json(
        {
          error:
            "Nom de role invalide. Utilisez 2-32 caracteres: lettres, chiffres, _ ou -.",
        },
        { status: 400 }
      );
    }

    const existing = await db.collection("roles").findOne({ name });
    if (existing) {
      return NextResponse.json({ error: "Ce role existe deja." }, { status: 400 });
    }

    const doc = {
      name,
      label: label || name,
      permissions: normalizePermissions(payload.permissions || createPermissionMatrix(false)),
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("roles").insertOne(doc);
    return NextResponse.json(
      {
        item: {
          ...doc,
          id: String(result.insertedId),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/roles error:", error);
    return NextResponse.json(
      { error: "Erreur POST /api/admin/roles", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
