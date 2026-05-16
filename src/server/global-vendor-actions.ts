'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, RecordStatus } from '@prisma/client';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { normalizeVendorFlags, parseMonthlyFee } from '@/lib/vendors/global-vendor';
import { isBillingStatus } from '@/lib/vendors/monetization';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === 'on' ? 'on' : null;
}

async function audit(
  actorUserId: string,
  actorEmail: string,
  action: string,
  entityId: string,
  details: Prisma.InputJsonValue = {},
) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      actorEmail,
      action,
      entityType: 'GlobalVendor',
      entityId,
      landlordId: null,
      details,
    },
  });
}

function feeToDecimal(formData: FormData) {
  const fee = parseMonthlyFee(text(formData, 'monthlyFee'));
  return fee === null ? null : new Prisma.Decimal(fee);
}

export async function createGlobalVendorAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const name = requiredText(formData, 'name', 'Vendor name');
  const flags = normalizeVendorFlags({
    approvedStatus: checkbox(formData, 'approvedStatus'),
    featured: checkbox(formData, 'featured'),
    sponsored: checkbox(formData, 'sponsored'),
  });
  const monthlyFee = feeToDecimal(formData);

  const vendor = await prisma.globalVendor.create({
    data: {
      name,
      email: nullableText(formData, 'email'),
      phone: nullableText(formData, 'phone'),
      website: nullableText(formData, 'website'),
      specialty: nullableText(formData, 'specialty'),
      serviceAreas: nullableText(formData, 'serviceAreas'),
      description: nullableText(formData, 'description'),
      logoUrl: nullableText(formData, 'logoUrl'),
      approvedStatus: flags.approvedStatus,
      featured: flags.featured,
      sponsored: flags.sponsored,
      monthlyFee,
      status: RecordStatus.ACTIVE,
      createdBy: actor.userId,
    },
  });

  await audit(actor.userId, actor.email, 'global_vendor.created', vendor.id, {
    name,
    approvedStatus: flags.approvedStatus,
    featured: flags.featured,
    sponsored: flags.sponsored,
  });

  revalidatePath('/admin/vendors');
}

export async function updateGlobalVendorAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const vendorId = requiredText(formData, 'vendorId', 'Vendor id');
  const existing = await prisma.globalVendor.findUnique({ where: { id: vendorId } });
  if (!existing) throw new Error('Global vendor not found.');

  const name = requiredText(formData, 'name', 'Vendor name');
  const flags = normalizeVendorFlags({
    approvedStatus: checkbox(formData, 'approvedStatus'),
    featured: checkbox(formData, 'featured'),
    sponsored: checkbox(formData, 'sponsored'),
  });
  const monthlyFee = feeToDecimal(formData);

  await prisma.globalVendor.update({
    where: { id: vendorId },
    data: {
      name,
      email: nullableText(formData, 'email'),
      phone: nullableText(formData, 'phone'),
      website: nullableText(formData, 'website'),
      specialty: nullableText(formData, 'specialty'),
      serviceAreas: nullableText(formData, 'serviceAreas'),
      description: nullableText(formData, 'description'),
      logoUrl: nullableText(formData, 'logoUrl'),
      approvedStatus: flags.approvedStatus,
      featured: flags.featured,
      sponsored: flags.sponsored,
      monthlyFee,
    },
  });

  await audit(actor.userId, actor.email, 'global_vendor.updated', vendorId, { name });

  revalidatePath('/admin/vendors');
}

export async function setGlobalVendorFlagsAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const vendorId = requiredText(formData, 'vendorId', 'Vendor id');
  const existing = await prisma.globalVendor.findUnique({ where: { id: vendorId } });
  if (!existing) throw new Error('Global vendor not found.');

  const flags = normalizeVendorFlags({
    approvedStatus: checkbox(formData, 'approvedStatus'),
    featured: checkbox(formData, 'featured'),
    sponsored: checkbox(formData, 'sponsored'),
  });

  await prisma.globalVendor.update({
    where: { id: vendorId },
    data: {
      approvedStatus: flags.approvedStatus,
      featured: flags.featured,
      sponsored: flags.sponsored,
    },
  });

  await audit(actor.userId, actor.email, 'global_vendor.flags_updated', vendorId, {
    approvedStatus: flags.approvedStatus,
    featured: flags.featured,
    sponsored: flags.sponsored,
  });

  revalidatePath('/admin/vendors');
}

export async function updateGlobalVendorBillingAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const vendorId = requiredText(formData, 'vendorId', 'Vendor id');
  const existing = await prisma.globalVendor.findUnique({ where: { id: vendorId } });
  if (!existing) throw new Error('Global vendor not found.');

  const billingStatus = requiredText(formData, 'billingStatus', 'Billing status');
  if (!isBillingStatus(billingStatus)) {
    throw new Error('Invalid billing status.');
  }

  const fee = parseMonthlyFee(text(formData, 'monthlyFee'));
  const monthlyFee = fee === null ? null : new Prisma.Decimal(fee);

  const paidThroughRaw = text(formData, 'paidThrough');
  let paidThrough: Date | null = null;
  if (paidThroughRaw.length > 0) {
    const parsed = new Date(paidThroughRaw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Paid-through date is invalid.');
    }
    paidThrough = parsed;
  }

  const notesRaw = text(formData, 'billingNotes');
  const billingNotes = notesRaw.length > 0 ? notesRaw.slice(0, 1000) : null;

  await prisma.globalVendor.update({
    where: { id: vendorId },
    data: {
      billingStatus,
      monthlyFee,
      paidThrough,
      billingNotes,
    },
  });

  await audit(actor.userId, actor.email, 'global_vendor.billing_updated', vendorId, {
    billingStatus,
    monthlyFee: fee,
  });

  revalidatePath('/admin/vendors');
}

export async function archiveGlobalVendorAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const vendorId = requiredText(formData, 'vendorId', 'Vendor id');
  const existing = await prisma.globalVendor.findUnique({ where: { id: vendorId } });
  if (!existing) throw new Error('Global vendor not found.');

  if (existing.status === RecordStatus.ARCHIVED) {
    revalidatePath('/admin/vendors');
    return;
  }

  await prisma.globalVendor.update({
    where: { id: vendorId },
    data: {
      status: RecordStatus.ARCHIVED,
      archivedAt: new Date(),
      archivedBy: actor.userId,
    },
  });

  await audit(actor.userId, actor.email, 'global_vendor.archived', vendorId, {
    name: existing.name,
  });

  revalidatePath('/admin/vendors');
}

export async function reactivateGlobalVendorAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const vendorId = requiredText(formData, 'vendorId', 'Vendor id');
  const existing = await prisma.globalVendor.findUnique({ where: { id: vendorId } });
  if (!existing) throw new Error('Global vendor not found.');

  if (existing.status === RecordStatus.ACTIVE) {
    revalidatePath('/admin/vendors');
    return;
  }

  await prisma.globalVendor.update({
    where: { id: vendorId },
    data: {
      status: RecordStatus.ACTIVE,
      archivedAt: null,
      archivedBy: null,
    },
  });

  await audit(actor.userId, actor.email, 'global_vendor.reactivated', vendorId, {
    name: existing.name,
  });

  revalidatePath('/admin/vendors');
}
