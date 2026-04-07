import { auth } from "../../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../../lib/mongodb";
import { getGoogleTokens, hasCalendarScope, listCalendars } from "../../../../../lib/google-calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/planning/google-calendar/calendars
 * Liste les agendas Google Calendar de l'utilisateur.
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
            return Response.json({ error: "Google Calendar non connecté." }, { status: 403 });
        }

        const tokens = await getGoogleTokens(db, userId);
        if (!tokens?.accessToken) {
            return Response.json({ error: "Token Google expiré." }, { status: 403 });
        }

        const calendars = await listCalendars(tokens.accessToken);

        // Récupérer le calendrier sélectionné
        const prefs = await db.collection("user_preferences").findOne({ userId: String(userId) });

        return Response.json({ calendars, selectedCalendarId: prefs?.selectedGcalId || null });
    } catch (error) {
        return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
    }
}

/**
 * POST /api/planning/google-calendar/calendars
 * Sauvegarde le calendrier sélectionné pour l'utilisateur.
 * body: { calendarId }
 */
export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifié." }, { status: 401 });
        }

        const { calendarId } = await request.json();
        if (!calendarId) {
            return Response.json({ error: "calendarId manquant." }, { status: 400 });
        }

        const db = await getDb();
        const userId = String(session.user.id);

        await db.collection("user_preferences").updateOne(
            { userId },
            { $set: { userId, selectedGcalId: calendarId, updatedAt: new Date() } },
            { upsert: true }
        );

        return Response.json({ ok: true });
    } catch (error) {
        return Response.json({ error: String(error?.message || "Erreur serveur.") }, { status: 500 });
    }
}
