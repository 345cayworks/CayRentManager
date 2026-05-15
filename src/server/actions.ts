'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { LeaseStatus, MaintenanceCategory, MaintenancePriority, MaintenanceStatus, PaymentMethodType, PaymentStatus, RecordStatus, UserRole, UserStatus, WorkOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentLandlordWorkspace, requireAuthAllowPasswordChange, requireRole, requireSuperadmin, requireVendorUser } from '@/lib/auth/guards';
import { requireOwnedLease, requireOwnedProperty, requireOwnedTenant, requireOwnedUnit } from '@/lib/auth/ownership';
import { computeSlaDueAt } from '@/lib/maintenance/sla';
import { assertTransition } from '@/lib/maintenance/workorder';
import { createInvoiceForLease, applyPaymentToInvoice, generateReceiptForPayment } from '@/lib/payments/invoices';
import { registerPublicLandlord } from '@/lib/services/registration';
import { acceptTenantInvitation, createTenantInvitation } from '@/lib/services/invitations';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import { calculatePaymentBalance, calculatePaymentStatus, validatePaymentDates } from '@/lib/validation/payments';
import { isSupportedCurrency, isSupportedTimezone } from '@/lib/time/format';
import { setPlatformSetting } from '@/lib/settings/platform';

const operationalRoles: UserRole[] = [
  UserRole.VENDOR,
  UserRole.MAINTENANCE_PROVIDER,
  UserRole.CONCIERGE_AGENT,
  UserRole.GUEST,
];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function money(formData: FormData, key: string, fallback = '0') {
  const value = text(formData, key);
  return value === '' ? fallback : value;
}

function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function positiveNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number.`);
  return parsed;
}

function nonNegativeNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} cannot be negative.`);
  return parsed;
}

async function audit(actorUserId: string, actorEmail: string, action: string, entityType: string, entityId: string, landlordId?: string, details = {}) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

function assertSingleWorkspaceUpdate(result: { count: number }) {
  if (result.count !== 1) throw new Error('Record not found for this workspace.');
}

function maskAccountNumber(accountNumber: string) {
  const clean = accountNumber.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function validEnumValue<T extends Record<string, string>>(enumObject: T, value: string, label: string) {
  if (!Object.values(enumObject).includes(value)) throw new Error(`Invalid ${label}.`);
  return value as T[keyof T];
}

export async function registerLandlordAction(formData: FormData) {
  const result = await registerPublicLandlord({
    email: requiredText(formData, 'email'),
    fullName: requiredText(formData, 'fullName'),
    companyName: requiredText(formData, 'companyName'),
    displayName: requiredText(formData, 'displayName'),
  });
  await audit(result.user.id, result.user.email!, 'landlord.registered', 'LandlordProfile', result.landlord.id, result.landlord.id);
  redirect('/login?registered=landlord');
}

export async function updateCompanyProfileAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const displayName = requiredText(formData, 'displayName');
  const companyName = requiredText(formData, 'companyName');

  await prisma.landlordProfile.update({
    where: { id: landlordId },
    data: {
      displayName,
      companyName,
      email: text(formData, 'email') || null,
      phone: text(formData, 'phone') || null,
      website: text(formData, 'website') || null,
      addressLine1: text(formData, 'addressLine1') || null,
      addressLine2: text(formData, 'addressLine2') || null,
      city: text(formData, 'city') || null,
      country: text(formData, 'country') || 'KY',
      currency: text(formData, 'currency') || 'KYD',
      timezone: text(formData, 'timezone') || 'America/Cayman',
      tagline: text(formData, 'tagline') || null,
      logoUrl: text(formData, 'logoUrl') || null,
      companyProfileCompletedAt: new Date(),
    },
  });
  await audit(user.userId, user.email, 'landlord.profile_updated', 'LandlordProfile', landlordId, landlordId);
  revalidatePath('/onboarding');
  revalidatePath('/onboarding/company-profile');
  revalidatePath('/dashboard');
  revalidatePath('/account/profile');
}

export async function markOnboardingCompleteAction() {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  await prisma.landlordProfile.update({
    where: { id: landlordId },
    data: {
      onboardingCompletedAt: new Date(),
      onboardingCompletedBy: user.userId,
      onboardingDismissedAt: null,
      onboardingDismissedBy: null,
    },
  });
  await audit(user.userId, user.email, 'onboarding.completed', 'LandlordProfile', landlordId, landlordId);
  revalidatePath('/onboarding');
  revalidatePath('/dashboard');
}

export async function dismissOnboardingAction() {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  await prisma.landlordProfile.update({
    where: { id: landlordId },
    data: {
      onboardingDismissedAt: new Date(),
      onboardingDismissedBy: user.userId,
    },
  });
  await audit(user.userId, user.email, 'onboarding.dismissed', 'LandlordProfile', landlordId, landlordId);
  revalidatePath('/onboarding');
  revalidatePath('/dashboard');
}

export async function restoreOnboardingAction() {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  await prisma.landlordProfile.update({
    where: { id: landlordId },
    data: {
      onboardingDismissedAt: null,
      onboardingDismissedBy: null,
      onboardingCompletedAt: null,
      onboardingCompletedBy: null,
    },
  });
  await audit(user.userId, user.email, 'onboarding.restored', 'LandlordProfile', landlordId, landlordId);
  revalidatePath('/onboarding');
  revalidatePath('/dashboard');
}

export async function createPropertyGuidedAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const purchasePriceInput = text(formData, 'purchasePrice');
  const estimatedValueInput = text(formData, 'estimatedValue');
  const property = await prisma.property.create({
    data: {
      landlordId,
      name: requiredText(formData, 'name'),
      address: requiredText(formData, 'address'),
      city: requiredText(formData, 'city'),
      state: requiredText(formData, 'state'),
      country: text(formData, 'country') || 'KY',
      propertyType: text(formData, 'propertyType') || 'Residential',
      purchasePrice: purchasePriceInput ? positiveNumber(purchasePriceInput, 'Purchase price') : null,
      estimatedValue: estimatedValueInput ? positiveNumber(estimatedValueInput, 'Estimated value') : null,
    },
  });
  await audit(user.userId, user.email, 'property.created', 'Property', property.id, landlordId, { source: 'onboarding_wizard' });
  revalidatePath('/properties');
  revalidatePath('/dashboard');
  revalidatePath('/onboarding');

  const next = text(formData, 'nextStep');
  if (next === 'units') redirect(`/units/new?propertyId=${property.id}`);
  if (next === 'onboarding') redirect('/onboarding');
  redirect(`/properties/${property.id}`);
}

export async function createUnitGuidedAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = requiredText(formData, 'propertyId');
  await requireOwnedProperty(landlordId, propertyId);

  const bedroomsInput = text(formData, 'bedrooms');
  const bathroomsInput = text(formData, 'bathrooms');
  const squareFeetInput = text(formData, 'squareFeet');
  const depositInput = text(formData, 'depositAmount');

  const unit = await prisma.unit.create({
    data: {
      landlordId,
      propertyId,
      unitName: requiredText(formData, 'unitName'),
      bedrooms: bedroomsInput ? Number(bedroomsInput) : null,
      bathrooms: bathroomsInput ? bathroomsInput : null,
      squareFeet: squareFeetInput ? Number(squareFeetInput) : null,
      rentAmount: positiveNumber(money(formData, 'rentAmount'), 'Rent amount'),
      depositAmount: depositInput ? depositInput : null,
    },
  });
  await audit(user.userId, user.email, 'unit.created', 'Unit', unit.id, landlordId, { source: 'onboarding_wizard' });
  revalidatePath('/units');
  revalidatePath('/dashboard');
  revalidatePath('/onboarding');

  const next = text(formData, 'nextStep');
  if (next === 'tenants') redirect('/tenants/new');
  if (next === 'onboarding') redirect('/onboarding');
  redirect(`/units/${unit.id}`);
}

export async function createTenantGuidedAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const mode = text(formData, 'mode') || 'invite';
  const propertyId = text(formData, 'propertyId') || undefined;
  const unitId = text(formData, 'unitId') || undefined;
  if (propertyId) await requireOwnedProperty(landlordId, propertyId);
  if (unitId) await requireOwnedUnit(landlordId, unitId);

  if (mode === 'manual') {
    const fullName = requiredText(formData, 'fullName');
    const email = requiredText(formData, 'email').toLowerCase();
    const tenant = await prisma.tenant.create({
      data: {
        landlordId,
        fullName,
        email,
        phone: text(formData, 'phone') || null,
        employer: text(formData, 'employer') || null,
        emergencyContactName: text(formData, 'emergencyContactName') || null,
        emergencyContactPhone: text(formData, 'emergencyContactPhone') || null,
      },
    });
    await audit(user.userId, user.email, 'tenant.created', 'Tenant', tenant.id, landlordId, { source: 'onboarding_wizard' });
    revalidatePath('/tenants');
    revalidatePath('/dashboard');
    revalidatePath('/onboarding');
    const next = text(formData, 'nextStep');
    if (next === 'onboarding') redirect('/onboarding');
    redirect(`/tenants/${tenant.id}`);
  }

  // mode === 'invite'
  const email = requiredText(formData, 'email');
  const invitation = await createTenantInvitation(landlordId, email, propertyId, unitId);
  await audit(user.userId, user.email, 'tenant.invited', 'TenantInvitation', invitation.id, landlordId, { email: invitation.email, source: 'onboarding_wizard' });
  revalidatePath('/tenants');
  revalidatePath('/onboarding');
  const next = text(formData, 'nextStep');
  if (next === 'onboarding') redirect('/onboarding');
  redirect('/tenants');
}

export async function createPropertyAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const property = await prisma.property.create({
    data: {
      landlordId,
      name: requiredText(formData, 'name'),
      address: requiredText(formData, 'address'),
      city: requiredText(formData, 'city'),
      state: requiredText(formData, 'state'),
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
  const propertyId = requiredText(formData, 'propertyId');
  await requireOwnedProperty(landlordId, propertyId);

  const unit = await prisma.unit.create({
    data: {
      landlordId,
      propertyId,
      unitName: requiredText(formData, 'unitName'),
      bedrooms: Number(text(formData, 'bedrooms') || 0),
      bathrooms: money(formData, 'bathrooms'),
      rentAmount: positiveNumber(money(formData, 'rentAmount'), 'Rent amount'),
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

  if (propertyId) await requireOwnedProperty(landlordId, propertyId);
  if (unitId) await requireOwnedUnit(landlordId, unitId);

  const invitation = await createTenantInvitation(landlordId, requiredText(formData, 'email'), propertyId, unitId);
  await audit(user.userId, user.email, 'tenant.invited', 'TenantInvitation', invitation.id, landlordId, { email: invitation.email });
  revalidatePath('/tenants');
}

export async function acceptTenantInviteAction(token: string, formData: FormData) {
  const result = await acceptTenantInvitation(token, requiredText(formData, 'email'), requiredText(formData, 'fullName'));
  await audit(result.user.id, result.user.email!, 'tenant.invite_accepted', 'Tenant', result.tenant.id, result.tenant.landlordId);
  redirect('/tenant/dashboard');
}

export async function createLeaseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const tenantId = requiredText(formData, 'tenantId');
  const unitId = requiredText(formData, 'unitId');
  const tenant = await requireOwnedTenant(landlordId, tenantId);
  const unit = await requireOwnedUnit(landlordId, unitId);

  const startDate = new Date(requiredText(formData, 'startDate'));
  const endDate = new Date(requiredText(formData, 'endDate'));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) throw new Error('Lease dates are invalid.');
  if (endDate <= startDate) throw new Error('Lease end date must be after start date.');

  const lease = await prisma.lease.create({
    data: {
      landlordId,
      propertyId: unit.propertyId,
      unitId,
      tenantId: tenant.id,
      startDate,
      endDate,
      rentAmount: positiveNumber(money(formData, 'rentAmount', unit.rentAmount.toString()), 'Rent amount'),
      depositAmount: money(formData, 'depositAmount'),
      status: LeaseStatus.ACTIVE,
    },
  });
  await audit(user.userId, user.email, 'lease.created', 'Lease', lease.id, landlordId);
  revalidatePath('/leases');
  revalidatePath('/dashboard');
}

export async function createTenantMaintenanceRequestAction(formData: FormData) {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? { id: requiredText(formData, 'tenantId') } : { userId: user.userId },
    include: { leases: { where: { status: LeaseStatus.ACTIVE }, orderBy: { createdAt: 'desc' } } },
  });
  if (!tenant) throw new Error('Tenant profile not found.');

  const lease = tenant.leases[0];
  const propertyId = text(formData, 'propertyId') || lease?.propertyId;
  const unitId = text(formData, 'unitId') || lease?.unitId || null;
  if (!propertyId) throw new Error('A property is required for maintenance requests.');

  const category = validEnumValue(MaintenanceCategory, text(formData, 'category') || MaintenanceCategory.GENERAL, 'maintenance category');
  const priority = validEnumValue(MaintenancePriority, text(formData, 'priority') || MaintenancePriority.MEDIUM, 'maintenance priority');

  const request = await prisma.maintenanceRequest.create({
    data: {
      landlordId: tenant.landlordId,
      tenantId: tenant.id,
      propertyId,
      unitId,
      title: requiredText(formData, 'title'),
      description: requiredText(formData, 'description'),
      category,
      priority,
      permissionToEnter: text(formData, 'permissionToEnter') === 'on',
      preferredContactTime: text(formData, 'preferredContactTime') || null,
      photoUrl: text(formData, 'photoUrl') || null,
      slaDueAt: computeSlaDueAt(priority),
    },
  });

  const attachmentUrl = text(formData, 'attachmentUrl');
  if (attachmentUrl) {
    await prisma.maintenanceAttachment.create({
      data: {
        maintenanceRequestId: request.id,
        fileUrl: attachmentUrl,
        fileType: text(formData, 'attachmentType') || null,
      },
    });
  }

  await audit(user.userId, user.email, 'maintenance.created', 'MaintenanceRequest', request.id, tenant.landlordId, { category, priority });
  revalidatePath('/tenant/maintenance');
  revalidatePath('/maintenance');
  revalidatePath('/dashboard');
}

export async function addMaintenanceAttachmentAction(formData: FormData) {
  const user = await requireRole([UserRole.TENANT, UserRole.LANDLORD, UserRole.PROPERTY_MANAGER, UserRole.SUPERADMIN]);
  const maintenanceRequestId = requiredText(formData, 'maintenanceRequestId');
  const request = await prisma.maintenanceRequest.findFirst({
    where: user.role === UserRole.TENANT
      ? { id: maintenanceRequestId, tenant: { userId: user.userId } }
      : { id: maintenanceRequestId },
  });
  if (!request) throw new Error('Maintenance request not found.');

  if (user.role !== UserRole.TENANT && user.role !== UserRole.SUPERADMIN) {
    await requireOwnedProperty(request.landlordId, request.propertyId);
  }

  const attachment = await prisma.maintenanceAttachment.create({
    data: {
      maintenanceRequestId,
      fileUrl: requiredText(formData, 'fileUrl'),
      fileType: text(formData, 'fileType') || null,
    },
  });
  await audit(user.userId, user.email, 'maintenance.attachment_added', 'MaintenanceAttachment', attachment.id, request.landlordId, { maintenanceRequestId });
  revalidatePath('/tenant/maintenance');
  revalidatePath('/maintenance');
}

export async function addMaintenanceCommentAction(formData: FormData) {
  const user = await requireRole([UserRole.TENANT, UserRole.LANDLORD, UserRole.PROPERTY_MANAGER, UserRole.MAINTENANCE_PROVIDER, UserRole.SUPERADMIN]);
  const maintenanceRequestId = requiredText(formData, 'maintenanceRequestId');
  const request = await prisma.maintenanceRequest.findFirst({
    where: user.role === UserRole.TENANT
      ? { id: maintenanceRequestId, tenant: { userId: user.userId } }
      : { id: maintenanceRequestId },
  });
  if (!request) throw new Error('Maintenance request not found.');

  const comment = await prisma.maintenanceComment.create({
    data: {
      maintenanceRequestId,
      authorUserId: user.userId,
      message: requiredText(formData, 'message'),
    },
  });
  await audit(user.userId, user.email, 'maintenance.comment_added', 'MaintenanceComment', comment.id, request.landlordId, { maintenanceRequestId });
  revalidatePath('/tenant/maintenance');
  revalidatePath('/maintenance');
}

export async function createMaintenanceVendorAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const vendor = await prisma.maintenanceVendor.create({
    data: {
      landlordId,
      name: requiredText(formData, 'name'),
      email: text(formData, 'email') || null,
      phone: text(formData, 'phone') || null,
      specialty: text(formData, 'specialty') || null,
      approvedStatus: text(formData, 'approvedStatus') === 'on',
      notes: text(formData, 'notes') || null,
    },
  });
  await audit(user.userId, user.email, 'maintenance_vendor.created', 'MaintenanceVendor', vendor.id, landlordId);
  revalidatePath('/maintenance/vendors');
  revalidatePath('/maintenance');
}

export async function assignMaintenanceVendorAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const maintenanceRequestId = requiredText(formData, 'maintenanceRequestId');
  const vendorId = requiredText(formData, 'vendorId');

  const vendor = await prisma.maintenanceVendor.findFirst({ where: { id: vendorId, landlordId } });
  if (!vendor) throw new Error('Vendor not found for this workspace.');

  const result = await prisma.maintenanceRequest.updateMany({
    where: { id: maintenanceRequestId, landlordId },
    data: { assignedVendorId: vendorId, status: MaintenanceStatus.IN_PROGRESS },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance.vendor_assigned', 'MaintenanceRequest', maintenanceRequestId, landlordId, { vendorId });
  revalidatePath('/maintenance');
}

export async function createMaintenanceWorkOrderAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const maintenanceRequestId = requiredText(formData, 'maintenanceRequestId');
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: maintenanceRequestId, landlordId } });
  if (!request) throw new Error('Maintenance request not found for this workspace.');

  const vendorId = text(formData, 'vendorId') || null;
  if (vendorId) {
    const vendor = await prisma.maintenanceVendor.findFirst({ where: { id: vendorId, landlordId } });
    if (!vendor) throw new Error('Vendor not found for this workspace.');
  }

  const statusInput = text(formData, 'status');
  const status = statusInput
    ? validEnumValue(WorkOrderStatus, statusInput, 'work order status')
    : WorkOrderStatus.OPEN;

  const workOrder = await prisma.maintenanceWorkOrder.create({
    data: {
      maintenanceRequestId,
      vendorId,
      status,
      estimatedCost: text(formData, 'estimatedCost') ? positiveNumber(text(formData, 'estimatedCost'), 'Estimated cost') : null,
      scheduledDate: text(formData, 'scheduledDate') ? new Date(text(formData, 'scheduledDate')) : null,
      notes: text(formData, 'notes') || null,
    },
  });
  await audit(user.userId, user.email, 'maintenance_work_order.created', 'MaintenanceWorkOrder', workOrder.id, landlordId, { maintenanceRequestId, vendorId });
  revalidatePath('/maintenance');
}

export async function updateMaintenanceStatusAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const maintenanceRequestId = requiredText(formData, 'maintenanceRequestId');
  const status = validEnumValue(MaintenanceStatus, requiredText(formData, 'status'), 'maintenance status');

  const existing = await prisma.maintenanceRequest.findFirst({
    where: { id: maintenanceRequestId, landlordId },
    select: { status: true, firstResponseAt: true, resolvedAt: true },
  });
  if (!existing) throw new Error('Maintenance request not found for this workspace.');

  const now = new Date();
  const data: { status: MaintenanceStatus; firstResponseAt?: Date; resolvedAt?: Date } = { status };
  if (!existing.firstResponseAt && status !== MaintenanceStatus.OPEN) {
    data.firstResponseAt = now;
  }
  if (
    !existing.resolvedAt &&
    (status === MaintenanceStatus.RESOLVED || status === MaintenanceStatus.CLOSED)
  ) {
    data.resolvedAt = now;
  }

  const result = await prisma.maintenanceRequest.updateMany({
    where: { id: maintenanceRequestId, landlordId },
    data,
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance.status_updated', 'MaintenanceRequest', maintenanceRequestId, landlordId, { status });
  revalidatePath('/maintenance');
  revalidatePath('/tenant/maintenance');
  revalidatePath('/dashboard');
}

export async function createInvoiceAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  await requireOwnedLease(landlordId, leaseId);

  const invoice = await createInvoiceForLease({
    landlordId,
    leaseId,
    dueDate: new Date(requiredText(formData, 'dueDate')),
    amount: positiveNumber(money(formData, 'amount'), 'Invoice amount'),
    notes: text(formData, 'notes') || undefined,
  });

  await audit(user.userId, user.email, 'invoice.created', 'Invoice', invoice.id, landlordId, { invoiceNo: invoice.invoiceNo });
  revalidatePath('/payments');
  revalidatePath('/tenant/dashboard');
  revalidatePath('/dashboard');
}

export async function recordInvoicePaymentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const invoiceId = requiredText(formData, 'invoiceId');
  const amountPaid = positiveNumber(money(formData, 'amountPaid'), 'Payment amount');

  const result = await applyPaymentToInvoice({
    landlordId,
    invoiceId,
    amountPaid,
    paymentDate: text(formData, 'paymentDate') ? new Date(text(formData, 'paymentDate')) : new Date(),
    paymentMethod: text(formData, 'paymentMethod') || null,
    paymentMethodId: text(formData, 'paymentMethodId') || null,
    notes: text(formData, 'notes') || null,
  });

  const receipt = await generateReceiptForPayment({ paymentId: result.payment.id });

  await audit(user.userId, user.email, 'invoice.payment_recorded', 'Payment', result.payment.id, landlordId, {
    invoiceId,
    receiptId: receipt.id,
  });

  revalidatePath('/payments');
  revalidatePath('/tenant/dashboard');
  revalidatePath('/dashboard');
}

export async function generateReceiptAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const paymentId = requiredText(formData, 'paymentId');
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, landlordId } });
  if (!payment) throw new Error('Payment not found for this workspace.');

  const receipt = await generateReceiptForPayment({ paymentId });
  await audit(user.userId, user.email, 'receipt.generated', 'Receipt', receipt.id, landlordId, { paymentId });
  revalidatePath('/payments');
  revalidatePath('/tenant/dashboard');
}

export async function uploadPaymentProofAction(formData: FormData) {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const paymentId = requiredText(formData, 'paymentId');
  const fileUrl = requiredText(formData, 'fileUrl');
  const fileType = text(formData, 'fileType') || null;

  const payment = await prisma.payment.findFirst({
    where: user.role === UserRole.SUPERADMIN ? { id: paymentId } : { id: paymentId, tenant: { userId: user.userId } },
  });

  if (!payment) throw new Error('Payment not found for this tenant account.');

  const proof = await prisma.paymentProof.create({
    data: { paymentId, fileUrl, fileType },
  });

  await audit(user.userId, user.email, 'payment.proof_uploaded', 'PaymentProof', proof.id, payment.landlordId, { paymentId });
  revalidatePath('/tenant/dashboard');
  revalidatePath('/payments');
}

export async function createBankAccountAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const bankName = requiredText(formData, 'bankName');
  const accountNumber = requiredText(formData, 'accountNumber');

  const bankAccount = await prisma.bankAccount.create({
    data: {
      landlordId,
      bankName,
      accountName: text(formData, 'accountName') || null,
      accountNumberMasked: maskAccountNumber(accountNumber),
      branch: text(formData, 'branch') || null,
      swiftCode: text(formData, 'swiftCode') || null,
      routingInfo: text(formData, 'routingInfo') || null,
      isDefault: text(formData, 'isDefault') === 'on',
    },
  });

  await audit(user.userId, user.email, 'bank_account.created', 'BankAccount', bankAccount.id, landlordId, { bankName });
  revalidatePath('/payments/settings');
  revalidatePath('/tenant/dashboard');
}

export async function createPaymentMethodAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const type = requiredText(formData, 'type') as PaymentMethodType;
  if (!Object.values(PaymentMethodType).includes(type)) throw new Error('Invalid payment method type.');

  const method = await prisma.paymentMethod.create({
    data: {
      landlordId,
      type,
      label: requiredText(formData, 'label'),
      details: text(formData, 'details') ? { notes: text(formData, 'details') } : undefined,
      isDefault: text(formData, 'isDefault') === 'on',
    },
  });

  await audit(user.userId, user.email, 'payment_method.created', 'PaymentMethod', method.id, landlordId, { type, label: method.label });
  revalidatePath('/payments/settings');
}

export async function recordPaymentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  const lease = await requireOwnedLease(landlordId, leaseId);

  const amountDue = positiveNumber(money(formData, 'amountDue', lease.rentAmount.toString()), 'Amount due');
  const amountPaid = nonNegativeNumber(money(formData, 'amountPaid'), 'Amount paid');
  const dueDate = new Date(requiredText(formData, 'dueDate'));
  const paymentDate = text(formData, 'paymentDate') ? new Date(text(formData, 'paymentDate')) : null;
  validatePaymentDates(dueDate, paymentDate);

  const payment = await prisma.payment.create({
    data: {
      landlordId,
      tenantId: lease.tenantId,
      leaseId,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      dueDate,
      paymentDate,
      amountDue,
      amountPaid,
      balance: calculatePaymentBalance(amountDue, amountPaid),
      paymentMethod: text(formData, 'paymentMethod') || null,
      status: calculatePaymentStatus(amountDue, amountPaid) as PaymentStatus,
      notes: text(formData, 'notes') || null,
    },
  });
  await audit(user.userId, user.email, 'payment.recorded', 'Payment', payment.id, landlordId);
  revalidatePath('/payments');
  revalidatePath('/tenant/dashboard');
  revalidatePath('/dashboard');
}

export async function exportPaymentsCsvAction() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const payments = await prisma.payment.findMany({
    where: { landlordId, status: { not: PaymentStatus.VOID } },
    include: { tenant: true, unit: { include: { property: true } }, lease: true },
    orderBy: { dueDate: 'desc' },
  });

  const csvHeaders = [
    'Due Date',
    'Payment Date',
    'Tenant',
    'Property',
    'Unit',
    'Amount Due',
    'Amount Paid',
    'Balance',
    'Status',
    'Payment Method',
    'Notes'
  ];

  const csvRows = payments.map(payment => [
    payment.dueDate.toISOString().split('T')[0],
    payment.paymentDate?.toISOString().split('T')[0] ?? '',
    payment.tenant.fullName,
    payment.unit.property.name,
    payment.unit.unitName,
    payment.amountDue.toString(),
    (payment.amountPaid ?? 0).toString(),
    payment.balance.toString(),
    payment.status,
    payment.paymentMethod ?? '',
    payment.notes ?? ''
  ]);

  const csvContent = createCsvContent(csvHeaders, csvRows);
  const filename = createSafeCsvFilename('payments');

  const response = new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });

  return response;
}

export async function recordExpenseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = requiredText(formData, 'propertyId');
  await requireOwnedProperty(landlordId, propertyId);
  const unitId = text(formData, 'unitId') || null;
  if (unitId) await requireOwnedUnit(landlordId, unitId);

  const expense = await prisma.expense.create({
    data: {
      landlordId,
      propertyId,
      unitId,
      category: requiredText(formData, 'category'),
      vendor: text(formData, 'vendor') || null,
      amount: positiveNumber(money(formData, 'amount'), 'Expense amount'),
      expenseDate: new Date(requiredText(formData, 'expenseDate')),
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
  const userId = requiredText(formData, 'userId');
  if (userId === actor.userId) throw new Error('You cannot disable your own account.');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (target?.role === UserRole.SUPERADMIN && target.status === UserStatus.ACTIVE) {
    const activeSuperadmins = await prisma.user.count({ where: { role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE } });
    if (activeSuperadmins <= 1) throw new Error('You cannot disable the only active superadmin.');
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.DISABLED, disabledAt: new Date(), disabledBy: actor.email, disabledById: actor.userId },
  });
  await audit(actor.userId, actor.email, 'user.disabled', 'User', user.id, undefined, { targetEmail: user.email });
  revalidatePath('/admin/users');
}

export async function reactivateUserAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const user = await prisma.user.update({
    where: { id: requiredText(formData, 'userId') },
    data: { status: UserStatus.ACTIVE, disabledAt: null, disabledBy: null, disabledById: null, disabledReason: null },
  });
  await audit(actor.userId, actor.email, 'user.reactivated', 'User', user.id, undefined, { targetEmail: user.email });
  revalidatePath('/admin/users');
}

export async function assignUserRoleAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const userId = requiredText(formData, 'userId');
  const role = requiredText(formData, 'role') as UserRole;
  if (!Object.values(UserRole).includes(role)) throw new Error('Invalid role.');
  if (userId === actor.userId && role !== UserRole.SUPERADMIN) throw new Error('You cannot demote your own Superadmin account.');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenantProfile: true,
      memberships: { where: { status: RecordStatus.ACTIVE, landlord: { status: RecordStatus.ACTIVE } } },
    },
  });
  if (!target) throw new Error('User not found.');

  if (target.role === UserRole.SUPERADMIN && target.status === UserStatus.ACTIVE && role !== UserRole.SUPERADMIN) {
    const activeSuperadmins = await prisma.user.count({ where: { role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE } });
    if (activeSuperadmins <= 1) throw new Error('You cannot remove the only active superadmin.');
  }

  if (role === UserRole.TENANT && !target.tenantProfile) {
    throw new Error('Assign the TENANT role only after a tenant profile exists.');
  }

  if ((role === UserRole.PROPERTY_MANAGER || role === UserRole.ACCOUNTANT) && target.memberships.length === 0) {
    throw new Error('Assign a landlord workspace membership before assigning this role.');
  }

  if (operationalRoles.includes(role) && target.memberships.length > 0) {
    throw new Error('Operational roles should not have landlord workspace memberships in Phase 1.');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await audit(actor.userId, actor.email, 'user.role_assigned', 'User', user.id, undefined, { targetEmail: user.email, previousRole: target.role, role });
  revalidatePath('/admin/users');
}

export async function archiveLandlordAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const landlord = await prisma.landlordProfile.update({
    where: { id: requiredText(formData, 'landlordId') },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: actor.userId },
  });
  await audit(actor.userId, actor.email, 'landlord.archived', 'LandlordProfile', landlord.id, landlord.id);
  revalidatePath('/admin/landlords');
}

export async function reactivateLandlordAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const landlord = await prisma.landlordProfile.update({
    where: { id: requiredText(formData, 'landlordId') },
    data: { status: RecordStatus.ACTIVE, archivedAt: null, archivedBy: null },
  });
  await audit(actor.userId, actor.email, 'landlord.reactivated', 'LandlordProfile', landlord.id, landlord.id);
  revalidatePath('/admin/landlords');
}

export async function archivePropertyAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = requiredText(formData, 'propertyId');
  const result = await prisma.property.updateMany({
    where: { id: propertyId, landlordId },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'property.archived', 'Property', propertyId, landlordId);
  revalidatePath('/properties');
  revalidatePath('/dashboard');
}

export async function archiveUnitAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const unitId = requiredText(formData, 'unitId');
  const result = await prisma.unit.updateMany({
    where: { id: unitId, landlordId },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'unit.archived', 'Unit', unitId, landlordId);
  revalidatePath('/units');
  revalidatePath('/dashboard');
}

export async function deactivateTenantAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const tenantId = requiredText(formData, 'tenantId');
  const result = await prisma.tenant.updateMany({
    where: { id: tenantId, landlordId },
    data: { status: RecordStatus.INACTIVE, deactivatedAt: new Date(), deactivatedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'tenant.deactivated', 'Tenant', tenantId, landlordId);
  revalidatePath('/tenants');
  revalidatePath('/dashboard');
}

export async function terminateLeaseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  const result = await prisma.lease.updateMany({
    where: { id: leaseId, landlordId },
    data: { status: LeaseStatus.TERMINATED, terminatedAt: new Date(), terminatedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'lease.terminated', 'Lease', leaseId, landlordId);
  revalidatePath('/leases');
  revalidatePath('/dashboard');
}

export async function expireLeaseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  const result = await prisma.lease.updateMany({
    where: { id: leaseId, landlordId },
    data: { status: LeaseStatus.EXPIRED },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'lease.expired', 'Lease', leaseId, landlordId);
  revalidatePath('/leases');
  revalidatePath('/dashboard');
}

export async function voidPaymentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const paymentId = requiredText(formData, 'paymentId');
  const result = await prisma.payment.updateMany({
    where: { id: paymentId, landlordId },
    data: { status: PaymentStatus.VOID, voidedAt: new Date(), voidedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'payment.voided', 'Payment', paymentId, landlordId);
  revalidatePath('/payments');
  revalidatePath('/tenant/dashboard');
  revalidatePath('/dashboard');
}

export async function voidExpenseAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const expenseId = requiredText(formData, 'expenseId');
  const result = await prisma.expense.updateMany({
    where: { id: expenseId, landlordId },
    data: { status: RecordStatus.VOID, voidedAt: new Date(), voidedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'expense.voided', 'Expense', expenseId, landlordId);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function archiveDocumentAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const documentId = requiredText(formData, 'documentId');
  const result = await prisma.document.updateMany({
    where: { id: documentId, landlordId },
    data: { status: RecordStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'document.archived', 'Document', documentId, landlordId);
  revalidatePath('/documents');
}

export async function closeMaintenanceAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const maintenanceId = requiredText(formData, 'maintenanceId');
  const result = await prisma.maintenanceRequest.updateMany({
    where: { id: maintenanceId, landlordId },
    data: { status: MaintenanceStatus.CLOSED },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance.closed', 'MaintenanceRequest', maintenanceId, landlordId);
  revalidatePath('/maintenance');
  revalidatePath('/dashboard');
}

export async function archiveMaintenanceAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const maintenanceId = requiredText(formData, 'maintenanceId');
  const result = await prisma.maintenanceRequest.updateMany({
    where: { id: maintenanceId, landlordId },
    data: { status: MaintenanceStatus.ARCHIVED, archivedAt: new Date(), archivedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance.archived', 'MaintenanceRequest', maintenanceId, landlordId);
  revalidatePath('/maintenance');
  revalidatePath('/dashboard');
}

export async function updateMaintenanceVendorAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const vendorId = requiredText(formData, 'vendorId');
  const existing = await prisma.maintenanceVendor.findFirst({ where: { id: vendorId, landlordId } });
  if (!existing) throw new Error('Vendor not found for this workspace.');

  const insuranceText = text(formData, 'insuranceExpiresAt');
  const vendor = await prisma.maintenanceVendor.update({
    where: { id: vendorId },
    data: {
      name: requiredText(formData, 'name'),
      email: text(formData, 'email') || null,
      phone: text(formData, 'phone') || null,
      specialty: text(formData, 'specialty') || null,
      address: text(formData, 'address') || null,
      licenseNumber: text(formData, 'licenseNumber') || null,
      insuranceExpiresAt: insuranceText ? new Date(insuranceText) : null,
      approvedStatus: text(formData, 'approvedStatus') === 'on',
      notes: text(formData, 'notes') || null,
    },
  });
  await audit(user.userId, user.email, 'maintenance_vendor.updated', 'MaintenanceVendor', vendor.id, landlordId);
  revalidatePath('/maintenance/vendors');
  revalidatePath(`/maintenance/vendors/${vendor.id}`);
}

export async function archiveMaintenanceVendorAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const vendorId = requiredText(formData, 'vendorId');
  const result = await prisma.maintenanceVendor.updateMany({
    where: { id: vendorId, landlordId, archivedAt: null },
    data: { archivedAt: new Date(), archivedBy: user.userId },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance_vendor.archived', 'MaintenanceVendor', vendorId, landlordId);
  revalidatePath('/maintenance/vendors');
}

export async function restoreMaintenanceVendorAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const vendorId = requiredText(formData, 'vendorId');
  const result = await prisma.maintenanceVendor.updateMany({
    where: { id: vendorId, landlordId, archivedAt: { not: null } },
    data: { archivedAt: null, archivedBy: null },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance_vendor.restored', 'MaintenanceVendor', vendorId, landlordId);
  revalidatePath('/maintenance/vendors');
}

export async function enableVendorPortalAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const vendorId = requiredText(formData, 'vendorId');
  const vendor = await prisma.maintenanceVendor.findFirst({ where: { id: vendorId, landlordId } });
  if (!vendor) throw new Error('Vendor not found for this workspace.');

  const portalEmail = requiredText(formData, 'portalEmail').toLowerCase();

  let portalUser = await prisma.user.findUnique({ where: { email: portalEmail } });
  if (portalUser) {
    const otherVendor = await prisma.maintenanceVendor.findFirst({
      where: { userId: portalUser.id, NOT: { id: vendor.id } },
    });
    if (otherVendor) throw new Error('That email is already linked to another vendor.');
    if (
      portalUser.role !== UserRole.VENDOR &&
      portalUser.role !== UserRole.MAINTENANCE_PROVIDER &&
      portalUser.role !== UserRole.SUPERADMIN
    ) {
      throw new Error('That email belongs to a non-vendor account.');
    }
  } else {
    portalUser = await prisma.user.create({
      data: {
        email: portalEmail,
        role: UserRole.MAINTENANCE_PROVIDER,
        status: UserStatus.PENDING_INVITE,
        mustChangePassword: true,
      },
    });
  }

  await prisma.maintenanceVendor.update({
    where: { id: vendor.id },
    data: { userId: portalUser.id, portalEnabledAt: new Date() },
  });
  await audit(user.userId, user.email, 'maintenance_vendor.portal_enabled', 'MaintenanceVendor', vendor.id, landlordId, { portalEmail });
  revalidatePath(`/maintenance/vendors/${vendor.id}`);
}

export async function disableVendorPortalAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const vendorId = requiredText(formData, 'vendorId');
  const result = await prisma.maintenanceVendor.updateMany({
    where: { id: vendorId, landlordId },
    data: { userId: null, portalEnabledAt: null },
  });
  assertSingleWorkspaceUpdate(result);
  await audit(user.userId, user.email, 'maintenance_vendor.portal_disabled', 'MaintenanceVendor', vendorId, landlordId);
  revalidatePath(`/maintenance/vendors/${vendorId}`);
}

export async function dispatchWorkOrderAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const workOrderId = requiredText(formData, 'workOrderId');
  const wo = await prisma.maintenanceWorkOrder.findFirst({
    where: { id: workOrderId, maintenanceRequest: { landlordId } },
    include: { maintenanceRequest: true },
  });
  if (!wo) throw new Error('Work order not found for this workspace.');
  if (!wo.vendorId) throw new Error('Assign a vendor before dispatching.');
  assertTransition(wo.status, WorkOrderStatus.DISPATCHED);

  await prisma.maintenanceWorkOrder.update({
    where: { id: wo.id },
    data: { status: WorkOrderStatus.DISPATCHED, dispatchedAt: new Date() },
  });
  if (!wo.maintenanceRequest.firstResponseAt) {
    await prisma.maintenanceRequest.update({
      where: { id: wo.maintenanceRequestId },
      data: { firstResponseAt: new Date() },
    });
  }
  await audit(user.userId, user.email, 'maintenance_work_order.dispatched', 'MaintenanceWorkOrder', wo.id, landlordId, { vendorId: wo.vendorId });
  revalidatePath('/maintenance');
  revalidatePath(`/maintenance/${wo.maintenanceRequestId}`);
}

export async function updateWorkOrderStatusAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const workOrderId = requiredText(formData, 'workOrderId');
  const nextStatus = validEnumValue(WorkOrderStatus, requiredText(formData, 'status'), 'work order status');
  const wo = await prisma.maintenanceWorkOrder.findFirst({
    where: { id: workOrderId, maintenanceRequest: { landlordId } },
  });
  if (!wo) throw new Error('Work order not found for this workspace.');
  assertTransition(wo.status, nextStatus);

  const now = new Date();
  const data: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === WorkOrderStatus.IN_PROGRESS && !wo.startedAt) data.startedAt = now;
  if (nextStatus === WorkOrderStatus.COMPLETED) {
    data.completedAt = now;
    const actualCostInput = text(formData, 'actualCost');
    if (actualCostInput) data.actualCost = nonNegativeNumber(actualCostInput, 'Actual cost');
    const completion = text(formData, 'completionNotes');
    if (completion) data.completionNotes = completion;
  }
  if (nextStatus === WorkOrderStatus.CANCELLED) {
    data.cancelledAt = now;
    data.cancelReason = text(formData, 'cancelReason') || null;
  }

  await prisma.maintenanceWorkOrder.update({ where: { id: wo.id }, data });

  if (nextStatus === WorkOrderStatus.COMPLETED) {
    const otherOpen = await prisma.maintenanceWorkOrder.count({
      where: {
        maintenanceRequestId: wo.maintenanceRequestId,
        id: { not: wo.id },
        status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.DISPATCHED, WorkOrderStatus.IN_PROGRESS] },
      },
    });
    if (otherOpen === 0) {
      await prisma.maintenanceRequest.update({
        where: { id: wo.maintenanceRequestId },
        data: { status: MaintenanceStatus.RESOLVED, resolvedAt: now },
      });
    }
  }

  await audit(user.userId, user.email, 'maintenance_work_order.status_updated', 'MaintenanceWorkOrder', wo.id, landlordId, { from: wo.status, to: nextStatus });
  revalidatePath('/maintenance');
  revalidatePath(`/maintenance/${wo.maintenanceRequestId}`);
  revalidatePath('/vendor/dashboard');
}

export async function vendorAcknowledgeWorkOrderAction(formData: FormData) {
  const { user, vendor } = await requireVendorUser();
  const workOrderId = requiredText(formData, 'workOrderId');
  const wo = await prisma.maintenanceWorkOrder.findFirst({ where: { id: workOrderId, vendorId: vendor.id } });
  if (!wo) throw new Error('Work order not found.');
  if (wo.status !== WorkOrderStatus.DISPATCHED && wo.status !== WorkOrderStatus.OPEN) {
    throw new Error('Only dispatched or open work orders can be accepted.');
  }
  await prisma.maintenanceWorkOrder.update({
    where: { id: wo.id },
    data: {
      status: WorkOrderStatus.IN_PROGRESS,
      vendorAcknowledgedAt: wo.vendorAcknowledgedAt ?? new Date(),
      startedAt: wo.startedAt ?? new Date(),
    },
  });
  await audit(user.userId, user.email, 'maintenance_work_order.vendor_accepted', 'MaintenanceWorkOrder', wo.id, vendor.landlordId);
  revalidatePath('/vendor/dashboard');
  revalidatePath(`/vendor/work-orders/${wo.id}`);
}

export async function vendorCompleteWorkOrderAction(formData: FormData) {
  const { user, vendor } = await requireVendorUser();
  const workOrderId = requiredText(formData, 'workOrderId');
  const wo = await prisma.maintenanceWorkOrder.findFirst({ where: { id: workOrderId, vendorId: vendor.id } });
  if (!wo) throw new Error('Work order not found.');
  if (wo.status !== WorkOrderStatus.IN_PROGRESS) throw new Error('Only in-progress work orders can be completed.');

  const now = new Date();
  const actualCostInput = text(formData, 'actualCost');
  await prisma.maintenanceWorkOrder.update({
    where: { id: wo.id },
    data: {
      status: WorkOrderStatus.COMPLETED,
      completedAt: now,
      completionNotes: text(formData, 'completionNotes') || null,
      actualCost: actualCostInput ? nonNegativeNumber(actualCostInput, 'Actual cost') : null,
    },
  });

  const otherOpen = await prisma.maintenanceWorkOrder.count({
    where: {
      maintenanceRequestId: wo.maintenanceRequestId,
      id: { not: wo.id },
      status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.DISPATCHED, WorkOrderStatus.IN_PROGRESS] },
    },
  });
  if (otherOpen === 0) {
    await prisma.maintenanceRequest.update({
      where: { id: wo.maintenanceRequestId },
      data: { status: MaintenanceStatus.RESOLVED, resolvedAt: now },
    });
  }
  await audit(user.userId, user.email, 'maintenance_work_order.vendor_completed', 'MaintenanceWorkOrder', wo.id, vendor.landlordId);
  revalidatePath('/vendor/dashboard');
  revalidatePath(`/vendor/work-orders/${wo.id}`);
}

export async function vendorAddCommentAction(formData: FormData) {
  const { user, vendor } = await requireVendorUser();
  const maintenanceRequestId = requiredText(formData, 'maintenanceRequestId');
  const wo = await prisma.maintenanceWorkOrder.findFirst({
    where: { maintenanceRequestId, vendorId: vendor.id },
  });
  if (!wo) throw new Error('You do not have access to this request.');
  const comment = await prisma.maintenanceComment.create({
    data: {
      maintenanceRequestId,
      authorUserId: user.userId,
      message: requiredText(formData, 'message'),
    },
  });
  await audit(user.userId, user.email, 'maintenance.comment_added', 'MaintenanceComment', comment.id, vendor.landlordId, { maintenanceRequestId, source: 'vendor_portal' });
  revalidatePath(`/vendor/work-orders/${wo.id}`);
}

export async function ensureSuperadminAction() {
  await requireSuperadmin();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function optionalDecimalString(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return value;
}

function optionalIntegerString(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return parsed;
}

export async function updatePropertyAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const propertyId = requiredText(formData, 'propertyId');

  const data = {
    name: requiredText(formData, 'name'),
    address: requiredText(formData, 'address'),
    city: requiredText(formData, 'city'),
    state: requiredText(formData, 'state'),
    country: text(formData, 'country') || 'US',
    propertyType: text(formData, 'propertyType') || 'Residential',
    purchasePrice: optionalDecimalString(formData, 'purchasePrice', 'Purchase price'),
    estimatedValue: optionalDecimalString(formData, 'estimatedValue', 'Estimated value'),
  };

  const result = await prisma.property.updateMany({
    where: { id: propertyId, landlordId },
    data,
  });
  assertSingleWorkspaceUpdate(result);

  await audit(user.userId, user.email, 'property.updated', 'Property', propertyId, landlordId, {
    fields: Object.keys(data),
  });
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/properties');
  revalidatePath('/dashboard');
  redirect(`/properties/${propertyId}?updated=1`);
}

export async function updateUnitAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const unitId = requiredText(formData, 'unitId');

  const data = {
    unitName: requiredText(formData, 'unitName'),
    bedrooms: optionalIntegerString(formData, 'bedrooms', 'Bedrooms'),
    bathrooms: optionalDecimalString(formData, 'bathrooms', 'Bathrooms'),
    squareFeet: optionalIntegerString(formData, 'squareFeet', 'Square feet'),
    rentAmount: positiveNumber(money(formData, 'rentAmount'), 'Rent amount'),
    depositAmount: optionalDecimalString(formData, 'depositAmount', 'Deposit amount'),
  };

  const result = await prisma.unit.updateMany({
    where: { id: unitId, landlordId },
    data,
  });
  assertSingleWorkspaceUpdate(result);

  await audit(user.userId, user.email, 'unit.updated', 'Unit', unitId, landlordId, {
    fields: Object.keys(data),
  });
  revalidatePath(`/units/${unitId}`);
  revalidatePath('/units');
  revalidatePath('/dashboard');
  redirect(`/units/${unitId}?updated=1`);
}

export async function updateTenantAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const tenantId = requiredText(formData, 'tenantId');

  const data = {
    fullName: requiredText(formData, 'fullName'),
    phone: optionalText(formData, 'phone'),
    employer: optionalText(formData, 'employer'),
    emergencyContactName: optionalText(formData, 'emergencyContactName'),
    emergencyContactPhone: optionalText(formData, 'emergencyContactPhone'),
  };

  const result = await prisma.tenant.updateMany({
    where: { id: tenantId, landlordId },
    data,
  });
  assertSingleWorkspaceUpdate(result);

  await audit(user.userId, user.email, 'tenant.updated', 'Tenant', tenantId, landlordId, {
    fields: Object.keys(data),
  });
  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath('/tenants');
  revalidatePath('/dashboard');
  redirect(`/tenants/${tenantId}?updated=1`);
}

export async function updateUserProfileAction(formData: FormData) {
  const user = await requireAuthAllowPasswordChange();

  const data = {
    name: optionalText(formData, 'name'),
    fullName: optionalText(formData, 'fullName'),
    phone: optionalText(formData, 'phone'),
  };

  const result = await prisma.user.updateMany({
    where: { id: user.userId },
    data,
  });
  if (result.count !== 1) throw new Error('Profile not found for this user.');

  await audit(user.userId, user.email, 'user.profile_updated', 'User', user.userId, undefined, {
    fields: Object.keys(data),
  });
  revalidatePath('/account/profile');
  redirect('/account/profile?updated=1');
}

export async function updatePlatformSettingsAction(formData: FormData) {
  const user = await requireSuperadmin();
  const timezone = requiredText(formData, 'timezone');
  const currency = requiredText(formData, 'currency');
  if (!isSupportedTimezone(timezone)) throw new Error('Unsupported timezone.');
  if (!isSupportedCurrency(currency)) throw new Error('Unsupported currency.');
  await setPlatformSetting('timezone', timezone, user.userId);
  await setPlatformSetting('currency', currency, user.userId);
  await audit(user.userId, user.email, 'platform.settings_updated', 'SystemSetting', 'platform', undefined, { timezone, currency });
  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
}

export async function updateWorkspaceTimePrefsAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const timezone = requiredText(formData, 'timezone');
  const currency = requiredText(formData, 'currency');
  if (!isSupportedTimezone(timezone)) throw new Error('Unsupported timezone.');
  if (!isSupportedCurrency(currency)) throw new Error('Unsupported currency.');
  await prisma.landlordProfile.update({
    where: { id: landlordId },
    data: { timezone, currency },
  });
  await audit(user.userId, user.email, 'workspace.time_prefs_updated', 'LandlordProfile', landlordId, landlordId, { timezone, currency });
  revalidatePath('/account/profile');
  revalidatePath('/onboarding/company-profile');
  revalidatePath('/dashboard');
}
