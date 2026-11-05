# Validation status

Draft only; not deployed.

The execution environment has reconnected. The native Node.js test runner completed all 156 checks successfully: 123 existing workflow checks, 29 AI-module checks and 4 additional tests using the real import preview and confirmation handlers.

Tests use fictional records and mocked external calls. No actual API key, paid AI request, private collection or production database was used.

Still pending: real browser rendering and live external-service integration. Do not merge the draft until those checks are completed.

Run locally:

    node --test tests/ai-import.test.cjs tests/workflow-dom.test.cjs tests/workflow.test.cjs
