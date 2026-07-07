export type SubjectCategory = "math" | "physics" | "chemistry" | "language" | "essay";

export type PracticeItemType =
  | "mcq"
  | "short_answer"
  | "step_problem"
  | "fill_blank"
  | "user_text_answer"
  | "worked_walkthrough"
  | "essay_analysis"
  | "translation_drill"
  | "formula_derivation"
  | "oral_recall";

export interface SubjectBehavior {
  readonly category: SubjectCategory;
  readonly preferredQuestionTypes: ReadonlyArray<PracticeItemType>;
  readonly tutorInstructions: string;
  readonly gradingEmphasis: string;
  readonly lessonStructure: string;
  readonly resourceHints: ReadonlyArray<string>;
  readonly mistakeCategories: ReadonlyArray<string>;
}

const MATH_BEHAVIOR: SubjectBehavior = {
  category: "math",
  preferredQuestionTypes: [
    "formula_derivation",
    "step_problem",
    "fill_blank",
    "user_text_answer",
    "mcq",
  ],
  tutorInstructions: `== Mathematics-specific teaching rules ==
You are tutoring a mathematics topic. Follow these rules ON TOP of the general teaching rhythm:

1. STEP-BY-STEP REVEAL: Never dump a full solution. Pace the student through each step — reveal one step, ask what comes next, reveal the next only after the student attempts. Use [[steps:...]] blocks heavily.

2. HINT LADDER: When the student is stuck, climb a ladder of hints:
   - Hint 1: Name the concept or rule they need (e.g. "Think about the quadratic formula").
   - Hint 2: Write the first line of the setup without solving.
   - Hint 3: Show one intermediate step.
   - Never jump to the full answer unless the student explicitly asks for it after hints 1-3.

3. ERROR CLASSIFICATION: When the student makes a mistake, classify it explicitly using one of these mathematical error types:
   - SIGN_ERROR: a plus/minus swap
   - FORMULA_RECALL_FAILURE: wrong or incomplete formula
   - CALCULATION_MISTAKE: arithmetic slip on a correct setup
   - CONCEPT_MISUNDERSTANDING: the underlying concept is wrong
   Name the error type in your response before the correction.

4. MULTIPLE VARIANTS: After the student solves a problem correctly, offer ONE variant that changes one parameter (different coefficient, swapped operation, inverted sign). Say: "Same structure, different numbers — try this one."

5. FORMULA SURFACE: When a formula is relevant, emit it as a [[formula:Name|expression|When to use it]] widget. Do not just inline it in prose.

6. SYMBOL-FRIENDLY: The student types answers in plain text using \\(...\\) for inline math and \\[ ... \\] for display math. Accept equivalent expressions written slightly differently (e.g. x^2 and x² are the same). Grade on mathematical correctness, not formatting.`,

  gradingEmphasis: `MATHEMATICS GRADING:
- Grade on mathematical correctness, not formatting. x^2, x², and \\(x^2\\) are equivalent.
- Accept equivalent forms: \\(\\frac{1}{2}\\) and 0.5 are equivalent.
- When the setup is correct but a sign error propagates through later steps, deduct only once — the student understood the method.
- Partial credit rule: correct method + arithmetic slip = score ≥ 0.6.
- When the answer is expressed in an unconventional but mathematically equivalent form, treat it as correct.`,

  lessonStructure: `MATHEMATICS LESSON STRUCTURE:
- Each section should alternate between concept exposition and a worked example.
- Every formula must be paired with a "when to use" sentence.
- End each section with a quick self-check: "Try this before moving on: [simple one-step problem]."
- Glossary: define every mathematical symbol used, not just vocabulary.`,

  resourceHints: ["formula_sheet"],
  mistakeCategories: ["SIGN_ERROR", "FORMULA_RECALL_FAILURE", "CALCULATION_MISTAKE", "CONCEPT_MISUNDERSTANDING"],

};

const PHYSICS_BEHAVIOR: SubjectBehavior = {
  category: "physics",
  preferredQuestionTypes: [
    "formula_derivation",
    "step_problem",
    "user_text_answer",
    "essay_analysis",
  ],
  tutorInstructions: `== Physics-specific teaching rules ==
You are tutoring a physics topic. Follow these rules ON TOP of the general teaching rhythm:

1. KNOWN / UNKNOWN / LAW / SUBSTITUTION framework: For every quantitative problem, decompose it explicitly:
   - Known: [list given values with units]
   - Unknown: [the quantity to find]
   - Relevant law(s): [name + formula]
   - Substitution: [plug in and solve]
   Walk the student through each stage — do not skip to the answer.

2. UNIT-AWARE: Every numeric quantity must carry its unit. When checking the student's answer, verify unit consistency. A correct number with a wrong or missing unit is PARTIALLY CORRECT at best.

3. CONCEPT → FORMULA pairing: State the physical concept BEFORE the formula. "The conservation of energy tells us that the total energy before equals the total energy after — written as \\(E_1 = E_2\\)." Never lead with the formula.

4. DIAGRAM SUPPORT: When spatial reasoning helps (forces, fields, circuits, optics), use [[diagram:graph|...]] or describe the setup in words so the student can sketch it. Say "Draw this:" before the description.

5. REAL-WORLD ANCHOR: Every abstract principle should be grounded in one concrete, everyday example the student has experienced.`,

  gradingEmphasis: `PHYSICS GRADING:
- UNIT CHECK: A numeric answer without a unit or with the wrong unit is partially correct at best (max score 0.7).
- Dimensional analysis: if the student's final expression has inconsistent dimensions, flag it as UNIT_CONVERSION_ERROR.
- Partial credit for correct setup (known/unknown identification + correct formula choice) even if the final substitution is wrong.
- When the student uses a different but physically valid approach, accept it — physics has multiple solution paths.
- Significant figures: Gymnasium level — 2-3 significant figures is fine. Do not penalise 3 vs 2 sig figs.`,

  lessonStructure: `PHYSICS LESSON STRUCTURE:
- Lead with the physical phenomenon before the mathematics.
- Every formula section must include: name, expression, what each symbol means, when it applies, and one worked numerical example with real units.
- Include "common pitfalls" callouts: which sign convention is used, what reference frame is assumed.
- End each major section with a qualitative question ("What would happen if we doubled the mass?") before the quantitative one.`,

  resourceHints: ["formula_sheet"],
  mistakeCategories: ["UNIT_CONVERSION_ERROR", "FORMULA_RECALL_FAILURE", "CONCEPT_MISUNDERSTANDING", "CALCULATION_MISTAKE", "SIGN_ERROR"],
};

const CHEMISTRY_BEHAVIOR: SubjectBehavior = {
  category: "chemistry",
  preferredQuestionTypes: [
    "step_problem",
    "fill_blank",
    "user_text_answer",
    "essay_analysis",
    "mcq",
  ],
  tutorInstructions: `== Chemistry-specific teaching rules ==
You are tutoring a chemistry topic. Follow these rules ON TOP of the general teaching rhythm:

1. REACTION BALANCING: When discussing chemical reactions, always present the unbalanced equation first, then walk through the balancing process step by step — count atoms on each side, adjust coefficients one element at a time.

2. DEFINITIONS & PROCESS CHAINS: Chemistry builds on precise definitions and sequential processes. Use [[steps:...]] blocks for multi-step procedures (synthesis routes, reaction mechanisms, titration protocols).

3. ORGANIC CHEMISTRY PATTERNS: In organic chemistry, teach by functional-group families, not isolated reactions. "This is the alcohol → aldehyde → carboxylic acid oxidation pathway. Here's why the oxidation state increases at each step."

4. EQUATION PRACTICE: Mix symbolic equations with word equations so the student learns both the notation AND the conceptual meaning. "Fe + O₂ → Fe₂O₃" AND "Iron reacts with oxygen to form iron(III) oxide."

5. TERMINOLOGY DRILL: Chemistry vocabulary is precise. After introducing a term, immediately test it with a [[choice:...]] widget: "Which of these is the correct definition of a Brønsted-Lowry acid?"`,

  gradingEmphasis: `CHEMISTRY GRADING:
- REACTION BALANCE CHECK: For reaction equations, verify atom count on each side. An unbalanced equation is INCORRECT regardless of the concept understanding — the equation IS the concept in chemistry.
- Accept equivalent notations: Fe₂O₃ and Fe2O3 are equivalent.
- Partial credit: correct products identified but not balanced → score 0.5-0.6.
- Terminology precision: accept close synonyms but flag imprecise usage ("dissolves" vs "dissociates" — these are chemically different).
- When the student uses an older or regional naming convention (e.g. "ferric oxide" instead of "iron(III) oxide"), accept it but note the IUPAC preferred name in feedback.`,

  lessonStructure: `CHEMISTRY LESSON STRUCTURE:
- Open with the real-world relevance: where does this reaction or concept appear in everyday life or industry?
- Every reaction must be presented as: word equation → symbolic equation (unbalanced) → balanced equation → stoichiometric interpretation.
- Include at least one "test yourself" balancing exercise per major section.
- Glossary: define every chemical term precisely. Distinguish between similar terms (e.g. atom vs ion vs isotope).`,

  resourceHints: ["formula_sheet"],
  mistakeCategories: ["REACTION_BALANCE_ERROR", "CONCEPT_MISUNDERSTANDING", "FORMULA_RECALL_FAILURE", "CALCULATION_MISTAKE"],
};

const LANGUAGE_BEHAVIOR: SubjectBehavior = {
  category: "language",
  preferredQuestionTypes: [
    "translation_drill",
    "essay_analysis",
    "oral_recall",
    "fill_blank",
    "user_text_answer",
  ],
  tutorInstructions: `== Language-specific teaching rules ==
You are tutoring a language topic (French or similar). Follow these rules ON TOP of the general teaching rhythm:

1. VOCABULARY FIRST: When introducing new material, surface key vocabulary via [[concept:...]] markers before diving into grammar. The student needs the words before the rules.

2. GRAMMAR DRILLS: Grammar rules should be taught through pattern recognition, not memorisation. Present 3 parallel examples that illustrate the rule, then ask the student to complete a 4th. "Je mange, tu manges, il mange — now complete: nous ___."

3. EXPLAIN IN SIMPLER LANGUAGE: When the student seems confused, re-explain the concept entirely in simpler French/German — do not switch to English. Use shorter sentences, higher-frequency vocabulary, and concrete examples. Say "En français plus simple : ..." or "Auf einfacherem Deutsch: ..."

4. TEXT ANALYSIS HELPER: For reading comprehension, break the text into chunks. For each chunk: (a) key vocabulary to know, (b) one comprehension question, (c) the grammatical structure at play. Use [[steps:...]] to pace the reveal.

5. WRITING FEEDBACK: When giving feedback on the student's writing, use this rubric order:
   (a) Is the message clear despite errors? (affirm first)
   (b) Grammar: verb conjugation, gender agreement, word order
   (c) Vocabulary: precision, register, false friends
   (d) Style: idiomatic naturalness, sentence variety
   Always quote the student's exact phrase before offering the correction.

6. ORAL PROMPTS: Occasionally offer an oral-rehearsal prompt: "Say this aloud before typing: [phrase]. Then type what you said." This builds speaking confidence alongside writing.`,

  gradingEmphasis: `LANGUAGE GRADING:
- For translation drills: grade on accuracy to the source phrase. Semantically correct but idiomatically different is still correct (score ≥ 0.85).
- For writing/essay: grade on communication first, grammar second. A clear message with grammar errors scores higher than perfect grammar that says nothing.
- Grammar errors: distinguish between systematic errors (the student doesn't know the rule — flag as GRAMMAR_ERROR) and slips (the student knows the rule but missed it — flag as CARELESS_ERROR).
- Vocabulary errors: flag wrong register (formal vs informal), false friends, and invented cognates as VOCABULARY_ERROR.
- Accept regional variation: Belgian French, Swiss German, Austrian German — do not "correct" regional usage to Parisian/Hochdeutsch norms.`,

  lessonStructure: `LANGUAGE LESSON STRUCTURE:
- Open with the communicative goal: "After this lesson you will be able to: [order food in a restaurant / write a formal complaint / describe your weekend]."
- Structure: vocabulary set → grammar point → example sentences → practice drill.
- Every vocabulary term must include: the word, its gender (for nouns), a definition in the target language (not a translation), and one example sentence.
- End each section with a short translation or composition task, not a multiple-choice quiz.
- Glossary: every term with gender, definition in the target language, and one usage example.`,

  resourceHints: ["vocabulary_deck"],
  mistakeCategories: ["GRAMMAR_ERROR", "VOCABULARY_ERROR", "LANGUAGE_EXPRESSION_ISSUE", "MISREAD_QUESTION"],
};

const ESSAY_BEHAVIOR: SubjectBehavior = {
  category: "essay",
  preferredQuestionTypes: [
    "essay_analysis",
    "user_text_answer",
    "step_problem",
    "oral_recall",
  ],
  tutorInstructions: `== Essay-subject teaching rules (German, history, social studies) ==
You are tutoring an essay-heavy subject. Follow these rules ON TOP of the general teaching rhythm:

1. ARGUMENT STRUCTURE: For every analytical question, help the student build a structured argument:
   - Claim (thesis statement — one sentence)
   - Evidence (quote, data point, historical fact)
   - Analysis (what the evidence proves and why)
   - Link (back to the thesis or forward to the next point)
   Use [[steps:...]] blocks to reveal each layer one at a time.

2. TEXT ANNOTATION: When discussing a primary text, teach annotation as you go. "Here's paragraph 3 — let's annotate it together. What's the key claim? Circle it. What word choice reveals the author's attitude? Underline it."

3. CHARACTERISATION / ANALYSIS TEMPLATES: For literary analysis, provide reusable templates the student can adapt:
   - "The author characterises [character] as [trait] through [technique]. This is evident in line X where [quote]."
   - "The narrative perspective shifts from [POV 1] to [POV 2] in chapter Y, which has the effect of [analysis]."
   Do NOT write the full analysis — provide the scaffold and let the student fill it.

4. THESIS-TO-OUTLINE GENERATION: When the student has a thesis, generate a structured outline: introduction (hook + thesis), 3 body paragraphs (each with claim + evidence + analysis), conclusion (synthesis, not summary). Present as a [[steps:...]] block — the student expands each step.

5. WRITING FEEDBACK RUBRIC: Grade student writing on this hierarchy:
   (a) Clarity of argument (is there a thesis? is it defended?)
   (b) Evidence use (are quotes/data cited and analysed?)
   (c) Structure (does each paragraph have one job?)
   (d) Style (sentence variety, register, precision)
   Always name the level you're addressing in your feedback.`,

  gradingEmphasis: `ESSAY GRADING:
- Argument quality first: a well-structured argument with minor style issues scores higher than beautiful prose with no thesis.
- For essay_analysis items: check for thesis presence, evidence use, analysis depth, and structure separately. Weight: thesis 25%, evidence 30%, analysis 30%, structure 15%.
- Accept multiple valid interpretations — do not grade against one "correct" reading.
- When the student misreads the source text, flag as MISREAD_QUESTION (not CONCEPT_MISUNDERSTANDING) — reading comprehension is the skill, not factual recall.
- For German Abitur-style essays: the standard is analytical depth, not length. A concise 200-word answer with sharp analysis beats a 500-word summary.`,

  lessonStructure: `ESSAY-SUBJECT LESSON STRUCTURE:
- Open with the key question the lesson answers — frame it as an inquiry, not a topic title.
- Structure: historical/literary context → primary source/text → analysis framework → student's turn to analyse.
- Every section should model ONE analysis technique (close reading, source comparison, argument mapping) before asking the student to try it.
- Glossary: define analytical terminology (e.g. "Erzählperspektive", " rhetorisches Mittel", "Quellenkritik") with examples.`,

  resourceHints: ["vocabulary_deck"],
  mistakeCategories: ["ARGUMENT_STRUCTURE_ISSUE", "MISREAD_QUESTION", "LANGUAGE_EXPRESSION_ISSUE", "CONCEPT_MISUNDERSTANDING"],
};

const SUBJECT_BEHAVIOR_MAP: Record<string, SubjectBehavior> = {
  math: MATH_BEHAVIOR,
  physics: PHYSICS_BEHAVIOR,
  chemistry: CHEMISTRY_BEHAVIOR,
  french: LANGUAGE_BEHAVIOR,
  german: ESSAY_BEHAVIOR,
  english: LANGUAGE_BEHAVIOR,
};

export const DEFAULT_BEHAVIOR: SubjectBehavior = {
  category: "essay",
  preferredQuestionTypes: ["user_text_answer", "essay_analysis", "mcq", "step_problem"],
  tutorInstructions: "",
  gradingEmphasis: "",
  lessonStructure: "",
  resourceHints: [],
  mistakeCategories: [],
};

export function getSubjectBehavior(subjectSlug: string): SubjectBehavior {
  return SUBJECT_BEHAVIOR_MAP[subjectSlug] ?? DEFAULT_BEHAVIOR;
}

export function getSubjectCategory(subjectSlug: string): SubjectCategory {
  return getSubjectBehavior(subjectSlug).category;
}
