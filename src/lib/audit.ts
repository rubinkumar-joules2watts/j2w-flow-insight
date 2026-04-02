import { supabase } from "@/integrations/supabase/client";

export const writeAuditLog = async (
  tableName: string,
  recordId: string,
  action: "INSERT" | "UPDATE" | "DELETE",
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
  changedFields?: string[]
) => {
  await supabase.from("audit_log").insert({
    table_name: tableName,
    record_id: recordId,
    action,
    changed_by: "system",
    old_values: oldValues as any,
    new_values: newValues as any,
    changed_fields: changedFields as any,
  });
};
