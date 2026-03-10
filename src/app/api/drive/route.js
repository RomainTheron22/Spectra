import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import { buildFolderPath, DRIVE_COLLECTION, serializeDriveItem, sortDriveItems, toObjectId } from "../../../lib/drive";

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "drive", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const url = new URL(request.url);
    const parentIdRaw = String(url.searchParams.get("parentId") || "").trim();
    const parentId = parentIdRaw ? toObjectId(parentIdRaw) : null;

    if (parentIdRaw && !parentId) {
      return NextResponse.json({ error: "parentId invalide" }, { status: 400 });
    }

    let currentFolder = null;
    if (parentId) {
      currentFolder = await db.collection(DRIVE_COLLECTION).findOne({ _id: parentId, type: "folder" });
      if (!currentFolder) {
        return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
      }
    }

    const items = await db.collection(DRIVE_COLLECTION).find({ parentId: parentId || null }).toArray();
    const serialized = sortDriveItems(items.map((item) => serializeDriveItem(item)));
    const path = parentId ? await buildFolderPath(db, parentId) : [];

    return NextResponse.json(
      {
        currentFolder: currentFolder ? serializeDriveItem(currentFolder) : null,
        path,
        items: serialized,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/drive error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/drive", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
