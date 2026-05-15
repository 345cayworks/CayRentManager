import { WorkOrderStatus } from '@prisma/client';

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPEN:        ['DISPATCHED', 'IN_PROGRESS', 'CANCELLED'],
  DISPATCHED:  ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid work order transition: ${from} → ${to}`);
  }
}
