# AI collaboration log

Curated record of how I worked with Claude Code (Sonnet 5) on this assignment.
Each phase: intent, options considered, decision and why, corrections, verification.
Raw session transcript is exported to `docs/ai-transcript/` at the end.

Time limit: 2h hard cap. Roles I asked the AI to wear: Product, Developer, QA.

---

## Phase 1: Requirements and process (0:00–0:10)

**Intent.** Give the AI the assignment, the follow-up email and the interview notes. Agree on the stack and on a way to record the AI conversation before writing code.

**My leanings (given as input).** Express + TypeScript, JWT, Zod, Axios, React frontend.

**AI proposal.**
- Recording: curated `AI_LOG.md` per phase, raw transcript export at the end, one commit per phase.
- Ambiguities resolved as explicit decisions (see README "Assumptions"):
  - Win is checked on Hold (classic Pig).
  - Holding with 0 round score is rejected.
  - Winning score is an integer, 10–1000, default 100.
  - Two authenticated users; the "same page" simulation is a client-side account switcher, while the server checks the JWT user against whose turn it is.
  - Injected RNG for deterministic tests.
- Persistence: repository interface with a JSON-file store, to avoid native dependencies on Windows.
- Extras in value-per-minute order: win counter and persistence, 6&6 lockout message, AI opponent, sound.

**Decision.** Plan approved as proposed.

**Corrections / rejected.** None yet.

**Verification.** N/A (planning only).
