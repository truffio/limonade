import { AccueilScreen } from './AccueilScreen';
import { BilanScreen } from './BilanScreen';
import { FinScreen } from './FinScreen';
import { HistoriqueScreen } from './HistoriqueScreen';
import { JourneeScreen } from './JourneeScreen';
import { MagasinScreen } from './MagasinScreen';
import { MeteoScreen } from './MeteoScreen';
import { RecetteScreen } from './RecetteScreen';
import type { Screen, ScreenId } from './types';

export const screens: Record<ScreenId, Screen> = {
  accueil: AccueilScreen,
  meteo: MeteoScreen,
  magasin: MagasinScreen,
  recette: RecetteScreen,
  journee: JourneeScreen,
  bilan: BilanScreen,
  historique: HistoriqueScreen,
  fin: FinScreen,
};
