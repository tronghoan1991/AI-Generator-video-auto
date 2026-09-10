import type { InlineKeyboardMarkup } from "./inline-keyboards.js";

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
  };
}

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: TelegramMessage;
  from: { id: number };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export interface SendMessageOptions {
  reply_markup?: InlineKeyboardMarkup;
  parse_mode?: "Markdown" | "HTML";
}
