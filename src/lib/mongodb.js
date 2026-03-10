import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "spectra";

if (!uri) {
  throw new Error("MONGODB_URI manquant. Ajoute-le dans .env.local");
}

let mongoClient;
let clientPromise;

function createRetryablePromise(client, setPromise) {
  return client.connect().catch((error) => {
    // Reset failed connection state so the next request can retry.
    setPromise(null);
    throw error;
  });
}

if (process.env.NODE_ENV === "development") {
  // En dev, on met en cache sur global pour eviter les connexions multiples avec HMR.
  if (!globalThis._mongoClient) {
    globalThis._mongoClient = new MongoClient(uri);
  }
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = createRetryablePromise(
      globalThis._mongoClient,
      (nextPromise) => {
        globalThis._mongoClientPromise = nextPromise;
      },
    );
  }
  mongoClient = globalThis._mongoClient;
  clientPromise = globalThis._mongoClientPromise;
} else {
  mongoClient = new MongoClient(uri);
  clientPromise = createRetryablePromise(mongoClient, (nextPromise) => {
    clientPromise = nextPromise;
  });
}

export async function getDb() {
  try {
    const connectedClient = await clientPromise;
    return connectedClient.db(dbName);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(
      `Connexion MongoDB impossible (${dbName}). Verifie MONGODB_URI, l'acces reseau Atlas et les identifiants. Detail: ${errorMessage}`,
    );
  }
}

export function getMongoClient() {
  return mongoClient;
}

export function getMongoDbName() {
  return dbName;
}
