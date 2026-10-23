import type { ScreenId } from '../ui/screens/types';

/** Every player-facing string. Keys are French to match the game vocabulary (ARCHITECTURE.md §10.4). */
export const fr = {
  jeu: {
    titre: 'Ma Super Limonade !',
    accroche: 'Prépare ta limonade, choisis ton prix et deviens le roi du trottoir !',
  },
  commun: {
    suivant: 'Suivant ➜',
    nouvellePartie: 'Nouvelle partie',
    bientot: 'Bientôt disponible…',
  },
  ecrans: {
    accueil: 'Accueil',
    meteo: 'Météo',
    magasin: 'Magasin',
    recette: 'Recette',
    journee: 'Journée',
    bilan: 'Bilan',
    historique: 'Historique',
    fin: 'Fin de la partie',
  } satisfies Record<ScreenId, string>,
  erreurConfig: {
    titre: 'Oups ! Problème de réglages',
    intro: 'Le fichier de réglages du jeu (config/game-config.json) contient des erreurs :',
    conseil: 'Corrige ces lignes, puis recharge la page.',
  },
  erreurs: {
    webgl: 'Ton appareil ne peut pas afficher le décor en 3D, mais tu peux quand même jouer !',
  },
} as const;
