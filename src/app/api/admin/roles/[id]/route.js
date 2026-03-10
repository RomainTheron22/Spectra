import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongodb";
import { requireAdmin } from "../../../../../lib/authz";
import { ROLE_NAMES, createAdminPermissions, normalizePermissions } from "../../../../../lib/rbac";
import {
  getRoleById,
  isValidRoleName,
  sanitizeRoleLabel,
  sanitizeRoleName,
  toObjectId,
} from "../../../../../lib/rbac-store";

function getRoleId(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.length - 1];
  }
  return String(id || "").trim();
}

export async function PATCH(request, context) {
  const gate = await requireAdmin(request, "edit");
  if (!gate.ok) return gate.response;

  try {
    const id = getRoleId(request, context);
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: "ID role invalide." }, { status: 400 });
    }

    const db = await getDb();
    const role = await getRoleById(db, objectId);
    if (!role) {
      return NextResponse.json({ error: "Role introuvable." }, { status: 404 });
    }

    const payload = await request.json();
    const $set = { updatedAt: new Date() };
    const oldName = role.name;

    if ("name" in payload) {
      if (role.isSystem) {
        return NextResponse.json(
          { error: "Impossible de renommer un role systeme." },
          { status: 400 }
        );
      }
      const nextName = sanitizeRoleName(payload.name);
      if (!nextName || !isValidRoleName(nextName)) {
        return NextResponse.json({ error: "Nom de role invalide." }, { status: 400 });
      }
      const existing = await db.collection("roles").findOne({
        name: nextName,
        _id: { $ne: objectId },
      });
      if (existing) {
        return NextResponse.json({ error: "Ce role existe deja." }, { status: 400 });
      }
      $set.name = nextName;
    }

    if ("label" in payload) {
      const label = sanitizeRoleLabel(payload.label);
      if (!label) {
        return NextResponse.json({ error: "Label de role invalide." }, { status: 400 });
      }
      $set.label = label;
    }

    if ("permissions" in payload) {
      if (role.name === ROLE_NAMES.ADMIN) {
        $set.permissions = createAdminPermissions();
      } else {
        $set.permissions = normalizePermissions(payload.permissions);
      }
    }

    await db.collection("roles").updateOne({ _id: objectId }, { $set });

    if ($set.name && $set.name !== oldName) {
      await db.collection("user").updateMany({ role: oldName }, { $set: { role: $set.name } });
    }

    const updated = await getRoleById(db, objectId);
    return NextResponse.json(
      {
        item: {
          id: String(updated._id),
          name: updated.name,
          label: updated.label,
          permissions: normalizePermissions(
            updated.permissions,
            updated.name === ROLE_NAMES.ADMIN
          ),
          isSystem: Boolean(updated.isSystem),
          createdAt: updated.createdAt || null,
          updatedAt: updated.updatedAt || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/roles/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur PATCH /api/admin/roles/[id]", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireAdmin(request, "delete");
  if (!gate.ok) return gate.response;

  try {
    const id = getRoleId(request, context);
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: "ID role invalide." }, { status: 400 });
    }

    const db = await getDb();
    const role = await getRoleById(db, objectId);
    if (!role) {
      return NextResponse.json({ error: "Role introuvable." }, { status: 404 });
    }
    if (role.isSystem) {
      return NextResponse.json(
        { error: "Impossible de supprimer un role systeme." },
        { status: 400 }
      );
    }

    const usersCount = await db.collection("user").countDocuments({ role: role.name });
    if (usersCount > 0) {
      return NextResponse.json(
        { error: "Ce role est encore assigne a des utilisateurs." },
        { status: 400 }
      );
    }

    await db.collection("roles").deleteOne({ _id: objectId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/admin/roles/[id] error:", error);
    return NextResponse.json(
      {
        error: "Erreur DELETE /api/admin/roles/[id]",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
