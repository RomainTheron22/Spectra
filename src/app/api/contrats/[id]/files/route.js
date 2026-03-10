import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { getDb } from "../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../lib/authz";
import { createStorageName } from "../../../../../lib/drive";

const CONTRATS_STORAGE = path.join(process.cwd(), "storage", "contrats");

function normalizeVersionKey(name) {
  return String(name || "").trim().toLowerCase();
}

function getContratId(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[2];
  }
  return id;
}

export async function POST(request, context) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "edit" });
  if (!gate.ok) return gate.response;

  const contratId = getContratId(request, context);
  if (!contratId) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  try {
    const formData = await request.formData();
    const uploadedFiles = formData.getAll("files");
    if (!uploadedFiles.length) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const contratDir = path.join(CONTRATS_STORAGE, contratId);
    await fs.mkdir(contratDir, { recursive: true });

    const db = await getDb();
    const contrat = await db.collection("contrats").findOne(
      { _id: new ObjectId(contratId) },
      { projection: { files: 1 } }
    );

    const versionCounters = new Map();
    for (const existingFile of contrat?.files || []) {
      const key = normalizeVersionKey(existingFile?.name);
      if (!key) continue;
      const current = versionCounters.get(key) || { count: 0, maxVersion: 0 };
      const explicitVersion = Number(existingFile?.versionNumber);
      current.count += 1;
      if (Number.isInteger(explicitVersion) && explicitVersion > 0) {
        current.maxVersion = Math.max(current.maxVersion, explicitVersion);
      }
      versionCounters.set(key, current);
    }

    const newFiles = [];

    for (const file of uploadedFiles) {
      if (!(file instanceof File)) continue;
      const versionKey = normalizeVersionKey(file.name);
      const currentCounter = versionCounters.get(versionKey) || { count: 0, maxVersion: 0 };
      const versionNumber = Math.max(currentCounter.count, currentCounter.maxVersion) + 1;
      const storageName = createStorageName(file.name);
      const filePath = path.join(contratDir, storageName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      currentCounter.count += 1;
      currentCounter.maxVersion = versionNumber;
      versionCounters.set(versionKey, currentCounter);
      newFiles.push({
        id: randomUUID(),
        name: file.name,
        versionNumber,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storageName,
        uploadedAt: new Date(),
      });
    }

    if (newFiles.length) {
      await db.collection("contrats").updateOne(
        { _id: new ObjectId(contratId) },
        { $push: { files: { $each: newFiles } }, $set: { updatedAt: new Date() } }
      );
    }

    return NextResponse.json({ items: newFiles }, { status: 201 });
  } catch (err) {
    console.error("POST /api/contrats/[id]/files error:", err);
    return NextResponse.json(
      { error: "Erreur upload fichiers", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
