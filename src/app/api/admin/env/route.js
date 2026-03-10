import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/authz";

const ENV_VARS = [
  {
    key: "MONGODB_URI",
    label: "MongoDB URI",
    description: "Chaine de connexion à la base de données MongoDB Atlas",
    category: "Base de données",
    sensitive: true,
    required: true,
  },
  {
    key: "MONGODB_DB",
    label: "MongoDB Database",
    description: "Nom de la base de données utilisée",
    category: "Base de données",
    sensitive: false,
    required: true,
  },
  {
    key: "BETTER_AUTH_URL",
    label: "URL de l'application",
    description: "URL de base de l'app — DOIT correspondre au domaine de déploiement (pas localhost en production)",
    category: "Authentification",
    sensitive: false,
    required: true,
  },
  {
    key: "ADMIN_EMAIL",
    label: "Email administrateur",
    description: "Adresse email du compte administrateur principal",
    category: "Authentification",
    sensitive: false,
    required: true,
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google Client ID",
    description: "Identifiant client OAuth Google (Google Cloud Console)",
    category: "OAuth Google",
    sensitive: true,
    required: true,
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google Client Secret",
    description: "Secret client OAuth Google",
    category: "OAuth Google",
    sensitive: true,
    required: true,
  },
];

function maskValue(value) {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 5) + "••••••••" + value.slice(-4);
}

export async function GET(request) {
  const gate = await requireAdmin(request, "view");
  if (!gate.ok) return gate.response;

  const items = ENV_VARS.map(({ key, label, description, category, sensitive, required }) => {
    const raw = process.env[key] || "";
    const isSet = raw.length > 0;
    return {
      key,
      label,
      description,
      category,
      sensitive,
      required,
      isSet,
      value: isSet ? (sensitive ? maskValue(raw) : raw) : null,
    };
  });

  return NextResponse.json({ items });
}
