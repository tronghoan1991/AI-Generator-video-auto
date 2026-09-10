import { readFile } from "node:fs/promises";
import type { InlineKeyboardMarkup } from "./inline-keyboards.js";
import type { SendMessageOptions, TelegramApiResponse, TelegramUpdate } from "./telegram-types.js";

interface TelegramFileResult {
  file_path: string;
}

export class TelegramClient {
  private readonly apiBase: string;
  private readonly fileBase: string;

  constructor(private readonly token: string) {
    this.apiBase = `https://api.telegram.org/bot${token}`;
    this.fileBase = `https://api.telegram.org/file/bot${token}`;
  }

  private async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.apiBase}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const parsed = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !parsed.ok) {
      throw new Error(parsed.description ?? `Telegram API call failed for ${method}`);
    }
    return parsed.result;
  }

  async getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ["message", "callback_query"],
    });
  }

  async sendMessage(chatId: number, text: string, options: SendMessageOptions = {}): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  async sendDocument(chatId: number, filePath: string, caption?: string): Promise<void> {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) {
      form.append("caption", caption);
    }
    const content = await readFile(filePath);
    const filename = filePath.split("/").pop() ?? "file.bin";
    form.append("document", new Blob([content]), filename);

    const response = await fetch(`${this.apiBase}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const parsed = (await response.json()) as TelegramApiResponse<unknown>;
    if (!response.ok || !parsed.ok) {
      throw new Error(parsed.description ?? `Telegram API call failed for sendDocument`);
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const meta = await this.call<TelegramFileResult>("getFile", { file_id: fileId });
    const response = await fetch(`${this.fileBase}/${meta.file_path}`);
    if (!response.ok) {
      throw new Error(`Unable to download Telegram file ${fileId}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  static withMainKeyboard(text: string, reply_markup: InlineKeyboardMarkup): { text: string; reply_markup: InlineKeyboardMarkup } {
    return { text, reply_markup };
  }
}
