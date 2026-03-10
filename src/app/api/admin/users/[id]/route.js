import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongodb";
import { requireAdmin } from "../../../../../lib/authz";
import { ROLE_NAMES, normalizeRoleName } from "../../../../../lib/rbac";
import { getRoleByName, toObjectId } from "../../../../../lib/rbac-store";

function getUserId(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.length - 1];
  }
  return String(id || "").trim();
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

export async function PATCH(request, context) {
  const gate = await requireAdmin(request, "edit");
  if (!gate.ok) return gate.response;

  try {
    const id = getUserId(request, context);
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: "ID utilisateur invalide." }, { status: 400 });
    }

    const db = await getDb();
    const payload = await request.json();
    const current = await db.collection("user").findOne({ _id: objectId });
    if (!current) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    const actorId = String(gate.authz?.user?.id || "");
    const targetId = String(current._id);

    const $set = { updatedAt: new Date() };

    if ("firstName" in payload || "lastName" in payload) {
      const firstName = String(payload.firstName ?? current.firstName ?? "").trim();
      const lastName = String(payload.lastName ?? current.lastName ?? "").trim();
      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: "Le prenom et le nom sont obligatoires." },
          { status: 400 }
        );
      }
      $set.firstName = firstName;
      $set.lastName = lastName;
      $set.name = `${firstName} ${lastName}`.trim();
    }

    if ("role" in payload) {
      const nextRole = normalizeRoleName(payload.role);
      const role = await getRoleByName(db, nextRole);
      if (!role) {
        return NextResponse.json({ error: "Role invalide." }, { status: 400 });
      }
      if (actorId === targetId && role.name !== ROLE_NAMES.ADMIN) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas vous retirer le role admin." },
          { status: 400 }
        );
      }
      $set.role = role.name;
    }

    if ("isActive" in payload) {
      const nextIsActive = Boolean(payload.isActive);
      if (actorId === targetId && !nextIsActive) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas desactiver votre propre compte." },
          { status: 400 }
        );
      }
      $set.isActive = nextIsActive;
    }

    await db.collection("user").updateOne({ _id: objectId }, { $set });

    if ($set.isActive === false) {
      await db.collection("session").deleteMany({
        $or: [{ userId: targetId }, { userId: objectId }],
      });
    }

    const updated = await db.collection("user").findOne({ _id: objectId });
    return NextResponse.json({ item: toPublicUser(updated) }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur PATCH /api/admin/users/[id]", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireAdmin(request, "delete");
  if (!gate.ok) return gate.response;

  try {
    const id = getUserId(request, context);
    const objectId = toObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: "ID utilisateur invalide." }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection("user").findOne({ _id: objectId });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    const actorId = String(gate.authz?.user?.id || "");
    const targetId = String(user._id);
    if (actorId === targetId) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte." },
        { status: 400 }
      );
    }

    const targetRole = normalizeRoleName(user.role || ROLE_NAMES.INVITE);
    if (targetRole === ROLE_NAMES.ADMIN) {
      const adminCount = await db.collection("user").countDocuments({ role: ROLE_NAMES.ADMIN });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Impossible de supprimer le dernier admin." },
          { status: 400 }
        );
      }
    }

    await Promise.all([
      db.collection("session").deleteMany({ $or: [{ userId: targetId }, { userId: objectId }] }),
      db.collection("account").deleteMany({ $or: [{ userId: targetId }, { userId: objectId }] }),
      db.collection("user").deleteOne({ _id: objectId }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error);
    return NextResponse.json(
      {
        error: "Erreur DELETE /api/admin/users/[id]",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
