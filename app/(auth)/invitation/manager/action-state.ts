export type ManagerPasswordSetupState = {
  status: 'idle' | 'error';
  message: string;
};

export const INITIAL_MANAGER_PASSWORD_SETUP_STATE: ManagerPasswordSetupState = {
  status: 'idle',
  message: ''
};
