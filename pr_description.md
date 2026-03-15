🧪 Testing improvement for `packages/backend/convex/workItems.ts`

🎯 **What:**
The testing gap addressed is the lack of unit tests for the `workItems.create` Convex mutation handler, leaving inserts into `workItems` and `auditEvents` untested. Since `convex-test` generated types were not fully available via `bunx convex dev` in the local environment without a login, the test invokes the mutation handler logic directly through `t.run(ctx => ...)`, avoiding testing framework bugs with missing `_generated` paths. We also configured `vitest.config.ts` to ensure compatibility.

📊 **Coverage:**
The new test file (`packages/backend/convex/workItems.test.ts`) verifies that when a work item is created:
- It correctly inserts a new task in the `workItems` table with the requested properties.
- It automatically creates an associated `auditEvents` table entry with the correct action name (`work_item.created`) and summary.

✨ **Result:**
- Coverage of core Convex backend tables is increased, adding a layer of safety around our `workItems` creation process.
- We have introduced a pattern to write database integration tests using `convex-test` within this project.
