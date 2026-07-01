-- RenameIndex
ALTER INDEX "star_actions_actor_status_created_at_idx" RENAME TO "star_actions_actor_user_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "star_actions_repository_status_created_at_idx" RENAME TO "star_actions_repository_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "task_claims_user_repository_status_expires_at_idx" RENAME TO "task_claims_user_id_repository_id_status_expires_at_idx";
