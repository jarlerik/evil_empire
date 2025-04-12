import React from 'react';
import { GluestackUIProvider as GSUIProvider } from '@gluestack-ui/themed';
import { config } from './config';

export function GluestackUIProvider({ children }: { children: React.ReactNode }) {
	return <GSUIProvider config={config}>{children}</GSUIProvider>;
}
