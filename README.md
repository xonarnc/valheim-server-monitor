# Valheim Server Monitor

Surveille l'état (en ligne / hors ligne) d'un serveur Valheim et notifie Discord uniquement lors d'un vrai changement d'état, pas à chaque vérification.

## Pourquoi ce dépôt

Interroger un serveur de jeu (protocole Steam `A2S_INFO`) nécessite une requête UDP, ce que la plupart des plateformes serverless (Cloudflare Workers, par exemple) ne supportent pas. GitHub Actions tourne sur de vraies machines avec un accès réseau standard, ce dépôt fait donc uniquement ce travail-là (interroger le serveur), et délègue le reste (mémoriser l'état précédent, décider s'il y a eu un changement, envoyer l'alerte Discord) à une API HTTP externe de ton choix.

Toutes les informations propres à un serveur (IP, port, URL de rapport, jeton) sont des secrets GitHub, rien de spécifique n'est écrit en clair dans le code, qui reste générique et réutilisable pour n'importe quel serveur Valheim.

## Fonctionnement

1. Une tâche planifiée (`.github/workflows/check-server.yml`) tourne toutes les minutes (ou sur demande via `workflow_dispatch`).
2. `check-server.js` envoie une requête `A2S_INFO` en UDP au port Query du serveur pour savoir s'il répond.
3. Le résultat est envoyé à une API HTTP externe, qui décide si c'est un vrai changement d'état et envoie une alerte Discord le cas échéant.

## Configuration requise

Dans Settings > Secrets and variables > Actions de ce dépôt, ajouter :

| Secret | Description |
| --- | --- |
| `SERVER_HOST` | Adresse IP ou nom d'hôte du serveur |
| `SERVER_PORT` | Port Query du serveur (UDP, généralement port de jeu + 1) |
| `WORKER_URL` | URL de l'API qui reçoit le résultat |
| `SERVER_STATUS_TOKEN` | Jeton partagé avec cette API pour authentifier le rapport |

## Contrat de l'API (WORKER_URL)

Le script envoie une requête `POST` vers `WORKER_URL` :

```json
{ "token": "<SERVER_STATUS_TOKEN>", "online": true }
```

Ton API doit vérifier le jeton, comparer `online` à l'état précédent qu'elle a mémorisé, et déclencher sa propre logique de notification si l'état a changé. N'importe quel service capable de recevoir un POST JSON et de garder un petit état persistant convient (Cloudflare Worker + KV, fonction serverless + base de données, etc.).

## Test manuel

Onglet Actions > workflow Check Valheim Server > Run workflow, pour déclencher une vérification immédiate sans attendre le prochain cycle.

## Licence

MIT, libre de réutilisation et d'adaptation.
