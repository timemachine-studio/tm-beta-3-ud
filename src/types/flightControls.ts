export type FlightControlKind = 'skill' | 'mcp';

export interface FlightControlCatalogItem {
  id: string;
  kind: FlightControlKind;
  slug: string;
  name: string;
  description: string;
  icon_name: string;
  default_enabled: boolean;
  sort_order: number;
  mcp_allowed_tools: string[];
  mcp_auto_approve_tools: string[];
}

export interface EffectiveFlightControl extends FlightControlCatalogItem {
  enabled: boolean;
}

export interface McpApprovalRequest {
  runId: string;
  serverName: string;
  toolName: string;
  argumentPreview: Record<string, unknown>;
  expiresAt: string;
  status?: 'pending' | 'approved' | 'denied' | 'expired' | 'failed';
  error?: string;
}

export type McpApprovalDecision = 'approve' | 'deny';
