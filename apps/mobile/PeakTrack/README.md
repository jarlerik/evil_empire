# PeakTrack

React Native/Expo workout tracking app.

## Development

```bash
# From repo root
pnpm dev:mobile

# Or from this directory
pnpm start
pnpm ios
pnpm android
```

### Environment Variables

Create a `.env` file in this directory:

```
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## Deployment

### Prerequisites

- [EAS CLI](https://docs.expo.dev/build/setup/) installed (`npm install -g eas-cli`)
- Authenticated with `eas login`
- Apple Developer account configured

### EAS Secrets

The `.env` file is gitignored, so environment variables must be set as EAS secrets for remote builds:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<your-supabase-url>"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your-supabase-anon-key>"
```

Verify secrets are set:

```bash
eas secret:list
```

### Build and Submit to TestFlight

```bash
# Production build for iOS
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios

# Or build and submit in one step
eas build --platform ios --profile production && eas submit --platform ios
```

### Build Profiles

Configured in `eas.json`:

- **development** — Development client with dev tools, internal distribution
- **preview** — Production-like build, internal distribution (for testing)
- **production** — App Store / TestFlight build with auto-incrementing version

### Local Release Testing

Test a release build locally before submitting:

```bash
npx expo run:ios --configuration Release
```
