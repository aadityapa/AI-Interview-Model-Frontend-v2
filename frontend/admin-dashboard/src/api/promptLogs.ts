import { apiGet, authFetch } from "./client";

export interface PromptLog {
  id: string;
  template_id: string;
  template_name: string;
  candidate_id: string;
  candidate_name: string;
  candidate_role: string;
  interview_id: string;
  selected_skills: string;
  difficulty: string;
  call_type: string;
  model: string;
  system_prompt: string;
  user_prompt: string;
  final_prompt: string;
  request_payload: string;
  response_payload: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  temperature: number | null;
  max_tokens: number | null;
  response_time_ms: number;
  status: string;
  error_log: string;
  created_at: string;
  created_at_ist: string;
  created_date_ist: string;
  created_time_ist: string;
}

export interface PromptLogsResponse {
  logs: PromptLog[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface PromptLogFilters {
  call_types: string[];
  models: string[];
  statuses: string[];
  difficulties: string[];
  templates: string[];
}

export interface TokenUsageStats {
  total_summary: {
    total_calls: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    avg_response_ms: number;
    failed_calls: number;
  };
  by_call_type: { call_type: string; call_count: number; tokens: number; avg_tokens: number; avg_response_ms: number }[];
  by_model: { model: string; call_count: number; tokens: number }[];
  by_date: { date: string; call_count: number; tokens: number }[];
  most_expensive: { id: string; call_type: string; model: string; total_tokens: number; response_time_ms: number; candidate_name: string; interview_id: string; created_at_ist: string }[];
  slowest_calls: { id: string; call_type: string; model: string; total_tokens: number; response_time_ms: number; candidate_name: string; interview_id: string; created_at_ist: string }[];
}

export interface PromptLogQueryParams {
  call_type?: string;
  model?: string;
  status?: string;
  candidate_id?: string;
  interview_id?: string;
  template_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: string;
}

function buildQS(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function getPromptLogs(params: PromptLogQueryParams = {}): Promise<PromptLogsResponse> {
  const qs = buildQS(params as Record<string, string | number | undefined>);
  return apiGet<PromptLogsResponse>(`/api/prompt-logs${qs}`);
}

export async function getPromptLogById(id: string): Promise<{ log: PromptLog }> {
  return apiGet<{ log: PromptLog }>(`/api/prompt-logs/${encodeURIComponent(id)}`);
}

export async function getPromptLogFilters(): Promise<PromptLogFilters> {
  return apiGet<PromptLogFilters>("/api/prompt-logs/filters");
}

export async function getTokenUsageStats(days = 30): Promise<TokenUsageStats> {
  return apiGet<TokenUsageStats>(`/api/prompt-logs/stats?days=${days}`);
}

export async function cleanupPromptLogs(): Promise<{ status: string; file_dirs_removed: number; db_rows_removed: number }> {
  const res = await authFetch("/api/prompt-logs/cleanup", {
    method: "POST",
  });
  return res.json();
}

export async function exportPromptLogs(params: { call_type?: string; date_from?: string; date_to?: string; limit?: number } = {}): Promise<void> {
  const qs = buildQS(params as Record<string, string | number | undefined>);
  const res = await authFetch(`/api/prompt-logs/export${qs}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prompt_logs_export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
