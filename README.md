# DiskLab - Disk Scheduling Simulator

A responsive React dashboard for exploring and comparing classical disk scheduling algorithms.

## Features

- FCFS, SSTF, SCAN, C-SCAN, LOOK, and C-LOOK implementations
- Input and request validation with inline errors
- Animated Recharts head-movement visualization
- Play, pause, step, restart, and speed controls
- Service sequence and complete movement breakdown
- Side-by-side algorithm comparison table and chart
- Responsive dark dashboard for desktop, tablet, and mobile
- Reduced-motion support

## Tech stack

- React 19 and Vite
- Tailwind CSS v4 with `@tailwindcss/vite`
- Recharts
- Lucide React
- Vitest
- GitHub Actions and GitHub Pages

## Local installation

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## Running tests

```powershell
npm test
npm run build
npm run lint
```

## Algorithm explanations

- **FCFS:** Services requests in their original queue order.
- **SSTF:** Chooses the nearest pending cylinder. Equal distances use lower cylinder, then original request index.
- **SCAN:** Services in one direction, reaches the physical boundary, reverses, and continues.
- **C-SCAN:** Services in one direction, reaches the physical boundary, wraps to the opposite boundary, and continues.
- **LOOK:** Reverses at the final request in the selected direction, avoiding boundary travel.
- **C-LOOK:** Services in the selected direction, jumps to the extreme opposite request, and continues.

Requests equal to the initial head and duplicate requests are handled as distinct requests. Boundary and wrap waypoints remain separate from request service points.

## Seek-time formula

```text
Average seek distance = total head movement / number of requests
Average seek time = average seek distance * milliseconds per cylinder
```

The seek time is a simplified linear approximation, not a prediction of actual hardware timing.

## Assumptions and limitations

- Cylinders range from `0` through `diskSize - 1`.
- All requests arrive before the simulation begins.
- Head movement is linear; rotational and transfer delays are excluded.
- Duplicates remain separate requests.
- Boundary movement is omitted when no remaining requests require it.
- Comparison highlights the minimum result for the current workload, not universal optimality.

## Screenshots

Screenshot assets can be placed in `docs/screenshots/` and linked here after deployment.

## GitHub Pages deployment

The Vite base path is `/disk-scheduling-simulator/` for a repository with that name.

1. Push the project to a GitHub repository named `disk-scheduling-simulator`.
2. Open **Settings > Pages**.
3. Set **Build and deployment** source to **GitHub Actions**.
4. Push to `main`; the workflow runs tests, builds `dist`, and deploys it.

## Future improvements

- Arrival-time and priority queue support
- Exportable simulation reports
- Saved workload presets
- Additional disk scheduling variants
- Hardware-informed seek curves
