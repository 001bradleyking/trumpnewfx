# Déployer NEWS FX proprement

Guide rédigé le 24 octobre 2026 pour l’application actuelle : interface React/Vite, API Laravel 13, e-mails de vérification et espace admin.

## Hébergement conseillé pour démarrer

Un petit VPS Ubuntu chez Hostinger est une option à coût modéré et compatible avec PHP, Laravel, Node pour la compilation, Nginx et MySQL. Le plan KVM 1 affiché actuellement fournit 1 vCPU, 4 Go de RAM et 50 Go NVMe : **6,49 USD/mois sur une période prépayée de 2 ans, puis 11,99 USD/mois au renouvellement**. Le montant initial est donc payé d’avance, et non mois par mois. Consultez le [tarif VPS officiel](https://www.hostinger.com/vps-hosting) avant l’achat, car les promotions et taxes changent.

Pour le nom de domaine, Porkbun affiche actuellement **.com à 11,08 USD/an** et **.net à 12,52 USD/an**, tarifs affichés pour l’enregistrement et le renouvellement des domaines standards. Voir le [barème des domaines Porkbun](https://porkbun.com/products/domains). En ajoutant un .com, le coût indicatif équivaut à **88,96 USD pour la première année** (hébergement annualisé au tarif promo + domaine). L’hébergement est toutefois prépayé deux ans : **155,76 USD**, auxquels s’ajoutent les deux années de domaine (22,16 USD), soit environ **177,92 USD pour deux ans** avant taxes. Pour un .net, le total deux ans serait environ 180,80 USD. Vérifiez le prix exact du nom souhaité avant de payer.

Le VPS demande un peu d’administration système : mises à jour, pare-feu, sauvegardes et surveillance. Render peut demander moins de maintenance, mais cette application PHP devra y être conteneurisée et sa base persistée ; le niveau Web Service payant est indiqué à 7 USD/mois, auxquels s’ajoutent le disque persistant (0,25 USD/Go/mois) et éventuellement une base gérée. Voir [Render pricing](https://render.com/pricing). Évitez d’utiliser un service gratuit avec disque éphémère pour les comptes et paiements.

## Étapes de mise en ligne sur Ubuntu VPS

1. **Préparer le compte et le DNS**
   - Activez l’authentification à deux facteurs du registrar et de l’hébergeur.
   - Créez une entrée DNS `A` pour le domaine et `www` pointant vers l’IP du VPS.
   - Connectez-vous au VPS avec une clé SSH. Créez un compte administrateur non-root, désactivez l’accès SSH par mot de passe après avoir vérifié la clé, et limitez SSH dans le pare-feu.
   - Installez les mises à jour système, puis Nginx, PHP 8.3 FPM avec les extensions nécessaires (OpenSSL, cURL, Fileinfo, Mbstring, PDO MySQL, ZIP), Composer, Node.js 20.19+ et MySQL/MariaDB.

2. **Récupérer et compiler le projet**
   - Clonez le dépôt dans `/var/www/newsfx` avec une clé de déploiement en lecture seule.
   - Dans `frontend/`, lancez `npm ci` puis `npm run build`. Le site statique produit est dans `frontend/dist/`.
   - Dans `backend/`, lancez `composer install --no-dev --prefer-dist --optimize-autoloader`.
   - Ne déployez jamais `.env`, les journaux, les données de paiement, les fichiers `node_modules` ou les dépendances de développement dans un dépôt public.

3. **Créer une base MySQL dédiée**
   - Créez une base et un utilisateur propres à NEWS FX avec un mot de passe aléatoire long. Accordez à cet utilisateur les droits sur cette seule base.
   - MySQL est recommandé en production ; SQLite reste adapté au développement local, mais nécessite un disque persistant et une stratégie de sauvegarde particulière.

4. **Configurer les secrets**
   - Créez `backend/.env` depuis `.env.example` et donnez-lui des droits lisibles uniquement par l’utilisateur du service.
   - Configurez `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://votre-domaine`, `FRONTEND_URL=https://votre-domaine`, `DB_CONNECTION=mysql`, les paramètres `DB_*`, un SMTP fonctionnel, `NEWSFX_ADMIN_EMAIL` et l’adresse de réception TRC20 vérifiée.
   - Générez `APP_KEY` une seule fois avec `php artisan key:generate`. Gardez la même clé lors des mises à jour ; la remplacer rend les sessions et données chiffrées précédentes illisibles.
   - En HTTPS, définissez `SESSION_SECURE_COOKIE=true`, conservez `SESSION_HTTP_ONLY=true`, `SESSION_ENCRYPT=true`, `SESSION_SAME_SITE=lax` et `SESSION_DOMAIN=null`. `lax` permet au navigateur de renvoyer la session lors du retour Google en navigation principale HTTPS ; les requêtes d’écriture restent protégées par CSRF. En environnement production, Laravel nomme par défaut le cookie `__Host-newsfx_session` ; le préfixe `__Host-` exige Secure, Path `/` et l’absence de domaine. Ne mettez jamais les secrets dans Git ou dans la configuration React/Vite.
   - Pour activer Google, créez un client OAuth de type « application Web » dans Google Cloud Console, puis ajoutez `https://votre-domaine/auth/google/callback` à ses URI de redirection autorisées. Définissez côté serveur `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_REDIRECT_URI=https://votre-domaine/auth/google/callback`. En local, l’URI est `http://127.0.0.1:8000/auth/google/callback`. Gardez le secret hors du dépôt et de Vite. Le compte Google doit avoir une adresse vérifiée et le serveur doit pouvoir envoyer le code de confirmation NEWS FX.

5. **Initialiser Laravel**
   - Depuis `backend/`, exécutez `php artisan migrate --force`.
   - Assurez-vous que `storage/` et `bootstrap/cache/` sont accessibles en écriture par PHP-FPM, sans donner des droits d’écriture au serveur sur tout le dépôt.
   - Lancez `php artisan config:cache`, `php artisan route:cache` et `php artisan view:cache`.

6. **Configurer Nginx et HTTPS**
   - Le répertoire public du site doit être `frontend/dist`; il ne faut pas exposer `backend/` ni la racine du dépôt.
   - Servez les fichiers statiques depuis `frontend/dist`, avec `try_files $uri $uri/ /index.html` pour les routes React (`/admin`, `/account`).
   - Faites passer `/api/` et `/auth/` à PHP-FPM en utilisant `backend/public/index.php` comme contrôleur frontal Laravel. Cela inclut `/auth/google` et `/auth/google/callback`. Les requêtes API, OAuth et le site doivent partager le même domaine afin que l’état OAuth, le cookie de session et la protection CSRF restent cohérents.
   - Autorisez seulement SSH, HTTP et HTTPS dans UFW. Activez un certificat TLS avec Certbot, redirigez HTTP vers HTTPS et vérifiez que le renouvellement automatique du certificat fonctionne.
   - Dans le bloc Nginx HTTPS qui sert `frontend/dist`, définissez les en-têtes sur toutes les réponses statiques (le middleware PHP ne couvre pas le front servi directement par Nginx) : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=31536000` et la CSP `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; upgrade-insecure-requests`. `unsafe-inline` est limité aux styles car l’interface React applique une largeur dynamique au graphique de progression. Testez la CSP en préproduction avant de la rendre stricte.
   - Pour TLS, désactivez TLS 1.0/1.1. OWASP recommande TLS 1.3 par défaut, avec TLS 1.2 en option de compatibilité : Nginx peut utiliser `ssl_protocols TLSv1.2 TLSv1.3;`. Ne forcez TLS 1.3 seul qu’après avoir confirmé que les clients prévus le prennent tous en charge. N’annoncez HSTS qu’après que HTTPS fonctionne sur tous les sous-domaines visés.

7. **Vérifier avant d’ouvrir au public**
   - Visitez `/up` et `/api/status`, créez un compte avec une adresse de test, vérifiez la réception du code SMTP et connectez-vous à `/admin`.
   - Dans l’administration, vérifiez les paramètres de campagne, les invitations communautaires, les traductions du bandeau et la recherche/édition paginée des comptes. L’adresse admin doit être vérifiée par e-mail. Testez Google avec les identifiants OAuth configurés et l’URI de retour exactement identique à celle déclarée dans Google Cloud.
   - Confirmez les conditions de paiement, le portefeuille TRC20 et les règles de remboursement avant d’ouvrir une campagne. Les transactions de démonstration ne doivent pas être présentées comme des paiements réels.

8. **Prévoir les opérations courantes**
   - Activez les mises à jour de sécurité de l’OS et surveillez l’espace disque, les journaux Nginx/PHP/Laravel et les erreurs SMTP.
   - Planifiez une sauvegarde chiffrée quotidienne de la base, conservez des copies hors du VPS et testez une restauration. Ne stockez pas les seules sauvegardes sur le serveur de production.
   - Pour chaque publication : sauvegardez la base, récupérez le commit voulu, reconstruisez le front, installez les dépendances PHP, exécutez les migrations, videz/reconstruisez les caches et vérifiez les pages et l’API.
   - Si le dépôt est hébergé sur GitHub, activez dans ses paramètres les Dependabot alerts, les Dependabot security updates et le graphe de dépendances ; le fichier `.github/dependabot.yml` ne peut pas activer ces options de compte à lui seul. Exigez que le workflow sécurité passe avant de fusionner.

## Protections déjà intégrées au code

- Les cookies de session restent HTTP-only et chiffrés, SameSite Lax pour permettre le retour OAuth Google, et les écritures sont protégées par le jeton CSRF Laravel.
- Le middleware ajoute `nosniff`, interdit l’intégration en iframe, limite le référent et les permissions caméra/micro/géolocalisation. HSTS est envoyé uniquement sur une requête HTTPS.
- Le compte admin est sélectionné côté serveur par `NEWSFX_ADMIN_EMAIL`; les inscriptions publiques ne peuvent pas demander le rôle administrateur.
- La connexion Google utilise OAuth Socialite, l’adresse vérifiée par Google, l’état OAuth de Laravel et conserve la confirmation par code e-mail NEWS FX. Les secrets Google sont requis dans l’environnement serveur avant que le bouton fonctionne.
- L’administration permet de rechercher tous les comptes par pages, modifier leur nom et e-mail, vérifier l’adresse, suspendre/réactiver l’accès et envoyer un lien de réinitialisation. Un changement d’adresse ou une suspension invalide les défis en cours et les sessions stockées en base. Aucun mot de passe n’est affiché ni choisi par l’administrateur.
- La validation serveur borne les champs du message public et React échappe le texte au rendu. Le message accepte des emojis et quatre traductions saisies par l’admin.
- Le changement du mot de passe révoque les sessions conservées dans la base lorsque le pilote de session `database` est utilisé. Les créations de commande et décisions de paiement sont sérialisées en base pour limiter les doubles validations concurrentes.
- Dependabot vérifie chaque semaine les manifests Composer, npm et GitHub Actions. Le workflow GitHub génère un SBOM CycloneDX, exécute Trivy pour les vulnérabilités, secrets et configurations, puis conserve le SBOM comme artefact pendant 30 jours.

## Points de la liste qui restent à organiser

- L’authentification actuelle combine mot de passe et code par e-mail, avec limitation d’essais. Cela n’est pas une MFA résistante au phishing. Les passkeys/WebAuthn et une application TOTP demandent une intégration supplémentaire, l’enrôlement des clés, la récupération de compte et des essais sur plusieurs appareils ; ne désactivez pas l’étape e-mail avant d’avoir ce parcours prêt.
- Le projet utilise des sessions HTTP-only et CSRF sur un domaine commun ; il ne délivre pas de JWT. Ajouter des JWT n’améliorerait pas ce modèle d’authentification web.
- Les paiements USDT ne reçoivent aucun webhook : l’application exige une vérification manuelle du TXID, du réseau, du montant et du portefeuille avant approbation. Aucune signature de webhook n’est donc à vérifier dans la configuration actuelle.
- Les journaux d’audit se trouvent dans la même base de données que l’application ; ils ne sont pas immuables ni externalisés. Un stockage append-only/SIEM exige un fournisseur, des identifiants et des règles de conservation hors du code.
- Les sauvegardes externes 3-2-1 et les essais de restauration doivent être configurés chez l’hébergeur. Le dépôt ne possède pas encore de destination de sauvegarde et aucun secret d’hébergement n’est disponible pour les automatiser.
- Le filtrage DDoS et les limites réseau relèvent du pare-feu/hébergeur. Les API sensibles ont déjà des limites Laravel, mais celles-ci ne remplacent pas une protection de bordure.
- Le serveur peut négocier TLS 1.2 ou TLS 1.3 selon la configuration Nginx. TLS 1.3 seul peut exclure d’anciens clients ; le guide recommande les deux versions modernes plutôt que de forcer TLS 1.3 sans connaître l’audience.

Références techniques : [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP Passkeys](https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html), [OWASP TLS](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html), [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [OWASP API Security](https://owasp.org/www-project-api-security/).

L’analyse locale actuelle n’a relevé aucun advisory vulnérable dans `composer.lock` ni dans les dépendances runtime npm. L’audit Composer est limité aux composants verrouillés et aux advisories publiés, pas à une revue de code ni à une garantie d’absence de faille. Le scan Trivy s’exécutera dans GitHub Actions après publication du dépôt/workflow. Les en-têtes et scans ne remplacent pas un audit professionnel, les sauvegardes ou la sécurisation du VPS.
