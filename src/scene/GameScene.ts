import { CustomerCrowd, type Visit } from './Customers';
import type { SceneManager } from './SceneManager';
import { SkyView, type SkyState } from './SkyAndWeather';
import { StandView, type StandStock } from './Stand';
import { createWorld } from './World';

/**
 * Everything visible in 3D, behind a small API the rest of the app can drive:
 * weather and time of day, the stock on the stand, the price sign and customers.
 */
export class GameScene {
  private readonly stand = new StandView();
  private readonly sky: SkyView;
  private readonly crowd: CustomerCrowd;
  private price = '';

  constructor(private readonly manager: SceneManager) {
    manager.add(createWorld(), this.stand.group);
    this.sky = new SkyView(manager.scene, manager.sunLight, manager.ambient);
    this.crowd = new CustomerCrowd(manager.scene);
    manager.onUpdate((dt, elapsed) => {
      this.sky.update(dt);
      this.stand.update(dt);
      this.crowd.update(dt, elapsed);
    });
    // The sign is drawn with the game font; redraw once it has loaded.
    void document.fonts?.ready.then(() => this.stand.setPrice(this.price, true));
  }

  setSky(state: Partial<SkyState> & Pick<SkyState, 'cloud' | 'raining'>): void {
    this.sky.set(state);
    this.crowd.setWeather(state.cloud === 'soleil', state.raining);
  }

  setTime(t: number): void {
    this.sky.set({ t });
  }

  setStock(stock: StandStock): void {
    this.stand.setStock(stock);
  }

  setPrice(price: string): void {
    this.price = price;
    this.stand.setPrice(price);
  }

  visit(visit: Visit): void {
    this.crowd.spawn(visit);
  }

  /** A cup was sold: « +1,00 $ » pops above the counter. */
  sale(text: string): void {
    this.stand.popCoin(text);
  }

  clearCustomers(): void {
    this.crowd.clear();
  }

  setFocusShift(x: number, y = 0): void {
    this.manager.setFocusShift(x, y);
  }
}
