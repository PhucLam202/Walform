export type DashboardFormStatus = "Active" | "Draft" | "Closed";

export type DashboardForm = {
  id: string;
  title: string;
  type?: string;
  status: DashboardFormStatus;
  responses: number;
  questions?: number;
  updatedAt?: string;
  completion?: number;
};

export type DashboardSubmission = {
  id: string;
  respondentName?: string;
  respondentEmail?: string;
  respondentWallet?: string;
  formTitle: string;
  submittedAt: string;
  status: "On-chain" | "Pending" | "Failed";
  txHash?: string;
};

export type WalletActivityItem = {
  id: string;
  title: string;
  meta: string;
  amount?: string;
  time: string;
  positive?: boolean;
};

export type ChartDataPoint = {
  day: string;
  responses: number;
};
