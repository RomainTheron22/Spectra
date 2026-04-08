import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

function toDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function getId(request, context) {
  let id = context?.params?.id;
  if (!id) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.length - 1];
  }
  return id;
}

export async function PATCH(req, context) {
  const gate = await requireApiPermission(req, { resource: "calendrier", action: "edit" });
  if (!gate.ok) return gate.response;

  try {
    const id = getId(req, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const db = await getDb();
    const payload = await req.json();

    const $set = { updatedAt: new Date() };

    const stringFields = ["branche", "projet", "phaseName", "phaseColor", "lieu", "commentaires"];
    for (const k of stringFields) {
      if (k in payload) $set[k] = String(payload[k] ?? "");
    }

    if ("allDay" in payload) $set.allDay = !!payload.allDay;

    if ("start" in payload) {
      const d = toDate(payload.start);
      if (!d) return NextResponse.json({ error: "Start invalide" }, { status: 400 });
      $set.start = d;
    }

    if ("end" in payload) {
      const d = toDate(payload.end);
      if (!d) return NextResponse.json({ error: "End invalide" }, { status: 400 });
      $set.end = d;
    }

    // normalisation allDay
    const current = await db.collection("evenements").findOne(
      { _id: new ObjectId(id) },
      { projection: { start: 1, end: 1, allDay: 1 } }
    );

    const nextAllDay = ("allDay" in payload) ? !!payload.allDay : !!current?.allDay;
    const nextStart = $set.start ?? current?.start;
    const nextEnd = $set.end ?? current?.end;

    if (nextAllDay && nextStart) {
      $set.start = startOfDay(nextStart);
      const endDay = startOfDay(nextEnd || nextStart);
      $set.end = addDays(endDay, 1);
      $set.allDay = true;
    } else if (!nextAllDay && nextStart && nextEnd && nextEnd < nextStart) {
      $set.end = nextStart;
    }

    await db.collection("evenements").updateOne({ _id: new ObjectId(id) }, { $set });
    const updated = await db.collection("evenements").findOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "update",
      resource: "evenement",
      resourceLabel: "Événement",
      detail: updated?.projet || updated?.phaseName || id,
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/evenements/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur PATCH /api/evenements/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  const gate = await requireApiPermission(req, { resource: "calendrier", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    const id = getId(req, context);
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const db = await getDb();
    const toDelete = await db.collection("evenements").findOne({ _id: new ObjectId(id) });
    await db.collection("evenements").deleteOne({ _id: new ObjectId(id) });

    logActivity(gate.authz.user, {
      action: "delete",
      resource: "evenement",
      resourceLabel: "Événement",
      detail: toDelete?.projet || toDelete?.phaseName || id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/evenements/[id] error:", err);
    return NextResponse.json(
      { error: "Erreur DELETE /api/evenements/[id]", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
