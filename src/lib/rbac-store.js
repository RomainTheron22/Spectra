import { ObjectId } from "mongodb";
import {
  ROLE_NAMES,
  createAdminPermissions,
  createInvitePermissions,
  normalizePermissions,
  normalizeRoleName,
} from "./rbac";

const ROLES_COLLECTION = "roles";
const ROLE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

export function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

export function sanitizeRoleName(value) {
  return normalizeRoleName(value)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

export function sanitizeRoleLabel(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isValidRoleName(value) {
  return ROLE_NAME_PATTERN.test(String(value || ""));
}

export async function ensureBaseRoles(db) {
  const roles = db.collection(ROLES_COLLECTION);
  const now = new Date();

  const systemRoles = [
    {
      name: ROLE_NAMES.INVITE,
      label: "Invite",
      isSystem: true,
      permissions: createInvitePermissions(),
    },
    {
      name: ROLE_NAMES.ADMIN,
      label: "Admin",
      isSystem: true,
      permissions: createAdminPermissions(),
    },
  ];

  for (const role of systemRoles) {
    const existing = await roles.findOne({ name: role.name });
    if (!existing) {
      await roles.insertOne({
        ...role,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    const nextLabel = sanitizeRoleLabel(existing.label || role.label) || role.label;
    const nextPermissions =
      role.name === ROLE_NAMES.ADMIN
        ? createAdminPermissions()
        : normalizePermissions(existing.permissions || role.permissions);
    await roles.updateOne(
      { _id: existing._id },
      {
        $set: {
          label: nextLabel,
          permissions: nextPermissions,
          isSystem: true,
          updatedAt: now,
        },
      }
    );
  }
}

export async function getRoleByName(db, roleName) {
  const name = normalizeRoleName(roleName);
  if (!name) return null;
  const role = await db.collection(ROLES_COLLECTION).findOne({ name });
  if (!role) return null;
  const normalizedRoleName = normalizeRoleName(role.name);
  return {
    ...role,
    name: normalizedRoleName,
    label: sanitizeRoleLabel(role.label || role.name) || role.name,
    permissions:
      normalizedRoleName === ROLE_NAMES.ADMIN
        ? createAdminPermissions()
        : normalizePermissions(role.permissions),
  };
}

export async function getRoleById(db, id) {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const role = await db.collection(ROLES_COLLECTION).findOne({ _id: objectId });
  if (!role) return null;
  const normalizedRoleName = normalizeRoleName(role.name);
  return {
    ...role,
    name: normalizedRoleName,
    label: sanitizeRoleLabel(role.label || role.name) || role.name,
    permissions:
      normalizedRoleName === ROLE_NAMES.ADMIN
        ? createAdminPermissions()
        : normalizePermissions(role.permissions),
  };
}

export async function listRoles(db) {
  const roles = await db
    .collection(ROLES_COLLECTION)
    .find({})
    .sort({ isSystem: -1, name: 1 })
    .toArray();

  return roles.map((role) => ({
    ...role,
    name: normalizeRoleName(role.name),
    label: sanitizeRoleLabel(role.label || role.name) || role.name,
    permissions:
      normalizeRoleName(role.name) === ROLE_NAMES.ADMIN
        ? createAdminPermissions()
        : normalizePermissions(role.permissions),
    isSystem: Boolean(role.isSystem),
  }));
}

export async function resolveRolePermissions(db, roleName) {
  const normalizedRole = normalizeRoleName(roleName);
  if (normalizedRole === ROLE_NAMES.ADMIN) return createAdminPermissions();
  const role = await getRoleByName(db, normalizedRole);
  if (!role) return createInvitePermissions();
  return normalizePermissions(role.permissions);
}

export { ROLES_COLLECTION };
