export type TelegramDraftStep =
  | 'AWAITING_CONTACT'
  | 'CONFIRM_PROFILE'
  | 'ASK_EQUIPMENT'
  | 'ASK_MANUFACTURER'
  | 'ASK_MODEL'
  | 'ASK_YEAR'
  | 'ASK_VIN'
  | 'ASK_DESCRIPTION'
  | 'ASK_EXTRA_COMMENT'
  | 'ASK_FILES'
  | 'CONFIRM';

export type TelegramDraftFile = {
  kind: 'photo' | 'document';
  fileId: string;
  fileUniqueId?: string;
  fileName: string;
  mimeType: string;
  size?: number;
};

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramContact = {
  phone_number: string;
  first_name?: string;
  last_name?: string;
  user_id?: number;
};

export type TelegramPhotoSize = {
  file_id: string;
  file_unique_id?: string;
  width: number;
  height: number;
  file_size?: number;
};

export type TelegramDocument = {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type?: string };
  from?: TelegramUser;
  text?: string;
  contact?: TelegramContact;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramSendMessageOptions = {
  replyMarkup?: Record<string, unknown>;
  parseMode?: 'HTML';
};
