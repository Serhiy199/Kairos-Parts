export type InvoiceCreationWorkflowInput = {
  requestId: string;
};

export type InvoiceCreationWorkflowDependencies<
  TTransaction,
  TInput extends InvoiceCreationWorkflowInput,
  TSelection,
  TInvoice
> = {
  resolveSelection(
    tx: TTransaction,
    requestId: string
  ): Promise<TSelection>;
  persistInvoice(
    tx: TTransaction,
    input: TInput,
    selection: TSelection
  ): Promise<TInvoice>;
};

export function createInvoiceSelectionTransactionWorkflow<
  TTransaction,
  TInput extends InvoiceCreationWorkflowInput,
  TSelection,
  TInvoice
>(
  dependencies: InvoiceCreationWorkflowDependencies<
    TTransaction,
    TInput,
    TSelection,
    TInvoice
  >
) {
  return async function runInvoiceSelectionTransaction(
    tx: TTransaction,
    input: TInput
  ) {
    const selection = await dependencies.resolveSelection(
      tx,
      input.requestId
    );
    return dependencies.persistInvoice(tx, input, selection);
  };
}
