export type ScreenId =
  'accueil' | 'meteo' | 'magasin' | 'recette' | 'journee' | 'bilan' | 'historique' | 'fin';

export interface ScreenContext {
  goTo(screen: ScreenId): void;
  click(id: string): void;
}

export interface Screen {
  /** Builds the screen's DOM. Returning an element lets App own mounting and cleanup. */
  render(ctx: ScreenContext): HTMLElement;
}
