import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetirementWelcome } from "./RetirementWelcome";

describe("retirement landing and resume", () => {
  it("retains the original landing choices for new visitors", () => {
    const html=renderToStaticMarkup(<RetirementWelcome onStart={()=>{}} onPlanTogether={()=>{}} onExploreSample={()=>{}} />);
    expect(html).toContain("Start my checkup");
    expect(html).toContain("Plan together");
    expect(html).toContain("Explore a sample instead");
  });
  it("offers non-destructive continuation when returning Home", () => {
    const html=renderToStaticMarkup(<RetirementWelcome resume onStart={()=>{}} />);
    expect(html).toContain("Continue current plan");
    expect(html).toContain("current answers and results are kept");
    expect(html).not.toContain("Start my checkup");
    expect(html).not.toContain("Plan together");
  });
  it("labels sample results as illustrative in both views", () => {
    for(const resume of [false,true])expect(renderToStaticMarkup(<RetirementWelcome resume={resume} onStart={()=>{}} />)).toContain("Illustrative preview");
  });
});
