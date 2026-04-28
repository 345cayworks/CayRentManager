export const ROLES = ['superadmin', 'landlord', 'property_manager', 'accountant', 'tenant'] as const;
export type AppRole = (typeof ROLES)[number];
