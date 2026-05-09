'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { LeaseStatus, MaintenanceStatus, PaymentStatus, RecordStatus, UserRole, UserStatus } from '@prisma/client';
import { signIn, signOut } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { requireLandlordAccess, getCurrentLandlordWorkspace, requireSuperadmin } from '@/lib/auth/guards';
import { registerPublicLandlord } from '@/lib/services/registration';
import { acceptTenantInvitation, createTenantInvitation } from '@/lib/services/invitations';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function money(formData: FormData, key: string, fallback = '0') {
  const value = text(formData, key);
  return value === '' ? fallback : value;
}

async function audit(actorUserId: string, actorEmail: string, action: string, entityType: string, entityId: string, landlordId?: string, details = {}) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

export async function registerLandlordAction(formData: FormData) {
  const result = await registerPublicLandlord({
    email: text(formData, 'email'),
    fullName: text(formData, 'fullName'),
    companyName: text(formData, 'companyName'),
    displayName: text(formData, 'displayName'),
  });
  await audit(result.user.id, result.user.email!, 'landlord.registered', 'LandlordProfile', result.landlord.id, result.landlord.id);
  redirect('/login?registered=landlord');
}

export async function createPropertyAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const property = await prisma.property.create({
    data: {
      landlordId,
      name: text(formData, 'name'),
      address: text(formData, 'address'),
      city: text(formData, 'city'),
      state: text(formData, 'state'),
      country: text(formData, 'country') || 'US',
      propertyType: text(formData, 'propertyType') || 'Residential',
    },
  });
  await audit(user.userId, user.email, 'property.created', 'Property', property.id, landlordId);
  revalidatePath('/properties');
  revalidatePath('/dashboard');
}

export async function createUnitAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = text(formData, 'propertyId');
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId, status: RecordStatus.ACTIVE } });
  if (!property) throw new Error('Property not found for this workspace.');

  const unit = await prisma.unit.create({
    data: {
      landlordId,
      propertyId,
      unitName: text(formData, 'unitName'),
      bedrooms: Number(text(formData, 'bedrooms') || 0),
      bathrooms: money(formData, 'bathrooms'),
      rentAmount: money(formData, 'rentAmount'),
      depositAmount: money(formData, 'depositAmount'),
    },
  });
  await audit(user.userId, user.email, 'unit.created', 'Unit', unit.id, landlordId);
  revalidatePath('/units');
  revalidatePath('/dashboard');
}

export async function inviteTenantAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = text(formData, 'propertyId') || undefined;
  const unitId = text(formData, 'unitId') || undefined;

  if (propertyId) await requireLandlordAccess(landlordId);
  if (unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: unitId, landlordId } });
    if (!unit) throw new Error('Unit not found for this workspace.');
  }

  const invitation = await createTenantInvitation(landlordId, text(formData, 'email'), propertyId, unitId);
  await audit(user.userId, user.email, 'tenant.invited', 'TenantInvitation', invitation.id, landlordId, { email: invitation.email });
  revalidatePath('/tenants');
}

export async function acceptTenantInviteAction(token: string, formData: FormData) {
  const result = await acceptTenantInvitation(token, text(formData, 'email'), text(formData, 'fullName'));
  await audit(result.user.id, result.user.email!, 'tenant.invite_accepted', 'Tenant', result.tenant.id, result.tenant.landlordId);
  redirect('/tenant/dashboard');
}

export async function createLeaseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const tenantId = text(formData, 'tenantId');
  const unitId = text(formData, 'unitId');
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, landlordId, status: RecordStatus.ACTIVE } });
  const unit = await prisma.unit.findFirst({ where: { id: unitId, landlordId, status: RecordStatus.ACTIVE } });
  if (!tenant || !unit) throw new Error('Tenant or unit not found for this workspace.');

  const lease = await prisma.lease.create({
    data: {
      landlordId,
      propertyId: unit.propertyId,
      unitId,
      tenantId,
      startDate: new Date(text(formData, 'startDate')),
      endDate: new Date(text(formData, 'endDate')),
      rentAmount: money(formData, 'rentAmount', unit.rentAmount.toString()),
      depositAmount: money(formData, 'depositAmount'),
      status: LeaseStatus.ACTIVE,
    },
  });
  await audit(user.userId, user.email, 'lease.created', 'Lease', lease.id, landlordId);
  revalidatePath('/leases');
  revalidatePath('/dashboard');
}

export async function recordPaymentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = text(formData, 'leaseId');
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, landlordId }, include: { tenant: true, unit: true } });
  if (!lease) throw new Error('Lease not found for this workspace.');

  const amountDue = Number(money(formData, 'amountDue', lease.rentAmount.toString()));
  const amountPaid = Number(money(formData, 'amountPaid'));
  const payment = await prisma.payment.create({
    data: {
      landlordId,
      tenantId: lease.tenantId,
      leaseId,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      dueDate: new Date(text(formData, 'dueDate')),
      paymentDate: text(formData, 'paymentDate') ? new Date(text(formData, 'paymentDate')) : null,
      amountDue,
      amountPaid,
      balance: Math.max(amountDue - amountPaid, 0),
      paymentMethod: text(formData, 'paymentMethod') || null,
      status: amountPaid >= amountDue ? PaymentStatus.PAID : amountPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING,
      notes: text(formData, 'notes') || null,
    },
  });
  await audit(user.userId, user.email, 'payment.recorded', 'Payment', payment.id, landlordId);
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function recordExpenseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = text(formData, 'propertyId');
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId } });
  if (!property) throw new Error('Property not found for this workspace.');

  const expense = await prisma.expense.create({
    data: {
      landlordId,
      propertyId,
      unitId: text(formData, 'unitId') || null,
      category: text(formData, 'category'),
      vendor: text(formData, 'vendor') || null,
      amount: money(formData, 'amount'),
      expenseDate: new Date(text(formData, 'expenseDate')),
      description: text(formData, 'description') || null,
      createdBy: user.userId,
      status: RecordStatus.ACTIVE,
    },
  });
  await audit(user.userId, user.email, 'expense.recorded', 'Expense', expense.id, landlordId);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function disableUserAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const userId = text(formData, 'userId');
  if (userId === actor.userId) throw new Error('You cannot disable your own account.');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.DISABLED, disabledAt: new Date(), disabledBy: actor.userId },
  });
  await audit(actor.userId, actor.email, 'user.disabled', 'User', user.id, undefined, { targetEmail: user.email });
  revalidatePath('/admin/users');
}

export async function reactivateUserAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const user = await prisma.user.update({
    where: { id: text(formData, 'userId') },
    data: { status: UserStatus.ACTIVE, disabledAt: null, disabledBy: null, disabledReason: null },
  });
  await audit(actor.userId, actor.email, 'user.reactivated', 'User', user.id, undefined, { targetEmail: user.email });
  revalidatePath('/admin/users');
}

export async function archiveLandlordAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const landlord = await prisma.landlordProfile.update({
    where: { id: text(formData, 'landlordId') },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: actor.userId },
  });
  await audit(actor.userId, actor.email, 'landlord.archived', 'LandlordProfile', landlord.id, landlord.id);
  revalidatePath('/admin/landlords');
}

export async function reactivateLandlordAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const landlord = await prisma.landlordProfile.update({
    where: { id: text(formData, 'landlordId') },
    data: { status: RecordStatus.ACTIVE, archivedAt: null, archivedBy: null },
  });
  await audit(actor.userId, actor.email, 'landlord.reactivated', 'LandlordProfile', landlord.id, landlord.id);
  revalidatePath('/admin/landlords');
}

export async function archivePropertyAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const property = await prisma.property.update({
    where: { id: text(formData, 'propertyId'), landlordId },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  await audit(user.userId, user.email, 'property.archived', 'Property', property.id, landlordId);
  revalidatePath('/properties');
  revalidatePath('/dashboard');
}

export async function archiveUnitAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const unit = await prisma.unit.update({
    where: { id: text(formData, 'unitId'), landlordId },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  await audit(user.userId, user.email, 'unit.archived', 'Unit', unit.id, landlordId);
  revalidatePath('/units');
  revalidatePath('/dashboard');
}

export async function deactivateTenantAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const tenant = await prisma.tenant.update({
    where: { id: text(formData, 'tenantId'), landlordId },
    data: { status: RecordStatus.INACTIVE, deactivatedAt: new Date(), deactivatedBy: user.userId },
  });
  await audit(user.userId, user.email, 'tenant.deactivated', 'Tenant', tenant.id, landlordId);
  revalidatePath('/tenants');
  revalidatePath('/dashboard');
}

export async function terminateLeaseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const lease = await prisma.lease.update({
    where: { id: text(formData, 'leaseId'), landlordId },
    data: { status: LeaseStatus.TERMINATED, terminatedAt: new Date(), terminatedBy: user.userId },
  });
  await audit(user.userId, user.email, 'lease.terminated', 'Lease', lease.id, landlordId);
  revalidatePath('/leases');
  revalidatePath('/dashboard');
}

export async function expireLeaseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const lease = await prisma.lease.update({
    where: { id: text(formData, 'leaseId'), landlordId },
    data: { status: LeaseStatus.EXPIRED },
  });
  await audit(user.userId, user.email, 'lease.expired', 'Lease', lease.id, landlordId);
  revalidatePath('/leases');
  revalidatePath('/dashboard');
}

export async function voidPaymentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const payment = await prisma.payment.update({
    where: { id: text(formData, 'paymentId'), landlordId },
    data: { status: PaymentStatus.VOID, voidedAt: new Date(), voidedBy: user.userId },
  });
  await audit(user.userId, user.email, 'payment.voided', 'Payment', payment.id, landlordId);
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function voidExpenseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const expense = await prisma.expense.update({
    where: { id: text(formData, 'expenseId'), landlordId },
    data: { status: RecordStatus.VOID, voidedAt: new Date(), voidedBy: user.userId },
  });
  await audit(user.userId, user.email, 'expense.voided', 'Expense', expense.id, landlordId);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function archiveDocumentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const document = await prisma.document.update({
    where: { id: text(formData, 'documentId'), landlordId },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  await audit(user.userId, user.email, 'document.archived', 'Document', document.id, landlordId);
  revalidatePath('/documents');
}

export async function closeMaintenanceAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const request = await prisma.maintenanceRequest.update({
    where: { id: text(formData, 'maintenanceId'), landlordId },
    data: { status: MaintenanceStatus.CLOSED },
  });
  await audit(user.userId, user.email, 'maintenance.closed', 'MaintenanceRequest', request.id, landlordId);
  revalidatePath('/maintenance');
  revalidatePath('/dashboard');
}

export async function archiveMaintenanceAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const request = await prisma.maintenanceRequest.update({
    where: { id: text(formData, 'maintenanceId'), landlordId },
    data: { status: MaintenanceStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  await audit(user.userId, user.email, 'maintenance.archived', 'MaintenanceRequest', request.id, landlordId);
  revalidatePath('/maintenance');
  revalidatePath('/dashboard');
}

export async function ensureSuperadminAction() {
  await requireSuperadmin();
}

export async function signInWithGoogleAction() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    redirect('/login?error=google-not-configured');
  }

  await signIn('google', { redirectTo: '/dashboard' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
