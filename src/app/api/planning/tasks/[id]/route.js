import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../lib/authz";
import { toObjectId } from "../../../../../lib/rbac-store";
import {
  PLANNING_COLLECTION,
  buildBusyMap,
  normalizeInviteeIds,
  overlapsFilter,
  participationFilter,
  parseDateTime,
  uniqueStringIds,
} from "../../../../../lib/planning";

function getTaskId(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.length - 1];
  }
  return String(id || "").trim();
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

export async function PATCH(request, context) {
  const gate = await requireApiPermission(request, {
    resource: "planningPerso",
    action: "edit",
  });
  if (!gate.ok) return gate.response;

  try {
    const viewerId = String(gate.authz?.user?.id || "");
    const taskId = getTaskId(request, context);
    const objectId = toObjectId(taskId);
    if (!objectId) return NextResponse.json({ error: "ID tache invalide." }, { status: 400 });

    const db = await getDb();
    const current = await db.collection(PLANNING_COLLECTION).findOne({ _id: objectId });
    if (!current) return NextResponse.json({ error: "Tache introuvable." }, { status: 404 });
    if (String(current.ownerId) !== viewerId) {
      return NextResponse.json({ error: "Seul le proprietaire peut modifier la tache." }, { status: 403 });
    }

    const payload = await request.json();
    const title = "title" in payload ? String(payload.title || "").trim() : String(current.title || "");
    const start = "start" in payload ? parseDateTime(payload.start) : new Date(current.start);
    const end = "end" in payload ? parseDateTime(payload.end) : new Date(current.end);
    const participantIds = "inviteeIds" in payload
      ? normalizeInviteeIds(payload.inviteeIds || [], viewerId)
      : normalizeInviteeIds(current.participantIds || [], viewerId);

    if (!title) return NextResponse.json({ error: "Le nom de la tache est obligatoire." }, { status: 400 });
    if (!start || !end || end <= start) {
      return NextResponse.json({ error: "Plage horaire invalide." }, { status: 400 });
    }

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
        _id: { $ne: new ObjectId(objectId) },
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

    const $set = {
      title,
      start,
      end,
      participantIds: validParticipants,
      updatedAt: new Date(),
    };

    await db.collection(PLANNING_COLLECTION).updateOne({ _id: objectId }, { $set });
    const updated = await db.collection(PLANNING_COLLECTION).findOne({ _id: objectId });

    return NextResponse.json(
      {
        item: {
          id: String(updated._id),
          title: updated.title,
          start: updated.start,
          end: updated.end,
          ownerId: String(updated.ownerId),
          participantIds: uniqueStringIds(updated.participantIds || []),
          isOwner: true,
          isPrivate: false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/planning/tasks/[id] error:", error);
    return NextResponse.json(
      {
        error: "Erreur PATCH /api/planning/tasks/[id]",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const gate = await requireApiPermission(request, {
    resource: "planningPerso",
    action: "delete",
  });
  if (!gate.ok) return gate.response;

  try {
    const viewerId = String(gate.authz?.user?.id || "");
    const taskId = getTaskId(request, context);
    const objectId = toObjectId(taskId);
    if (!objectId) return NextResponse.json({ error: "ID tache invalide." }, { status: 400 });

    const db = await getDb();
    const current = await db.collection(PLANNING_COLLECTION).findOne({ _id: objectId });
    if (!current) return NextResponse.json({ error: "Tache introuvable." }, { status: 404 });
    if (String(current.ownerId) !== viewerId) {
      return NextResponse.json({ error: "Seul le proprietaire peut supprimer la tache." }, { status: 403 });
    }

    await db.collection(PLANNING_COLLECTION).deleteOne({ _id: objectId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/planning/tasks/[id] error:", error);
    return NextResponse.json(
      {
        error: "Erreur DELETE /api/planning/tasks/[id]",
        details: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
