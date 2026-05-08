export type ScoreLabel = "Not Yet" | "Developing" | "Meets" | "Exceeds";
export type CoachConfidence = "Source-backed" | "Partially source-backed" | "Not found in provided sources";

export type CoachScenario = {
  id: string;
  title: string;
  brief: string;
  expectedAnchors?: string[];
};

export type ScenarioScore = {
  score: 1 | 2 | 3 | 4;
  label: ScoreLabel;
  rationale: string;
  coachingNote: string;
  confidence: CoachConfidence;
  sourceBasis: string[];
};

export type KnowledgeSource = {
  title: string;
  excerpt: string;
};

export type KnowledgeAnswer = {
  answer: string;
  sourceBasis: string[];
  coachingNote: string;
  confidence: CoachConfidence;
};

const PBIS_SOURCE = "PBIS coaching rubric: minor vs major, restorative language, pre-correction, ownership, safety escalation";

const labelByScore: Record<ScenarioScore["score"], ScoreLabel> = {
  1: "Not Yet",
  2: "Developing",
  3: "Meets",
  4: "Exceeds",
};

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

const inferAnchors = (scenario: CoachScenario) => {
  const text = normalize(`${scenario.title} ${scenario.brief}`);
  const anchors = new Set(scenario.expectedAnchors ?? []);

  if (includesAny(text, ["fight", "punch", "harm", "safety", "major"])) {
    anchors.add("major behavior");
    anchors.add("SPM ownership");
    anchors.add("safety escalation");
  }

  if (includesAny(text, ["horseplay", "bumping", "minor"])) {
    anchors.add("minor vs major");
    anchors.add("PL ownership");
  }

  if (includesAny(text, ["line-up pre-correction", "pre-correction", "dismissal"])) {
    anchors.add("pre-correction");
  }

  if (includesAny(text, ["restorative", "recess", "repair", "argues", "game"])) {
    anchors.add("restorative language");
  }

  return Array.from(anchors);
};

const responseSignals = (response: string) => {
  const text = normalize(response);
  const avoidsPunitive = includesAny(text, ["avoid", "instead", "not make", "rather than"]);

  return {
    text,
    restorative: includesAny(text, ["restorative", "repair", "reflect", "what happened", "rejoin", "respectfully", "privately"]),
    preCorrection: includesAny(text, ["pre-correct", "expectation", "before", "when we line", "show", "voice", "walking", "observable"]),
    observable: includesAny(text, ["walking", "voice", "hands", "space", "facing", "step", "show", "observable"]),
    minor: includesAny(text, ["minor", "small disruption", "no harm", "redirect"]),
    major: includesAny(text, ["major", "harm", "fight", "punch", "safety"]),
    pl: includesAny(text, ["pl", "program leader"]),
    spm: includesAny(text, ["spm", "site program manager"]),
    safety: includesAny(text, ["safety", "separate", "escalation", "call"]),
    documentation: includesAny(text, ["document", "record", "data", "incident"]),
    punitive:
      includesAny(text, ["sit out for the rest", "punish", "suspend", "kick out"]) &&
      !avoidsPunitive,
  };
};

export const scoreScenarioResponse = (scenario: CoachScenario, response: string): ScenarioScore => {
  const anchors = inferAnchors(scenario);
  const signals = responseSignals(response);
  const met: string[] = [];
  const missing: string[] = [];

  for (const anchor of anchors) {
    const normalized = normalize(anchor);
    if (normalized.includes("restorative")) {
      (signals.restorative ? met : missing).push("restorative language");
    } else if (normalized.includes("pre-correction")) {
      (signals.preCorrection && signals.observable ? met : missing).push("observable pre-correction");
    } else if (normalized.includes("minor")) {
      (signals.minor ? met : missing).push("minor behavior");
    } else if (normalized.includes("pl")) {
      (signals.pl ? met : missing).push("PL ownership");
    } else if (normalized.includes("major")) {
      (signals.major ? met : missing).push("major behavior");
    } else if (normalized.includes("spm")) {
      (signals.spm ? met : missing).push("SPM ownership");
    } else if (normalized.includes("safety")) {
      (signals.safety ? met : missing).push("safety escalation");
    }
  }

  if (signals.documentation) {
    met.push("documentation/data follow-up");
  }

  let score: ScenarioScore["score"] = 3;
  if (signals.punitive || (!signals.text && met.length === 0)) {
    score = 1;
  } else if (missing.length > 0) {
    score = 2;
  } else if (signals.documentation || met.length >= 2) {
    score = 4;
  }

  return {
    score,
    label: labelByScore[score],
    rationale:
      score === 1
        ? "The response misses PBIS anchors or leans punitive instead of restorative."
        : `The response ${score >= 3 ? "uses" : "partially uses"} PBIS anchors: ${met.join(", ") || "some alignment"}.${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}`,
    coachingNote: missing.includes("observable pre-correction")
      ? "Rewrite the pre-correction as observable student actions, such as voice level, body position, and line movement."
      : missing.length
        ? `Add ${missing[0]} and keep the response student-centered.`
        : "Keep the pre-correction specific, restorative, and tied to documentation when needed.",
    confidence: "Source-backed",
    sourceBasis: ["PBIS", PBIS_SOURCE],
  };
};

export const answerKnowledgeQuestion = (query: string, sources: KnowledgeSource[] = []): KnowledgeAnswer => {
  const text = normalize(query);
  const unsupportedPolicy = includesAny(text, [
    "district-specific",
    "suspension policy",
    "fake",
    "transportation appendix",
    "appendix",
  ]);

  if (unsupportedPolicy || sources.length === 0) {
    return {
      answer: "Not found",
      sourceBasis: [],
      coachingNote: "Ask for an approved source or SOP excerpt before answering policy-specific questions.",
      confidence: "Not found in provided sources",
    };
  }

  const match = sources.find((source) => normalize(source.excerpt).includes(text) || text.includes(normalize(source.title)));

  if (!match) {
    return {
      answer: "Not found",
      sourceBasis: [],
      coachingNote: "Use only retrieved Think Together materials for compliance or policy answers.",
      confidence: "Not found in provided sources",
    };
  }

  return {
    answer: match.excerpt,
    sourceBasis: [match.title],
    coachingNote: "Use the cited source language when coaching the learner.",
    confidence: "Source-backed",
  };
};
