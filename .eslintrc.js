module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ['airbnb-typescript/base', 'prettier'],
  // parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: 'tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier', 'import'],
  rules: {
    "no-unused-vars": "warn",
    'prettier/prettier': 'error',
    'import/prefer-default-export': 'off',
    "@typescript-eslint/no-explicit-any": "off",
    '@typescript-eslint/lines-between-class-members': 'off'
  },
};
