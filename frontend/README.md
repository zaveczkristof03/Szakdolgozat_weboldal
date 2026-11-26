# EKG MetaData Explorer – frontend

React + TypeScript + Vite. Structure (details in `../docs/ARCHITEKTURA_HU.md`):

- `src/App.tsx` – loads the catalog, shared state, hash routing
- `src/domain/` – rules and calculations without React (tested by `npm run test:domain`)
- `src/features/` – one folder per page
- `src/components/`, `src/layout/`, `src/api/`, `src/hooks/`, `src/styles/`

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run test:domain`.
