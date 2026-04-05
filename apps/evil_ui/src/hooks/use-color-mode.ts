// Placeholder — the tactical theme is dark-only for now.
// This hook exists so components can reference it and we can add light mode later.
export type ColorMode = 'dark' | 'light';

export function useColorMode(): { colorMode: ColorMode; toggleColorMode: () => void } {
  return {
    colorMode: 'dark',
    toggleColorMode: () => {
      // No-op: tactical theme is dark-only
    },
  };
}
