import { describe, expect, it } from "vitest";
import { answerKnowledgeQuestion, scoreScenarioResponse, type CoachScenario } from "./coachEngine";

const scenario = (overrides: Partial<CoachScenario> = {}): CoachScenario => ({
  id: "scenario-1",
  title: "Recess coaching",
  brief: "A student breaks a recess game rule and argues when redirected.",
  expectedAnchors: ["restorative language", "PL ownership"],
  ...overrides,
});

describe("scoreScenarioResponse", () => {
  it("scores a restorative rewrite as meeting PBIS practice", () => {
    const result = scoreScenarioResponse(
      scenario({ expectedAnchors: ["restorative language", "positive reinforcement"] }),
      "I would avoid making them sit out for the rest of the game. I would speak privately, ask what happened, have them repair the impact, and let them rejoin respectfully when ready.",
    );

    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.label).toMatch(/Meets|Exceeds/);
    expect(result.rationale).toContain("restorative");
    expect(result.sourceBasis).toContain("PBIS");
  });

  it("classifies light horseplay in line as a minor PL-managed behavior", () => {
    const result = scoreScenarioResponse(
      scenario({
        title: "Light horseplay in line",
        brief: "Two students are lightly bumping each other while lining up, stop when redirected, and no one is hurt.",
        expectedAnchors: ["minor vs major", "PL ownership"],
      }),
      "This is minor behavior because it is a small disruption with no harm and they stopped after redirection. The PL should redirect, pre-correct the line expectation, and record it as data.",
    );

    expect(result.score).toBe(4);
    expect(result.label).toBe("Exceeds");
    expect(result.rationale).toContain("minor");
    expect(result.coachingNote).toContain("pre-correction");
  });

  it("classifies a physical fight as a major SPM-managed safety escalation", () => {
    const result = scoreScenarioResponse(
      scenario({
        title: "Physical fight",
        brief: "Two students are punching each other during transition and other students are crowding around.",
        expectedAnchors: ["major behavior", "SPM ownership", "safety escalation"],
      }),
      "This is major because there is potential harm. I would separate students if safe, call the SPM, follow safety escalation, and document the incident.",
    );

    expect(result.score).toBe(4);
    expect(result.label).toBe("Exceeds");
    expect(result.rationale).toContain("major");
    expect(result.rationale).toContain("SPM");
  });

  it("treats a vague line-up direction as developing until pre-correction is observable", () => {
    const result = scoreScenarioResponse(
      scenario({
        title: "Line-up pre-correction",
        brief: "Students are noisy before lining up for dismissal.",
        expectedAnchors: ["pre-correction"],
      }),
      "Line up nicely and behave.",
    );

    expect(result.score).toBe(2);
    expect(result.label).toBe("Developing");
    expect(result.coachingNote).toContain("observable");
  });
});

describe("answerKnowledgeQuestion", () => {
  it("refuses unsupported policy requests instead of inventing an answer", () => {
    const result = answerKnowledgeQuestion("What does the district-specific suspension policy require?");

    expect(result.answer).toBe("Not found");
    expect(result.confidence).toBe("Not found in provided sources");
    expect(result.sourceBasis).toEqual([]);
  });
});
