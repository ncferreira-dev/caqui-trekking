-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('FACIL', 'MODERADO', 'DIFICIL', 'EXTREMO');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DepartureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'LAST_SPOTS', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CAMISETA', 'REGATA', 'MOCHILA', 'BONE', 'ACESSORIO');

-- CreateEnum
CREATE TYPE "VariantSize" AS ENUM ('PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsappNumber" VARCHAR(20) NOT NULL,
    "whatsappMessageTemplate" TEXT NOT NULL,
    "instagramTrekking" VARCHAR(100),
    "instagramWear" VARCHAR(100),
    "linktree" VARCHAR(255),
    "email" VARCHAR(255),
    "cadasturNumber" VARCHAR(50),
    "pesmCredentials" VARCHAR(255),
    "heroTitle" VARCHAR(200),
    "heroSubtitle" VARCHAR(300),
    "aboutText" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "bio" TEXT,
    "cadasturNumber" VARCHAR(50),
    "pesmCredential" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(300),
    "description" TEXT NOT NULL,
    "region" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "distanceKm" DECIMAL(6,2),
    "elevationGainM" INTEGER,
    "maxAltitudeM" INTEGER,
    "durationMinutes" INTEGER,
    "minAge" INTEGER,
    "requiresExperience" BOOLEAN NOT NULL DEFAULT false,
    "highlights" TEXT[],
    "included" TEXT[],
    "notIncluded" TEXT[],
    "whatToBring" TEXT[],
    "cancellationPolicy" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_tags" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "icon" VARCHAR(60),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activity_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_activity_tags" (
    "tripId" INTEGER NOT NULL,
    "activityTagId" INTEGER NOT NULL,

    CONSTRAINT "trip_activity_tags_pkey" PRIMARY KEY ("tripId","activityTagId")
);

-- CreateTable
CREATE TABLE "departures" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3),
    "meetingPoint" VARCHAR(300),
    "meetingLat" DECIMAL(10,7),
    "meetingLng" DECIMAL(10,7),
    "meetingTimeLocal" VARCHAR(5),
    "priceCents" INTEGER NOT NULL,
    "compareAtPriceCents" INTEGER,
    "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
    "status" "DepartureStatus" NOT NULL DEFAULT 'DRAFT',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departure_guides" (
    "departureId" INTEGER NOT NULL,
    "guideId" INTEGER NOT NULL,

    CONSTRAINT "departure_guides_pkey" PRIMARY KEY ("departureId","guideId")
);

-- CreateTable
CREATE TABLE "departure_availability_changes" (
    "id" SERIAL NOT NULL,
    "departureId" INTEGER NOT NULL,
    "from" "Availability" NOT NULL,
    "to" "Availability" NOT NULL,
    "reason" VARCHAR(300),
    "userId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departure_availability_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "size" "VariantSize" NOT NULL,
    "colorName" VARCHAR(60) NOT NULL,
    "colorHex" VARCHAR(7),
    "priceCents" INTEGER,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "publicId" VARCHAR(255) NOT NULL,
    "alt" VARCHAR(300) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "blurDataUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tripId" INTEGER,
    "productId" INTEGER,
    "guideId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" VARCHAR(60) NOT NULL,
    "entityType" VARCHAR(60) NOT NULL,
    "entityId" VARCHAR(60) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "name" VARCHAR(150),
    "source" VARCHAR(60) NOT NULL,
    "consentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "message" TEXT NOT NULL,
    "tripId" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guides_active_sortOrder_idx" ON "guides"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "guides_deletedAt_idx" ON "guides"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "trips_slug_key" ON "trips"("slug");

-- CreateIndex
CREATE INDEX "trips_status_featured_sortOrder_idx" ON "trips"("status", "featured", "sortOrder");

-- CreateIndex
CREATE INDEX "trips_difficulty_idx" ON "trips"("difficulty");

-- CreateIndex
CREATE INDEX "trips_deletedAt_idx" ON "trips"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_tags_slug_key" ON "activity_tags"("slug");

-- CreateIndex
CREATE INDEX "trip_activity_tags_activityTagId_idx" ON "trip_activity_tags"("activityTagId");

-- CreateIndex
CREATE INDEX "departures_status_startAt_idx" ON "departures"("status", "startAt");

-- CreateIndex
CREATE INDEX "departures_tripId_startAt_idx" ON "departures"("tripId", "startAt");

-- CreateIndex
CREATE INDEX "departures_availability_idx" ON "departures"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "departures_tripId_startAt_key" ON "departures"("tripId", "startAt");

-- CreateIndex
CREATE INDEX "departure_guides_guideId_idx" ON "departure_guides"("guideId");

-- CreateIndex
CREATE INDEX "departure_availability_changes_departureId_createdAt_idx" ON "departure_availability_changes"("departureId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_category_sortOrder_idx" ON "products"("status", "category", "sortOrder");

-- CreateIndex
CREATE INDEX "products_featured_idx" ON "products"("featured");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE INDEX "product_variants_productId_sortOrder_idx" ON "product_variants"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_size_colorName_key" ON "product_variants"("productId", "size", "colorName");

-- CreateIndex
CREATE INDEX "media_assets_tripId_sortOrder_idx" ON "media_assets"("tripId", "sortOrder");

-- CreateIndex
CREATE INDEX "media_assets_productId_sortOrder_idx" ON "media_assets"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "media_assets_guideId_sortOrder_idx" ON "media_assets"("guideId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "leads_source_createdAt_idx" ON "leads"("source", "createdAt");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "contact_messages_read_createdAt_idx" ON "contact_messages"("read", "createdAt");

-- CreateIndex
CREATE INDEX "contact_messages_tripId_idx" ON "contact_messages"("tripId");

-- AddForeignKey
ALTER TABLE "trip_activity_tags" ADD CONSTRAINT "trip_activity_tags_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_activity_tags" ADD CONSTRAINT "trip_activity_tags_activityTagId_fkey" FOREIGN KEY ("activityTagId") REFERENCES "activity_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departure_guides" ADD CONSTRAINT "departure_guides_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "departures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departure_guides" ADD CONSTRAINT "departure_guides_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departure_availability_changes" ADD CONSTRAINT "departure_availability_changes_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "departures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departure_availability_changes" ADD CONSTRAINT "departure_availability_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Constraints que o schema.prisma não expressa.
-- Escritas à mão aqui de propósito: são regras de integridade e pertencem ao
-- banco, não à aplicação. O projeto de referência deixava esse tipo de regra
-- só no código e acumulou dado inválido que ninguém detectou.
-- ============================================================================

-- SiteSetting é singleton. Sem isto, "só existe uma linha" é uma combinação
-- que o primeiro INSERT distraído quebra.
ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_singleton" CHECK ("id" = 1);

-- MediaAsset pertence a EXATAMENTE uma entidade. O CHECK elimina os dois
-- estados inválidos que as três FKs anuláveis permitiriam sozinhas: imagem
-- órfã (nenhuma dona) e imagem com duas donas.
ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_exatamente_um_dono" CHECK (
    (("tripId" IS NOT NULL)::int
     + ("productId" IS NOT NULL)::int
     + ("guideId" IS NOT NULL)::int) = 1
  );

-- Dinheiro é Int de centavos e não pode ser negativo. Barato, e fecha a porta
-- para um preço negativo entrar por um bug de formulário ou script.
ALTER TABLE "departures"
  ADD CONSTRAINT "departures_preco_nao_negativo" CHECK ("priceCents" >= 0);
ALTER TABLE "departures"
  ADD CONSTRAINT "departures_preco_de_nao_negativo" CHECK ("compareAtPriceCents" IS NULL OR "compareAtPriceCents" >= 0);
ALTER TABLE "products"
  ADD CONSTRAINT "products_preco_nao_negativo" CHECK ("priceCents" >= 0);
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_preco_nao_negativo" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

-- Uma saída não pode terminar antes de começar.
ALTER TABLE "departures"
  ADD CONSTRAINT "departures_fim_depois_do_inicio" CHECK ("endAt" IS NULL OR "endAt" >= "startAt");
