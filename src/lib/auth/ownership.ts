import { RecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function requireOwnedProperty(landlordId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, landlordId, status: RecordStatus.ACTIVE },
  });

  if (!property) throw new Error('Property not found for this workspace.');
  return property;
}

export async function requireOwnedUnit(landlordId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, landlordId, status: RecordStatus.ACTIVE },
  });

  if (!unit) throw new Error('Unit not found for this workspace.');
  return unit;
}

export async function requireOwnedTenant(landlordId: string, tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, landlordId, status: RecordStatus.ACTIVE },
  });

  if (!tenant) throw new Error('Tenant not found for this workspace.');
  return tenant;
}

export async function requireOwnedLease(landlordId: string, leaseId: string) {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, landlordId },
    include: { tenant: true, unit: true },
  });

  if (!lease) throw new Error('Lease not found for this workspace.');
  return lease;
}

export async function requireOwnedPayment(landlordId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, landlordId },
  });

  if (!payment) throw new Error('Payment not found for this workspace.');
  return payment;
}

export async function requireOwnedExpense(landlordId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, landlordId },
  });

  if (!expense) throw new Error('Expense not found for this workspace.');
  return expense;
}

export async function requireOwnedDocument(landlordId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, landlordId },
  });

  if (!document) throw new Error('Document not found for this workspace.');
  return document;
}

export async function requireOwnedMaintenanceRequest(landlordId: string, maintenanceRequestId: string) {
  const maintenanceRequest = await prisma.maintenanceRequest.findFirst({
    where: { id: maintenanceRequestId, landlordId },
  });

  if (!maintenanceRequest) throw new Error('Maintenance request not found for this workspace.');
  return maintenanceRequest;
}

export async function requireUnitBelongsToProperty(landlordId: string, propertyId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId, landlordId, status: RecordStatus.ACTIVE },
  });

  if (!unit) throw new Error('Unit does not belong to this property/workspace.');
  return unit;
}
