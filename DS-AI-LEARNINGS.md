# DS AI — Learnings

> **Living document.** Goal: build an **agentic-first design system** — a DS designed so that AI agents (not just humans) are first-class consumers and contributors. This doc captures research, principles, architecture, the build steps, and an append-only learnings log we grow as we go.
>
> Started: 2026-05-20 · Owner: Kushal · Status: Research → Planning

---

## 0. How to use this doc

- **Read top-to-bottom once** to get the mental model, then treat §6 (roadmap) as the working plan and §8 (learnings log) as the running journal.
- Anything we discover — a format that works, a token count, an eval result, a prompt that broke an agent — gets a dated entry in §8.
- Decisions that are still open live in §7. Move them to a learning once decided.
- This is a knowledge doc, not the spec. Product/design decisions are NOT made here unilaterally — they get raised and agreed first.

---

## 1. What "agentic-first" means

A traditional design system is built for **humans**: designers read docs, devs browse Storybook, everyone infers intent from guidelines. AI agents don't infer intent — they parse what's there, extract what the prompt asked for, and **fill every gap with assumptions from training data**. When those assumptions are wrong you get output that looks plausible but breaks your foundations (off-brand spacing, wrong tokens, invented props).

> "Our docs are written for humans. The new user, AI, needs structured metadata, not documentation prose." — Diana Wolosin, Indeed

**Agentic-first** means the DS is consciously designed for *two* audiences at once:

1. **Humans** — designers + developers (the existing job).
2. **Agents** — as **consumers** (generating product UI from the DS) AND as **contributors** (helping maintain the DS: writing tests, components, migrations, reviews, docs).

The system becomes a **"productivity coefficient"** for AI: agents constrained by the DS produce relevant, on-brand output instead of generic AI slop. The DS is the *lingua franca* between design, code, and AI.

---

## 2. Reference teardowns

### 2a. Razorpay Blade — the most complete reference

Blade (`github.com/razorpay/blade`, MIT, ~621★) is a cross-platform (React Web + React Native) DS that has gone further than almost anyone on agentic tooling. Key insight: **it's not one tool, it's an ecosystem** spanning code, design, and agents.

**Monorepo packages:**

| Package | What it does | Why it matters for us |
| --- | --- | --- |
| `blade` | Core cross-platform components | The DS itself |
| `blade-mcp` | MCP server for AI-assisted dev | Serves the DS to agents on-demand |
| `eslint-plugin-blade` | Enforces Blade coding standards | **Guardrails** — same lint catches human *and* agent mistakes |
| `plugin-figma-blade-coverage` | "Linter for design files" — measures DS coverage in Figma | Adoption signal on the design side |
| `plugin-figma-token-publisher` | Publishes design tokens from Figma | Keeps tokens single-source |
| `blade-coverage-extension` | Browser extension measuring component usage in prod | Adoption signal on the code side |
| `widget-figma-dev-handoff-checklist` | Design→dev handoff checklist | Closes the design-to-code loop |

**`blade-mcp` internal structure** (what an MCP server actually ships):
- `src/tools/` — the MCP tool implementations (e.g. `getBladeComponentDocs.ts`)
- `knowledgebase/` — the DS knowledge served to agents (component / pattern / general docs)
- `base-blade-template/` — a ready-to-scaffold Vite + React + TS starter
- `cursorRules/` — always-on rules generated into the consumer's repo
- `skillTemplate/` — template for generating agent skills

**MCP tools Blade exposes:**

| Tool | Purpose |
| --- | --- |
| `hi_blade` | Onboarding / capability overview when user says "hi blade" |
| `create_new_blade_project` | Scaffold a new Vite+React+TS project wired to Blade |
| `create_blade_cursor_rules` | Write the always-on rules file into the repo (call *before* fetching docs) |
| `get_blade_component_docs` | Fetch docs for specific components (on-demand) |
| `get_blade_pattern_docs` | Fetch design patterns / best practices |
| `get_blade_general_docs` | Setup, installation, theming, tokens, general guidelines |
| `get_figma_to_code` | Figma URL → Blade React code *(internal/employee-gated)* |

Distribution is dead simple: `npx -y @razorpay/blade-mcp@latest` in `mcp.json` (Cursor/VS Code/Claude Desktop). Auto-updates. Workflow: open empty folder → "Hi blade" → "create a signup form with best UX using Blade."

**Agent skills for *maintaining* the DS** (`.agents/skills/`, symlinked to `.claude`, plus `.cursor/` rules). These are NOT for consumers — they're for the DS team's own agents:
- `create-draft-pr`, `review-changes`, `review-component`, `update-component`
- `write-unit-tests`, `write-api-decision`, `write-biweekly-announcement`
- `verify-with-browser`, `migrate-to-svelte`

> **Big takeaway:** Blade treats "agents build *with* the DS" and "agents help build *the DS itself*" as two distinct, equally-invested product surfaces. The `.agents/` directory convention (with a `.claude` symlink) is a clean way to be tool-agnostic.

### 2b. GitHub Primer — governance & AI principles

Primer's public AI/MCP surface is thinner than Blade's, but two things stand out:

- **Trust by structural constraint.** Jan Six (GitHub): Primer's agents can only **create an issue, never merge code**. Agentic workflows run **daily QA and maintenance** with **"safe outputs"** that always require human review. This is the cleanest real-world example of "agents propose, humans dispose."
- **Copilot Accessibility Principles** — a published, agent-oriented design philosophy. Four principles for an AI collaborator: **Clear & understandable**, **Transparent & predictable**, **Adaptable to the user's way of working**, **Flexible & forgiving**. Notably they use these *with* AI: "ask Copilot to evaluate feature specs against the principles," and annotate designs with the principles. The DS doesn't just feed agents — it teaches agents how to behave.

### 2c. Figma — design-side of the loop (MCP + Code Connect)

Figma's Dev Mode MCP server shows the design→code half:
- On inspecting a frame, it sends **components, styles, variables** to the agent. The more designs use the DS — and the more design and code are connected — the more useful it is.
- **Code Connect** maps Figma components to real code components, so the agent pulls *actual* code resources, not guesses.
- **Variable code syntax** lets tokens carry their code names.
- **Automated rule generation**: scan the codebase → emit a structured rules file (token definitions, component libraries, style hierarchies, naming conventions) that acts as a system-level guide.
- **Annotations**: extra context (accessibility, interaction behavior, content) attached to designs flows into codegen.
- DS teams can also use agents to: generate new component code aligned to existing patterns, automate token application/auditing, and **audit design↔code drift** both ways.

A published **`figma-generate-design` SKILL.md** is a great structural template for our own skills:
- YAML frontmatter: `name`, a `description` packed with **trigger phrases**, `disable-model-invocation`.
- Sections: **Skill Boundaries** (when to use / when to use a *different* skill), **Prerequisites**, explicit step-by-step **Workflow**, **MANDATORY** cross-skill references (load skill X before any tool call), and hard rules ("use design system tokens instead of hardcoded values").

### 2d. The field's hard-won lessons (AI Design Systems Conference 2026)

Five failure modes teams hit when wiring a DS to agents — **this is our checklist of what to cater for** (see §4):
- Spotify Encore: agents *bypassed* the DS entirely because it was too complex to reason about → atomic layering → 93% dev satisfaction, 220k+ shared style uses.
- Indeed: benchmarked 77 components × 8 MCP configs × 1,056 prompts → **JSON beats Markdown for MCP** (80% fewer tokens, 5× lower cost, higher accuracy) → 4,300 AI prototypes in 4 months.
- GitHub: trust levels enforced structurally (issues only).

### 2e. Uber Base + **uSpec** — the *reverse* direction (design → spec), and an enterprise governance model

Uber's design system is **Base** (thousands of engineers, hundreds of components across **7 implementation stacks**: UIKit, SwiftUI, Android XML, Android Compose, Web React, Go, SDUI; plus density variants + 3 a11y frameworks). Their public agentic work, **[uSpec](https://uspec.design/)** (by Ian Guisard), solves a *different* problem than everyone above and is worth studying precisely because it's the mirror image.

- **Direction is design → technical spec, not docs → code.** uSpec is a **"visual-to-technical-spec compiler."** An agent in Cursor connects to **local Figma Desktop** via the open-source **[Figma Console MCP](https://github.com/southleft/figma-console-mcp)** (WebSocket bridge), **crawls the actual component tree** (tokens, variant axes, variable modes, slot compositions, sub-components), and **renders finished spec pages directly back into Figma** — weeks → minutes. It reads *real* data, so no transcription errors.
- **Skills encode domain expertise; each skill loads its own reference before acting.** Every spec section (anatomy, color/token annotation, screen-reader, density) is a **dedicated agent skill = a structured Markdown file** with validation rules, schemas, and reference docs. The screen-reader skill loads VoiceOver/TalkBack/ARIA property references *before* analyzing — "the agent doesn't guess at property names, it selects from documented APIs." (Same pattern as Blade skills + Figma's SKILL.md + Indeed's progressive disclosure.)
- **Judgment vs. precision split — a key architecture idea.** "AI judgment where interpretation matters (classifying a11y semantics, choosing token mappings, structuring a spec) and **programmatic scripts where precision matters** (rendering tables, markers, populating templates in Figma)." Don't make the LLM do mechanical rendering; let it decide, let code execute.
- **Local-first MCP = the enterprise unlock.** Whole pipeline runs locally; no proprietary design data leaves the network. This is *the* thing that made AI-assisted work approvable at Uber. (Contrast: Figma's official Dev Mode MCP pushes context out to the IDE; Figma Console MCP reads-and-writes the local desktop app.)
- **Governance layer.** uSpec runs through Uber's central AI platform (Michelangelo) behind a **GenAI Gateway** (Go proxy) that does **PII redaction** — scrubbing internal identifiers before requests reach external models (Claude / GPT). Relevant to our trust/data-governance thinking (FM3).

> **Takeaways for us:** (1) there's a whole *second surface* — generating/maintaining **design specs & docs** from the source of truth, not just code; (2) the **judgment-vs-precision split** belongs in every skill we write; (3) **local-first** matters the moment real/proprietary design data is involved; (4) skills that **load their own reference docs before acting** are the recurring pattern across *every* mature player.

### 2f. Deep dive — uSpec internals (`redongreen/uSpec`, MIT, the open-source blueprint)

We read the actual source (skills, references, CLI, figma-plugin, docs). uSpec is the **closest open-source reference implementation** to what we're building — it works in **Cursor / Claude Code / Codex**, renders to **Figma annotations *or* a portable `.md`**, and is built on the judgment-vs-precision thesis end-to-end. The patterns below are directly reusable.

**Repo shape.** Two-package monorepo + platform-neutral source: `skills/` (the procedures), `references/` (the domain knowledge), `packages/cli` (npm `uspec-skills`, the installer), `figma-plugin` (the deterministic extractor, built locally, *not* on npm). Rule: **`skills/` + `references/` are the source of truth; everything else is derived.**

#### Pattern 1 — Skill = thin procedure + thick reference
- A **`SKILL.md`** is just orchestration. Frontmatter is **two fields**: `name` + a `description` that ends with literal quoted trigger phrases (`Use when the user mentions "color", "tokens"…`). That keyword list *is* the routing — no elaborate metadata.
- Body skeleton: purpose → **`## MCP Adapter`** table (maps each operation to `figma-console` vs `figma-mcp`, so one skill serves two backends) → `## Inputs` → `## Workflow` (opens with a copyable `- [ ]` progress checklist, then numbered steps) → `## Notes`.
- **Step 1 of nearly every skill = "Read the instruction file"** via a `{{ref:area/file.md}}` token, and the skill **re-reads it at the audit step**. The knowledge lives in `references/`, not the skill. This is the "don't guess — select from documented APIs" mechanism, concretely implemented.

#### Pattern 2 — `create-*` vs `extract-*` families (centralize judgment, duplicate only I/O)
- **`create-*`** (anatomy, api, color, motion, property, structure, voice) = extract + reason + **render annotations into Figma**. Heavy (~100k tokens/run, dominated by the render pass).
- **`extract-*`** (api, color, structure, voice) = same reasoning, but **read `_base.json` from disk and write normalized JSON** — no rendering, ~no MCP calls, cheap and composable.
- They are **parallel implementations sharing one canonical instruction file per domain** (`agent-<type>-instruction.md`). Enforced by a written **"quality contract: any improvement must be made in both places."** They don't call each other.

#### Pattern 3 — The agent↔tool contract is a *validated, versioned schema* (the single best idea to steal)
The boundary between deterministic extraction and LLM interpretation is a serialized file, `_base.json`, with **three layers**:
1. **Prose contract** — `figma-plugin/docs/base-json-schema.md` (documents the shape + traversal policy + a mutation-safety contract: the plugin is the *sole writer*; interpreters are read-only).
2. **Typed producer** — `types.ts` + the phase result types.
3. **Executable gate** — `validate-base.mjs` (Ajv), wired as a **pre-flight that aborts the run before any LLM tokens are spent** if the dump is malformed. `schemaVersion` is pinned.

Design principles in the schema itself: it's a **superset** (one Figma walk emits *three views* — `treeHierarchical` for api/structure, `treeFlat` for voice, `colorWalk` for color — so N interpreters share one traversal and just filter); every value carries **provenance** (`measured` / `inferred` / `not-measured`, with "numerical invention forbidden").

#### Pattern 4 — Judgment-vs-precision, made quantitative
The deterministic **figma-plugin runs 9 phases (A–I)** that do *everything measurable* — meta/props (A), variables (B), lazy styles (C), library variables (D), the per-variant walker (E, the heart), cross-variant diffs (F), boolean-revealed trees (G), **ownership *hints* + rationale, never decisions** (H), child-composition first-guess (F′), sub-component walks (I) — then emits structured evidence + warnings. The LLM only *interprets*. uSpec literally **publishes the deterministic/AI ratio per skill** (Structure 60/40, Screen-reader 30/70, Motion 75/25). Rule of thumb: *don't ask the model to count pixels; don't ask the script to name things.*

#### Pattern 5 — The orchestrator (`create-component-md`): how to fan out agents consistently
The flagship `.md` pipeline: **(1)** Ajv pre-flight on `_base.json` → **(2)** run `extract-api` **solo first** to build a canonical **ApiDictionary** (property/state vocabulary) → **(3)** fan out `extract-structure`/`-color`/`-voice` as **parallel subagents** that must match the dictionary or flag a `dictionaryMismatch` → **(4)** a **typed reconciliation gate** with exactly **3 named disagreement classes** (vocabulary drift → auto-rewrite; coverage gap → one bounded retry; semantic conflict → surface as a high gap) → **(5)** render `components/{slug}.md`. Determinism is a feature: same `_base.json` → byte-identical `.md` (down to a `sourceHash`), so "did the design change?" becomes a `git diff`.

#### Pattern 6 — One source, many hosts (tool-agnostic by construction)
Skills authored once; the CLI **rewrites tokens at install time** into per-host dirs: `{{skill:x}}`→`@x` (Cursor) vs "the x skill" (others), `{{ref:…}}`→a host-correct relative path. Output dirs: **`.cursor/skills` / `.claude/skills` / `.agents/skills`** (Codex), with MCP config in `.cursor/mcp.json` / `.mcp.json`+`CLAUDE.md` / `.codex/config.toml`+`AGENTS.md`. CLI commands: `init` (interactive), `install` (idempotent, preserves primary host), `update` (re-render), `doctor` (verifies install + **flags version drift + broken ref links**). Config (`uspecs.config.json`) is **deep-merged** so CLI-owned fields (`environment`, `cliVersion`) and agent-owned fields (`templateKeys`, `fontFamily`, written by a `firstrun` skill) never clobber each other.

#### Other reusable specifics
- **Canonical vocabulary catalog** (`references/api/api-library.md`): per-component property tables + naming rules (`is*`/`has*`) + a "**never expose these**" list (transient states like `hovered`/`pressed`). "Do not reinvent them."
- **Mistakes-as-data:** the screen-reader skill *requires* emitting `Do NOT` rows per focus stop — codifies tribal knowledge into spec output.
- **Designer-in-the-loop as deterministic capture:** the plugin guesses child classification, a human confirms/flips it in the UI, and the answer is frozen as `["user-selected"]` evidence the downstream agent trusts — judgment captured once at the cheapest point.
- **Two source-of-truth models coexist:** Figma-as-truth (annotations beside the component, for review/handoff) vs `.md`-as-truth (portable, for codegen/diffing). The `.md` path needs **no MCP, no template, no firstrun** — just the local extract plugin.
- **Input quality is on the designer:** "if another designer can't understand your component from the layer panel alone, the agent will struggle too" — name layers, use auto-layout, bind tokens.
- **Local-first / safety:** plugin runs in the Figma sandbox with `networkAccess: none`; 3 layers guard npm publish; fresh agent session + high-context model recommended per run.

> **What this changes for our plan:** uSpec is a working template for the *contributor/spec surface* and for cross-host skill distribution. Concretely steal: (a) the **validated-schema contract** between deterministic extraction and LLM interpretation; (b) **skill = procedure + reference, read-reference-first**; (c) the **extract/render family split** to keep costs sane; (d) the **dictionary-then-fan-out-then-typed-reconcile** orchestration for multi-agent consistency; (e) **token-rewrite install** for Cursor/Claude Code/Codex parity; (f) **provenance + determinism** for diffable, trustworthy artifacts.

### 2g. Southleft — the infrastructure under uSpec + the "context > autonomy" counter-position

**Southleft** (Tom Pitre, `tpitre`) is a design-systems consultancy — *"AI-Powered Design Systems. Built by the Experts."* — that has shipped DS work for IBM, Google, Cigna, Condé Nast, DocuSign, Caterpillar, State Farm, Ulta, CHUBB and others. They matter to us for three reasons.

**1. They build the infrastructure layer beneath uSpec.** Southleft makes **[Figma Console MCP](https://github.com/southleft/figma-console-mcp)** (1.7k★, ~500 commits, very actively maintained) — the open-source MCP uSpec runs on. Its framing is the sharpest one-liner in this whole space: **"Your design system as an API."** It bridges design↔dev, giving AI assistants complete access to Figma for **extraction, creation, debugging, and bidirectional token sync** (read *and* write, via a local Desktop Bridge plugin over WebSocket — the local-first model from §2e). So the stack is: *Figma Console MCP (Southleft, infra) → uSpec (Guisard/Uber, skills+spec generation) → your agent (Cursor/Claude Code/Codex).*

**2. Context-Based Design Systems (CBDS) — their framework, and a deliberate counter to "agentic-first."** The core claims, which are worth holding our own framing against:
- **"Context, not data, is the unit of value."** Tokens/components/docs are useful, but what makes a system work is *the meaning that travels with them* — the intent behind a button, the conditions where a pattern applies, why it exists at all. (This is the same insight as Indeed's "MCP solves retrieval, not quality" — foundations + intent, not just component data.)
- **The chain reaction:** let context flow through *every* phase — design informs code, code informs docs, docs inform the next design — and the system gets clearer over time instead of murkier. Corollary: **"bad metadata at machine speed is worse than bad metadata at human speed"** — harder to notice, faster to spread. (= our FM1 drift, stated as a velocity risk.)
- **Context beats autonomy (the contrarian bit):** they explicitly *don't* chase maximal agent autonomy. *"Speed without context creates drift you have to undo later. Speed with context compounds. The teams that win aren't the ones with the most agents — they're the ones with the clearest context flowing through their systems and people who know how to steward it."*
- **The Context Engineer** — a named role that **owns the trust layer**: when something ships, you can trace *why* it shipped, *who* decided what, and *what the AI was authorized to do at every step*. They enforce standards, tests, a11y, type safety, versioning. (Maps directly onto our FM3 trust-levels/governance — gives it a human owner.)

**3. They're at the intellectual center of the field.** Southleft + **Brad Frost** (+ Ian Frost) are running the **"AI & Design Systems" course** (aianddesign.systems). Brad Frost is the source of the "MCP is on-demand, you need always-on rules" point in §2d — so the conference learnings, uSpec, and Figma Console MCP all trace back through this same group.

> **Takeaway for us:** treat **context (intent, conditions, rationale), not component data, as the real payload** — this reinforces the foundations-Skill direction from §4b. And hold CBDS's tension honestly: "agentic-first" should mean *the system is legible and stewardable by agents*, **not** *maximally autonomous agents*. Bake in a **trust/provenance layer with a human owner** (the Context Engineer) from the start, per FM3. "Design system as an API" (read+write, bidirectional token sync) is also a cleaner north-star phrasing than "MCP server" for what we're building.

---

## 3. Reference architecture for an agentic-first DS

Synthesized target architecture. Think in **layers of context** + **two agent surfaces**.

```
                      ┌─────────────────────────────────────────────┐
                      │              HUMANS + AGENTS                  │
                      └─────────────────────────────────────────────┘
                                        │
   ALWAYS-ON (injected every prompt)    │      ON-DEMAND (queried when needed)
   ────────────────────────────────    │      ──────────────────────────────
   AGENTS.md / rules file:              │      MCP server:
   • foundations: spacing, color,       │      • get_component_docs (JSON)
     typography, radius (tokens)        │      • get_pattern_docs
   • naming conventions                 │      • get_general_docs (setup/theming)
   • do/don't, trust levels             │      • figma_to_code
   • where the MCP server lives         │      • scaffold_project
                                        │
                      ┌─────────────────┴───────────────────────────┐
                      │            SOURCE OF TRUTH                    │
                      │  components · tokens · patterns · a11y rules  │
                      │  (must NOT drift across docs/tokens/code)     │
                      └──────────────────────────────────────────────┘
                                        │
        ┌──────────────┬───────────────┼───────────────┬───────────────┐
     Code guardrails   Design plugins   Knowledgebase    Agent skills    Evals
     eslint-plugin     figma coverage   JSON for MCP      .agents/skills  prompt suites
     codemods          token publisher  MD for LLM rules  (maintain DS)   visual+code
                       handoff checklist
```

**Two layers of context (critical — see Failure Mode #4):**
- **Always-on rules** = foundations the agent must *never guess*: spacing scale, color tokens, typography, radius, naming. Injected into every prompt regardless of task.
- **On-demand MCP** = component specifics: APIs, props, variants — fetched only when the task needs them.
- **`AGENTS.md`** = the orchestration layer tying them together: what's always-on, where the MCP is, what trust levels apply.

**Two formats (critical — see Failure Mode #2):**
- **JSON for MCP** — structured contracts: component APIs, props, sizes, variants. Explicit keys, explicit values, no ambiguity. Cheaper + more accurate.
- **Markdown for LLM** — natural-language rules, instructions, guidelines, skills.

**Two agent surfaces:**
- **Consumer surface** — agents building product UI *with* the DS (MCP + rules + scaffolding).
- **Contributor surface** — agents helping maintain the DS itself (skills: write component, write tests, review, migrate, write API decision, draft PR).

---

## 4. Things to cater for — the failure-mode checklist

These are the five ways an agentic DS breaks in practice, each with the fix. Treat as acceptance criteria.

### FM1 — Documentation drift
**Risk:** docs say one thing, tokens another, components a third. Humans tolerate it; agents can't judge which is right, so they pick whatever they saw first or average across all of them. (30–40% of DS team time already goes to this kind of maintenance.)
**Fix:**
- Validate **meaning across layers**: does the token name match the component description? Does the doc match the current API? Align these *before* connecting an MCP.
- Treat drift as a **monitored failure mode**, not backlog. Aim toward a self-healing loop — **Observe → Detect → Suggest → Fix → Learn** (MAPE-K) — fed by Figma API, CI hooks, usage analytics, auto-opening PRs. (Don't build the whole pipeline day one.)

### FM2 — Markdown dumped into an MCP without benchmarking
**Risk:** plugging human MDX docs straight into MCP → ~30k tokens/query, ~82% coverage, hallucinations, high cost.
**Fix:** structured + chunked + one-coherent-format, *benchmarked on our corpus* — **not** raw human MDX. See **§4b** (the nuance: "JSON vs Markdown" is the wrong question; format is empirical and depends on delivery model). Auto-generate the contract from source.

### FM3 — No trust levels for agent actions
**Risk:** agent merges PRs / changes tokens / alters component APIs without the human decision those changes needed.
**Fix:** Define trust levels **per action, not per agent**:
- **Auto-merge** — high confidence, low risk: lint fixes, doc typos, a11y labels.
- **Draft PR** — medium: token value updates, description changes.
- **Suggest only** — low confidence / high impact: new component APIs, breaking changes, governance.
- Enforce structurally where possible (Primer: agents create issues only). Use "safe outputs" that always require human review.

### FM4 — MCP without always-on rules
**Risk:** MCP is *on-demand* — "build me a card" returns card+button metadata but ignores spacing/typography/color, so the LLM invents them and the page goes off-brand.
**Fix:** the three-layer model from §3 — **always-on foundation rules** + **on-demand component MCP** + **`AGENTS.md`** orchestration. Foundations are never left to guesswork.

### FM5 — Monolithic component docs
**Risk:** one giant doc per component (props + variants + styles + behavior + a11y + usage) forces the agent to parse everything to understand anything; agents then *bypass the DS* (Spotify saw devs go to Cursor first and ship non-DS output).
**Fix:** atomic / layered structure → **foundation layer** (tokens/primitives), **style layer** (appearance), **behavior layer** (interaction). Creates **"smaller context bubbles"** the agent can reason about independently and mix-and-match.

### Plus: cross-cutting concerns
- **Accessibility as a first-class agent instruction** (Primer principles): clear, transparent/predictable, adaptable, flexible/forgiving — bake into rules + skills, and let agents *self-check* against them.
- **Evals are not optional.** "We can't just launch and hope for the best." Build a prompt suite that tests generations across multiple LLMs and compares **both code and visual** output. Track coverage, token cost, hallucination rate, brand adherence.
- **Distribution friction kills adoption.** One-line `npx` MCP install; auto-update; "say hi to start."
- **Tool-agnostic conventions.** Prefer `.agents/skills` + `AGENTS.md` with symlinks for `.claude`/`.cursor` so we're not locked to one IDE/agent.

---

## 4a. Deep dive — the component metadata contract (researched: #2)

> Confidence level after research: **high on the principles, recommendation is proposed (not yet decided)**. The exact field set is a call to confirm together — see §7.

### What the field actually does (the real-world examples, compared)

There is no single "the JSON schema." There are three credible, production-proven shapes — and the lesson is what they share, not which one wins.

| Approach | Format | Source of truth | Notes |
|---|---|---|---|
| **Razorpay Blade** (most mature agentic DS) | **Structured Markdown, one `.md` per component**, with the contract as a **TypeScript type block (JSDoc + `@default`)** | Hand-curated knowledgebase, served whole-file via MCP | Sections: `Component Name` → `Description` → **`Important Constraints`** → **`TypeScript Types`** → `Example` (multiple full, realistic `tsx` snippets). TS *is* a precise, LLM-native contract. |
| **Custom Elements Manifest (CEM)** | **JSON**, `custom-elements.json` | **Auto-generated from source** (analyzer) | Industry standard for web components. Fields: `kind`, `name`, `description`, `members` (fields/methods), `attributes`, `events`, `slots`, `cssProperties`, `cssParts`, `tagName`, `default`, `type`, `deprecated`. React analog = `react-docgen` JSON. |
| **W3C DTCG** (token layer only) | **JSON** | Token source / Figma publisher | Standard for *tokens*: `$type`, `$value`, `$description`, `$extensions`, groups, **aliases** (`{color.palette.black}`), **composite tokens** (shadow, typography, border). Use this for the foundation layer. |

**The triangulated principle (what they all agree on):**
1. **Generated from source, not hand-written** → it cannot drift (kills FM1). Blade's hand-curated KB is the one exception, and it's their biggest maintenance liability.
2. **Contract precision** — explicit props, types, allowed values (unions/enums), defaults, required-ness. Either typed-JSON *or* TS-types-in-Markdown delivers this; **prose does not**.
3. **The constraints an agent would otherwise guess wrong are first-class** — Blade's `Important Constraints` section (e.g. "`variant=tertiary` only with `color=primary|white`") is the highest-value, lowest-token field. Cross-prop rules, valid combinations, required pairings.
4. **Real, runnable examples** beat descriptions — multiple realistic `tsx` snippets, not toy ones.
5. **One coherent file per component** (see §4b — the benchmark proved fragmenting across files tanks retrieval).

### Proposed component contract (to confirm)

Per component, one record (whether emitted as JSON for MCP or rendered to MD — see §4b decision):

```
name                # semantic name; note aliases (PasswordInput not TextInput[type=password])
description         # one tight paragraph: what it's for + when to reach for it
status             # stable | beta | deprecated (+ replacement if deprecated)
props[]            # name, type (union/enum/primitive), default, required, description, deprecated
constraints[]      # cross-prop rules & valid combinations an agent must not violate
slots / children   # what can go inside, and what must not
a11y               # required labels (e.g. accessibilityLabel for icon-only), roles, keyboard
tokens_used        # which foundation tokens this component is built from (links to token layer)
examples[]         # title + full runnable code, real-world context
do_not[]           # common misuse the agent should avoid
related            # sibling/alternative components ("for X use Y instead")
```

- **Token layer:** adopt **DTCG** shape (`$type`/`$value`/`$description`/aliases/composite). It's the standard, Figma + Style Dictionary speak it, and aliases keep semantics intact.
- **Generation:** derive `props`/`type`/`default` from **TS types via `react-docgen`** (or CEM analyzer if web-components). Author only the *judgment* fields (`constraints`, `do_not`, `description`, curated `examples`) — and lint those against source so they can't drift.

---

## 4b. Deep dive — format & loading model (researched: #3)

> Confidence level after research: **high**. The headline "JSON vs Markdown" is the wrong question; the evidence points to a clear, more useful answer.

### The benchmark evidence

**Indeed / Diana Wolosin MCP Quality Benchmark** — 8 MCP configs, identical prompts, isolated ports (no cross-contamination), scored on retrieval accuracy + coverage + cost. Configs spanned monolithic JSON, pre-chunked JSON, semantic-chunked JSON, MDX-for-humans, MD-only, hybrid MD+JSON, domain-separated JSON, and TOON.

| Rank | Config | Token savings | Retrieval |
|---|---|---|---|
| 1 | **Semantic-chunked JSON** | **88%** vs baseline | **92%** |
| 2 | In-production (monolithic JSON) baseline | — | 89% |
| 3 | Pre-chunked JSON | 87% | 86% |

Four findings, in their words — **Structured · Chunked · Smart · Coherent**:
- **Structured:** JSON > Markdown for *retrieval* (machine-parseable beats human-readable).
- **Chunked > Monolithic:** focused chunks beat one big dump.
- **Smart:** *semantic* chunking (concept-aligned boundaries) > arbitrary pre-chunking — 92% vs 86%, same format.
- **Coherent:** **one file per component, one consistent format.** Hybrid MD+JSON hit only **27%** completion (LLM couldn't even finish); domain-separated JSON only **20%** coverage (info present but siloed). *Mixing formats and fragmenting across files is actively harmful.*

**Independent format benchmark (improvingagents, tabular lookup, small model)** — accuracy vs tokens across 12 formats. The nuance that matters: **most token-efficient ≠ most accurate.** Markdown-KV won accuracy (60.7%) at moderate tokens; JSON was mid-pack (~52%); TOON/CSV/JSONL were token-cheap but *less* accurate (~44–48%). So the optimal format depends on **data shape (tabular vs nested), the model, and whether you're optimizing tokens or accuracy.**

**Reconciling with Blade:** Blade serves *whole `.md` files, one per component, with TS-type contracts* and does **no** vector retrieval — the "chunk" is the file. That's fully consistent with the benchmark's *Coherent + Chunked* principles; the JSON>MD finding is specifically about **RAG retrieval over chunks**, which Blade sidesteps. Both are "right" for their delivery model.

### The resolution (high confidence)

1. **Format is empirical — benchmark on our own corpus + target models before standardizing.** Don't inherit "JSON wins" or "TOON saves 50%" on faith.
2. **Pick by delivery mechanism:**
   - **Whole-file-per-component serving (Blade-style):** structured Markdown + TS-type contract is excellent and human-auditable. Simplest to start.
   - **RAG / vector retrieval at scale:** semantic-chunked JSON, one component per coherent unit.
3. **Never mix formats or fragment a component across files.** This was the single most destructive choice in the benchmark.

### The bigger finding: MCP solves *retrieval*, not *quality*

This is the most important learning of the whole research pass. Indeed shipped a working component MCP and **still** got broken typography hierarchy, inconsistent spacing, wrong color tokens, emojis-instead-of-icons. Why: **an MCP is on-demand — it returns only what the prompt asks.** All the foundational knowledge (spacing grammar, type hierarchy, icon conventions, brand composition) was *in* the MCP, but the prompt "build me a card" never asks for it, so the vector DB never surfaces it. (This is FM4, proven at scale.)

**The fix that worked = two layers as one system:**
- **MCP** = the *authoritative, structured, on-demand* layer — components, props, tokens, icons. "Verifies what is currently true."
- **Skill / plugin** (invoked like `design-systems-guidelines`, with a `SKILL.md`) = **progressive context disclosure**: it streams the *foundations and taste* layers into context in the order the task needs, **then** calls the MCP. Holds spacing rhythm, typography hierarchy, composition recipes, density, brand expression, and a **`quality.md`** obligations layer. "Teaches the model the standards."

Two methods worth stealing:
- **Evidence-based foundations:** they audited **14 production codebases** (Sourcegraph) — 6,147 spacing-token occurrences — to find the **6 spacing tokens + 4 recipes** that recur on *every* surface, and built the rhythm/composition layer from that, "rooted in evidence, not one designer's opinion."
- **Calibration runs surface doc bugs:** running real prompts exposed a *deprecated* style still in the docs; the LLM dutifully reproduced it. They fixed the doc and added an obligation to `quality.md`. **"The plugin is only as good as the context it reads."**
- **Token economics:** loading every foundation layer once at conversation start is real cost, but **far cheaper than the back-and-forth of a model guessing** — that's what makes progressive disclosure affordable.

### Benchmarking method for us (lifted from Indeed)

When we're ready to standardize a format, run *our* version of this:
1. Build N config variants of the **same** knowledge (e.g. whole-MD-with-TS, semantic-chunked-JSON, hybrid, TOON).
2. Run each under **identical prompts on isolated MCP instances** (no cross-contamination).
3. Score three dimensions: **(a) MCP input quality, (b) retrieval** (can the LLM find the right info?), **(c) prototype output** (does the generated code/visual match?). Compare code *and* rendered visuals.
4. Track: retrieval accuracy, coverage %, tokens/query, $/query, hallucination rate, brand adherence.
5. Standardize the winner as the ingestion contract; re-run on each major model upgrade.

---

## 5. Concrete pieces to build (the inventory)

A menu, not a mandate — sequence in §6.

1. **Source of truth, de-drifted** — single token source, component APIs, patterns, a11y rules; alignment checks across layers.
2. **Machine-readable knowledgebase** — one coherent record per component (contract per **§4a**), generated from source so it can't drift; format chosen by the **§4b** benchmark.
3. **MCP server** — tools mirroring Blade's set: onboarding, scaffold project, write rules file, get component/pattern/general docs, (later) figma→code. The *authoritative, on-demand* layer. Distributed via `npx`.
4. **Foundations Skill (`SKILL.md`) + `AGENTS.md`** — **progressive context disclosure** of foundations/taste (spacing rhythm, type hierarchy, composition recipes, `quality.md` obligations), streamed *before* the MCP is called. This is what makes output *quality* (not just retrieval) work — see §4b. Plus a rules-file generator for the consumer repo.
5. **Code guardrails** — ESLint plugin enforcing DS standards (catches both human and agent mistakes); codemods for migrations.
6. **Agent skills for DS maintainers** — `.agents/skills/`: write/update/review component, write tests, write API decision, verify-with-browser, draft PR, migrations, announcements.
7. **Design-side tooling** — Figma coverage "linter," token publisher, dev-handoff checklist; Code Connect mappings + variable code syntax so the design MCP returns real code.
8. **Adoption telemetry** — coverage extension / usage analytics in code + Figma coverage in design.
9. **Eval harness** — prompt suite × multiple LLMs, visual + code diffing, cost/coverage/hallucination metrics; run in CI.
10. **Drift monitoring** — Observe→Detect→Suggest→Fix→Learn loop wired to Figma API + CI + analytics.

---

## 6. Suggested roadmap (phased)

> "Plant seeds, not trees." Naming conventions, token structure, and component descriptions first — even basic structured metadata beats no context dramatically.

**Phase 0 — Foundations & de-drift**
- Lock token structure + naming conventions. Align token names ↔ component descriptions ↔ docs ↔ APIs. Fix mismatches before any MCP.

**Phase 1 — Machine-readable knowledge**
- Generate the per-component contract from source (§4a). Run the format benchmark (§4b) on a handful of components × real prompts before standardizing. Author the foundations Skill layers (spacing/typography/composition/`quality.md`).

**Phase 2 — Minimum agentic loop**
- Ship a thin MCP server (get component/pattern/general docs) + always-on rules generator + `AGENTS.md`. One-line `npx` install. Validate the "build me X using <DS>" flow end-to-end.

**Phase 3 — Guardrails & trust**
- ESLint plugin + codemods. Define + enforce per-action trust levels. Agents propose (issues/draft PRs), humans dispose.

**Phase 4 — Contributor skills**
- `.agents/skills/` for maintaining the DS (component authoring, tests, reviews, migrations, API decisions).

**Phase 5 — Design loop**
- Figma coverage linter, token publisher, Code Connect, handoff checklist, figma→code.

**Phase 6 — Evals & self-healing**
- Eval harness in CI; drift monitoring loop; adoption telemetry. Iterate on the knowledgebase format from eval data.

---

## 7. Open questions / decisions to make

- **Platform & framework scope?** Web only, or cross-platform (Blade does React Web + RN)? Affects everything downstream. *(needs decision — do not assume)*
- **Build on an existing DS or greenfield?** Are we wrapping an existing component library or starting fresh?
- **Which agents/IDEs are first-class?** Claude Code, Cursor, Copilot, Claude Desktop — drives the rules/skills conventions.
- **Component metadata contract** — *researched (§4a); proposed contract on the table.* Decision left: **confirm the exact field set** + whether we serve whole-MD-with-TS-types (Blade-style) or chunked-JSON.
- **Knowledgebase format** — *researched (§4b); answer is "benchmark our corpus."* Decision left: **run the benchmark and pick the winner** before standardizing.
- **Knowledgebase generation source** — from TS types (`react-docgen`)? CEM analyzer? Story files? Lean toward generated-from-TS + author only judgment fields (constraints/do-not/examples). *(confirm)*
- **Hosting/distribution** — public npm like Blade, or private registry?
- **Where Figma fits** — do we own a Figma library + Code Connect, or consume an existing one?

---

## 8. Learnings log (append-only)

> Format: `YYYY-MM-DD — [topic] — what we learned / what changed`. Add freely.

- **2026-05-20 — [research] — Initial teardown of Blade, Primer, Figma + AI Design Systems Conf 2026.** Core thesis confirmed: an agentic-first DS is an *ecosystem* (code + design + agents + evals), not just an MCP server. The single highest-leverage early move is de-drifting the source of truth and shipping **JSON-for-MCP / Markdown-for-LLM** machine-readable docs. The five failure modes (§4) are the checklist to design against. Blade's package layout and MCP tool set (§2a) are the closest blueprint to copy.
- **2026-05-20 — [tooling] — firecrawl CLI** installed to a user-level npm prefix (`~/.npm-global`, global `/usr/local` needs sudo). Research artifacts cached in `./.firecrawl/` (gitignored).
- **2026-05-21 — [research #2: metadata contract] — there is no single "the schema."** Three production-proven shapes agree on the principles, not the format: Blade = structured Markdown, one file/component, contract as TS-types+JSDoc+`@default`; CEM = auto-generated JSON manifest for web components; DTCG = the W3C standard for the *token* layer. Shared winners: generated-from-source (no drift), contract precision (typed unions/defaults/required), **constraints as a first-class field** (the cheapest highest-value thing), runnable examples, one coherent file/component. Proposed contract + DTCG token layer written to §4a.
- **2026-05-21 — [research #3: format & loading] — "JSON vs Markdown" is the wrong question.** Indeed's 8-config benchmark: semantic-chunked JSON won (92% retrieval, 88% fewer tokens) for *RAG retrieval*; **mixing formats (hybrid MD+JSON = 27% completion) or fragmenting a component across files (domain-separated = 20% coverage) is actively harmful.** Independent format test: most-token-efficient ≠ most-accurate (Markdown-KV beat JSON for tabular lookup on a small model). So **format is empirical → benchmark our corpus**; pick by delivery model (whole-file MD-with-TS vs chunked-JSON). Method written to §4b.
- **2026-05-21 — [research: Southleft] — the infra under uSpec + a counter-position worth holding.** Southleft (Tom Pitre) makes **Figma Console MCP** ("**your design system as an API**" — extraction/creation/debugging/**bidirectional token sync**, the local Desktop-Bridge model) which uSpec runs on; stack = *Console MCP → uSpec → agent*. Their **Context-Based Design Systems** framework argues **"context, not data, is the unit of value"** and — pointedly — **"context beats autonomy"** ("the teams that win aren't the ones with the most agents"). New role: the **Context Engineer** owns the *trust layer* (trace why/who/what-was-authorized) — a human owner for our FM3 governance. They + **Brad Frost** run the AI&Design-Systems course, so §2d/uSpec/Console-MCP all trace to this group. Reframes our north-star: agentic-first = *legible & stewardable by agents*, not *maximally autonomous*. Captured in §2g.
- **2026-05-21 — [deep dive: uSpec source] — read the actual `redongreen/uSpec` repo (skills/references/CLI/figma-plugin/docs); it's our closest open-source blueprint.** Six directly-reusable patterns captured in §2f: (1) **skill = thin SKILL.md procedure + thick `references/` instruction file**, with Step 1 = "read the reference" (two-field frontmatter: name + quoted-trigger description); (2) **`create-*` (render to Figma) vs `extract-*` (write JSON) families sharing one canonical instruction file** per domain ("any improvement must be made in both places"); (3) **the agent↔tool contract is a validated, versioned schema** — `_base.json` with a prose contract + typed producer + Ajv pre-flight gate that aborts before spending LLM tokens; (4) judgment-vs-precision made **quantitative** (deterministic 9-phase plugin emits a superset `_base.json`; LLM only interprets; det/AI ratio published per skill); (5) the **orchestrator pattern** — dictionary pass first → parallel specialist fan-out → typed 3-class reconciliation gate → render (byte-identical output, diffable via `sourceHash`); (6) **one source, many hosts** via CLI token-rewriting into `.cursor/.claude/.agents` skills dirs + MCP-adapter table. Plus: canonical vocabulary catalog ("don't reinvent"), mistakes-as-data, designer-in-the-loop as frozen evidence, two coexisting source-of-truth models, local-first sandbox.
- **2026-05-21 — [research: Uber/uSpec] — Uber is doing the *reverse* direction (design → spec).** Their Base DS spans 7 implementation stacks; **uSpec** (open, by Ian Guisard) is a "visual-to-technical-spec compiler": an agent crawls the live Figma component tree via the **open-source Figma Console MCP** (local Figma Desktop over WebSocket) and renders finished spec pages *back into Figma*, weeks→minutes. Four transferable ideas: (1) a **second agent surface** = generating/maintaining design specs & docs, not just code; (2) **judgment-vs-precision split** — LLM interprets, deterministic scripts render; (3) **local-first MCP** is the enterprise unlock (no proprietary data leaves the network) + a **GenAI gateway with PII redaction** for governance; (4) **every skill loads its own reference docs/schemas before acting** so the agent selects from documented APIs instead of guessing — the recurring pattern across Blade, Figma, Indeed *and* Uber. Captured in §2e.
- **2026-05-21 — [research #3: THE big one] — an MCP solves component *retrieval*, not output *quality*.** Even Indeed's working component MCP produced broken spacing/typography/icons, because MCP is on-demand and prompts never ask for foundations. Fix that worked: **MCP (authoritative, on-demand) + a foundations Skill (`SKILL.md`, progressive context disclosure of spacing/hierarchy/composition/`quality.md`) as ONE system.** Foundations should be **evidence-based** (audit production codebases for the tokens/recipes that actually recur), and **calibration runs expose stale docs** the LLM will dutifully reproduce. This reframed inventory item #3→#4 and Phase 1/2 in the roadmap.

---

## 9. Sources

- Razorpay Blade — https://github.com/razorpay/blade · `.agents/skills`, `packages/blade-mcp`
- `@razorpay/blade-mcp` — https://www.npmjs.com/package/@razorpay/blade-mcp · docs: https://blade.razorpay.com/?path=/docs/guides-blade-mcp--docs
- GitHub Primer — https://primer.style · Copilot Accessibility Principles: https://primer.style/accessibility/foundations/copilot-principles
- Figma — "Design systems and AI: Why MCP servers are the unlock" — https://www.figma.com/blog/design-systems-ai-mcp/
- Figma `figma-generate-design` SKILL.md — https://github.com/figma/mcp-server-guide
- "Your Design System Is Not Ready for AI Agents" (AI Design Systems Conf 2026) — https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents
- **Blade component doc template** (real example) — https://github.com/razorpay/blade/tree/master/packages/blade-mcp/knowledgebase · `components/*.md` (TS-types-in-Markdown)
- **Custom Elements Manifest** (JSON component schema) — https://github.com/webcomponents/custom-elements-manifest · https://custom-elements-manifest.open-wc.org
- **W3C DTCG Design Tokens Format** (token schema) — https://www.designtokens.org/TR/2025.10/format/
- **Diana Wolosin (Indeed) — MCP Quality Benchmark** (8-config study) — https://dianawolosin.com/project/mcp-quality-benchmark
- **Diana Wolosin — "Fully Machine-Readable Design Systems"** (MCP+Skill, progressive disclosure) — https://www.designsystemscollective.com/fully-machine-readable-design-systems-3d43329ec3e3
- **TOON / format token-efficiency benchmark** — https://www.improvingagents.com/blog/toon-benchmarks/ · TOON spec: https://github.com/toon-format/toon
- **Uber — "How Uber Built an Agentic System to Automate Design Specs"** (uSpec) — https://www.uber.com/us/en/blog/automate-design-specs/ · https://uspec.design · InfoQ: https://www.infoq.com/news/2026/03/uber-ai-design/
- **uSpec source code** (MIT — the open-source blueprint we tore down in §2f) — https://github.com/redongreen/uSpec · npm `uspec-skills` · key files: `skills/*/SKILL.md`, `references/*`, `figma-plugin/docs/base-json-schema.md`, `figma-plugin/scripts/validate-base.mjs`, `packages/cli/src/render.ts`, `implementation.md`, `maintaining.md`
- **Figma Console MCP** (open-source, local read-write to Figma Desktop) — https://github.com/southleft/figma-console-mcp · docs: https://docs.figma-console-mcp.southleft.com
- **Southleft** (makers of Figma Console MCP; AI design-systems consultancy, Tom Pitre) — https://southleft.com · **Context-Based Design Systems, Revisited**: https://southleft.com/insights/design-systems/context-based-design-systems-revisited/ · **AI & Design Systems course** (w/ Brad Frost): https://aianddesign.systems
