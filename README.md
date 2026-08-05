# Valheim Server Monitor

Surveille l'état (en ligne / hors ligne) d'un serveur Valheim, et notifie Discord uniquement lors d'un vrai changement d'état (pas à chaque vérification).

## Pourquoi ce dépôt

Cloudflare Workers ne supporte pas les requêtes UDP, or interroger un serveur de jeu (protocole Steam `A2S_INFO`) nécessite de l'UDP. GitHub Actions, elle, tourne sur de vraies machines avec un accès réseau standard, ce dépôt fait donc ce que le Worker ne peut pas faire, et lui délègue le reste (stockage de l'état, envoi Discord) via une petite API HTTP.

Toutes les informations propres à un serveur (IP, port, URL de rapport, jeton) sont des secrets GitHub, rien de spécifique n'est écrit en clair dans le code, qui reste générique et réutilisable pour n'importe quel serveur Valheim.

## Fonctionnement

1. Une tâche planifiée (`.github/workflows/check-server.yml`) tourne toutes les minutes.
2. `check-server.js` envoie une requête `A2S_INFO` en UDP au port Query du serveur pour savoir s'il répond.
3. Le résultat est envoyé à une API HTTP externe (`POST {WORKER_URL}`), qui compare avec l'état précédent et envoie une alerte Discord seulement si l'état a changé.

## Configuration requise

Dans Settings > Secrets and variables > Actions de ce dépôt, ajouter :

- `SERVER_HOST` : adresse IP ou nom d'hôte du serveur
- `SERVER_PORT` : port Query du serveur (UDP, généralement port de jeu + 1)
- `WORKER_URL` : URL de l'API qui reçoit le résultat (ex: `https://exemple.workers.dev/api/server-status`)
- `SERVER_STATUS_TOKEN` : jeton partagé avec cette API pour authentifier le rapport

## Test manuel

Onglet Actions > workflow Check Valheim Server > Run workflow, pour déclencher une vérification immédiate sans attendre le prochain cycle.
