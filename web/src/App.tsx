import { CapacityGrid } from "./CapacityGrid";

export function App() {
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">TEAM PLANNING</p>
          <h1>Capacity</h1>
          <p className="intro">
            See who has room, and who needs a lighter week.
          </p>
        </div>
        <span className="view-label">Weekly overview</span>
      </header>
      <CapacityGrid from="2025-12-29" to="2026-01-16" />
    </main>
  );
}
