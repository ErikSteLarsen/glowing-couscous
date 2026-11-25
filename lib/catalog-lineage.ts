import type { Session } from '@prisma/client';

export type CatalogLineage = Pick<Session, 'catalogWorkoutSlug' | 'catalogPlanSlug' | 'catalogPlanVersion'>;

export function catalogLineageOf({ catalogWorkoutSlug, catalogPlanSlug, catalogPlanVersion }: CatalogLineage): CatalogLineage {
  return { catalogWorkoutSlug, catalogPlanSlug, catalogPlanVersion };
}

export function readSnapshotCatalogLineage(snapshotJson: string): CatalogLineage | undefined {
  try {
    const { catalogLineage } = JSON.parse(snapshotJson) as { catalogLineage?: CatalogLineage };
    if (
      catalogLineage &&
      (catalogLineage.catalogWorkoutSlug === null || typeof catalogLineage.catalogWorkoutSlug === 'string') &&
      (catalogLineage.catalogPlanSlug === null || typeof catalogLineage.catalogPlanSlug === 'string') &&
      (catalogLineage.catalogPlanVersion === null || Number.isSafeInteger(catalogLineage.catalogPlanVersion))
    ) return catalogLineageOf(catalogLineage);
  } catch {
    return undefined;
  }
}
