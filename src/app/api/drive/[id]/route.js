import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { DRIVE_COLLECTION, DRIVE_STORAGE_DIR, toObjectId } from "../../../../lib/drive";

function getIdFromContext(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.indexOf("drive") + 1];
  }
  return String(id || "").trim();
}

async function deleteStoredFiles(storageNames = []) {
  await Promise.all(
    storageNames.map(async (storageName) => {
      const safeName = String(storageName || "").trim();
      if (!safeName) return;
      try {
        const filePath = path.join(DRIVE_STORAGE_DIR, safeName);
        await unlink(filePath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          console.error("drive file unlink error:", error);
        }
      }
    }),
  );
}

async function collectFolderTree(db, rootFolderId) {
  const collection = db.collection(DRIVE_COLLECTION);
  const idsToDelete = [rootFolderId];
  const fileStorageNames = [];
  const queue = [rootFolderId];

  while (queue.length > 0) {
    const currentBatch = queue.splice(0, queue.length);
    const children = await collection
      .find({ parentId: { $in: currentBatch } }, { projection: { _id: 1, type: 1, storageName: 1 } })
      .toArray();

    for (const child of children) {
      idsToDelete.push(child._id);
      if (child.type === "folder") {
        queue.push(child._id);
      } else if (child.type === "file" && child.storageName) {
        fileStorageNames.push(String(child.storageName));
      }
    }
  }

  return { idsToDelete, fileStorageNames };
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "drive", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    const idRaw = getIdFromContext(request, context);
    const id = toObjectId(idRaw);
    if (!id) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const db = await getDb();
    const collection = db.collection(DRIVE_COLLECTION);
    const target = await collection.findOne({ _id: id }, { projection: { _id: 1, type: 1, storageName: 1 } });
    if (!target) return NextResponse.json({ error: "Element introuvable" }, { status: 404 });

    if (target.type === "folder") {
      const { idsToDelete, fileStorageNames } = await collectFolderTree(db, id);
      await collection.deleteMany({ _id: { $in: idsToDelete } });
      await deleteStoredFiles(fileStorageNames);
      return NextResponse.json({ ok: true, deletedCount: idsToDelete.length }, { status: 200 });
    }

    await collection.deleteOne({ _id: id });
    if (target.storageName) {
      await deleteStoredFiles([String(target.storageName)]);
    }

    return NextResponse.json({ ok: true, deletedCount: 1 }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/drive/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur suppression element drive", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
