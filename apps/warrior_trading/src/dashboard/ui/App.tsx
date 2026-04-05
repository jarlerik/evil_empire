import { DashboardProvider } from './context/DashboardContext';
import { DashboardGrid } from './DashboardGrid';

export function App() {
  return (
    <DashboardProvider>
      <DashboardGrid />
    </DashboardProvider>
  );
}
