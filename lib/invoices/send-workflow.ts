import type {
  InvoiceStatus,
  RequestStatus,
  UserRole,
  UserStatus
} from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';

export type InvoiceSendActor = {
  id: string;
  role: UserRole;
  status: UserStatus;
};

export type InvoiceSendRecord = {
  id: string;
  requestId: string;
  status: InvoiceStatus;
  sentAt: Date | null;
  request: {
    status: RequestStatus;
  };
  _count: {
    items: number;
  };
};

export type InvoiceSendAuditContext = {
  actorId: string;
  actorRole: UserRole;
  requestContext?: AuditRequestContext;
};

export type InvoiceSendRequestTransitionResult =
  | {
      outcome: 'changed';
      previousStatus: RequestStatus;
      nextStatus: RequestStatus;
      historyId: string;
      auditLogId: string;
    }
  | {
      outcome: 'noop' | 'blocked';
    };

type InvoiceSendDependencies<
  TTransaction,
  TInvoice extends InvoiceSendRecord,
  TAudit extends InvoiceSendAuditContext
> = {
  runTransaction<T>(
    callback: (tx: TTransaction) => Promise<T>
  ): Promise<T>;
  findActor(tx: TTransaction, actorId: string): Promise<InvoiceSendActor | null>;
  findInvoice(tx: TTransaction, invoiceId: string): Promise<TInvoice | null>;
  markInvoiceSent(
    tx: TTransaction,
    invoiceId: string,
    sentAt: Date
  ): Promise<{ count: number }>;
  transitionRequest(
    tx: TTransaction,
    input: {
      requestId: string;
      actorId: string;
      invoiceId: string;
      requestContext?: AuditRequestContext;
    }
  ): Promise<InvoiceSendRequestTransitionResult>;
  writeInvoiceSentAudit(
    tx: TTransaction,
    audit: TAudit,
    before: TInvoice,
    after: TInvoice
  ): Promise<void>;
  notify(invoiceId: string): Promise<unknown>;
  now(): Date;
};

export type SendInvoiceToClientInput<TAudit extends InvoiceSendAuditContext> = {
  invoiceId: string;
  expectedRequestId: string;
  audit: TAudit;
};

const crmRoles = new Set<UserRole>(['MANAGER', 'ADMIN']);

export function createSendInvoiceToClientService<
  TTransaction,
  TInvoice extends InvoiceSendRecord,
  TAudit extends InvoiceSendAuditContext
>(
  dependencies: InvoiceSendDependencies<TTransaction, TInvoice, TAudit>
) {
  return async function sendInvoiceToClientService(
    input: SendInvoiceToClientInput<TAudit>
  ) {
    const result = await dependencies.runTransaction(async (tx) => {
      const actor = await dependencies.findActor(tx, input.audit.actorId);
      if (
        !actor ||
        actor.status !== 'ACTIVE' ||
        actor.role !== input.audit.actorRole ||
        !crmRoles.has(actor.role)
      ) {
        return { ok: false as const, status: 'invoice-forbidden' as const };
      }

      const invoice = await dependencies.findInvoice(tx, input.invoiceId);
      if (!invoice) {
        return { ok: false as const, status: 'invoice-not-found' as const };
      }
      if (invoice.requestId !== input.expectedRequestId) {
        return {
          ok: false as const,
          status: 'invoice-request-mismatch' as const
        };
      }
      if (invoice.status === 'SENT') {
        return {
          ok: true as const,
          outcome: 'noop' as const,
          invoiceId: invoice.id
        };
      }
      if (invoice.status !== 'DRAFT') {
        return {
          ok: false as const,
          status: 'invoice-invalid-transition' as const
        };
      }
      if (invoice.request.status !== 'AWAITING_INVOICE') {
        return {
          ok: false as const,
          status: 'invoice-request-not-awaiting-send' as const
        };
      }
      if (invoice._count.items === 0) {
        return { ok: false as const, status: 'invoice-empty' as const };
      }

      const sentAt = dependencies.now();
      const updated = await dependencies.markInvoiceSent(
        tx,
        invoice.id,
        sentAt
      );
      if (updated.count !== 1) {
        const latest = await dependencies.findInvoice(tx, invoice.id);
        if (latest?.status === 'SENT') {
          return {
            ok: true as const,
            outcome: 'noop' as const,
            invoiceId: latest.id
          };
        }
        throw new Error('INVOICE_SEND_CONCURRENT_CHANGE');
      }

      const requestTransition = await dependencies.transitionRequest(tx, {
        requestId: invoice.requestId,
        actorId: actor.id,
        invoiceId: invoice.id,
        requestContext: input.audit.requestContext
      });
      if (requestTransition.outcome !== 'changed') {
        throw new Error('INVOICE_SEND_REQUEST_TRANSITION_FAILED');
      }

      const auditUpdated = await dependencies.findInvoice(tx, invoice.id);
      if (!auditUpdated) {
        throw new Error('INVOICE_DISAPPEARED_AFTER_SEND');
      }
      await dependencies.writeInvoiceSentAudit(
        tx,
        input.audit,
        invoice,
        auditUpdated
      );

      return {
        ok: true as const,
        outcome: 'sent' as const,
        invoiceId: invoice.id,
        sentAt,
        requestTransition
      };
    });

    if (!result.ok || result.outcome === 'noop') {
      return result;
    }

    try {
      await dependencies.notify(result.invoiceId);
      return { ...result, notificationDelivered: true as const };
    } catch {
      return { ...result, notificationDelivered: false as const };
    }
  };
}
