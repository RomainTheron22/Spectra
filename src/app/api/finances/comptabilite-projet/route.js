import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import {
  buildProjectOptions,
  buildProjectsDataset,
  projectMatchesFilters,
  sortProjectSummaries,
  summarizeProject,
  toPeriodRange,
} from "../../../../lib/comptabiliteProjet";

function readInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req) {
  const gate = await requireApiPermission(req, { resource: "comptabiliteProjet", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();
    const url = new URL(req.url);

    const search = String(url.searchParams.get("q") || "").trim();
    const client = String(url.searchParams.get("client") || "all").trim();
    const statut = String(url.searchParams.get("statut") || "all").trim();
    const year = readInt(url.searchParams.get("year"), null);
    const dateFrom = String(url.searchParams.get("dateFrom") || "").trim();
    const dateTo = String(url.searchParams.get("dateTo") || "").trim();
    const sort = String(url.searchParams.get("sort") || "totalDesc").trim();
    const page = Math.max(1, readInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, readInt(url.searchParams.get("pageSize"), 20)));

    const [contrats, commandes, prestataires] = await Promise.all([
      db
        .collection("contrats")
        .find({})
        .project({
          nomContrat: 1,
          clientNom: 1,
          statut: 1,
          dateDebut: 1,
          dateFin: 1,
          budgetPrevisionnel: 1,
          budget: 1,
          budgetTotal: 1,
        })
        .toArray(),
      db
        .collection("commandes")
        .find({
          $or: [
            { projet: { $ne: "" } },
            { "produits.projet": { $ne: "" } },
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
        .find({})
        .project({
          _id: 1,
          prenom: 1,
          nom: 1,
          missions: 1,
        })
        .toArray(),
    ]);

    const projects = buildProjectsDataset({ contrats, commandes, prestataires });
    const options = buildProjectOptions(projects);
    const period = toPeriodRange({ year, dateFrom, dateTo });

    const summaries = projects
      .filter((project) => projectMatchesFilters(project, { search, client, statut }))
      .map((project) => summarizeProject(project, period))
      .filter((item) => (!period.hasPeriodFilter ? true : item.hasSignalInPeriod));

    const sorted = sortProjectSummaries(summaries, sort);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return NextResponse.json(
      {
        items,
        meta: {
          page: safePage,
          pageSize,
          total,
          totalPages,
          options,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/finances/comptabilite-projet error:", err);
    return NextResponse.json(
      {
        error: "Erreur GET /api/finances/comptabilite-projet",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
