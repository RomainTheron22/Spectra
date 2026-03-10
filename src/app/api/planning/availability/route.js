import { NextResponse } from "next/server";
import { toObjectId } from "../../../../lib/rbac-store";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import {
  PLANNING_COLLECTION,
  buildBusyMap,
  overlapsFilter,
  participationFilter,
  parseDateTime,
  uniqueStringIds,
} from "../../../../lib/planning";

export async function GET(request) {
  const gate = await requireApiPermission(request, {
    resource: "planningPerso",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(request.url);
    const start = parseDateTime(url.searchParams.get("start"));
    const end = parseDateTime(url.searchParams.get("end"));
    const excludeTaskId = String(url.searchParams.get("excludeTaskId") || "").trim();
    const excludeObjectId = toObjectId(excludeTaskId);
    const userIds = uniqueStringIds(
      String(url.searchParams.get("userIds") || "")
        .split(",")
        .map((v) => v.trim())
    );

    if (!start || !end || end <= start) {
      return NextResponse.json({ error: "Plage horaire invalide." }, { status: 400 });
    }
    if (userIds.length === 0) {
      return NextResponse.json({ busyUserIds: [], busyByUser: {} }, { status: 200 });
    }

    const db = await getDb();
    const query = {
      ...participationFilter(userIds),
      ...overlapsFilter(start, end),
    };
    if (excludeObjectId) {
      query._id = { $ne: excludeObjectId };
    }

    const tasks = await db
      .collection(PLANNING_COLLECTION)
      .find(query)
      .project({ ownerId: 1, participantIds: 1, start: 1, end: 1 })
      .toArray();

    const busyByUser = buildBusyMap(tasks, userIds);
    const busyUserIds = userIds.filter((id) => Array.isArray(busyByUser[id]) && busyByUser[id].length > 0);

    return NextResponse.json({ busyUserIds, busyByUser }, { status: 200 });
  } catch (error) {
    console.error("GET /api/planning/availability error:", error);
    return NextResponse.json(
      {
        error: "Erreur GET /api/planning/availability",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
