# Frontend lint debt

The following React Hooks findings are intentionally warnings for the specific
files listed in [`front/eslint.config.js`](../front/eslint.config.js). The rules
remain errors everywhere else. Do not change the affected component logic just
to silence lint; first add focused chart behavior tests and verify the relevant
visual and timing behavior.

## React Hooks errors downgraded to warnings

| File:line | Rule | Why changing it is risky | What a safe fix would need |
|---|---|---|---|
| `front/src/components/charts/highlight-segment.jsx:15` | `react-hooks/refs` | Reads chart refs while rendering the highlight geometry. | Chart rendering tests for highlight placement and lifecycle; move reads to an appropriate post-commit measurement path. |
| `front/src/components/charts/highlight-segment.jsx:28` | `react-hooks/refs` | Uses ref-backed chart data during render; changing when it is read can move or remove the segment. | The same highlight geometry tests, including updates as the chart scales change. |
| `front/src/components/charts/highlight-segment.jsx:28` | `react-hooks/refs` | A second ref access on the same line is independently flagged and contributes to the same rendered geometry. | The same tests, proving the replacement read stays synchronized with chart layout. |
| `front/src/components/charts/tooltip/chart-tooltip.jsx:325` | `react-hooks/set-state-in-effect` | Effect-driven state synchronization controls tooltip visibility/position timing. | Tooltip lifecycle tests for open, close, and chart updates; derive state where possible or defer synchronization without flicker. |
| `front/src/components/charts/tooltip/chart-tooltip.jsx:328` | `react-hooks/refs` | Reads a DOM ref during render to position the tooltip. | Browser-level positioning tests covering resize, scroll, and changing chart data; measure after commit. |
| `front/src/components/charts/tooltip/chart-tooltip.jsx:329` | `react-hooks/refs` | Reads another ref-backed value during tooltip rendering. | The same positioning tests, asserting no stale coordinates or layout shift. |
| `front/src/components/charts/tooltip/date-ticker.jsx:80` | `react-hooks/refs` | Reads ticker measurement refs while choosing date-label geometry. | Chart/browser tests for ticker alignment at varied widths; move DOM measurement to layout effects and keep rendering stable. |
| `front/src/components/charts/tooltip/date-ticker.jsx:81` | `react-hooks/refs` | A second render-time measurement read affects ticker spacing. | The same alignment tests, including resize and font/layout changes. |
| `front/src/components/charts/tooltip/date-ticker.jsx:84` | `react-hooks/refs` | Uses ref-backed ticker dimensions in its render decision. | Tests proving measurement updates preserve label visibility and avoid flicker. |
| `front/src/components/charts/tooltip/tooltip-box.jsx:41` | `react-hooks/set-state-in-effect` | Effect state controls the tooltip box's measured/animated transition. | Tooltip appearance and transition tests, including reduced motion; avoid synchronous cascading renders while preserving first-frame behavior. |
| `front/src/components/charts/tooltip/tooltip-box.jsx:88` | `react-hooks/refs` | Reads a DOM ref for floating-box positioning during render. | Browser tests for placement around viewport edges, resize, and scroll; perform measurement after commit. |
| `front/src/components/charts/tooltip/tooltip-box.jsx:88` | `react-hooks/refs` | A second ref access at the same location participates in box geometry. | The same placement tests, covering updated dimensions. |
| `front/src/components/charts/tooltip/tooltip-box.jsx:89` | `react-hooks/refs` | Reads a second ref-backed measurement used to position the box. | The same placement tests, checking coordinate and animation continuity. |
| `front/src/components/charts/tooltip/tooltip-box.jsx:89` | `react-hooks/refs` | A second ref access at the same location is independently flagged. | The same tests, ensuring all measured values update together. |
| `front/src/components/charts/use-animated-series-path.js:71` | `react-hooks/set-state-in-effect` | Effect state starts or synchronizes the animated path, so timing changes can alter the reveal. | Focused animation tests for initial mount, path updates, cancellation, and reduced motion; preserve frame sequencing. |
| `front/src/components/charts/use-animated-y-domains.js:120` | `react-hooks/refs` | Reads mutable animation refs while deriving y-domain values. | Scale/domain tests during mount and data changes; separate post-commit animation state from render-derived values. |
| `front/src/components/charts/use-animated-y-domains.js:122` | `react-hooks/refs` | A second animation-ref read can change domain interpolation. | The same tests, asserting domain endpoints and interpolation remain stable. |
| `front/src/components/charts/use-animated-y-domains.js:124` | `react-hooks/refs` | Reads another mutable value used by the animated domain calculation. | The same tests across rapid updates and interrupted transitions. |
| `front/src/components/charts/use-animated-y-domains.js:130` | `react-hooks/refs` | Uses mutable animation state when returning the render-time domain. | The same tests, including first render, completion, and cancellation. |
| `front/src/components/charts/use-chart-phase-orchestrator.js:23` | `react-hooks/refs` | Reads phase-machine refs during render; this coordinates chart loading/reveal state. | Phase transition tests for loading, reveal, exit, cancellation, and reduced motion; keep mutable coordination outside render. |
| `front/src/components/charts/use-chart-phase-orchestrator.js:37` | `react-hooks/set-state-in-effect` | Synchronously advances chart phase in an effect and may affect the transition frame. | Deterministic phase-machine tests asserting exact phase order and no flashing on mount. |
| `front/src/components/charts/use-chart-phase-orchestrator.js:90` | `react-hooks/set-state-in-effect` | Effect-driven phase synchronization coordinates loading and animation completion. | Tests for overlapping data updates and completion callbacks, preserving transition order. |
| `front/src/components/charts/use-chart-phase-orchestrator.js:140` | `react-hooks/set-state-in-effect` | Effect state update ends or advances a reveal phase. | Tests for normal/reduced-motion completion, unmount, and interrupted transitions. |
| `front/src/components/charts/use-enter-complete.js:14` | `react-hooks/set-state-in-effect` | Effect state records animation completion and can change when chart content is revealed. | Animation lifecycle tests for completion, cancellation, and reduced motion before changing the state timing. |
| `front/src/components/charts/use-highlight-segment.js:38` | `react-hooks/refs` | Reads mutable refs to track highlight animation inputs. | Highlight tests for initial state, updates, and interrupted motion; update refs after commit while preserving the animation origin. |
| `front/src/components/charts/use-highlight-segment.js:38` | `react-hooks/refs` | A second ref read on this line contributes to the highlight's animation inputs. | The same tests, proving simultaneous input changes do not cause jumps. |
| `front/src/components/charts/use-highlight-segment.js:45` | `react-hooks/refs` | Reads ref-backed state when building the highlight output. | Render/animation tests showing geometry and transition continuity after moving the read. |
| `front/src/components/charts/use-mount-progress.js:15` | `react-hooks/refs` | Reads mount-progress ref state during render to drive chart reveal behavior. | Mount/reveal tests with normal and reduced motion; model progress without render-time mutable-ref reads. |
| `front/src/components/charts/y-axis.jsx:92` | `react-hooks/preserve-manual-memoization` | Compiler cannot preserve memoization of the hovered-entry calculation; removing or changing it may affect hot-path rendering and tooltip synchronization. | Y-axis hover tests plus render-count/performance checks before changing memoization or its dependency model. |
| `front/src/context/WorkoutsContext.jsx:41` | `react-hooks/set-state-in-effect` | Effect state synchronization can affect initial workout-loading and screen timing. | Context tests for initial load, refresh, errors, and user changes; preserve request cancellation and visible loading behavior. |

## Remaining `react-hooks/exhaustive-deps` warnings

These six warnings are not part of the targeted override and remain warnings
under the normal configuration:

| File:line | Note |
|---|---|
| `front/src/components/SwipeDeck.jsx:311` | Effect omits `goToIndex`. |
| `front/src/components/SwipeDeck.jsx:427` | Effect omits `goToIndex`. |
| `front/src/components/charts/path-stroke-utils.js:50` | Effect dependency array contains a spread, so ESLint cannot statically verify it. |
| `front/src/components/charts/tooltip/chart-tooltip.jsx:366` | Effect omits `xWithMargin`. |
| `front/src/context/authContext.jsx:232` | Memo omits `authFetch`, `getAccessToken`, and `refreshSession`. |
| `front/src/pages/dashboard.jsx:383` | Effect omits `authFetch`. |
