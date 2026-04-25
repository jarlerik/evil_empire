import { Outlet, createRootRoute } from '@tanstack/react-router';

// PR 2 will add provider stack (QueryClientProvider, AuthProvider,
// UserSettingsProvider) plus a notFoundComponent. This skeleton just
// renders the matched route so PR 1 can prove the routing wiring works.
export const Route = createRootRoute({
  component: () => <Outlet />,
});
