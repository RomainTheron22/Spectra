import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { buildFolderPath, DRIVE_COLLECTION } from "../../../../lib/drive";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "drive", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ items: [] }, { status: 200 });

    const regex = new RegExp(escapeRegex(q), "i");
    const docs = await db
      .collection(DRIVE_COLLECTION)
      .find({ name: { $regex: regex } })
      .sort({ type: 1, name: 1 })
      .limit(40)
      .toArray();

    const items = await Promise.all(
      docs.map(async (doc) => {
        const isFolder = doc.type === "folder";
        const containerFolderId = isFolder ? doc._id : doc.parentId || null;
        const parentPathFolderId = isFolder ? doc.parentId || null : doc.parentId || null;
        const highlightItemId = isFolder ? null : String(doc._id);
        const containerPath = parentPathFolderId ? await buildFolderPath(db, parentPathFolderId) : [];
        const fullPath = [...containerPath, { id: String(doc._id), name: String(doc.name || "").trim() || "Element" }];

        return {
          id: String(doc._id),
          type: isFolder ? "folder" : "file",
          name: String(doc.name || "").trim(),
          ext: String(doc.ext || "").trim(),
          targetFolderId: containerFolderId ? String(containerFolderId) : null,
          highlightItemId,
          path: fullPath,
        };
      }),
    );

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("GET /api/drive/search error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/drive/search", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
