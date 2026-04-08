import { getDb } from "./mongodb";

const ACTION_LABELS = {
  create: "Ajout",
  update: "Modification",
  delete: "Suppression",
};

/**
 * Enregistre une action utilisateur dans la collection activity_logs.
 * Fire-and-forget : ne lève jamais d'exception pour ne pas bloquer la route principale.
 *
 * @param {object} user       - gate.authz.user  { id, name, email }
 * @param {object} opts
 * @param {string} opts.action        - 'create' | 'update' | 'delete'
 * @param {string} opts.resource      - clé technique  ex: 'commande'
 * @param {string} opts.resourceLabel - libellé FR    ex: 'Commande'
 * @param {string} [opts.detail]      - identifiant/nom de l'élément concerné
 */
export async function logActivity(user, { action, resource, resourceLabel, detail = "" }) {
  try {
    const actionLabel = ACTION_LABELS[action] ?? action;
    const detailStr = detail ? ` ${detail}` : "";
    const message = `${user?.name ?? "Inconnu"} — ${actionLabel} ${resourceLabel}${detailStr}`;

    const db = await getDb();
    await db.collection("activity_logs").insertOne({
      userId: user?.id ?? null,
      userName: user?.name ?? "Inconnu",
      userEmail: user?.email ?? "",
      action,
      resource,
      resourceLabel,
      detail,
      message,
      createdAt: new Date(),
    });
  } catch {
    // On ne propage jamais l'erreur
  }
}
