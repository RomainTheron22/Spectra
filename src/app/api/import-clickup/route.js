import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";

// Map ClickUp space IDs to branches
const SPACE_BRANCH_MAP = {
  "90156824042": "Agency",
  "90156988518": "Entertainment",
  "90156493019": "CreativeGen",
  "901510252670": "Atelier",
  "90156493007": "Communication",
};

// Map ClickUp user IDs to emails
const CLICKUP_USER_MAP = {
  "230682200": "tom@fantasmagorie.com",
  "266491285": "laurent@fantasmagorie.com",
  "242582106": "fany@fantasmagorie.com",
  "100586730": "derhen@fantasmagorie.com",
  "100586731": "julie@fantasmagorie.com",
  "100635149": "alexis@creativgen.com",
  "278421638": "lucas@creativgen.com",
  "278429857": "clement@creativgen.com",
  "100586735": "milan.salachas@gmail.com",
  "100636109": "theo.unterstock@gmail.com",
  "100645458": "a.duret@live.fr",
  "100636108": "amanndynelheureux@gmail.com",
  "100586732": "lilibirambeau@gmail.com",
  "100636106": "mailys.teale@gmail.com",
  "100586738": "justineculie5@gmail.com",
  "100503771": "perrine.esteben@efap.com",
  "100502754": "tiagofs0904@gmail.com",
  "100603937": "restoux.mathis@gmail.com",
  "106557403": "lucie.garrigues@emicparis.com",
  "106671797": "daniotmarilou@gmail.com",
  "290502102": "ondinecharon@msn.com",
  "278405752": "theronone22@gmail.com",
};

/**
 * POST /api/import-clickup
 * body: { tasks: [...] } — les tâches ClickUp à importer
 *
 * Chaque tâche est convertie en contrat Spectra si elle a un due_date.
 * Les assignees sont mappées via CLICKUP_USER_MAP.
 */
export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "create" });
  if (!gate.ok) return gate.response;

  const payload = await request.json();
  const tasks = payload.tasks || [];
  if (!tasks.length) return NextResponse.json({ error: "Aucune tâche fournie" }, { status: 400 });

  const db = await getDb();
  const collection = db.collection("contrats");
  let imported = 0;
  let skipped = 0;

  for (const task of tasks) {
    // Check si déjà importé (par clickupId)
    const existing = await collection.findOne({ clickupId: task.id });
    if (existing) { skipped++; continue; }

    // Déterminer la branche depuis le space
    const branche = task.space?.id ? (SPACE_BRANCH_MAP[task.space.id] || "—") : (task.list?.name || "—");

    // Convertir les assignees
    const assignees = (task.assignees || []).map((a) => {
      const email = CLICKUP_USER_MAP[String(a.id)];
      return email || String(a.id);
    });

    // Due date → dateFin, start date → dateDebut
    const dateFin = task.due_date ? new Date(parseInt(task.due_date)).toISOString().slice(0, 10) : null;
    const dateDebut = task.start_date ? new Date(parseInt(task.start_date)).toISOString().slice(0, 10) : (dateFin || null);

    const doc = {
      nomContrat: task.name || "Sans nom",
      clientNom: "",
      branche,
      lieu: "",
      statut: task.status?.status || task.status || "En cours",
      dateDebut: dateDebut || new Date().toISOString().slice(0, 10),
      dateFin: dateFin || new Date().toISOString().slice(0, 10),
      brief: "",
      assignees,
      files: [],
      clickupId: task.id,
      clickupUrl: task.url || null,
      clickupListName: task.list?.name || null,
      priority: task.priority?.priority || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await collection.insertOne(doc);
    imported++;
  }

  return NextResponse.json({ imported, skipped, total: tasks.length });
}

/**
 * GET /api/import-clickup
 * Retourne les mappings et stats pour la page admin
 */
export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "view" });
  if (!gate.ok) return gate.response;

  const db = await getDb();
  const importedCount = await db.collection("contrats").countDocuments({ clickupId: { $exists: true, $ne: null } });
  const totalContrats = await db.collection("contrats").countDocuments({});

  return NextResponse.json({
    importedFromClickup: importedCount,
    totalContrats,
    spaceBranchMap: SPACE_BRANCH_MAP,
    userMap: CLICKUP_USER_MAP,
  });
}
