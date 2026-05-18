/**
 * Pure plan/unit rules and subscription period math. No I/O, no Prisma.
 * Safe to unit-test in isolation.
 */

export type PlanLike = {
  id: string;
  code: string;
  amount: unknown;
  minUnits: number | null;
  maxUnits: number | null;
  status?: string;
};

/**
 * True if the plan's [minUnits, maxUnits] range contains unitCount.
 * - maxUnits null means open-ended (no upper bound).
 * - minUnits null is treated as a lower bound of 1.
 * - A plan with both bounds null matches any unitCount >= 1.
 * - unitCount must be a positive integer; 0 or negative never matches.
 */
export function planMatchesUnitCount(plan: PlanLike, unitCount: number): boolean {
  if (!Number.isFinite(unitCount) || unitCount < 1) return false;
  const min = plan.minUnits ?? 1;
  if (unitCount < min) return false;
  if (plan.maxUnits !== null && plan.maxUnits !== undefined && unitCount > plan.maxUnits) {
    return false;
  }
  return true;
}

/**
 * The plan whose [minUnits, maxUnits] range contains unitCount.
 * Only ACTIVE plans are considered when a status is present.
 * When multiple plans match (ranges should be non-overlapping in
 * practice), the one with the lowest minUnits wins for determinism.
 * Returns null when no plan matches (including unitCount < 1).
 */
export function recommendPlanForUnits(unitCount: number, plans: PlanLike[]): PlanLike | null {
  if (!Number.isFinite(unitCount) || unitCount < 1) return null;
  const candidates = plans
    .filter((p) => p.status === undefined || p.status === 'ACTIVE')
    .filter((p) => planMatchesUnitCount(p, unitCount))
    .sort((a, b) => (a.minUnits ?? 1) - (b.minUnits ?? 1));
  return candidates[0] ?? null;
}

/**
 * Compute the renewed subscription period end.
 * - If currentPeriodEnd is still in the future, extend from currentPeriodEnd.
 * - Otherwise (expired/equal), extend from now.
 * Real month math with year/month-length rollover, computed in UTC.
 */
export function computeRenewedPeriodEnd(
  currentPeriodEnd: Date,
  intervalMonths: number,
  now: Date,
): Date {
  const months = Number.isFinite(intervalMonths) && intervalMonths > 0 ? Math.floor(intervalMonths) : 1;
  const base = currentPeriodEnd > now ? currentPeriodEnd : now;
  return addMonthsUtc(base, months);
}

function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetMonthIndex = m + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  // Clamp the day to the last day of the target month (e.g. Jan 31 -> Feb 28/29).
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}
