import axios from "axios";
import { TelegramBot } from "../../../client/telegram.client";
import { SQLiteStorage } from "../../../storage/storage";
import { getSettings } from '../methods/getSettings'
import { setWebhook } from './setWebhook'
import { Localization } from "../../../utils/localization";

export class InstanceCommand {
  private setWebhook: setWebhook;
  private getSettings: getSettings

  constructor(
    private storage: SQLiteStorage,
    private bot: TelegramBot
  ) {
    this.setWebhook = new setWebhook(storage, bot);
    this.getSettings = new getSettings(storage, bot)
  }

  async execute (messageText: string, chatId: string, language: string = 'en'): Promise<{ status: string }> {
    console.log("[COMMANDS.instance] Handling command")
    try {
      const parts = messageText.split(' ');
      if (parts.length !== 3) {
        console.log("[COMMANDS.instance] Incorrect message format")
        await this.bot.send({
          chat_id: chatId,
          text: Localization.getInstanceFormatText(language)
        });
        return { status: "invalid_format" };
      }

      const idInstance = parts[1];
      const apiToken = parts[2];

      const response = await axios.get(
        `https://api.green-api.com/waInstance${idInstance}/getSettings/${apiToken}`
      );
      const settings = response.data;

      const idInstanceNumber = Number(idInstance);
      const user = await this.storage.findUser(chatId);
      const userName = user?.user_name || `user_${chatId}`;

      const instanceData = {
        idInstance: idInstanceNumber,
        apiTokenInstance: apiToken,
        name: userName,
        token: apiToken,
        settings: {
          chatId: chatId,
          incomingWebhook: settings.incomingWebhook,
          outgoingWebhook: settings.outgoingWebhook,
          stateWebhook: settings.stateWebhook
        }
      };

      await this.storage.updateUser(chatId, {
        idInstance: idInstanceNumber,
        apiTokenInstance: apiToken
      });

      console.log('[COMMANDS.instance] Updated instance for user:', { chatId, idInstance: idInstanceNumber });

      const setWebhook = await this.setWebhook.execute(instanceData);

      const message = Localization.getInstanceSuccessText(language, setWebhook ? process.env.WEBHOOK_URL : undefined);

      await this.bot.send({
        chat_id: chatId,
        text: message
      });

      console.log("[COMMANDS.instance] Instance saved")
      return { status: "instance_created" };

    } catch (error) {
      console.log("[COMMANDS.instance] Failed to handle instance command:", error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        let errorMessage = '';
        
        if (status === 401) {
          errorMessage = Localization.getMessage('invalid_credentials', language) || 
                        'Invalid instance ID or API token. Please check your credentials.';
        } else if (status === 404) {
          errorMessage = Localization.getMessage('instance_not_found', language) || 
                        'Instance not found. Please check your instance ID.';
        } else if (status === 429) {
          errorMessage = Localization.getMessage('rate_limit_exceeded', language) || 
                        'Rate limit exceeded. Please try again later.';
        } else {
          const errorBody = error.response?.data;
          if (errorBody && typeof errorBody === 'object') {
            errorMessage = `API Error ${status}: ${JSON.stringify(errorBody)}`;
          } else if (errorBody) {
            errorMessage = `API Error ${status}: ${errorBody}`;
          } else {
            errorMessage = Localization.getMessage('api_error', language) || 
                          `API returned error status: ${status}`;
          }
        }
        
        await this.bot.send({
          chat_id: chatId,
          text: errorMessage,
          parse_mode: "Markdown"
        });
        return { status: "api_error" };
      }
      
      if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        await this.bot.send({
          chat_id: chatId,
          text: Localization.getMessage('instance_already_linked', language)
        });
        return { status: "instance_already_exists" };
      }
      
      await this.bot.send({
        chat_id: chatId,
        text: Localization.getMessage('error_occurred', language)
      });
      
      return { status: "error" };
    }
  }
}