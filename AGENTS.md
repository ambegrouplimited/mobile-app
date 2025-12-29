# Repository Guidelines

This guide outlines how to contribute safely and consistently to the Duesoon Expo mobile app.

## Project Structure & Module Organization
`app/` contains file-based routes for the Expo Router—use `_layout.tsx` to wire navigation and keep route components thin by delegating complex UI to `components/`. Place shared hooks inside `hooks/`, static values such as color palettes under `constants/`, and images or fonts inside `assets/`. Configuration lives alongside the tooling (`app.json`, `tsconfig.json`, `eslint.config.js`), while helper scripts sit in `scripts/` (e.g., `reset-project.js` for wiping demo code). Keep feature assets close to their routes but prefer exporting reusable building blocks from `components/`.

## Theme Direction & Visual Rules
Design every screen around the idea of “polite but firm professionalism.” Default to a plain white background (no gradients or textures) so the UI feels quiet and focused. Primary text and headings should use soft charcoal, with muted blue or slate as the secondary tone; reserve a single warm accent (soft amber or muted green) exclusively for success states such as payment confirmations or the main CTA. If everything is highlighted, nothing is. Use one sans-serif family (Inter, SF Pro, or Source Sans 3), normal weight for body, medium for headings, and avoid ultra-bold styles. Layouts should be spacious with short line lengths, simple line icons, and copy that stays neutral: “Reminder sent,” “Awaiting payment,” “Paid.” This app should resemble Stripe or Linear dashboards rather than playful finance apps; boring is good if it builds trust.

## Product Overview
DueSoon is a polite but persistent assistant for freelancers, consultants, and small teams that juggle invoices. Users log each client, amount owed, and follow-up cadence; DueSoon keeps those nudges organized on a calendar and sends the actual reminder emails via its own mailer or a connected Gmail/Outlook account so every message feels personal. Payment details (bank transfer, PayPal, Stripe links, etc.) travel with each reminder, and the app can generate Stripe or PayPal invoices on your behalf—once an invoice is paid, the reminder sequence stops automatically. In practice, you tell DueSoon who owes you money and how firm to be, and it quietly handles the polite follow-ups until the job is paid.

## Build, Test, and Development Commands
- `npm start` (alias `expo start`) launches the Metro server with QR/dev-client options. Use `npm run ios`, `npm run android`, or `npm run web` for platform-specific previews.
- `npm run lint` executes `expo lint` with the repository ESLint config; run it before every commit to catch JSX and TypeScript issues.
- `npm run reset-project` restores the blank scaffolding—only use it in fresh worktrees because it overwrites `app/`.

## Coding Style & Naming Conventions
TypeScript is required for all new modules. Follow 2-space indentation, single quotes in JSX/TS, and prefer functional React components. Export components in `PascalCase`, hooks in `camelCase` starting with `use`, and route files following Expo Router conventions (`(tabs)/index.tsx`, `[id].tsx`, etc.). Use the shared constants for colors/type ramp rather than inlining values. Keep styles colocated via `StyleSheet.create` or `styled` utilities, and let ESLint guide formatting—fix common issues with `npx eslint app components`.

## Testing Guidelines
Automated tests are not yet wired in this repository, so smoke-test every feature on iOS, Android, and Web via the Expo commands above. When adding tests, prefer `jest-expo` with React Native Testing Library and store specs under `__tests__/` next to the code under test; name files `*.test.tsx`. New features should include at least one unit test or documented manual QA notes in the pull request until the Jest harness is added.

## Commit & Pull Request Guidelines
Commits follow the existing history: short (≤72 characters), imperative summaries such as `Add expense list route`, with focused diffs. Each pull request must describe the change, list the primary commands run (`npm start`, `npm run lint`, etc.), link the relevant Linear/GitHub issue, and include platform-specific screenshots or videos for visual tweaks. Request review once lint is clean and manual testing steps are documented.
