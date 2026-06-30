-- Recreate RepositoryStatus so the migration can safely use new enum values
-- while normalizing existing repositories into one active promotion slot per user.
ALTER TYPE "RepositoryStatus" RENAME TO "RepositoryStatus_old";

CREATE TYPE "RepositoryStatus" AS ENUM (
    'active',
    'inactive',
    'paused',
    'archived',
    'rejected'
);

ALTER TABLE "repositories" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "repositories"
    ALTER COLUMN "status" TYPE "RepositoryStatus"
    USING ("status"::text::"RepositoryStatus");
ALTER TABLE "repositories" ALTER COLUMN "status" SET DEFAULT 'active';

DROP TYPE "RepositoryStatus_old";

ALTER TABLE "users" ADD COLUMN "last_promotion_switch_at" TIMESTAMP(3);

WITH ranked_promotions AS (
    SELECT
        "id",
        row_number() OVER (
            PARTITION BY "owner_user_id"
            ORDER BY "created_at" ASC, "id" ASC
        ) AS promotion_rank
    FROM "repositories"
    WHERE "status" = 'active'
)
UPDATE "repositories"
SET "status" = 'inactive'
WHERE "id" IN (
    SELECT "id"
    FROM ranked_promotions
    WHERE promotion_rank > 1
);

CREATE UNIQUE INDEX "repositories_owner_active_promotion_slot_key"
    ON "repositories"("owner_user_id")
    WHERE "status" IN ('active', 'paused');
