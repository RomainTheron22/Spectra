import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";
import {
    getGoogleTokens,
    hasCalendarScope,
    listEvents,
    createEvent,
} from "../../../../lib/google-calendar";

async function getSelectedCalendarIds(db, userId) {
    const prefs = await db.collection("user_preferences").findOne({ userId: String(userId) });
    if (Array.isArray(prefs?.selectedGcalIds) && prefs.selectedGcalIds.length > 0) {
        return prefs.selectedGcalIds;
    }
    if (prefs?.selectedGcalId) return [prefs.selectedGcalId];
    return ["primary"];
}

/**
 * GET /api/planning/google-calendar
 *   ?from=ISO&to=ISO  → liste les events de TOUS les calendriers sélectionnés
 *   ?check=1          → vérifie si le scope est accordé
 */
export async function GET(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const db = await getDb();
        const userId = session.user.id;

        const connected = await hasCalendarScope(db, userId);

        if (searchParams.get("check") === "1") {
            return Response.json({ connected });
        }

        if (!connected) {
            return Response.json({ items: [], connected: false });
        }

        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (!from || !to) {
            return Response.json({ error: "Paramètres 'from' et 'to' requis." }, { status: 400 });
        }

        const tokens = await getGoogleTokens(db, userId);
        if (!tokens?.accessToken) {
            return Response.json({ items: [], connected: false });
        }

        const calendarIds = await getSelectedCalendarIds(db, userId);

        // Fetch tous les calendriers en parallèle
        const results = await Promise.allSettled(
            calendarIds.map(async (calId) => {
                const events = await listEvents(tokens.accessToken, from, to, calId);
                return events.map((ev) => ({ ...ev, calendarId: calId }));
            })
        );

        const allEvents = results
            .filter((r) => r.status === "fulfilled")
            .flatMap((r) => r.value);

        return Response.json({ items: allEvents, connected: true });
    } catch (error) {
        console.error("[GCal] GET error:", error.message || error);
        return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
    }
}

/**
 * POST /api/planning/google-calendar
 *   body: { title, start, end, description?, calendarId? }
 */
export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifié." }, { status: 401 });
        }

        const db = await getDb();
        const userId = session.user.id;

        const connected = await hasCalendarScope(db, userId);
        if (!connected) {
            return Response.json({ error: "Google Calendar non connecté." }, { status: 403 });
        }

        const tokens = await getGoogleTokens(db, userId);
        if (!tokens?.accessToken) {
            return Response.json({ error: "Token Google expiré ou manquant." }, { status: 403 });
        }

        const body = await request.json();
        const calendarIds = await getSelectedCalendarIds(db, userId);
        const targetCalId = body.calendarId || calendarIds[0] || "primary";

        const event = await createEvent(tokens.accessToken, {
            title: body.title,
            start: body.start,
            end: body.end,
            description: body.description || "",
            location: body.location || "",
            attendees: body.attendees || [],
            allDay: body.allDay || false,
        }, targetCalId);

        return Response.json({ item: { ...event, calendarId: targetCalId } });
    } catch (error) {
        console.error("[GCal] POST error:", error.message || error);
        return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
    }
}
