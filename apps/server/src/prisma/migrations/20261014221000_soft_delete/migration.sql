-- Deck and card deletion is now soft: rows are hidden by deletedAt instead of removed.
ALTER TABLE "decks" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "black_cards" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "white_cards" ADD COLUMN "deletedAt" TIMESTAMP(3);
