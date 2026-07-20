/** Server-side barrel — re-exports analysis (pure) and actions (fs-backed). */
export {
  analyzeUserOwnership,
  buildTransferPreview,
  findOrphanedRecords,
  matchesOwner,
  recommendSuccessors,
  type LifecycleContext,
} from "@/lib/user-lifecycle-analysis";

export {
  executeOwnershipTransfer,
  loadLifecycleContext,
} from "@/lib/user-lifecycle-actions";
