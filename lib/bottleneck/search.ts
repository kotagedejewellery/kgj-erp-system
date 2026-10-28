import type { BottleneckItem, StageBottleneck } from "@/types/bottleneck";

function matchesBottleneckItem(item: BottleneckItem, normalizedQuery: string): boolean {
  return [
    item.order_number,
    item.customer_name,
    item.product_name,
    item.proses_produksi,
    item.proses_produksi_label,
  ].some((value) => value?.toLocaleLowerCase("id-ID").includes(normalizedQuery));
}

export function filterBottleneckStages(
  stages: StageBottleneck[],
  query: string,
): StageBottleneck[] {
  return getBottleneckSearchResult(stages, query).stages;
}

export function getBottleneckSearchResult(
  stages: StageBottleneck[],
  query: string,
): { stages: StageBottleneck[]; totalMatches: number } {
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  if (!normalizedQuery) return { stages, totalMatches: 0 };

  let totalMatches = 0;
  const matchedStages = stages.flatMap((stage) => {
    const matches = stage.orders
      .filter((item) => matchesBottleneckItem(item, normalizedQuery));
    if (matches.length === 0) return [];

    totalMatches += matches.length;
    return [{
      ...stage,
      order_count: matches.length,
      orders: matches,
    }];
  });

  return { stages: matchedStages, totalMatches };
}
