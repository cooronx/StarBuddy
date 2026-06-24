-- Destructive migration: PAT credentials are intentionally not migrated.
DROP TABLE "github_tokens";
DROP TYPE "GithubTokenStatus";

CREATE TYPE "GithubAuthorizationStatus" AS ENUM ('active', 'invalid', 'revoked');

CREATE TABLE "github_authorizations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_access_token" TEXT,
    "access_token_iv" TEXT,
    "access_token_auth_tag" TEXT,
    "scopes" JSONB NOT NULL,
    "status" "GithubAuthorizationStatus" NOT NULL DEFAULT 'active',
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_login_codes" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_login_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "github_authorizations_user_id_key" ON "github_authorizations"("user_id");
CREATE UNIQUE INDEX "oauth_login_codes_code_hash_key" ON "oauth_login_codes"("code_hash");
CREATE INDEX "oauth_login_codes_expires_at_idx" ON "oauth_login_codes"("expires_at");

ALTER TABLE "github_authorizations" ADD CONSTRAINT "github_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_login_codes" ADD CONSTRAINT "oauth_login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
