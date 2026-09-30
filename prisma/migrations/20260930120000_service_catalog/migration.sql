CREATE TYPE "CatalogItemType" AS ENUM ('SOFTWARE', 'SERVICE');
ALTER TABLE "SoftwareItem" ADD COLUMN "catalogType" "CatalogItemType" NOT NULL DEFAULT 'SOFTWARE';
