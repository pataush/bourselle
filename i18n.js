/* Bourselle — langue de l'interface (français / anglais).
 * L'app est écrite en français ; en anglais, tout ce qui s'affiche est traduit à la volée
 * (textes, placeholders, libellés d'accessibilité, messages), grâce au dictionnaire ci-dessous.
 * Chargé avant app.js. */
(function () {
  const KEY = "bourselle-lang";
  let lang = "fr";
  try { lang = localStorage.getItem(KEY) || ((navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en"); } catch (e) {}
  if (!["fr", "en"].includes(lang)) lang = "fr";
  window.LANG = lang;
  document.documentElement.lang = lang;

  // ---------- Textes fixes ----------
  const EXACT = {
    // Connexion, compte
    "Bourselle – Mon budget": "Bourselle – My budget", "Mon budget": "My budget", "Mon budget, simplement": "My budget, made simple",
    "Tes dépenses, factures, garanties, abonnements, dettes, ton épargne et tes tontines, enregistrés dans": "Your expenses, bills, warranties, subscriptions, debts, savings and tontines, saved in", "ton propre": "your own", "cloud.": "cloud.",
    "Continuer avec Google": "Continue with Google", "Continuer avec Microsoft": "Continue with Microsoft", "Continuer avec Apple (iCloud)": "Continue with Apple (iCloud)",
    "Gmail, Google Workspace": "Gmail, Google Workspace", "Hotmail, Outlook, Live, compte pro": "Hotmail, Outlook, Live, work account", "Bientôt, avec l'app iPhone": "Coming soon, with the iPhone app",
    "Pas encore configuré (voir le guide)": "Not set up yet (see the guide)",
    "Essayer sans compte (données sur cet appareil)": "Try without an account (data on this device)",
    "L'app accède uniquement à son dossier « Bourselle » dans ton Drive, et à rien d'autre. Personne d'autre ne voit tes données.": "The app only accesses its own “Bourselle” folder in your Drive, nothing else. Nobody else can see your data.",
    "Confidentialité": "Privacy", "Conditions d'utilisation": "Terms of use", "Connexion…": "Signing in…", "Tu es déconnecté.": "You are signed out.",
    "Connexion impossible": "Sign-in failed", "Connexion annulée ou bloquée": "Sign-in cancelled or blocked", "Réessaie.": "Try again.",
    "Le service de connexion ne s'est pas chargé. Vérifie ta connexion internet.": "The sign-in service did not load. Check your internet connection.",
    "Autorise l'accès au dossier « Bourselle » de ton Drive pour continuer.": "Allow access to the “Bourselle” folder in your Drive to continue.",
    "Session expirée": "Session expired", "Non connecté": "Not signed in", "Accès refusé par le Drive": "Access denied by the Drive", "Introuvable": "Not found",
    "Espace de stockage plein": "Storage full", "Service momentanément indisponible": "Service temporarily unavailable", "Stockage du navigateur plein": "Browser storage full",
    "Mon compte": "My account", "Mode démo": "Demo mode", "Cet appareil (démo)": "This device (demo)", "Ouvrir mon dossier": "Open my folder", "Se déconnecter": "Sign out",
    "Confirmer la déconnexion": "Confirm sign-out", "Quitter le mode essai": "Leave trial mode", "Confirmer (tes données restent sur cet appareil)": "Confirm (your data stays on this device)",
    "Associe un compte": "Link an account", "pour retrouver Bourselle sur tous tes appareils : tes données d'essai seront transférées dans ton cloud.": "to use Bourselle on all your devices: your trial data will be moved to your cloud.",
    "Se connecter avec Google": "Sign in with Google", "Se connecter avec Microsoft": "Sign in with Microsoft", "Se reconnecter": "Sign in again",
    "Ta session a expiré : tes dernières modifications ne sont pas encore enregistrées.": "Your session has expired: your latest changes are not saved yet.",
    "Modifications en attente…": "Changes pending…", "Enregistrement…": "Saving…", "Chargement…": "Loading…", "Sur cet appareil": "On this device",
    "Reconnexion nécessaire": "Sign-in needed", "Drive plein": "Drive full", "Non enregistré – nouvel essai…": "Not saved – retrying…",
    "Données mises à jour depuis un autre appareil": "Data updated from another device", "Patiente, l'enregistrement est en cours…": "Please wait, saving in progress…",
    "Ton Drive est plein : libère de la place pour continuer à enregistrer.": "Your Drive is full: free up space to keep saving.", "Ton Drive est plein.": "Your Drive is full.",
    "Reconnecte-toi puis réessaie.": "Sign in again, then retry.",
    // Navigation
    "Mois": "Month", "Année": "Year", "Suivis": "Trackers", "Réglages": "Settings", "Sections": "Sections", "Recherche": "Search", "Rechercher": "Search",
    "Période précédente": "Previous period", "Période suivante": "Next period", "Abonnements": "Subscriptions", "Objectifs": "Goals", "Dettes": "Debts", "Partage": "Sharing",
    "Frais": "Expense claims", "Garanties": "Warranties", "Tontines": "Tontines", "Opérations": "Transactions",
    // Types et catégories par défaut
    "Dépense": "Expense", "Rentrée": "Income", "Épargne": "Savings", "Invest.": "Invest.", "Investissement": "Investment", "Dépenses": "Expenses", "Rentrées": "Income",
    "Épargne + invest.": "Savings + invest.", "Épargne/inv.": "Savings/inv.", "Résultat": "Balance", "Positif": "Positive", "Négatif": "Negative",
    "Logement": "Housing", "Énergie & eau": "Energy & water", "Télécom & abonnements": "Phone & subscriptions", "Assurances": "Insurance", "Crédits": "Loans",
    "Courses": "Groceries", "Transport & carburant": "Transport & fuel", "Santé": "Health", "Enfants & éducation": "Children & education", "Loisirs & sorties": "Leisure & outings",
    "Shopping & habillement": "Shopping & clothing", "Maison & entretien": "Home & upkeep", "Impôts & taxes": "Taxes", "Cadeaux & dons": "Gifts & donations", "Divers": "Miscellaneous",
    "Sans catégorie": "Uncategorised", "Salaire": "Salary", "Prime": "Bonus", "Allocations / aides": "Benefits / allowances", "Revenus locatifs": "Rental income", "Remboursement": "Refund",
    "Vente": "Sale", "Autre": "Other", "Livret A": "Livret A", "LDDS": "LDDS", "LEP": "LEP", "PEL": "PEL", "Actions / ETF": "Stocks / ETFs", "Assurance-vie": "Life insurance",
    "PER": "Pension plan (PER)", "Immobilier / SCPI": "Real estate / REIT", "Crypto": "Crypto", "Tontine": "Tontine",
    "Jan": "Jan", "Fév": "Feb", "Mar": "Mar", "Avr": "Apr", "Mai": "May", "Juin": "Jun", "Juil": "Jul", "Aoû": "Aug", "Août": "Aug", "Sep": "Sep", "Oct": "Oct", "Nov": "Nov", "Déc": "Dec", "Jui": "Jun",
    // Mois / année
    "Résultat du mois (rentrées − dépenses)": "Month balance (income − expenses)", "Résultat de l'année (rentrées − dépenses)": "Year balance (income − expenses)",
    "Budget du mois": "Monthly budget", "Dépenses par catégorie": "Expenses by category", "Répartition des dépenses": "Expense breakdown", "Fixes ou variables": "Fixed or variable",
    "Aucune dépense ce mois-ci. Appuie sur + pour en ajouter une.": "No expenses this month. Tap + to add one.", "dépensé / prévu": "spent / planned",
    "Comparé à d'habitude": "Compared with usual", "La comparaison avec tes mois précédents apparaîtra après un premier mois complet.": "The comparison with previous months will appear after a first full month.",
    "Reste disponible": "Left to spend", "Mis de côté pour tes objectifs": "Set aside for your goals", "Dépenses à ce jour :": "Spent so far:",
    "Ce qu'il te restera après les prélèvements, mensualités, dettes à rembourser et rentrées prévus ce mois-ci.": "What you will have left after this month's planned direct debits, loan payments, debts and income.",
    "Rentrées et dépenses": "Income and expenses", "Rentrées et dépenses par mois": "Income and expenses by month", "Résultat mensuel": "Monthly balance", "Résultat mois par mois": "Balance month by month",
    "Dépenses de l'année par catégorie": "Expenses for the year by category", "Détail par mois": "Monthly detail", "Touche un mois pour l'ouvrir.": "Tap a month to open it.",
    "Cette année": "This year", "L'an dernier": "Last year", "Voir le détail ›": "See details ›", "nouveau": "new", "Total": "Total", "Résultats": "Results",
    // Opération
    "Ajouter une opération": "Add a transaction", "Montant": "Amount", "Type d'opération": "Transaction type", "Catégorie": "Category", "Date": "Date", "Note": "Note",
    "ex. Courses, Location, Restaurant": "e.g. Groceries, Rental, Restaurant", "Type de charge": "Type of expense", "Charge fixe (revient chaque mois)": "Fixed expense (every month)",
    "Répéter automatiquement": "Repeat automatically", "Note de frais": "Expense claim", "Dépense à me faire rembourser": "Expense to be reimbursed", "Cet achat est sous garantie": "This purchase is under warranty",
    "Facture / justificatif": "Invoice / receipt", "Ajouter la facture": "Add the invoice", "+ Photo": "+ Photo", "Scanner un ticket": "Scan a receipt", "Lecture du ticket…": "Reading the receipt…",
    "Les factures demandent un compte Google ou Microsoft (pas disponible en mode démo).": "Invoices need a Google or Microsoft account (not available in demo mode).",
    "Les factures demandent un compte Google ou Microsoft.": "Invoices need a Google or Microsoft account.",
    "Article": "Item", "Magasin": "Shop", "Magasin / vendeur": "Shop / seller", "Durée de la garantie": "Warranty length", "Date précise": "Exact date", "Fin de garantie": "Warranty end",
    "Numéro de série": "Serial number", "N° de série": "Serial no.", "Infos garantie": "Warranty info", "N° de contrat, conditions…": "Contract no., terms…", "Couverture, contact SAV, n° de contrat…": "Coverage, after-sales contact, contract no.…",
    "Enregistrer": "Save", "Annuler": "Cancel", "Supprimer": "Delete", "Confirmer ?": "Confirm?", "Modifier": "Edit", "Fermer": "Close", "Ouvrir": "Open", "Télécharger": "Download", "Retirer": "Remove",
    "Opération ajoutée": "Transaction added", "Opération modifiée": "Transaction updated", "Opération supprimée": "Transaction deleted", "Dépense supprimée": "Expense deleted", "Dépense modifiée": "Expense updated",
    "Note de frais ajoutée": "Expense claim added", "Indique un montant supérieur à 0": "Enter an amount greater than 0", "Choisis une date": "Pick a date", "Indique le montant": "Enter the amount",
    "Indique la date": "Enter the date", "Indique un nom": "Enter a name", "Choisis la date de fin de garantie": "Pick the warranty end date", "Indique le nom de l'article garanti": "Enter the name of the item under warranty",
    "Je n'ai pas réussi à lire ce ticket : complète à la main.": "I couldn't read this receipt: fill it in by hand.", "Lecture impossible : complète à la main.": "Couldn't read it: fill it in by hand.",
    "Lecture de ticket indisponible : vérifie ta connexion internet.": "Receipt reading unavailable: check your internet connection.",
    "Format non accepté : utilise une photo JPG/PNG ou un PDF.": "Format not accepted: use a JPG/PNG photo or a PDF.", "Envoi impossible. Vérifie ta connexion et réessaie.": "Upload failed. Check your connection and try again.",
    "Patiente, la facture est en cours d'envoi…": "Please wait, the invoice is uploading…", "Ce justificatif n'est plus disponible.": "This receipt is no longer available.", "Ouverture impossible.": "Can't open it.",
    "Justificatif": "Receipt", "Avec facture": "With invoice", "Pas de facture jointe": "No invoice attached", "sans facture": "no invoice",
    // Recherche
    "Rechercher dans mes opérations": "Search my transactions", "Tous les types": "All types", "Toutes les catégories": "All categories", "Toutes les dates": "All dates",
    "3 derniers mois": "Last 3 months",
    // Réglages
    "Langue et devise": "Language and currency", "Langue": "Language", "Devise": "Currency",
    "Changer de devise change l'affichage de tous les montants ; ceux déjà saisis ne sont pas convertis. Les tontines peuvent avoir leur propre devise, convertie dans celle-ci.": "Changing the currency changes how all amounts are shown; amounts already entered are not converted. Tontines can have their own currency, converted into this one.",
    "Budget mensuel par catégorie": "Monthly budget by category", "+ Ajouter une catégorie": "+ Add a category", "Nom de la catégorie": "Category name", "Couleur": "Colour",
    "Les modifications sont enregistrées dès que tu quittes le champ.": "Changes are saved as soon as you leave the field.", "Nouvelle catégorie": "New category",
    "Importer un relevé bancaire": "Import a bank statement", "Importer un relevé": "Import a statement", "Choisir le fichier du relevé": "Choose the statement file",
    "Télécharge le relevé depuis l'espace client de ta banque (format CSV ou OFX), puis importe-le ici. Les catégories sont proposées automatiquement, les doublons sont repérés.": "Download the statement from your bank's website (CSV or OFX), then import it here. Categories are suggested automatically and duplicates are detected.",
    "Opérations automatiques": "Automatic transactions", "+ Ajouter une opération automatique": "+ Add an automatic transaction",
    "Rappel des garanties": "Warranty reminder", "Signaler une garantie comme « bientôt expirée » ce nombre de jours avant la fin :": "Flag a warranty as “expiring soon” this many days before it ends:",
    "Sources de rentrées": "Income sources", "Comptes épargne": "Savings accounts", "Types d'investissement": "Investment types", "Sépare les choix par des virgules.": "Separate the options with commas.",
    "Exporter mes données": "Export my data", "Fichier CSV de toutes tes opérations, à ouvrir dans Excel ou à coller dans ton tableau de suivi.": "CSV file of all your transactions, to open in Excel or paste into your spreadsheet.",
    "Télécharger le CSV": "Download the CSV", "Copier le CSV": "Copy the CSV", "CSV copié": "CSV copied", "Copie impossible ici": "Copying isn't possible here",
    "Sauvegarde complète (budgets, abonnements, dettes…), sans les factures qui restent dans ton Drive.": "Full backup (budgets, subscriptions, debts…), without the invoices, which stay in your Drive.",
    "Sauvegarde complète (JSON)": "Full backup (JSON)", "Importer un fichier": "Import a file", "Importer": "Import", "Exporter": "Export",
    "Importer ajoute les données du fichier (par exemple l'export de l'ancienne version) à celles que tu as déjà, sans rien effacer.": "Importing adds the file's data (for example an export from the old version) to what you already have, without deleting anything.",
    "Ce fichier n'est pas une sauvegarde de Bourselle.": "This file is not a Bourselle backup.", "Installer sur ton téléphone": "Install on your phone",
    "iPhone : dans Safari, bouton Partager puis « Sur l'écran d'accueil ». Android : dans Chrome, menu ⋮ puis « Ajouter à l'écran d'accueil ».": "iPhone: in Safari, tap Share then “Add to Home Screen”. Android: in Chrome, menu ⋮ then “Add to Home screen”.",
    "Français": "Français", "English": "English",
    // Import bancaire
    "Aucune opération cochée": "No transaction ticked", "Ce fichier n'a pas pu être lu.": "This file could not be read.",
    "Aucune opération reconnue dans ce fichier. Exporte le relevé au format CSV ou OFX depuis ta banque.": "No transactions recognised in this file. Export the statement as CSV or OFX from your bank.",
    "Rentrées": "Income", "Épargne (retrait)": "Savings (withdrawal)",
    // Opérations automatiques
    "Nouvelle opération automatique": "New automatic transaction", "Modifier l'opération automatique": "Edit automatic transaction", "Prochaine fois le": "Next time on", "Jusqu'au (facultatif)": "Until (optional)",
    "Jusqu'au": "Until", "Opération automatique créée": "Automatic transaction created", "Opération automatique modifiée": "Automatic transaction updated",
    "Opération automatique supprimée (les opérations déjà ajoutées restent)": "Automatic transaction deleted (transactions already added remain)", "Indique la date de la prochaine fois": "Enter the next date",
    "Chaque semaine": "Every week", "Chaque mois": "Every month", "Chaque trimestre": "Every quarter", "Chaque semestre": "Every six months", "Chaque année": "Every year",
    "/ mois": "/ month", "/ an": "/ year", "/ semaine": "/ week", "/ sem.": "/ wk", "/ trim.": "/ qtr", "par mois": "per month", "par an": "per year", "une seule fois": "one-off",
    // Abonnements
    "Nouvel abonnement": "New subscription", "Modifier l'abonnement": "Edit subscription", "Nom": "Name", "Prochain prélèvement": "Next payment", "Fréquence": "Frequency",
    "Catégorie de dépense": "Expense category", "Fin d'engagement (si engagé)": "Commitment end (if any)", "Préavis de résiliation (jours)": "Cancellation notice (days)", "Infos": "Info",
    "Identifiant client, comment résilier…": "Customer ID, how to cancel…", "Abonnement ajouté": "Subscription added", "Abonnement modifié": "Subscription updated", "Abonnement supprimé": "Subscription deleted",
    "Indique le nom de l'abonnement": "Enter the subscription name", "Indique la date du prochain prélèvement": "Enter the next payment date",
    "Coût de tes abonnements par mois": "Cost of your subscriptions per month", "Abonnements à surveiller": "Subscriptions to watch", "Actifs": "Active", "Actif": "Active", "Active": "Active",
    "Résiliés": "Cancelled", "Résilié": "Cancelled", "Marquer résilié": "Mark as cancelled", "Réactiver": "Reactivate", "Ajouter le prélèvement": "Add the payment",
    "Fin d'engagement": "Commitment ends", "Renouvellement": "Renewal", "Sans engagement": "No commitment", "· Sans engagement": "· No commitment", "· Abonnement": "· Subscription", "À surveiller": "To watch",
    // Dettes
    "Nouvelle dette": "New debt", "Modifier la dette": "Edit debt", "Crédit / prêt": "Loan / credit", "Je dois à quelqu'un": "I owe someone", "On me doit": "Someone owes me", "Je dois": "I owe",
    "Organisme ou personne": "Lender or person", "Taux annuel (%)": "Annual rate (%)", "Nombre de mensualités": "Number of instalments", "Mensualités": "Instalments",
    "À rembourser avant le (facultatif)": "To repay by (optional)", "À rembourser avant le": "To repay by", "Ajouter un versement": "Add a payment", "J'ai remboursé": "I repaid",
    "J'ai reçu un remboursement": "I received a repayment", "Remboursement anticipé": "Early repayment", "Marquer soldée": "Mark as settled", "Crédits et prêts": "Loans and credit",
    "Au total, tu dois": "In total, you owe", "Ce qu'il te reste à rembourser": "What you still have to repay", "Tu dois": "You owe", "Soldes": "Settled",
    "Dettes sans date de remboursement (non comptées)": "Debts without a repayment date (not counted)",
    "Pour un crédit, le reste dû est estimé à partir de la mensualité, du taux et des échéances passées. Le tableau d'amortissement de ta banque fait foi.": "For a loan, the balance is estimated from the instalment, the rate and past payments. Your bank's repayment schedule is the reference.",
    "Dette ajoutée": "Debt added", "Dette modifiée": "Debt updated", "Dette supprimée": "Debt deleted",
    // Objectifs
    "Nouvel objectif": "New goal", "Modifier l'objectif": "Edit goal", "Objectif d'épargne": "Savings goal", "Pour le (facultatif)": "By (optional)",
    "Chaque versement est une opération « Épargne » rattachée à l'objectif : elle apparaît aussi dans ton budget du mois.": "Each payment is a “Savings” transaction linked to the goal: it also appears in your monthly budget.",
    "Objectif créé": "Goal created", "Objectif modifié": "Goal updated", "Objectif supprimé (les versements restent dans ton budget)": "Goal deleted (payments remain in your budget)",
    "Donne un nom à l'objectif": "Give the goal a name", "Indique le montant à atteindre": "Enter the target amount",
    // Partage
    "Dépenses partagées": "Shared expenses", "Nom du groupe": "Group name", "Les autres membres (séparés par des virgules)": "Other members (separated by commas)", "Ton prénom": "Your first name",
    "Le groupe est tenu dans ton app : partage le récap (bouton dans le groupe) pour que chacun sache où il en est.": "The group is kept in your app: share the summary (button in the group) so everyone knows where they stand.",
    "‹ Tous les groupes": "‹ All groups", "Qui doit à qui": "Who owes whom", "Copier le récap": "Copy the summary", "Modifier le groupe": "Edit group", "Payé par": "Paid by",
    "Pour qui (partagé à parts égales)": "For whom (split equally)", "Ajouter ma part à mes dépenses": "Add my share to my expenses", "Catégorie de ma part": "Category of my share", "Quoi ?": "What?",
    "Dans ce groupe, tu dois": "In this group, you owe", "Groupe créé": "Group created", "Groupe modifié": "Group updated", "Groupe supprimé": "Group deleted", "Dépense ajoutée au groupe": "Expense added to the group",
    "Donne un nom au groupe": "Give the group a name", "Choisis au moins une personne": "Choose at least one person", "Indique ce qui a été payé": "Enter what was paid",
    "Récap copié : colle-le dans un message": "Summary copied: paste it into a message", "Partage impossible ici": "Sharing isn't possible here", "moi": "me",
    // Frais
    "Notes de frais": "Expense claims", "Notes de frais à rembourser": "Expense claims to reimburse", "Total à te faire rembourser": "Total to be reimbursed", "Marquer remboursée": "Mark as reimbursed",
    "Marquer comme remboursé": "Mark as reimbursed", "Remboursée": "Reimbursed", "À rembourser": "To reimburse", "· À rembourser": "· To reimburse", "Télécharger les notes de frais": "Download expense claims",
    "Liste des notes de frais (CSV), par exemple pour ton employeur.": "List of expense claims (CSV), for example for your employer.", "Les notes de frais ne sont pas comptées dans tes dépenses personnelles.": "Expense claims are not counted in your personal expenses.",
    "Marquée remboursée": "Marked as reimbursed", "Aucune.": "None.",
    // Garanties
    "Articles encore sous garantie": "Items still under warranty", "Garanties bientôt expirées": "Warranties expiring soon", "Sous garantie": "Under warranty", "Bientôt expirée": "Expiring soon",
    "Expirée": "Expired", "Expirées": "Expired", "Garantie": "Warranty", "Bientôt": "Soon",
    "Les garanties qui arrivent à terme s'affichent aussi en tête de l'onglet Mois. Délai d'alerte réglable dans Réglages.": "Warranties about to end also show at the top of the Month tab. The alert delay can be changed in Settings.",
    "Article (ex. Lave-linge Bosch Série 6)": "Item (e.g. Bosch Series 6 washing machine)",
    // Plus
    "Bourselle Plus": "Bourselle Plus", "en option": "optional", "activé": "active", "Version gratuite": "Free version", "Ce mois-ci :": "This month:", "Ce mois-ci": "This month",
    "Scans de tickets": "Receipt scans", "Imports de relevés": "Statement imports", "Groupes partagés": "Shared groups", "Découvrir Plus": "Discover Plus", "Mon offre": "My plan",
    "Rappels avancés": "Advanced reminders", "Exports comptables": "Accounting exports", "Plus": "Plus", "Ajouter à mon agenda": "Add to my calendar", "Activer les notifications": "Turn on notifications",
    "Notifications activées ✓": "Notifications on ✓", "Notifications activées": "Notifications on", "Grand livre": "General ledger", "Synthèse mensuelle": "Monthly summary",
    "Me prévenir ce nombre de jours avant chaque prélèvement et chaque cotisation de tontine :": "Warn me this many days before each payment and each tontine contribution:",
    "L'agenda (Google Agenda, Outlook, iPhone) reçoit les fins de garantie, les prélèvements, les dates limites de résiliation et les tours de tontine, avec une alerte. Les notifications s'affichent quand tu ouvres Bourselle.": "Your calendar (Google Calendar, Outlook, iPhone) gets warranty ends, payments, cancellation deadlines and tontine turns, with an alert. Notifications show when you open Bourselle.",
    "Fichiers CSV pour Excel ou ton comptable : toutes les opérations avec solde cumulé, et les totaux par poste et par mois.": "CSV files for Excel or your accountant: all transactions with a running balance, and totals by item and by month.",
    "Le budget au quotidien reste gratuit. Plus débloque les outils qui font gagner du temps.": "Day-to-day budgeting stays free. Plus unlocks the time-saving tools.",
    "Scan de tickets illimité": "Unlimited receipt scans", "Import des relevés bancaires illimité": "Unlimited bank statement imports", "Tontines et groupes partagés illimités": "Unlimited tontines and shared groups",
    "garanties, prélèvements et tontines dans ton agenda, notifications": "warranties, payments and tontines in your calendar, notifications", "grand livre et synthèse mensuelle, prêts pour Excel": "general ledger and monthly summary, ready for Excel",
    "Forfait famille": "Family plan", "Plus mensuel": "Plus monthly", "Plus annuel": "Plus yearly", "Famille": "Family", "Bourselle à vie": "Bourselle for life", "À vie": "For life", "Essai": "Trial",
    "Le plus choisi": "Most popular", "Choisir": "Choose", "Paiement unique, mises à jour comprises": "One-off payment, updates included",
    "J'ai un code d'activation": "I have an activation code", "Activer le code": "Activate the code", "BRS1.…": "BRS1.…",
    "Le code est envoyé par e-mail après le paiement. Il est lié à l'adresse de ton compte.": "The code is sent by email after payment. It is tied to your account's email address.",
    "Tu as utilisé ton import de relevé gratuit ce mois-ci.": "You have used your free statement import this month.", "Les rappels avancés font partie de Bourselle Plus.": "Advanced reminders are part of Bourselle Plus.",
    "Les exports comptables font partie de Bourselle Plus.": "Accounting exports are part of Bourselle Plus.", "Ton offre :": "Your plan:", "Sans date de fin": "No end date",
    "Ton abonnement Plus a expiré : renouvelle-le pour retrouver les outils Plus.": "Your Plus subscription has expired: renew it to get the Plus tools back.", "Ton code Plus est lié à un autre compte.": "Your Plus code is tied to another account.",
    "Ce code n'est pas valide. Vérifie qu'il est copié en entier (il commence par BRS1.).": "This code isn't valid. Check that it's copied in full (it starts with BRS1.).",
    "Rien à ajouter pour l'instant : ajoute des garanties, des abonnements ou une tontine.": "Nothing to add yet: add warranties, subscriptions or a tontine.",
    "Ce navigateur ne gère pas les notifications. Utilise plutôt « Ajouter à mon agenda ».": "This browser doesn't support notifications. Use “Add to my calendar” instead.",
    "Notifications refusées : tu peux les autoriser dans les réglages du navigateur.": "Notifications blocked: you can allow them in your browser settings.",
    "Paiement ouvert dans un nouvel onglet. Ton code d'activation t'est envoyé par e-mail ensuite : colle-le ci-dessous.": "Payment opened in a new tab. Your activation code will then be emailed to you: paste it below.",
    // Tontines
    "Tontines en cours": "Ongoing tontines", "Rotative": "Rotating", "Épargne commune": "Shared savings", "Épargne + prêts": "Savings + loans",
    "À chaque tour, un membre (ou deux demi-parts) reçoit tout le pot.": "Each turn, one member (or two half-shares) receives the whole pot.",
    "Tout le monde cotise ; la cagnotte est partagée à la fin, au prorata des versements.": "Everyone contributes; the fund is shared out at the end, in proportion to payments.",
    "Tout le monde cotise ; la caisse prête aux membres avec intérêts, puis tout est partagé à la fin.": "Everyone contributes; the fund lends to members with interest, then everything is shared out at the end.",
    "Nouvelle tontine": "New tontine", "Modifier la tontine": "Edit tontine", "Type": "Type", "Cotisation par part": "Contribution per share", "Date de la 1re cotisation": "Date of the 1st contribution",
    "Nombre de périodes": "Number of periods", "Membres": "Members", "(coche « moi » sur ta ligne · téléphone pour les relances WhatsApp)": "(tick “me” on your row · phone number for WhatsApp reminders)",
    "+ Ajouter un membre": "+ Add a member", "Coller une liste de prénoms": "Paste a list of names", "Ordre de passage (qui reçoit le pot, et quand)": "Payout order (who receives the pot, and when)",
    "Tirer au sort": "Draw lots", "Ordre des membres": "Member order", "Monter": "Move up", "Prénom": "First name", "Téléphone": "Phone", "Parts": "Shares", "Rôle": "Role",
    "Membre": "Member", "Président(e)": "Chair", "Trésorier(e)": "Treasurer", "Secrétaire": "Secretary", "½ part": "½ share", "1 part": "1 share", "1 part ½": "1½ shares", "2 parts": "2 shares", "3 parts": "3 shares",
    "Pénalités, frais et caisse de secours": "Penalties, fees and emergency fund", "Pénalité de retard": "Late penalty", "Aucune": "None", "Montant fixe": "Fixed amount", "% de la cotisation": "% of the contribution",
    "Valeur": "Value", "Délai de grâce (jours)": "Grace period (days)", "Frais de gestion / membre / tour": "Management fee / member / turn", "Caisse de secours / membre / tour": "Emergency fund / member / turn",
    "Suivre les versements de tous les membres (retards, relances, reçus)": "Track every member's payments (late payments, reminders, receipts)",
    "Ajouter tout seul mes cotisations et ce que je reçois dans mon budget, à leur date": "Automatically add my contributions and what I receive to my budget, on their date",
    "Ajouter tout seul mes cotisations et mon pot dans mon budget, à leur date": "Automatically add my contributions and my pot to my budget, on their date",
    "Tontine terminée": "Tontine finished", "Terminée": "Finished", "En cours": "Ongoing", "Retards": "Late payments", "Cotisation à payer": "Contribution due",
    "Payer ma cotisation": "Pay my contribution", "J'ai reçu le pot": "I received the pot", "J'ai reçu ma part": "I received my share", "Tours": "Turns", "Périodes": "Periods", "Caisse": "Fund",
    "Prêts": "Loans", "Partage final": "Final share-out", "Séances": "Meetings", "Règlement": "Rules", "Cotisé ✓": "Paid ✓", "À payer": "To pay", "À venir": "Upcoming", "Échanger": "Swap", "Enchère": "Bid",
    "✓ reçu": "✓ received", "Payé": "Paid", "Relancer": "Remind", "Reçu": "Receipt", "en retard": "late", "à verser": "to pay", "Relancer tous les retards": "Remind everyone who is late",
    "Solde de la caisse": "Fund balance", "Frais de gestion encaissés": "Management fees collected", "Cotisations à la caisse de secours": "Emergency fund contributions", "Pénalités de retard": "Late penalties",
    "Rien pour l'instant.": "Nothing yet.", "Aide / dépense": "Aid / expense", "Entrée (don…)": "Income (donation…)", "Aide ou dépense de la caisse": "Aid or expense from the fund", "Entrée dans la caisse": "Money into the fund",
    "Motif": "Reason", "ex. don, reliquat": "e.g. donation, balance", "ex. décès dans la famille, naissance, frais de salle": "e.g. bereavement, birth, room hire", "Membre concerné (facultatif)": "Member concerned (optional)",
    "Disponible dans la caisse": "Available in the fund", "Aucun prêt.": "No loans.", "Nouveau prêt": "New loan", "Emprunteur": "Borrower", "Intérêt (%)": "Interest (%)", "Date du prêt": "Loan date",
    "À rembourser avant le": "To repay by", "Intérêt simple : l'emprunteur rend le montant + le pourcentage indiqué.": "Simple interest: the borrower repays the amount + the percentage shown.", "remboursé ✓": "repaid ✓",
    "Bureau :": "Committee:", "pas encore désigné (Modifier › membres)": "not appointed yet (Edit › members)", "Aucune séance enregistrée.": "No meetings recorded.", "Compte-rendu": "Minutes",
    "Nouvelle séance": "New meeting", "Modifier la séance": "Edit meeting", "Bilan complet (PDF)": "Full report (PDF)", "Présents": "Present", "Ordre du jour / échanges": "Agenda / discussion", "Décisions": "Decisions",
    "Règles de la tontine : montant, date limite, pénalités, que faire en cas de départ…": "Tontine rules: amount, deadline, penalties, what happens if someone leaves…",
    "Proposer un modèle": "Suggest a template", "Imprimer / PDF": "Print / PDF", "Partager": "Share", "Règlement enregistré": "Rules saved", "Séance enregistrée": "Meeting saved",
    "Appuie encore une fois pour remplacer le texte actuel par le modèle": "Tap again to replace the current text with the template", "Date du versement": "Payment date",
    "Échanger avec": "Swap with", "Aucun autre tour à venir pour échanger": "No other upcoming turn to swap with", "Enchère retirée": "Bid removed", "L'enchère doit être inférieure au pot": "The bid must be lower than the pot",
    "Caisse mise à jour": "Fund updated", "Indique un motif et un montant": "Enter a reason and an amount", "Indique le montant du prêt": "Enter the loan amount", "Remboursement enregistré": "Repayment saved",
    "Tontine créée": "Tontine created", "Tontine modifiée": "Tontine updated", "Tontine supprimée (les opérations déjà enregistrées restent dans ton budget)": "Tontine deleted (transactions already recorded remain in your budget)",
    "Donne un nom à la tontine": "Give the tontine a name", "Indique le montant de la cotisation": "Enter the contribution amount", "Indique la date de la première cotisation": "Enter the date of the first contribution",
    "Indique au moins deux membres": "Enter at least two members", "Coche « moi » sur ta ligne": "Tick “me” on your row", "Deux membres ont le même nom : ajoute une initiale": "Two members have the same name: add an initial",
    "Deux membres ont le même prénom : ajoute une initiale": "Two members have the same first name: add an initial", "Indique la date du premier tour": "Enter the date of the first turn",
    "Indique ton prénom et au moins un autre membre": "Enter your first name and at least one other member", "Ordre tiré au sort": "Order drawn by lot",
    "Les demi-parts doivent aller par deux (nombre total de parts entier)": "Half-shares must come in pairs (whole total number of shares)",
    "Place les demi-parts deux par deux, l'une après l'autre, dans l'ordre de passage": "Place half-shares in pairs, one after the other, in the payout order",
    "Colle les prénoms, séparés par des virgules ou des retours à la ligne :": "Paste the names, separated by commas or line breaks:", "Texte copié : colle-le dans ta messagerie": "Text copied: paste it into your messaging app",
    "Reçu de cotisation": "Contribution receipt", "Indique le nom": "Enter the name",
    "Tes cotisations comptent comme de l'épargne et ce que tu reçois comme une rentrée, convertis dans la devise de ton budget : la tontine apparaît dans ton budget et ta prévision de fin de mois.": "Your contributions count as savings and what you receive as income, converted into your budget currency: the tontine shows in your budget and your end-of-month forecast.",
    "Tes cotisations comptent comme de l'épargne et le pot reçu comme une rentrée : la tontine apparaît dans ton budget et dans ta prévision de fin de mois.": "Your contributions count as savings and the pot received as income: the tontine shows in your budget and your end-of-month forecast.",
    "Rentrée · Tontine": "Income · Tontine", "Épargne · Tontine": "Savings · Tontine", "Cotisation": "Contribution", "Ton tour": "Your turn", "Fin de la tontine": "End of the tontine",
    // Devises
    "EUR · Euro (€)": "EUR · Euro (€)", "XOF · Franc CFA BCEAO (Afrique de l'Ouest)": "XOF · CFA franc BCEAO (West Africa)", "XAF · Franc CFA BEAC (Afrique centrale)": "XAF · CFA franc BEAC (Central Africa)",
    "USD · Dollar américain ($)": "USD · US dollar ($)", "GBP · Livre sterling (£)": "GBP · Pound sterling (£)", "CAD · Dollar canadien": "CAD · Canadian dollar", "CHF · Franc suisse": "CHF · Swiss franc",
    "MAD · Dirham marocain": "MAD · Moroccan dirham", "DZD · Dinar algérien": "DZD · Algerian dinar", "TND · Dinar tunisien": "TND · Tunisian dinar", "GNF · Franc guinéen": "GNF · Guinean franc",
    "CDF · Franc congolais": "CDF · Congolese franc", "HTG · Gourde haïtienne": "HTG · Haitian gourde", "NGN · Naira": "NGN · Naira", "GHS · Cedi": "GHS · Cedi", "KMF · Franc comorien": "KMF · Comorian franc", "MGA · Ariary": "MGA · Ariary",
    // Divers
    "2,99 €": "€2.99", "24,99 €": "€24.99", "39,99 €": "€39.99", "59 €": "€59",
    "Catégorie / source": "Category / source", "Statut": "Status", "Justificatifs": "Receipts", "Article garanti": "Item under warranty", "Libellé": "Description", "Poste": "Item",
    "Débit (sortie)": "Debit (out)", "Crédit (entrée)": "Credit (in)", "Solde cumulé": "Running balance", "Totaux": "Totals", "Résultat (rentrées − sorties)": "Balance (income − outgoings)",
    "Total rentrée": "Total income", "Total dépense": "Total expenses", "Total épargne": "Total savings", "Total investissement": "Total investment", "À rembourser": "To reimburse",
    "payé par ?": "paid by ?", "pour tout le monde": "for everyone", "prochaine le": "next on", "Prochain prélèvement le": "Next payment on", "mois": "month", "semaine": "week", "an": "year",
    "Le": "On", "le": "on", "Période": "Period", "Tour": "Turn",
    "Devise de l'opération": "Transaction currency", "Taux de change": "Exchange rate", "Indique le taux de change": "Enter the exchange rate", "Indique le taux de change.": "Enter the exchange rate.",
    "Parité fixe.": "Fixed parity.", "Dernier taux utilisé (taux du jour indisponible hors connexion).": "Last rate used (today's rate unavailable offline).", "Recherche du taux du jour…": "Fetching today's rate…",
    "Taux du jour :": "Today's rate:", ". Tu peux le corriger (taux de ta banque ou de ton transfert).": ". You can correct it (your bank's or transfer service's rate).",
    "Une opération peut aussi être saisie dans une autre devise (bouton à côté du montant) : elle est convertie au taux du jour, que tu peux corriger. Taux fournis par": "A transaction can also be entered in another currency (button next to the amount): it is converted at today's rate, which you can correct. Rates provided by",
    "Montant d'origine": "Original amount", "Devise d'origine": "Original currency", "Taux": "Rate",
    "Aucune dépense": "No expenses", "Reprendre les charges fixes": "Copy the fixed expenses", "pas de budget": "no budget", "Charges fixes": "Fixed expenses",
    "Voir la facture": "View invoice", "Voir les factures": "View invoices", "Remboursement reçu": "Repayment received", "L'ajouter aussi à mes dépenses (Crédits)": "Also add it to my expenses (Loans)",
    "L'ajouter aussi à mes rentrées": "Also add it to my income", "Dépenses par rapport à ta moyenne": "Expenses compared with your average", "Équilibré": "Balanced", "Tout le monde est quitte.": "Everyone is square.",
    "Aucune dépense. Appuie sur + pour en ajouter une.": "No expenses. Tap + to add one.", "Modifier la dépense": "Edit expense", "Dépense du groupe": "Group expense",
    "Aucune note de frais en attente. Appuie sur + pour en ajouter une.": "No pending expense claims. Tap + to add one.", "Remettre à rembourser": "Mark as to reimburse",
    "Ajoute ton salaire, ton loyer et tes mensualités en opérations automatiques (Réglages) pour une prévision plus juste.": "Add your salary, rent and loan payments as automatic transactions (Settings) for a more accurate forecast.",
    "Ce justificatif n'a pas pu être chargé.": "This receipt could not be loaded.", "Ce justificatif n'a pas pu être chargé : il a été supprimé du Drive.": "This receipt could not be loaded: it was deleted from the Drive.",
    "N° de série :": "Serial no.:", "Source": "Source", "Compte": "Account", "Type d'investissement": "Investment type", "fixe": "fixed", "· fixe": "· fixed",
    // Documents imprimés de tontine
    "Bénéficiaire :": "Recipient:", "Bénéficiaire": "Recipient", "Montant dû": "Amount due", "À verser": "To pay", "Versé le": "Paid on", "Pénalité": "Penalty", "non payé": "not paid",
    "Absents :": "Absent:", "Calendrier et cotisations": "Schedule and contributions", "Cotisations reçues": "Contributions received", "Aucun retard.": "No late payments.", "Partage (à ce jour)": "Share-out (to date)",
    "Part": "Share", "Versé": "Paid", "Dû": "Due", "Remboursé": "Repaid", "Taux": "Rate", "Solde :": "Balance:", "Bureau": "Committee", "Signatures :": "Signatures:", "Ordre du jour / échanges": "Agenda / discussion",
    "Non": "No", "Oui": "Yes", "Fixe": "Fixed", "Variable": "Variable", "Remboursées": "Reimbursed", "Opération": "Transaction",
  };

  // ---------- Textes avec des valeurs ({m} montant, {d} date, {n} nombre, {x} autre) ----------
  const s = n => (Number(String(n).replace(/[^\d.]/g, "")) > 1 ? "s" : "");
  const PATTERNS = [
    ["Bilan d'{x}", "{x} review"], ["Bilan de {x}", "{x} review"],
    ["Budget {x}", "Budget {x}"], ["Couleur {x}", "Colour {x}"], ["Importer {x}", "Import {x}"],
    ["{x} (rentrée)", "{x} (income)"], ["{x} (épargne)", "{x} (savings)"], ["{x} (invest.)", "{x} (invest.)"], ["{x} (moi)", "{x} (me)"], ["{x} (toi)", "{x} (you)"], ["{x} (moi) → ?", "{x} (me) → ?"],
    ["Rentrée · {x}", "Income · {x}"], ["Épargne · {x}", "Savings · {x}"], ["Investissement · {x}", "Investment · {x}"], ["Dépense du groupe · {x}", "Group expense · {x}"], ["Remboursement · {x}", "Repayment · {x}"],
    ["Relevé bancaire · {x}", "Bank statement · {x}"], ["Partage « {x} »", "Sharing “{x}”"], ["Notes de frais · {n}", "Expense claims · {n}"],
    ["Rentrées : {m}", "Income: {m}"], ["Dépenses {x} : {m}", "Expenses {x}: {m}"], ["Rentrées {x} : {m}", "Income {x}: {m}"], ["{x} : {m}", "{x}: {m}"],
    ["Prévision au {n} {x}", "Forecast for {x} {n}"], ["moyenne des {n} mois précédents, à la même date", n => `average of the previous ${n} month${s(n)}, on the same date`],
    ["Si tes dépenses variables restent dans ta moyenne (≈ {m} de plus)", "If your variable expenses stay at your average (≈ {m} more)"],
    ["Et si tu verses ce qu'il faut pour tes objectifs (≈ {m})", "And if you pay what your goals need (≈ {m})"],
    ["Fixes {m}", "Fixed {m}"], ["Variables {m}", "Variable {m}"], ["total {m}", "total {m}"], ["Reste {m}", "{m} left"], ["sur {m}", "of {m}"], ["≈ {m} / mois", "≈ {m} / month"],
    ["{m} par mois", "{m} per month"], ["{m} par an", "{m} per year"], ["au lieu de {m}", "instead of {m}"], ["· {m} au lieu de {m}", "· {m} instead of {m}"],
    ["{n} opérations trouvées · total des dépenses", "{n} transactions found · total expenses"], ["{n} dépenses", n => `${n} expense${s(n)}`], ["{n} personnes · {n} dépenses", (a, b) => `${a} people · ${b} expense${s(b)}`],
    ["Total du groupe {m}", "Group total {m}"], ["On te doit {m}", "You are owed {m}"], ["On te doit aussi notes de frais, prêts : non compté, en attente", "You are also owed expense claims, loans: not counted, pending"],
    ["{n} en attente", "{n} pending"], ["{n} à prévoir", "{n} to plan for"], ["{n} active", n => `${n} active`], ["{n} bientôt expirée", n => `${n} expiring soon`],
    ["Expirent dans moins de {n} jours", "Expire in less than {n} days"], ["Garantie jusqu'au {d} (encore {n} jours)", "Warranty until {d} ({n} days left)"], ["Garantie jusqu'au {d} (encore {n} mois)", "Warranty until {d} ({n} months left)"],
    ["{x} : encore {n} jours", "{x}: {n} days left"], ["· encore {n} jours", "· {n} days left"], ["· expirée depuis {n} jours", "· expired {n} days ago"], ["encore {n} jours", "{n} days left"],
    ["dans {n} jours", "in {n} days"], ["dans {n} jour", "in {n} day"], ["il y a {n} jours", "{n} days ago"], ["aujourd'hui", "today"], ["demain", "tomorrow"], ["hier", "yesterday"], ["dans {n} mois", "in {n} months"],
    ["Acheté le {d} · {m}", "Bought on {d} · {m}"], ["Acheté le {d} · {m} · {x}", "Bought on {d} · {m} · {x}"], ["{x} · garantie jusqu'au {d}", "{x} · warranty until {d}"], ["garantie jusqu'au {d}", "warranty until {d}"],
    ["{n} an", "{n} year"], ["{n} ans", "{n} years"], ["{n} mois", n => `${n} month${s(n)}`], ["{n} mois offerts", "{n} months free"], ["Jusqu'à {n} comptes", "Up to {n} accounts"],
    ["En orange : fin d'engagement dans moins de {n} jours, ou renouvellement annuel dans moins de {n} jours.", "In orange: commitment ending in less than {n} days, or yearly renewal in less than {n} days."],
    ["{x} : Engagement jusqu'au {d} · à résilier avant le {d}", "{x}: Committed until {d} · cancel before {d}"], ["· Engagement jusqu'au {d} · à résilier avant le {d}", "· Committed until {d} · cancel before {d}"],
    ["Engagement jusqu'au {d} · à résilier avant le {d}", "Committed until {d} · cancel before {d}"], ["Engagé jusqu'au {d}", "Committed until {d}"], ["Se renouvelle le {d} ({x})", "Renews on {d} ({x})"],
    ["Résilié le {d}", "Cancelled on {d}"], ["{x} · préavis {n} jours", "{x} · {n} days' notice"], ["Prélèvement du {x} ajouté aux dépenses", "{x} payment added to expenses"],
    ["Mensualité {m} · taux {n} %", "Instalment {m} · rate {n} %"], ["{n} % remboursé", "{n} % repaid"], ["{n}re échéance", "Instalment {n}"], ["Remboursé en {n}", "Repaid in {n}"], ["Remboursées en {n}", "Reimbursed in {n}"],
    ["Rien de remboursé en {n}.", "Nothing reimbursed in {n}."], ["{n} note de frais sans justificatif : ajoute la facture pour la faire rembourser.", n => `${n} expense claim${s(n)} without a receipt: add the invoice to get reimbursed.`],
    ["pendant {n} mois pour y arriver le {d}", "for {n} months to get there by {d}"], ["déjà saisie ({x}, {d})", "already entered ({x}, {d})"], ["déjà importée", "already imported"],
    ["{n} opérations lues ({x}). {n} semblent déjà présentes : décochées. Vérifie les catégories proposées, décoche ce que tu ne veux pas importer.", "{n} transactions read ({x}). {n} seem to be there already: unticked. Check the suggested categories and untick what you don't want to import."],
    ["{n} opérations lues ({x}). Vérifie les catégories proposées, décoche ce que tu ne veux pas importer.", "{n} transactions read ({x}). Check the suggested categories and untick what you don't want to import."],
    ["{n} à importer · dépenses {m} · rentrées {m}. Les catégories que tu corriges seront retenues pour les prochains imports.", "{n} to import · expenses {m} · income {m}. Categories you correct will be remembered for future imports."],
    ["{n} opérations automatiques ajoutées", "{n} automatic transactions added"], ["{n} opération automatique ajoutée", "{n} automatic transaction added"], ["{n} opérations importées", "{n} transactions imported"], ["{n} opération importée", "{n} transaction imported"],
    ["{n} éléments importés", "{n} items imported"], ["{n} élément importé", "{n} item imported"], ["{n} charges fixes ajoutées", "{n} fixed expenses added"],
    ["Devise : {x}", "Currency: {x}"], ["« {x} » dépasse 20 Mo.", "“{x}” is over 20 MB."], ["{x} a des dépenses dans le groupe : garde ce nom.", "{x} has expenses in the group: keep this name."],
    ["Tes données d'essai ({n} éléments) sont maintenant dans ton {x}.", "Your trial data ({n} items) is now in your {x}."], ["Tes données d'essai ({n} élément) sont maintenant dans ton {x}.", "Your trial data ({n} item) is now in your {x}."],
    ["Connecté à ton {x}.", "Connected to your {x}."], ["{x}. Tes données d'essai sont intactes.", "{x}. Your trial data is intact."], ["Enregistré · {x}", "Saved · {x}"], ["Reconnexion impossible : {x}", "Couldn't sign in again: {x}"],
    ["Mode démo : tes données restent dans ce navigateur. Connecte-toi avec Google ou Microsoft (Réglages › Mon compte) pour les garder dans ton Drive : elles y seront transférées.", "Demo mode: your data stays in this browser. Sign in with Google or Microsoft (Settings › My account) to keep it in your Drive: it will be moved there."],
    ["Mode démo : les données restent dans ce navigateur et peuvent être perdues. Connecte-toi pour les mettre dans ton Drive.", "Demo mode: data stays in this browser and may be lost. Sign in to put it in your Drive."],
    ["Tes données et tes factures sont dans le dossier « Bourselle » de ton {x}. Personne d'autre n'y a accès.", "Your data and invoices are in the “Bourselle” folder of your {x}. Nobody else has access."],
    ["Salaire, loyer, mensualités… ajoutés tout seuls à la bonne date. Tu peux aussi en créer une en cochant « Répéter » quand tu ajoutes une opération.", "Salary, rent, loan payments… added automatically on the right date. You can also create one by ticking “Repeat” when you add a transaction."],
    ["{x}, loyer, {n}, garantie…", "{x}, rent, {n}, warranty…"], ["Carrefour, loyer, 42,50, garantie…", "Carrefour, rent, 42.50, warranty…"], ["Dépense · · prochaine le", "Expense · · next on"],
    ["ex. {x}", "e.g. {x}"], ["ex. Marie", "e.g. Mary"], ["ex. Paul, Léa, Hugo", "e.g. Paul, Lea, Hugo"], ["ex. Maison, Vacances Bretagne, Coloc", "e.g. House, Brittany holiday, Flatshare"],
    ["ex. Netflix, Free Mobile, Basic-Fit", "e.g. Netflix, Vodafone, Gym"], ["ex. Prêt auto, Avance de Paul", "e.g. Car loan, Advance from Paul"], ["ex. Loyer, Salaire, Prêt auto", "e.g. Rent, Salary, Car loan"],
    ["ex. Vacances en Grèce, Voiture, Épargne de précaution", "e.g. Holiday in Greece, Car, Emergency savings"], ["ex. Tontine famille, Njangi du quartier", "e.g. Family tontine, Neighbourhood Njangi"],
    ["ex. Tontine famille, Drewo du quartier", "e.g. Family tontine, Neighbourhood Drewo"], ["ex. Awa", "e.g. Awa"], ["ex. Fatou, Moussa, Aïcha", "e.g. Fatou, Moussa, Aïcha"],
    ["Montant ({x})", "Amount ({x})"], ["Montant emprunté / prêté ({x})", "Amount borrowed / lent ({x})"], ["Mensualité ({x})", "Instalment ({x})"], ["Montant à atteindre ({x})", "Target amount ({x})"],
    ["Déjà mis de côté ({x})", "Already saved ({x})"], ["Cotisation par personne ({x})", "Contribution per person ({x})"], ["Montant de l'enchère ({x})", "Bid amount ({x})"], ["Pénalité de retard ({x})", "Late penalty ({x})"],
    ["0 {x}", "0 {x}"],
    // Plus
    [", valable jusqu'au {d}. Merci pour ton soutien !", ", valid until {d}. Thanks for your support!"], ["Valable jusqu'au {d}", "Valid until {d}"], ["Bourselle Plus · {x}", "Bourselle Plus · {x}"],
    ["Bourselle Plus activé jusqu'au {d}. Merci !", "Bourselle Plus active until {d}. Thank you!"], ["Bourselle Plus activé. Merci !", "Bourselle Plus active. Thank you!"],
    ["Tu as utilisé tes {n} scans de tickets gratuits ce mois-ci.", "You have used your {n} free receipt scans this month."], ["La version gratuite permet de suivre {n} tontine.", "The free version lets you track {n} tontine."],
    ["La version gratuite permet {n} groupe partagé.", "The free version allows {n} shared group."], ["gratuit : {n} par mois", "free: {n} per month"], ["gratuit : {n} de chaque", "free: {n} of each"],
    ["un seul abonnement pour {n} comptes, chacun garde ses données", "one subscription for {n} accounts, everyone keeps their own data"],
    ["Le code est envoyé par e-mail après le paiement. Il est lié à l'adresse de ton compte ({x}).", "The code is sent by email after payment. It is tied to your account's email address ({x})."],
    ["Ce code est réservé à {x}. Connecte-toi avec ce compte, ou demande un code pour {x}.", "This code is reserved for {x}. Sign in with that account, or ask for a code for {x}."],
    ["Ce code a expiré le {d}. Renouvelle ton abonnement pour en recevoir un nouveau.", "This code expired on {d}. Renew your subscription to get a new one."],
    ["{n} rappels prêts : ouvre le fichier pour les ajouter à ton agenda.", "{n} reminders ready: open the file to add them to your calendar."], ["{n} rappel prêt : ouvre le fichier pour les ajouter à ton agenda.", "{n} reminder ready: open the file to add it to your calendar."],
    ["Le paiement en ligne arrive très bientôt. Pour obtenir dès maintenant l'offre {x}, contacte-nous : tu recevras ton code d'activation.", "Online payment is coming very soon. To get the {x} plan now, contact us: you'll receive your activation code."],
    ["Pour obtenir dès maintenant l'offre", "To get the plan"],
    // Tontines
    ["{n} membres · {n} tours · pot de {m}", "{n} members · {n} turns · pot of {m}"], ["{n} membres · {n} périodes · cagnotte {m}", "{n} members · {n} periods · fund {m}"],
    ["{n} membres · {n} périodes · cagnotte {m} (dont {m} prêtés en cours)", "{n} members · {n} periods · fund {m} (of which {m} currently lent)"],
    ["Prochain tour ({n}/{n}) le {d} :", "Next turn ({n}/{n}) on {d}:"], [" · enchère {m}", " · bid {m}"], ["Ton tour : n°{n}, le {d}", "Your turn: no. {n}, on {d}"], ["({x}) · {m}", "({x}) · {m}"],
    ["Tu as reçu {m} le {d}", "You received {m} on {d}"], ["Tu as reçu le pot ({m}) le {d}", "You received the pot ({m}) on {d}"], ["Ta part estimée :", "Your estimated share:"], ["· fin le {d}", "· ends on {d}"],
    ["Versé {m} · reçu {m}", "Paid {m} · received {m}"], ["Versé {m}", "Paid {m}"], ["· reçu {m} → tu as reçu {m} d'avance", "· received {m} → you received {m} in advance"], ["→ tu as reçu {m} d'avance", "→ you received {m} in advance"],
    ["→ {m} t'attendent", "→ {m} waiting for you"], ["→ équilibré", "→ balanced"], ["{n} de tes cotisations en retard", "{n} of your contributions late"], ["Membres ({n} retards)", "Members ({n} late)"], ["Membres ({n} retard)", "Members ({n} late)"],
    ["Rotative · {x}", "Rotating · {x}"], ["Épargne commune · {x}", "Shared savings · {x}"], ["Épargne + prêts · {x}", "Savings + loans · {x}"],
    ["{n}/{n} ont cotisé", "{n}/{n} have paid"], ["Enchère {m} → caisse", "Bid {m} → fund"], ["Tour {n}/{n} · {d}", "Turn {n}/{n} · {d}"], ["Période {n}/{n} · {d}", "Period {n}/{n} · {d}"],
    ["Payé {m} le {d} · total versé {m}", "Paid {m} on {d} · total paid {m}"], ["Payé {m} le {d} (pénalité {m}) · total versé {m}", "Paid {m} on {d} (penalty {m}) · total paid {m}"], ["Payé {m} le {d} (pénalité {m})", "Paid {m} on {d} (penalty {m})"],
    ["{m} à verser · total versé {m}", "{m} to pay · total paid {m}"], ["· total versé {m}", "· total paid {m}"], ["Payé {m} le {d}", "Paid {m} on {d}"],
    ["{n} cotisations en retard au total, pour {m} (pénalités comprises).", "{n} late contributions in total, for {m} (penalties included)."], ["{n} cotisation en retard au total, pour {m} (pénalités comprises).", "{n} late contribution in total, for {m} (penalties included)."],
    ["Frais : {m} / membre / {x} · caisse de secours : {m} / membre · pénalité : aucune", "Fees: {m} / member / {x} · emergency fund: {m} / member · penalty: none"],
    ["Frais : {m} / membre / {x} · caisse de secours : {m} / membre · pénalité : {x} après {n} j de délai", "Fees: {m} / member / {x} · emergency fund: {m} / member · penalty: {x} after {n} days' grace"],
    ["Frais : {m} / membre / {x} · caisse de secours : {m} / membre · pénalité : {x}", "Fees: {m} / member / {x} · emergency fund: {m} / member · penalty: {x}"],
    ["Enchère du tour {n}", "Bid on turn {n}"], ["Entrée · {x}", "Income · {x}"], ["Sortie · {x}", "Expense · {x}"],
    ["Cotisations {m} · prêté {m} · remboursé {m} · intérêts gagnés {m}", "Contributions {m} · lent {m} · repaid {m} · interest earned {m}"], ["Disponible : {m}", "Available: {m}"],
    ["{x} · {m} à {x} %", "{x} · {m} at {x} %"], ["Prêté le {d}, à rendre le {d} · reste {m} sur {m} ·", "Lent on {d}, due on {d} · {m} left of {m} ·"], ["Prêté le {d}, à rendre le {d} · reste {m} sur {m}", "Lent on {d}, due on {d} · {m} left of {m}"],
    ["Prêté le {d}, à rendre le {d} · remboursé ✓", "Lent on {d}, due on {d} · repaid ✓"], ["Prêté le {d} · reste {m} sur {m}", "Lent on {d} · {m} left of {m}"], ["Reste à rembourser : {m}", "Left to repay: {m}"],
    ["À la fin, la cagnotte ({m}) est partagée au prorata de ce que chacun a versé. Montants à ce jour :", "At the end, the fund ({m}) is shared out in proportion to what each person paid. Amounts to date:"],
    ["À la fin, la cagnotte ({m}, intérêts compris) est partagée au prorata de ce que chacun a versé. Montants à ce jour :", "At the end, the fund ({m}, interest included) is shared out in proportion to what each person paid. Amounts to date:"],
    ["versé {m}", "paid {m}"], ["{m} de prêts restent à rembourser avant le partage.", "{m} in loans still to be repaid before the share-out."],
    ["Séance du {d}", "Meeting of {d}"], ["· tour {n}", "· turn {n}"], ["· période {n}", "· period {n}"], ["{n}/{n} présents", "{n}/{n} present"], ["{n}/{n} présents · {x}", "{n}/{n} present · {x}"],
    ["Président(e) {x}", "Chair {x}"], ["Trésorier(e) {x}", "Treasurer {x}"], ["Secrétaire {x}", "Secretary {x}"],
    ["Cotisation de {x}", "{x}'s contribution"], ["Tour {n} du {d} · à verser {m}", "Turn {n} on {d} · to pay {m}"], ["Période {n} du {d} · à verser {m}", "Period {n} on {d} · to pay {m}"],
    ["La pénalité est calculée selon les règles de la tontine ; tu peux la modifier ou la mettre à {n}.", "The penalty is calculated from the tontine's rules; you can change it or set it to {n}."],
    ["Échanger le tour {n}", "Swap turn {n}"], ["Tour {n} ({d}) · {x}", "Turn {n} ({d}) · {x}"], ["Enchère sur le tour {n}", "Bid on turn {n}"],
    ["Le bénéficiaire du tour ({x}, le {d}) laisse ce montant à la caisse : il reçoit le pot moins l'enchère. Pour donner le tour à quelqu'un d'autre, utilise d'abord « Échanger ».", "The turn's recipient ({x}, on {d}) leaves this amount in the fund: they receive the pot minus the bid. To give the turn to someone else, use “Swap” first."],
    ["Pot du tour : {m}. Laisse vide pour retirer l'enchère.", "Pot for the turn: {m}. Leave empty to remove the bid."],
    ["Pot à chaque tour : {m} ({n} parts × {m}). Durée : {n} tours.", "Pot each turn: {m} ({n} shares × {m}). Length: {n} turns."],
    ["Chaque période : {m} collectés · cagnotte finale ≈ {m} + intérêts des prêts.", "Each period: {m} collected · final fund ≈ {m} + loan interest."], ["Chaque période : {m} collectés · cagnotte finale ≈ {m}.", "Each period: {m} collected · final fund ≈ {m}."],
    ["Taux : {x} pour {n} {x}", "Rate: {x} per {n} {x}"], ["Indique le taux : combien de {x} pour 1 {x}", "Enter the rate: how many {x} per 1 {x}"],
    ["Ton prochain pot · {x}", "Your next pot · {x}"], ["le {d} · {x}", "on {d} · {x}"],
    ["{x} : {n} cotisations à payer", "{x}: {n} contributions to pay"], ["{x} : {n} cotisation à payer", "{x}: {n} contribution to pay"], ["{x} : tu reçois {m} le {d}", "{x}: you receive {m} on {d}"],
    ["{x} : {n} cotisations de membres en retard", "{x}: {n} members' contributions late"], ["{x} : {n} cotisation de membres en retard", "{x}: {n} member's contribution late"],
    ["Tontine {x} – cotisation tour {n} ({m})", "Tontine {x} – contribution turn {n} ({m})"], ["Tontine {x} – cotisation tour {n}", "Tontine {x} – contribution turn {n}"],
    ["Tontine {x} – cotisation période {n} ({m})", "Tontine {x} – contribution period {n} ({m})"], ["Tontine {x} – cotisation période {n}", "Tontine {x} – contribution period {n}"],
    ["Tontine {x} – pot reçu (tour {n}) ({m})", "Tontine {x} – pot received (turn {n}) ({m})"], ["Tontine {x} – pot reçu (tour {n})", "Tontine {x} – pot received (turn {n})"],
    ["Tontine {x} – ma part finale ({m})", "Tontine {x} – my final share ({m})"], ["Tontine {x} – ma part finale", "Tontine {x} – my final share"], ["Tontine {x} – prêt reçu", "Tontine {x} – loan received"],
    ["Tontine {x} – remboursement de prêt", "Tontine {x} – loan repayment"], ["Tontine {x}", "Tontine {x}"], ["Pot de la tontine {x}", "Pot from tontine {x}"], ["Part finale · {x}", "Final share · {x}"],
    ["Cotisation du tour {n} enregistrée ({m})", "Contribution for turn {n} saved ({m})"], ["Cotisation de la période {n} enregistrée ({m})", "Contribution for period {n} saved ({m})"],
    ["{m} ajoutés à tes rentrées", "{m} added to your income"], ["Pot de {m} ajouté à tes rentrées", "Pot of {m} added to your income"], ["Ta part ({m}) est ajoutée à tes rentrées", "Your share ({m}) has been added to your income"],
    ["Versement de {x} enregistré", "{x}'s payment saved"], ["Tours {n} et {n} échangés", "Turns {n} and {n} swapped"], ["Enchère de {m} enregistrée", "Bid of {m} saved"],
    ["La caisse ne contient que {m}", "The fund only holds {m}"], ["Prêt de {m} à {x} : {m} à rembourser", "Loan of {m} to {x}: {m} to repay"],
    ["Fin de garantie : {x}", "Warranty ends: {x}"], ["Prélèvement {x} : {m}", "Payment {x}: {m}"], ["{x} : dernier jour pour résilier", "{x}: last day to cancel"], ["Fin d'engagement le {d}", "Commitment ends on {d}"],
    ["Tontine {x} : cotisation {m} · c'est ton tour de recevoir", "Tontine {x}: contribution {m} · it's your turn to receive"], ["Tontine {x} : cotisation {m}", "Tontine {x}: contribution {m}"],
    ["{x} (aujourd'hui)", "{x} (today)"], ["{x} (demain)", "{x} (tomorrow)"], ["{x} (dans {n} jours)", "{x} (in {n} days)"],
    ["Retirer {x}", "Remove {x}"],
    ["{n} en {x}", "{n} in {x}"], ["Reprendre tes charges fixes de {x} ({m}) pour ce mois, aux mêmes jours ?", "Copy your fixed expenses from {x} ({m}) to this month, on the same days?"],
    ["Si tes dépenses variables continuent au même rythme (≈ {m} de plus)", "If your variable expenses continue at the same pace (≈ {m} more)"],
    ["Dépenses à ce jour :", "Spent so far:"], ["Dépenses du mois :", "Spent this month:"], ["moyenne des {n} mois précédents", n => `average of the previous ${n} month${s(n)}`],
    ["{d} · {x} a remboursé {x}", "{d} · {x} repaid {x}"], ["· remboursée le {d}", "· reimbursed on {d}"], ["{m} / pas de budget", "{m} / no budget"], ["{m} / {m}", "{m} / {m}"],
    ["Compte-rendu de la séance du {d}", "Minutes of the meeting of {d}"], ["Présents ({n}) :", "Present ({n}):"], ["Tour {n} du {d}", "Turn {n} on {d}"], ["Période {n} du {d}", "Period {n} on {d}"],
    ["· pot {m}", "· pot {m}"], ["Document généré par Bourselle le {d}.", "Document generated by Bourselle on {d}."], ["{x} : {x}", "{x}: {x}"], ["Compte-rendu {x}", "Minutes {x}"], ["Bilan {x}", "Report {x}"], ["Règlement {x}", "Rules {x}"],
    ["Bonjour {x}, petit rappel : ta cotisation de {m} pour la tontine « {x} » (tour {n}, le {d}) n'est pas encore réglée. Merci !", "Hi {x}, a quick reminder: your contribution of {m} to the “{x}” tontine (turn {n}, on {d}) hasn't been paid yet. Thank you!"],
    ["Bonjour {x}, petit rappel : ta cotisation de {m} pour la tontine « {x} » (période {n}, le {d}) n'est pas encore réglée. Merci !", "Hi {x}, a quick reminder: your contribution of {m} to the “{x}” tontine (period {n}, on {d}) hasn't been paid yet. Thank you!"],
    ["REÇU n° {x}", "RECEIPT no. {x}"], ["Tontine « {x} »", "Tontine “{x}”"], ["{x} a versé {m} le {d}", "{x} paid {m} on {d}"], ["{x} a versé {m} (dont {m} de pénalité) le {d}", "{x} paid {m} (including {m} penalty) on {d}"],
    ["pour le tour {n} du {d}.", "for turn {n} on {d}."], ["pour le période {n} du {d}.", "for period {n} on {d}."], ["Trésorier(e) : {x}", "Treasurer: {x}"],
    ["Tontine « {x} » – cotisations en retard :", "Tontine “{x}” – late contributions:"], ["• {x} : {m} (tour {n}, {d})", "• {x}: {m} (turn {n}, {d})"], ["• {x} : {m} (période {n}, {d})", "• {x}: {m} (period {n}, {d})"],
    ["Merci de régulariser rapidement 🙏", "Please settle up soon 🙏"], ["· mis à jour le {d}.", "· updated on {d}."], ["1 {x} =", "1 {x} ="], ["payé par {x}", "paid by {x}"], ["pour {x}", "for {x}"], ["· reçu {m}", "· received {m}"], ["reçu {m}", "received {m}"], ["Pièce", "Ref."],
  ];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const JOURS = { lundi: "Monday", mardi: "Tuesday", mercredi: "Wednesday", jeudi: "Thursday", vendredi: "Friday", samedi: "Saturday", dimanche: "Sunday" };
  const MOIS_ABBR = { "janv.": "Jan", "févr.": "Feb", "mars": "Mar", "avr.": "Apr", "mai": "May", "juin": "Jun", "juil.": "Jul", "août": "Aug", "sept.": "Sep", "oct.": "Oct", "nov.": "Nov", "déc.": "Dec" };
  MOIS.forEach((m, i) => { EXACT[m] = MONTHS[i]; EXACT[m[0].toUpperCase() + m.slice(1)] = MONTHS[i]; });

  const TOK = { m: "(.+?)", d: "(\\d{2}/\\d{2}/\\d{4})", n: "(\\d+(?:[.,]\\d+)?)", x: "(.+?)" };
  const COMPILED = PATTERNS.map(([fr, en]) => {
    const kinds = [];
    const re = new RegExp("^" + fr.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(m|d|n|x)\}/g, (_, k) => { kinds.push(k); return TOK[k]; }) + "$");
    return { re, en, kinds, spec: fr.replace(/\{[mdnx]\}/g, "").length };
  }).sort((a, b) => b.spec - a.spec);
  function trValue(v, kind) { if (kind === "x") { const t = EXACT[v]; if (t) return t; } return v; }
  function trCore(t) {
    if (Object.prototype.hasOwnProperty.call(EXACT, t)) return EXACT[t];
    for (const p of COMPILED) {
      const m = p.re.exec(t); if (!m) continue;
      const vals = m.slice(1).map((v, i) => p.kinds[i] === "x" ? trCore(v) : v);
      if (typeof p.en === "function") return p.en(...vals);
      let i = 0; return p.en.replace(/\{([mdnx]|\d)\}/g, (_, k) => /\d/.test(k) ? vals[Number(k) - 1] : vals[i++]);
    }
    let r;
    if ((r = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) (\d{1,2}) (\S+)(?: (\d{4}))?$/i.exec(t)) && MOIS.includes(r[3].toLowerCase()))
      return `${JOURS[r[1].toLowerCase()]} ${r[2]} ${MONTHS[MOIS.indexOf(r[3].toLowerCase())]}${r[4] ? " " + r[4] : ""}`;
    if ((r = /^(\S+) (\d{4})$/.exec(t)) && MOIS.includes(r[1].toLowerCase())) return `${MONTHS[MOIS.indexOf(r[1].toLowerCase())]} ${r[2]}`;
    if ((r = /^(\d{1,2}) (\S+) (\d{4})$/.exec(t)) && MOIS_ABBR[r[2]]) return `${r[1]} ${MOIS_ABBR[r[2]]} ${r[3]}`;
    if (t.includes(" · ")) {                       // texte composé : on traduit chaque morceau
      const parts = t.split(" · "), out = parts.map(trCore);
      if (out.some((x, i) => x !== parts[i])) return out.join(" · ");
    }
    if (/ : /.test(t)) { const i = t.indexOf(" : "), a = t.slice(0, i), b = t.slice(i + 3), ta = trCore(a), tb = trCore(b); if (ta !== a || tb !== b) return `${ta}: ${tb}`; }
    return t;
  }
  function tr(str) {
    if (lang !== "en" || str == null) return str;
    const s0 = String(str); const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s0); const core = m[2];
    if (!core || !/[A-Za-zÀ-ÿ]/.test(core)) return s0;
    if (core.includes("\n")) return s0.split("\n").map(l => tr(l)).join("\n");
    const out = trCore(core.replace(/[  ]/g, c => c));
    return out === core ? s0 : m[1] + out + m[3];
  }
  window.T = tr;

  // ---------- Traduction de la page ----------
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
  const ATTRS = ["placeholder", "aria-label", "title"];
  const done = new WeakMap();
  function tText(n) {
    const p = n.parentElement; if (!p || SKIP.has(p.tagName) || p.closest("[data-noi18n]")) return;
    if (done.get(n) === n.data) return;
    const t = tr(n.data); if (t !== n.data) n.data = t; done.set(n, n.data);
  }
  function tAttrs(el) {
    if (el.closest && el.closest("[data-noi18n]")) return;
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && /[A-Za-zÀ-ÿ]/.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  }
  function walk(root) {
    if (lang !== "en" || !root) return;
    if (root.nodeType === 3) return tText(root);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP.has(root.tagName) && root.tagName !== "INPUT") return; tAttrs(root); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) n.nodeType === 3 ? tText(n) : tAttrs(n);
  }
  window.i18nHTML = function (html) {
    if (lang !== "en") return html;
    const doc = new DOMParser().parseFromString(html, "text/html"); walk(doc.documentElement);
    doc.documentElement.lang = "en";
    return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
  };
  if (lang === "en") {
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === "characterData") tText(m.target);
        else if (m.type === "attributes") tAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    const start = () => { walk(document.body); document.title = tr(document.title); obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
    const _prompt = window.prompt; window.prompt = (msg, def) => _prompt.call(window, tr(msg), def);
    const _N = window.Notification;
    if (_N) { const N2 = function (title, opts) { return new _N(tr(title), { ...(opts || {}), body: opts && opts.body ? tr(opts.body) : undefined }); }; N2.requestPermission = (...a) => _N.requestPermission(...a); Object.defineProperty(N2, "permission", { get: () => _N.permission }); window.Notification = N2; }
  }
  window.setLang = function (l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
    location.reload();
  };
  // Bouton de langue sur l'écran de connexion
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.getElementById("langBtn"); if (!b) return;
    b.textContent = lang === "en" ? "Français" : "English";
    b.onclick = () => window.setLang(lang === "en" ? "fr" : "en");
  });
})();
