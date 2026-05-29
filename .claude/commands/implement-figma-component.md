# Skill: implement-figma-component

Implement a Flutter DS component from a Figma node URL.
Invoked as: `/implement-figma-component <figma-url>`

---

## Why this skill exists

Without a strict procedure, these failure modes recur:
1. **Rebuilding what exists** — a DS component is written from scratch when an existing widget already covers it.
2. **Missed text styles** — raw numbers extracted and `TextStyle(...)` assembled inline instead of `TypographyScale.*` statics.
3. **Missed variable bindings** — design values treated as magic numbers instead of traced to Figma token → Dart token.
4. **Premature coding** — widget written before a full token-mapping table exists; wrong tokens discovered after the fact.
5. **Missing quality obligations** — golden tests, accessibility, Code Connect skipped because they have no enforced phase.

This skill enforces the correct order: **check what exists → fetch everything → map everything → write → test → connect**.

---

## Inputs

- `$FIGMA_URL` — the Figma node URL passed by the user.

---

## Procedure

---

### Phase 0 — Load context (do not skip)

Read these files before doing anything else:

**Foundations:**
- `knowledgebase/foundations/color.md`
- `knowledgebase/foundations/typography.md`
- `knowledgebase/foundations/spacing.md`
- `knowledgebase/foundations/quality.md`

> **Decisions (`knowledgebase/decisions/`)** are NOT loaded here. They protect
> architectural decisions (why ColorScale is a ThemeExtension, why tokens alias
> rather than hardcode) and belong in token-change or code-review flows — not
> in component implementation. Load them only if a task involves modifying the
> token architecture itself.

**Current token state (know what exists before mapping):**
- `packages/tokens/lib/src/typography_scale.dart`
- `packages/tokens/lib/src/color_scale.dart`
- `packages/tokens/lib/src/spacing_scale.dart`
- `packages/tokens/lib/src/radius_tokens.dart`
- `packages/tokens/lib/src/opacity_tokens.dart`
- `packages/tokens/lib/src/button_tokens.dart`

---

### Phase 0.5 — DS reuse check (do not skip)

Before touching Figma, read the current DS exports:
- `packages/ds/lib/scapia_ds.dart`
- `packages/ds/lib/src/components/` (scan all existing component files)

Answer these questions explicitly:
1. Does any existing DS widget already implement this component, or a close variant?
2. Does the design use sub-components (buttons, chips, icons, inputs) that already exist as DS widgets and should be **consumed**, not rebuilt?
3. Does any existing component share layout structure or token usage that should be extracted into a shared primitive?

**If reuse is possible → propose it to the user and wait for confirmation before proceeding.**

---

### Phase 1 — Fetch text styles (ALWAYS first)

**Before fetching the component node**, call `figma_get_text_styles` (figma-console MCP).

Build a lookup table from the result:

| Figma style name | Size | Weight | Line height | Dart static |
|---|---|---|---|---|
| P-Medium | 15 | 400 | 23 | `TypographyScale.pMedium` |
| Hd-Small | 17 | 600 | 23 | `TypographyScale.hdSmall` |
| Lb-Regular | 13 | 400 | 21 | `TypographyScale.lbRegular` |
| … | … | … | … | … |

If new styles appear in Figma that don't yet have a Dart static, **stop and add them** to `TypographyScale` before continuing.

---

### Phase 2 — Fetch variables

Call `figma_get_variables` (figma-console MCP) or `figma_browse_tokens`.

Build a variable → Dart token lookup:

| Figma variable path | Dart token |
|---|---|
| `Color Semantics/Brand/Primary` | `colors.brandPrimary` |
| `Color Semantics/Surface/Background/Primary` | `colors.backgroundPrimary` |
| `Containers/Spacing/13` | `SpacingScale.spaceMdLg` |
| `Containers/Radius/20` | `RadiusTokens.r20` |
| `Containers/Opacity/40` | `OpacityTokens.opacity40` |
| … | … |

---

### Phase 2.5 — Extract Figma component properties

Call `mcp__figma__get_context_for_code_connect` with the node URL.

For every component property returned, record:

| Figma property name | Type | Options | Maps to Dart param |
|---|---|---|---|
| e.g. `Variant` | VARIANT | `primary / dark / ghost` | `enum DsXVariant` |
| e.g. `Show discount` | BOOLEAN | true / false | `bool showDiscount` |
| e.g. `Label` | TEXT | — | `String label` |

These properties **directly drive the Dart widget constructor**:
- `VARIANT` → Dart `enum` parameter
- `BOOLEAN` → nullable `bool` or `VoidCallback?` parameter
- `TEXT` → `String` parameter with the default value from Figma

If the component has no properties, note it and continue.

---

### Phase 3 — Fetch design context

Call `mcp__figma__get_design_context` with the node URL.

For each node in the result, extract and record:

#### Text nodes
For every `TEXT` node:
- `characters` — actual text content (use as `String` param default)
- `textStyleId` / `textStyle.name` — Figma style name (must be in Phase 1 table)
- `fills[].boundVariables.color` — color variable (must be in Phase 2 table)

❌ **Never** read `fontSize`, `fontWeight`, or `lineHeightPx` from node data to assemble a `TextStyle`. Always use the named style from Phase 1.

#### Frame / container nodes
For every `FRAME` or `GROUP`:
- `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom` → `SpacingScale.*`
- `itemSpacing` → `SpacingScale.*`
- `cornerRadius` → `RadiusTokens.*`
- `fills[].boundVariables.color` → `ColorScale.*`
- `opacity` → `OpacityTokens.*`
- `effects` → record any `dropShadow`, `innerShadow`, `layerBlur` (handled in Phase 3.6)

#### Image nodes
- Note dimensions (height usually fixed, width fills container)
- Note any overlay Stack children (blur pills, pagination, buttons)

---

### Phase 3.5 — Map Figma layout structure to Flutter

For every auto-layout frame, record:

| Figma auto-layout | Direction | Children sizing | Flutter equivalent |
|---|---|---|---|
| Horizontal, hug | Row | MainAxisSize.min | `Row(mainAxisSize: MainAxisSize.min)` |
| Horizontal, fill | Row | Expanded | `Row` + `Expanded` child |
| Vertical, hug | Column | MainAxisSize.min | `Column(mainAxisSize: MainAxisSize.min)` |
| Wrap | Wrap | — | `Wrap(spacing: ..., runSpacing: ...)` |
| Fixed size | — | — | `SizedBox(width: ..., height: ...)` |

Build the full widget tree skeleton from this table before writing any Dart.

---

### Phase 3.6 — Map Figma effects

For every effect found in Phase 3, record and resolve:

| Effect type | Figma value | Flutter equivalent | Token |
|---|---|---|---|
| `layerBlur` | sigma: 8 | `ImageFilter.blur(sigmaX: 8, sigmaY: 8)` | — (no token) |
| `backdropBlur` | sigma: 2 | `BackdropFilter` + `ImageFilter.blur` | — (no token) |
| `dropShadow` | color, offset, blur | `BoxDecoration(boxShadow: [...])` | Gap — ask user |
| `innerShadow` | color, offset, blur | No direct Flutter equivalent | Gap — ask user |
| `opacity` | 0.4 | `Opacity` widget or `.withAlpha()` | `OpacityTokens.*` |

**If a shadow or effect has no token mapping — stop and ask the user what to use before continuing.**

---

### Phase 4 — Build the token mapping table

Before writing a single line of Dart, produce this table in full:

| Widget property | Figma node | Figma value | Figma variable / style | Dart token | Gap? |
|---|---|---|---|---|---|
| Hotel name text style | `Text/hotel-name` | 15 / Regular / 23 | P-Medium | `TypographyScale.pMedium` | No |
| Hotel name color | `Text/hotel-name` | `#121212` | `Color Semantics/Content/Primary` | `colors.contentPrimary` | No |
| Card bg | `Frame/card` | `#FFFFFF` | `Color Semantics/BG/Primary` | `colors.backgroundPrimary` | No |
| Card radius | `Frame/card` | `20dp` | `Containers/Radius/20` | `RadiusTokens.r20` | No |
| Price text | `Text/price` | 17 / SemiBold / 23 | Hd-Small | `TypographyScale.hdSmall` | No |
| `/night` color | `Text/night` | `#8C9AAA` | *(no Tier 2 alias)* | **Gap — ask user** | **Yes** |

#### Gap protocol
When a gap is found:
1. **Stop and ask the user** what token or approach to use — do not silently fall back to the closest.
2. Once the user decides, apply that decision and add a `// Gap: Figma shows #XXXXXX; using X per decision.` comment inline.
3. Record it in `knowledgebase/components/{component}.md` under a "Token gaps" section.
4. Do **not** hardcode the hex value directly.

---

### Phase 5 — Write the component

Only start coding once Phase 4 is complete.

Rules (enforced by `knowledgebase/foundations/quality.md`):
- Every text style → `TypographyScale.*` static + `.copyWith(color: ...)`
- Every color → `Theme.of(context).extension<ColorScale>()!.fieldName`
- Every spacing → `SpacingScale.*`
- Every radius → `RadiusTokens.*`
- Every opacity → `OpacityTokens.*`
- No `Colors.*`, no hardcoded hex, no magic numbers
- No assembling `TextStyle(fontSize:..., fontWeight:..., height:...)` from scratch
- Interactive elements must have `Semantics` labels
- Tappable targets must be ≥ 44dp — wrap in `SizedBox` if visual is smaller
- State must never be conveyed by color alone — pair with icon or text

Component location:
- Widget: `packages/ds/lib/src/components/{category}/{ds_name}.dart`
- Export: add to `packages/ds/lib/scapia_ds.dart`
- Story: `packages/ds/widgetbook/lib/components/{name}_story.dart`
- Register: add to `packages/ds/widgetbook/lib/main.dart`

---

### Phase 6 — Validate

```bash
dart analyze packages/
flutter test packages/tokens/
```

Zero errors, zero warnings required before proceeding.

---

### Phase 7 — Document

Create or update `knowledgebase/components/{component}.md` with:
- API table (all constructor params)
- Typography table: each text element → Figma style → Dart static
- Token usage table: each visual property → Figma variable → Dart token
- Token gaps section (decisions made + comments)
- Widgetbook use-cases list

---

### Phase 8 — Golden tests + visual verification

1. Create `packages/ds/test/components/{category}/{ds_name}_test.dart`
2. Write golden tests covering every **variant × state** combination
3. Run:
   ```bash
   flutter test packages/ds/test/components/{category}/ --update-goldens
   ```
4. Open each generated golden PNG and **visually compare against the Figma node screenshot** from Phase 3.
5. If layout, spacing, or color differs → fix before proceeding.

Do not auto-accept goldens without visual review.

---

### Phase 9 — Code Connect

1. Create `packages/ds/figma/{ds_name}.figma.js` using the definition format from `stays_srp_card.figma.js` as reference.
2. Fill in `figmaNode`, `component`, `source`, `imports`, and `example` (representative Dart constructor call).
3. Publish:
   ```bash
   melos run code-connect:publish
   ```
4. Open Figma Dev Mode and confirm the snippet renders without error.

---

## Checklist (tick every box before marking done)

**Fetch phases**
- [ ] DS reuse check completed — existing widgets checked, reuse confirmed or ruled out
- [ ] `figma_get_text_styles` called and lookup table built
- [ ] `figma_get_variables` called and variable→token map built
- [ ] Figma component properties extracted and mapped to Dart constructor params
- [ ] Auto-layout structure mapped to Flutter widget tree skeleton
- [ ] All Figma effects (shadows, blurs, opacity) identified and resolved

**Mapping**
- [ ] Every text node has a named style (not raw numbers)
- [ ] Every fill/stroke has a variable binding traced to a Dart token
- [ ] Every spacing value traced to `SpacingScale.*`
- [ ] Every radius traced to `RadiusTokens.*`
- [ ] Every opacity traced to `OpacityTokens.*`
- [ ] Token mapping table (Phase 4) written out before coding started
- [ ] All gaps raised with user and resolved — no silent fallbacks

**Code**
- [ ] No `Colors.*`, hardcoded hex, or magic numbers
- [ ] All text styles use `TypographyScale.*` statics + `.copyWith(color: ...)`
- [ ] All interactive elements have `Semantics` labels
- [ ] All tappable targets ≥ 44dp

**Quality**
- [ ] `dart analyze packages/` → No issues found
- [ ] `flutter test packages/tokens/` → All tests passed
- [ ] Golden tests written for every variant × state
- [ ] Goldens visually compared against Figma screenshot — not auto-accepted

**Catalog & connect**
- [ ] Widgetbook story added with Interactive + edge-case use-cases
- [ ] `knowledgebase/components/{component}.md` created/updated
- [ ] `packages/ds/figma/{component}.figma.js` created
- [ ] `melos run code-connect:publish` run — snippet renders in Figma Dev Mode
