# Spectra — Guide pour Claude Code

Application web interne pour un studio de production audiovisuelle/créative.
Développée en Next.js 14, MongoDB, Better Auth, CSS Modules.

---

## RÈGLE ABSOLUE — GIT

**Ne jamais push sur GitHub sans demander explicitement à l'utilisateur.**

Après chaque modification de code, terminer TOUJOURS par cette question :
> Veux-tu que je push ces modifications sur GitHub ?

Si l'utilisateur dit oui → commit + push.
Si l'utilisateur dit non → s'arrêter là.

---

## STACK TECHNIQUE

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 App Router |
| Base de données | MongoDB Atlas via `src/lib/mongodb.js` |
| Auth | Better Auth (`src/lib/auth.js`) |
| Styles | CSS Modules uniquement (pas de Tailwind) |
| Langage | JavaScript (pas TypeScript) |
| Hébergement | Vercel |

---

## STRUCTURE DES FICHIERS

```
src/
  app/
    page.jsx                          # Dashboard
    layout.jsx                        # Root layout (AppShell + tokens/globals CSS)
    [module]/
      page.jsx                        # Page principale du module
      [Module].module.css             # Styles de la page
    api/
      [resource]/
        route.js                      # GET + POST
        [id]/
          route.js                    # GET + PATCH + DELETE
  components/
    layout/
      AppShell.jsx / AppShell.module.css
      Sidebar.jsx / Sidebar.module.css
    ui/
      Modal.jsx / Modal.module.css
  lib/
    mongodb.js          # getDb(), getMongoClient(), getMongoDbName()
    auth.js             # Better Auth (lazy init, proxy)
    authz.js            # requireApiPermission(), requireAdmin()
    rbac.js             # Constantes rôles + hasPermission()
    rbac-store.js       # Lecture/écriture rôles MongoDB
    activity-log.js     # logActivity() — fire-and-forget
    auth-client.js      # Client Better Auth (côté browser)
    sidebar-context.js  # Context React pour la sidebar
  styles/
    tokens.css          # Variables CSS globales (couleurs, radius, typo)
    globals.css         # Reset + styles de base (h1 gradient, body)
```

---

## MODULES EXISTANTS

### Navigation sidebar

**Liens directs** : Tableau de bord / Météo du jour / Météo de la semaine / Planning Perso / Drive / Admin

**Groupes collapsibles** :
- Contrats & Projets → `/brief`, `/contrats-projets`, `/calendrier-projets`
- Inventaire & Commandes → `/commandes`, `/inventaire`
- Réseau & Équipe → `/externes/personnel`, `/externes/fournisseurs`, `/externes/prestataires`
- Finances → `/finances/comptabilite-projet`, `/finances/pilotage_budgetaire`, `/finances/facturation-revenus`
- Equipements → `/equipements/kits-machines`, `/equipements/checklists-epi`, `/equipements/historique`

---

## PATTERNS DE CODE — À RESPECTER

### Pages (Client Components)

Toutes les pages commencent par `"use client"`.

Structure standard d'une page :
```jsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import styles from "./NomPage.module.css";
import Modal from "../../components/ui/Modal";

export default function NomPage() {
  const [items, setItems] = useState([]);
  // ... états locaux

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/resource", { cache: "no-store" });
      const data = await res.json();
      if (!cancelled) setItems(data.items || []);
    })();
    return () => { cancelled = true; };
  }, []);

  return ( /* JSX */ );
}
```

### Mise à jour optimiste

Toujours mettre à jour l'état local AVANT la réponse API, puis corriger si erreur :
```js
// Optimiste
setItems(prev => prev.map(x => x.id === id ? { ...x, ...changes } : x));
// Appel API...
// Si erreur → rollback
```

### Routes API

Structure standard d'une route API :
```js
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireApiPermission } from "../../../../lib/authz";
import { logActivity } from "../../../../lib/activity-log";

export async function GET(request) {
  const gate = await requireApiPermission(request, { resource: "nomRessource", action: "view" });
  if (!gate.ok) return gate.response;

  const db = await getDb();
  const items = await db.collection("collection").find({}).toArray();
  return NextResponse.json({ items });
}

export async function POST(request) {
  const gate = await requireApiPermission(request, { resource: "nomRessource", action: "create" });
  if (!gate.ok) return gate.response;

  const payload = await request.json();
  const db = await getDb();
  const result = await db.collection("collection").insertOne({ ...payload, createdAt: new Date() });

  // Toujours logger les actions
  await logActivity(gate.authz.user, {
    action: "create",
    resource: "nomRessource",
    resourceLabel: payload.nom || "Nouvel élément",
  });

  return NextResponse.json({ item: { ...payload, _id: result.insertedId } }, { status: 201 });
}
```

### MongoDB — Conventions

- `getDb()` retourne la db MongoDB — toujours await
- IDs MongoDB → toujours convertir avec `new ObjectId(id)` et wrapper dans try/catch
- Les documents ont toujours `createdAt: new Date()` à la création
- Les PATCH utilisent `$set` uniquement sur les champs présents dans le payload

```js
import { ObjectId } from "mongodb";

// Conversion sécurisée d'un ID
let oid;
try { oid = new ObjectId(id); }
catch { return NextResponse.json({ error: "ID invalide" }, { status: 400 }); }
```

### Logging d'activité

Chaque action CRUD doit logger via `logActivity` (fire-and-forget, ne throw jamais) :
```js
import { logActivity } from "../../../../lib/activity-log";

// Actions disponibles : "create" | "update" | "delete"
await logActivity(gate.authz.user, {
  action: "update",
  resource: "commandes",
  resourceLabel: "Câble XLR 3m",
  detail: "(optionnel)",
});
```

### Modales

Toujours utiliser le composant `Modal` partagé :
```jsx
<Modal open={isOpen} onClose={handleClose} title="Titre" size="sm">
  {/* contenu */}
</Modal>
// size: "sm" (640px) | "md" (980px) | "lg" (1200px)
```

---

## SYSTÈME DE DESIGN

### Tokens CSS (`src/styles/tokens.css`)

```css
--color-bg: #ffffff
--color-surface: #ffffff
--color-text: #0f172a
--color-text-muted: #5b6b86
--color-border: #e5e7eb
--brand-blue-500: #0ea5e9
--brand-blue-600: #0284c7
--sidebar-bg: #0b1733
--radius: 8px
```

### Règles CSS

- **CSS Modules uniquement** — un fichier `.module.css` par page/composant
- Pas de Tailwind, pas de librairie UI externe
- Pas de style inline sauf pour des valeurs dynamiques (largeurs calculées, couleurs d'état)
- Border-radius : `8px` (--radius) pour les éléments standard, `10px` inputs/boutons, `12-14px` cards/modales
- Transitions : `120-180ms ease` sur les éléments interactifs
- Shadows toujours teintées bleu : `rgba(2, 132, 199, 0.18)`

### Boutons — classes standard

```css
/* Primaire */
background: linear-gradient(90deg, #0284c7, #0ea5e9);
color: white; font-weight: 800; border: 0; border-radius: 10px;
padding: 10px 14px; box-shadow: 0 8px 20px rgba(2,132,199,0.18);

/* Secondaire */
background: white; border: 1px solid rgba(15,23,42,0.14);
color: #0f172a; font-weight: 800; border-radius: 10px;

/* Danger */
background: white; border: 1px solid rgba(220,38,38,0.25);
color: #dc2626; font-weight: 900; border-radius: 10px;
```

### Badges de statut — couleurs sémantiques

| Statut | Texte | Fond | Bordure |
|---|---|---|---|
| Vert / OK | `#166534` | `rgba(34,197,94,0.14)` | `rgba(34,197,94,0.25)` |
| Bleu / Info | `#0c4a6e` | `rgba(14,165,233,0.15)` | `rgba(14,165,233,0.28)` |
| Orange / Warning | `#9a3412` | `rgba(249,115,22,0.13)` | `rgba(249,115,22,0.25)` |
| Rouge / Danger | `#991b1b` | `rgba(220,38,38,0.12)` | `rgba(220,38,38,0.25)` |
| Violet / Module | `#6d28d9` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.2)` |

---

## AUTHENTIFICATION & PERMISSIONS

### Rôles

Définis dans `src/lib/rbac.js` :
- `admin` — accès total
- `manager` — accès à presque tout
- `operateur` — accès limité
- `invite` — accès minimal

### Protéger une route API

```js
// Permission standard
const gate = await requireApiPermission(request, { resource: "commandes", action: "view" });
if (!gate.ok) return gate.response;
// gate.authz.user contient { id, name, email, role }

// Admin uniquement
const gate = await requireAdmin(request);
if (!gate.ok) return gate.response;
```

### Ressources disponibles (rbac.js)

`dashboard`, `brief`, `contrats`, `calendrier`, `commandes`, `inventaire`,
`personnel`, `fournisseurs`, `prestataires`, `comptabiliteProjet`,
`pilotageBudgetaire`, `facturationRevenus`, `kitsMachines`, `checklistsEpi`,
`historiqueEquip`, `planningPerso`, `drive`, `admin`, `meteoQuotidien`, `meteoDuJour`

---

## VARIABLES D'ENVIRONNEMENT

```env
MONGODB_URI=           # URI MongoDB Atlas
MONGODB_DB=spectra     # Nom de la base
BETTER_AUTH_URL=       # URL de production sans slash final (ex: https://spectra.vercel.app)
BETTER_AUTH_TRUSTED_ORIGIN=  # URL de preview Vercel si besoin
BETTER_AUTH_SECRET=    # Secret Better Auth
GOOGLE_CLIENT_ID=      # OAuth Google
GOOGLE_CLIENT_SECRET=  # OAuth Google
ADMIN_EMAIL=           # Email du premier admin
```

---

## CE QU'IL NE FAUT PAS FAIRE

- Ne jamais utiliser Tailwind ou une librairie de composants externe
- Ne jamais écrire de TypeScript (le projet est en JS uniquement)
- Ne jamais modifier `src/lib/mongodb.js`, `src/lib/auth.js`, `src/lib/authz.js` sans raison explicite
- Ne jamais commiter `.env.local` (il est dans `.gitignore`)
- Ne jamais push sans demander à l'utilisateur
- Ne jamais ajouter de dépendances npm sans demander à l'utilisateur
- Ne pas créer de fichiers inutiles (README, fichiers de config supplémentaires, etc.)
- Ne pas utiliser `find`, `grep`, `cat` en bash quand les outils dédiés (Read, Glob, Grep) sont disponibles
