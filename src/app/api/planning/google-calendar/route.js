import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";
import {
    getGoogleTokens,
    hasCalendarScope,
    listEvents,
    createEvent,
} from "../../../../lib/google-calendar";

/**
 * GET /api/planning/google-calendar
 *   ?from=ISO&to=ISO  → liste les evenements Google Calendar
 *   ?check=1          → verifie si le scope est accorde
 */
export async function GET(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifie." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const db = await getDb();
        const userId = session.user.id;

        // Check connection via la fonction utilitaire (supporte ObjectId + string)
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
            return Response.json(
                { error: "Parametres 'from' et 'to' requis." },
                { status: 400 }
            );
        }

        const tokens = await getGoogleTokens(db, userId);
        if (!tokens?.accessToken) {
            return Response.json({ items: [], connected: false });
        }

        const events = await listEvents(tokens.accessToken, from, to);
        return Response.json({ items: events, connected: true });
    } catch (error) {
        console.error("[GCal] GET error:", error.message || error);
        return Response.json(
            { error: String(error?.message || "Erreur serveur.") },
            { status: 500 }
        );
    }
}

/**
 * POST /api/planning/google-calendar
 *   body: { title, start, end, description? }
 *   → cree un evenement dans Google Calendar
 */
export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifie." }, { status: 401 });
        }

        const db = await getDb();
        const userId = session.user.id;

        const connected = await hasCalendarScope(db, userId);
        if (!connected) {
            return Response.json(
                { error: "Google Calendar non connecte." },
                { status: 403 }
            );
        }

        const tokens = await getGoogleTokens(db, userId);
        if (!tokens?.accessToken) {
            return Response.json(
                { error: "Token Google expire ou manquant." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const event = await createEvent(tokens.accessToken, {
            title: body.title,
            start: body.start,
            end: body.end,
            description: body.description || "",
        });

        return Response.json({ item: event });
    } catch (error) {
        console.error("[GCal] POST error:", error.message || error);
        return Response.json(
            { error: String(error?.message || "Erreur serveur.") },
            { status: 500 }
        );
    }
}
