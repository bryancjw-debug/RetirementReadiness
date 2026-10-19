import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizProgress } from "./QuizProgress";

beforeEach(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) }));
afterEach(() => vi.unstubAllGlobals());

describe("quiz section progress", () => {
  const steps = ["About you", "Timing", "Lifestyle", "Resources", "Building", "CPF", "Events", "Refine", "Review"];
  it("uses the same nine sections as the navigation, not the old five chapters", () => {
    const html = renderToStaticMarkup(<QuizProgress steps={steps} currentStep={0} detail="About you" onNavigate={() => {}} />);
    expect(html).toContain("Section 1 of 9");
    expect(html).not.toContain("Chapter");
    expect(html).not.toContain("Completed sections stay available");
    expect(html.match(/<button/g)).toHaveLength(9);
    expect(html.match(/disabled=""/g)).toHaveLength(8);
  });
  it("keeps CPF substeps separate from overall section progress", () => {
    const html = renderToStaticMarkup(<QuizProgress steps={steps} currentStep={5} detail="Current balances (2 of 4)" onNavigate={() => {}} />);
    expect(html).toContain("Section 6 of 9");
    expect(html).toContain("Current balances (2 of 4)");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
  it("derives the count from each flow's actual sections", () => {
    const html = renderToStaticMarkup(<QuizProgress steps={["Household", "Resources", "Review"]} currentStep={2} detail="Review" onNavigate={() => {}} />);
    expect(html).toContain("Section 3 of 3");
  });
});
