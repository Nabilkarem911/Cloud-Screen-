-- CreateEnum
CREATE TYPE "PlatformStaffRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_SPECIALIST', 'BILLING_MANAGER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "platformStaffRole" "PlatformStaffRole";
