import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendations, defaultGitignore } from '../src/services/analysisRules.js';

test('recomienda solo elementos ausentes con reglas deterministas', () => {
  const recommendations = buildRecommendations({
    repository: { description: null }, files: ['src/app.js'],
    readme: { exists: false, missingSections: [] }, issueCount: 0,
    languages: { JavaScript: 1000 },
  });
  assert.deepEqual(recommendations.map((item) => item.id), ['description', 'readme', 'gitignore', 'license', 'issues']);
});

test('no recomienda archivos que ya existen', () => {
  const recommendations = buildRecommendations({
    repository: { description: 'Proyecto' }, files: ['README.md', '.gitignore', 'LICENSE'],
    readme: { exists: true, missingSections: [] }, issueCount: 2, languages: {},
  });
  assert.equal(recommendations.length, 0);
});

test('genera gitignore según lenguajes detectados', () => {
  const content = defaultGitignore({ JavaScript: 10, Python: 5 });
  assert.match(content, /node_modules\//);
  assert.match(content, /__pycache__\//);
  assert.match(content, /\.env/);
});
