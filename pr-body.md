🎯 **What:** The `useMockProjectDetail` hook was completely untested, meaning that its dependency fetching and memoization behavior had no safety net against regressions. This PR addresses this testing gap.

📊 **Coverage:**
The added test suite covers:

- **Happy path:** Successfully retrieving a specific mock project detail and verifying `isLoading` is set correctly.
- **Edge cases:** Requesting details for a non-existent project returns `undefined` safely.
- **Memoization:** Verifies that `useMemo` is applied correctly. Specifically, re-renders with the same `projectId` reference the cached value instead of repeatedly invoking the detail getter utility.

✨ **Result:** Test coverage improved specifically for data extraction state mapping in the Mock Board view, promoting stability ahead of deeper system integrations.
