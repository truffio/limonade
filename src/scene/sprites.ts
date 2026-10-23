import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

const textures = new Map<string, CanvasTexture>();

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function cached(key: string, draw: () => HTMLCanvasElement): CanvasTexture {
  let texture = textures.get(key);
  if (!texture) {
    texture = new CanvasTexture(draw());
    texture.colorSpace = SRGBColorSpace;
    textures.set(key, texture);
  }
  return texture;
}

/** Round speech bubble with an emoji, shown above customers' heads. */
export function emojiTexture(emoji: string): CanvasTexture {
  return cached(`emoji:${emoji}`, () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e7dcc0';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 60, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(54, 108);
    ctx.lineTo(64, 126);
    ctx.lineTo(74, 108);
    ctx.fill();
    ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);
    return c;
  });
}

/** Floating text such as « +1,00 $ » when a cup is sold. */
export function labelTexture(text: string, color = '#2f8a3c'): CanvasTexture {
  return cached(`label:${color}:${text}`, () => {
    const [c, ctx] = canvas(256, 96);
    ctx.font = 'bold 56px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, 128, 50);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 50);
    return c;
  });
}

export function makeSprite(texture: CanvasTexture, width: number, height: number): Sprite {
  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(width, height, 1);
  return sprite;
}

export function disposeSpriteTextures(): void {
  for (const texture of textures.values()) texture.dispose();
  textures.clear();
}
