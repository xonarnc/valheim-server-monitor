# Valheim Server Monitor

Surveille l'état (en ligne / hors ligne) d'un serveur Valheim et notifie Discord uniquement lors d'un vrai changement d'état, pas à chaque vérification.

## Pourquoi ce dépôt

Interroger un serveur de jeu (protocole Steam `A2S_INFO`) nécessite une requête UDP, ce que la plupart des plateformes serverless (Cloudflare Workers, par exemple) ne supportent pas. GitHub Actions tourne sur de vraies machines avec un accès réseau standard, ce dépôt fait donc uniquement ce travail-là (interroger le serveur), et délègue le reste (mémoriser l'état précédent, décider s'il y a eu un changement, envoyer l'alerte Discord) à une API HTTP externe.

Toutes les informations propres à un serveur (IP, port, URL de rapport, jeton) sont des secrets GitHub, rien de spécifique n'est écrit en clair dans le code, qui reste générique et réutilisable pour n'importe quel serveur Valheim.

## Fonctionnement

1. Une tâche planifiée (`.github/workflows/check-server.yml`) tourne toutes les minutes (ou sur demande via `workflow_dispatch`).
2. `check-server.js` envoie une requête `A2S_INFO` en UDP au port Query du serveur pour savoir s'il répond.
3. Le résultat est envoyé à une API HTTP externe, qui décide si c'est un vrai changement d'état et envoie une alerte Discord le cas échéant.

## Déployer pour ton propre serveur

Deux parties à mettre en place : le vérificateur (ce dépôt) et le récepteur (un exemple prêt à l'emploi est fourni dans `worker-example/`).

### 1. Le récepteur (Cloudflare Worker)

Un compte Cloudflare gratuit suffit.

1. Crée un webhook Discord dans le salon de ton choix (Paramètres du salon > Intégrations > Webhooks).
2. Installe `wrangler` si besoin : `npm install -g wrangler`, puis `wrangler login`.
3. Depuis le dossier `worker-example/` :
   - `wrangler kv namespace create STATUS_KV` et copie l'`id` renvoyé dans `wrangler.toml` (remplace `REMPLACE_MOI`).
   - `wrangler secret put STATUS_TOKEN` (choisis un jeton long et aléatoire, garde-le, il servira aussi côté GitHub).
   - `wrangler secret put DISCORD_WEBHOOK_URL` (colle l'URL du webhook Discord créé à l'étape 1).
   - `wrangler deploy`.
4. Note l'URL affichée à la fin du déploiement (ex: `https://valheim-status-receiver.<compte>.workers.dev`), c'est ton `WORKER_URL`.

### 2. Le vérificateur (ce dépôt)

1. Fork ce dépôt (ou copie son contenu dans un nouveau dépôt).
2. Dans Settings > Secrets and variables > Actions du fork, ajoute :

   | Secret | Description |
   | --- | --- |
   | `SERVER_HOST` | Adresse IP ou nom d'hôte de ton serveur |
   | `SERVER_PORT` | Port Query du serveur (UDP, généralement port de jeu + 1) |
   | `WORKER_URL` | L'URL notée à l'étape précédente |
   | `SERVER_STATUS_TOKEN` | Le même jeton que `STATUS_TOKEN` défini côté Worker |

3. Les tâches planifiées sont désactivées par défaut sur un fork : va dans l'onglet Actions et active les workflows.
4. Teste immédiatement : Actions > Check Valheim Server > Run workflow. Une alerte Discord doit arriver si c'est la première vérification, ou si l'état a changé depuis la dernière.

## Contrat de l'API (WORKER_URL)

Si tu préfères construire ton propre récepteur plutôt qu'utiliser `worker-example/`, voici le contrat exact. Le script envoie une requête `POST` vers `WORKER_URL` :

```json
{ "token": "<SERVER_STATUS_TOKEN>", "online": true }
```

Ton API doit vérifier le jeton, comparer `online` à l'état précédent qu'elle a mémorisé, et déclencher sa propre logique de notification si l'état a changé. N'importe quel service capable de recevoir un POST JSON et de garder un petit état persistant convient (Cloudflare Worker + KV, fonction serverless + base de données, etc.).

## Test manuel

Onglet Actions > workflow Check Valheim Server > Run workflow, pour déclencher une vérification immédiate sans attendre le prochain cycle.

## Licence

MIT, libre de réutilisation et d'adaptation.
