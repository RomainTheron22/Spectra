import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";

const SETUP_PASSWORD = "2212";

// MONGODB_URI/DB ne peuvent pas être modifiées depuis l'UI (dépendance bootstrap)
const ENV_VARS = [
  {
    key: "MONGODB_URI",
    label: "MongoDB URI",
    description: "Chaine de connexion MongoDB Atlas.",
    hint: "Format : mongodb+srv://user:pass@cluster.mongodb.net — doit être définie dans la plateforme.",
    category: "Base de données",
    sensitive: true,
    required: true,
    canSetInDb: false,
    needsRestart: false,
  },
  {
    key: "MONGODB_DB",
    label: "MongoDB Database",
    description: "Nom de la base de données utilisée.",
    hint: "Exemple : spectra",
    category: "Base de données",
    sensitive: false,
    required: true,
    canSetInDb: false,
    needsRestart: false,
  },
  {
    key: "BETTER_AUTH_URL",
    label: "URL de l'application",
    description: "URL complète de l'app. Doit correspondre exactement au domaine de déploiement.",
    hint: "Exemple : https://spectra.up.railway.app",
    category: "Authentification",
    sensitive: false,
    required: true,
    canSetInDb: true,
    needsRestart: true,
  },
  {
    key: "ADMIN_EMAIL",
    label: "Email administrateur",
    description: "Email du compte avec le rôle admin.",
    hint: "Exemple : admin@entreprise.com",
    category: "Authentification",
    sensitive: false,
    required: true,
    canSetInDb: true,
    needsRestart: true,
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google Client ID",
    description: "Identifiant client OAuth Google (Google Cloud Console).",
    hint: "Format : xxxxxxxxx.apps.googleusercontent.com",
    category: "OAuth Google",
    sensitive: true,
    required: true,
    canSetInDb: true,
    needsRestart: true,
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google Client Secret",
    description: "Secret OAuth Google.",
    hint: "Défini dans Google Cloud Console → Identifiants → OAuth 2.0",
    category: "OAuth Google",
    sensitive: true,
    required: true,
    canSetInDb: true,
    needsRestart: true,
  },
];

function maskValue(value) {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 5) + "•••••" + value.slice(-4);
}

function checkPassword(request) {
  return (request.headers.get("x-setup-password") || "") === SETUP_PASSWORD;
}

export async function GET(request) {
  if (!checkPassword(request)) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  // Lire les overrides stockés en base
  let dbOverrides = {};
  try {
    const db = await getDb();
    const configs = await db.collection("app_config").find({}).toArray();
    for (const c of configs) {
      dbOverrides[c.key] = c.value;
    }
  } catch {
    // MongoDB peut ne pas être accessible — on continue avec process.env
  }

  const items = ENV_VARS.map(({ key, label, description, hint, category, sensitive, required, canSetInDb, needsRestart }) => {
    const raw = process.env[key] || "";
    const isSet = raw.length > 0;
    const hasDbOverride = key in dbOverrides;
    const isLocalhost = !sensitive && isSet && raw.includes("localhost");

    return {
      key,
      label,
      description,
      hint,
      category,
      sensitive,
      required,
      canSetInDb,
      needsRestart,
      isSet,
      isLocalhost,
      hasDbOverride,
      value: isSet ? (sensitive ? maskValue(raw) : raw) : null,
    };
  });

  const missing = items.filter((v) => v.required && !v.isSet).map((v) => v.key);
  const localhostIssues = items.filter((v) => v.isLocalhost).map((v) => v.key);

  return NextResponse.json({ items, missing, localhostIssues });
}

export async function POST(request) {
  if (!checkPassword(request)) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const updates = body?.updates;
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Champ 'updates' manquant." }, { status: 400 });
  }

  // Filtrer uniquement les clés autorisées à être modifiées depuis l'UI
  const allowedKeys = new Set(ENV_VARS.filter((v) => v.canSetInDb).map((v) => v.key));
  const toSave = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.has(key)) continue;
    const val = String(value || "").trim();
    if (!val) continue; // ignorer les valeurs vides
    toSave.push({ key, value: val });
  }

  if (toSave.length === 0) {
    return NextResponse.json({ error: "Aucune valeur valide à sauvegarder." }, { status: 400 });
  }

  try {
    const db = await getDb();
    for (const { key, value } of toSave) {
      await db.collection("app_config").updateOne(
        { key },
        { $set: { key, value, updatedAt: new Date() } },
        { upsert: true }
      );
      // Mise à jour immédiate de process.env pour la session courante
      process.env[key] = value;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur sauvegarde MongoDB.", details: String(err?.message || err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved: toSave.map((t) => t.key) });
}
