// Background definitions and canvas rendering for IVLA whiteboards.

export const BACKGROUNDS = [
  { id: 'white', label: 'White', color: '#ffffff', type: 'solid', textColor: '#111827' },
  { id: 'cream', label: 'Cream', color: '#fefcf3', type: 'solid', textColor: '#111827' },
  { id: 'blue', label: 'Light Blue', color: '#f0f7ff', type: 'solid', textColor: '#111827' },
  { id: 'green', label: 'Light Green', color: '#f0fdf4', type: 'solid', textColor: '#111827' },
  { id: 'dark', label: 'Dark', color: '#1e293b', type: 'solid', textColor: '#f8fafc' },
  { id: 'grid', label: 'Grid', color: '#ffffff', type: 'pattern', gridColor: '#e2e8f0', size: 32, textColor: '#111827' },
  { id: 'ruled', label: 'Ruled', color: '#ffffff', type: 'pattern', lineColor: '#e2e8f0', marginColor: '#fca5a5', size: 36, textColor: '#111827' },
  { id: 'dotted', label: 'Dotted', color: '#ffffff', type: 'pattern', dotColor: '#cbd5e1', size: 30, dotRadius: 1.5, textColor: '#111827' },
];

export function getBackgroundConfig(bgId) {
  return BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS[0];
}

/**
 * Render background onto a 2D canvas context.
 * ctx should already be scaled to CSS units or unscaled if (0,0) to (w,h) in CSS px.
 */
export function drawBackground(ctx, width, height, bgId = 'white') {
  if (!ctx || width <= 0 || height <= 0) return;
  const config = getBackgroundConfig(bgId);

  ctx.save();

  // 1. Base color fill
  ctx.fillStyle = config.color || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Pattern rendering
  if (config.id === 'grid') {
    const step = config.size || 32;
    ctx.strokeStyle = config.gridColor || '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = 0; y <= height; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
  } else if (config.id === 'ruled') {
    const step = config.size || 36;
    ctx.strokeStyle = config.lineColor || '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = step; y <= height; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();

    // Red/pink notebook margin line on left
    const marginX = 72;
    if (width > marginX + 20) {
      ctx.strokeStyle = config.marginColor || '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginX + 0.5, 0);
      ctx.lineTo(marginX + 0.5, height);
      ctx.stroke();
    }
  } else if (config.id === 'dotted') {
    const step = config.size || 30;
    const r = config.dotRadius || 1.5;
    ctx.fillStyle = config.dotColor || '#cbd5e1';
    for (let x = step; x < width; x += step) {
      for (let y = step; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}
