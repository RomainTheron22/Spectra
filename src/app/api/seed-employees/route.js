import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";

const EMPLOYEES = [
  { nom: "Bartowicz", prenom: "Tom", email: "tom@fantasmagorie.com", contrat: "cdi", pole: "Direction", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Sasha", prenom: "Laurent", email: "laurent@fantasmagorie.com", contrat: "cdi", pole: "Direction", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Coquillat", prenom: "Fany", email: "fany@fantasmagorie.com", contrat: "cdi", pole: "Administration", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Derhen", prenom: "Derhen", email: "derhen@fantasmagorie.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Mourgue", prenom: "Julie", email: "julie@fantasmagorie.com", contrat: "cdi", pole: "Communication", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Barta", prenom: "Alexis", email: "alexis@creativgen.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "CreativGen", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Coquoin", prenom: "Lucas", email: "lucas@creativgen.com", contrat: "cdi", pole: "Scénographie", entite: "CreativGen", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Josse", prenom: "Clément", email: "clement@creativgen.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "CreativGen", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "SLC", prenom: "Milan", email: "milan.salachas@gmail.com", contrat: "stage", pole: "Production Audiovisuelle", entite: "CreativGen", joursPresence: ["lun","mar","mer","jeu","ven"], dateDebut: "2026-01-15", dateFin: "2026-07-15", congesAnnuels: 12 },
  { nom: "Unterstock", prenom: "Théo", email: "theo.unterstock@gmail.com", contrat: "cdi", pole: "Atelier", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Duret", prenom: "Antoine", email: "a.duret@live.fr", contrat: "cdi", pole: "Atelier", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "L'Heureux", prenom: "Amandyne", email: "amanndynelheureux@gmail.com", contrat: "cdi", pole: "Communication", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Birambeau", prenom: "Lili", email: "lilibirambeau@gmail.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Teale", prenom: "Maïlys", email: "mailys.teale@gmail.com", contrat: "alternance", pole: "Production Audiovisuelle", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer"], dateDebut: "2025-09-01", dateFin: "2026-08-31", congesAnnuels: 15 },
  { nom: "Culié", prenom: "Justine", email: "justineculie5@gmail.com", contrat: "cdi", pole: "FabLab", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Esteben", prenom: "Perrine", email: "perrine.esteben@efap.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Silva", prenom: "Tiago", email: "tiagofs0904@gmail.com", contrat: "stage", pole: "Production Audiovisuelle", entite: "CreativGen", joursPresence: ["lun","mar","mer","jeu","ven"], dateDebut: "2026-02-01", dateFin: "2026-05-31", congesAnnuels: 10 },
  { nom: "Restoux", prenom: "Mathis", email: "restoux.mathis@gmail.com", contrat: "cdi", pole: "Atelier", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Garrigues", prenom: "Lucie", email: "lucie.garrigues@emicparis.com", contrat: "cdi", pole: "Communication", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Daniot", prenom: "Marilou", email: "daniotmarilou@gmail.com", contrat: "alternance", pole: "Communication", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu"], dateDebut: "2025-09-01", dateFin: "2026-06-30", congesAnnuels: 12 },
  { nom: "Charon", prenom: "Ondine", email: "ondinecharon@msn.com", contrat: "stage", pole: "Scénographie", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], dateDebut: "2026-01-01", dateFin: "2026-06-30", congesAnnuels: 10 },
  { nom: "Th", prenom: "Romain", email: "theronone22@gmail.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "CreativGen", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
  { nom: "Zorkot", prenom: "Ahmad", email: "ahmad@creativgen.com", contrat: "alternance", pole: "FabLab", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer"], dateDebut: "2025-09-01", dateFin: "2026-08-31", congesAnnuels: 15 },
  { nom: "Anne", prenom: "Anne", email: "thuanh2128@gmail.com", contrat: "cdi", pole: "Production Audiovisuelle", entite: "Fantasmagorie", joursPresence: ["lun","mar","mer","jeu","ven"], congesAnnuels: 30 },
];

// POST /api/seed-employees — admin only, creates profiles if they don't exist
export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "create" });
  if (!gate.ok) return gate.response;

  const db = await getDb();
  const collection = db.collection("employee_profiles");
  let created = 0;
  let skipped = 0;

  for (const emp of EMPLOYEES) {
    const existing = await collection.findOne({ email: emp.email });
    if (existing) { skipped++; continue; }
    await collection.insertOne({
      ...emp,
      userId: null,
      dateDebut: emp.dateDebut || null,
      dateFin: emp.dateFin || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created++;
  }

  return NextResponse.json({ created, skipped, total: EMPLOYEES.length });
}
