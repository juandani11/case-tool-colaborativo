import { DiagramCardData } from '../components/DiagramCard';

export type DiagramSummary = DiagramCardData;

export interface AccessRequest {
  id: string;
  diagramId: string;
  diagramName: string;
  requesterId: string;
  requesterUsername: string;
  requesterEmail?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export type AccessRole = 'VIEWER' | 'EDITOR';

export type DialogState =
  | { mode: 'create' }
  | { mode: 'rename'; diagram: DiagramSummary }
  | { mode: 'delete'; diagram: DiagramSummary }
  | { mode: 'approve'; request: AccessRequest }
  | null;
