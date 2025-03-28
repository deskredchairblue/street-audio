module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:prettier/recommended', // Optional: for prettier integration
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Style rules
    indent: ['error', 2],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],

    // Node best practices
    'no-console': 'off',
    'node/no-unsupported-features/es-syntax': [
      'error',
      { ignores: ['modules'] },
    ],

    // Custom rules
    'no-unused-vars': ['warn'],
    'prefer-const': 'error',
  },
};