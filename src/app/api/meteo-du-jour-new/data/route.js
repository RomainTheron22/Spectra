import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../../lib/mongodb";
import { ROLE_NAMES } from "../../../../lib/rbac";

export const dynamic = "force-dynamic";

const DEFAULT_ESPACES = () => [
  { id: "atelier", name: "Atelier", projets: [] },
  { id: "studio",  name: "Studio",  projets: [] },
  { id: "bureau",  name: "Bureau",  projets: [] },
  { id: "fablab",  name: "Fablab",  projets: [] },
];

const DEFAULT_DATA = (date) => ({
  date,
  energie: { type: "challenge", title: "Énergie du jour", body: "" },
  rdvs: [],
  citation: { label: "Citation", text: "" },
  espaces: DEFAULT_ESPACES(),
});

export async function GET(request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

    const date = new URL(request.url).searchParams.get("date");
    if (!date) return Response.json({ error: "Paramètre date manquant" }, { status: 400 });

    const db = await getDb();
    const doc = await db.collection("meteo_quotidien_data").findOne({ date });

    return Response.json({ data: doc ?? DEFAULT_DATA(date) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });
    if (session.user?.role !== ROLE_NAMES.ADMIN)
      return Response.json({ error: "Réservé aux admins" }, { status: 403 });

    const body = await request.json();
    const { date, energie, rdvs, citation, espaces } = body;
    if (!date) return Response.json({ error: "date manquante" }, { status: 400 });

    const db = await getDb();
    await db.collection("meteo_quotidien_data").updateOne(
      { date },
      {
        $set: {
          date, energie, rdvs, citation, espaces,
          updatedAt: new Date(),
          updatedBy: session.user.email,
        },
      },
      { upsert: true }
    );

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
