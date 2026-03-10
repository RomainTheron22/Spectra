import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongodb";
import { requireApiPermission } from "../../../../../lib/authz";
import {
  buildProjectsDataset,
  summarizeProject,
  toPeriodRange,
} from "../../../../../lib/comptabiliteProjet";

function getProjectParam(request, context) {
  let raw = context?.params?.projet;
  if (!raw) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    raw = parts[parts.length - 1];
  }
  return decodeURIComponent(String(raw || "").trim());
}

export async function GET(request, context) {
  const gate = await requireApiPermission(request, { resource: "comptabiliteProjet", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const projet = getProjectParam(request, context);
    if (!projet) {
      return NextResponse.json({ error: "Projet manquant" }, { status: 400 });
    }

    const db = await getDb();

    const [contrat, commandes, prestataires] = await Promise.all([
      db
        .collection("contrats")
        .findOne(
          { nomContrat: projet },
          {
            projection: {
              nomContrat: 1,
              clientNom: 1,
              statut: 1,
              dateDebut: 1,
              dateFin: 1,
              budgetPrevisionnel: 1,
              budget: 1,
              budgetTotal: 1,
            },
          }
        ),
      db
        .collection("commandes")
        .find({
          $or: [
            { projet },
            { "produits.projet": projet },
          ],
        })
        .project({
          _id: 1,
          projet: 1,
          dateCreation: 1,
          createdAt: 1,
          fournisseur: 1,
          produit: 1,
          description: 1,
          status: 1,
          numeroFacture: 1,
          categories: 1,
          typeDepense: 1,
          type: 1,
          prixTotalHT: 1,
          fraisLivraison: 1,
          produits: 1,
        })
        .toArray(),
      db
        .collection("prestataires")
        .find({ "missions.projet": projet })
        .project({
          _id: 1,
          prenom: 1,
          nom: 1,
          missions: 1,
        })
        .toArray(),
    ]);

    const projects = buildProjectsDataset({
      contrats: contrat ? [contrat] : [{ nomContrat: projet }],
      commandes,
      prestataires,
    });

    const project = projects.find((item) => String(item.nomProjet) === projet);
    if (!project) {
      return NextResponse.json(
        {
          project: {
            nomProjet: projet,
            clientNom: "",
            statut: "",
            dateDebut: "",
            dateFin: "",
            budgetPrevisionnel: null,
          },
          commandes: [],
          missions: [],
          totals: {
            totalCommandes: 0,
            totalPrestataires: 0,
            totalDepense: 0,
            nbCommandes: 0,
            nbMissions: 0,
            nbEntrees: 0,
          },
        },
        { status: 200 }
      );
    }

    const summary = summarizeProject(project, toPeriodRange({}));

    return NextResponse.json(
      {
        project: {
          nomProjet: summary.nomProjet,
          clientNom: summary.clientNom,
          statut: summary.statut,
          dateDebut: summary.dateDebut,
          dateFin: summary.dateFin,
          budgetPrevisionnel: summary.budgetPrevisionnel,
          pctBudget: summary.pctBudget,
        },
        commandes: summary.commandes,
        missions: summary.missions,
        totals: {
          totalCommandes: summary.totalCommandes,
          totalPrestataires: summary.totalPrestataires,
          totalDepense: summary.totalDepense,
          nbCommandes: summary.nbCommandes,
          nbMissions: summary.nbMissions,
          nbEntrees: summary.nbEntrees,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/finances/comptabilite-projet/[projet] error:", err);
    return NextResponse.json(
      {
        error: "Erreur GET /api/finances/comptabilite-projet/[projet]",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
