import { createConfig } from '@gluestack-ui/themed';

export const config = createConfig({
	tokens: {
		colors: {
			primary: '#0891B2',
			secondary: '#64748B',
			tertiary: '#CBD5E1',
			primary0: '#ffffff',
			primary400: '#c084fc',
		},
	},
	aliases: {
		colors: {
			primary: 'primary',
			secondary: 'secondary',
			tertiary: 'tertiary',
		},
		bg: 'backgroundColor',
		h: 'height',
		w: 'width',
		p: 'padding',
		m: 'margin',
		mr: 'marginRight',
		ml: 'marginLeft',
		mt: 'marginTop',
		mb: 'marginBottom',
	},
});
