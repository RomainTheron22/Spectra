/**
 * Utilitaire Google Calendar — API REST v3.
 * Pas de SDK lourd, on utilise fetch directement.
 */

import { ObjectId } from "mongodb";

const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Convertit un id en ObjectId si possible, sinon renvoie null.
 */
function toOid(id) {
    try {
        return new ObjectId(String(id));
    } catch {
        return null;
    }
}

/**
 * Trouve le compte Google dans la collection "account".
 * Essaie avec ObjectId et string pour gerer les deux formats.
 */
async function findGoogleAccount(db, userId) {
    const oid = toOid(userId);
    const strId = String(userId);

    // Essayer d'abord avec ObjectId
    if (oid) {
        const account = await db.collection("account").findOne({
            userId: oid,
            providerId: "google",
        });
        if (account) return account;
    }

    // Sinon essayer avec la string
    const account = await db.collection("account").findOne({
        userId: strId,
        providerId: "google",
    });
    return account || null;
}

/**
 * Recupere le token d'acces Google depuis la collection "account" de better-auth.
 * Rafraichit le token si expire.
 */
export async function getGoogleTokens(db, userId) {
    const account = await findGoogleAccount(db, userId);
    if (!account) return null;

    const now = Date.now();
    const expiresAt = account.accessTokenExpiresAt
        ? new Date(account.accessTokenExpiresAt).getTime()
        : 0;

    // Token encore valide (avec 60s de marge)
    if (account.accessToken && expiresAt > now + 60_000) {
        return {
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
        };
    }

    // Besoin de rafraichir
    if (!account.refreshToken) return null;

    const refreshed = await refreshGoogleToken(
        account.refreshToken,
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    if (!refreshed) return null;

    // Mettre a jour la BDD
    await db.collection("account").updateOne(
        { _id: account._id },
        {
            $set: {
                accessToken: refreshed.access_token,
                accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
                updatedAt: new Date(),
            },
        }
    );

    return {
        accessToken: refreshed.access_token,
        refreshToken: account.refreshToken,
    };
}

async function refreshGoogleToken(refreshToken, clientId, clientSecret) {
    try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Verifie si l'utilisateur a accorde le scope Google Calendar.
 */
export async function hasCalendarScope(db, userId) {
    const account = await findGoogleAccount(db, userId);
    if (!account) return false;

    const scopes = String(account.scope || "");
    return scopes.includes("calendar");
}

/**
 * Liste les agendas Google Calendar de l'utilisateur.
 */
export async function listCalendars(accessToken) {
    const res = await fetch(`${GCAL_BASE}/users/me/calendarList`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Google Calendar list error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return (data.items || []).map((cal) => ({
        id: cal.id,
        summary: cal.summary || cal.id,
        primary: cal.primary === true,
        backgroundColor: cal.backgroundColor || null,
    }));
}

/**
 * Liste les evenements Google Calendar sur une plage donnee.
 */
export async function listEvents(accessToken, timeMin, timeMax, calendarId = "primary") {
    const params = new URLSearchParams({
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
    });

    const res = await fetch(
        `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    );

    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Google Calendar API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return (data.items || []).map(normalizeEvent);
}

/**
 * Cree un evenement dans Google Calendar.
 */
export async function createEvent(accessToken, event, calendarId = "primary") {
    const body = {
        summary: event.title || "Sans titre",
        start: {
            dateTime: new Date(event.start).toISOString(),
            timeZone: event.timeZone || "Europe/Paris",
        },
        end: {
            dateTime: new Date(event.end).toISOString(),
            timeZone: event.timeZone || "Europe/Paris",
        },
    };

    if (event.description) body.description = event.description;

    const res = await fetch(`${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Google Calendar create error: ${res.status} ${err}`);
    }

    return normalizeEvent(await res.json());
}

/**
 * Met a jour un evenement dans Google Calendar.
 */
export async function updateEvent(accessToken, eventId, event) {
    const body = {};
    if (event.title !== undefined) body.summary = event.title;
    if (event.start) {
        body.start = {
            dateTime: new Date(event.start).toISOString(),
            timeZone: event.timeZone || "Europe/Paris",
        };
    }
    if (event.end) {
        body.end = {
            dateTime: new Date(event.end).toISOString(),
            timeZone: event.timeZone || "Europe/Paris",
        };
    }
    if (event.description !== undefined) body.description = event.description;

    const res = await fetch(
        `${GCAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Google Calendar update error: ${res.status} ${err}`);
    }

    return normalizeEvent(await res.json());
}

/**
 * Supprime un evenement dans Google Calendar.
 */
export async function deleteEvent(accessToken, eventId) {
    const res = await fetch(
        `${GCAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    );

    // 204 = supprime, 410 = deja supprime
    if (!res.ok && res.status !== 204 && res.status !== 410) {
        const err = await res.text().catch(() => "");
        throw new Error(`Google Calendar delete error: ${res.status} ${err}`);
    }

    return true;
}

/**
 * Normalise un evenement Google Calendar au format FullCalendar.
 */
function normalizeEvent(gcalEvent) {
    const start =
        gcalEvent.start?.dateTime || gcalEvent.start?.date || null;
    const end =
        gcalEvent.end?.dateTime || gcalEvent.end?.date || null;

    return {
        id: `gcal_${gcalEvent.id}`,
        gcalId: gcalEvent.id,
        title: gcalEvent.summary || "Sans titre",
        start,
        end,
        isGoogleCalendar: true,
        htmlLink: gcalEvent.htmlLink || null,
        description: gcalEvent.description || "",
    };
}
