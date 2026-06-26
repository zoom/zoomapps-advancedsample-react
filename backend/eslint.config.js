// Flat config for ESLint 10 (replaces the legacy .eslintrc, which v10 no longer supports).
// Mapping from the old .eslintrc:
//   extends: ["eslint:recommended"] -> js.configs.recommended (@eslint/js)
//   env: { node, es6 }              -> languageOptions.globals (globals.node) + ecmaVersion
//   parserOptions.ecmaVersion       -> languageOptions.ecmaVersion ('latest'; code uses optional chaining)
//   prettier plugin + "prettier" config -> eslint-plugin-prettier/recommended
//       (bundles eslint-config-prettier and sets prettier/prettier to error)
const js = require('@eslint/js')
const globals = require('globals')
const prettierRecommended = require('eslint-plugin-prettier/recommended')

module.exports = [
  { ignores: ['public/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  // Keep last so eslint-config-prettier can switch off rules that conflict with Prettier.
  prettierRecommended,
]
