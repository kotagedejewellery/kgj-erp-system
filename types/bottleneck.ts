// types/bottleneck.ts

export interface BottleneckItem {
  order_id: string;
  order_number: string;
  product_name?: string;
  customer_name: string | null;
  hours_waiting: number | null;
  status: string;
  current_stage: string;
  deadline: string | null;
  tgl_order?: string | null;
  last_worker: string | null;
  last_submission?: string | null;
  proses_produksi?: string | null;
  proses_produksi_label?: string | null;
  approval_decision: string | null;
  approved_by: string | null;
  approved_at?: string | null;
}

export interface StageBottleneck {
  stage: string;
  stage_label: string;
  stage_group: string;
  order_count: number;
  waiting_orders: number;
  in_progress_orders: number;
  avg_hours: number | null;
  longest_hours: number | null;
  orders: BottleneckItem[];
}

export type BottleneckStageSummary = Omit<StageBottleneck, "orders">;

export interface BottleneckData {
  bottlenecks: StageBottleneck[];
  summary: {
    total_stages_with_orders: number;
    total_orders: number;
    busiest_stage: BottleneckStageSummary | null;
    slowest_stage: BottleneckStageSummary | null;
  };
}
