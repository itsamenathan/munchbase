-- Schema adoption marker only. Existing Munchbase installations may already have
-- sort_order from the historical runtime repair. The versioned compatibility
-- migration reconciles both shapes without overwriting saved ordering.
SELECT 1;
