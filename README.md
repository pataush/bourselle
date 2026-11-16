# Bourselle

App web installable de suivi des dépenses : budget mensuel et annuel, factures, notes de frais, garanties, abonnements et dettes.
Chaque utilisateur se connecte avec son compte Google ou Microsoft ; ses données et ses factures sont enregistrées dans le dossier « Bourselle » de **son propre** Google Drive ou OneDrive. Aucun serveur intermédiaire.

- Mise en ligne et configuration : voir **GUIDE.md**.
- Seul fichier à modifier : `config.js`.
- Code : `app.js` (interface et calculs), `storage.js` (adaptateurs Google Drive, OneDrive, démo locale — interface commune pour ajouter iCloud plus tard).
