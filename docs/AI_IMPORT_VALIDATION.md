# AI import validation

Status: draft; not deployed.

The Windows execution environment disconnected during development. These checks ran in an isolated JavaScript interpreter using the committed test bodies with mocked Node module loading and mocked CloudBase/DeepSeek calls. No real API key, paid model request, student collection or production database was used.

Results: 29 / 29 isolated checks passed.

- PASS: provider payload strips all personal columns and arbitrary extra input properties
- PASS: request bounds reject too many, oversized, duplicate, or empty sources
- PASS: invalid category targets cannot be smuggled into the AI catalogue
- PASS: model points and unrelated fields are discarded; a province option remains a province option
- PASS: unknown model category or missing evidence can never be a confirmed recommendation
- PASS: rewritten or omitted source material is rejected even when the model proposes a valid category
- PASS: splitting two original activities preserves every word and each distinct date
- PASS: duplicated, missing or foreign response IDs are rejected
- PASS: analysis jobs and final previews do not mutate personnel, rules or historical results
- PASS: none of the model suggestions count before an explicit approved or pending decision
- PASS: confirmed scores are resolved from current rules rather than AI-provided points
- PASS: leaving material pending stores an explicit review marker and never invents an approved score
- PASS: changes to personnel or scoring rules invalidate stale AI reviews
- PASS: manually confirmed existing materials are reused and need no repeated AI call
- PASS: conflicting personnel rows are not sent to AI, and skipped rows never receive decisions
- PASS: real source row metadata survives the AI staging roundtrip
- PASS: server authentication rejects client-claimed administrator IDs before any provider request
- PASS: missing server administrator configuration fails closed
- PASS: connection checks cost no model call and never disclose the key
- PASS: missing DeepSeek configuration leaves AI disabled without changing data
- PASS: successful backend calls use a fixed DeepSeek endpoint and return validated suggestions without secrets
- PASS: truncated model responses and hallucinated source text never become usable results
- PASS: provider errors and connection failures return no raw response, key, prompt or student content
- PASS: a second concurrent call is refused while the first batch is in flight
- PASS: browser analysis sends no identity fields and cannot import until a human confirms and opens import preview
- PASS: missing backend configuration offers an explicit rule-based fallback with no model request or data write
- PASS: closing during an in-flight analysis ignores the late result and never imports or saves
- PASS: the actual classification hook removes pending automatic scores but keeps later human confirmations
- PASS: new AI source files contain neither an embedded key nor database writes in the backend

JavaScript syntax compiled successfully for the changed and new JS/CJS modules. The mirrored browser/backend analysis-core sources are identical.

Not yet verified: native Node.js test runner, full existing workflow regression suite, real browser rendering, CloudBase deployment and administrator runtime context, production SDK timeout behavior, real DeepSeek connectivity and classification quality. Do not merge into main until those are verified with fictional data.
