/* Запуск всех автотестов: npm test */
const { execFileSync } = require('child_process');
const path = require('path');

const tests = [
  'test-generator.js',
  'test-content.js',
  'test-biomes.js',
  'test-gameplay.js',
  'test-progression.js',
  'test-save.js',
  'test-ui.js'
];

let failed = 0;
for (const file of tests) {
  console.log('\n=== ' + file + ' ===');
  try {
    execFileSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  } catch (e) {
    failed++;
  }
}

console.log(failed ? '\n' + failed + ' test file(s) failed' : '\nAll tests passed');
process.exit(failed ? 1 : 0);
