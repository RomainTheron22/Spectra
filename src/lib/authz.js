import { NextResponse } from "next/server";
import { auth, ensureAuthSetup } from "./auth";
import { getDb } from "./mongodb";
import { ROLE_NAMES, getRoleLabel, hasPermission, normalizeRoleName } from "./rbac";
import { ensureBaseRoles, getRoleByName, resolveRolePermissions, toObjectId } from "./rbac-store";

function buildGuestAuthz() {
  return {
    authenticated: false,
    isActive: false,
    user: null,
    role: null,
    permissions: null,
  };
}

function mapUser(userDoc, roleLabel) {
  const firstName = String(userDoc.firstName || "").trim();
  const lastName = String(userDoc.lastName || "").trim();
  const fallbackName = String(userDoc.name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || fallbackName || "Utilisateur";

  return {
    id: String(userDoc._id),
    email: String(userDoc.email || "").trim(),
    firstName,
    lastName,
    name: fullName,
    role: normalizeRoleName(userDoc.role || ROLE_NAMES.INVITE),
    roleLabel: roleLabel || getRoleLabel(userDoc.role),
    isActive: userDoc.isActive !== false,
    lastLoginAt: userDoc.lastLoginAt || null,
    createdAt: userDoc.createdAt || null,
  };
}

export async function getAuthzFromSession(session) {
  if (!session?.user?.id) return buildGuestAuthz();

  await ensureAuthSetup();
  const db = await getDb();
  await ensureBaseRoles(db);

  const userId = toObjectId(session.user.id);
  if (!userId) return buildGuestAuthz();

  const userDoc = await db.collection("user").findOne({ _id: userId });
  if (!userDoc) return buildGuestAuthz();

  const roleName = normalizeRoleName(userDoc.role || ROLE_NAMES.INVITE);
  const roleDoc = await getRoleByName(db, roleName);
  const permissions = await resolveRolePermissions(db, roleName);
  const roleLabel = roleDoc?.label || getRoleLabel(roleName);

  return {
    authenticated: true,
    isActive: userDoc.isActive !== false,
    user: mapUser(userDoc, roleLabel),
    role: {
      id: roleDoc ? String(roleDoc._id) : null,
      name: roleName,
      label: roleLabel,
      isSystem: Boolean(roleDoc?.isSystem),
    },
    permissions,
  };
}

export async function getAuthzFromRequest(request) {
  try {
    await ensureAuthSetup();
    const session = await auth.api.getSession({ headers: request.headers });
    return await getAuthzFromSession(session);
  } catch (error) {
    console.error("authz request resolution error:", error);
    return buildGuestAuthz();
  }
}

export function unauthorizedResponse(message = "Authentification requise.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Acces refuse.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireApiPermission(request, { resource, action = "view" }) {
  try {
    const authz = await getAuthzFromRequest(request);
    if (!authz.authenticated) {
      return { ok: false, response: unauthorizedResponse() };
    }
    if (!authz.isActive) {
      return { ok: false, response: forbiddenResponse("Compte desactive.") };
    }
    if (!hasPermission(authz.permissions, resource, action)) {
      return { ok: false, response: forbiddenResponse() };
    }
    return { ok: true, authz };
  } catch (error) {
    console.error("requireApiPermission error:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Erreur de controle d'acces", details: String(error?.message || error) },
        { status: 500 }
      ),
    };
  }
}

export async function requireAdmin(request, action = "view") {
  const gate = await requireApiPermission(request, { resource: "admin", action });
  if (!gate.ok) return gate;

  if (normalizeRoleName(gate.authz?.role?.name) !== ROLE_NAMES.ADMIN) {
    return {
      ok: false,
      response: forbiddenResponse("Page reservee aux admins."),
    };
  }

  return gate;
}
