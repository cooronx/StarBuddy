-- CreateEnum
CREATE TYPE "GithubTokenStatus" AS ENUM ('active', 'invalid', 'revoked');

-- CreateEnum
CREATE TYPE "RepositoryStatus" AS ENUM ('active', 'archived', 'rejected');

-- CreateEnum
CREATE TYPE "StarTaskStatus" AS ENUM ('active', 'paused_insufficient_credits', 'paused_by_owner', 'disabled');

-- CreateEnum
CREATE TYPE "TaskClaimStatus" AS ENUM ('claimed', 'completed_rewarded', 'completed_no_reward', 'failed', 'cancelled_insufficient_credits', 'expired');

-- CreateEnum
CREATE TYPE "StarActionStatus" AS ENUM ('completed_rewarded', 'already_starred_no_reward', 'completed_unrewarded_insufficient_credits', 'failed');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('signup_bonus', 'star_completed_reward', 'repository_star_spend');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "github_user_id" BIGINT NOT NULL,
    "github_login" TEXT NOT NULL,
    "avatar_url" TEXT,
    "credits_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_token" TEXT,
    "token_iv" TEXT,
    "token_auth_tag" TEXT,
    "token_type" TEXT NOT NULL DEFAULT 'fine_grained_pat',
    "permissions_snapshot" JSONB,
    "status" "GithubTokenStatus" NOT NULL DEFAULT 'active',
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "github_owner" TEXT NOT NULL,
    "github_repo" TEXT NOT NULL,
    "github_repo_id" BIGINT NOT NULL,
    "description" TEXT,
    "stars_count_snapshot" INTEGER NOT NULL DEFAULT 0,
    "status" "RepositoryStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "star_tasks" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "status" "StarTaskStatus" NOT NULL DEFAULT 'active',
    "reward_credits" INTEGER NOT NULL DEFAULT 1,
    "daily_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "star_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_claims" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "TaskClaimStatus" NOT NULL DEFAULT 'claimed',
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "task_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "star_actions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "github_owner" TEXT NOT NULL,
    "github_repo" TEXT NOT NULL,
    "status" "StarActionStatus" NOT NULL,
    "github_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "star_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credits_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "ip_address" TEXT,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_user_id_key" ON "users"("github_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_tokens_user_id_key" ON "github_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_repo_id_key" ON "repositories"("github_repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_owner_github_repo_key" ON "repositories"("github_owner", "github_repo");

-- CreateIndex
CREATE UNIQUE INDEX "star_tasks_repository_id_key" ON "star_tasks"("repository_id");

-- CreateIndex
CREATE INDEX "task_claims_user_id_status_idx" ON "task_claims"("user_id", "status");

-- CreateIndex
CREATE INDEX "task_claims_task_id_status_idx" ON "task_claims"("task_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "star_actions_actor_user_id_repository_id_key" ON "star_actions"("actor_user_id", "repository_id");

-- CreateIndex
CREATE INDEX "credits_ledger_user_id_created_at_idx" ON "credits_ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_events_user_id_event_type_created_at_idx" ON "rate_limit_events"("user_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_events_ip_address_event_type_created_at_idx" ON "rate_limit_events"("ip_address", "event_type", "created_at");

-- AddForeignKey
ALTER TABLE "github_tokens" ADD CONSTRAINT "github_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_tasks" ADD CONSTRAINT "star_tasks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_claims" ADD CONSTRAINT "task_claims_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "star_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_claims" ADD CONSTRAINT "task_claims_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_claims" ADD CONSTRAINT "task_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_actions" ADD CONSTRAINT "star_actions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "star_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_actions" ADD CONSTRAINT "star_actions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_actions" ADD CONSTRAINT "star_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
