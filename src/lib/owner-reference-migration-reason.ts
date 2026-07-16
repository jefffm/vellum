import { Type, type Static } from "@sinclair/typebox";

/** Browser-safe closed vocabulary shared by migration and redacted Workbench contracts. */
export const OwnerReferenceMigrationQuarantineReasonSchema = Type.Union([
  Type.Literal("legacy_id_collision"),
  Type.Literal("missing_bytes"),
  Type.Literal("hash_mismatch"),
  Type.Literal("length_mismatch"),
  Type.Literal("invalid_legacy_record"),
  Type.Literal("unsafe_legacy_path"),
  Type.Literal("unstable_legacy_bytes"),
  Type.Literal("incomplete_identity"),
  Type.Literal("composite_identity"),
  Type.Literal("immutable_mapping_conflict"),
  Type.Literal("target_record_collision"),
]);
export type OwnerReferenceMigrationQuarantineReason = Static<
  typeof OwnerReferenceMigrationQuarantineReasonSchema
>;

export const OwnerReferenceMigrationQuarantineActionSchema = Type.Union([
  Type.Literal("resolve_legacy_id_collision"),
  Type.Literal("restore_exact_legacy_bytes"),
  Type.Literal("review_legacy_record"),
  Type.Literal("repair_legacy_storage_boundary"),
  Type.Literal("retry_stable_snapshot"),
  Type.Literal("review_source_identity"),
  Type.Literal("review_immutable_mapping_conflict"),
  Type.Literal("review_target_record_collision"),
]);
export type OwnerReferenceMigrationQuarantineAction = Static<
  typeof OwnerReferenceMigrationQuarantineActionSchema
>;
