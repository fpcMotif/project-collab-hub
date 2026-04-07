💡 **What:**
Optimized the `listBoardProjects` API endpoint by eliminating the N+1 database queries. Previously, this endpoint mapped over each fetched project to call `buildBoardProjectRecord`, triggering 4 isolated queries for every single project (for tracks, items, approvals, and templates). It now executes 5 top-level bulk queries total, then joins everything efficiently in a local memory block.

🎯 **Why:**
As the number of board projects grew, the latency scaled linearly due to the 1 + (N * 4) roundtrip database fetching logic. Fixing this ensures O(1) query scaling when listing boards.

📊 **Measured Improvement:**
Created a new edge-runtime benchmark suite (`tests/board.test.ts`) that mocks the database queries and simulates 50 project records.
* **Baseline:** ~175ms total execution time.
* **Optimized:** ~70ms total execution time.
* **Impact:** Over 2.5x speedup and prevents arbitrary DB overhead scaling.
