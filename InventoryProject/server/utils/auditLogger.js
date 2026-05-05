import { supabase } from "../config/supabaseClient.js";
import { getManilaISOString } from "./dateUtils.js";

/**
 * Creates an audit log entry in Supabase
 * @param {Object} params
 * @param {string} params.action - Short action name (e.g., 'CREATE_PRODUCT')
 * @param {string} params.details - Human readable description
 * @param {string} params.user_id - ID of the user who performed the action
 * @param {string} [params.entity_type] - Type of entity affected
 * @param {string} [params.entity_id] - ID of entity affected
 * @param {Object} [params.old_value] - Previous state
 * @param {Object} [params.new_value] - New state
 */
export const logAudit = async ({ 
  action, 
  details, 
  user_id, 
  entity_type, 
  entity_id, 
  old_value, 
  new_value 
}) => {
  try {
    await supabase.from("audit_logs").insert([{
      action,
      action_type: action,
      details,
      user_id,
      entity_type,
      entity_id,
      old_value,
      new_value,
      created_at: getManilaISOString()
    }]);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
};
