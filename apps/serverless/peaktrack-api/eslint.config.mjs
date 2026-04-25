import baseConfig from '@evil-empire/eslint-config/base';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', '.aws-sam/**', '.turbo/**'],
  },
];
