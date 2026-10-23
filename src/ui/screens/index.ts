import { AccueilScreen } from './AccueilScreen';
import { BilanScreen } from './BilanScreen';
import { FinScreen } from './FinScreen';
import { HistoriqueScreen } from './HistoriqueScreen';
import { JourneeScreen } from './JourneeScreen';
import { PreparationScreen } from './PreparationScreen';
import type { Screen, ScreenId } from './types';

export const screens: Record<ScreenId, Screen> = {
  accueil: AccueilScreen,
  preparation: PreparationScreen,
  journee: JourneeScreen,
  bilan: BilanScreen,
  historique: HistoriqueScreen,
  fin: FinScreen,
};
