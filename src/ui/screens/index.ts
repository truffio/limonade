import { AccueilScreen } from './AccueilScreen';
import { placeholderScreen } from './placeholder';
import type { Screen, ScreenId } from './types';

export const screens: Record<ScreenId, Screen> = {
  accueil: AccueilScreen,
  meteo: placeholderScreen('meteo', 'magasin'),
  magasin: placeholderScreen('magasin', 'recette'),
  recette: placeholderScreen('recette', 'journee'),
  journee: placeholderScreen('journee', 'bilan'),
  bilan: placeholderScreen('bilan', 'fin'),
  historique: placeholderScreen('historique', 'bilan'),
  fin: placeholderScreen('fin', 'accueil'),
};
