import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { getDb, getMongoClient, getMongoDbName } from "./mongodb";
import { ROLE_NAMES, normalizeRoleName } from "./rbac";
import { ensureBaseRoles, getRoleByName, toObjectId } from "./rbac-store";

// Initialisation lazy : betterAuth n'est instancié qu'au premier appel effectif,
// pas au moment de l'import du module. Cela évite les erreurs de build
// quand MONGODB_URI n'est pas encore disponible (ex. Railway build phase).
let _authInstance = null;

function createAuthInstance() {
  const mongoClient = getMongoClient();
  const mongoDb = mongoClient.db(getMongoDbName());

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    database: mongodbAdapter(mongoDb, {
      client: mongoClient,
      transaction: false,
    }),
    plugins: [nextCookies()],
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/calendar",
        ],
        accessType: "offline",
        prompt: "consent",
      },
    },
    user: {
      additionalFields: {
        firstName: {
          type: "string",
          required: false,
          defaultValue: "",
        },
        lastName: {
          type: "string",
          required: false,
          defaultValue: "",
        },
        needsProfile: {
          type: "boolean",
          required: false,
          input: false,
          defaultValue: true,
        },
        role: {
          type: "string",
          required: true,
          input: false,
          defaultValue: ROLE_NAMES.INVITE,
        },
        isActive: {
          type: "boolean",
          required: true,
          input: false,
          defaultValue: true,
        },
        lastLoginAt: {
          type: "date",
          required: false,
          input: false,
          defaultValue: null,
        },
      },
    },
    // On coupe l'endpoint natif pour eviter la modification libre du profil (nom/prenom).
    disabledPaths: ["/update-user"],
    databaseHooks: {
      user: {
        create: {
          before: async (candidate) => {
            const db = await getDb();
            await ensureBaseRoles(db);

            // Pour les users Google, on marque TOUJOURS needsProfile = true
            // car on veut qu'ils saisissent leur nom/prenom manuellement.
            const requestedRole = normalizeRoleName(candidate.role || ROLE_NAMES.INVITE);
            const roleDoc = await getRoleByName(db, requestedRole);
            const role = roleDoc?.name || ROLE_NAMES.INVITE;

            return {
              data: {
                ...candidate,
                firstName: "",
                lastName: "",
                name: String(candidate.name || candidate.email || "").trim(),
                needsProfile: true,
                role,
                isActive: candidate.isActive !== false,
              },
            };
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const db = await getDb();
            const userId = toObjectId(session.userId);
            if (!userId) return false;

            const user = await db
              .collection("user")
              .findOne({ _id: userId }, { projection: { isActive: 1 } });

            if (!user || user.isActive === false) return false;
            return;
          },
          after: async (session) => {
            const db = await getDb();
            const userId = toObjectId(session.userId);
            if (!userId) return;
            await db.collection("user").updateOne(
              { _id: userId },
              {
                $set: {
                  lastLoginAt: new Date(),
                  updatedAt: new Date(),
                },
              }
            );
          },
        },
      },
    },
  });
}

// Proxy transparent : auth.api.getSession(), auth.handler, etc. fonctionnent
// exactement comme avant, mais betterAuth n'est instancié qu'au premier accès
// (donc jamais pendant le build Next.js).
export const auth = new Proxy(
  {},
  {
    get(_, prop) {
      if (!_authInstance) _authInstance = createAuthInstance();
      const value = _authInstance[prop];
      return typeof value === "function" ? value.bind(_authInstance) : value;
    },
  }
);

let authSetupPromise = null;

async function bootstrapAuth() {
  const db = await getDb();
  await ensureBaseRoles(db);

  const hasAdmin = await db.collection("user").findOne({ role: ROLE_NAMES.ADMIN });
  if (hasAdmin) return;

  // Avec l'auth Google, on ne peut pas creer l'admin automatiquement.
  // On verifie si l'email admin existe deja et on lui donne le role admin.
  const email = String(process.env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  if (!email) return;

  const existing = await db.collection("user").findOne({ email });
  if (!existing) return; // L'admin doit d'abord se connecter avec Google.

  await db.collection("user").updateOne(
    { _id: existing._id },
    {
      $set: {
        role: ROLE_NAMES.ADMIN,
        isActive: true,
        updatedAt: new Date(),
      },
    }
  );
}

export async function ensureAuthSetup() {
  // Pendant next build, on ne tente pas de connexion MongoDB
  // (réseau non disponible en phase de build Docker/Nixpacks).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!authSetupPromise) {
    authSetupPromise = bootstrapAuth();
  }
  return authSetupPromise;
}
