# Bourselle — guide de mise en ligne

Ce guide met l'app en ligne gratuitement et active la connexion Google et Microsoft.
Compte environ **1 heure** la première fois. Tu n'as rien à programmer : uniquement des réglages dans des pages web, et deux identifiants à coller dans un fichier.

Ce que tu vas obtenir :

- une adresse du type `https://ton-pseudo.github.io/bourselle/` à ouvrir sur n'importe quel téléphone ou ordinateur ;
- chaque personne se connecte avec **son** compte Google ou Microsoft ;
- ses données et ses factures vont dans un dossier **« Bourselle »** de **son propre** Drive. Toi, en tant que créateur de l'app, tu n'y as pas accès.

> Astuce : fais les étapes sur un ordinateur, c'est beaucoup plus simple que sur téléphone.

---

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | L'app elle-même |
| `storage.js` | L'enregistrement dans Google Drive et OneDrive |
| `config.js` | **Le seul fichier à modifier** : tes deux identifiants |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ce qui rend l'app installable sur l'écran d'accueil |

---

## Étape 1 — Créer un compte GitHub (5 min)

1. Va sur **github.com** et crée un compte gratuit.
2. Choisis bien ton **pseudo** : il apparaîtra dans l'adresse de l'app (`https://pseudo.github.io/bourselle/`).

## Étape 2 — Mettre l'app en ligne (10 min)

1. Sur GitHub, clique sur **+** en haut à droite → **New repository**.
2. Nom : `bourselle`. Laisse **Public** (le code est public, mais **aucune donnée** n'y est stockée : les données sont dans le Drive de chacun). Clique **Create repository**.
3. Sur la page suivante, clique sur **uploading an existing file**.
4. Dézippe le dossier `bourselle`, puis **glisse tout son contenu** (les fichiers **et** le dossier `icons`) dans la page. Clique **Commit changes**.
5. Va dans **Settings** → **Pages** (menu de gauche).
   - *Source* : **Deploy from a branch**
   - *Branch* : **main**, dossier **/ (root)** → **Save**
6. Attends 1 à 2 minutes, puis recharge la page : l'adresse de ton app s'affiche, par exemple `https://pseudo.github.io/bourselle/`.

Ouvre-la : tu dois voir l'écran de connexion. Les boutons Google et Microsoft sont grisés (« Pas encore configuré ») : c'est normal, on les active aux étapes 3 et 4. Le bouton **Essayer sans compte** fonctionne déjà.

> Note bien deux valeurs pour la suite :
> - l'**origine** : `https://pseudo.github.io` (sans rien après) ;
> - l'**adresse complète** : `https://pseudo.github.io/bourselle/` (avec le `/` final).

---

## Étape 3 — Activer « Continuer avec Google » (20 min)

1. Va sur **console.cloud.google.com** et connecte-toi avec ton compte Google.
2. En haut, clique sur le sélecteur de projet → **Nouveau projet** → nom `Bourselle` → **Créer**. Vérifie qu'il est bien sélectionné.
3. Menu ☰ → **API et services** → **Bibliothèque** → cherche **Google Drive API** → **Activer**.
4. Menu ☰ → **API et services** → **Écran de consentement OAuth** (ou **Google Auth Platform**) → **Commencer** :
   - Nom de l'application : `Bourselle` ; adresse e-mail d'assistance : la tienne.
   - Cible / audience : **Externe**.
   - Coordonnées : ton e-mail → accepte les conditions → **Créer**.
5. Dans **Accès aux données** (ou *Champs d'application*) → **Ajouter ou supprimer des champs d'application** → coche
   `.../auth/drive.file` (*Afficher et gérer les fichiers Google Drive créés ou ouverts avec cette application*) → **Mettre à jour** → **Enregistrer**.
   C'est la seule autorisation demandée : l'app ne voit **que** les fichiers qu'elle a créés, jamais le reste du Drive.
6. Dans **Audience** :
   - Tant que l'app est en mode **Test**, seules les personnes ajoutées dans **Utilisateurs test** peuvent se connecter (jusqu'à 100). Ajoute ton adresse et celles de ta famille et de tes amis.
   - Plus tard, pour l'ouvrir à tout le monde : **Publier l'application**. Comme l'app n'utilise que l'autorisation « non sensible » `drive.file`, Google ne demande en principe pas de vérification longue (évite d'ajouter un logo, qui en déclenche une).
7. Dans **Clients** (ou *Identifiants*) → **Créer un client** / **Créer des identifiants → ID client OAuth** :
   - Type d'application : **Application Web** ; nom : `Bourselle web`.
   - **Origines JavaScript autorisées** → **Ajouter un URI** → ton **origine** : `https://pseudo.github.io`
   - **Créer**.
8. Copie l'**ID client** (il se termine par `.apps.googleusercontent.com`).

## Étape 4 — Activer « Continuer avec Microsoft » (20 min)

Cette étape permet la connexion avec les comptes **Hotmail, Outlook, Live** et les comptes professionnels.

1. Va sur **entra.microsoft.com** et connecte-toi avec un compte Microsoft.
   - Si on t'indique que ton compte n'a pas d'annuaire (*tenant*) ou que tu ne peux pas créer d'application : crée un **compte Azure gratuit** sur **azure.microsoft.com/free** (Microsoft peut demander une carte bancaire pour vérifier ton identité, sans débit pour cet usage), puis reviens sur entra.microsoft.com.
2. **Applications** → **Inscriptions d'applications** → **Nouvelle inscription** :
   - Nom : `Bourselle` (ce nom sera celui du dossier dans OneDrive : *Applications/Bourselle*).
   - Types de comptes pris en charge : **Comptes dans un annuaire d'organisation et comptes Microsoft personnels** (Skype, Xbox, Hotmail…).
   - URI de redirection : plateforme **Application monopage (SPA)** → ton **adresse complète** `https://pseudo.github.io/bourselle/`
   - **S'inscrire**.
3. Dans **Authentification** → *Application monopage* → **Ajouter un URI** → ajoute aussi `https://pseudo.github.io/bourselle/index.html` → **Enregistrer**.
4. Dans **Autorisations de l'API** → **Ajouter une autorisation** → **Microsoft Graph** → **Autorisations déléguées** → coche **Files.ReadWrite.AppFolder** → **Ajouter**. (*User.Read* est déjà présent : garde-le.)
   L'app ne voit **que** son propre dossier *Applications/Bourselle*, jamais le reste du OneDrive.
5. Dans **Vue d'ensemble**, copie l'**ID d'application (client)**.

## Étape 5 — Coller les identifiants (5 min)

1. Sur GitHub, ouvre ton dépôt `bourselle` → clique sur `config.js` → icône **crayon** (Edit).
2. Colle tes deux identifiants entre les guillemets :

```js
window.APP_CONFIG = {
  googleClientId: "123456789-abcdef.apps.googleusercontent.com",
  microsoftClientId: "0b5e3c1a-1234-4c5d-9e8f-0123456789ab",
};
```

3. **Commit changes**. Attends 1 minute, puis recharge l'app (sur téléphone, ferme-la complètement et rouvre-la).

Les boutons Google et Microsoft sont maintenant actifs. Fais un premier essai : connecte-toi, ajoute une dépense avec une photo de facture, puis ouvre ton Drive : tu dois y trouver le dossier **Bourselle** avec le fichier `bourselle-donnees.json` et le dossier **Factures**.

---

## Étape 6 — Installer l'app sur les téléphones

- **iPhone** : ouvre l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
- **Android** : ouvre l'adresse dans **Chrome** → menu **⋮** → **Installer l'application** (ou *Ajouter à l'écran d'accueil*).

Envoie simplement l'adresse à ta famille et à tes amis. Chacun se connecte avec son compte ; personne ne voit les données des autres.
(Avec Google en mode Test, pense à les ajouter dans *Utilisateurs test*, étape 3.6.)

## Étape 7 — Récupérer tes données de l'ancienne version (5 min)

1. Dans l'ancienne app (celle dans Claude) : **Réglages** → **Tout exporter (fichier de transfert)**. Tu obtiens un fichier `.json`.
2. Dans la nouvelle app, une fois connecté : **Réglages** → **Importer un fichier** → choisis ce fichier.

Tes opérations, budgets, abonnements, dettes et garanties sont ajoutés. Les **factures** ne sont pas transférées automatiquement : télécharge celles dont tu as besoin dans l'ancienne app, puis rajoute-les sur les dépenses concernées.

---

## Bon à savoir

- **Confidentialité** : les données ne passent par aucun serveur à toi ni à moi. L'app parle directement au Drive de la personne connectée. Google et Microsoft hébergent les fichiers comme n'importe quel document de leur Drive.
- **Plusieurs appareils** : les données se mettent à jour quand tu rouvres l'app. Évite de modifier en même temps sur deux appareils : c'est la dernière modification enregistrée qui l'emporte.
- **Session Google** : elle dure 1 heure ; l'app la renouvelle en arrière-plan quand tu l'utilises. Si un bandeau « Se reconnecter » apparaît, touche-le : tes dernières modifications seront enregistrées ensuite.
- **Sauvegarde** : Réglages → **Sauvegarde complète (JSON)**. Le dossier « Bourselle » de ton Drive est déjà une sauvegarde en soi.
- **Mettre à jour l'app** : remplace les fichiers sur GitHub (sauf `config.js`). Les données ne sont pas touchées.

## En cas de souci

| Message ou symptôme | Solution |
|---|---|
| Google : *Erreur 400 : redirect_uri_mismatch* ou *origin_mismatch* | L'origine de l'étape 3.7 doit être exactement `https://pseudo.github.io` (sans `/bourselle`, sans `/` final). |
| Google : *Accès bloqué : l'app n'a pas terminé la procédure de validation* | La personne n'est pas dans les *Utilisateurs test* (étape 3.6), ou publie l'application. |
| Microsoft : *AADSTS50011* (redirect URI) | Les deux adresses de l'étape 4.2 et 4.3 doivent correspondre exactement à celle que tu ouvres. |
| Microsoft : *You can't sign in here with a personal account* | À l'étape 4.2, le type de comptes doit inclure les **comptes Microsoft personnels**. |
| Les boutons restent grisés | `config.js` n'est pas à jour : vérifie les guillemets, attends 1 minute, ferme et rouvre l'app. |
| La fenêtre Google ne s'ouvre pas | Autorise les fenêtres pop-up pour l'adresse de l'app dans le navigateur. |

## Et ensuite ?

- **Apple / iCloud** et les **notifications** sur téléphone viendront avec la version application (App Store et Play Store). Le code est prêt pour : il suffira d'ajouter un adaptateur de stockage iCloud dans `storage.js`.
- **Budget commun** pour la famille : possible plus tard avec un fichier partagé dans le Drive.
