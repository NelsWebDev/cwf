-- Decks are no longer owned; the former owner is now recorded as the creator.
-- Renaming (rather than drop/add) keeps the existing values.
ALTER TABLE "decks" RENAME COLUMN "ownerId" TO "createdById";
ALTER TABLE "decks" RENAME CONSTRAINT "decks_ownerId_fkey" TO "decks_createdById_fkey";
