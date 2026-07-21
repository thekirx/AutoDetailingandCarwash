import { supabase } from './supabase'

/** Write an audit row via security-definer RPC (actor = auth.uid()). Soft-fail so CRUD still works if migration not applied yet. */
export async function writeAudit({ action, entityType, entityId = null, summary, meta = {} }) {
  const { error } = await supabase.rpc('write_audit_event', {
    input_action: action,
    input_entity_type: entityType,
    input_entity_id: entityId == null ? null : String(entityId),
    input_summary: summary,
    input_meta: meta,
  })
  if (error) {
    // ponytail: audit must not block ops if migration pending — ceiling: silent miss until SQL applied
    console.warn('audit write skipped:', error.message)
  }
}

export async function listAuditLogs({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, actor_id, actor_role, action, entity_type, entity_id, summary, meta')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
