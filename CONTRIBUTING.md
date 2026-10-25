# Contributing to Open Creator AI

Thanks for being here. This project is open source and every improvement — from a
typo to a whole new creator pipeline — is welcome.

## Quick start

```bash
git clone https://github.com/meheditwc/open-creator-ai.git
cd open-creator-ai
npm install
npm run dev
```

The studio opens on <http://localhost:19861>. If something looks broken, check the
daemon output first — `npm run dev:daemon`.

## Branches and commits

- Branch from `main` with a descriptive name: `feat/thumbnail-ranking`, `fix/drawer-scroll`.
- Use [conventional commits](https://www.conventionalcommits.org/):

  ```
  feat(tools): add thumbnail ranking stage
  fix(api): keep the store alive when the data dir is missing
  docs(readme): document the FreeLLMAPI setup
  ```

  | Prefix     | Use for                   |
  | ---------- | ------------------------- |
  | `feat`     | a new feature             |
  | `fix`      | a bug fix                 |
  | `docs`     | documentation only        |
  | `refactor` | no behaviour change       |
  | `test`     | tests only                |
  | `chore`    | tooling, dependencies, CI |

- Keep pull requests focused — one topic per PR is much easier to review.
- The PR description should explain _why_, and link the issue it closes.

## Before you open a pull request

```bash
npm run typecheck   # TypeScript must be clean
npm run lint        # ESLint must be clean
npm test            # daemon tests must pass
npm run build       # the studio must build
```

All four run in CI, but catching it locally is faster than waiting for the bot.

## Code style

- **TypeScript everywhere**, strict mode, no `any` unless you can explain it.
- **Format with Prettier**: `npm run format`.
- **Comments explain _why_, not _what_.** The code already says what.
- **Keep the dependency count low.** The daemon is deliberately dependency-free;
  a new runtime dependency needs a good reason in the PR description.
- **No framework CSS.** The design system is hand-written CSS in
  `apps/web/src/styles/global.css` — extend the tokens, do not add Tailwind.

## Adding a creator tool

The tool catalogue is data, not code. To add one:

1. Add an entry to `TOOLS` in `packages/shared/src/tools.ts`.
2. Add the icon (if new) to `apps/web/src/components/Icon.tsx`.
3. Add keyword hints for the offline planner in `packages/shared/src/planner.ts`.
4. Document it in `docs/TOOLS.md`.

The UI, the API validation and the planner pick it up automatically.

## Adding a skill

See [`docs/SKILLS.md`](docs/SKILLS.md). A skill is a Markdown file with frontmatter —
keep it under ~120 lines and make it concrete.

## Reporting bugs

Open an issue with:

- what you did, what you expected, what happened
- your OS and Node version (`node -v`)
- the daemon output (`npm run dev:daemon`)
- a screenshot if it is a visual problem

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report
unacceptable behaviour to the maintainers by opening a private report through
GitHub's security advisory form or by contacting the maintainer directly.

## License

Contributions are licensed under the [Apache License 2.0](LICENSE), the same as the
project.
