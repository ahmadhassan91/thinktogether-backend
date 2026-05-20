import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';
import type { DeckOutline, DeckSlide } from './aiDeck';

const COLORS = {
  ink: '313131',
  charcoal: '242424',
  muted: '606060',
  quiet: '8A8178',
  orange: 'F05828',
  redOrange: 'D94B28',
  teal: '48C0B0',
  darkTeal: '1A8A80',
  deep: '18313B',
  deep2: '213C48',
  glow: 'B9F3EA',
  green: '709848',
  softTeal: 'E4F6F3',
  softYellow: 'FFF5E7',
  softGreen: 'EEF5E9',
  softOrange: 'FDE9DF',
  warmGray: 'F4F0E8',
  yellow: 'F8A840',
  cream: 'FFFDF7',
  line: 'D9D5CC',
  hairline: 'ECE6DB',
  white: 'FFFFFF',
};

const SHAPE = {
  rect: 'rect',
  roundRect: 'roundRect',
  line: 'line',
} as const;

const MARGIN_X = 0.55;
const FOOTER_Y = 7.05;
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const LOGO_PATH = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'think-together-logo.png');
const LOGO_ASPECT_RATIO = 557 / 262;

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type TextScale = {
  base: number;
  medium: number;
  small: number;
  mediumAt: number;
  smallAt: number;
};

export async function renderDeckPptx(outline: DeckOutline): Promise<Buffer> {
  const PptxGen = ((pptxgen as unknown as { default?: typeof pptxgen }).default ?? pptxgen) as typeof pptxgen;
  const pptx = new PptxGen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Think Together Training MVP';
  pptx.company = 'Think Together';
  pptx.subject = `${outline.title} - ${outline.audience}`;
  pptx.title = outline.title;
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
  };

  const slides = Array.isArray(outline.slides) ? outline.slides : [];
  addTitleSlide(pptx, outline);
  slides.forEach((slide, index) => addTrainingSlide(pptx, outline, slide, index));
  addFacilitatorHandoffSlide(pptx, outline);
  addSourceSlide(pptx, outline);

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

function addTitleSlide(pptx: pptxgen, outline: DeckOutline) {
  const slide = pptx.addSlide();
  addBackground(slide);
  addBrandLogo(slide, 0.65, 0.58, 1.55);
  slide.addShape(SHAPE.rect, {
    x: 9.42,
    y: 0,
    w: 3.91,
    h: SLIDE_H,
    fill: { color: COLORS.warmGray },
    line: { color: COLORS.warmGray },
  });
  slide.addShape(SHAPE.rect, {
    x: 9.42,
    y: 5.28,
    w: 3.91,
    h: 1.98,
    fill: { color: COLORS.softTeal },
    line: { color: COLORS.softTeal },
  });
  slide.addShape(SHAPE.rect, {
    x: 10.0,
    y: 0.75,
    w: 2.25,
    h: 0.12,
    fill: { color: COLORS.yellow },
    line: { color: COLORS.yellow },
  });
  slide.addText('THINK TOGETHER TRAINING', {
    x: 0.75,
    y: 2.0,
    w: 5.3,
    h: 0.3,
    color: COLORS.orange,
    fontFace: 'Aptos',
    fontSize: 12,
    bold: true,
    margin: 0,
    breakLine: false,
  });
  slide.addText(outline.title, {
    x: 0.75,
    y: 2.32,
    w: 7.65,
    h: 1.78,
    color: COLORS.charcoal,
    fontFace: 'Aptos Display',
    fontSize: scaledFont(outline.title, { base: 34, medium: 30, small: 26, mediumAt: 58, smallAt: 84 }),
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText(`${outline.durationMinutes} minutes | ${outline.audience}`, {
    x: 0.78,
    y: 4.18,
    w: 6.5,
    h: 0.35,
    color: COLORS.muted,
    fontSize: 15,
    margin: 0,
  });
  slide.addText(String(outline.durationMinutes), {
    x: 10.02,
    y: 1.46,
    w: 1.32,
    h: 0.78,
    color: COLORS.orange,
    fontFace: 'Aptos Display',
    fontSize: 38,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('MINUTE\nFACILITATION ARC', {
    x: 11.34,
    y: 1.58,
    w: 1.2,
    h: 0.45,
    color: COLORS.muted,
    fontSize: 7.5,
    bold: true,
    breakLine: false,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(compact(outline.audience, 90), {
    x: 10.02,
    y: 2.48,
    w: 2.58,
    h: 0.66,
    color: COLORS.ink,
    fontSize: 13,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  addObjectiveBand(slide, safeList(outline.learningObjectives).slice(0, 3));
  addTitleSourceBadge(slide, safeList(outline.sourceArtifacts));
  addFooter(slide, outline, 'Title');
}

function addTrainingSlide(pptx: pptxgen, outline: DeckOutline, slideData: DeckSlide, index: number) {
  const slide = pptx.addSlide();
  addReadableTrainingBackground(slide, index);
  addTopBar(slide, index + 1, outline.slides.length);
  const visualType = resolveVisualType(slideData);
  slide.addText(slideData.title, {
    x: 0.72,
    y: 0.9,
    w: 11.2,
    h: 0.68,
    color: COLORS.charcoal,
    fontFace: 'Aptos Display',
    fontSize: scaledFont(slideData.title, { base: 28, medium: 25, small: 22, mediumAt: 58, smallAt: 82 }),
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(slideData.objective, {
    x: 0.72,
    y: 1.58,
    w: 10.9,
    h: 0.38,
    color: COLORS.darkTeal,
    fontSize: scaledFont(slideData.objective, { base: 13.5, medium: 12.2, small: 11.2, mediumAt: 92, smallAt: 128 }),
    bold: true,
    margin: 0,
    fit: 'shrink',
  });

  if (visualType === 'loop') {
    addLoopSlide(slide, slideData);
  } else if (visualType === 'pyramid') {
    addPyramidSlide(slide, slideData);
  } else if (visualType === 'timeline') {
    addTimelineSlide(slide, slideData);
  } else if (visualType === 'scorecard') {
    addScorecardSlide(slide, slideData);
  } else if (visualType === 'matrix') {
    addMatrixSlide(slide, slideData);
  } else if (visualType === 'scenario-ladder') {
    addScenarioSlide(slide, slideData);
  } else if (visualType === 'commitment-map') {
    addCommitmentSlide(slide, slideData);
  } else {
    addProcessSlide(slide, slideData);
  }

  addEvidenceStrip(slide, slideData);
  addFooter(slide, outline, `Slide ${index + 1}`);
}

function addLoopSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const stages = visualStages(slideData, 4);
  addDarkStage(slide, { x: 0.72, y: 2.12, w: 7.15, h: 3.92 });
  addSectionLabel(slide, '10:2 practice loop', { x: 1.0, y: 2.32, w: 3.6, h: 0.34 }, COLORS.glow);
  const ring = { x: 2.66, y: 2.64, w: 3.06, h: 3.06 };
  slide.addShape('ellipse', {
    ...ring,
    fill: { color: COLORS.deep2, transparency: 24 },
    line: { color: COLORS.glow, width: 1.6, transparency: 12 },
  });
  slide.addShape('ellipse', {
    x: ring.x + 0.18,
    y: ring.y + 0.18,
    w: ring.w - 0.36,
    h: ring.h - 0.36,
    fill: { color: COLORS.deep, transparency: 100 },
    line: { color: COLORS.teal, width: 0.8, transparency: 45 },
  });
  const orbitMarks = [
    { x: 4.0, y: 2.4, color: COLORS.orange },
    { x: 5.6, y: 3.88, color: COLORS.teal },
    { x: 4.0, y: 5.36, color: COLORS.green },
    { x: 2.4, y: 3.88, color: COLORS.yellow },
  ];
  orbitMarks.forEach((mark, index) => {
    slide.addShape('ellipse', {
      x: mark.x,
      y: mark.y,
      w: 0.42,
      h: 0.42,
      fill: { color: mark.color },
      line: { color: COLORS.white, transparency: 30 },
    });
    slide.addText(String(index + 1), {
      x: mark.x,
      y: mark.y + 0.09,
      w: 0.42,
      h: 0.12,
      color: COLORS.white,
      fontSize: 8.2,
      bold: true,
      align: 'center',
      margin: 0,
    });
  });
  slide.addShape('ellipse', {
    x: 3.23,
    y: 3.17,
    w: 1.88,
    h: 1.88,
    fill: { color: COLORS.deep2 },
    line: { color: COLORS.glow, width: 1.2, transparency: 12 },
  });
  slide.addText('10:2', {
    x: 3.48,
    y: 3.56,
    w: 1.38,
    h: 0.45,
    color: COLORS.orange,
    fontFace: 'Aptos Display',
    fontSize: 31,
    bold: true,
    align: 'center',
    margin: 0,
  });
  slide.addText('teach + practice', {
    x: 3.42,
    y: 3.9,
    w: 1.36,
    h: 0.18,
    color: COLORS.glow,
    fontSize: 9.4,
    bold: true,
    align: 'center',
    margin: 0,
    fit: 'shrink',
  });

  const nodes = [
    { x: 1.04, y: 2.88, accent: COLORS.orange },
    { x: 6.1, y: 2.88, accent: COLORS.teal },
    { x: 6.1, y: 4.46, accent: COLORS.green },
    { x: 1.04, y: 4.46, accent: COLORS.yellow },
  ];

  stages.slice(0, 4).forEach((stage, index) => {
    const node = nodes[index];
    slide.addShape(SHAPE.roundRect, {
      x: node.x,
      y: node.y,
      w: 1.28,
      h: 0.88,
      rectRadius: 0.08,
      fill: { color: COLORS.deep2, transparency: 4 },
      line: { color: node.accent, transparency: 8 },
    });
    addNumberBadge(slide, String(index + 1), { x: node.x + 0.12, y: node.y + 0.12, w: 0.32, h: 0.32 }, node.accent);
    slide.addText(stage.label, {
      x: node.x + 0.16,
      y: node.y + 0.52,
      w: 0.96,
      h: 0.22,
      color: COLORS.white,
      fontSize: scaledFont(stage.label, { base: 10.4, medium: 9.2, small: 8.2, mediumAt: 20, smallAt: 30 }),
      bold: true,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
    if (stage.detail) {
      slide.addText(compact(stage.detail, 46), {
        x: node.x + 0.16,
        y: node.y + 0.74,
        w: 0.88,
        h: 0.14,
        color: COLORS.glow,
        fontSize: 6.8,
        align: 'center',
        fit: 'shrink',
        margin: 0,
      });
    }
  });
  addVisualCallout(slide, slideData, { x: 1.0, y: 5.46, w: 6.56, h: 0.42 });
  addActivityCard(slide, slideData.activityPrompt, 0, { x: 8.42, y: 2.34, w: 3.76, h: 1.72 });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 8.42, y: 4.36, w: 3.76, h: 1.16 });
}

function addPyramidSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const stages = visualStages(slideData, 3);
  addDarkStage(slide, { x: 0.72, y: 2.12, w: 7.15, h: 3.92 });
  addSectionLabel(slide, 'PBIS tier pyramid', { x: 1.0, y: 2.32, w: 3.0, h: 0.34 }, COLORS.glow);
  slide.addText('UNIVERSAL', {
    x: 5.72,
    y: 5.34,
    w: 1.4,
    h: 0.18,
    color: COLORS.glow,
    fontSize: 7,
    bold: true,
    align: 'right',
    margin: 0,
    fit: 'shrink',
  });
  const bands = [
    { x: 3.03, y: 2.74, w: 1.95, h: 0.5, depth: 0.24, color: COLORS.orange, label: 'Tier 3', pct: '5%', fill: '5B3741' },
    { x: 2.17, y: 3.56, w: 3.66, h: 0.56, depth: 0.28, color: COLORS.yellow, label: 'Tier 2', pct: '15%', fill: '5C4B34' },
    { x: 1.18, y: 4.52, w: 5.62, h: 0.64, depth: 0.34, color: COLORS.teal, label: 'Tier 1', pct: '80%', fill: '214E50' },
  ];
  bands.forEach((band, index) => {
    const stage = stages[index] ?? stages[stages.length - 1];
    addStepBlock(slide, {
      x: band.x,
      y: band.y,
      w: band.w,
      h: band.h,
      depth: band.depth,
      fill: band.fill,
      accent: band.color,
    });
    slide.addText(band.label, {
      x: band.x + 0.18,
      y: band.y + 0.13,
      w: 0.72,
      h: 0.18,
      color: band.color,
      fontSize: 9.4,
      bold: true,
      margin: 0,
    });
    slide.addText(band.pct, {
      x: band.x + band.w - 0.55,
      y: band.y + 0.12,
      w: 0.36,
      h: 0.18,
      color: band.color,
      fontSize: 8.8,
      bold: true,
      align: 'right',
      margin: 0,
    });
    slide.addText(stage.label, {
      x: band.x + 0.92,
      y: band.y + 0.12,
      w: band.w - 1.34,
      h: 0.22,
      color: COLORS.white,
      fontSize: scaledFont(stage.label, { base: 12.4, medium: 10.8, small: 9.3, mediumAt: 32, smallAt: 44 }),
      bold: true,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
    if (stage.detail) {
      slide.addText(compact(stage.detail, 58), {
        x: band.x + 0.92,
        y: band.y + 0.34,
        w: band.w - 1.34,
        h: 0.18,
        color: COLORS.glow,
        fontSize: 7.4,
        align: 'center',
        fit: 'shrink',
        margin: 0,
      });
    }
  });
  addVisualCallout(slide, slideData, { x: 1.0, y: 5.48, w: 6.56, h: 0.4 });
  addActivityCard(slide, slideData.activityPrompt, 1, { x: 8.42, y: 2.34, w: 3.76, h: 1.72 });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 8.42, y: 4.36, w: 3.76, h: 1.16 });
}

function addTimelineSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const stages = visualStages(slideData, 4);
  addVisualPanel(slide, { x: 0.62, y: 2.0, w: 6.0, h: 3.95 }, COLORS.white);
  addSectionLabel(slide, 'Training sequence', { x: 0.75, y: 2.08, w: 2.95, h: 0.3 }, COLORS.darkTeal);
  slide.addShape(SHAPE.line, {
    x: 1.0,
    y: 3.86,
    w: 5.1,
    h: 0,
    line: { color: COLORS.teal, width: 2.4, endArrowType: 'triangle' },
  });
  stages.slice(0, 4).forEach((stage, index) => {
    const x = 0.82 + index * 1.7;
    const cardY = index % 2 === 0 ? 2.58 : 4.38;
    const accent = [COLORS.orange, COLORS.teal, COLORS.green, COLORS.yellow][index] ?? COLORS.teal;
    slide.addShape('ellipse', {
      x,
      y: 3.5,
      w: 0.72,
      h: 0.72,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(String(index + 1), {
      x,
      y: 3.72,
      w: 0.72,
      h: 0.16,
      color: COLORS.white,
      fontSize: 9,
      bold: true,
      align: 'center',
      margin: 0,
    });
    slide.addShape(SHAPE.roundRect, {
      x: x - 0.18,
      y: cardY,
      w: 1.16,
      h: 0.74,
      rectRadius: 0.06,
      fill: { color: index % 2 === 0 ? COLORS.white : COLORS.softTeal },
      line: { color: COLORS.line },
    });
    slide.addText(stage.label, {
      x: x - 0.06,
      y: cardY + 0.2,
      w: 0.92,
      h: 0.25,
      color: COLORS.ink,
      fontSize: scaledFont(stage.label, { base: 7.8, medium: 7, small: 6.2, mediumAt: 22, smallAt: 30 }),
      bold: true,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
    slide.addShape(SHAPE.line, {
      x: x + 0.36,
      y: index % 2 === 0 ? cardY + 0.75 : 4.24,
      w: 0,
      h: index % 2 === 0 ? 0.18 : 0.15,
      line: { color: accent, width: 1.1 },
    });
  });
  addVisualCallout(slide, slideData, { x: 0.9, y: 5.5, w: 5.35, h: 0.42 });
  addActivityCard(slide, slideData.activityPrompt, 0, { x: 7.0, y: 1.94, w: 5.42, h: 2.02 });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 7.0, y: 4.2, w: 5.42, h: 1.38 });
}

function addScorecardSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const stages = visualStages(slideData, 4);
  addVisualPanel(slide, { x: 0.62, y: 2.0, w: 6.0, h: 3.9 }, COLORS.white);
  addSectionLabel(slide, 'Readiness scorecard', { x: 0.75, y: 2.08, w: 3.1, h: 0.3 }, COLORS.teal);
  stages.slice(0, 4).forEach((stage, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.82 + col * 2.86;
    const y = 2.48 + row * 1.34;
    const accent = [COLORS.teal, COLORS.green, COLORS.orange, COLORS.yellow][index] ?? COLORS.teal;
    slide.addShape(SHAPE.roundRect, {
      x,
      y,
      w: 2.48,
      h: 1.02,
      rectRadius: 0.08,
      fill: { color: index === 1 ? COLORS.softGreen : index === 2 ? COLORS.softYellow : COLORS.white },
      line: { color: COLORS.line },
    });
    slide.addShape('ellipse', {
      x: x + 0.2,
      y: y + 0.22,
      w: 0.42,
      h: 0.42,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(index === 2 ? '!' : 'OK', {
      x: x + 0.2,
      y: y + 0.3,
      w: 0.42,
      h: 0.12,
      color: COLORS.white,
      fontSize: 8,
      bold: true,
      align: 'center',
      margin: 0,
    });
    slide.addText(stage.label, {
      x: x + 0.78,
      y: y + 0.2,
      w: 1.38,
      h: 0.24,
      color: COLORS.ink,
      fontSize: scaledFont(stage.label, { base: 8.8, medium: 7.8, small: 7, mediumAt: 25, smallAt: 36 }),
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
    slide.addText(compact(stage.detail || 'Evidence ready for review', 58), {
      x: x + 0.78,
      y: y + 0.52,
      w: 1.42,
      h: 0.22,
      color: COLORS.muted,
      fontSize: 6.2,
      fit: 'shrink',
      margin: 0,
    });
    slide.addShape(SHAPE.rect, {
      x: x + 0.78,
      y: y + 0.83,
      w: 1.34,
      h: 0.05,
      fill: { color: COLORS.hairline },
      line: { color: COLORS.hairline },
    });
    slide.addShape(SHAPE.rect, {
      x: x + 0.78,
      y: y + 0.83,
      w: 0.5 + index * 0.2,
      h: 0.05,
      fill: { color: accent },
      line: { color: accent },
    });
  });
  addVisualCallout(slide, slideData, { x: 0.9, y: 5.42, w: 5.28, h: 0.48 });
  addActivityCard(slide, slideData.activityPrompt, 1, { x: 7.0, y: 1.94, w: 5.42, h: 2.02 });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 7.0, y: 4.2, w: 5.42, h: 1.38 });
}

function addProcessSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const points = padPoints(slideData.talkingPoints, 3);
  addSectionLabel(slide, '10:2 facilitation flow', { x: 0.75, y: 2.08, w: 3.25, h: 0.3 }, COLORS.orange);
  slide.addShape(SHAPE.line, {
    x: 1.28,
    y: 3.02,
    w: 5.15,
    h: 0,
    line: { color: COLORS.yellow, width: 3, beginArrowType: 'none', endArrowType: 'triangle' },
  });
  points.slice(0, 3).forEach((point, index) => {
    const x = 0.78 + index * 2.12;
    const accent = index === 0 ? COLORS.orange : index === 1 ? COLORS.teal : COLORS.green;
    slide.addShape('ellipse', {
      x,
      y: 2.58,
      w: 0.9,
      h: 0.9,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(`0${index + 1}`, {
      x,
      y: 2.86,
      w: 0.9,
      h: 0.2,
      color: COLORS.white,
      fontSize: 12,
      bold: true,
      align: 'center',
      margin: 0,
    });
    slide.addShape(SHAPE.roundRect, {
      x: x - 0.38,
      y: 3.72,
      w: 1.68,
      h: 1.16,
      rectRadius: 0.06,
      fill: { color: index === 1 ? COLORS.softTeal : COLORS.white },
      line: { color: index === 1 ? 'B7DED8' : COLORS.line },
    });
    slide.addText(point, {
      x: x - 0.2,
      y: 3.98,
      w: 1.32,
      h: 0.48,
      color: COLORS.ink,
      fontSize: 9.3,
      bold: true,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
  });
  addActivityCard(slide, slideData.activityPrompt, 0, { x: 7.15, y: 1.82, w: 5.28, h: 2.06 });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 7.15, y: 4.16, w: 5.28, h: 1.72 });
}

function addMatrixSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const points = padPoints(slideData.talkingPoints, 4);
  addSectionLabel(slide, 'Practice matrix', { x: 0.75, y: 2.08, w: 2.5, h: 0.3 }, COLORS.darkTeal);
  slide.addText('What staff say', {
    x: 1.35,
    y: 2.42,
    w: 1.65,
    h: 0.2,
    color: COLORS.muted,
    fontSize: 8,
    bold: true,
    margin: 0,
  });
  slide.addText('What staff do', {
    x: 4.42,
    y: 2.42,
    w: 1.65,
    h: 0.2,
    color: COLORS.muted,
    fontSize: 8,
    bold: true,
    margin: 0,
  });
  points.slice(0, 4).forEach((point, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.75 + col * 3.08;
    const y = 2.7 + row * 1.38;
    const fill = index % 2 === 0 ? COLORS.softTeal : COLORS.softYellow;
    const accent = index % 2 === 0 ? COLORS.teal : COLORS.orange;
    slide.addShape(SHAPE.roundRect, {
      x,
      y,
      w: 2.75,
      h: 1.05,
      rectRadius: 0.08,
      fill: { color: fill },
      line: { color: index % 2 === 0 ? 'B7DED8' : 'F3C6A8' },
    });
    slide.addShape(SHAPE.rect, {
      x,
      y,
      w: 0.08,
      h: 1.05,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(compact(point, 74), {
      x: x + 0.22,
      y: y + 0.28,
      w: 2.22,
      h: 0.44,
      color: COLORS.ink,
      fontSize: 9.5,
      bold: true,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
  });
  slide.addShape(SHAPE.rect, {
    x: 6.62,
    y: 2.06,
    w: 0.07,
    h: 3.55,
    fill: { color: COLORS.yellow },
    line: { color: COLORS.yellow },
  });
  addActivityCard(slide, slideData.activityPrompt, 1, { x: 7.15, y: 1.82, w: 5.28, h: 2.06 });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 7.15, y: 4.16, w: 5.28, h: 1.72 });
}

function addScenarioSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  slide.addShape(SHAPE.roundRect, {
    x: 0.95,
    y: 2.42,
    w: 6.45,
    h: 3.18,
    rectRadius: 0.08,
    fill: { color: COLORS.softTeal },
    line: { color: 'B7DED8' },
  });
  slide.addShape(SHAPE.rect, {
    x: 0.95,
    y: 2.42,
    w: 0.12,
    h: 3.18,
    fill: { color: COLORS.teal },
    line: { color: COLORS.teal },
  });
  slide.addText('Scenario Lab', {
    x: 1.25,
    y: 2.72,
    w: 2.2,
    h: 0.3,
    color: COLORS.orange,
    fontSize: 16,
    bold: true,
    margin: 0,
  });
  slide.addText(compact(slideData.activityPrompt, 220), {
    x: 1.25,
    y: 3.24,
    w: 5.7,
    h: 1.2,
    color: COLORS.ink,
    fontSize: 15.2,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText('Look for a response the facilitator can observe, coach, and repeat.', {
    x: 1.25,
    y: 4.88,
    w: 5.6,
    h: 0.3,
    color: COLORS.muted,
    fontSize: 11,
    margin: 0,
    fit: 'shrink',
  });
  const points = padPoints(slideData.talkingPoints, 3);
  addSectionLabel(slide, 'Response ladder', { x: 8.42, y: 2.34, w: 2.8, h: 0.3 }, COLORS.green);
  points.slice(0, 3).forEach((point, index) => {
    const y = 2.88 + index * 0.92;
    slide.addShape(SHAPE.roundRect, {
      x: 8.42,
      y,
      w: 3.76,
      h: 0.72,
      rectRadius: 0.06,
      fill: { color: index === 1 ? COLORS.softYellow : COLORS.white },
      line: { color: COLORS.line },
    });
    addNumberBadge(slide, String(index + 1), { x: 8.62, y: y + 0.2, w: 0.34, h: 0.34 }, index === 1 ? COLORS.orange : COLORS.teal);
    slide.addText(compact(point, 92), {
      x: 9.12,
      y: y + 0.16,
      w: 2.68,
      h: 0.38,
      color: COLORS.ink,
      fontSize: 11.5,
      bold: index === 0,
      fit: 'shrink',
      margin: 0,
    });
  });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 8.42, y: 5.04, w: 3.76, h: 0.86 });
}

function addCommitmentSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const points = padPoints(slideData.talkingPoints, 3);
  slide.addShape(SHAPE.roundRect, {
    x: 0.95,
    y: 2.42,
    w: 6.45,
    h: 3.18,
    rectRadius: 0.08,
    fill: { color: COLORS.softGreen },
    line: { color: 'C8DDB9' },
  });
  slide.addShape('ellipse', {
    x: 5.62,
    y: 2.72,
    w: 1.18,
    h: 1.18,
    fill: { color: COLORS.white, transparency: 70 },
    line: { color: COLORS.green, width: 2 },
  });
  slide.addText('Commitment Prompt', {
    x: 1.25,
    y: 2.72,
    w: 2.5,
    h: 0.3,
    color: COLORS.teal,
    fontSize: 16,
    bold: true,
    margin: 0,
  });
  slide.addText(compact(slideData.activityPrompt, 180), {
    x: 1.25,
    y: 3.24,
    w: 5.2,
    h: 1.14,
    color: COLORS.ink,
    fontSize: 15.2,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText('Capture one practice the learner can use in the next program session.', {
    x: 1.25,
    y: 4.84,
    w: 5.55,
    h: 0.32,
    color: COLORS.muted,
    fontSize: 11,
    margin: 0,
    fit: 'shrink',
  });
  addSectionLabel(slide, 'Transfer commitments', { x: 8.42, y: 2.34, w: 3.1, h: 0.3 }, COLORS.darkTeal);
  points.slice(0, 3).forEach((point, index) => {
    const y = 2.88 + index * 0.92;
    slide.addShape(SHAPE.roundRect, {
      x: 8.42,
      y,
      w: 3.76,
      h: 0.72,
      rectRadius: 0.08,
      fill: { color: index === 1 ? COLORS.softYellow : COLORS.white },
      line: { color: COLORS.line },
    });
    slide.addText(['Start', 'Practice', 'Share'][index] ?? `Step ${index + 1}`, {
      x: 8.62,
      y: y + 0.2,
      w: 0.78,
      h: 0.18,
      color: index === 1 ? COLORS.orange : COLORS.darkTeal,
      fontSize: 9.2,
      bold: true,
      margin: 0,
    });
    slide.addText(compact(point, 92), {
      x: 9.44,
      y: y + 0.16,
      w: 2.32,
      h: 0.36,
      color: COLORS.ink,
      fontSize: 10.8,
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
  });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 8.42, y: 5.04, w: 3.76, h: 0.86 });
}

function addFacilitatorHandoffSlide(pptx: pptxgen, outline: DeckOutline) {
  const slide = pptx.addSlide();
  addBackground(slide);
  const slideCount = safeList(outline.slides).length;
  addTopBar(slide, slideCount + 1, slideCount + 2);
  slide.addText('Facilitator Handoff', {
    x: MARGIN_X,
    y: 0.86,
    w: 6,
    h: 0.55,
    color: COLORS.ink,
    fontFace: 'Aptos Display',
    fontSize: 29,
    bold: true,
    margin: 0,
  });
  const handoffNotes = safeList(outline.handoffNotes);
  const notes = handoffNotes.length > 0 ? handoffNotes : [
    'Review source alignment before using this draft with staff.',
    'Localize examples to the site and cohort.',
    'Keep facilitation human-led and practice-oriented.',
  ];
  slide.addText(notes.slice(0, 5).map((note) => ({ text: note, options: { bullet: { indent: 14 }, hanging: 5 } })), {
    x: 0.85,
    y: 1.8,
    w: 6.6,
    h: 3.0,
    color: COLORS.ink,
    fontSize: 18,
    fit: 'shrink',
  });
  slide.addShape(SHAPE.rect, {
    x: 8.45,
    y: 1.35,
    w: 3.85,
    h: 4.2,
    rectRadius: 0.08,
    fill: { color: COLORS.softTeal },
    line: { color: 'B7DED8' },
  });
  slide.addText('Before Delivery', {
    x: 8.78,
    y: 1.7,
    w: 3.1,
    h: 0.35,
    color: COLORS.teal,
    fontSize: 15,
    bold: true,
    margin: 0,
  });
  slide.addText('1. Confirm audience and timing\n2. Pick site-specific scenarios\n3. Print or stage practice prompts\n4. Capture commitments after training', {
    x: 8.8,
    y: 2.25,
    w: 3.0,
    h: 2.45,
    color: COLORS.ink,
    fontSize: 15,
    breakLine: false,
    fit: 'shrink',
    margin: 0.02,
  });
  addFooter(slide, outline, 'Handoff');
}

function addSourceSlide(pptx: pptxgen, outline: DeckOutline) {
  const slide = pptx.addSlide();
  addBackground(slide);
  addBrandLogo(slide, 0.62, 0.55, 1.35);
  slide.addText('Source Artifacts', {
    x: 2.18,
    y: 0.6,
    w: 5.5,
    h: 0.48,
    color: COLORS.ink,
    fontFace: 'Aptos Display',
    fontSize: 28,
    bold: true,
    margin: 0,
  });
  slide.addText('Generated content must remain grounded in these materials and reviewed before facilitation.', {
    x: 1.35,
    y: 1.12,
    w: 8.5,
    h: 0.32,
    color: COLORS.muted,
    fontSize: 13,
    margin: 0,
  });
  const artifacts = safeList(outline.sourceArtifacts).slice(0, 10);
  artifacts.forEach((artifact, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = 0.85 + col * 5.9;
    const y = 1.85 + row * 0.82;
    slide.addShape(SHAPE.roundRect, {
      x,
      y,
      w: 5.15,
      h: 0.52,
      rectRadius: 0.06,
      fill: { color: index % 3 === 0 ? COLORS.softTeal : COLORS.cream },
      line: { color: COLORS.line },
    });
    slide.addText(artifact, {
      x: x + 0.2,
      y: y + 0.13,
      w: 4.75,
      h: 0.22,
      color: index % 3 === 0 ? COLORS.teal : COLORS.ink,
      fontSize: 11,
      bold: true,
      margin: 0,
      fit: 'shrink',
    });
  });
  addFooter(slide, outline, 'Sources');
}

function addBackground(slide: pptxgen.Slide) {
  slide.background = { color: COLORS.cream };
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.08,
    fill: { color: COLORS.orange },
    line: { color: COLORS.orange },
  });
}

function addReadableTrainingBackground(slide: pptxgen.Slide, index: number) {
  slide.background = { color: COLORS.cream };
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: COLORS.cream },
    line: { color: COLORS.cream },
  });
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.08,
    fill: { color: COLORS.orange },
    line: { color: COLORS.orange },
  });
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0.08,
    w: 0.1,
    h: SLIDE_H - 0.08,
    fill: { color: index % 2 === 0 ? COLORS.teal : COLORS.yellow },
    line: { color: index % 2 === 0 ? COLORS.teal : COLORS.yellow },
  });
  slide.addShape(SHAPE.rect, {
    x: 0.72,
    y: 2.12,
    w: 7.15,
    h: 3.92,
    fill: { color: COLORS.deep },
    line: { color: COLORS.deep },
  });
  slide.addShape(SHAPE.rect, {
    x: 8.15,
    y: 2.12,
    w: 4.35,
    h: 3.92,
    fill: { color: COLORS.white },
    line: { color: COLORS.hairline },
  });
}

function addDarkStage(slide: pptxgen.Slide, box: Box) {
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.04,
    fill: { color: COLORS.deep2, transparency: 2 },
    line: { color: COLORS.glow, transparency: 70 },
  });
  slide.addShape(SHAPE.rect, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: COLORS.white, transparency: 100 },
    line: { color: COLORS.white, transparency: 100 },
  });
}

function addStepBlock(slide: pptxgen.Slide, block: Box & { depth: number; fill: string; accent: string }) {
  slide.addShape(SHAPE.rect, {
    x: block.x + 0.16,
    y: block.y + block.h,
    w: block.w,
    h: block.depth,
    fill: { color: block.accent, transparency: 38 },
    line: { color: block.accent, transparency: 45 },
  });
  slide.addShape(SHAPE.rect, {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h,
    fill: { color: block.fill },
    line: { color: block.accent, width: 1.2 },
  });
  slide.addShape(SHAPE.rect, {
    x: block.x + block.w - 0.04,
    y: block.y + 0.04,
    w: 0.18,
    h: block.h + block.depth - 0.03,
    fill: { color: block.accent, transparency: 62 },
    line: { color: block.accent, transparency: 100 },
  });
  slide.addShape(SHAPE.line, {
    x: block.x + 0.06,
    y: block.y + 0.08,
    w: block.w - 0.12,
    h: 0,
    line: { color: COLORS.white, transparency: 55, width: 0.6 },
  });
}

function addBrandLogo(slide: pptxgen.Slide, x: number, y: number, width: number) {
  if (existsSync(LOGO_PATH)) {
    slide.addImage({
      path: LOGO_PATH,
      x,
      y,
      w: width,
      h: width / LOGO_ASPECT_RATIO,
    });
    return;
  }

  addBrandFallback(slide, x, y, Math.min(width, 0.85));
}

function addBrandFallback(slide: pptxgen.Slide, x: number, y: number, size: number) {
  slide.addShape(SHAPE.roundRect, {
    x,
    y,
    w: size,
    h: size,
    rectRadius: 0.07,
    fill: { color: COLORS.orange },
    line: { color: COLORS.orange },
  });
  slide.addText('TT', {
    x,
    y: y + size * 0.32,
    w: size,
    h: size * 0.32,
    color: COLORS.white,
    fontSize: Math.max(12, size * 22),
    bold: true,
    align: 'center',
    margin: 0,
  });
}

function addVisualPanel(slide: pptxgen.Slide, box: Box, fill: string) {
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.06,
    fill: { color: fill, transparency: fill === COLORS.white ? 0 : 18 },
    line: { color: COLORS.hairline },
  });
  slide.addShape(SHAPE.rect, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: 0.08,
    fill: { color: COLORS.white, transparency: 45 },
    line: { color: COLORS.white, transparency: 100 },
  });
}

function addTopBar(slide: pptxgen.Slide, slideNumber: number, total: number, dark = false) {
  addBrandLogo(slide, 0.56, 0.25, 1.0);
  slide.addText('THINK TOGETHER', {
    x: 1.72,
    y: 0.27,
    w: 2.2,
    h: 0.2,
    color: dark ? COLORS.glow : COLORS.teal,
    fontSize: 9,
    bold: true,
    margin: 0,
  });
  slide.addText('Program Induction | PBIS', {
    x: 1.72,
    y: 0.47,
    w: 3.2,
    h: 0.2,
    color: dark ? COLORS.white : COLORS.muted,
    transparency: dark ? 18 : 0,
    fontSize: 9,
    margin: 0,
  });
  slide.addText(`${slideNumber}/${total}`, {
    x: 11.8,
    y: 0.28,
    w: 0.8,
    h: 0.22,
    color: dark ? COLORS.teal : COLORS.teal,
    fontSize: 10,
    bold: true,
    align: 'right',
    margin: 0,
  });
  addBadge(slide, 'SOURCE LINKED', { x: 9.58, y: 0.25, w: 1.38, h: 0.28 }, COLORS.darkTeal, COLORS.softTeal);
  addBadge(slide, 'REVIEW REQ.', { x: 11.02, y: 0.25, w: 0.96, h: 0.28 }, COLORS.orange, COLORS.softYellow);
}

function addSectionLabel(slide: pptxgen.Slide, label: string, box: Box, color: string) {
  slide.addShape('ellipse', {
    x: box.x,
    y: box.y + 0.05,
    w: 0.12,
    h: 0.12,
    fill: { color },
    line: { color },
  });
  slide.addText(label.toUpperCase(), {
    x: box.x + 0.2,
    y: box.y,
    w: Math.max(0.2, box.w - 0.2),
    h: box.h,
    color,
    fontSize: 8.5,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addShape(SHAPE.line, {
    x: box.x + 0.2,
    y: box.y + box.h - 0.03,
    w: Math.min(1.12, Math.max(0.48, box.w * 0.38)),
    h: 0,
    line: { color, width: 1.2 },
  });
}

function addNumberBadge(slide: pptxgen.Slide, label: string, box: Box, color: string) {
  slide.addShape('ellipse', {
    ...box,
    fill: { color },
    line: { color },
  });
  slide.addText(label, {
    x: box.x,
    y: box.y + box.h * 0.25,
    w: box.w,
    h: box.h * 0.35,
    color: COLORS.white,
    fontSize: 7,
    bold: true,
    align: 'center',
    margin: 0,
  });
}

function addActivityCard(slide: pptxgen.Slide, prompt: string, index: number, box: Box = { x: 7.25, y: 1.75, w: 5.2, h: 1.72 }) {
  const fill = index % 2 === 0 ? COLORS.softTeal : COLORS.softYellow;
  const accent = index % 2 === 0 ? COLORS.teal : COLORS.orange;
  const promptText = compact(prompt, textLimitForBox(box, 92));
  const promptSize = scaledFont(promptText, { base: 15.5, medium: 13.8, small: 12.4, mediumAt: 62, smallAt: 86 });
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.05,
    fill: { color: fill, transparency: 6 },
    line: { color: index % 2 === 0 ? 'B7DED8' : 'F3C6A8', transparency: 8 },
  });
  slide.addShape(SHAPE.rect, {
    x: box.x,
    y: box.y,
    w: 0.1,
    h: box.h,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addShape(SHAPE.rect, {
    x: box.x + 0.1,
    y: box.y,
    w: box.w - 0.1,
    h: 0.46,
    fill: { color: COLORS.white, transparency: 30 },
    line: { color: COLORS.white, transparency: 100 },
  });
  addBadge(slide, 'ACTIVITY', { x: box.x + 0.28, y: box.y + 0.18, w: 0.82, h: 0.28 }, accent, COLORS.white);
  slide.addText('Practice Moment', {
    x: box.x + 1.2,
    y: box.y + 0.17,
    w: box.w - 1.52,
    h: 0.28,
    color: accent,
    fontSize: 13.5,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addShape('ellipse', {
    x: box.x + box.w - 0.72,
    y: box.y + 0.2,
    w: 0.36,
    h: 0.36,
    fill: { color: COLORS.white, transparency: 18 },
    line: { color: accent, transparency: 35 },
  });
  slide.addText('?', {
    x: box.x + box.w - 0.72,
    y: box.y + 0.29,
    w: 0.36,
    h: 0.12,
    color: accent,
    fontSize: 9,
    bold: true,
    align: 'center',
    margin: 0,
  });
  slide.addText(promptText, {
    x: box.x + 0.38,
    y: box.y + 0.7,
    w: box.w - 0.82,
    h: Math.max(0.62, box.h - 0.98),
    color: COLORS.ink,
    fontSize: promptSize,
    bold: true,
    fit: 'shrink',
    margin: 0.02,
  });
}

function addFacilitatorNote(slide: pptxgen.Slide, note: string, box: Box = { x: 7.25, y: 3.82, w: 5.2, h: 1.28 }) {
  const noteText = compact(note, textLimitForBox(box, 96));
  const noteSize = scaledFont(noteText, { base: 12.5, medium: 11.2, small: 10.2, mediumAt: 70, smallAt: 92 });
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.05,
    fill: { color: COLORS.white },
    line: { color: COLORS.hairline },
  });
  slide.addShape(SHAPE.rect, {
    x: box.x,
    y: box.y,
    w: 0.08,
    h: box.h,
    fill: { color: COLORS.yellow },
    line: { color: COLORS.yellow },
  });
  addBadge(slide, 'REVIEW', { x: box.x + box.w - 0.9, y: box.y + 0.15, w: 0.58, h: 0.22 }, COLORS.orange, COLORS.softYellow);
  slide.addText('Facilitator note', {
    x: box.x + 0.3,
    y: box.y + 0.17,
    w: box.w - 1.42,
    h: 0.2,
    color: COLORS.muted,
    fontSize: 10.5,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(noteText, {
    x: box.x + 0.3,
    y: box.y + 0.48,
    w: box.w - 0.65,
    h: Math.max(0.28, box.h - 0.68),
    color: COLORS.ink,
    fontSize: noteSize,
    fit: 'shrink',
    margin: 0.02,
  });
}

function resolveVisualType(slideData: DeckSlide): NonNullable<DeckSlide['visualSpec']>['type'] {
  if (slideData.visualSpec?.type) return slideData.visualSpec.type;
  if (slideData.layout === 'loop') return 'loop';
  if (slideData.layout === 'pyramid') return 'pyramid';
  if (slideData.layout === 'timeline') return 'timeline';
  if (slideData.layout === 'scorecard') return 'scorecard';
  if (slideData.layout === 'matrix') return 'matrix';
  if (slideData.layout === 'scenario') return 'scenario-ladder';
  if (slideData.layout === 'commitment') return 'commitment-map';
  return 'flow';
}

function visualStages(slideData: DeckSlide, minimum: number) {
  const visualStages = slideData.visualSpec?.stages?.filter((stage) => stage.label) ?? [];
  const talkingPointStages = safeList(slideData.talkingPoints)
    .filter(Boolean)
    .map((point) => ({ label: compact(point, 34), detail: '' }));
  const fallback = [
    { label: 'Teach it', detail: 'Name the expected routine' },
    { label: 'Model it', detail: 'Show what success looks like' },
    { label: 'Practice it', detail: 'Give staff a short rehearsal' },
    { label: 'Check it', detail: 'Confirm transfer to site' },
    { label: 'Reinforce', detail: 'Notice the expected behavior' },
  ];
  return [...visualStages, ...talkingPointStages, ...fallback].slice(0, Math.max(minimum, visualStages.length));
}

function addVisualCallout(slide: pptxgen.Slide, slideData: DeckSlide, box: Box) {
  const text = slideData.visualSpec?.callout || slideData.visualSpec?.headline || slideData.objective;
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.06,
    fill: { color: COLORS.softYellow },
    line: { color: 'F3C6A8' },
  });
  slide.addText(compact(text, textLimitForBox(box, 120)), {
    x: box.x + 0.18,
    y: box.y + 0.16,
    w: box.w - 0.36,
    h: box.h - 0.22,
    color: COLORS.orange,
    fontSize: scaledFont(text, { base: 8.5, medium: 7.6, small: 6.8, mediumAt: 78, smallAt: 112 }),
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
}

function padPoints(points: string[], minimum: number) {
  const fallback = ['Teach the expectation', 'Practice the routine', 'Reinforce the behavior', 'Transfer to site'];
  const validPoints = safeList(points);
  const combined = [...validPoints.filter(Boolean).map((point) => compact(point, 86)), ...fallback];
  return combined.slice(0, Math.max(minimum, validPoints.length));
}

function addObjectiveBand(slide: pptxgen.Slide, objectives: string[]) {
  const items = objectives.length > 0 ? objectives : ['Practice source-grounded facilitation', 'Apply PBIS routines at site'];
  slide.addShape(SHAPE.roundRect, {
    x: 0.75,
    y: 4.98,
    w: 7.55,
    h: 1.24,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.hairline },
  });
  slide.addShape(SHAPE.rect, {
    x: 0.75,
    y: 4.98,
    w: 0.1,
    h: 1.24,
    fill: { color: COLORS.teal },
    line: { color: COLORS.teal },
  });
  slide.addText('Key Outcomes', {
    x: 1.05,
    y: 5.16,
    w: 2.2,
    h: 0.22,
    color: COLORS.teal,
    fontSize: 11,
    bold: true,
    margin: 0,
  });
  items.slice(0, 3).forEach((item, index) => {
    const x = 1.05 + index * 2.15;
    addNumberBadge(slide, String(index + 1), { x, y: 5.5, w: 0.28, h: 0.28 }, index === 1 ? COLORS.orange : COLORS.darkTeal);
    slide.addText(compact(item, 70), {
      x: x + 0.38,
      y: 5.46,
      w: 1.4,
      h: 0.44,
      color: COLORS.ink,
      fontSize: 7.8,
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
  });
}

function addTitleSourceBadge(slide: pptxgen.Slide, sourceArtifacts: string[]) {
  const sources = sourceArtifacts.slice(0, 3);
  const text = sources.length > 0 ? sources.join('\n') : 'Think Together PBIS and SOP artifacts';
  addBadge(slide, 'SOURCE-GROUNDED DRAFT', { x: 10.02, y: 5.7, w: 1.72, h: 0.26 }, COLORS.orange, COLORS.softYellow);
  addBadge(slide, 'HUMAN REVIEW', { x: 10.02, y: 6.0, w: 1.24, h: 0.24 }, COLORS.darkTeal, COLORS.white);
  slide.addText(text, {
    x: 10.02,
    y: 6.32,
    w: 2.48,
    h: 0.46,
    color: COLORS.ink,
    fontSize: scaledFont(text, { base: 7.8, medium: 7.1, small: 6.5, mediumAt: 76, smallAt: 112 }),
    margin: 0,
    fit: 'shrink',
  });
}

function addBadge(slide: pptxgen.Slide, label: string, box: Box, color: string, fill: string) {
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.03,
    fill: { color: fill, transparency: fill === COLORS.white ? 0 : 12 },
    line: { color, transparency: 25 },
  });
  slide.addText(label, {
    x: box.x + 0.06,
    y: box.y + box.h * 0.28,
    w: box.w - 0.12,
    h: box.h * 0.34,
    color,
    fontSize: scaledFont(label, { base: 6.4, medium: 5.8, small: 5.2, mediumAt: 13, smallAt: 18 }),
    bold: true,
    align: 'center',
    margin: 0,
    fit: 'shrink',
  });
}

function scaledFont(value: string, scale: TextScale) {
  const length = value.replace(/\s+/g, ' ').trim().length;
  if (length >= scale.smallAt) return scale.small;
  if (length >= scale.mediumAt) return scale.medium;
  return scale.base;
}

function textLimitForBox(box: Box, defaultLimit: number) {
  const area = Math.max(0.1, box.w * box.h);
  return Math.max(84, Math.min(defaultLimit, Math.floor(area * 15)));
}

function compact(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, Math.max(0, maxLength - 1));
  const breakAt = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf(';'), sliced.lastIndexOf(','));
  const base = breakAt > maxLength * 0.45 ? sliced.slice(0, breakAt) : sliced;
  return `${base.trim()}...`;
}

function addEvidenceStrip(slide: pptxgen.Slide, slideData: DeckSlide) {
  const refs = safeList(slideData.sourceRefs);
  const primary = refs[0] ? `${refs[0].artifact} - ${refs[0].locator}` : 'Think Together PBIS/SOP artifacts';
  const secondary = refs.slice(1, 3).map((ref) => ref.locator).join(' | ');
  slide.addShape(SHAPE.roundRect, {
    x: MARGIN_X,
    y: 6.34,
    w: 12.1,
    h: 0.42,
    rectRadius: 0.04,
    fill: { color: COLORS.white, transparency: 8 },
    line: { color: COLORS.hairline },
  });
  slide.addShape(SHAPE.rect, {
    x: MARGIN_X,
    y: 6.34,
    w: 0.08,
    h: 0.42,
    fill: { color: COLORS.darkTeal },
    line: { color: COLORS.darkTeal },
  });
  addBadge(slide, 'EVIDENCE', { x: MARGIN_X + 0.22, y: 6.44, w: 0.74, h: 0.2 }, COLORS.darkTeal, COLORS.softTeal);
  slide.addText(compact(primary, 118), {
    x: MARGIN_X + 1.1,
    y: 6.44,
    w: 6.25,
    h: 0.16,
    color: COLORS.ink,
    fontSize: 6.9,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(compact(secondary || 'Review exact slide/page references before facilitation', 112), {
    x: MARGIN_X + 7.48,
    y: 6.44,
    w: 4.65,
    h: 0.16,
    color: COLORS.muted,
    fontSize: 6.7,
    italic: !secondary,
    align: 'right',
    margin: 0,
    fit: 'shrink',
  });
}

function safeList<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function addFooter(slide: pptxgen.Slide, outline: DeckOutline, label: string) {
  slide.addShape(SHAPE.line, {
    x: MARGIN_X,
    y: FOOTER_Y - 0.12,
    w: 12.15,
    h: 0,
    line: { color: COLORS.line, width: 0.5 },
  });
  slide.addText(`Generated draft | ${outline.provider} | ${label}`, {
    x: MARGIN_X,
    y: FOOTER_Y,
    w: 4.8,
    h: 0.18,
    color: COLORS.muted,
    fontSize: 7.5,
    margin: 0,
  });
  slide.addText('Human review required before facilitation', {
    x: 8.7,
    y: FOOTER_Y,
    w: 3.8,
    h: 0.18,
    color: COLORS.orange,
    fontSize: 7.5,
    bold: true,
    align: 'right',
    margin: 0,
  });
}
