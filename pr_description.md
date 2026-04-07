🧪 Add tests for useStageTransition hook

🎯 **What:** The `useStageTransition` hook in the board feature lacked unit tests, creating a testing gap around stage transition gating logic.
📊 **Coverage:** Added test coverage to verify proper setup and parameters delegation to `canAdvanceStage`. Tests cover cases where default parameter values are used, as well as cases with explicitly provided required approval counts.
✨ **Result:** The `useStageTransition` hook is now fully covered by tests, improving the reliability and safety of refactoring within this hook.
