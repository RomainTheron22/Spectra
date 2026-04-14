import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import {
  createStorageName,
  DRIVE_COLLECTION,
  DRIVE_STORAGE_DIR,
  extensionFromFileName,
  sanitizeDriveName,
} from "../../../lib/drive";
import { logActivity } from "../../../lib/activity-log";

const BRIEFS_STORAGE = path.join(process.cwd(), "storage", "briefs");
const CONTRATS_STORAGE = path.join(process.cwd(), "storage", "contrats");

function sanitizeString(value) {
  return String(value || "").trim();
}

function sanitizeDate(value) {
  const raw = sanitizeString(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return raw;
}

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "contrats", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const items = await db
      .collection("contrats")
      .find({})
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/contrats error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/contrats", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const gate = await requireApiPermission(req, { resource: "contrats", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await req.json();
    const db = await getDb();
    const contractId = new ObjectId();
    const sourceBriefId = sanitizeString(payload?.sourceBriefId);
    let transferredFiles = [];

    const doc = {
      _id: contractId,
      nomContrat: sanitizeString(payload?.nomContrat),
      clientNom: sanitizeString(payload?.clientNom),
      branche: sanitizeString(payload?.branche),
      lieu: sanitizeString(payload?.lieu),
      statut: sanitizeString(payload?.statut),
      dateDebut: sanitizeDate(payload?.dateDebut),
      dateFin: sanitizeDate(payload?.dateFin),
      brief: sanitizeString(payload?.brief),
      assignees: Array.isArray(payload?.assignees) ? payload.assignees.map(String) : [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!doc.nomContrat) {
      return NextResponse.json({ error: "Le nom du contrat est obligatoire" }, { status: 400 });
    }
    if (!doc.clientNom) {
      return NextResponse.json({ error: "Le nom du client est obligatoire" }, { status: 400 });
    }
    if (!doc.branche) {
      return NextResponse.json({ error: "La branche est obligatoire" }, { status: 400 });
    }

    if (sourceBriefId) {
      const brief = await db.collection("briefs").findOne(
        { _id: new ObjectId(sourceBriefId) },
        { projection: { files: 1 } }
      );

      if (brief?.files?.length) {
        const contractDir = path.join(CONTRATS_STORAGE, String(contractId));
        await fs.mkdir(contractDir, { recursive: true });

        transferredFiles = await Promise.all(
          brief.files.map(async (file) => {
            const storageName = createStorageName(file.name);
            const sourcePath = path.join(BRIEFS_STORAGE, sourceBriefId, file.storageName);
            const targetPath = path.join(contractDir, storageName);
            await fs.copyFile(sourcePath, targetPath);
            return {
              id: randomUUID(),
              name: file.name,
              versionNumber: Number(file.versionNumber) > 0 ? Number(file.versionNumber) : undefined,
              mimeType: file.mimeType || "application/octet-stream",
              size: Number(file.size) || 0,
              storageName,
              uploadedAt: file.uploadedAt || new Date(),
            };
          })
        );
      }
    }

    doc.files = transferredFiles;
    await db.collection("contrats").insertOne(doc);

    // --- Création automatique du dossier Drive ---
    try {
      const now = new Date();
      const folderName = sanitizeDriveName(doc.clientNom, "Client");

      // 1. Trouver ou créer le dossier racine "Projets"
      let projetsRoot = await db.collection(DRIVE_COLLECTION).findOne({ name: "Projets", type: "folder", parentId: null });
      if (!projetsRoot) {
        const rootDoc = {
          type: "folder", name: "Projets", parentId: null,
          ext: "", mimeType: "", size: 0, storageName: "",
          affiliatedContratId: null, affiliatedContratName: "",
          createdAt: now, updatedAt: now,
        };
        const rootResult = await db.collection(DRIVE_COLLECTION).insertOne(rootDoc);
        projetsRoot = { _id: rootResult.insertedId };
      }

      // 2. Créer le dossier client
      const clientFolderDoc = {
        type: "folder", name: folderName, parentId: projetsRoot._id,
        ext: "", mimeType: "", size: 0, storageName: "",
        affiliatedContratId: contractId,
        affiliatedContratName: doc.nomContrat,
        createdAt: now, updatedAt: now,
      };
      const clientFolderResult = await db.collection(DRIVE_COLLECTION).insertOne(clientFolderDoc);
      const driveFolderId = clientFolderResult.insertedId;

      // 3. Mettre à jour le contrat avec l'ID du dossier Drive
      await db.collection("contrats").updateOne({ _id: contractId }, { $set: { driveFolderId: String(driveFolderId) } });
      doc.driveFolderId = String(driveFolderId);

      // 4. Copier les fichiers du brief vers le Drive
      if (sourceBriefId) {
        const brief = await db.collection("briefs").findOne({ _id: new ObjectId(sourceBriefId) }, { projection: { files: 1 } });
        if (brief?.files?.length) {
          await fs.mkdir(DRIVE_STORAGE_DIR, { recursive: true });
          const driveFileDocs = [];
          for (const file of brief.files) {
            try {
              const storageName = createStorageName(file.name);
              const sourcePath = path.join(BRIEFS_STORAGE, sourceBriefId, file.storageName);
              const targetPath = path.join(DRIVE_STORAGE_DIR, storageName);
              await fs.copyFile(sourcePath, targetPath);
              driveFileDocs.push({
                type: "file",
                name: file.name,
                parentId: driveFolderId,
                ext: extensionFromFileName(file.name),
                mimeType: file.mimeType || "application/octet-stream",
                size: Number(file.size) || 0,
                storageName,
                createdAt: now,
                updatedAt: now,
              });
            } catch (e) {
              console.error("Erreur copie fichier brief vers drive:", file.name, e);
            }
          }
          if (driveFileDocs.length > 0) {
            await db.collection(DRIVE_COLLECTION).insertMany(driveFileDocs);
          }
        }
      }
    } catch (driveErr) {
      console.error("Erreur création dossier Drive pour le projet:", driveErr);
      // Non-bloquant : le contrat est créé même si le drive échoue
    }

    logActivity(gate.authz.user, {
      action: "create",
      resource: "contrat",
      resourceLabel: "Contrat",
      detail: doc.nomContrat || "",
    });

    return NextResponse.json({ item: doc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/contrats error:", err);
    return NextResponse.json(
      { error: "Erreur POST /api/contrats", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
