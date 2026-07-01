export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type SubcategorySummary = CategorySummary & {
  categoryId: string;
};

export type ManufacturerSummary = {
  id: string;
  name: string;
  slug: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
};
