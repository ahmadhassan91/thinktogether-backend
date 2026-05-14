import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';
import type { DeckOutline, DeckSlide } from './aiDeck';

const COLORS = {
  ink: '313131',
  muted: '606060',
  orange: 'F05828',
  teal: '48C0B0',
  darkTeal: '1A8A80',
  green: '709848',
  softTeal: 'E4F6F3',
  softYellow: 'FFF5E7',
  softGreen: 'EEF5E9',
  yellow: 'F8A840',
  cream: 'FFFDF7',
  line: 'D9D5CC',
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

  addTitleSlide(pptx, outline);
  outline.slides.forEach((slide, index) => addTrainingSlide(pptx, outline, slide, index));
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
    x: 9.65,
    y: 0,
    w: 3.68,
    h: SLIDE_H,
    fill: { color: COLORS.softTeal },
    line: { color: COLORS.softTeal },
  });
  slide.addShape(SHAPE.rect, {
    x: 9.65,
    y: 5.52,
    w: 3.68,
    h: 1.98,
    fill: { color: COLORS.softYellow },
    line: { color: COLORS.softYellow },
  });
  slide.addShape(SHAPE.rect, {
    x: 10.15,
    y: 0.75,
    w: 2.1,
    h: 0.18,
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
    y: 2.4,
    w: 7.9,
    h: 1.68,
    color: COLORS.ink,
    fontFace: 'Aptos Display',
    fontSize: 32,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText(`${outline.durationMinutes} minutes | ${outline.audience}`, {
    x: 0.78,
    y: 4.22,
    w: 6.5,
    h: 0.35,
    color: COLORS.muted,
    fontSize: 15,
    margin: 0,
  });
  addObjectiveBand(slide, outline.learningObjectives.slice(0, 3));
  addTitleSourceBadge(slide, outline.sourceArtifacts);
  addFooter(slide, outline, 'Title');
}

function addTrainingSlide(pptx: pptxgen, outline: DeckOutline, slideData: DeckSlide, index: number) {
  const slide = pptx.addSlide();
  addBackground(slide);
  addTopBar(slide, index + 1, outline.slides.length);
  slide.addText(slideData.title, {
    x: MARGIN_X,
    y: 0.78,
    w: 9.05,
    h: 0.74,
    color: COLORS.ink,
    fontFace: 'Aptos Display',
    fontSize: 21.5,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(slideData.objective, {
    x: MARGIN_X,
    y: 1.6,
    w: 8.9,
    h: 0.36,
    color: COLORS.darkTeal,
    fontSize: 11,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });

  if (slideData.layout === 'matrix') {
    addMatrixSlide(slide, slideData);
  } else if (slideData.layout === 'scenario') {
    addScenarioSlide(slide, slideData);
  } else if (slideData.layout === 'commitment') {
    addCommitmentSlide(slide, slideData);
  } else {
    addProcessSlide(slide, slideData);
  }

  addSourceFootnote(slide, slideData);
  addFooter(slide, outline, `Slide ${index + 1}`);
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
    x: 0.75,
    y: 2.08,
    w: 5.9,
    h: 3.45,
    rectRadius: 0.08,
    fill: { color: COLORS.softTeal },
    line: { color: 'B7DED8' },
  });
  slide.addShape(SHAPE.rect, {
    x: 0.75,
    y: 2.08,
    w: 0.12,
    h: 3.45,
    fill: { color: COLORS.teal },
    line: { color: COLORS.teal },
  });
  slide.addText('Scenario Lab', {
    x: 1.05,
    y: 2.34,
    w: 2.2,
    h: 0.3,
    color: COLORS.orange,
    fontSize: 14,
    bold: true,
    margin: 0,
  });
  slide.addText(compact(slideData.activityPrompt, 220), {
    x: 1.05,
    y: 2.82,
    w: 5.25,
    h: 1.38,
    color: COLORS.ink,
    fontSize: 12.2,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText('Look for a response the facilitator can observe, coach, and repeat.', {
    x: 1.05,
    y: 4.68,
    w: 4.9,
    h: 0.3,
    color: COLORS.muted,
    fontSize: 9.2,
    margin: 0,
    fit: 'shrink',
  });
  const points = padPoints(slideData.talkingPoints, 3);
  addSectionLabel(slide, 'Response ladder', { x: 7.15, y: 1.82, w: 2.8, h: 0.28 }, COLORS.green);
  points.slice(0, 3).forEach((point, index) => {
    const y = 2.28 + index * 1.08;
    slide.addShape(SHAPE.roundRect, {
      x: 7.15,
      y,
      w: 5.28,
      h: 0.82,
      rectRadius: 0.06,
      fill: { color: index === 1 ? COLORS.softYellow : COLORS.white },
      line: { color: COLORS.line },
    });
    addNumberBadge(slide, String(index + 1), { x: 7.42, y: y + 0.22, w: 0.32, h: 0.32 }, index === 1 ? COLORS.orange : COLORS.teal);
    slide.addText(compact(point, 92), {
      x: 7.92,
      y: y + 0.2,
      w: 4.0,
      h: 0.38,
      color: COLORS.ink,
      fontSize: 9.5,
      bold: index === 0,
      fit: 'shrink',
      margin: 0,
    });
  });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 7.15, y: 5.0, w: 5.28, h: 0.88 });
}

function addCommitmentSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const points = padPoints(slideData.talkingPoints, 3);
  slide.addShape(SHAPE.roundRect, {
    x: 0.75,
    y: 2.08,
    w: 5.9,
    h: 3.1,
    rectRadius: 0.08,
    fill: { color: COLORS.softGreen },
    line: { color: 'C8DDB9' },
  });
  slide.addShape('ellipse', {
    x: 4.62,
    y: 2.42,
    w: 1.28,
    h: 1.28,
    fill: { color: COLORS.white, transparency: 70 },
    line: { color: COLORS.green, width: 2 },
  });
  slide.addText('Commitment Prompt', {
    x: 1.05,
    y: 2.38,
    w: 2.5,
    h: 0.3,
    color: COLORS.teal,
    fontSize: 14,
    bold: true,
    margin: 0,
  });
  slide.addText(compact(slideData.activityPrompt, 180), {
    x: 1.05,
    y: 2.86,
    w: 4.72,
    h: 1.14,
    color: COLORS.ink,
    fontSize: 12.8,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText('Capture one practice the learner can use in the next program session.', {
    x: 1.05,
    y: 4.46,
    w: 4.7,
    h: 0.32,
    color: COLORS.muted,
    fontSize: 9,
    margin: 0,
    fit: 'shrink',
  });
  addSectionLabel(slide, 'Transfer commitments', { x: 7.15, y: 1.82, w: 3.1, h: 0.28 }, COLORS.darkTeal);
  points.slice(0, 3).forEach((point, index) => {
    const y = 2.28 + index * 1.0;
    slide.addShape(SHAPE.roundRect, {
      x: 7.15,
      y,
      w: 5.28,
      h: 0.76,
      rectRadius: 0.08,
      fill: { color: index === 1 ? COLORS.softYellow : COLORS.white },
      line: { color: COLORS.line },
    });
    slide.addText(['Start', 'Practice', 'Share'][index] ?? `Step ${index + 1}`, {
      x: 7.42,
      y: y + 0.2,
      w: 0.78,
      h: 0.18,
      color: index === 1 ? COLORS.orange : COLORS.darkTeal,
      fontSize: 7.5,
      bold: true,
      margin: 0,
    });
    slide.addText(compact(point, 92), {
      x: 8.38,
      y: y + 0.16,
      w: 3.54,
      h: 0.36,
      color: COLORS.ink,
      fontSize: 9.5,
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
  });
  addFacilitatorNote(slide, slideData.facilitatorNotes, { x: 7.15, y: 5.0, w: 5.28, h: 0.88 });
}

function addFacilitatorHandoffSlide(pptx: pptxgen, outline: DeckOutline) {
  const slide = pptx.addSlide();
  addBackground(slide);
  addTopBar(slide, outline.slides.length + 1, outline.slides.length + 2);
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
  const notes = outline.handoffNotes.length > 0 ? outline.handoffNotes : [
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
  const artifacts = outline.sourceArtifacts.slice(0, 10);
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

function addTopBar(slide: pptxgen.Slide, slideNumber: number, total: number) {
  addBrandLogo(slide, 0.56, 0.25, 1.0);
  slide.addText('THINK TOGETHER', {
    x: 1.72,
    y: 0.27,
    w: 2.2,
    h: 0.2,
    color: COLORS.teal,
    fontSize: 9,
    bold: true,
    margin: 0,
  });
  slide.addText('Program Induction | PBIS', {
    x: 1.72,
    y: 0.47,
    w: 3.2,
    h: 0.2,
    color: COLORS.muted,
    fontSize: 9,
    margin: 0,
  });
  slide.addText(`${slideNumber}/${total}`, {
    x: 11.8,
    y: 0.28,
    w: 0.8,
    h: 0.22,
    color: COLORS.teal,
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
  const promptText = compact(prompt, textLimitForBox(box, 150));
  const promptSize = scaledFont(promptText, { base: 11, medium: 10, small: 9, mediumAt: 118, smallAt: 150 });
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: index % 2 === 0 ? 'B7DED8' : 'F3C6A8' },
  });
  slide.addShape(SHAPE.rect, {
    x: box.x,
    y: box.y,
    w: 0.12,
    h: box.h,
    fill: { color: accent },
    line: { color: accent },
  });
  addBadge(slide, 'ACTIVITY', { x: box.x + 0.34, y: box.y + 0.22, w: 0.72, h: 0.24 }, accent, COLORS.white);
  slide.addText('Practice Moment', {
    x: box.x + 1.18,
    y: box.y + 0.23,
    w: box.w - 1.52,
    h: 0.28,
    color: accent,
    fontSize: 12.5,
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
    x: box.x + 0.34,
    y: box.y + 0.72,
    w: box.w - 0.82,
    h: Math.max(0.62, box.h - 1.02),
    color: COLORS.ink,
    fontSize: promptSize,
    bold: true,
    fit: 'shrink',
    margin: 0.02,
  });
}

function addFacilitatorNote(slide: pptxgen.Slide, note: string, box: Box = { x: 7.25, y: 3.82, w: 5.2, h: 1.28 }) {
  const noteText = compact(note, textLimitForBox(box, 185));
  const noteSize = scaledFont(noteText, { base: 8.5, medium: 7.9, small: 7.2, mediumAt: 150, smallAt: 190 });
  slide.addShape(SHAPE.roundRect, {
    ...box,
    rectRadius: 0.05,
    fill: { color: COLORS.white },
    line: { color: COLORS.line },
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
    fontSize: 9,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(noteText, {
    x: box.x + 0.3,
    y: box.y + 0.45,
    w: box.w - 0.65,
    h: Math.max(0.28, box.h - 0.62),
    color: COLORS.ink,
    fontSize: noteSize,
    fit: 'shrink',
    margin: 0.02,
  });
}

function padPoints(points: string[], minimum: number) {
  const fallback = ['Teach the expectation', 'Practice the routine', 'Reinforce the behavior', 'Transfer to site'];
  const combined = [...points.filter(Boolean).map((point) => compact(point, 86)), ...fallback];
  return combined.slice(0, Math.max(minimum, points.length));
}

function addObjectiveBand(slide: pptxgen.Slide, objectives: string[]) {
  const items = objectives.length > 0 ? objectives : ['Practice source-grounded facilitation', 'Apply PBIS routines at site'];
  slide.addShape(SHAPE.roundRect, {
    x: 0.75,
    y: 5.05,
    w: 7.55,
    h: 1.22,
    rectRadius: 0.08,
    fill: { color: COLORS.softTeal },
    line: { color: 'B7DED8' },
  });
  slide.addText('Key Outcomes', {
    x: 1.05,
    y: 5.22,
    w: 2.2,
    h: 0.22,
    color: COLORS.teal,
    fontSize: 11,
    bold: true,
    margin: 0,
  });
  items.slice(0, 3).forEach((item, index) => {
    const x = 1.05 + index * 2.15;
    addNumberBadge(slide, String(index + 1), { x, y: 5.56, w: 0.28, h: 0.28 }, index === 1 ? COLORS.orange : COLORS.darkTeal);
    slide.addText(compact(item, 70), {
      x: x + 0.38,
      y: 5.52,
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
  addBadge(slide, 'SOURCE-GROUNDED DRAFT', { x: 10.15, y: 5.88, w: 1.72, h: 0.26 }, COLORS.orange, COLORS.softYellow);
  addBadge(slide, 'HUMAN REVIEW', { x: 10.15, y: 6.18, w: 1.24, h: 0.24 }, COLORS.darkTeal, COLORS.softTeal);
  slide.addText(text, {
    x: 10.15,
    y: 6.47,
    w: 2.38,
    h: 0.42,
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

function addSourceFootnote(slide: pptxgen.Slide, slideData: DeckSlide) {
  const refs = slideData.sourceRefs.map((ref) => `${ref.artifact} (${ref.locator})`).join(' | ');
  slide.addText(refs || 'Source: Think Together PBIS/SOP artifacts', {
    x: MARGIN_X,
    y: 6.55,
    w: 11.2,
    h: 0.24,
    color: COLORS.muted,
    fontSize: 7.5,
    italic: true,
    margin: 0,
    fit: 'shrink',
  });
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
