'use server';

import { Prisma, type LogisticsRequestStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import type { WorkflowActionResult } from '@/lib/actions/workflow-result';
import { requireAdminSession, requireCrmSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  isLogisticsRequestStatus,
  LOGISTICS_STATUS_TRANSITIONS
} from '@/lib/logistics/crm-presentation';
import {
  compareDateOnly,
  getKyivTodayDateOnly,
  parseDateOnly,
  serializeDateOnly
} from '@/lib/logistics/date-only';
import { prisma } from '@/lib/prisma';
import { parseLogisticsTariffPrice } from '@/lib/logistics/tariff-price';

const COMMENT_MAX_LENGTH = 2_000;
const ID_MAX_LENGTH = 64;
const PRICE_PATTERN = /^\d{1,10}(?:[.,]\d{1,2})?$/;
const MAX_TARIFF_PRICE = new Prisma.Decimal('9999999999.99');

type LogisticsActionCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'INVALID_OPERATION'
  | 'CONFLICT';

class LogisticsCrmActionError extends Error {
  constructor(readonly code: LogisticsActionCode) {
    super(code);
    this.name = 'LogisticsCrmActionError';
  }
}

function field(formData: FormData, name: string, maxLength = ID_MAX_LENGTH) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function success(code: string, message: string): WorkflowActionResult {
  return {
    ok: true,
    feedback: { code, tone: 'success', message }
  };
}

function failure(code: string, message: string): WorkflowActionResult {
  return {
    ok: false,
    feedback: { code, tone: 'error', message },
    refresh: false
  };
}

function actionFailure(error: unknown, fallback: string): WorkflowActionResult {
  if (error instanceof LogisticsCrmActionError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return failure('not-found', 'Логістичну заявку або тариф не знайдено.');
      case 'INVALID_TRANSITION':
        return failure(
          'invalid-transition',
          'Ця зміна статусу більше недоступна.'
        );
      case 'INVALID_OPERATION':
        return failure(
          'invalid-operation',
          'Ця дія недоступна для заявки з фіксованим тарифом.'
        );
      case 'CONFLICT':
        return failure(
          'concurrency-conflict',
          'Дані вже змінилися. Оновіть сторінку та повторіть дію.'
        );
      case 'INVALID_INPUT':
        return failure('validation', fallback);
    }
  }

  console.error('Logistics CRM mutation failed.', {
    errorType: error instanceof Error ? error.name : 'UnknownError'
  });
  return failure('unexpected', 'Не вдалося виконати дію. Спробуйте ще раз.');
}

async function requestContext() {
  return auditRequestContextFromHeaders(await headers());
}

function revalidateLogisticsRequest(id: string) {
  revalidatePath('/admin/logistics');
  revalidatePath(`/admin/logistics/${id}`);
  revalidatePath('/admin', 'layout');
}

function revalidateLogisticsRequestEverywhere(id: string) {
  revalidateLogisticsRequest(id);
  revalidatePath('/client/logistics');
  revalidatePath(`/client/logistics/${id}`);
}

export async function updateLogisticsPreferredDeliveryDate(
  formData: FormData
): Promise<WorkflowActionResult> {
  const session = await requireCrmSession();
  const requestId = field(formData, 'requestId');
  const rawPreferredDeliveryDate = field(
    formData,
    'preferredDeliveryDate',
    10
  );
  const expectedUpdatedAt = field(formData, 'expectedUpdatedAt', 40);
  const preferredDeliveryDate = parseDateOnly(rawPreferredDeliveryDate);

  if (!requestId || !expectedUpdatedAt || !preferredDeliveryDate) {
    return failure(
      'invalid-preferred-delivery-date',
      'Вкажіть коректну бажану дату перевезення.'
    );
  }
  if (
    compareDateOnly(
      preferredDeliveryDate.value,
      getKyivTodayDateOnly()
    ) < 0
  ) {
    return failure(
      'preferred-delivery-date-in-past',
      'Бажана дата перевезення не може бути в минулому.'
    );
  }

  const expectedDate = new Date(expectedUpdatedAt);
  if (Number.isNaN(expectedDate.getTime())) {
    return failure(
      'invalid-preferred-delivery-date',
      'Не вдалося перевірити версію логістичної заявки.'
    );
  }

  try {
    const context = await requestContext();
    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.logisticsRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          requestNumber: true,
          preferredDeliveryDate: true,
          updatedAt: true
        }
      });
      if (!current) throw new LogisticsCrmActionError('NOT_FOUND');
      if (current.updatedAt.getTime() !== expectedDate.getTime()) {
        throw new LogisticsCrmActionError('CONFLICT');
      }

      const currentValue = serializeDateOnly(current.preferredDeliveryDate);
      if (currentValue === preferredDeliveryDate.value) {
        return 'unchanged' as const;
      }

      const updated = await tx.logisticsRequest.updateMany({
        where: { id: requestId, updatedAt: expectedDate },
        data: { preferredDeliveryDate: preferredDeliveryDate.date }
      });
      if (updated.count !== 1) {
        throw new LogisticsCrmActionError('CONFLICT');
      }

      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        entityType: 'LOGISTICS_REQUEST',
        entityId: current.id,
        entityLabel: current.requestNumber,
        action: 'LOGISTICS_PREFERRED_DATE_CHANGED',
        category: 'STANDARD',
        oldValue: {
          requestNumber: current.requestNumber,
          preferredDeliveryDate: currentValue
        },
        newValue: {
          requestNumber: current.requestNumber,
          preferredDeliveryDate: preferredDeliveryDate.value
        },
        allowedFields: {
          oldValue: ['requestNumber', 'preferredDeliveryDate'],
          newValue: ['requestNumber', 'preferredDeliveryDate']
        },
        requestContext: context
      });

      return 'updated' as const;
    });

    if (outcome === 'updated') {
      revalidateLogisticsRequestEverywhere(requestId);
      return success(
        'preferred-date-updated',
        'Бажану дату перевезення оновлено.'
      );
    }
    return success(
      'preferred-date-unchanged',
      'Бажана дата перевезення вже має вказане значення.'
    );
  } catch (error) {
    return actionFailure(error, 'Перевірте бажану дату перевезення.');
  }
}

export async function updateLogisticsRequestStatus(
  formData: FormData
): Promise<WorkflowActionResult> {
  const session = await requireCrmSession();
  const requestId = field(formData, 'requestId');
  const expectedStatusValue = field(formData, 'expectedStatus', 32);
  const targetStatusValue = field(formData, 'targetStatus', 32);

  if (
    !requestId ||
    !isLogisticsRequestStatus(expectedStatusValue) ||
    !isLogisticsRequestStatus(targetStatusValue)
  ) {
    return failure('validation', 'Некоректні параметри зміни статусу.');
  }

  const expectedStatus: LogisticsRequestStatus = expectedStatusValue;
  const targetStatus: LogisticsRequestStatus = targetStatusValue;
  if (!LOGISTICS_STATUS_TRANSITIONS[expectedStatus].includes(targetStatus)) {
    return failure('invalid-transition', 'Недозволений перехід статусу.');
  }

  try {
    const context = await requestContext();
    await prisma.$transaction(async (tx) => {
      const current = await tx.logisticsRequest.findUnique({
        where: { id: requestId },
        select: { id: true, requestNumber: true, status: true }
      });
      if (!current) throw new LogisticsCrmActionError('NOT_FOUND');
      if (current.status !== expectedStatus) {
        throw new LogisticsCrmActionError('CONFLICT');
      }
      if (!LOGISTICS_STATUS_TRANSITIONS[current.status].includes(targetStatus)) {
        throw new LogisticsCrmActionError('INVALID_TRANSITION');
      }

      const updated = await tx.logisticsRequest.updateMany({
        where: { id: requestId, status: expectedStatus },
        data: { status: targetStatus }
      });
      if (updated.count !== 1) {
        throw new LogisticsCrmActionError('CONFLICT');
      }

      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        entityType: 'LOGISTICS_REQUEST',
        entityId: current.id,
        entityLabel: current.requestNumber,
        action: 'LOGISTICS_STATUS_CHANGED',
        category: 'STANDARD',
        oldValue: {
          requestNumber: current.requestNumber,
          status: current.status
        },
        newValue: {
          requestNumber: current.requestNumber,
          status: targetStatus
        },
        allowedFields: {
          oldValue: ['requestNumber', 'status'],
          newValue: ['requestNumber', 'status']
        },
        requestContext: context
      });
    });

    revalidateLogisticsRequest(requestId);
    return success('status-updated', 'Статус логістичної заявки оновлено.');
  } catch (error) {
    return actionFailure(error, 'Некоректні параметри зміни статусу.');
  }
}

export async function addLogisticsInternalComment(
  formData: FormData
): Promise<WorkflowActionResult> {
  const session = await requireCrmSession();
  const requestId = field(formData, 'requestId');
  const body = field(formData, 'body', COMMENT_MAX_LENGTH + 1);

  if (!requestId || !body || body.length > COMMENT_MAX_LENGTH) {
    return failure(
      'comment-validation',
      `Коментар має містити від 1 до ${COMMENT_MAX_LENGTH} символів.`
    );
  }

  try {
    const context = await requestContext();
    await prisma.$transaction(async (tx) => {
      const request = await tx.logisticsRequest.findUnique({
        where: { id: requestId },
        select: { id: true, requestNumber: true }
      });
      if (!request) throw new LogisticsCrmActionError('NOT_FOUND');

      const comment = await tx.logisticsInternalComment.create({
        data: {
          logisticsRequestId: request.id,
          authorUserId: session.user.id,
          body
        },
        select: { id: true }
      });

      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        entityType: 'LOGISTICS_REQUEST',
        entityId: request.id,
        entityLabel: request.requestNumber,
        action: 'LOGISTICS_INTERNAL_COMMENT_CREATED',
        category: 'STANDARD',
        newValue: {
          requestNumber: request.requestNumber,
          commentId: comment.id
        },
        allowedFields: {
          newValue: ['requestNumber', 'commentId']
        },
        requestContext: context
      });
    });

    revalidateLogisticsRequest(requestId);
    return success('comment-created', 'Внутрішній коментар додано.');
  } catch (error) {
    return actionFailure(error, 'Перевірте текст коментаря.');
  }
}

export async function updateLogisticsIndividualPrice(
  formData: FormData
): Promise<WorkflowActionResult> {
  const session = await requireCrmSession();
  const requestId = field(formData, 'requestId');
  const expectedUpdatedAt = field(formData, 'expectedUpdatedAt', 40);
  const rawPrice = field(formData, 'totalPrice', 32).replace(',', '.');

  if (!requestId || !expectedUpdatedAt || !PRICE_PATTERN.test(rawPrice)) {
    return failure(
      'invalid-individual-price',
      'Вкажіть додатну суму не більше ніж із двома знаками після коми.'
    );
  }

  let nextPrice: Prisma.Decimal;
  try {
    nextPrice = new Prisma.Decimal(rawPrice);
  } catch {
    return failure(
      'invalid-individual-price',
      'Введено некоректну суму.'
    );
  }
  if (
    nextPrice.lessThanOrEqualTo(0) ||
    nextPrice.greaterThan(MAX_TARIFF_PRICE)
  ) {
    return failure(
      'invalid-individual-price',
      'Сума має бути більшою за нуль і не перевищувати 9 999 999 999,99 грн.'
    );
  }

  const expectedDate = new Date(expectedUpdatedAt);
  if (Number.isNaN(expectedDate.getTime())) {
    return failure(
      'invalid-individual-price',
      'Не вдалося перевірити версію логістичної заявки.'
    );
  }

  try {
    const context = await requestContext();
    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.logisticsRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          requestNumber: true,
          pricingType: true,
          totalPrice: true,
          updatedAt: true
        }
      });
      if (!current) throw new LogisticsCrmActionError('NOT_FOUND');
      if (current.pricingType !== 'INDIVIDUAL') {
        throw new LogisticsCrmActionError('INVALID_OPERATION');
      }
      if (current.updatedAt.getTime() !== expectedDate.getTime()) {
        throw new LogisticsCrmActionError('CONFLICT');
      }
      if (current.totalPrice?.equals(nextPrice)) {
        return 'unchanged' as const;
      }

      const updated = await tx.logisticsRequest.updateMany({
        where: {
          id: requestId,
          updatedAt: expectedDate,
          pricingType: 'INDIVIDUAL'
        },
        data: { totalPrice: nextPrice }
      });
      if (updated.count !== 1) {
        throw new LogisticsCrmActionError('CONFLICT');
      }

      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        entityType: 'LOGISTICS_REQUEST',
        entityId: current.id,
        entityLabel: current.requestNumber,
        action: 'LOGISTICS_INDIVIDUAL_PRICE_CHANGED',
        category: 'FINANCIAL_CRITICAL',
        oldValue: {
          requestNumber: current.requestNumber,
          oldTotalPrice: current.totalPrice
        },
        newValue: {
          requestNumber: current.requestNumber,
          newTotalPrice: nextPrice
        },
        allowedFields: {
          oldValue: ['requestNumber', 'oldTotalPrice'],
          newValue: ['requestNumber', 'newTotalPrice']
        },
        requestContext: context
      });

      return 'updated' as const;
    });

    revalidateLogisticsRequestEverywhere(requestId);
    return outcome === 'unchanged'
      ? success(
          'individual-price-unchanged',
          'Кінцева вартість уже має вказане значення.'
        )
      : success(
          'individual-price-updated',
          'Кінцеву вартість перевезення збережено.'
        );
  } catch (error) {
    return actionFailure(error, 'Перевірте кінцеву вартість.');
  }
}

export async function updateLogisticsTariffPrice(
  formData: FormData
): Promise<WorkflowActionResult> {
  const session = await requireAdminSession();
  const tariffId = field(formData, 'tariffId');
  const expectedUpdatedAt = field(formData, 'expectedUpdatedAt', 40);
  const rawPrice = field(formData, 'price', 32);

  const nextPrice = parseLogisticsTariffPrice(rawPrice);
  if (!tariffId || !expectedUpdatedAt || !nextPrice) {
    return failure(
      'price-validation',
      'Вкажіть цілу суму в гривнях, більшу за нуль.'
    );
  }

  const expectedDate = new Date(expectedUpdatedAt);
  if (Number.isNaN(expectedDate.getTime())) {
    return failure('price-validation', 'Не вдалося перевірити версію тарифу.');
  }

  try {
    const context = await requestContext();
    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.logisticsTariffCity.findUnique({
        where: { id: tariffId },
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          updatedAt: true
        }
      });
      if (!current) throw new LogisticsCrmActionError('NOT_FOUND');
      if (current.updatedAt.getTime() !== expectedDate.getTime()) {
        throw new LogisticsCrmActionError('CONFLICT');
      }
      if (current.price.equals(nextPrice)) return 'unchanged' as const;

      const updated = await tx.logisticsTariffCity.updateMany({
        where: { id: tariffId, updatedAt: expectedDate },
        data: { price: nextPrice }
      });
      if (updated.count !== 1) {
        throw new LogisticsCrmActionError('CONFLICT');
      }

      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        entityType: 'LOGISTICS_TARIFF_CITY',
        entityId: current.id,
        entityLabel: current.name,
        action: 'LOGISTICS_TARIFF_UPDATED',
        category: 'FINANCIAL_CRITICAL',
        oldValue: {
          tariffCityCode: current.code,
          price: current.price
        },
        newValue: {
          tariffCityCode: current.code,
          price: nextPrice
        },
        allowedFields: {
          oldValue: ['tariffCityCode', 'price'],
          newValue: ['tariffCityCode', 'price']
        },
        requestContext: context
      });
      return 'updated' as const;
    });

    revalidatePath('/admin/logistics/tariffs');
    revalidatePath('/logistics/request');
    return outcome === 'unchanged'
      ? success('tariff-unchanged', 'Тариф уже має вказане значення.')
      : success('tariff-updated', 'Тариф міста оновлено.');
  } catch (error) {
    return actionFailure(error, 'Перевірте значення тарифу.');
  }
}
