// Platform abstraction layer for cross-platform consensus sync

/**
 * Abstract base class for platform adapters
 */
class PlatformAdapter {
  constructor(config) {
    this.config = config;
    this.platformName = 'abstract';
  }

  /**
   * Post a message to the platform channel
   * @param {string} content - Message content
   * @param {Object} options - Platform-specific options
   * @returns {Promise<Object>} Posted message info with ID
   */
  async postMessage(content, options = {}) {
    throw new Error('postMessage must be implemented by subclass');
  }

  /**
   * Edit an existing message
   * @param {string} messageId - Platform-specific message ID
   * @param {string} content - New content
   * @param {Object} options - Platform-specific options
   * @returns {Promise<boolean>} Success status
   */
  async editMessage(messageId, content, options = {}) {
    throw new Error('editMessage must be implemented by subclass');
  }

  /**
   * Delete a message
   * @param {string} messageId - Platform-specific message ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(messageId) {
    throw new Error('deleteMessage must be implemented by subclass');
  }

  /**
   * Get user information
   * @param {string} userId - Platform-specific user ID
   * @returns {Promise<Object>} User info
   */
  async getUserInfo(userId) {
    throw new Error('getUserInfo must be implemented by subclass');
  }

  /**
   * Get channel message history
   * @param {string} channelId - Platform-specific channel ID
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise<Array>} Array of messages
   */
  async getChannelHistory(channelId, options = {}) {
    throw new Error('getChannelHistory must be implemented by subclass');
  }

  /**
   * Build user mention for the platform
   * @param {Object} user - User object
   * @returns {string} Platform-specific mention format
   */
  buildUserMention(user) {
    throw new Error('buildUserMention must be implemented by subclass');
  }
}

/**
 * Telegram platform adapter
 */
class TelegramAdapter extends PlatformAdapter {
  constructor(bot, channelUsername) {
    super({ bot, channelUsername });
    this.bot = bot;
    this.channelUsername = channelUsername;
    this.platformName = 'telegram';
  }

  async postMessage(content, options = {}) {
    try {
      let post;
      if (options.fileId) {
        post = await this.bot.telegram.sendPhoto(
          this.channelUsername,
          options.fileId,
          { caption: content, parse_mode: 'HTML' }
        );
      } else {
        post = await this.bot.telegram.sendMessage(
          this.channelUsername,
          content,
          { parse_mode: 'HTML' }
        );
      }
      return {
        messageId: post.message_id,
        platform: this.platformName,
        success: true
      };
    } catch (error) {
      console.error('Telegram postMessage error:', error);
      return { success: false, error: error.message };
    }
  }

  async editMessage(messageId, content, options = {}) {
    try {
      if (options.fileId) {
        await this.bot.telegram.editMessageCaption(
          this.channelUsername,
          messageId,
          undefined,
          content,
          { parse_mode: 'HTML' }
        );
      } else {
        await this.bot.telegram.editMessageText(
          this.channelUsername,
          messageId,
          undefined,
          content,
          { parse_mode: 'HTML' }
        );
      }
      return true;
    } catch (error) {
      const desc = error.response?.description || '';
      if (/message is not modified/i.test(desc)) {
        return true; // Consider "not modified" as success
      }
      console.error('Telegram editMessage error:', error);
      return false;
    }
  }

  async deleteMessage(messageId) {
    try {
      await this.bot.telegram.deleteMessage(this.channelUsername, messageId);
      return true;
    } catch (error) {
      const desc = error.response?.description || error.message;
      if (/message to delete not found/i.test(desc)) {
        return true; // Already deleted
      }
      console.error('Telegram deleteMessage error:', error);
      return false;
    }
  }

  async getUserInfo(userId) {
    try {
      const chat = await this.bot.telegram.getChat(userId);
      return {
        id: chat.id,
        username: chat.username,
        first_name: chat.first_name,
        last_name: chat.last_name,
        platform: this.platformName
      };
    } catch (error) {
      console.error('Telegram getUserInfo error:', error);
      return null;
    }
  }

  async getChannelHistory(channelId, options = {}) {
    // Telegram doesn't provide easy channel history access
    // This would need to be implemented if needed
    throw new Error('getChannelHistory not implemented for Telegram');
  }

  buildUserMention(user) {
    if (user.username) {
      return `<a href="https://t.me/${user.username}">@${user.username}</a>`;
    } else if (user.first_name) {
      return `<a href="tg://user?id=${user.id}">${user.first_name}${user.last_name ? ' ' + user.last_name : ''}</a>`;
    } else {
      return `<a href="tg://user?id=${user.id}">User ${user.id}</a>`;
    }
  }
}

/**
 * VK platform adapter (placeholder implementation)
 * This would use vk-io or similar library for actual VK API integration
 */
class VKAdapter extends PlatformAdapter {
  constructor(config) {
    super(config);
    this.platformName = 'vk';
    // TODO: Initialize VK API client
    // this.vk = new VK({ token: config.token });
  }

  async postMessage(content, options = {}) {
    // TODO: Implement VK message posting
    // Example using vk-io:
    // const post = await this.vk.api.wall.post({
    //   owner_id: this.config.groupId,
    //   message: content,
    //   attachments: options.attachments
    // });
    console.log('VK postMessage not implemented yet');
    return { success: false, error: 'Not implemented' };
  }

  async editMessage(messageId, content, options = {}) {
    // TODO: Implement VK message editing
    console.log('VK editMessage not implemented yet');
    return false;
  }

  async deleteMessage(messageId) {
    // TODO: Implement VK message deletion
    console.log('VK deleteMessage not implemented yet');
    return false;
  }

  async getUserInfo(userId) {
    // TODO: Implement VK user info retrieval
    console.log('VK getUserInfo not implemented yet');
    return null;
  }

  async getChannelHistory(channelId, options = {}) {
    // TODO: Implement VK channel history retrieval
    console.log('VK getChannelHistory not implemented yet');
    return [];
  }

  buildUserMention(user) {
    // TODO: Implement VK user mention format
    return `@id${user.id}(${user.first_name || 'User'})`;
  }
}

export { PlatformAdapter, TelegramAdapter, VKAdapter };