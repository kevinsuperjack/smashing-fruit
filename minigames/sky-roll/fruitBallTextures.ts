import * as THREE from 'three';
import { FruitSkinId } from './types';

function drawCuteFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  sunglasses = false,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Rosy cheeks
  ctx.fillStyle = 'rgba(255, 105, 135, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-34, 10, 12, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(34, 10, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sunglasses) {
    // Cool pineapple shades
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-42, -16, 36, 22, 8);
    ctx.roundRect(6, -16, 36, 22, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-6, -10, 12, 5);
    // Specular shine
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-35, -12, 10, 4);
    ctx.fillRect(13, -12, 10, 4);
  } else {
    // Big sparkling kawaii eyes
    [-22, 22].forEach((ex) => {
      ctx.fillStyle = '#2B1810';
      ctx.beginPath();
      ctx.arc(ex, -4, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 3.5, -7.5, 3.8, 0, Math.PI * 2);
      ctx.arc(ex + 3, -1, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Cheerful smile
  ctx.strokeStyle = '#2B1810';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 6, 13, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

export function createFruitBallTexture(skin: FruitSkinId): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  if (skin === 'orange') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFB74D');
    grad.addColorStop(0.5, '#FF9800');
    grad.addColorStop(1, '#EF6C00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle citrus peel dimples
    ctx.fillStyle = 'rgba(255, 236, 179, 0.25)';
    for (let i = 0; i < 120; i++) {
      const px = (i * 47) % w;
      const py = 24 + ((i * 73) % (h - 48));
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Green stem cap at north pole
    ctx.fillStyle = '#43A047';
    ctx.fillRect(0, 0, w, 24);
  } else if (skin === 'strawberry') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FF5252');
    grad.addColorStop(0.55, '#E53935');
    grad.addColorStop(1, '#B71C1C');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Golden strawberry seeds
    ctx.fillStyle = '#FFE082';
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 12; col++) {
        const sx = ((col + (row % 2) * 0.5) / 12) * w;
        const sy = 44 + row * 34;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3.2, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Leafy green calyx at top
    ctx.fillStyle = '#43A047';
    ctx.fillRect(0, 0, w, 30);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 32) {
      ctx.moveTo(x, 28);
      ctx.lineTo(x + 16, 46);
      ctx.lineTo(x + 32, 28);
    }
    ctx.fill();
  } else if (skin === 'watermelon') {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, w, h);
    // Dark green wavy watermelon stripes
    ctx.fillStyle = '#1B5E20';
    for (let i = 0; i < 8; i++) {
      const x = i * (w / 8);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) {
        ctx.lineTo(x + Math.sin(y * 0.08) * 6, y);
      }
      for (let y = h; y >= 0; y -= 16) {
        ctx.lineTo(x + 26 + Math.sin(y * 0.08) * 6, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else if (skin === 'peach') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFCCBC');
    grad.addColorStop(0.5, '#FF8A80');
    grad.addColorStop(1, '#FFAB91');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Warm golden blush bands
    ctx.fillStyle = 'rgba(255, 224, 130, 0.35)';
    ctx.beginPath();
    ctx.ellipse(w * 0.25, h * 0.55, 90, 60, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.75, h * 0.55, 90, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute leaf top
    ctx.fillStyle = '#66BB6A';
    ctx.fillRect(0, 0, w, 20);
  } else if (skin === 'pineapple') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFF176');
    grad.addColorStop(0.5, '#FBC02D');
    grad.addColorStop(1, '#F57F17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Criss-cross pineapple diamond lattice
    ctx.strokeStyle = 'rgba(141, 110, 99, 0.45)';
    ctx.lineWidth = 4;
    for (let x = -h; x < w + h; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.stroke();
    }
    // Crown leaves at north pole
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(0, 0, w, 28);
  } else {
    // King Durian — royal golden-green spiky diamond pattern!
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#DCE775');
    grad.addColorStop(0.5, '#9CCC65');
    grad.addColorStop(1, '#689F38');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Golden royal spike diamonds
    ctx.fillStyle = '#FFD54F';
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 12; col++) {
        const sx = ((col + (row % 2) * 0.5) / 12) * w;
        const sy = 34 + row * 38;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 10);
        ctx.lineTo(sx + 8, sy);
        ctx.lineTo(sx, sy + 10);
        ctx.lineTo(sx - 8, sy);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Golden royal band at top
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, 0, w, 26);
  }

  // Paint two adorable faces on opposite sides of the sphere so kids always see a happy face rolling!
  const useShades = skin === 'pineapple';
  drawCuteFace(ctx, w * 0.25, h * 0.52, 0.9, useShades);
  drawCuteFace(ctx, w * 0.75, h * 0.52, 0.9, useShades);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(30, 20, 10, 0.55)');
  grad.addColorStop(0.6, 'rgba(30, 20, 10, 0.25)');
  grad.addColorStop(1, 'rgba(30, 20, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createSkyGradientTexture(
  topHex: string,
  bottomHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.65, bottomHex);
  grad.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
