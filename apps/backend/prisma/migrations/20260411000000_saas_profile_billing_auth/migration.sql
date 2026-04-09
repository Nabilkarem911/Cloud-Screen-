-- SaaS profile, verification, password reset, billing history
ALTER TABLE "User" ADD COLUMN "businessName" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "country" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "verificationCode" TEXT;
ALTER TABLE "User" ADD COLUMN "verificationCodeExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingEmailOtp" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingEmailOtpExpiresAt" TIMESTAMP(3);

UPDATE "User" SET "emailVerified" = true WHERE "emailVerified" = false;

CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "invoiceRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRecord_userId_createdAt_idx" ON "PaymentRecord"("userId", "createdAt");

ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
