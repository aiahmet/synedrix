/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let content = fs.readFileSync('convex/seed.ts', 'utf8');

// Strategy: any occurrence of 2+ consecutive backslashes inside string
// literals is reduced. TS source needs "\\" for a literal "\" in the string.
// The current file has "\\\\" (4 backslashes) when it should have "\\" (2).
// We detect 4-backslash patterns followed by LaTeX command names.

const latexCommands = [
  'frac', 'ln', 'log', 'cdot', 'sin', 'cos', 'tan',
  'theta', 'Delta', 'sqrt', 'pm', 'rightarrow', 'Leftrightarrow',
  'approx', 'neq', 'leq', 'geq', 'infty', 'times', 'iff',
  'ge', 'le', 'text', 'int', 'sum', 'prod', 'partial',
  'div', 'equiv', 'pi', 'alpha', 'beta', 'gamma', 'Gamma',
  'delta', 'epsilon', 'zeta', 'eta', 'iota', 'kappa',
  'lambda', 'Lambda', 'mu', 'nu', 'xi', 'Xi', 'rho',
  'sigma', 'Sigma', 'tau', 'upsilon', 'phi', 'Phi',
  'chi', 'psi', 'Psi', 'omega', 'Omega',
  'Rightarrow', 'Leftarrow', 'leftrightarrow', 'mapsto',
  'degree', 'prime', 'parallel', 'perp', 'triangle',
  'setminus', 'cup', 'cap', 'lor', 'land', 'neg',
  'forall', 'exists', 'emptyset', 'circ', 'angle', 'sim',
  'lim', 'exp', 'max', 'min', 'sup', 'inf',
  'det', 'dim', 'gcd', 'hom', 'ker', 'Pr',
  'arccos', 'arcsin', 'arctan', 'cosh', 'sinh', 'tanh',
  'cot', 'sec', 'csc', 'ldots', 'cdots', 'vdots', 'ddots',
  'line', 'subset', 'notin', 'in', 'subset',
];

// For each LaTeX command preceded by 4 backslashes, reduce to 2
for (const cmd of latexCommands) {
  const pattern = new RegExp('\\\\\\\\' + cmd, 'g');
  content = content.replace(pattern, '\\\\' + cmd);
}

// Also handle \\{ and \\} for braces
content = content.replace(/\\\\\\\\\\{/g, '\\\\{');
content = content.replace(/\\\\\\\\\\}/g, '\\\\}');

// Handle escaped single chars that appear as \\### where ### is a char
// These are from patterns like \\\\rightarrow, \\\\infty etc.

fs.writeFileSync('convex/seed.ts', content);
console.log('Fixed seed escaping');
