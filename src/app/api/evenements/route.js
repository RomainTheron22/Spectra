import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import { logActivity } from "../../../lib/activity-log";

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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  const gate = await requireApiPermission(req, { resource: "calendrier", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);

    const branche = (searchParams.get("branche") || "").trim();
    const projet = (searchParams.get("projet") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    const filter = {};
    if (branche) filter.branche = branche;
    if (projet) filter.projet = projet;

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { projet: rx },
        { phaseName: rx },
        { lieu: rx },
        { commentaires: rx },
        { branche: rx },
      ];
    }

    const items = await db
      .collection("evenements")
      .find(filter)
      .sort({ start: -1 })
      .toArray();

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/evenements error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/evenements", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const gate = await requireApiPermission(req, { resource: "calendrier", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const payload = await req.json();

    const branche = String(payload?.branche || "Agency");
    const projet = String(payload?.projet || "").trim();
    const phaseName = String(payload?.phaseName || "Montage").trim();
    const phaseColor = String(payload?.phaseColor || "#0ea5e9");
    const allDay = !!payload?.allDay;

    const lieu = String(payload?.lieu || "Studio");
    const commentaires = String(payload?.commentaires || "");

    let start = toDate(payload?.start);
    let end = toDate(payload?.end);

    if (!start) return NextResponse.json({ error: "Start invalide" }, { status: 400 });

    // fallback end
    if (!end) end = allDay ? addDays(startOfDay(start), 1) : start;

    if (allDay) {
      start = startOfDay(start);

      // end stocké EXCLUSIF (standard calendrier)
      const endDay = startOfDay(end);
      end = addDays(endDay, 1);
    } else {
      if (end < start) end = start;
    }

    const doc = {
      branche,
      projet,
      phaseName,
      phaseColor,
      allDay,
      start,
      end,
      lieu,
      commentaires,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection("evenements").insertOne(doc);
    const inserted = await db.collection("evenements").findOne({ _id: res.insertedId });

    logActivity(gate.authz.user, {
      action: "create",
      resource: "evenement",
      resourceLabel: "Événement",
      detail: doc.projet || doc.phaseName || "",
    });

    return NextResponse.json({ item: inserted }, { status: 201 });
  } catch (err) {
    console.error("POST /api/evenements error:", err);
    return NextResponse.json(
      { error: "Erreur POST /api/evenements", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
