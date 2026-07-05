/**
 * Content lint script.
 *
 * Walks the canonical seed tree in `convex/seed.ts` and
 * validates every content field per the contract defined
 * in `docs/SUBJECT-CONTENT-PERFECTION-PLAN.md` §6.3.
 *
 * Run with: npm run lint:content
 *
 * Fails with exit code 1 if any validation gate fails.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { validateMiniMarkdown } from "../src/lib/content/miniMarkdown";

const SEED_PATH = join(process.cwd(), "convex", "seed.ts");

let failures = 0;

function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
  failures += 1;
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

/**
 * Read and execute seed.ts in a standalone V8 context.
 *
 * Since the seed is a TypeScript file with imports from
 * `convex/_generated/server` and `convex/values`, we
 * cannot directly `require()` it. Instead, we parse the
 * `CANONICAL_SUBJECTS` array by reading the file as text
 * and extracting the array with a regex.
 *
 * The array literal references module-scope helper
 * functions (`t`, `fs`, `ps`, `fc`, `vs`, `cm`, `we`,
 * `block`) that are defined in `convex/seed.ts`. We
 * inline those helpers as parameters to the eval-time
 * `Function` so the parser can evaluate the array
 * without needing the seed.ts module to be imported.
 *
 * The helper signatures MUST stay in sync with the seed
 * file. If the seed helpers change shape, this lint must
 * be updated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsing dynamic seed shape
function loadSeed(): any[] {
  const src = readFileSync(SEED_PATH, "utf-8");

  // Find the CANONICAL_SUBJECTS assignment
  const match = src.match(/const CANONICAL_SUBJECTS[^=]*=\s*(\[[\s\S]*?\])\s*as const\s*;/);
  if (!match) {
    console.error("Could not find CANONICAL_SUBJECTS in convex/seed.ts");
    process.exit(1);
  }

  // Naive JSON-like parse of the array. We convert the
  // TypeScript literal to valid JSON by stripping comments
  // and the `as const`.
  let arrayText = match[1];
  arrayText = arrayText.replace(/\/\/.*$/gm, "");
  arrayText = arrayText.replace(/\/\*[\s\S]*?\*\//g, "");
  arrayText = arrayText.replace(/,(\s*[}\]])/g, "$1");

  let cleaned: string;
  try {
    cleaned = arrayText
      .replace(/readonly\s+/g, "")
      .replace(/as const\s*$/g, "");
  } catch (e) {
    console.error("Failed to clean seed array:", e);
    process.exit(1);
  }

  // Inline the seed-module helper functions into the
  // eval-time Function so the array literal can call
  // them by name. These are the same helpers defined in
  // convex/seed.ts; this file mirrors them so the lint
  // can run as a pure-Node-side eval rather than
  // requiring a Convex runtime.
  //
  // Keep parameter order and signatures in sync with the
  // matching helpers in convex/seed.ts.
  const helpers = `
    function fs(name, expression, when) { return { name: name, expression: expression, when: when }; }
    function ps(q, a, ex, skill, type, options) { return { question: q, answer: a, explanation: ex, skill: skill, type: type, options: options }; }
    function fc(front, back) { return { front: front, back: back }; }
    function we(setup, solution, skill) { return { setup: setup, solution: solution, skill: skill }; }
    function cm(mistake, correction, cause) { return { mistake: mistake, correction: correction, cause: cause }; }
    function vs(term, definition, gender, example) { var v = { term: term, definition: definition }; if (gender !== undefined) v.gender = gender; if (example !== undefined) v.example = example; return v; }
    function block(title, depth, content, opts) { return { depth: depth, order: 1, title: title, content: content, workedExamples: (opts && opts.we) || undefined, commonMistakes: (opts && opts.cm) || undefined, formulas: (opts && opts.f) || undefined, vocabulary: (opts && opts.v) || undefined }; }
    function t(slug, title, objectives, examRelevance, difficulty, estimatedMinutes, gradeLevel, simple, standard, rigorous, opts) { return { slug: slug, title: title, objectives: objectives, examRelevance: examRelevance, difficulty: difficulty, estimatedMinutes: estimatedMinutes, gradeLevel: gradeLevel, lessonBlocks: [simple, standard, rigorous], formulaSheet: (opts && opts.formulaSheet) || undefined, vocabularyDeck: (opts && opts.vocabularyDeck) || undefined, practiceSet: (opts && opts.practiceSet) || undefined, flashcardDeck: (opts && opts.flashcardDeck) || undefined }; }
  `;

  try {
    const fn = new Function(`
      ${helpers}
      return ${cleaned};
    `);
    return fn();
  } catch (e) {
    console.error("Failed to parse seed array:", e);
    console.error("Seed array text (first 500 chars):", arrayText.slice(0, 500));
    process.exit(1);
  }
}

// ── Main ───────────────────────────────────────────────

console.log("lint:content — validating convex/seed.ts\n");

const subjects = loadSeed();

if (!Array.isArray(subjects) || subjects.length === 0) {
  fail("CANONICAL_SUBJECTS is empty or not an array");
  process.exit(1);
}

ok(`Found ${subjects.length} subjects`);

// Structural gates
for (const subject of subjects) {
  const subjSlug = subject.slug ?? "(unknown)";
  const chapters = subject.chapters ?? [];

  console.log(`\n${subject.title ?? subjSlug} (${subject.slug})`);

  if (chapters.length < 4) {
    fail(`${subjSlug}: has ${chapters.length} chapters (minimum 4 required)`);
  } else {
    ok(`${chapters.length} chapters`);
  }

  for (const chapter of chapters) {
    const chSlug = chapter.slug ?? "(unknown)";
    const topics = chapter.topics ?? [];

    if (topics.length < 3) {
      fail(`${subjSlug}/${chSlug}: has ${topics.length} topics (minimum 3 required)`);
    } else {
      ok(`${subjSlug}/${chSlug}: ${topics.length} topics`);
    }

    for (const topic of topics) {
      const tSlug = topic.slug ?? "(unknown)";
      const prefix = `${subjSlug}/${chSlug}/${tSlug}`;
      const lessonBlocks = topic.lessonBlocks ?? [];

      // Check 3 depths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic seed parsing
      const depths = new Set(lessonBlocks.map((b: any) => b.depth));
      for (const d of ["simple", "standard", "rigorous"]) {
        if (!depths.has(d)) {
          fail(`${prefix}: missing ${d} lesson block`);
        }
      }

      // Validate content fields
      for (const block of lessonBlocks) {
        const blockPrefix = `${prefix}/lessonBlocks/${block.depth}`;

        // content validation
        const contentFailures = validateMiniMarkdown(block.content ?? "");
        for (const f of contentFailures) {
          fail(`${blockPrefix}/content: ${f.message}`);
        }

        // workedExamples validation
        const workedExamples = block.workedExamples ?? [];
        for (let i = 0; i < workedExamples.length; i++) {
          const we = workedExamples[i];
          const wePrefix = `${blockPrefix}/workedExamples[${i}]`;

          if ((we.setup ?? "").length > 400) {
            fail(`${wePrefix}/setup: ${we.setup.length} chars (max 400)`);
          }

          const sol = we.solution ?? "";
          if (sol.length > 2000) {
            fail(`${wePrefix}/solution: ${sol.length} chars (max 2000)`);
          }
          const solFailures = validateMiniMarkdown(sol);
          for (const f of solFailures) {
            fail(`${wePrefix}/solution: ${f.message}`);
          }

          if ((we.skill ?? "").length > 40) {
            fail(`${wePrefix}/skill: ${we.skill.length} chars (max 40)`);
          }
        }

        // commonMistakes validation
        const commonMistakes = block.commonMistakes ?? [];
        for (let i = 0; i < commonMistakes.length; i++) {
          const cm = commonMistakes[i];
          const cmPrefix = `${blockPrefix}/commonMistakes[${i}]`;
          if ((cm.mistake ?? "").length > 200) fail(`${cmPrefix}/mistake: ${cm.mistake.length} chars (max 200)`);
          if ((cm.correction ?? "").length > 200) fail(`${cmPrefix}/correction: ${cm.correction.length} chars (max 200)`);
          if ((cm.cause ?? "").length > 200) fail(`${cmPrefix}/cause: ${cm.cause.length} chars (max 200)`);
        }

        // formulas validation
        const formulas = block.formulas ?? [];
        for (let i = 0; i < formulas.length; i++) {
          const f = formulas[i];
          const fPrefix = `${blockPrefix}/formulas[${i}]`;
          if ((f.name ?? "").length > 60) fail(`${fPrefix}/name: ${f.name.length} chars (max 60)`);
          if ((f.expression ?? "").length > 200) fail(`${fPrefix}/expression: ${f.expression.length} chars (max 200)`);
          if ((f.when ?? "").length > 200) fail(`${fPrefix}/when: ${f.when.length} chars (max 200)`);
        }

        // vocabulary validation
        const vocabulary = block.vocabulary ?? [];
        for (let i = 0; i < vocabulary.length; i++) {
          const v = vocabulary[i];
          const vPrefix = `${blockPrefix}/vocabulary[${i}]`;
          if ((v.term ?? "").length > 40) fail(`${vPrefix}/term: ${v.term.length} chars (max 40)`);
          if ((v.definition ?? "").length > 300) fail(`${vPrefix}/definition: ${v.definition.length} chars (max 300)`);
        }
      }

      // Practice set validation
      const practiceSet = topic.practiceSet ?? [];
      if (practiceSet.length > 0) {
        if (practiceSet.length < 5) {
          fail(`${prefix}: practiceSet has ${practiceSet.length} items (minimum 5 required)`);
        } else if (practiceSet.length > 8) {
          fail(`${prefix}: practiceSet has ${practiceSet.length} items (maximum 8 allowed)`);
        } else {
          ok(`${prefix}: practiceSet ${practiceSet.length} items`);
        }

        for (let i = 0; i < practiceSet.length; i++) {
          const ps = practiceSet[i];
          const psPrefix = `${prefix}/practiceSet[${i}]`;
          if ((ps.question ?? "").length > 600) fail(`${psPrefix}/question: ${ps.question.length} chars (max 600)`);
          if ((ps.answer ?? "").length > 2000) fail(`${psPrefix}/answer: ${ps.answer.length} chars (max 2000)`);
          const ansFailures = validateMiniMarkdown(ps.answer ?? "");
          for (const f of ansFailures) {
            fail(`${psPrefix}/answer: ${f.message}`);
          }
        }
      } else {
        fail(`${prefix}: no practiceSet (minimum 5 items required)`);
      }

      // Flashcard deck validation
      const flashcardDeck = topic.flashcardDeck ?? [];
      if (flashcardDeck.length > 0) {
        if (flashcardDeck.length < 8) {
          fail(`${prefix}: flashcardDeck has ${flashcardDeck.length} cards (minimum 8 required)`);
        } else if (flashcardDeck.length > 20) {
          fail(`${prefix}: flashcardDeck has ${flashcardDeck.length} cards (maximum 20 allowed)`);
        } else {
          ok(`${prefix}: flashcardDeck ${flashcardDeck.length} cards`);
        }

        for (let i = 0; i < flashcardDeck.length; i++) {
          const fc = flashcardDeck[i];
          const fcPrefix = `${prefix}/flashcardDeck[${i}]`;
          if ((fc.front ?? "").length > 200) fail(`${fcPrefix}/front: ${fc.front.length} chars (max 200)`);
          if ((fc.back ?? "").length > 600) fail(`${fcPrefix}/back: ${fc.back.length} chars (max 600)`);
        }
      } else {
        fail(`${prefix}: no flashcardDeck (minimum 8 cards required)`);
      }
    }
  }
}

console.log(`\n──────────`);
console.log(`${failures > 0 ? "FAIL" : "PASS"}: ${failures} failure(s)`);

if (failures > 0) {
  process.exit(1);
}
