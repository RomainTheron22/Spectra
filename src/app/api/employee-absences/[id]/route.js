import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

const COLLECTION = "employee_absences";

function toObjectId(id) {
  try { return new ObjectId(id); } catch { return null; }
}

function isAdmin(gate) {
  return gate.authz?.role?.name === "admin";
}

export async function GET(request, { params }) {
  const gate = await requireApiPermission(request, {
    resource: "employeeAbsences",
    action: "view",
  });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  const absence = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!absence) return NextResponse.json({ error: "Absence non trouvée" }, { status: 404 });

  const viewerId = String(gate.authz?.user?.id || "");
  if (!isAdmin(gate) && absence.userId !== viewerId) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  return NextResponse.json({ item: absence });
}

export async function PATCH(request, { params }) {
  const gate = await requireApiPermission(request, {
    resource: "employeeAbsences",
    action: "edit",
  });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  const absence = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!absence) return NextResponse.json({ error: "Absence non trouvée" }, { status: 404 });

  const payload = await request.json();
  const viewerId = String(gate.authz?.user?.id || "");
  const admin = isAdmin(gate);

  // Admin peut valider/refuser
  if (payload.statut && admin) {
    const updates = { updatedAt: new Date() };

    if (payload.statut === "valide") {
      updates.statut = "valide";
      updates.validePar = viewerId;
      updates.valideAt = new Date();
      updates.motifRefus = null;
    } else if (payload.statut === "refuse") {
      if (!payload.motifRefus || !payload.motifRefus.trim()) {
        return NextResponse.json({ error: "Le motif de refus est obligatoire." }, { status: 400 });
      }
      updates.statut = "refuse";
      updates.validePar = viewerId;
      updates.valideAt = new Date();
      updates.motifRefus = payload.motifRefus.trim();
    } else {
      return NextResponse.json({ error: "Statut invalide (valide ou refuse)." }, { status: 400 });
    }

    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: "after" }
    );

    const action = payload.statut === "valide" ? "Validé" : "Refusé";
    logActivity(gate.authz.user, {
      action: "update",
      resource: "employeeAbsences",
      resourceLabel: `${action} — ${absence.employeeNom}`,
      detail: `${absence.type} ${absence.dateDebut} → ${absence.dateFin}`,
    });

    return NextResponse.json({ item: result });
  }

  // L'employé peut modifier sa propre demande si encore en_attente ET date pas passée
  const todayStr = new Date().toISOString().slice(0, 10);
  if (absence.userId === viewerId && absence.statut === "en_attente" && absence.dateDebut >= todayStr) {
    const allowed = ["type", "dateDebut", "dateFin", "demiJournee", "commentaire"];
    const updates = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in payload) updates[key] = payload[key];
    }

    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: "after" }
    );

    return NextResponse.json({ item: result });
  }

  return NextResponse.json({ error: "Modification non autorisée." }, { status: 403 });
}

export async function DELETE(request, { params }) {
  const gate = await requireApiPermission(request, {
    resource: "employeeAbsences",
    action: "delete",
  });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const db = await getDb();
  const absence = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!absence) return NextResponse.json({ error: "Absence non trouvée" }, { status: 404 });

  const viewerId = String(gate.authz?.user?.id || "");
  if (!isAdmin(gate) && absence.userId !== viewerId) {
    return NextResponse.json({ error: "Suppression non autorisée." }, { status: 403 });
  }
  if (!isAdmin(gate) && absence.statut !== "en_attente") {
    return NextResponse.json({ error: "Impossible de supprimer une absence déjà traitée." }, { status: 400 });
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!isAdmin(gate) && absence.dateDebut < todayStr) {
    return NextResponse.json({ error: "Impossible de supprimer une absence passée." }, { status: 400 });
  }

  await db.collection(COLLECTION).deleteOne({ _id: oid });

  logActivity(gate.authz.user, {
    action: "delete",
    resource: "employeeAbsences",
    resourceLabel: `${absence.employeeNom}`,
    detail: `${absence.type} ${absence.dateDebut} → ${absence.dateFin}`,
  });

  return NextResponse.json({ success: true });
}
