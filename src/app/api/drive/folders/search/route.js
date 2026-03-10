import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../lib/authz";
import { buildFolderPath, DRIVE_COLLECTION } from "../../../../../lib/drive";

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
    const folders = await db
      .collection(DRIVE_COLLECTION)
      .find({ type: "folder", name: { $regex: regex } })
      .sort({ name: 1 })
      .limit(30)
      .toArray();

    const items = await Promise.all(
      folders.map(async (folder) => {
        const path = await buildFolderPath(db, folder._id);
        return {
          id: String(folder._id),
          name: String(folder.name || "").trim(),
          parentId: folder.parentId ? String(folder.parentId) : null,
          path,
        };
      }),
    );

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("GET /api/drive/folders/search error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/drive/folders/search", details: String(error?.message || error) },
      { status: 500 },
    );
  }
}
