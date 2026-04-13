import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

const COLLECTION = "employee_profiles";

function toObjectId(id) {
  try { return new ObjectId(id); } catch { return null; }
}

export async function GET(request, { params }) {
  const gate = await requireApiPermission(request, {
    resource: "employeeProfiles",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  const profile = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

  return NextResponse.json({ item: profile });
}

export async function PATCH(request, { params }) {
  const gate = await requireApiPermission(request, {
    resource: "employeeProfiles",
    action: "edit",
  });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const payload = await request.json();

  const VALID_CONTRATS = ["cdi", "cdd", "alternance", "stage"];
  const VALID_JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

  if (payload.contrat && !VALID_CONTRATS.includes(payload.contrat)) {
    return NextResponse.json({ error: `Contrat invalide. Valeurs : ${VALID_CONTRATS.join(", ")}` }, { status: 400 });
  }
  if (payload.joursPresence) {
    if (!Array.isArray(payload.joursPresence)) {
      return NextResponse.json({ error: "joursPresence doit être un tableau." }, { status: 400 });
    }
    if (payload.joursPresence.some((j) => !VALID_JOURS.includes(j))) {
      return NextResponse.json({ error: `Jours invalides. Valeurs : ${VALID_JOURS.join(", ")}` }, { status: 400 });
    }
  }

  const updates = {};
  const allowed = ["userId", "nom", "prenom", "email", "contrat", "joursPresence", "dateDebut", "dateFin", "pole", "entite", "congesAnnuels", "isActive"];

  for (const key of allowed) {
    if (key in payload) updates[key] = payload[key];
  }
  updates.updatedAt = new Date();

  const db = await getDb();
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: oid },
    { $set: updates },
    { returnDocument: "after" }
  );

  if (!result) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

  logActivity(gate.authz.user, {
    action: "update",
    resource: "employeeProfiles",
    resourceLabel: `${result.prenom} ${result.nom}`,
  });

  return NextResponse.json({ item: result });
}

export async function DELETE(request, { params }) {
  const gate = await requireApiPermission(request, {
    resource: "employeeProfiles",
    action: "delete",
  });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  const profile = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

  await db.collection(COLLECTION).updateOne({ _id: oid }, { $set: { isActive: false, updatedAt: new Date() } });

  logActivity(gate.authz.user, {
    action: "delete",
    resource: "employeeProfiles",
    resourceLabel: `${profile.prenom} ${profile.nom}`,
  });

  return NextResponse.json({ success: true });
}
