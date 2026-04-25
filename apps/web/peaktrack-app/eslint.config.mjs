import baseConfig from '@evil-empire/eslint-config/base';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', '.turbo/**', 'app/routeTree.gen.ts'],
  },
];
