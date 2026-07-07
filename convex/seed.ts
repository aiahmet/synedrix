import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { resolveUserReadOnly as resolveUser } from "./users";

type WorkedExampleSeed = { readonly setup: string; readonly solution: string; readonly skill: string; };
type CommonMistakeSeed = { readonly mistake: string; readonly correction: string; readonly cause: string; };
type FormulaSeed = { readonly name: string; readonly expression: string; readonly when: string; };
type VocabularySeed = { readonly term: string; readonly definition: string; readonly gender?: "m" | "f" | "n"; readonly example?: string; };
type PracticeItemSeed = { readonly question: string; readonly answer: string; readonly explanation: string; readonly skill: string; readonly type?: "mcq" | "short_answer" | "worked_walkthrough"; readonly options?: readonly string[]; };
type FlashcardSeed = { readonly front: string; readonly back: string; };

type LessonSeed = {
  readonly title: string; readonly content: string;
  readonly depth: "simple" | "standard" | "rigorous"; readonly order: number;
  readonly workedExamples?: readonly WorkedExampleSeed[];
  readonly commonMistakes?: readonly CommonMistakeSeed[];
  readonly formulas?: readonly FormulaSeed[];
  readonly vocabulary?: readonly VocabularySeed[];
};

type TopicSeed = {
  readonly slug: string; readonly title: string; readonly objectives: readonly string[];
  readonly examRelevance: number; readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly estimatedMinutes: number; readonly gradeLevel: string;
  readonly lessonBlocks: readonly LessonSeed[];
  readonly formulaSheet?: readonly FormulaSeed[];
  readonly vocabularyDeck?: readonly VocabularySeed[];
  readonly practiceSet?: readonly PracticeItemSeed[];
  readonly flashcardDeck?: readonly FlashcardSeed[];
};

type ChapterSeed = {
  readonly slug: string; readonly title: string; readonly description: string;
  readonly order: number; readonly topics: readonly TopicSeed[];
};

type SubjectSeed = {
  readonly slug: string; readonly title: string; readonly description: string;
  readonly shortBlurb: string; readonly color: string; readonly icon: string;
  readonly chapters: readonly ChapterSeed[];
};

function fs(name: string, expression: string, when: string): FormulaSeed { return { name, expression, when }; }
function ps(q: string, a: string, ex: string, skill: string): PracticeItemSeed { return { question: q, answer: a, explanation: ex, skill }; }
function fc(front: string, back: string): FlashcardSeed { return { front, back }; }
function we(setup: string, solution: string, skill: string): WorkedExampleSeed { return { setup, solution, skill }; }
function cm(mistake: string, correction: string, cause: string): CommonMistakeSeed { return { mistake, correction, cause }; }
function vs(term: string, definition: string, gender?: "m" | "f" | "n", example?: string): VocabularySeed {
  const v: VocabularySeed & { gender?: string; example?: string } = { term, definition };
  if (gender) v.gender = gender;
  if (example) v.example = example;
  return v;
}

function block(title: string, depth: "simple"|"standard"|"rigorous", content: string, opts?: { we?: WorkedExampleSeed[]; cm?: CommonMistakeSeed[]; f?: FormulaSeed[]; v?: VocabularySeed[] }): LessonSeed {
  return { depth, order: depth === "simple" ? 0 : depth === "standard" ? 1 : 2, title, content, workedExamples: opts?.we, commonMistakes: opts?.cm, formulas: opts?.f, vocabulary: opts?.v };
}

interface TopicOpts {
  formulaSheet?: FormulaSeed[];
  vocabularyDeck?: VocabularySeed[];
  practiceSet?: PracticeItemSeed[];
  flashcardDeck?: FlashcardSeed[];
}

function t(
  slug: string, title: string, objectives: string[], examRelevance: number,
  difficulty: "EASY"|"MEDIUM"|"HARD", estimatedMinutes: number, gradeLevel: string,
  simple: LessonSeed, standard: LessonSeed, rigorous: LessonSeed,
  opts?: TopicOpts
): TopicSeed {
  return { slug, title, objectives, examRelevance, difficulty, estimatedMinutes, gradeLevel, lessonBlocks: [simple, standard, rigorous], ...(opts ?? {}) };
}

// ═══ CANONICAL CURRICULUM ═══

const CANONICAL_SUBJECTS: readonly SubjectSeed[] = [
  // ── MATH ──
  {
    slug: "math", title: "Mathematics",
    description: "Step-by-step solving workspace, hint ladder, formula sheet, error classification by concept.",
    shortBlurb: "Step-by-step solving workspace, formula sheet.",
    color: "subject-math", icon: "math",
    chapters: [
      {
        slug: "algebra", title: "Algebra", description: "Functions, equations, and structural reasoning.", order: 1,
        topics: [
          t("logarithms", "Logarithms",
            ["Define log as the inverse of exponential.", "Apply the change-of-base rule.", "Solve logarithmic equations."],
            5, "MEDIUM", 35, "11",
            block("What a logarithm actually is", "simple",
              "A logarithm answers: what exponent do I need? log_b(x) is the exponent y so that b^y = x. So log_2(8) = 3 because 2^3 = 8. Read it as the power that makes x. Concrete anchors: log_10(1000) = 3, log_5(125) = 3, log_3(1/27) = -3.",
              { we: [we("Compute log_2(32).", "2 to what power is 32? 2^5 = 32, so log_2(32) = 5.", "evaluate-log")] }),
            block("The five rules you actually need", "standard",
              "Five rules cover nearly every Gymnasium logarithm: 1. Product: log(xy) = log x + log y. 2. Quotient: log(x/y) = log x - log y. 3. Power: log(x^k) = k * log x. 4. Change of base: log_b(x) = ln x / ln b. 5. Identity: log_b(1) = 0, log_b(b) = 1.\n\nWorked: simplify log_2(8a) = log_2(8) + log_2(a) = 3 + log_2(a). Solve log x + log(x-3) = log 4, combine to log(x(x-3)) = log 4, so x^2 - 3x - 4 = 0, giving x = 4 (reject x = -1).",
              { we: [we("Solve log_2(x) + log_2(x-6) = 4.", "Combine: log_2(x(x-6)) = 4, so x(x-6) = 16, x^2 - 6x - 16 = 0, (x-8)(x+2) = 0. x = 8 valid, x = -2 rejected.", "solve-log-equation")],
                f: [fs("Product rule", "log_b(xy) = log_b x + log_b y", "Breaking apart a log of a product."), fs("Change of base", "log_b(x) = ln x / ln b", "Calculator only knows ln and log_10.")] }),
            block("Where logs meet upper-secondary", "rigorous",
              "Logs pair with calculus and physics. Derivative: d/dx ln x = 1/x, with chain rule d/dx ln f(x) = f'(x)/f(x). Log scales: decibels (log_10 of intensity), bit depth (log_2). Change-of-base in disguise: every logarithm is a multiple of ln — when the exam asks for log_3(7), compute ln 7 / ln 3.",
              { f: [fs("Derivative of ln", "d/dx ln x = 1/x", "Differentiating natural-log functions.")] }),
            { formulaSheet: [
              fs("Definition", "log_b(x) = y iff b^y = x", "Converting between forms."),
              fs("Product rule", "log_b(xy) = log_b x + log_b y", "Breaking up a log of a product."),
              fs("Quotient rule", "log_b(x/y) = log_b x - log_b y", "Breaking up a log of a quotient."),
              fs("Power rule", "log_b(x^k) = k log_b x", "Bringing an exponent down."),
              fs("Change of base", "log_b(x) = ln x / ln b", "Converting to calculator-friendly base."),
            ],
            practiceSet: [
              ps("Simplify log_3(27) + log_3(9).", "log_3(27) = 3, log_3(9) = 2, so 3 + 2 = 5.", "Sum of individual logs.", "evaluate-log"),
              ps("Solve log(x+1) + log(x-1) = log 3.", "log((x+1)(x-1)) = log 3, x^2 - 1 = 3, x^2 = 4, x = 2 (x = -2 rejected, log of negative).", "Combine logs and check domain.", "solve-log-equation"),
              ps("Express log_5(20) using only ln.", "log_5(20) = ln 20 / ln 5.", "Change-of-base formula.", "change-of-base"),
              ps("Simplify 2 log x + log y - log z.", "log(x^2 y / z)", "Combine using product, power, and quotient rules.", "log-properties"),
              ps("Given log 2 ~ 0.301 and log 3 ~ 0.477, find log 72.", "72 = 2^3 * 3^2, so log 72 = 3 log 2 + 2 log 3 = 3(0.301) + 2(0.477) = 1.857.", "Decompose and use known values.", "log-properties"),
            ],
            flashcardDeck: [
              fc("What is a logarithm?", "The exponent to which a base must be raised. log_b(x) = y iff b^y = x."),
              fc("Product rule for logs", "log_b(xy) = log_b x + log_b y"),
              fc("Quotient rule for logs", "log_b(x/y) = log_b x - log_b y"),
              fc("Power rule for logs", "log_b(x^k) = k * log_b x"),
              fc("Change of base formula", "log_b(x) = log x / log b = ln x / ln b"),
              fc("What is log_b(1)?", "0 (any base to power 0 is 1)"),
              fc("What is log_b(b)?", "1 (base to power 1 is itself)"),
              fc("Domain of log_b(x)", "x > 0; log of zero or negative is undefined."),
            ]
          }),
          t("quadratics", "Quadratic equations",
            ["Solve by factoring, completing the square, and the quadratic formula.", "Interpret the discriminant."],
            5, "EASY", 25, "10",
            block("Quadratics, in one picture", "simple",
              "A quadratic is a*x^2 + b*x + c. Its graph is a parabola opening up if a > 0, down if a < 0. Vertex at x = -b/(2a). Roots are where it crosses the x-axis. Discriminant D = b^2 - 4ac: D > 0 gives 2 real roots, D = 0 gives 1, D < 0 gives none.",
              { f: [fs("Discriminant", "D = b^2 - 4ac", "Number of real solutions.")] }),
            block("Three methods, one answer", "standard",
              "Factoring: rewrite as (px+q)(rx+s), fastest for integers. Completing the square: a(x-h)^2 + k exposes vertex. Quadratic formula: x = (-b +- sqrt(b^2-4ac)) / (2a), always works.",
              { we: [we("Solve 2x^2 - 7x + 3 = 0 by factoring.", "Factors of 2*3=6 summing to -7: -1 and -6. 2x^2 - x - 6x + 3 = x(2x-1) - 3(2x-1) = (x-3)(2x-1) = 0. x = 3 or x = 1/2.", "quadratic-factoring")],
                f: [fs("Quadratic formula", "x = (-b +- sqrt(b^2-4ac)) / (2a)", "Solving any quadratic.")],
                cm: [cm("Forgetting the +- in the quadratic formula.", "The formula always gives two values (may coincide when D=0).", "Rushing or memorizing only the positive root.")] }),
            block("Vieta and parameter quadratics", "rigorous",
              "Vieta: if x1, x2 are roots of a*x^2 + b*x + c = 0, then x1+x2 = -b/a and x1*x2 = c/a. Gold for parameterized problems. Two real roots: D >= 0. Two distinct: D > 0. Opposite signs: c/a < 0. Both positive: c/a > 0 AND -b/a > 0.",
              { f: [fs("Vieta: sum", "x1 + x2 = -b/a", "When root-sum is given."), fs("Vieta: product", "x1 * x2 = c/a", "When root-product is given.")] }),
            { formulaSheet: [
              fs("Standard form", "ax^2 + bx + c = 0", "The general quadratic."),
              fs("Quadratic formula", "x = (-b +- sqrt(b^2-4ac)) / (2a)", "Solving any quadratic."),
              fs("Discriminant", "D = b^2 - 4ac", "Number of roots."),
              fs("Vertex form", "f(x) = a(x-h)^2 + k", "Finding min/max."),
              fs("Vertex x-coordinate", "x_v = -b / (2a)", "Axis of symmetry."),
            ],
            practiceSet: [
              ps("Solve x^2 - 5x + 6 = 0 by factoring.", "(x-2)(x-3) = 0, so x = 2 or x = 3.", "Factor and set each to zero.", "quadratic-factoring"),
              ps("Solve 2x^2 + 4x - 1 = 0 using the quadratic formula.", "x = (-4 +- sqrt(24)) / 4 = -1 +- sqrt(6)/2.", "Plug into formula, simplify.", "quadratic-formula"),
              ps("Find the vertex of f(x) = x^2 - 6x + 5.", "x_v = 3, y_v = -4. Vertex: (3, -4).", "x = -b/(2a), evaluate.", "vertex"),
              ps("How many real solutions: x^2 + x + 1 = 0?", "D = 1 - 4 = -3 < 0, so 0 real solutions.", "Check sign of discriminant.", "discriminant"),
              ps("Find k for one real root: x^2 + kx + 9 = 0.", "D = k^2 - 36 = 0, k = +-6.", "Set discriminant to zero.", "discriminant-parameter"),
            ],
            flashcardDeck: [
              fc("Quadratic formula", "x = (-b +- sqrt(b^2 - 4ac)) / (2a)"),
              fc("What does D > 0 mean?", "Two distinct real roots."),
              fc("Vertex formula (x)", "x_v = -b / (2a)"),
              fc("Vieta: sum of roots", "x1 + x2 = -b/a"),
              fc("Vieta: product of roots", "x1 * x2 = c/a"),
              fc("When to complete the square", "When you need vertex form or min/max value."),
              fc("When to use factoring", "When coefficients are small integers."),
              fc("When does a quadratic have no real solutions?", "When D = b^2 - 4ac < 0."),
            ]
          }),
        ],
      },
    ],
  },

  // ── PHYSICS ──
  {
    slug: "physics", title: "Physics",
    description: "Concepts paired with formulas, unit-aware problems, decomposition into knowns, unknowns, laws.",
    shortBlurb: "Concepts paired with formulas, unit-aware problems.",
    color: "subject-physics", icon: "physics",
    chapters: [
      {
        slug: "mechanics", title: "Mechanics", description: "Kinematics, dynamics, energy, and momentum.", order: 1,
        topics: [
          t("newtons-laws", "Newton's laws",
            ["Apply F = m*a to free-body diagrams.", "Distinguish contact and field forces.", "Solve incline and pulley problems."],
            5, "MEDIUM", 30, "10",
            block("What forces actually do", "simple",
              "A force changes an object's motion. Newton's second law: F = m*a. Double the force, double the acceleration. Double the mass, halve it. Common confusion: constant velocity means zero acceleration, so net force must be zero — forces are balanced, not absent.",
              { f: [fs("Newton's second law", "F = m * a", "Relating net force to acceleration.")],
                cm: [cm("Thinking a moving object must have a net force.", "At constant velocity, a=0, so F_net = 0.", "Aristotelian intuition that motion implies force.")] }),
            block("Free-body diagrams in practice", "standard",
              "List every force on one object as arrows. Sum vectors for net force, then F = m*a. Three patterns: (1) Incline: weight splits into mg*sin(theta) parallel and mg*cos(theta) perpendicular. (2) Pulley: tension same both sides. (3) Friction: kinetic f_k = mu_k * N opposite motion; static f_s <= mu_s * N.",
              { we: [we("5 kg block on frictionless 30 degree incline. Find acceleration.", "Net force: mg*sin(30) = 5 * 9.81 * 0.5 = 24.53 N. a = 24.53/5 = 4.9 m/s^2 down the incline.", "incline")],
                f: [fs("Friction (kinetic)", "f_k = mu_k * N", "Sliding friction.")] }),
            block("Newton's third law and momentum", "rigorous",
              "Third law: equal and opposite reaction. Momentum conservation: m1*v1 + m2*v2 = m1*v1' + m2*v2'. Elastic = KE conserved; inelastic = not. Impulse J = F*delta-t = delta-p. Airbags extend delta-t, reducing F for the same delta-p.",
              { f: [fs("Conservation of momentum", "m1*v1 + m2*v2 = m1*v1' + m2*v2'", "Collisions in a closed system.")] }),
            { formulaSheet: [
              fs("Newton's second law", "F = m * a", "Net force (N) to mass (kg) and acceleration (m/s^2)."),
              fs("Weight", "F_g = m * g", "Gravity near Earth (g = 9.81 m/s^2)."),
              fs("Friction (kinetic)", "f_k = mu_k * N", "Sliding friction."),
              fs("Impulse-momentum", "J = F * delta-t = delta-p", "Force over time to momentum change."),
            ],
            practiceSet: [
              ps("A 2 kg object feels 10 N net force. Acceleration?", "a = 10/2 = 5 m/s^2.", "Direct application of F=ma.", "F=ma"),
              ps("10 kg box on frictionless 20 degree incline. Acceleration?", "mg*sin(20) = 10*9.81*sin(20) = 33.6 N. a = 3.36 m/s^2.", "Incline with mg*sin(theta).", "incline"),
              ps("50 kg person in elevator accelerating up at 2 m/s^2. Scale reading?", "N = mg + ma = 50*(9.81+2) = 590.5 N (~60.2 kg apparent).", "Normal force in accelerating frame.", "elevator"),
              ps("3 kg at 4 m/s right, 5 kg at 2 m/s left stick together. Final v?", "p_init = 12 - 10 = 2 kg*m/s. v = 2/8 = 0.25 m/s right.", "Conservation of momentum.", "momentum"),
              ps("1000 kg car from 20 m/s to 0 in 4 s. Average force?", "a = -5 m/s^2. F = -5000 N. Or F = delta-p/delta-t = -20000/4 = -5000 N.", "F=ma or impulse-momentum.", "F=ma"),
            ],
            flashcardDeck: [
              fc("Newton's first law", "Object at rest stays at rest; in motion stays in motion unless acted on by net force."),
              fc("Newton's second law", "F = ma."),
              fc("Newton's third law", "Equal and opposite reaction."),
              fc("What is a free-body diagram?", "All forces on one object drawn as arrows from center."),
              fc("Normal force", "Perpendicular contact force from surface."),
              fc("Kinetic vs static friction", "Kinetic: f_k = mu_k*N. Static: f_s <= mu_s*N."),
              fc("Conservation of momentum", "Total momentum before = total momentum after."),
              fc("What is impulse?", "J = F*delta-t = delta-p."),
            ]
          }),
        ],
      },
    ],
  },

  // ── CHEMISTRY ──
  {
    slug: "chemistry", title: "Chemistry",
    description: "Reaction balancing drills, organic chemistry pattern learning, definitions and process chains.",
    shortBlurb: "Reaction drills, organic patterns, equation practice.",
    color: "subject-chemistry", icon: "chemistry",
    chapters: [
      {
        slug: "stoichiometry", title: "Stoichiometry", description: "Mass and mole relationships in reactions.", order: 1,
        topics: [
          t("balancing", "Balancing reactions",
            ["Balance chemical equations by atom count.", "Identify limiting reagents.", "Compute theoretical and percent yield."],
            4, "EASY", 20, "10",
            block("Atoms are conserved", "simple",
              "Every reaction obeys: atoms are not created or destroyed. Methane burning: CH4 + 2 O2 -> CO2 + 2 H2O. Count: C=1=1, H=4=4, O=4=4. Adjust coefficients (front), never subscripts — those define the substance.",
              { cm: [cm("Changing subscripts: H2 + O2 -> H4O2.", "Only change coefficients: 2 H2 + O2 -> 2 H2O.", "Treating subscripts as adjustable.")] }),
            block("The atom-counting workflow", "standard",
              "Balance the element with most atoms first. Leave H and O last. Example: C3H8 + O2 -> CO2 + H2O. C: 3 -> 3 CO2. H: 8 -> 4 H2O. O: 3*2 + 4 = 10 -> 5 O2. Final: C3H8 + 5 O2 -> 3 CO2 + 4 H2O.",
              { we: [we("Balance Fe + O2 -> Fe2O3.", "Fe: 2 on right -> 2 Fe on left. O: 3 on right, 2/O2 -> 3/2 O2. Multiply by 2: 4 Fe + 3 O2 -> 2 Fe2O3.", "balancing")] }),
            block("Limiting reagents and percent yield", "rigorous",
              "Limiting reagent caps product. Find: divide moles by stoichiometric coefficient; smallest wins. Theoretical yield = that ratio times product coefficient. Percent = actual/theoretical * 100.",
              { f: [fs("Percent yield", "% = (actual / theoretical) * 100", "Lab vs theoretical.")] }),
            { formulaSheet: [
              fs("Moles from mass", "n = m / M", "Mass (g) to moles via molar mass (g/mol)."),
              fs("Percent yield", "% = (actual / theoretical) * 100", "Reaction efficiency."),
            ],
            practiceSet: [
              ps("Balance N2 + H2 -> NH3.", "N2 + 3 H2 -> 2 NH3.", "Count N then H.", "balancing"),
              ps("Balance C2H6 + O2 -> CO2 + H2O.", "2 C2H6 + 7 O2 -> 4 CO2 + 6 H2O.", "Balance C, H, then O.", "balancing"),
              ps("4 mol Fe, 3 mol O2 (4 Fe + 3 O2 -> 2 Fe2O3). Limiting?", "Fe: 4/4=1, O2: 3/3=1. Neither is limiting — exact proportion.", "Compare mole ratios.", "limiting-reagent"),
              ps("Theoretical 50 g, actual 42 g. Percent yield?", "42/50 * 100 = 84%.", "Actual / theoretical.", "percent-yield"),
              ps("Balance Al + HCl -> AlCl3 + H2.", "2 Al + 6 HCl -> 2 AlCl3 + 3 H2.", "Balance Al, Cl, then H.", "balancing"),
            ],
            flashcardDeck: [
              fc("Law of conservation of mass", "Atoms are neither created nor destroyed."),
              fc("Coefficient vs subscript", "Coefficient: # molecules. Subscript: atoms per molecule."),
              fc("Limiting reagent", "Runs out first, determines max product."),
              fc("Percent yield formula", "(actual / theoretical) * 100%"),
              fc("Mole", "6.022 * 10^23 particles. 1 mol = atomic mass in grams."),
              fc("Moles from mass", "n = m / M"),
            ]
          }),
        ],
      },
    ],
  },

  // ── FRENCH ──
  {
    slug: "french", title: "French",
    description: "Vocabulary decks, grammar drills, text-analysis helper, rubric scoring on writing.",
    shortBlurb: "Vocabulary decks, grammar drills, text analysis.",
    color: "subject-french", icon: "french",
    chapters: [
      {
        slug: "grammar", title: "Grammar", description: "Tenses, agreement, and the subjunctive.", order: 1,
        topics: [
          t("subjonctif", "Le subjonctif",
            ["Recognize triggers of the subjunctive mood.", "Form present subjunctive of regular verbs.", "Avoid tense-confusion traps."],
            5, "HARD", 35, "11",
            block("Mood, not tense", "simple",
              "The subjonctif is a mood, not a tense. It signals subjectivity — doubt, emotion, desire. Je sais qu'il vient (fact, indicative) vs Je veux qu'il vienne (desire, subjunctive). It marks the speaker's stance, not time.",
              { v: [vs("le subjonctif", "Der Konjunktiv (Modus der Subjektivitat)")] }),
            block("Triggers and regular conjugation", "standard",
              "Four trigger families: (1) Impersonal: il faut que. (2) Desire: je veux que. (3) Emotion/doubt: je suis content que. (4) Concessive: bien que. Conjugation: take ils/elles stem + -e, -es, -e, -ions, -iez, -ent. Parler -> que je parle, que tu parles, qu'il parle...",
              { cm: [cm("Using indicative after il faut que: Il faut qu'il vient.", "Il faut qu'il vienne — subjunctive required.", "Defaulting to indicative without checking triggers.")] }),
            block("Irregular subjonctives", "rigorous",
              "Irregular stems: etre (que je sois), avoir (que j'aie), aller (que j'aille), faire (que je fasse), pouvoir (que je puisse), savoir (que je sache), vouloir (que je veuille). Trap 1: apres que + indicative. Trap 2: il est certain que + indicative, but il est possible que + subjunctive.",
              { v: [vs("il est possible que", "es ist moglich, dass (+ Subjonctif)"), vs("apres que", "nachdem (+ Indikativ)")] }),
            { vocabularyDeck: [
              vs("le subjonctif", "der Konjunktiv", undefined, "Il faut que tu emploies le subjonctif ici."),
              vs("il faut que", "es ist notig, dass", undefined, "Il faut que tu finisses tes devoirs."),
              vs("bien que", "obwohl", undefined, "Bien qu'il pleuve, je sors."),
              vs("a moins que", "es sei denn, dass", undefined, "A moins que tu ne viennes, j'annule."),
              vs("je veux que", "ich will, dass", undefined, "Je veux que tu reussisses."),
              vs("je doute que", "ich bezweifle, dass", undefined, "Je doute qu'il ait raison."),
              vs("il est possible que", "es ist moglich, dass", undefined, "Il est possible qu'elle arrive tard."),
              vs("pour que", "damit", undefined, "Je t'explique pour que tu comprennes."),
              vs("avant que", "bevor (+ Subjonctif)", undefined, "Avant qu'il ne parte, dis-lui."),
              vs("le souhait", "der Wunsch", "m", "J'exprime le souhait que tout aille bien."),
            ],
            practiceSet: [
              ps("Conjugate: Il faut que tu (finir) tes devoirs.", "Il faut que tu finisses tes devoirs.", "Subjonctif of -ir verbs.", "subjonctif-conjugation"),
              ps("Subjonctif or indicatif? Je sais qu'il (etre) malade.", "Indicatif: Je sais qu'il est malade.", "Certainty -> indicative.", "subjonctif-trigger"),
              ps("Subjonctif or indicatif? Je veux qu'il (venir).", "Subjonctif: Je veux qu'il vienne.", "Desire -> subjunctive.", "subjonctif-trigger"),
              ps("Conjugate: Bien qu'elle (etre) fatiguee, elle continue.", "Bien qu'elle soit fatiguee.", "Subjonctif of etre.", "subjonctif-irregular"),
              ps("Translate: I am happy that you are here.", "Je suis content(e) que tu sois la.", "Emotion -> subjunctive.", "subjonctif-trigger"),
            ],
            flashcardDeck: [
              fc("What is the subjonctif?", "A mood for subjectivity: doubt, desire, emotion, necessity."),
              fc("4 subjonctif triggers", "1. Impersonal (il faut que). 2. Desire. 3. Emotion/doubt. 4. Concessive (bien que)."),
              fc("Present subjonctif endings", "-e, -es, -e, -ions, -iez, -ent"),
              fc("Subjonctif of etre", "que je sois, que tu sois, qu'il soit..."),
              fc("Subjonctif of avoir", "que j'aie, que tu aies, qu'il ait..."),
              fc("Subjonctif of faire", "que je fasse"),
              fc("Subjonctif of pouvoir", "que je puisse"),
              fc("apres que + indicatif or subjonctif?", "Indicatif! (temporal, not subjective)"),
              fc("avant que + indicatif or subjonctif?", "Subjonctif! (anticipation -> subjectivity)"),
            ]
          }),
        ],
      },
    ],
  },

  // ── GERMAN ──
  {
    slug: "german", title: "Deutsch",
    description: "Argument-structure support, text annotation, characterization and analysis templates.",
    shortBlurb: "Text annotation, characterization templates.",
    color: "subject-german", icon: "german",
    chapters: [
      {
        slug: "textanalyse", title: "Textanalyse", description: "Reading comprehension and structural analysis.", order: 1,
        topics: [
          t("erzaehlperspektive", "Erzahlperspektive",
            ["Identify first-person, third-person limited, and omniscient narration.", "Connect perspective to thematic effect."],
            4, "MEDIUM", 25, "11",
            block("Who tells the story?", "simple",
              "Erzahlperspektive: durch wessen Augen sieht der Leser? (1) Ich-Erzahler — first-person, tells own story. (2) Personaler Erzahler — third-person limited, follows one character. (3) Auktorialer Erzahler — omniscient, knows everything. The choice is rarely neutral.",
              { v: [vs("der Erzahler", "The narrator"), vs("unzuverlassig", "unreliable narrator")] }),
            block("Markers you can point at", "standard",
              "Ich-Erzahler: ich/wir, first-person verbs, subjective language. Personaler: er/sie, verbs reflecting interiority. Auktorial: evaluative claims, generalizations. Look at perception verbs (sehen, horen), time structure, and adjectives.",
              { v: [vs("das Innenleben", "inner life of a character"), vs("die Rahmung", "framing")] }),
            block("Perspective as argument", "rigorous",
              "Perspective carries argumentative weight. First-person perpetrator = unreliable narration. Personal on historical event = public through private. Analyze: where does perspective shift, and why? A break to omniscient marks thematic climax."),
            { vocabularyDeck: [
              vs("der Ich-Erzahler", "first-person narrator"),
              vs("der personale Erzahler", "third-person limited"),
              vs("der auktoriale Erzahler", "omniscient narrator"),
              vs("die Erzahlperspektive", "narrative perspective"),
              vs("unzuverlassig", "unreliable (narrator)"),
              vs("die Wahrnehmung", "perception"),
              vs("das Innenleben", "interior life"),
              vs("die Figurencharakterisierung", "characterization"),
              vs("die Erzahlzeit", "narrative time"),
              vs("der Perspektivwechsel", "perspective shift"),
            ],
            practiceSet: [
              ps("Welche Perspektive: 'Ich sah ihn und wusste sofort, dass etwas nicht stimmte'?", "Ich-Erzahler — erste Person, subjektive Wahrnehmung.", "Look for ich and first-person verbs.", "identify-perspective"),
              ps("Welche Perspektive: 'Er trat ein. Seit Tagen hatte ihn dieser Gedanke verfolgt'?", "Personaler Erzahler — dritte Person, Innenleben.", "Check for interiority of one character.", "identify-perspective"),
              ps("Welche Perspektive: 'So begann der Krieg, den niemand hatte kommen sehen'?", "Auktorialer Erzahler — verallgemeinernde Wertung.", "Look for omniscient evaluation.", "identify-perspective"),
              ps("Wirkung eines Ich-Erzahlers?", "Nahe und Subjektivitat, kann Unzuverlassigkeit erzeugen.", "Subjectivity and potential unreliability.", "analyse-perspective-effect"),
              ps("Warum wechselt ein Autor von personal zu auktorial?", "Fur eine ubergeordnete Deutung oder dramatische Ironie.", "Giving reader info the character lacks.", "perspective-shift"),
            ],
            flashcardDeck: [
              fc("Ich-Erzahler", "First-person. Erzahlt mit 'ich'."),
              fc("Personaler Erzahler", "Third-person limited. Folgt einer Figur."),
              fc("Auktorialer Erzahler", "Omniscient. Weiss alles."),
              fc("Unzuverlassiger Erzahler?", "Vertrauenswurdigkeit fraglich."),
              fc("Marker: Ich-Erzahler", "ich, wir; subjektive Wahrnehmungsverben."),
              fc("Marker: Auktorialer Erzahler", "Allwissenheit, Bewertungen, Vorausdeutungen."),
              fc("Perspektivwechsel?", "Anderung der Fokalisierung innerhalb eines Textes."),
              fc("Wirkung personaler Erzahler", "Nahe zu einer Figur, Leser im Wahrnehmungsfilter."),
            ]
          }),
        ],
      },
    ],
  },

  // ── ENGLISH ──
  {
    slug: "english", title: "English",
    description: "Reading comprehension, literary analysis, essay structure, vocabulary expansion.",
    shortBlurb: "Reading comprehension, literary analysis, essays.",
    color: "subject-english", icon: "english",
    chapters: [
      {
        slug: "literary-analysis", title: "Literary analysis", description: "Poetry, prose, and drama conventions.", order: 1,
        topics: [
          t("close-reading", "Close reading",
            ["Annotate a passage for tone, diction, and imagery.", "Build a thesis grounded in textual evidence.", "Defend an interpretation with hedging."],
            5, "MEDIUM", 30, "11",
            block("Read the lines, then between them", "simple",
              "Close reading attends to specific words and implications. Layer 1: literal meaning. Layer 2: connotation (trudged vs walked). Layer 3: patterns (repetition, contrast, imagery). Start literal, walk outward.",
              { v: [vs("connotation", "The implied meaning of a word"), vs("diction", "Word choice")] }),
            block("From observation to thesis", "standard",
              "Chain: observation -> interpretation -> thesis. 'The writer uses desolate' (obs). 'Desolate suggests emptiness and hollowness' (interp). 'The landscape externalizes the speaker's grief' (thesis). Thesis must be defensible, interesting, specific.",
              { cm: [cm("'The writer uses imagery to create mood.'", "Use specific imagery type and its effect.", "Stopping at technique name.")] }),
            block("Defending an interpretation", "rigorous",
              "Hedging = precision, not weakness. 'The repetition suggests...' > '...means...'. Acknowledge alternatives: 'While it could be read as celebratory...'. End with reach: what does this passage's technique suggest about the work's larger concerns?"),
            { vocabularyDeck: [
              vs("close reading", "Textnahe Analyse mit Fokus auf Wortwahl und Struktur"),
              vs("diction", "Wortwahl"),
              vs("connotation", "Konnotation — implizite Bedeutung"),
              vs("imagery", "Bildsprache"),
              vs("thesis", "These"),
              vs("hedging", "Vorsichtige Formulierung"),
              vs("tone", "Tonfall / Haltung des Autors"),
              vs("pattern", "Muster / wiederkehrendes Element"),
              vs("counter-argument", "Gegenargument"),
              vs("synthesize", "Synthetisieren"),
            ],
            practiceSet: [
              ps("Three elements to annotate in close reading?", "Diction, imagery, tone — word choice, sensory language, writer's attitude.", "Core analysis tools.", "close-reading-elements"),
              ps("What makes a thesis 'defensible'?", "Can point to two specific lines that support each step, says something non-obvious.", "Testable by evidence.", "thesis-criteria"),
              ps("Improve: 'The writer uses personification.'", "'The sea as restless and scheming frames nature as hostile, undermining the speaker's control.'", "Specify what the technique does.", "thesis-improvement"),
              ps("Purpose of hedging?", "Shows precision — interpretation isn't a proof. Makes the argument more defensible.", "Qualifying language.", "hedging"),
              ps("How should a close-reading essay end?", "Connect passage-level analysis to the work's larger themes and concerns.", "Reach and synthesis.", "conclusion-reach"),
            ],
            flashcardDeck: [
              fc("What is close reading?", "Careful analysis of a passage: word choice, imagery, structure, tone."),
              fc("Three layers of close reading", "1. Literal. 2. Connotation. 3. Patterns."),
              fc("Strong thesis criteria", "Specific, defensible, non-obvious."),
              fc("Observation vs interpretation", "Obs = what's on the page. Interp = what it means."),
              fc("What is hedging?", "Qualifying language (suggests, may) = precision."),
              fc("Why include counter-arguments?", "Shows understanding of complexity."),
              fc("Close reading essay ending", "Connect to work's larger themes."),
              fc("Diction", "Word choice."),
            ]
          }),
        ],
      },
    ],
  },
] as const;

// ═══ seedIfEmpty ═══

export const seedIfEmpty = mutation({
  args: {},
  returns: v.object({
    subjectsInserted: v.number(),
    chaptersInserted: v.number(),
    topicsInserted: v.number(),
    lessonBlocksInserted: v.number(),
  }),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return { subjectsInserted: 0, chaptersInserted: 0, topicsInserted: 0, lessonBlocksInserted: 0 };
    let subjectsInserted = 0, chaptersInserted = 0, topicsInserted = 0, lessonBlocksInserted = 0;

    for (const subject of CANONICAL_SUBJECTS) {
      const exSub = await ctx.db.query("subjects").withIndex("by_slug", (q) => q.eq("slug", subject.slug)).first();
      let subjectId;
      if (exSub) { subjectId = exSub._id; }
      else { subjectId = await ctx.db.insert("subjects", { slug: subject.slug, title: subject.title, description: subject.description, color: subject.color, icon: subject.icon }); subjectsInserted += 1; }

      for (const chapter of subject.chapters) {
        const exCh = await ctx.db.query("chapters").withIndex("by_subject_slug", (q) => q.eq("subjectId", subjectId).eq("slug", chapter.slug)).first();
        let chapterId;
        if (exCh) { chapterId = exCh._id; }
        else { chapterId = await ctx.db.insert("chapters", { subjectId, slug: chapter.slug, title: chapter.title, description: chapter.description, order: chapter.order }); chaptersInserted += 1; }

        for (const topic of chapter.topics) {
          const exT = await ctx.db.query("topics").withIndex("by_slug", (q) => q.eq("slug", topic.slug)).first();
          if (exT && exT.chapterId !== chapterId) {
            // Loud-fail on a topic-slug-in-wrong-chapter collision.
            //
            // The previous code silently skipped past the
            // collision, which meant a re-org of the curriculum
            // (or an honest typo) would land in production with
            // the colliding topic's lessonBlocks / practiceSets /
            // flashcardDecks silently dropped on every
            // subsequent re-seed. The student would see the
            // topic page with no lesson content and no path to
            // debug it.
            //
            // Throwing here means a re-deploy with a colliding
            // slug fails loud at the first seed pass, instead of
            // producing degraded data. Fix the slug (rename one
            // side), re-run, done. No silent corruption.
            //
            // Thrown as a typed ConvexError so the dashboard
            // bootstrap can branch on the code
            // ("seed_collision") and surface a diagnostic
            // message instead of the generic empty-state UI.
            throw new ConvexError(
              `seed_collision: topic slug "${topic.slug}" already exists in chapter "${exT.chapterId}" but the canonical seed wants it in chapter "${chapterId}". Pick a different slug for the second chapter's topic — the by_slug index is global and the first occurrence wins.`
            );
          }
          let topicId;
          if (exT) { topicId = exT._id; }
          else { topicId = await ctx.db.insert("topics", { chapterId, slug: topic.slug, title: topic.title, objectives: [...topic.objectives], examRelevance: topic.examRelevance, difficulty: topic.difficulty, estimatedMinutes: topic.estimatedMinutes, gradeLevel: topic.gradeLevel }); topicsInserted += 1; }

          for (const block of topic.lessonBlocks) {
            const exB = await ctx.db.query("lessonBlocks").withIndex("by_topic_depth", (q) => q.eq("topicId", topicId).eq("depth", block.depth)).collect();
            if (exB.find((b) => b.order === block.order)) continue;
            await ctx.db.insert("lessonBlocks", {
              topicId, title: block.title, content: block.content, depth: block.depth, order: block.order,
              ...(block.workedExamples ? { workedExamples: block.workedExamples.map(w => ({ ...w })) } : {}),
              ...(block.commonMistakes ? { commonMistakes: block.commonMistakes.map(c => ({ ...c })) } : {}),
              ...(block.formulas ? { formulas: block.formulas.map(f => ({ ...f })) } : {}),
              ...(block.vocabulary ? { vocabulary: block.vocabulary.map(v => ({ ...v })) } : {}),
            });
            lessonBlocksInserted += 1;
          }

          if (topic.formulaSheet?.length) {
            if (!await ctx.db.query("topicResources").withIndex("by_topic_kind", (q) => q.eq("topicId", topicId).eq("kind", "formula_sheet")).first())
              await ctx.db.insert("topicResources", { topicId, kind: "formula_sheet", contents: topic.formulaSheet.map(f => ({ name: f.name, expression: f.expression, when: f.when })), updatedAt: Date.now() });
          }
          if (topic.vocabularyDeck?.length) {
            if (!await ctx.db.query("topicResources").withIndex("by_topic_kind", (q) => q.eq("topicId", topicId).eq("kind", "vocabulary_deck")).first())
              await ctx.db.insert("topicResources", { topicId, kind: "vocabulary_deck", contents: topic.vocabularyDeck.map(v => ({ term: v.term, definition: v.definition, ...(v.gender ? { gender: v.gender } : {}), ...(v.example ? { example: v.example } : {}) })), updatedAt: Date.now() });
          }
          if (topic.practiceSet?.length) {
            if (!await ctx.db.query("practiceSets").withIndex("by_topic_source", (q) => q.eq("topicId", topicId).eq("source", "canonical_baseline")).first()) {
              const psId = await ctx.db.insert("practiceSets", { topicId, title: "Practice - " + topic.title, difficulty: topic.difficulty, createdAt: Date.now(), source: "canonical_baseline" });
              for (let i = 0; i < topic.practiceSet.length; i++) {
                const pi = topic.practiceSet[i];
                await ctx.db.insert("practiceItems", { practiceSetId: psId, type: pi.type ?? "short_answer", question: pi.question, ...(pi.options ? { options: [...pi.options] } : {}), answer: pi.answer, explanation: pi.explanation, skills: [pi.skill], order: i, source: "canonical_baseline" });
              }
            }
          }
          if (topic.flashcardDeck?.length) {
            if (!await ctx.db.query("flashcardDecks").withIndex("by_topic_source", (q) => q.eq("topicId", topicId).eq("source", "canonical_baseline")).first()) {
              const deckId = await ctx.db.insert("flashcardDecks", { topicId, title: "Flashcards - " + topic.title, source: "canonical_baseline" });
              for (let i = 0; i < topic.flashcardDeck.length; i++)
                await ctx.db.insert("flashcards", { deckId, front: topic.flashcardDeck[i].front, back: topic.flashcardDeck[i].back, order: i });
            }
          }
        }
      }
    }
    return { subjectsInserted, chaptersInserted, topicsInserted, lessonBlocksInserted };
  },
});
