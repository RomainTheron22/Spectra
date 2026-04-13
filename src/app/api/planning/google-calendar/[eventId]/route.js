import { auth } from "../../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../../lib/mongodb";
import { getGoogleTokens, hasCalendarScope, updateEvent, deleteEvent } from "../../../../../lib/google-calendar";

export async function PATCH(request, { params }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return Response.json({ error: "Non authentifié." }, { status: 401 });

    const { eventId } = await params;
    const db = await getDb();
    const userId = session.user.id;

    const connected = await hasCalendarScope(db, userId);
    if (!connected) return Response.json({ error: "Google Calendar non connecté." }, { status: 403 });

    const tokens = await getGoogleTokens(db, userId);
    if (!tokens?.accessToken) return Response.json({ error: "Token expiré." }, { status: 403 });

    const body = await request.json();
    const updated = await updateEvent(tokens.accessToken, eventId, {
      title: body.title,
      start: body.start,
      end: body.end,
      description: body.description,
    });

    return Response.json({ item: updated });
  } catch (error) {
    console.error("[GCal] PATCH error:", error.message || error);
    return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return Response.json({ error: "Non authentifié." }, { status: 401 });

    const { eventId } = await params;
    const db = await getDb();
    const userId = session.user.id;

    const connected = await hasCalendarScope(db, userId);
    if (!connected) return Response.json({ error: "Google Calendar non connecté." }, { status: 403 });

    const tokens = await getGoogleTokens(db, userId);
    if (!tokens?.accessToken) return Response.json({ error: "Token expiré." }, { status: 403 });

    await deleteEvent(tokens.accessToken, eventId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[GCal] DELETE error:", error.message || error);
    return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
  }
}
