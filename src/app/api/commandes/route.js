import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";
import {
  buildCommandeDoc,
  isMeaningfulString,
  normalizeCommandeDocument,
} from "../../../lib/commandes";
import { logActivity } from "../../../lib/activity-log";

export async function GET(req) {
  const gate = await requireApiPermission(req, { resource: "commandes", action: "view" });
  if (!gate.ok) return gate.response;

  try {
    const db = await getDb();

    const url = new URL(req.url);
    const fournisseur = String(url.searchParams.get("fournisseur") || "").trim();

    const query = {};
    if (fournisseur) query.fournisseur = fournisseur;

    const docs = await db
      .collection("commandes")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    const normalized = docs.map((doc) => normalizeCommandeDocument(doc));

    return NextResponse.json({ items: normalized }, { status: 200 });
  } catch (err) {
    console.error("GET /api/commandes error:", err);
    return NextResponse.json(
      { error: "Erreur GET /api/commandes", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const gate = await requireApiPermission(req, { resource: "commandes", action: "create" });
  if (!gate.ok) return gate.response;

  try {
    const payload = await req.json();
    const db = await getDb();

    const doc = buildCommandeDoc(payload);

    if (!isMeaningfulString(doc.fournisseur)) {
      return NextResponse.json({ error: "Le fournisseur est obligatoire" }, { status: 400 });
    }

    if (!Array.isArray(doc.produits) || doc.produits.length === 0) {
      return NextResponse.json(
        { error: "Ajoutez au moins un produit dans la commande" },
        { status: 400 }
      );
    }

    const now = new Date();
    const finalDoc = {
      ...doc,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("commandes").insertOne(finalDoc);

    logActivity(gate.authz.user, {
      action: "create",
      resource: "commande",
      resourceLabel: "Commande",
      detail: doc.fournisseur || "",
    });

    return NextResponse.json(
      { item: normalizeCommandeDocument({ ...finalDoc, _id: result.insertedId }) },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/commandes error:", err);
    return NextResponse.json(
      {
        error: "Erreur POST /api/commandes",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  const gate = await requireApiPermission(req, { resource: "commandes", action: "delete" });
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const all = String(url.searchParams.get("all") || "").trim();

    if (all !== "1") {
      return NextResponse.json(
        { error: "Ajoutez ?all=1 pour confirmer la suppression globale" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db.collection("commandes").deleteMany({});

    return NextResponse.json({ ok: true, deletedCount: result.deletedCount }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/commandes error:", err);
    return NextResponse.json(
      {
        error: "Erreur DELETE /api/commandes",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
