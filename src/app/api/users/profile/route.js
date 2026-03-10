import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";
import { toObjectId } from "../../../../lib/rbac-store";

/**
 * GET /api/users/profile
 * Retourne le statut du profil (needsProfile).
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifie." }, { status: 401 });
        }

        const db = await getDb();
        const userId = toObjectId(session.user.id);
        if (!userId) {
            return Response.json({ needsProfile: false });
        }

        const user = await db
            .collection("user")
            .findOne({ _id: userId }, { projection: { needsProfile: 1, firstName: 1, lastName: 1 } });

        if (!user) {
            return Response.json({ needsProfile: false });
        }

        // needsProfile est true si le champ est explicitement true
        // OU si firstName/lastName sont vides
        const needsProfile =
            user.needsProfile === true ||
            !String(user.firstName || "").trim() ||
            !String(user.lastName || "").trim();

        return Response.json({ needsProfile });
    } catch (error) {
        return Response.json(
            { error: String(error?.message || "Erreur serveur.") },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/users/profile
 * Met a jour le prenom et nom de l'utilisateur.
 */
export async function PATCH(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return Response.json({ error: "Non authentifie." }, { status: 401 });
        }

        const body = await request.json();
        const firstName = String(body.firstName || "").trim();
        const lastName = String(body.lastName || "").trim();

        if (!firstName || !lastName) {
            return Response.json(
                { error: "Le prenom et le nom sont obligatoires." },
                { status: 400 }
            );
        }

        const db = await getDb();
        const userId = toObjectId(session.user.id);
        if (!userId) {
            return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
        }

        await db.collection("user").updateOne(
            { _id: userId },
            {
                $set: {
                    firstName,
                    lastName,
                    name: `${firstName} ${lastName}`.trim(),
                    needsProfile: false,
                    updatedAt: new Date(),
                },
            }
        );

        return Response.json({ ok: true });
    } catch (error) {
        return Response.json(
            { error: String(error?.message || "Erreur serveur.") },
            { status: 500 }
        );
    }
}
