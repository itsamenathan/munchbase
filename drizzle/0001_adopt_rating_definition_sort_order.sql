-- `rating_definitions.sort_order` is installed by the idempotent legacy
-- compatibility step because existing databases may already contain it.
-- This migration records schema adoption for Drizzle's migration history.
SELECT 1;
