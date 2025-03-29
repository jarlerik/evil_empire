import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import rnConfig from '@react-native-community/eslint-config';
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments';
import reactNativePlugin from 'eslint-plugin-react-native';
import jestPlugin from 'eslint-plugin-jest';

export default [
	{
		ignores: ['node_modules/**', 'dist/**']
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: {
					jsx: true
				}
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			'react': reactPlugin,
			'react-hooks': reactHooksPlugin,
			'eslint-comments': eslintCommentsPlugin,
			'react-native': reactNativePlugin,
			'jest': jestPlugin
		},
		rules: {
			...rnConfig.rules,
			'react/react-in-jsx-scope': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-function-return-type': 'off'
		},
		settings: {
			react: {
				version: 'detect'
			}
		}
	}
]; 