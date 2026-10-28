export interface WorkshopPulseStage {
  current_stage: string | null;
  updated_at: string | null;
  order: {
    deleted_at: string | null;
    tgl_selesai: string | null;
  } | null;
}

interface CalculateWorkshopPulseInput {
  today: string;
  todayStart: string;
  ordersReceived: number;
  reworksLogged: number;
  activeUserIds: Array<string | null>;
  stages: WorkshopPulseStage[];
}

export function calculateWorkshopPulse({
  today,
  todayStart,
  ordersReceived,
  reworksLogged,
  activeUserIds,
  stages,
}: CalculateWorkshopPulseInput) {
  const activeStages = stages.filter((stage) => !stage.order?.deleted_at);
  const inProgressStages = activeStages.filter(
    (stage) => stage.current_stage !== "selesai",
  );

  return {
    today: {
      ordersReceived,
      ordersCompleted: activeStages.filter(
        (stage) =>
          stage.current_stage === "selesai" &&
          Boolean(stage.updated_at && stage.updated_at >= todayStart),
      ).length,
      reworksLogged,
      activeUsers: new Set(
        activeUserIds.filter((userId): userId is string => Boolean(userId)),
      ).size,
    },
    workInProgress: {
      activeOrders: inProgressStages.length,
      overdueOrders: inProgressStages.filter(
        (stage) => Boolean(stage.order?.tgl_selesai && stage.order.tgl_selesai < today),
      ).length,
    },
    afterProduction: {
      customerCare: activeStages.filter(
        (stage) => stage.current_stage === "konfirmasi",
      ).length,
      packing: activeStages.filter((stage) => stage.current_stage === "packing")
        .length,
      shipping: activeStages.filter(
        (stage) => stage.current_stage === "pengiriman",
      ).length,
    },
  };
}
