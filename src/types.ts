export type Status = "in_stock" | "reserved" | "sold" | "written_off";

export type HistoryEntry = {
  from: Status;
  to: Status;
  at: Date;
};

export type Laptop = {
  id: string;
  status: Status;
  soldAt?: Date;
  history: HistoryEntry[];
};
