export type TeamActionResult = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: { name?: string; email?: string };
  invitation?: {
    url: string;
    expiresAt: string;
    managerName: string;
  };
};

export const INITIAL_TEAM_ACTION_RESULT: TeamActionResult = { status: 'idle' };
