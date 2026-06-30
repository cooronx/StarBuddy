CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

ALTER TABLE "users"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'active';

ALTER TYPE "TaskClaimStatus" ADD VALUE IF NOT EXISTS 'cancelled_daily_limit';
ALTER TYPE "TaskClaimStatus" ADD VALUE IF NOT EXISTS 'cancelled_repository_unavailable';

CREATE TYPE "RepositoryReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

CREATE TABLE "repository_reports" (
  "id" TEXT NOT NULL,
  "repository_id" TEXT NOT NULL,
  "reporter_user_id" TEXT NOT NULL,
  "reason" TEXT,
  "status" "RepositoryReportStatus" NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),

  CONSTRAINT "repository_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repository_reports_repository_id_reporter_user_id_key"
  ON "repository_reports"("repository_id", "reporter_user_id");

CREATE INDEX "repository_reports_status_created_at_idx"
  ON "repository_reports"("status", "created_at");

CREATE INDEX "repository_reports_repository_id_status_idx"
  ON "repository_reports"("repository_id", "status");

ALTER TABLE "repository_reports"
  ADD CONSTRAINT "repository_reports_repository_id_fkey"
  FOREIGN KEY ("repository_id") REFERENCES "repositories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repository_reports"
  ADD CONSTRAINT "repository_reports_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "repositories_status_owner_user_id_idx"
  ON "repositories"("status", "owner_user_id");

CREATE INDEX "star_tasks_status_created_at_idx"
  ON "star_tasks"("status", "created_at");

CREATE INDEX "task_claims_user_repository_status_expires_at_idx"
  ON "task_claims"("user_id", "repository_id", "status", "expires_at");

CREATE INDEX "star_actions_repository_status_created_at_idx"
  ON "star_actions"("repository_id", "status", "created_at");

CREATE INDEX "star_actions_actor_status_created_at_idx"
  ON "star_actions"("actor_user_id", "status", "created_at");

CREATE INDEX "rate_limit_events_event_type_created_at_idx"
  ON "rate_limit_events"("event_type", "created_at");
