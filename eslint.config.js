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
				JSX: 'readonly',
				// Node.js globals
				process: 'readonly',
				module: 'readonly',
				require: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				// Jest globals
				jest: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly',
				test: 'readonly',
				// React Native globals
				fetch: 'readonly',
				FormData: 'readonly',
				requestAnimationFrame: 'readonly',
				cancelAnimationFrame: 'readonly',
				setImmediate: 'readonly',
				clearImmediate: 'readonly',
				console: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
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
			// Disable no-undef for TypeScript - TypeScript compiler handles this much better
			'no-undef': 'off',
			'@typescript-eslint/ban-types': 'off',
			'import/export': 'off',
			'react-native/no-inline-styles': 'off',
			'no-useless-escape': 'off',
			// Disable radix requirement for parseInt - base 10 is the default
			'radix': 'off',
		},
		settings: {
			react: {
				version: 'detect'
			}
		}
	}
]; 