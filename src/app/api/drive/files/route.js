import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import {
  createStorageName,
  DRIVE_COLLECTION,
  DRIVE_STORAGE_DIR,
  ensureFolderExists,
  extensionFromFileName,
  sanitizeDriveName,
  serializeDriveItem,
  toObjectId,
} from "../../../../lib/drive";

export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "drive", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const formData = await request.formData();
    const parentIdRaw = String(formData.get("parentId") || "").trim();
    const parentId = parentIdRaw ? toObjectId(parentIdRaw) : null;

    if (parentIdRaw && !parentId) {
      return NextResponse.json({ error: "parentId invalide" }, { status: 400 });
    }

    const files = formData
      .getAll("files")
      .filter((entry) => entry && typeof entry === "object" && typeof entry.arrayBuffer === "function");

    if (files.length === 0) {
      return NextResponse.json({ error: "Aucun fichier recu" }, { status: 400 });
    }

    const db = await getDb();
    if (parentId) {
      const parentFolder = await ensureFolderExists(db, parentId);
      if (!parentFolder) {
        return NextResponse.json({ error: "Dossier parent introuvable" }, { status: 404 });
      }
    }

    await mkdir(DRIVE_STORAGE_DIR, { recursive: true });

    const now = new Date();
    const docs = [];
    for (const file of files) {
      const originalName = sanitizeDriveName(file.name, "fichier");
      const storageName = createStorageName(originalName);
      const ext = extensionFromFileName(originalName);
      const storagePath = path.join(DRIVE_STORAGE_DIR, storageName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(storagePath, buffer);

      docs.push({
        type: "file",
        name: originalName,
        parentId: parentId || null,
        ext,
        mimeType: String(file.type || "").trim(),
        size: Number(file.size) || 0,
        storageName,
        createdAt: now,
        updatedAt: now,
      });
    }

    const result = await db.collection(DRIVE_COLLECTION).insertMany(docs, { ordered: true });
    const insertedIds = Object.values(result.insertedIds || {});
    const insertedItems = docs.map((doc, index) => serializeDriveItem({ ...doc, _id: insertedIds[index] }));

    return NextResponse.json({ items: insertedItems }, { status: 201 });
  } catch (error) {
    console.error("POST /api/drive/files error:", error);
    return NextResponse.json(
      { error: "Erreur POST /api/drive/files", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
