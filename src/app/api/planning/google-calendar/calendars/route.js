import { auth } from "../../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../../lib/mongodb";
import { getGoogleTokens, hasCalendarScope, listCalendars } from "../../../../../lib/google-calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/planning/google-calendar/calendars
 * Liste les agendas Google Calendar de l'utilisateur + ceux sélectionnés.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifié." }, { status: 401 });
        }

        const db = await getDb();
        const userId = session.user.id;

        const connected = await hasCalendarScope(db, userId);
        if (!connected) {
            return Response.json({ error: "Google Calendar non connecté.", connected: false }, { status: 403 });
        }

        const tokens = await getGoogleTokens(db, userId);
        if (!tokens?.accessToken) {
            return Response.json({ error: "Token Google expiré.", connected: false }, { status: 403 });
        }

        const calendars = await listCalendars(tokens.accessToken);
        const prefs = await db.collection("user_preferences").findOne({ userId: String(userId) });

        // Support ancien format (string) et nouveau (array)
        let selectedIds = [];
        if (Array.isArray(prefs?.selectedGcalIds)) {
            selectedIds = prefs.selectedGcalIds;
        } else if (prefs?.selectedGcalId) {
            selectedIds = [prefs.selectedGcalId];
        }

        return Response.json({ calendars, selectedIds, connected: true });
    } catch (error) {
        return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
    }
}

/**
 * POST /api/planning/google-calendar/calendars
 * Sauvegarde les calendriers sélectionnés (multi-select).
 * body: { calendarIds: string[] }
 */
export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifié." }, { status: 401 });
        }

        const body = await request.json();
        const calendarIds = Array.isArray(body.calendarIds) ? body.calendarIds : body.calendarId ? [body.calendarId] : [];

        const db = await getDb();
        const userId = String(session.user.id);

        await db.collection("user_preferences").updateOne(
            { userId },
            { $set: { userId, selectedGcalIds: calendarIds, selectedGcalId: calendarIds[0] || "primary", updatedAt: new Date() } },
            { upsert: true }
        );

        return Response.json({ ok: true, selectedIds: calendarIds });
    } catch (error) {
        return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
    }
}
