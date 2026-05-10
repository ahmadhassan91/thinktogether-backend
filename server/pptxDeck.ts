import pptxgen from 'pptxgenjs';
import type { DeckOutline, DeckSlide } from './aiDeck';

const COLORS = {
  ink: '2F3033',
  muted: '666666',
  orange: 'F05A2A',
  teal: '1A8A80',
  softTeal: 'E7F6F3',
  yellow: 'F8B83E',
  cream: 'FFFDF7',
  line: 'D8D4C8',
  white: 'FFFFFF',
};

const SHAPE = {
  rect: 'rect',
  roundRect: 'roundRect',
  line: 'line',
} as const;

const MARGIN_X = 0.55;
const FOOTER_Y = 7.05;

export async function renderDeckPptx(outline: DeckOutline): Promise<Buffer> {
  const pptx = new pptxgen();
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
  addBrandMark(slide, 0.65, 0.55, 0.85);
  slide.addShape(SHAPE.rect, {
    x: 9.65,
    y: 0,
    w: 3.68,
    h: 7.5,
    fill: { color: COLORS.softTeal },
    line: { color: COLORS.softTeal },
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
    h: 1.55,
    color: COLORS.ink,
    fontFace: 'Aptos Display',
    fontSize: 34,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  slide.addText(`${outline.durationMinutes} minutes | ${outline.audience}`, {
    x: 0.78,
    y: 4.15,
    w: 6.5,
    h: 0.35,
    color: COLORS.muted,
    fontSize: 15,
    margin: 0,
  });
  addObjectiveBand(slide, outline.learningObjectives.slice(0, 3));
  addFooter(slide, outline, 'Title');
}

function addTrainingSlide(pptx: pptxgen, outline: DeckOutline, slideData: DeckSlide, index: number) {
  const slide = pptx.addSlide();
  addBackground(slide);
  addTopBar(slide, index + 1, outline.slides.length);
  slide.addText(slideData.title, {
    x: MARGIN_X,
    y: 0.72,
    w: 7.7,
    h: 0.62,
    color: COLORS.ink,
    fontFace: 'Aptos Display',
    fontSize: 25,
    bold: true,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(slideData.objective, {
    x: MARGIN_X,
    y: 1.36,
    w: 7.45,
    h: 0.42,
    color: COLORS.teal,
    fontSize: 13,
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
  points.slice(0, 3).forEach((point, index) => {
    const x = 0.72 + index * 2.15;
    slide.addShape(SHAPE.roundRect, {
      x,
      y: 2.02,
      w: 1.78,
      h: 2.22,
      rectRadius: 0.08,
      fill: { color: index === 1 ? COLORS.softTeal : COLORS.white },
      line: { color: index === 1 ? 'B7DED8' : COLORS.line },
    });
    slide.addText(`0${index + 1}`, {
      x: x + 0.18,
      y: 2.25,
      w: 0.6,
      h: 0.28,
      color: index === 1 ? COLORS.teal : COLORS.orange,
      fontSize: 15,
      bold: true,
      margin: 0,
    });
    slide.addText(point, {
      x: x + 0.18,
      y: 2.82,
      w: 1.38,
      h: 0.88,
      color: COLORS.ink,
      fontSize: 14,
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
  });
  addActivityCard(slide, slideData.activityPrompt, 0);
  addFacilitatorNote(slide, slideData.facilitatorNotes);
}

function addMatrixSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const points = padPoints(slideData.talkingPoints, 4);
  points.slice(0, 4).forEach((point, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.75 + col * 3.05;
    const y = 1.95 + row * 1.52;
    slide.addShape(SHAPE.roundRect, {
      x,
      y,
      w: 2.65,
      h: 1.1,
      rectRadius: 0.08,
      fill: { color: index % 2 === 0 ? COLORS.softTeal : 'FFF5E7' },
      line: { color: index % 2 === 0 ? 'B7DED8' : 'F3C6A8' },
    });
    slide.addText(point, {
      x: x + 0.22,
      y: y + 0.26,
      w: 2.18,
      h: 0.46,
      color: COLORS.ink,
      fontSize: 14,
      bold: true,
      align: 'center',
      fit: 'shrink',
      margin: 0,
    });
  });
  slide.addShape(SHAPE.rect, {
    x: 6.8,
    y: 1.9,
    w: 0.08,
    h: 3.2,
    fill: { color: COLORS.yellow },
    line: { color: COLORS.yellow },
  });
  addActivityCard(slide, slideData.activityPrompt, 1);
  addFacilitatorNote(slide, slideData.facilitatorNotes);
}

function addScenarioSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  slide.addShape(SHAPE.roundRect, {
    x: 0.75,
    y: 1.95,
    w: 5.9,
    h: 3.25,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.line },
  });
  slide.addText('Scenario Lab', {
    x: 1.05,
    y: 2.25,
    w: 2.2,
    h: 0.3,
    color: COLORS.orange,
    fontSize: 14,
    bold: true,
    margin: 0,
  });
  slide.addText(slideData.activityPrompt, {
    x: 1.05,
    y: 2.74,
    w: 5.25,
    h: 1.0,
    color: COLORS.ink,
    fontSize: 20,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  const points = padPoints(slideData.talkingPoints, 3);
  points.slice(0, 3).forEach((point, index) => {
    slide.addText(`${index + 1}. ${point}`, {
      x: 7.45,
      y: 1.92 + index * 0.86,
      w: 4.2,
      h: 0.38,
      color: COLORS.ink,
      fontSize: 15,
      bold: index === 0,
      fit: 'shrink',
      margin: 0,
    });
  });
  addFacilitatorNote(slide, slideData.facilitatorNotes);
}

function addCommitmentSlide(slide: pptxgen.Slide, slideData: DeckSlide) {
  const points = padPoints(slideData.talkingPoints, 3);
  slide.addShape(SHAPE.roundRect, {
    x: 0.75,
    y: 2.0,
    w: 5.9,
    h: 2.7,
    rectRadius: 0.08,
    fill: { color: COLORS.softTeal },
    line: { color: 'B7DED8' },
  });
  slide.addText('Commitment Prompt', {
    x: 1.05,
    y: 2.28,
    w: 2.5,
    h: 0.3,
    color: COLORS.teal,
    fontSize: 14,
    bold: true,
    margin: 0,
  });
  slide.addText(slideData.activityPrompt, {
    x: 1.05,
    y: 2.8,
    w: 5.0,
    h: 1.08,
    color: COLORS.ink,
    fontSize: 22,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
  points.slice(0, 3).forEach((point, index) => {
    slide.addShape(SHAPE.roundRect, {
      x: 7.25,
      y: 1.85 + index * 1.05,
      w: 4.9,
      h: 0.72,
      rectRadius: 0.08,
      fill: { color: index === 1 ? 'FFF5E7' : COLORS.white },
      line: { color: COLORS.line },
    });
    slide.addText(point, {
      x: 7.55,
      y: 2.08 + index * 1.05,
      w: 4.25,
      h: 0.24,
      color: COLORS.ink,
      fontSize: 13,
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
  });
  addFacilitatorNote(slide, slideData.facilitatorNotes);
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
  addBrandMark(slide, 0.62, 0.55, 0.55);
  slide.addText('Source Artifacts', {
    x: 1.35,
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
    w: 13.33,
    h: 0.08,
    fill: { color: COLORS.orange },
    line: { color: COLORS.orange },
  });
}

function addBrandMark(slide: pptxgen.Slide, x: number, y: number, size: number) {
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
  addBrandMark(slide, 0.56, 0.25, 0.43);
  slide.addText('THINK TOGETHER', {
    x: 1.12,
    y: 0.27,
    w: 2.2,
    h: 0.2,
    color: COLORS.teal,
    fontSize: 9,
    bold: true,
    margin: 0,
  });
  slide.addText('Program Induction | PBIS', {
    x: 1.12,
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
}

function addActivityCard(slide: pptxgen.Slide, prompt: string, index: number) {
  const fill = index % 2 === 0 ? COLORS.softTeal : 'FFF5E7';
  const accent = index % 2 === 0 ? COLORS.teal : COLORS.orange;
  slide.addShape(SHAPE.roundRect, {
    x: 7.25,
    y: 1.75,
    w: 5.2,
    h: 2.32,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: index % 2 === 0 ? 'B7DED8' : 'F3C6A8' },
  });
  slide.addText('Practice Moment', {
    x: 7.6,
    y: 2.08,
    w: 2.9,
    h: 0.3,
    color: accent,
    fontSize: 14,
    bold: true,
    margin: 0,
  });
  slide.addText(prompt, {
    x: 7.62,
    y: 2.58,
    w: 4.25,
    h: 0.9,
    color: COLORS.ink,
    fontSize: 18,
    bold: true,
    fit: 'shrink',
    margin: 0,
  });
}

function addFacilitatorNote(slide: pptxgen.Slide, note: string) {
  slide.addShape(SHAPE.rect, {
    x: 7.25,
    y: 4.35,
    w: 5.2,
    h: 1.12,
    fill: { color: COLORS.white },
    line: { color: COLORS.line },
  });
  slide.addText('Facilitator note', {
    x: 7.55,
    y: 4.55,
    w: 2.2,
    h: 0.2,
    color: COLORS.muted,
    fontSize: 9,
    bold: true,
    margin: 0,
  });
  slide.addText(note, {
    x: 7.55,
    y: 4.82,
    w: 4.55,
    h: 0.38,
    color: COLORS.ink,
    fontSize: 11,
    fit: 'shrink',
    margin: 0,
  });
}

function padPoints(points: string[], minimum: number) {
  const fallback = ['Teach the expectation', 'Practice the routine', 'Reinforce the behavior', 'Transfer to site'];
  const combined = [...points.filter(Boolean), ...fallback];
  return combined.slice(0, Math.max(minimum, points.length));
}

function addObjectiveBand(slide: pptxgen.Slide, objectives: string[]) {
  const items = objectives.length > 0 ? objectives : ['Practice source-grounded facilitation', 'Apply PBIS routines at site'];
  slide.addShape(SHAPE.roundRect, {
    x: 0.75,
    y: 5.05,
    w: 7.55,
    h: 1.1,
    rectRadius: 0.08,
    fill: { color: COLORS.softTeal },
    line: { color: 'B7DED8' },
  });
  slide.addText('Learning Objectives', {
    x: 1.05,
    y: 5.25,
    w: 2.2,
    h: 0.22,
    color: COLORS.teal,
    fontSize: 11,
    bold: true,
    margin: 0,
  });
  slide.addText(items.map((item) => ({ text: item, options: { bullet: { indent: 10 }, hanging: 4 } })), {
    x: 1.05,
    y: 5.56,
    w: 6.75,
    h: 0.4,
    color: COLORS.ink,
    fontSize: 10,
    fit: 'shrink',
  });
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
