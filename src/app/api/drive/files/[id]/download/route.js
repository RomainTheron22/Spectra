import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getDb } from "../../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../../lib/authz";
import { DRIVE_COLLECTION, DRIVE_STORAGE_DIR, toObjectId } from "../../../../../../lib/drive";

function contentDispositionFileName(name) {
  const fallback = String(name || "fichier").replace(/"/g, "");
  return `attachment; filename="${fallback}"`;
}

function getIdFromContext(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.indexOf("files") + 1];
  }
  return String(id || "").trim();
}

export async function GET(request, context) {
  const gate = await requireApiPermission(request, { resource: "drive", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const idRaw = getIdFromContext(request, context);
    const id = toObjectId(idRaw);
    if (!id) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const db = await getDb();
    const doc = await db.collection(DRIVE_COLLECTION).findOne({ _id: id, type: "file" });
    if (!doc) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

    const storageName = String(doc.storageName || "").trim();
    if (!storageName) {
      return NextResponse.json({ error: "Fichier non disponible" }, { status: 404 });
    }

    const filePath = path.join(DRIVE_STORAGE_DIR, storageName);
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": String(doc.mimeType || "application/octet-stream"),
        "Content-Length": String(buffer.length),
        "Content-Disposition": contentDispositionFileName(doc.name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/drive/files/[id]/download error:", error);
    return NextResponse.json(
      { error: "Erreur telechargement", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
