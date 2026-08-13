// Flat config (ESLint 9+ dropped .eslintrc). CommonJS, because package.json is.
//
// Three file groups, because this repo mixes three environments: browser ES
// modules under public/js, CommonJS server code, and Playwright specs whose
// page.evaluate() callbacks are browser code living inside a Node file.
const js = require('@eslint/js');
const globals = require('globals');
const importX = require('eslint-plugin-import-x');

// Shared with every group; kept identical to the old .eslintrc rules.
const common = {
  'no-unused-vars': ['warn', { args: 'none' }],
  'no-empty': ['error', { allowEmptyCatch: true }],
};

module.exports = [
  {
    ignores: [
      'public/style.css',
      'public/vendor/**',
      'public/app.js.orig',
      'node_modules/**',
      'scripts/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: true } },

  // ---- browser, ES modules ----
  // eslint-plugin-import replaced by eslint-plugin-import-x: the original caps its
  // peer range at eslint ^9 and blocks the upgrade; the fork carries the same rules.
  { ...importX.flatConfigs.recommended, files: ['public/js/**/*.js'] },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
    settings: { 'import-x/resolver': { node: { extensions: ['.js'] } } },
    rules: {
      ...js.configs.recommended.rules,
      ...common,
      'import-x/no-unresolved': 'error',
      'import-x/named': 'error',
    },
  },

  // ---- server, CommonJS ----
  {
    files: [
      'server.js', 'db.js', 'ha.js', 'z2m.js',
      'routes/**/*.js', 'lib/**/*.js',
      'playwright.config.js', 'tailwind.config.js', 'eslint.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: { ...js.configs.recommended.rules, ...common },
  },

  // ---- tests ----
  // Node files, but the bodies passed to page.evaluate() run in the browser, so
  // document/getComputedStyle are legitimate there. The old config gave these
  // files node globals only, which is why the suite reported 5 no-undef errors.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { ...js.configs.recommended.rules, ...common },
  },
];
