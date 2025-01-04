import type { IconProps } from 'lucide-svelte';

type SvelteConstructorOptions = {
	target: HTMLElement;
	props?: IconProps;
};

export type MenuItem = {
	icon: new (options: SvelteConstructorOptions) => import('svelte').SvelteComponent<IconProps>;
	label: string;
	onClick: (id: number) => void;
	class?: string;
};
