import { describe, it, expect } from "vitest";
import { renderMath } from "../miniMarkdown";

describe("renderMath", () => {
  it("renders plain expressions unchanged", () => {
    expect(renderMath("x + y")).toBe("x + y");
  });

  it("renders subscripts", () => {
    expect(renderMath("x_2")).toBe("x₂");
    expect(renderMath("a_{n+1}")).toBe("aₙ₊₁");
  });

  it("renders superscripts", () => {
    expect(renderMath("x^2")).toBe("x²");
    expect(renderMath("x^{10}")).toBe("x¹⁰");
  });

  it("renders Greek letters", () => {
    expect(renderMath("\\alpha + \\beta = \\gamma")).toBe("α + β = γ");
    expect(renderMath("\\Delta x")).toBe("Δ x");
    expect(renderMath("\\pi")).toBe("π");
  });

  it("renders one-level fractions", () => {
    expect(renderMath("\\frac{a}{b}")).toBe("(a)/(b)");
    expect(renderMath("\\frac{x^2}{2}")).toBe("(x²)/(2)");
  });

  it("renders sqrt", () => {
    expect(renderMath("\\sqrt{x}")).toBe("√(x)");
    expect(renderMath("\\sqrt{x^2 + y^2}")).toBe("√(x² + y²)");
  });

  it("renders symbols", () => {
    expect(renderMath("\\infty")).toBe("∞");
    expect(renderMath("\\int_0^1 x dx")).toBe("∫₀¹ x dx");
    expect(renderMath("\\sum_{i=1}^{n}")).toBe("Σᵢ₌₁ⁿ");
    expect(renderMath("\\times")).toBe("×");
    expect(renderMath("\\cdot")).toBe("·");
    expect(renderMath("\\leq")).toBe("≤");
    expect(renderMath("\\geq")).toBe("≥");
    expect(renderMath("\\neq")).toBe("≠");
  });

  it("renders complex Gymnasium formulas", () => {
    // Quadratic formula
    expect(renderMath("x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"))
      .toBe("x = (-b ± √(b² - 4ac))/(2a)");

    // Log derivative
    expect(renderMath("\\frac{d}{dx} \\ln x = \\frac{1}{x}"))
      .toBe("(d)/(dx) ln x = (1)/(x)");

    // Newton's second law
    expect(renderMath("F = m \\cdot a")).toBe("F = m · a");

    // Ideal gas law
    expect(renderMath("pV = nRT")).toBe("pV = nRT");

    // Energy
    expect(renderMath("E_k = \\frac{1}{2} m v^2"))
      .toBe("Eₖ = (1)/(2) m v²");
  });
});
