-- User-level subscription tracking for super-admin customer CRM
CREATE TYPE "UserSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TRIAL');

ALTER TABLE "User" ADD COLUMN "subscriptionStatus" "UserSubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "User" ADD COLUMN "subscriptionEndDate" TIMESTAMP(3);
