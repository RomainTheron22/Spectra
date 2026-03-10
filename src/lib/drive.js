import path from "path";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import { PREDEFINED_FILE_GROUPS } from "./drive-constants";

export const DRIVE_COLLECTION = "drive_items";
export const DRIVE_STORAGE_DIR = path.join(process.cwd(), "storage", "drive");

export const KNOWN_EXTENSIONS = new Set(
  Object.values(PREDEFINED_FILE_GROUPS)
    .flatMap((group) => group.extensions)
    .map((ext) => normalizeExtension(ext))
    .filter(Boolean),
);

export function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

export function normalizeExtension(value) {
  return String(value || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
}

export function extensionFromFileName(fileName) {
  const name = String(fileName || "").trim();
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx >= name.length - 1) return "";
  return normalizeExtension(name.slice(idx + 1));
}

export function sanitizeDriveName(value, fallback = "Sans nom") {
  const cleaned = String(value || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

export function sanitizeFileNameForStorage(value) {
  return sanitizeDriveName(value, "fichier")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export function createStorageName(originalName) {
  const safe = sanitizeFileNameForStorage(originalName);
  return `${Date.now()}-${randomUUID()}-${safe}`;
}

export function serializeDriveItem(item) {
  if (!item) return null;
  return {
    id: String(item._id),
    name: String(item.name || "").trim(),
    type: item.type === "folder" ? "folder" : "file",
    parentId: item.parentId ? String(item.parentId) : null,
    ext: normalizeExtension(item.ext),
    mimeType: String(item.mimeType || "").trim(),
    size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
    storageName: String(item.storageName || "").trim(),
    affiliatedContratId: item.affiliatedContratId ? String(item.affiliatedContratId) : null,
    affiliatedContratName: String(item.affiliatedContratName || "").trim(),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function ensureFolderExists(db, folderId) {
  if (!folderId) return null;
  const collection = db.collection(DRIVE_COLLECTION);
  const folder = await collection.findOne({ _id: folderId, type: "folder" });
  return folder || null;
}

export async function buildFolderPath(db, folderId) {
  if (!folderId) return [];
  const collection = db.collection(DRIVE_COLLECTION);
  const pathItems = [];
  let current = await collection.findOne({ _id: folderId, type: "folder" });
  let guard = 0;

  while (current && guard < 50) {
    pathItems.push({ id: String(current._id), name: String(current.name || "").trim() || "Dossier" });
    current = current.parentId ? await collection.findOne({ _id: current.parentId, type: "folder" }) : null;
    guard += 1;
  }

  return pathItems.reverse();
}

export function sortDriveItems(items = []) {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" });
  });
}
