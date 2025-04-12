const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const rnConfig = require('@react-native-community/eslint-config');
const eslintCommentsPlugin = require('eslint-plugin-eslint-comments');
const reactNativePlugin = require('eslint-plugin-react-native');
const jestPlugin = require('eslint-plugin-jest');
const importPlugin = require('eslint-plugin-import');

module.exports = [
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'.expo/**'
		]
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: {
					jsx: true
				},
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json'
			},
			globals: {
				React: 'readonly',
				JSX: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			'react': reactPlugin,
			'react-hooks': reactHooksPlugin,
			'eslint-comments': eslintCommentsPlugin,
			'react-native': reactNativePlugin,
			'jest': jestPlugin,
			'import': importPlugin
		},
		rules: {
			...rnConfig.rules,
			'react/react-in-jsx-scope': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { 
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_'
			}],
			'no-unused-vars': 'off',
			'@typescript-eslint/ban-types': 'off',
			'import/export': 'off',
			'react-native/no-inline-styles': 'warn'
		},
		settings: {
			react: {
				version: 'detect'
			}
		}
	}
]; 