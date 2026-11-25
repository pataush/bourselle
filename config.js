/* Bourselle — configuration.
 * Identifiants de connexion Google et Microsoft (ce ne sont pas des secrets).
 * Laisse une valeur vide pour masquer le bouton correspondant. */
window.APP_CONFIG = {
  googleClientId: "325179000306-5goecp6kps5b0b6se7atjjmmflinkibm.apps.googleusercontent.com",
  microsoftClientId: "5de9cf5f-0a44-4003-bda4-363c5b862a1f",
  // Bourselle Plus : liens de paiement (ex. Stripe Payment Links), à remplir quand ils existent.
  // Laisse vide : le bouton « Choisir » propose alors de nous contacter.
  plus: {
    checkout: { mensuel: "", annuel: "", famille: "", vie: "" },
    contact: "https://github.com/pataush/bourselle/issues",
    // Adresse du serveur des codes (Cloudflare Worker), ex. "https://bourselle-codes.ton-compte.workers.dev"
    api: "https://bourselle-codes.purple-thunder-28e8.workers.dev", mail: false,   // mail : passer à true quand l'envoi des codes par e-mail (Resend) est configuré
    // prices: { annuel: { price: "24,99 €" } },   // pour changer un prix affiché
    // free: { scan: 5, import: 1, tontines: 1, groups: 1 },   // limites de la version gratuite
  },
};
