import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { requireApiPermission } from "../../../lib/authz";

const COLLECTION = "branches";

const DEFAULT_BRANCHES = [
  { key: "Agency", label: "Agency", color: "#e11d48", description: "Production audiovisuelle, films, clips, podcasts", poles: ["Production Audiovisuelle"], gcalKeyword: "agency" },
  { key: "CreativeGen", label: "CreativeGen", color: "#7c3aed", description: "Studio podcast, vidéo, coaching, décors", poles: ["Production Audiovisuelle", "Scénographie"], gcalKeyword: "creativgen" },
  { key: "Entertainment", label: "Entertainment", color: "#0891b2", description: "Scénographie, événements, spectacles, expos", poles: ["Scénographie", "Atelier"], gcalKeyword: "entertainment" },
  { key: "SFX", label: "SFX", color: "#ca8a04", description: "Effets spéciaux, installations créatives", poles: ["FabLab", "Atelier"], gcalKeyword: "sfx" },
  { key: "Atelier", label: "Atelier", color: "#059669", description: "FabLab, construction décors, prototypage", poles: ["Atelier", "FabLab"], gcalKeyword: "atelier" },
  { key: "Communication", label: "Communication", color: "#0284c7", description: "Stratégie com, personal branding, réseaux", poles: ["Communication"], gcalKeyword: "communication" },
];

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "view" });
  if (!gate.ok) return gate.response;

  const db = await getDb();
  let branches = await db.collection(COLLECTION).find({}).sort({ order: 1, label: 1 }).toArray();

  // Auto-seed si vide
  if (branches.length === 0) {
    const docs = DEFAULT_BRANCHES.map((b, i) => ({ ...b, order: i, isActive: true, createdAt: new Date(), updatedAt: new Date() }));
    await db.collection(COLLECTION).insertMany(docs);
    branches = docs;
  }

  return NextResponse.json({ items: branches });
}

export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "admin", action: "create" });
  if (!gate.ok) return gate.response;

  const payload = await request.json();
  if (!payload.key || !payload.label) {
    return NextResponse.json({ error: "key et label sont obligatoires" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection(COLLECTION).findOne({ key: payload.key });
  if (existing) return NextResponse.json({ error: "Cette branche existe déjà" }, { status: 400 });

  const doc = {
    key: payload.key,
    label: payload.label,
    color: payload.color || "#6b7280",
    description: payload.description || "",
    poles: payload.poles || [],
    gcalKeyword: payload.gcalKeyword || payload.key.toLowerCase(),
    order: payload.order ?? 99,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection(COLLECTION).insertOne(doc);
  return NextResponse.json({ item: { _id: result.insertedId, ...doc } }, { status: 201 });
}
