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

/**
 * Convert hex or rgb color string to { r, g, b }.
 */
export function parseColorToRgb(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return { r: 255, g: 255, b: 255 };
  let s = colorStr.trim();
  if (s.startsWith('#')) {
    s = s.slice(1);
    if (s.length === 3) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (s.length === 6) {
      const num = parseInt(s, 16);
      if (!isNaN(num)) {
        return {
          r: (num >> 16) & 255,
          g: (num >> 8) & 255,
          b: num & 255,
        };
      }
    }
  } else if (s.startsWith('rgb')) {
    const match = s.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0], 10),
        g: parseInt(match[1], 10),
        b: parseInt(match[2], 10),
      };
    }
  }
  return { r: 255, g: 255, b: 255 };
}

/**
 * Calculate perceived luminance (ITU-R BT.601 formula).
 * Returns a value between 0 (pure black) and 1 (pure white).
 */
export function getLuminance(colorStr) {
  const { r, g, b } = parseColorToRgb(colorStr);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Resolve effective background color from preset ID or color string.
 */
export function getBackgroundColor(bgIdOrColor) {
  if (!bgIdOrColor) return '#ffffff';
  const config = BACKGROUNDS.find((b) => b.id === bgIdOrColor);
  if (config && config.color) return config.color;
  return bgIdOrColor;
}

/**
 * Returns true if the background ID or color has low luminance (< 0.5).
 */
export function isDarkBackground(bgIdOrColor) {
  const color = getBackgroundColor(bgIdOrColor);
  return getLuminance(color) < 0.5;
}

/**
 * Check if a color is a default/theme-based adaptable foreground color.
 * Custom colors (Red, Blue, Green, Orange, Yellow, etc.) return false.
 */
export function isDefaultThemeColor(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return true;
  const c = colorStr.trim().toLowerCase();
  return (
    c === '#111111' ||
    c === '#111827' ||
    c === '#000000' ||
    c === '#374151' ||
    c === '#ffffff' ||
    c === '#f8fafc' ||
    c === '#e2e8f0' ||
    c === '#f1f5f9'
  );
}

export function isDarkThemeColor(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return true;
  const c = colorStr.trim().toLowerCase();
  return c === '#111111' || c === '#111827' || c === '#000000' || c === '#374151';
}

export function isLightThemeColor(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return false;
  const c = colorStr.trim().toLowerCase();
  return c === '#ffffff' || c === '#f8fafc' || c === '#e2e8f0' || c === '#f1f5f9';
}

/**
 * Adapt an individual element's color when the background changes between light and dark.
 * Custom colors (Red, Blue, Green, Orange, etc.) are strictly preserved.
 */
export function adaptElementColor(element, isTargetDark) {
  if (!element || typeof element !== 'object') return element;
  if (!element.color || !isDefaultThemeColor(element.color)) {
    // Custom color -> retain unchanged
    return element;
  }

  if (isTargetDark) {
    // Light -> Dark background: dark theme colors become white/light
    if (isDarkThemeColor(element.color)) {
      if (element.type === 'text') {
        return { ...element, color: '#f8fafc' };
      }
      return { ...element, color: '#FFFFFF' };
    }
  } else {
    // Dark -> Light background: light theme colors become black/dark
    if (isLightThemeColor(element.color)) {
      if (element.type === 'text') {
        return { ...element, color: '#111827' };
      }
      if (element.type === 'stroke' && element.toolType === 'pencil') {
        return { ...element, color: '#374151' };
      }
      return { ...element, color: '#111111' };
    }
  }

  return element;
}
