import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";

/**
 * GET /api/planning-dashboard
 * Endpoint agrégé pour Cockpit — données compilées en une seule requête.
 * Pas d'auth requise si on utilise un token API (futur) ou si c'est appelé côté serveur.
 * Pour l'instant, public pour le dev.
 */
export async function GET() {
  try {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    // Profils actifs
    const profiles = await db.collection("employee_profiles").find({ isActive: { $ne: false } }).toArray();

    // Absences validées du mois
    const monthStart = today.slice(0, 8) + "01";
    const absences = await db.collection("employee_absences").find({
      statut: "valide",
      dateFin: { $gte: monthStart },
    }).toArray();

    // Absences en attente
    const pending = await db.collection("employee_absences").find({ statut: "en_attente" }).toArray();

    // Projets actifs (en cours aujourd'hui)
    const activeProjects = await db.collection("contrats").find({
      dateDebut: { $lte: today },
      dateFin: { $gte: today },
    }).toArray();

    // Projets à venir (7 prochains jours)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingProjects = await db.collection("contrats").find({
      dateDebut: { $gt: today, $lte: nextWeek.toISOString().slice(0, 10) },
    }).toArray();

    // Fins de contrat < 60 jours
    const sixtyDays = new Date();
    sixtyDays.setDate(sixtyDays.getDate() + 60);
    const expiringContracts = profiles.filter((p) => p.dateFin && p.dateFin <= sixtyDays.toISOString().slice(0, 10) && p.dateFin >= today);

    // Absents aujourd'hui
    const todayAbsent = absences.filter((a) => a.dateDebut <= today && a.dateFin >= today);
    const todayPresent = profiles.length - todayAbsent.length;

    // Charge par branche
    const branches = {};
    for (const p of activeProjects) {
      const b = p.branche || "—";
      if (!branches[b]) branches[b] = { active: 0, total: 0 };
      branches[b].active++;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      team: {
        total: profiles.length,
        present: todayPresent,
        absent: todayAbsent.length,
        absentList: todayAbsent.map((a) => ({
          employeeNom: a.employeeNom,
          type: a.type,
          dateDebut: a.dateDebut,
          dateFin: a.dateFin,
        })),
      },
      absences: {
        pending: pending.length,
        pendingList: pending.map((a) => ({
          id: String(a._id),
          employeeNom: a.employeeNom,
          type: a.type,
          dateDebut: a.dateDebut,
          dateFin: a.dateFin,
        })),
      },
      projects: {
        active: activeProjects.length,
        activeList: activeProjects.map((p) => ({
          id: String(p._id),
          nom: p.nomContrat || p.nom,
          branche: p.branche,
          dateDebut: p.dateDebut,
          dateFin: p.dateFin,
          statut: p.statut,
          assignees: p.assignees?.length || 0,
        })),
        upcoming: upcomingProjects.length,
        upcomingList: upcomingProjects.map((p) => ({
          nom: p.nomContrat || p.nom,
          branche: p.branche,
          dateDebut: p.dateDebut,
        })),
      },
      alerts: {
        expiringContracts: expiringContracts.map((p) => ({
          nom: `${p.prenom} ${p.nom}`,
          contrat: p.contrat,
          dateFin: p.dateFin,
          daysLeft: Math.ceil((new Date(p.dateFin) - new Date()) / 86400000),
        })),
      },
      chargeByBranch: branches,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || "Erreur") }, { status: 500 });
  }
}
