import { TelegramBot } from "../../../client/telegram.client";
import { SQLiteStorage } from "../../../storage/storage";
import { Localization } from "../../../utils/localization";

export class SetChatCommand {
  constructor(
    private storage: SQLiteStorage,
    private bot: TelegramBot
  ) {}

async execute(messageText: string, chatId: string, language: string = 'en'): Promise<{ status: string }> {
    try {

      if (!chatId || !this.isValidChatIdFormat(chatId)) {
        console.error(`[COMMANDS.set_chat] Invalid chatId parameter: ${chatId}`);
        return { status: "critical_error" };
      }

      const params = messageText.split(' ').slice(1);

      if (params.length === 0) {
        const message = this.getInvalidFormatMessage(language);
        await this.sendMessageWithFallback(chatId, message);
        return { status: "invalid_format" };
      }

      const targetChatId = params[0];

      if (!this.isValidChatIdFormat(targetChatId)) {
        const message = this.getInvalidFormatMessage(language);
        await this.sendMessageWithFallback(chatId, message);
        return { status: "invalid_chat_id_format" };
      }

      if (targetChatId === chatId) {
        const message = language === 'ru' || language === 'kz' ? 
          "Вы указали свой собственный <code>chat_id</code>.\n\n" +
          "Вы уже получаете сообщения здесь.\n" +
          "Укажите <code>chat_id</code` другого чата или канала для пересылки." :
          "You specified your own <code>chat_id</code>.\n\n" +
          "You already receive messages here.\n" +
          "Specify a different chat or channel ID for forwarding.";
        
        await this.sendMessageWithFallback(chatId, message);
        return { status: "self_chat_id" };
      }

      const testMessage = language === 'ru' || language === 'kz' ? 
        "Проверка доступа: этот чат был выбран для пересылки сообщений из WhatsApp" :
        "Access test: this chat has been selected for WhatsApp message forwarding";

      try {
        await this.bot.send({
          chat_id: targetChatId,
          text: testMessage
        });
      } catch (error) {
        console.log("[COMMANDS.set_chat] Target chat validation failed:", error);
        
        const message = language === 'ru' || language === 'kz' ? 
          "Не удалось отправить сообщение в указанный чат\n\n" +
          "Возможные причины:\n" +
          "• Бот не добавлен в этот чат/канал\n" +
          "• Указан неверный <code>chat_id</code>\n" +
          "• Чат не существует\n\n" +
          "Убедитесь, что:\n" +
          "1. Бот добавлен в целевой чат/канал\n" +
          "2. Бот имеет права на отправку сообщений\n" +
          "3. <code>Chat_id</code> указан верно" :
          "Failed to send message to the specified chat\n\n" +
          "Possible reasons:\n" +
          "• Bot is not added to this chat/channel\n" +
          "• Invalid <code>chat_id</code>\n" +
          "• Chat doesn't exist\n\n" +
          "Make sure:\n" +
          "1. Bot is added to the target chat/channel\n" +
          "2. Bot has permission to send messages\n" +
          "3. <code>Chat_id</code> is correct";
        
        await this.sendMessageWithFallback(chatId, message);
        return { status: "chat_not_accessible" };
      }

      await this.storage.setTargetChatId(chatId, targetChatId);
      
      const message = language === 'ru' || language === 'kz' ? 
        "Настройки обновлены!\n\n" +
        "Все сообщения из WhatsApp теперь будут пересылаться в:\n" +
        `<code>${targetChatId}</code>\n\n` +
        "Чтобы сбросить настройку и получать сообщения себе:\n" +
        "/resetchat" :
        "Settings updated!\n\n" +
        "All WhatsApp messages will now be forwarded to:\n" +
        `<code>${targetChatId}</code>\n\n` +
        "To reset settings and receive messages yourself:\n" +
        "/resetchat";
      
      await this.sendMessageWithFallback(chatId, message, 'HTML');

      return { status: "target_set" };
    } catch (error) {
      console.log("[COMMANDS.set_chat] Failed to set target chat");
      console.error("[COMMANDS.set_chat] CRITICAL: Cannot send error message to user", chatId);
      
      return { status: "critical_error" };
    }
  }

  private isValidChatIdFormat(chatId: string): boolean {
    return /^(-?\d+)$/.test(chatId) || /^@[a-zA-Z0-9_]+$/.test(chatId);
  }

  private getInvalidFormatMessage(language: string): string {
    return language === 'ru' || language === 'kz' ? 
      "Неверный формат <code>chat_id</code>\n\n" +
      "<code>Chat_id</code> может быть:\n" +
      "• Числом (для групп/каналов): <code>-1001234567890</code>\n" + 
      "• Юзернеймом (для чатов): <code>@username</code>\n" +
      "• Личным ID пользователя\n\n" +
      "Примеры:\n" +
      "<code>/setchat -1001234567890</code>\n" +
      "<code>/setchat @username</code>\n" +
      "<code>/setchat 123456789</code>" :
      "Invalid <code>chat_id</code> format\n\n" +
      "<code>Chat_id</code> can be:\n" +
      "• Number (for groups/channels): <code>-1001234567890</code>\n" + 
      "• Username (for chats): <code>@username</code>\n" +
      "• Personal user ID\n\n" +
      "Examples:\n" +
      "<code>/setchat -1001234567890</code>\n" +
      "<code>/setchat @username</code>\n" +
      "<code>/setchat 123456789</code>";
  }

  private async sendMessageWithFallback(chatId: string, text: string, parse_mode?: string): Promise<boolean> {
    try {
      await this.bot.send({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML"
      });
      return true;
    } catch (error) {
      console.error(`[COMMANDS.set_chat] CRITICAL: Cannot send message to chat ${chatId}:`, error);
      return false;
    }
  }
}