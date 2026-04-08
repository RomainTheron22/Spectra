import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/authz";

export async function GET(request) {
  const gate = await requireAdmin(request, "view");
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);
    const skip = Number(searchParams.get("skip") || 0);
    const search = String(searchParams.get("search") || "").trim();

    const filter = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { userName: rx },
        { message: rx },
        { resourceLabel: rx },
        { detail: rx },
      ];
    }

    const [items, total] = await Promise.all([
      db
        .collection("activity_logs")
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("activity_logs").countDocuments(filter),
    ]);

    return NextResponse.json({ items, total }, { status: 200 });
  } catch (err) {
    console.error("GET /api/admin/activity-log error:", err);
    return NextResponse.json(
      { error: "Erreur chargement historique", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
