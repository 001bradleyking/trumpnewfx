# NEWS FX

Site vitrine React avec une API Laravel, un compte membre protégé par vérification e-mail et un parcours de réinitialisation du mot de passe. Le logo fourni est utilisé dans l’interface.

## Prérequis

- PHP 8.3+ avec OpenSSL, cURL, Fileinfo, Mbstring, PDO SQLite, SQLite3 et ZIP.
- Node.js 20.19+.
- Après un clone, installez les dépendances avec `Set-ExecutionPolicy -Scope Process Bypass; .\setup.ps1`.

## Démarrage local Windows

Dans PowerShell, depuis ce dossier :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
.\run-dev.ps1
```

Ouvrir `http://127.0.0.1:5173`. L’API Laravel répond sur `http://127.0.0.1:8000/api/status`. Arrêter les serveurs avec `.\stop-dev.ps1`.

## Aperçu sur un téléphone avec ngrok

Installez ngrok avec `winget install --id Ngrok.Ngrok --exact`, puis associez-le à votre compte ngrok une seule fois avec `ngrok config add-authtoken VOTRE_JETON`. Le jeton se trouve dans le tableau de bord ngrok. Démarrez ensuite le partage depuis ce dossier avec `.\share-phone.ps1` : le script démarre les serveurs si nécessaire, ouvre un tunnel HTTPS vers le site et affiche le lien à visiter sur le téléphone. Le téléphone doit avoir accès à Internet ; le lien reste actif tant que le tunnel tourne.

Le tunnel expose l’interface et son proxy API pour l’aperçu. Utilisez des comptes de démonstration et arrêtez le tunnel après le partage ; ce serveur reste une préproduction.

Le transport e-mail est défini par les variables `MAIL_*` dans `backend/.env`. En mode `MAIL_MAILER=log`, les messages apparaissent dans `backend/storage/logs/laravel.log`. Ne commitez jamais ce fichier ni vos identifiants SMTP.

Après configuration du SMTP, définir `NEWSFX_ADMIN_EMAIL` dans `backend/.env` avec l’adresse vérifiée qui aura accès à `/admin`. Cette adresse ne peut pas être choisie depuis une inscription. Après un clone ou une nouvelle migration, exécuter `php artisan migrate --force` depuis `backend/`.

Le tableau admin permet aussi de publier un message d’accueil avec prénom, nom et texte en français, anglais, espagnol et portugais. Le navigateur du visiteur choisit la langue du bandeau selon ses préférences ; le français sert de langue de secours. Voir [DEPLOIEMENT.md](./DEPLOIEMENT.md) pour les étapes de mise en production, les protections et une estimation des tarifs d’hébergement et de domaine.

## Authentification

1. Inscription ou mot de passe correct.
2. Code de vérification aléatoire à six chiffres envoyé par e-mail, valable dix minutes.
3. La session Laravel n’est ouverte qu’après validation du code. Un code erroné déclenche une alerte e-mail une seule fois par code ; cinq erreurs bloquent le défi.
4. Mot de passe oublié : lien de réinitialisation à usage limité, envoyé à l’adresse du compte.

Les codes sont stockés hachés, ne sont pas renvoyés par l’API et n’incluent aucune donnée personnelle. L’encodage binaire du nom/prénom n’est pas une méthode d’authentification sûre.

## Paiements et accès privés

- Les offres utilisent les montants du site (100 USD fondateur, 1 000 USD standard). La campagne doit être passée à « Ouverte » dans l’administration avant qu’une commande soit créée.
- Le paiement accepte uniquement l’USDT sur TRON TRC20. Le serveur enregistre les TXID soumis, mais ne les considère jamais comme payés automatiquement : l’administrateur doit vérifier sur la chaîne le jeton, le montant et l’adresse de réception avant validation.
- Un paiement validé alimente l’objectif et affiche les boutons Discord et/ou Telegram choisis dans l’administration. Les invitations sont conservées côté serveur et délivrées par une route protégée après paiement.
- Le journal d’administration conserve les IP, les événements d’authentification et les visites. La géolocalisation (ipwho.is) se fait uniquement au clic de l’administrateur et transmet l’IP au service tiers.
- Le prix d’accès Truth API de 100 000 USD est une estimation à confirmer par un devis officiel et les droits de redistribution.
- Avant d’ouvrir la campagne : confirmer le propriétaire du portefeuille, les tarifs et la durée de chaque offre, les conditions et remboursements, puis enregistrer les invitations Discord/Telegram. L’adresse TRON doit être vérifiée directement dans le portefeuille propriétaire.
- Pour la production, servir le front, l’API et les routes OAuth Google sous une origine HTTPS commune. Le cookie de session est HTTP-only, chiffré, limité à la fermeture du navigateur et configuré SameSite Lax pour permettre le retour OAuth ; `SESSION_SECURE_COOKIE` doit être `true` en HTTPS. Les mutations passent par la protection CSRF.

## Structure

- `backend/` — Laravel 13, API, sessions, e-mails, SQLite local.
- `frontend/` — React + TypeScript + Vite.
- `assets/news-fx-logo.jpeg` — logo d’origine fourni.
- `setup.ps1` — dépendances ; `run-dev.ps1` / `stop-dev.ps1` — démarrage et arrêt locaux.
