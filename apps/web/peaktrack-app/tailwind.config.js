// Extends the @evil-empire/ui Tailwind preset so color tokens, typography,
// spacing, and radius match the mobile app exactly. The preset is exported
// from apps/evil_ui/src/theme/tailwind-preset.js.
import preset from '@evil-empire/ui/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './app/**/*.{ts,tsx}',
  ],
};
