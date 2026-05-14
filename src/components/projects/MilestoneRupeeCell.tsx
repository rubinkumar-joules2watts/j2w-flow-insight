import { useEffect, useState } from "react";
import type { Milestone } from "@/hooks/useData";
import { RevenueAmountInput, parseRevenueInRupees } from "@/lib/revenueDisplay";

function rupeesToDigitString(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return "";
  return String(Math.round(Number(n)));
}

export type MilestoneValueField = "value_planned_rupees" | "value_actual_rupees";

type Props = {
  milestone: Milestone;
  field: MilestoneValueField;
  placeholder?: string;
  onSave: (milestoneId: string, field: MilestoneValueField, rupees: number | null) => void | Promise<void>;
};

export function MilestoneRupeeCell({ milestone, field, placeholder, onSave }: Props) {
  const serverVal = field === "value_planned_rupees" ? milestone.value_planned_rupees : milestone.value_actual_rupees;
  const [digits, setDigits] = useState(() => rupeesToDigitString(serverVal));

  useEffect(() => {
    setDigits(rupeesToDigitString(serverVal));
  }, [milestone.id, milestone.updated_at, serverVal]);

  const handleBlur = () => {
    const parsed = parseRevenueInRupees(digits);
    const next = parsed > 0 ? Math.round(parsed) : null;
    const cur =
      serverVal != null && Number.isFinite(Number(serverVal)) && Number(serverVal) > 0
        ? Math.round(Number(serverVal))
        : null;
    if (next === cur) return;
    void onSave(milestone.id!, field, next);
  };

  return (
    <RevenueAmountInput
      value={digits}
      onChange={setDigits}
      onBlur={handleBlur}
      placeholder={placeholder}
      compact
    />
  );
}
