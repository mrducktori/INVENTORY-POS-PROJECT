import { logAudit as logAuditUnified } from "./auditHelper.js";

/**
 * Creates an audit log entry in Supabase using the unified audit helper.
 * Supports both object and positional arguments.
 */
export const logAudit = async (paramsOrAction, userId, details) => {
  return logAuditUnified(paramsOrAction, userId, details);
};
