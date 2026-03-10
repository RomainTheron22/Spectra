import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";
import { getDb } from "../../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../../lib/authz";

const CONTRATS_STORAGE = path.join(process.cwd(), "storage", "contrats");

function getIds(request, context) {
  let contratId = context?.params?.id;
  let fileId = context?.params?.fileId;
  if (!contratId || !fileId) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    contratId = contratId || parts[2];
    fileId = fileId || parts[4];
  }
  return { contratId, fileId };
}

export async function GET(request, context) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  const { contratId, fileId } = getIds(request, context);
  if (!contratId || !fileId) return NextResponse.json({ error: "IDs manquants" }, { status: 400 });

  try {
    const db = await getDb();
    const contrat = await db.collection("contrats").findOne(
      { _id: new ObjectId(contratId) },
      { projection: { files: 1 } }
    );
    const fileMeta = (contrat?.files || []).find((file) => file.id === fileId);
    if (!fileMeta) return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });

    const filePath = path.join(CONTRATS_STORAGE, contratId, fileMeta.storageName);
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
    console.error("GET /api/contrats/[id]/files/[fileId] error:", err);
    return NextResponse.json(
      { error: "Erreur lecture fichier", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "edit" });
  if (!gate.ok) return gate.response;

  const { contratId, fileId } = getIds(request, context);
  if (!contratId || !fileId) return NextResponse.json({ error: "IDs manquants" }, { status: 400 });

  try {
    const db = await getDb();
    const contrat = await db.collection("contrats").findOne(
      { _id: new ObjectId(contratId) },
      { projection: { files: 1 } }
    );
    const fileMeta = (contrat?.files || []).find((file) => file.id === fileId);
    if (!fileMeta) return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });

    const filePath = path.join(CONTRATS_STORAGE, contratId, fileMeta.storageName);
    await fs.unlink(filePath).catch(() => {});

    await db.collection("contrats").updateOne(
      { _id: new ObjectId(contratId) },
      { $pull: { files: { id: fileId } }, $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/contrats/[id]/files/[fileId] error:", err);
    return NextResponse.json(
      { error: "Erreur suppression fichier", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
