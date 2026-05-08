import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScenarioCoach } from "./ScenarioCoach";
import type { CoachScenario } from "./coachEngine";

const lineUpScenario: CoachScenario = {
  id: "line-up",
  title: "Line-up pre-correction",
  brief: "Students are getting loud before lining up for dismissal.",
  expectedAnchors: ["pre-correction"],
};

describe("ScenarioCoach", () => {
  it("renders the scenario, scores a response, shows rubric feedback, and retries", async () => {
    render(<ScenarioCoach scenario={lineUpScenario} />);

    expect(screen.getByText("Line-up pre-correction")).toBeInTheDocument();
    expect(screen.getByText(/Students are getting loud/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/response/i), { target: { value: "Line up nicely and behave." } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(screen.getByText(/Developing/)).toBeInTheDocument();
    expect(screen.getAllByText(/observable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PBIS/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(screen.queryByText(/Developing/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/response/i)).toHaveValue("");
  });
});
