export interface Campaign {
  name: string;
  raised: number;
  goal: number;
}

export interface MonthPoint {
  month: string;
  amount: number;
}

export interface Donor {
  name: string;
  amount: number;
}

export interface FundraisingSnapshot {
  totalRaisedYTD: number;
  annualGoal: number;
  donorCount: number;
  monthlyDonorCount: number;
  averageGift: number;
  raisedThisMonth: number;
  raisedLastMonth: number;
  lastSynced: string;
  isLive: boolean;
  fiscalYearLabel: string;
  topCampaigns: Campaign[];
  topDonorsGeneralCash: Donor[];
  topDonorsGiftInKind: Donor[];
  monthlyTrend: MonthPoint[];
}
