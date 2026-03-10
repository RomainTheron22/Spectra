import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { toObjectId } from "../../../../lib/rbac-store";
import {
  PLANNING_COLLECTION,
  buildBusyMap,
  normalizeInviteeIds,
  overlapsFilter,
  participationFilter,
  parseDateTime,
  uniqueStringIds,
} from "../../../../lib/planning";

function toTaskResponse(task, viewerId, selfView) {
  const ownerId = String(task.ownerId || "");
  const participantIds = uniqueStringIds(task.participantIds || []);
  const isOwner = ownerId === viewerId;

  if (!selfView) {
    return {
      id: String(task._id),
      title: "Occupe",
      start: task.start,
      end: task.end,
      isOwner: false,
      isPrivate: true,
    };
  }

  return {
    id: String(task._id),
    title: String(task.title || "Tache"),
    start: task.start,
    end: task.end,
    ownerId,
    participantIds,
    isOwner,
    isPrivate: false,
  };
}

async function ensureUsersExist(db, userIds) {
  if (userIds.length === 0) return [];
  const objectIds = userIds.map((id) => toObjectId(id)).filter(Boolean);
  if (objectIds.length !== userIds.length) return null;

  const users = await db
    .collection("user")
    .find({ _id: { $in: objectIds }, isActive: { $ne: false } })
    .project({ _id: 1 })
    .toArray();
  if (users.length !== userIds.length) return null;
  return users.map((u) => String(u._id));
}

export async function GET(request) {
  const gate = await requireApiPermission(request, {
    resource: "planningPerso",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  try {
    const viewerId = String(gate.authz?.user?.id || "");
    const url = new URL(request.url);
    const from = parseDateTime(url.searchParams.get("from"));
    const to = parseDateTime(url.searchParams.get("to"));
    const selectedUserId = String(url.searchParams.get("userId") || viewerId).trim() || viewerId;
    const selfView = selectedUserId === viewerId;

    if (!from || !to || to <= from) {
      return NextResponse.json({ error: "Plage horaire invalide." }, { status: 400 });
    }

    const db = await getDb();
    const tasks = await db
      .collection(PLANNING_COLLECTION)
      .find({
        ...participationFilter([selectedUserId]),
        ...overlapsFilter(from, to),
      })
      .sort({ start: 1 })
      .toArray();

    return NextResponse.json(
      {
        items: tasks.map((task) => toTaskResponse(task, viewerId, selfView)),
        meta: {
          selectedUserId,
          selfView,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/planning/tasks error:", error);
    return NextResponse.json(
      { error: "Erreur GET /api/planning/tasks", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const gate = await requireApiPermission(request, {
    resource: "planningPerso",
    action: "create",
  });
  if (!gate.ok) return gate.response;

  try {
    const viewerId = String(gate.authz?.user?.id || "");
    const payload = await request.json();
    const title = String(payload?.title || "").trim();
    const start = parseDateTime(payload?.start);
    const end = parseDateTime(payload?.end);
    const participantIds = normalizeInviteeIds(payload?.inviteeIds || [], viewerId);

    if (!title) {
      return NextResponse.json({ error: "Le nom de la tache est obligatoire." }, { status: 400 });
    }
    if (!start || !end || end <= start) {
      return NextResponse.json({ error: "Plage horaire invalide." }, { status: 400 });
    }

    const db = await getDb();
    const validParticipants = await ensureUsersExist(db, participantIds);
    if (validParticipants === null) {
      return NextResponse.json(
        { error: "Certaines personnes invitees sont invalides ou inactives." },
        { status: 400 }
      );
    }

    const checkUserIds = uniqueStringIds([viewerId, ...validParticipants]);
    const conflictingTasks = await db
      .collection(PLANNING_COLLECTION)
      .find({
        ...participationFilter(checkUserIds),
        ...overlapsFilter(start, end),
      })
      .project({ ownerId: 1, participantIds: 1, start: 1, end: 1 })
      .toArray();

    const busyByUser = buildBusyMap(conflictingTasks, checkUserIds);
    const busyUserIds = checkUserIds.filter((id) => (busyByUser[id] || []).length > 0);
    if (busyUserIds.length > 0) {
      return NextResponse.json(
        {
          error: "Un ou plusieurs participants sont deja pris sur ce creneau.",
          busyUserIds,
          busyByUser,
        },
        { status: 409 }
      );
    }

    const doc = {
      title,
      start,
      end,
      ownerId: viewerId,
      participantIds: validParticipants,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(PLANNING_COLLECTION).insertOne(doc);
    return NextResponse.json(
      {
        item: {
          id: String(result.insertedId),
          ...doc,
          isOwner: true,
          isPrivate: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/planning/tasks error:", error);
    return NextResponse.json(
      { error: "Erreur POST /api/planning/tasks", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
