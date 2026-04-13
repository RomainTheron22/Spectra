import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import { logActivity } from "../../../lib/activity-log";
import { hasPermission } from "../../../lib/rbac";

const COLLECTION = "employee_absences";
const PROFILES_COLLECTION = "employee_profiles";
const VALID_TYPES = ["conge", "tt", "maladie", "absence_autre"];
const VALID_DEMI = ["matin", "apres-midi", null];

function isAdmin(gate) {
  return gate.authz?.role?.name === "admin";
}

export async function GET(request) {
  const gate = await requireApiPermission(request, {
    resource: "employeeAbsences",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeProfileId = searchParams.get("profileId");
  const statut = searchParams.get("statut");
  const type = searchParams.get("type");

  const query = {};
  const viewerId = String(gate.authz?.user?.id || "");
  const all = searchParams.get("all") === "true";

  if (!isAdmin(gate)) {
    query.userId = viewerId;
  } else if (!all && employeeProfileId) {
    query.employeeProfileId = employeeProfileId;
  }

  if (statut) query.statut = statut;
  if (type) query.type = type;

  if (from || to) {
    query.$or = [];
    if (from && to) {
      query.$or.push({ dateDebut: { $lte: to }, dateFin: { $gte: from } });
    } else if (from) {
      query.$or.push({ dateFin: { $gte: from } });
    } else if (to) {
      query.$or.push({ dateDebut: { $lte: to } });
    }
  }

  const db = await getDb();
  const absences = await db.collection(COLLECTION).find(query).sort({ dateDebut: -1 }).toArray();

  return NextResponse.json({ items: absences });
}

export async function POST(request) {
  const gate = await requireApiPermission(request, {
    resource: "employeeAbsences",
    action: "create",
  });
  if (!gate.ok) return gate.response;

  const payload = await request.json();
  const { type, dateDebut, dateFin, demiJournee, commentaire } = payload;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Type invalide. Valeurs : ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: "Les dates de début et fin sont obligatoires." }, { status: 400 });
  }
  if (dateDebut > dateFin) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
  }
  if (demiJournee && !VALID_DEMI.includes(demiJournee)) {
    return NextResponse.json({ error: "demiJournee invalide (matin ou apres-midi)." }, { status: 400 });
  }

  const viewerId = String(gate.authz?.user?.id || "");
  const db = await getDb();

  const profile = await db.collection(PROFILES_COLLECTION).findOne({
    userId: viewerId,
    isActive: { $ne: false },
  });

  const doc = {
    userId: viewerId,
    employeeProfileId: profile ? String(profile._id) : null,
    employeeNom: profile ? `${profile.prenom} ${profile.nom}` : gate.authz?.user?.name || "Inconnu",
    type,
    dateDebut,
    dateFin,
    demiJournee: demiJournee || null,
    statut: "en_attente",
    validePar: null,
    valideAt: null,
    commentaire: (commentaire || "").trim() || null,
    motifRefus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection(COLLECTION).insertOne(doc);

  const typeLabels = { conge: "Congé", tt: "Télétravail", maladie: "Maladie", absence_autre: "Absence" };
  logActivity(gate.authz.user, {
    action: "create",
    resource: "employeeAbsences",
    resourceLabel: `${typeLabels[type] || type} — ${doc.employeeNom}`,
    detail: `${dateDebut} → ${dateFin}${demiJournee ? ` (${demiJournee})` : ""}`,
  });

  return NextResponse.json({ item: { _id: result.insertedId, ...doc } }, { status: 201 });
}
