import { jsPDF } from 'jspdf';
import { renderAll } from '../board/renderer.js';
import { drawBackground } from '../board/backgrounds.js';

/**
 * Dimensions in mm for standard paper formats
 */
const PAGE_DIMENSIONS = {
  a4: { w: 210, h: 297 },
  a3: { w: 297, h: 420 },
};

/**
 * Render a page's elements and background onto an offscreen canvas and return a data URL.
 */
function renderPageToDataUrl(elements, background = 'white', width = 1920, height = 1080) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base background rendering
  drawBackground(ctx, width, height, background);

  // Scale viewport to fit offscreen canvas
  const vw = Math.max(window.innerWidth || 1200, 800);
  const vh = Math.max(window.innerHeight || 800, 600);
  const scale = Math.min(width / vw, height / vh);

  ctx.save();
  ctx.scale(scale, scale);
  renderAll(ctx, elements || []);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Parse page range string like "1, 3-5" into 0-based indices.
 */
export function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || !rangeStr.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const indices = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        indices.add(num - 1);
      }
    }
  }

  const sorted = Array.from(indices).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : Array.from({ length: totalPages }, (_, i) => i);
}

/**
 * Export whiteboard pages to a multi-page PDF document.
 */
export async function exportWhiteboardToPDF({
  pages,
  currentPageIndex = 0,
  options = {},
  onProgress = () => {},
}) {
  const {
    scope = 'all', // 'all' | 'current' | 'range'
    pageRange = '',
    pageSize = 'a4', // 'a4' | 'a3'
    orientation = 'landscape', // 'landscape' | 'portrait'
    title = 'IVLA-Whiteboard',
  } = options;

  const totalPages = pages.length;
  let targetIndices = [];

  if (scope === 'current') {
    targetIndices = [Math.min(currentPageIndex, totalPages - 1)];
  } else if (scope === 'range') {
    targetIndices = parsePageRange(pageRange, totalPages);
  } else {
    // 'all'
    targetIndices = Array.from({ length: totalPages }, (_, i) => i);
  }

  if (targetIndices.length === 0) {
    targetIndices = [0];
  }

  const dim = PAGE_DIMENSIONS[pageSize] || PAGE_DIMENSIONS.a4;
  const pdfWidth = orientation === 'landscape' ? Math.max(dim.w, dim.h) : Math.min(dim.w, dim.h);
  const pdfHeight = orientation === 'landscape' ? Math.min(dim.w, dim.h) : Math.max(dim.w, dim.h);

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize,
    compress: true,
  });

  const margin = 10; // 10mm margin
  const usableWidth = pdfWidth - margin * 2;
  const usableHeight = pdfHeight - margin * 2;

  for (let i = 0; i < targetIndices.length; i++) {
    const pageIdx = targetIndices[i];
    const page = pages[pageIdx] || { elements: [] };

    onProgress({ current: i + 1, total: targetIndices.length, percent: Math.round(((i + 1) / targetIndices.length) * 100) });

    // Render page to image with its background
    const imgData = renderPageToDataUrl(page.elements, page.background || 'white', 1920, 1080);

    if (i > 0) {
      doc.addPage(pageSize, orientation);
    }

    if (imgData) {
      // Calculate aspect ratio fit within usable width and height
      const canvasAspect = 1920 / 1080;
      let imgW = usableWidth;
      let imgH = imgW / canvasAspect;

      if (imgH > usableHeight) {
        imgH = usableHeight;
        imgW = imgH * canvasAspect;
      }

      const x = margin + (usableWidth - imgW) / 2;
      const y = margin + (usableHeight - imgH) / 2;

      doc.addImage(imgData, 'JPEG', x, y, imgW, imgH, undefined, 'FAST');
    }

    // Small footer on each page: page number
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const footerText = `Page ${pageIdx + 1} of ${totalPages} — IVLA`;
    doc.text(footerText, margin, pdfHeight - 4);
  }

  const cleanTitle = (title || 'IVLA-Whiteboard')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${cleanTitle}_${dateStr}.pdf`;

  doc.save(filename);
  return filename;
}
