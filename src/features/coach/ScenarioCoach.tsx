import { type FormEvent, useState } from "react";
import { scoreScenarioResponse, type CoachScenario, type ScenarioScore } from "./coachEngine";

type ScenarioCoachProps = {
  scenario: CoachScenario;
  onScoreScenario?: (scenarioId: string, response: string) => Promise<ScenarioScore>;
};

export const ScenarioCoach = ({ scenario, onScoreScenario }: ScenarioCoachProps) => {
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<ScenarioScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
        <h2 id={`scenario-${scenario.id}`}>{scenario.title}</h2>
        <p>{scenario.brief}</p>
      </header>

      <form onSubmit={handleSubmit}>
        <label htmlFor={`response-${scenario.id}`}>Response</label>
        <textarea
          id={`response-${scenario.id}`}
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          rows={6}
        />
        <button type="submit" disabled={!response.trim() || submitting}>
          {submitting ? "Submitting" : "Submit"}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      {feedback ? (
        <section aria-label="Feedback rubric">
          <h3>Feedback rubric</h3>
          <p>
            {feedback.score}/4 {feedback.label}
          </p>
          <p>{feedback.rationale}</p>
          <p>{feedback.coachingNote}</p>
          <p>{feedback.confidence}</p>
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
