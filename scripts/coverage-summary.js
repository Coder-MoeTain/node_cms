const path = require('path');
const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
const jestConfig = require('../jest.config.js');

function readSummary() {
  try {
    return require(summaryPath);
  } catch {
    console.error(`Coverage summary not found at ${summaryPath}. Run npm run test:coverage first.`);
    process.exit(1);
  }
}

const summary = readSummary();
const total = summary.total;
const thresholds = jestConfig.coverageThreshold.global;

console.log('Coverage report:');
console.log(`  lines:      ${total.lines.pct}% (threshold ${thresholds.lines}%)`);
console.log(`  statements: ${total.statements.pct}% (threshold ${thresholds.statements}%)`);
console.log(`  functions:  ${total.functions.pct}% (threshold ${thresholds.functions}%)`);
console.log(`  branches:   ${total.branches.pct}% (threshold ${thresholds.branches}%)`);

const failures = [];
for (const [metric, threshold] of Object.entries(thresholds)) {
  const actual = total[metric]?.pct;
  if (typeof actual === 'number' && actual < threshold) {
    failures.push(`${metric} ${actual}% is below threshold ${threshold}%`);
  }
}

if (failures.length) {
  console.error('Coverage thresholds not met:');
  failures.forEach((line) => console.error(`  - ${line}`));
  process.exit(1);
}

console.log('All coverage thresholds met.');
