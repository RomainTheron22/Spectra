import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import { logActivity } from "../../../lib/activity-log";

const COLLECTION = "employee_profiles";

const VALID_CONTRATS = ["cdi", "cdd", "alternance", "stage"];
const VALID_JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const VALID_POLES = [
  "Communication",
  "Scénographie",
  "Atelier",
  "FabLab",
  "Production Audiovisuelle",
  "Administration",
  "Direction",
];
const VALID_ENTITES = ["CreativGen", "Fantasmagorie"];

export async function GET(request) {
  const gate = await requireApiPermission(request, {
    resource: "employeeProfiles",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";
  const mine = searchParams.get("mine") === "true";

  const query = activeOnly ? { isActive: { $ne: false } } : {};

  if (mine) {
    const viewerId = String(gate.authz?.user?.id || "");
    query.userId = viewerId;
  }

  const profiles = await db.collection(COLLECTION).find(query).sort({ nom: 1 }).toArray();

  return NextResponse.json({ items: profiles });
}

export async function POST(request) {
  const gate = await requireApiPermission(request, {
    resource: "employeeProfiles",
    action: "create",
  });
  if (!gate.ok) return gate.response;

  const payload = await request.json();
  const { userId, nom, prenom, email, contrat, joursPresence, dateDebut, dateFin, pole, entite, congesAnnuels } = payload;

  if (!nom || !prenom || !contrat) {
    return NextResponse.json({ error: "Nom, prénom et type de contrat sont obligatoires." }, { status: 400 });
  }
  if (!VALID_CONTRATS.includes(contrat)) {
    return NextResponse.json({ error: `Contrat invalide. Valeurs : ${VALID_CONTRATS.join(", ")}` }, { status: 400 });
  }
  if (joursPresence && !Array.isArray(joursPresence)) {
    return NextResponse.json({ error: "joursPresence doit être un tableau." }, { status: 400 });
  }
  if (joursPresence && joursPresence.some((j) => !VALID_JOURS.includes(j))) {
    return NextResponse.json({ error: `Jours invalides. Valeurs : ${VALID_JOURS.join(", ")}` }, { status: 400 });
  }

  const doc = {
    userId: userId || null,
    nom: nom.trim(),
    prenom: prenom.trim(),
    email: (email || "").trim() || null,
    contrat,
    joursPresence: joursPresence || ["lun", "mar", "mer", "jeu", "ven"],
    dateDebut: dateDebut || null,
    dateFin: dateFin || null,
    pole: pole || null,
    entite: entite || null,
    congesAnnuels: typeof congesAnnuels === "number" ? congesAnnuels : 25,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const db = await getDb();
  const result = await db.collection(COLLECTION).insertOne(doc);

  logActivity(gate.authz.user, {
    action: "create",
    resource: "employeeProfiles",
    resourceLabel: `${doc.prenom} ${doc.nom}`,
    detail: `Contrat: ${doc.contrat}, Pôle: ${doc.pole || "—"}`,
  });

  return NextResponse.json({ item: { _id: result.insertedId, ...doc } }, { status: 201 });
}
