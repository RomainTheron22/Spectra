import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireAdmin } from "../../../lib/authz";

export async function GET(request) {
  const gate = await requireAdmin(request, "view");
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const page = url.searchParams.get("page") || "/";

  try {
    const db = await getDb();
    const items = await db
      .collection("pageComments")
      .find({ page })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      items: items.map((c) => ({
        id: String(c._id),
        page: c.page,
        xVw: c.xVw,
        docY: c.docY,
        content: c.content,
        authorId: c.authorId,
        authorName: c.authorName,
        createdAt: c.createdAt,
        resolved: Boolean(c.resolved),
        replies: Array.isArray(c.replies) ? c.replies : [],
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await requireAdmin(request, "create");
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Contenu requis." }, { status: 400 });
  }

  const page = String(body.page || "/").trim();
  const xVw = Number(body.xVw) || 50;
  const docY = Number(body.docY) || 0;

  const user = gate.user;

  try {
    const db = await getDb();
    const now = new Date();
    const result = await db.collection("pageComments").insertOne({
      page,
      xVw,
      docY,
      content,
      authorId: String(user._id),
      authorName: String(user.name || user.email || "Admin"),
      resolved: false,
      replies: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      item: {
        id: String(result.insertedId),
        page,
        xVw,
        docY,
        content,
        authorId: String(user._id),
        authorName: String(user.name || user.email || "Admin"),
        resolved: false,
        replies: [],
        createdAt: now,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
