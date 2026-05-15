import { describe, expect, it } from 'vitest';
import { WorkOrderStatus } from '@prisma/client';
import { assertTransition, canTransition } from '@/lib/maintenance/workorder';

describe('work order transitions', () => {
  describe('canTransition', () => {
    it('allows OPEN → DISPATCHED', () => {
      expect(canTransition(WorkOrderStatus.OPEN, WorkOrderStatus.DISPATCHED)).toBe(true);
    });

    it('allows DISPATCHED → IN_PROGRESS', () => {
      expect(canTransition(WorkOrderStatus.DISPATCHED, WorkOrderStatus.IN_PROGRESS)).toBe(true);
    });

    it('allows IN_PROGRESS → COMPLETED', () => {
      expect(canTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED)).toBe(true);
    });

    it('allows OPEN → CANCELLED', () => {
      expect(canTransition(WorkOrderStatus.OPEN, WorkOrderStatus.CANCELLED)).toBe(true);
    });

    it('rejects COMPLETED → anything', () => {
      expect(canTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.OPEN)).toBe(false);
      expect(canTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.IN_PROGRESS)).toBe(false);
      expect(canTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects CANCELLED → anything', () => {
      expect(canTransition(WorkOrderStatus.CANCELLED, WorkOrderStatus.OPEN)).toBe(false);
      expect(canTransition(WorkOrderStatus.CANCELLED, WorkOrderStatus.IN_PROGRESS)).toBe(false);
      expect(canTransition(WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED)).toBe(false);
    });

    it('rejects IN_PROGRESS → OPEN', () => {
      expect(canTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.OPEN)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('throws on an invalid transition', () => {
      expect(() => assertTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.OPEN)).toThrow(
        /Invalid work order transition/,
      );
    });

    it('does not throw on a valid transition', () => {
      expect(() => assertTransition(WorkOrderStatus.OPEN, WorkOrderStatus.DISPATCHED)).not.toThrow();
    });
  });
});
