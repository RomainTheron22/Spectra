import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { DRIVE_COLLECTION, ensureFolderExists, sanitizeDriveName, serializeDriveItem, toObjectId } from "../../../../lib/drive";

export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "drive", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await request.json().catch(() => ({}));
    const name = sanitizeDriveName(payload?.name, "");
    const parentIdRaw = String(payload?.parentId || "").trim();
    const parentId = parentIdRaw ? toObjectId(parentIdRaw) : null;
    const affiliatedContratIdRaw = String(payload?.affiliatedContratId || "").trim();
    const affiliatedContratId = affiliatedContratIdRaw ? toObjectId(affiliatedContratIdRaw) : null;

    if (!name) {
      return NextResponse.json({ error: "Le nom du dossier est obligatoire" }, { status: 400 });
    }
    if (parentIdRaw && !parentId) {
      return NextResponse.json({ error: "parentId invalide" }, { status: 400 });
    }
    if (affiliatedContratIdRaw && !affiliatedContratId) {
      return NextResponse.json({ error: "affiliatedContratId invalide" }, { status: 400 });
    }

    const db = await getDb();
    let parentFolder = null;
    if (parentId) {
      parentFolder = await ensureFolderExists(db, parentId);
      if (!parentFolder) {
        return NextResponse.json({ error: "Dossier parent introuvable" }, { status: 404 });
      }
    }

    let affiliatedContrat = null;
    if (affiliatedContratId) {
      affiliatedContrat = await db.collection("contrats").findOne({ _id: affiliatedContratId });
      if (!affiliatedContrat) {
        return NextResponse.json({ error: "Contrat / projet introuvable" }, { status: 404 });
      }
    }

    const now = new Date();
    const doc = {
      type: "folder",
      name,
      parentId: parentId || null,
      ext: "",
      mimeType: "",
      size: 0,
      storageName: "",
      affiliatedContratId: affiliatedContrat?._id || null,
      affiliatedContratName: String(affiliatedContrat?.nomContrat || "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(DRIVE_COLLECTION).insertOne(doc);
    return NextResponse.json({ item: serializeDriveItem({ ...doc, _id: result.insertedId }) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/drive/folders error:", error);
    return NextResponse.json(
      { error: "Erreur POST /api/drive/folders", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
