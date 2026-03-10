import { MongoClient } from "mongodb";

// On ne lit pas MONGODB_URI au niveau du module pour éviter les erreurs
// pendant le build Next.js (où les variables d'env de production ne sont pas disponibles).
// La connexion réelle est établie uniquement lors du premier appel à getDb().

let mongoClient = null;
let clientPromise = null;

function buildClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI manquant. Configurez-le dans les variables d'environnement de la plateforme (Railway, Vercel…)."
    );
  }

  if (process.env.NODE_ENV === "development") {
    // En dev, on met en cache sur global pour éviter les connexions multiples avec HMR.
    if (!globalThis._mongoClient) {
      globalThis._mongoClient = new MongoClient(uri);
    }
    if (!globalThis._mongoClientPromise) {
      globalThis._mongoClientPromise = globalThis._mongoClient.connect().catch((error) => {
        globalThis._mongoClientPromise = null;
        throw error;
      });
    }
    mongoClient = globalThis._mongoClient;
    clientPromise = globalThis._mongoClientPromise;
  } else {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri);
      clientPromise = mongoClient.connect().catch((error) => {
        mongoClient = null;
        clientPromise = null;
        throw error;
      });
    }
  }
}

export async function getDb() {
  try {
    if (!clientPromise) buildClient();
    const connectedClient = await clientPromise;
    return connectedClient.db(process.env.MONGODB_DB || "spectra");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(
      `Connexion MongoDB impossible. Verifie MONGODB_URI, l'acces reseau Atlas et les identifiants. Detail: ${errorMessage}`
    );
  }
}

export function getMongoClient() {
  if (!mongoClient) buildClient();
  return mongoClient;
}

export function getMongoDbName() {
  return process.env.MONGODB_DB || "spectra";
}
