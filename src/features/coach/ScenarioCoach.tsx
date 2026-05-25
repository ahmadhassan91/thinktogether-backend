import { type FormEvent, useState } from "react";
import { scoreScenarioResponse, type CoachScenario, type ScenarioScore } from "./coachEngine";

type ScenarioCoachProps = {
  scenario: CoachScenario;
  scenarios?: CoachScenario[];
  onSelectScenario?: (scenarioId: string) => void;
  onNextScenario?: () => void;
  onScoreScenario?: (scenarioId: string, response: string) => Promise<ScenarioScore>;
};

export const ScenarioCoach = ({ scenario, scenarios = [scenario], onSelectScenario, onNextScenario, onScoreScenario }: ScenarioCoachProps) => {
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<ScenarioScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleScenarioChange = (scenarioId: string) => {
    setResponse("");
    setFeedback(null);
    setError("");
    onSelectScenario?.(scenarioId);
  };

  const handleNextScenario = () => {
    setResponse("");
    setFeedback(null);
    setError("");
    onNextScenario?.();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const scored = onScoreScenario
        ? await onScoreScenario(scenario.id, response)
        : scoreScenarioResponse(scenario, response);
      setFeedback(scored);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to score response.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResponse("");
    setFeedback(null);
  };

  return (
    <section aria-labelledby={`scenario-${scenario.id}`} className="scenario-coach">
      <header>
        <p className="scenario-coach__eyebrow">Official PBIS scenario practice</p>
        <h2 id={`scenario-${scenario.id}`}>{scenario.title}</h2>
        <p>{scenario.brief}</p>
        {scenario.skillFocus ? <p className="scenario-coach__focus">Focus: {scenario.skillFocus}</p> : null}
      </header>

      {scenarios.length > 1 ? (
        <div className="scenario-coach__controls">
          <label htmlFor="scenario-selector">Scenario</label>
          <select
            id="scenario-selector"
            value={scenario.id}
            onChange={(event) => handleScenarioChange(event.target.value)}
          >
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleNextScenario}>
            Next official scenario
          </button>
        </div>
      ) : null}

      {scenario.sourceRefs?.length ? (
        <aside className="scenario-coach__sources" aria-label="Scenario source references">
          <strong>Source grounding</strong>
          <ul>
            {scenario.sourceRefs.map((source) => (
              <li key={`${source.artifact}-${source.locator}`}>
                {source.artifact}: {source.locator}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <form className="scenario-coach__response" onSubmit={handleSubmit}>
        <div>
          <label htmlFor={`response-${scenario.id}`}>Your coaching response</label>
          <p>Write what you would say or do in the moment. The coach checks for observable language, PBIS alignment, and least-intensive support.</p>
        </div>
        <textarea
          id={`response-${scenario.id}`}
          placeholder="Example: I would restate the expected routine, model the exact words/actions, then give the student a quick chance to practice it before moving on."
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          rows={6}
        />
        <button type="submit" disabled={!response.trim() || submitting}>
          {submitting ? (
            <>
              <span className="tt-spinner" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            "Submit"
          )}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {feedback ? (
        <section className="scenario-coach__feedback" aria-label="Feedback rubric">
          <div>
            <p className="scenario-coach__eyebrow">Coach feedback</p>
            <h3>Feedback rubric</h3>
          </div>
          <strong>{feedback.score}/4 · {feedback.label}</strong>
          <p>{feedback.rationale}</p>
          <p>{feedback.coachingNote}</p>
          <small>{feedback.confidence}</small>
          <ul>
            {feedback.sourceBasis.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </section>
      ) : null}
    </section>
  );
};
