-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'advertiser', 'admin');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billboard" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "screenType" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "estimatedDailyTraffic" INTEGER NOT NULL,
    "audienceProfile" TEXT NOT NULL,
    "qualityTier" TEXT NOT NULL,
    "defaultReservePrice" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "altitude" DOUBLE PRECISION,
    "uniqueHardwareId" TEXT,
    "blackoutPeriods" TEXT,
    "hardwareReliabilityNotes" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verificationPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejectionReason" TEXT,
    "faceCorners" JSONB,
    "deliveryWebhookUrl" TEXT,

    CONSTRAINT "Billboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reservePrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "ownerUse" BOOLEAN NOT NULL DEFAULT false,
    "auctionOpenTime" TEXT,
    "auctionCloseTime" TEXT,
    "minimumBidIncrement" INTEGER,
    "antiSnipingWindowMinutes" INTEGER,
    "antiSnipingExtensionMinutes" INTEGER,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accent" TEXT NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "rejectionReason" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "creativeId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalBudget" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "preferredAreas" TEXT[],
    "preferredTimeWindows" TEXT[],
    "audienceTags" TEXT[],
    "qualityTier" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "selectedSlotIds" TEXT[],
    "buyingMode" TEXT NOT NULL,
    "maxBidPerSlot" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionResult" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "winnerAdvertiserId" TEXT,
    "winningBid" INTEGER,
    "secondHighestBid" INTEGER,
    "clearingPrice" INTEGER,
    "closedAt" TEXT NOT NULL,
    "creativeId" TEXT,
    "platformFee" INTEGER NOT NULL,
    "ownerPayout" INTEGER NOT NULL,
    "creativeApprovalPending" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AuctionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPlayback" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plannedStartAt" TEXT NOT NULL,
    "plannedEndAt" TEXT NOT NULL,
    "playbackTimestamp" TEXT,
    "failureReason" TEXT,
    "deliveryStatus" TEXT,
    "deliveryDetail" TEXT,

    CONSTRAINT "ScheduledPlayback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "clearingPrice" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "ownerPayout" INTEGER NOT NULL,
    "advertiserAmountDue" INTEGER NOT NULL,
    "ownerAmountPayable" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionResult_slotId_key" ON "AuctionResult"("slotId");

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

