export interface Project {
  id: string;
  name: string;
  idea: string;
  status: string;
  output_path: string | null;
  created_at: string;
}

export interface ProjectLog {
  id: number;
  project_id: string;
  agent: string;
  message: string;
  type: 'info' | 'file' | 'error';
  created_at: string;
}

export interface LogEntry {
  projectId: string;
  agent: string;
  message: string;
  type: 'info' | 'file' | 'error';
  timestamp: string;
}

export type AgentPhaseState = 'idle' | 'active' | 'done';

export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}

export interface ProjectInfo {
  type: 'nextjs' | 'vite' | 'express' | 'unknown';
  port: number;
  framework: string;
  portFlag: boolean;
  portEnv: string;
}

export interface BattlePlan {
  projectName: string;
  stack: {
    frontend: string;
    backend: string;
    database: string;
    styling: string;
  };
  phases: BattlePlanPhase[];
}

export interface BattlePlanPhase {
  phase: string;
  agent: string;
  deliverables: string[];
}

export interface MissionRequest {
  idea: string;
}

export interface SettingsMap {
  [key: string]: string;
}
