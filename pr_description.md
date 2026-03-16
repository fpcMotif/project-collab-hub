🧪 Testing Improvement for approvalGates.resolve Idempotency

🎯 **What:** The testing gap addressed
This PR addresses the lack of tests for the idempotency logic in `packages/backend/convex/approvalGates.ts` `resolve` function. This logic is critical for preventing duplicate audit events or state transitions when multiple identical requests are processed.

📊 **Coverage:** What scenarios are now tested
- Tested early return (idempotency check) when an `auditEvent` with a matching `idempotencyKey` already exists.
- Tested normal execution path to ensure it functions when the `idempotencyKey` doesn't exist yet.

✨ **Result:** The improvement in test coverage
We now have reliable and focused test cases explicitly guaranteeing the correctness of the idempotency logic, avoiding potential duplicate actions and side-effects.
