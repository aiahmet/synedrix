import { z } from "zod";

const formulaVisual = z.object({
  kind: z.literal("formula"),
  name: z.string().min(1).max(120),
  expression: z.string().min(1).max(500),
  when: z.string().min(1).max(300),
});

const diagramVisual = z.object({
  kind: z.literal("diagram"),
  subkind: z.enum(["tree", "numberline", "barchart", "graph"]),
  spec: z.string().min(1).max(1000),
});

const stepsVisual = z.object({
  kind: z.literal("steps"),
  steps: z.array(z.string().min(1).max(300)).min(2).max(5),
});

const noneVisual = z.object({
  kind: z.literal("none"),
});

const visual = z.discriminatedUnion("kind", [
  formulaVisual,
  diagramVisual,
  stepsVisual,
  noneVisual,
]);

const checkOption = z.object({
  label: z.string().length(1), // "A" | "B" | "C" | "D"
  text: z.string().min(1).max(200),
});

const check = z.object({
  prompt: z.string().min(1).max(300),
  options: z.array(checkOption).min(2).max(4),
  correctLabel: z.string().length(1),
  explanation: z.string().min(1).max(400), // shown after answer
});

const next = z.object({
  suggestion: z.string().min(1).max(200),
  actionPrompt: z.string().min(1).max(400), // pre-baked prompt if user clicks
});

const extraWidget = z.object({
  kind: z.enum(["formula", "mistake", "concept", "diagram"]),
  payload: z.string().min(1).max(800), // raw marker payload
});


export const tutorResponseSchema = z.object({
  explanation: z.string().min(1).max(500),
  visual,
  keyInsight: z.string().min(1).max(200),
  check,
  next,
  extraWidgets: z.array(extraWidget).max(2).optional(),
  affirmation: z.string().min(1).max(200).nullable().optional(),
});

export type TutorResponse = z.infer<typeof tutorResponseSchema>;
export type VisualKind = TutorResponse["visual"]["kind"];
export type CheckShape = TutorResponse["check"];
export type NextShape = TutorResponse["next"];
export type ExtraWidgetShape = NonNullable<TutorResponse["extraWidgets"]>[number];

export function serialiseToMarkdown(response: TutorResponse): string {
  const lines: string[] = [];

  lines.push(response.explanation.trim());
  lines.push("");

  const visualBlock = serialiseVisual(response.visual);
  if (visualBlock) {
    lines.push(visualBlock);
    lines.push("");
  }

  lines.push(`**💡 Key insight:** ${response.keyInsight.trim()}`);
  lines.push("");

  for (const ew of response.extraWidgets ?? []) {
    lines.push(`[[${ew.kind}:${ew.payload}]]`);
    lines.push("");
  }

  const optionsText = response.check.options
    .map((o) => `${o.label}) ${o.text}`)
    .join("|");
  lines.push(
    `[[choice:${response.check.prompt}|${optionsText}|Correct=${response.check.correctLabel}]]`
  );
  lines.push("");

  lines.push(
    `_Next: ${response.next.suggestion.trim()} — try: "${response.next.actionPrompt.trim()}"_`
  );

  if (response.affirmation) {
    lines.push("");
    lines.push(`> ${response.affirmation.trim()}`);
  }

  return lines.join("\n");
}

function serialiseVisual(
  v: TutorResponse["visual"]
): string | null {
  switch (v.kind) {
    case "formula":
      return `[[formula:${v.name}|${v.expression}|${v.when}]]`;
    case "diagram":
      return `[[diagram:${v.subkind}|${v.spec}]]`;
    case "steps":
      return `[[steps:${v.steps.join("|")}]]`;
    case "none":
      return null;
    default:
      return null;
  }
}
