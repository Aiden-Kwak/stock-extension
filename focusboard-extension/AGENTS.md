# Repository Guidelines

## Project Structure & Module Organization
FocusBoard is a Vite React extension. `src/` holds runtime code: `main.jsx` boots the app, `App.jsx` arranges feature panels, UI primitives live in `components/`, hooks in `hooks/`, and fetch helpers in `utils/`. Static assets and the manifest stay in `public/`. The caching proxy lives in `proxy/server.js`; keep provider-specific logic there instead of inside React components. Built bundles land in `dist/`, with snapshots in `docs/full_source_snapshot.md`.

## Build, Test, and Development Commands
Run `npm install` before contributing. `npm run dev` launches Vite with hot reload; preview through `index.html` or by loading the unpacked `dist/`. `npm run build` produces the production bundle, and `npm run preview` serves it for final checks. `npm run lint` executes ESLint; combine with `npm run lint -- --fix` to auto-correct. `npm run proxy` starts the caching proxy on port 8787—run it alongside the dev server when API calls are required.

## Coding Style & Naming Conventions
Use modern React with functional components, hooks, and `const`/`let`. Components and files are PascalCase (`StockCard.jsx`), hooks use `useSomething`, and reusable utilities are camelCase. Keep indentation at two spaces and rely on ESLint auto-fixes. Co-locate lightweight styles near components or extend `App.css` judiciously; avoid introducing global selectors without prefixing.

## Testing Guidelines
Automated tests are not yet wired up. Document manual QA steps in your PR and cover scenarios such as chart rendering, memo persistence, and proxy fallbacks. If you introduce automated tests, prefer Vitest with Testing Library, place specs under `src/__tests__/` or co-locate them, and provide an `npm test` script the team can run.

## Commit & Pull Request Guidelines
Match the existing history’s concise, imperative commit titles (e.g., `Adjust stock grid layout for six-card dashboard`). Reference related issues or context in the body. Pull requests should summarise the change, list environment or proxy adjustments, and include screenshots or GIFs for UI updates. Confirm `npm run lint`, `npm run build`, and (if applicable) new tests before requesting review.

## Configuration & Security
Sensitive keys (`VITE_CG_KEY`, `VITE_FMP_KEY`, `VITE_SERP_KEY`, `VITE_PROXY_URL`) belong in `.env.local`; never commit them. Align proxy host allowlists with provider requirements and clear the in-memory cache if policies change. Rotate keys used in `proxy/server.js` whenever you share debug builds externally.

## Repository Management
Use `git@github.com:Aiden-Kwak/stock-extension.git` as the canonical remote. Push feature branches and main updates there, and open pull requests against the GitHub project to keep review history centralised.
