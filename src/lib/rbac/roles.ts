export const ROLES = ['SUPERADMIN', 'LANDLORD', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'TENANT'] as const;
export type AppRole = (typeof ROLES)[number];
