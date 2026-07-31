export type WorkflowFeedback = {
  code: string;
  tone: 'success' | 'warning' | 'error';
  message: string;
};

export type WorkflowActionResult =
  | { ok: true; feedback: WorkflowFeedback; refresh?: boolean }
  | { ok: false; feedback: WorkflowFeedback; refresh?: boolean };
