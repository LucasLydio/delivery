ALTER TABLE "categories"
ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "categories_available_sort_order_idx"
ON "categories"("available", "sort_order");
