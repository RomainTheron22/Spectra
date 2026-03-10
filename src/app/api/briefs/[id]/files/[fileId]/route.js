import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";
import { getDb } from "../../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../../lib/authz";

const BRIEFS_STORAGE = path.join(process.cwd(), "storage", "briefs");

function getIds(request, context) {
  let briefId = context?.params?.id;
  let fileId = context?.params?.fileId;
  if (!briefId || !fileId) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    briefId = briefId || parts[2];
    fileId = fileId || parts[4];
  }
  return { briefId, fileId };
}

export async function GET(request, context) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  const { briefId, fileId } = getIds(request, context);
  if (!briefId || !fileId) return NextResponse.json({ error: "IDs manquants" }, { status: 400 });

  try {
    const db = await getDb();
    const brief = await db.collection("briefs").findOne(
      { _id: new ObjectId(briefId) },
      { projection: { files: 1 } }
    );
    const fileMeta = (brief?.files || []).find((f) => f.id === fileId);
    if (!fileMeta) return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });

    const filePath = path.join(BRIEFS_STORAGE, briefId, fileMeta.storageName);
    const data = await fs.readFile(filePath);
    const isInline = fileMeta.mimeType.startsWith("image/") || fileMeta.mimeType === "application/pdf";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": fileMeta.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileMeta.name)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("GET /api/briefs/[id]/files/[fileId] error:", err);
    return NextResponse.json(
      { error: "Erreur lecture fichier", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "edit" });
  if (!gate.ok) return gate.response;

  const { briefId, fileId } = getIds(request, context);
  if (!briefId || !fileId) return NextResponse.json({ error: "IDs manquants" }, { status: 400 });

  try {
    const db = await getDb();
    const brief = await db.collection("briefs").findOne(
      { _id: new ObjectId(briefId) },
      { projection: { files: 1 } }
    );
    const fileMeta = (brief?.files || []).find((f) => f.id === fileId);
    if (!fileMeta) return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });

    const filePath = path.join(BRIEFS_STORAGE, briefId, fileMeta.storageName);
    await fs.unlink(filePath).catch(() => {});

    await db.collection("briefs").updateOne(
      { _id: new ObjectId(briefId) },
      { $pull: { files: { id: fileId } }, $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/briefs/[id]/files/[fileId] error:", err);
    return NextResponse.json(
      { error: "Erreur suppression fichier", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
