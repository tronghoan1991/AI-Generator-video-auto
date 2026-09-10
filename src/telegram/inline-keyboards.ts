export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "▶️ Start", callback_data: "menu:start" }],
      [
        { text: "🎛 Management", callback_data: "menu:management" },
        { text: "🎬 Video", callback_data: "menu:video" },
      ],
      [
        { text: "📋 Report", callback_data: "menu:report" },
        { text: "📊 Statistics", callback_data: "menu:statistics" },
      ],
      [
        { text: "❌ Cancel", callback_data: "menu:cancel" },
        { text: "⚡ Wake", callback_data: "menu:wake" },
      ],
    ],
  };
}

export function managementKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📥 Submit job", callback_data: "jobs:submit" },
        { text: "📜 Recent jobs", callback_data: "jobs:recent" },
      ],
      [
        { text: "🔄 Refresh", callback_data: "menu:report" },
        { text: "⬅️ Back", callback_data: "menu:start" },
      ],
    ],
  };
}

export function cancelKeyboard(jobIds: string[]): InlineKeyboardMarkup {
  const rows = jobIds.map((jobId) => [{ text: `🛑 ${jobId}`, callback_data: `jobs:cancel:${jobId}` }]);
  rows.push([{ text: "⬅️ Back", callback_data: "menu:start" }]);
  return { inline_keyboard: rows };
}

export function recentJobsKeyboard(jobIds: string[]): InlineKeyboardMarkup {
  const rows = jobIds.map((jobId) => [{ text: `ℹ️ ${jobId}`, callback_data: `jobs:details:${jobId}` }]);
  rows.push([{ text: "⬅️ Back", callback_data: "menu:start" }]);
  return { inline_keyboard: rows };
}
