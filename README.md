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

En local, les courriels sont enregistrés dans `backend/storage/logs/laravel.log` puisque le transport SMTP n’est pas configuré. Pour recevoir réellement les codes, remplir les variables `MAIL_*` dans `backend/.env` avec les paramètres de votre fournisseur SMTP. Ne commitez jamais ce fichier ni vos identifiants.

## Authentification

1. Inscription ou mot de passe correct.
2. Code de vérification aléatoire à six chiffres envoyé par e-mail, valable dix minutes.
3. La session Laravel n’est ouverte qu’après validation du code. Un code erroné déclenche une alerte e-mail une seule fois par code ; cinq erreurs bloquent le défi.
4. Mot de passe oublié : lien de réinitialisation à usage limité, envoyé à l’adresse du compte.

Les codes sont stockés hachés, ne sont pas renvoyés par l’API et n’incluent aucune donnée personnelle. L’encodage binaire du nom/prénom n’est pas une méthode d’authentification sûre.

## Préproduction et mise en production

- Les paiements, rôles Discord, véritables compteurs de membres et contributions sont désactivés. Les statistiques restent à zéro tant qu’une source de paiement vérifiée n’est pas intégrée.
- Le prix d’accès Truth API de 100 000 USD est une estimation à confirmer par un devis officiel et les droits de redistribution.
- Avant la collecte : valider opérateur, conditions, remboursements, tarifs/durées et prestataire de paiement. Configurer SMTP, HTTPS, sauvegardes, logs et politiques finales.
- Pour la production, servir le front et l’API sous une origine HTTPS commune (ou configurer soigneusement cookies, CORS et domaines de confiance). L’API utilise une session Laravel et une protection CSRF.

## Structure

- `backend/` — Laravel 13, API, sessions, e-mails, SQLite local.
- `frontend/` — React + TypeScript + Vite.
- `assets/news-fx-logo.jpeg` — logo d’origine fourni.
- `setup.ps1` — dépendances ; `run-dev.ps1` / `stop-dev.ps1` — démarrage et arrêt locaux.
