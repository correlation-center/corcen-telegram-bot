// Complete VK adapter implementation using vk-io library

import { VK } from 'vk-io';
import { PlatformAdapter } from './platform-adapter.js';

/**
 * VK platform adapter using vk-io library
 */
class VKAdapter extends PlatformAdapter {
  constructor(config) {
    super(config);
    this.platformName = 'vk';
    
    // Initialize VK API client
    this.vk = new VK({
      token: config.token,
      apiVersion: '5.131'
    });
    
    this.groupId = config.groupId; // VK group ID for posting
    this.ownerId = config.ownerId || (-Math.abs(this.groupId)); // Negative for groups
    
    // VK-specific configuration
    this.config = {
      ...config,
      postAsGroup: config.postAsGroup !== false, // Post on behalf of group
      enableComments: config.enableComments !== false,
      enableLikes: config.enableLikes !== false
    };
  }

  /**
   * Initialize VK adapter and verify credentials
   */
  async initialize() {
    try {
      // Test API connection
      const groupInfo = await this.vk.api.groups.getById({
        group_id: this.groupId
      });
      
      console.log(`VK adapter initialized for group: ${groupInfo[0].name}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize VK adapter:', error);
      return false;
    }
  }

  /**
   * Post a message to VK group wall
   */
  async postMessage(content, options = {}) {
    try {
      const postParams = {
        owner_id: this.ownerId,
        message: this.convertToVKFormat(content),
        from_group: this.config.postAsGroup ? 1 : 0
      };

      // Handle attachments (images, etc.)
      if (options.fileId) {
        // For VK, we would need to upload the file first
        // This is a simplified version - actual implementation would need file upload
        postParams.attachments = options.fileId;
      }

      // Handle additional VK-specific options
      if (options.attachments) {
        postParams.attachments = options.attachments;
      }

      if (options.publish_date) {
        postParams.publish_date = options.publish_date;
      }

      const response = await this.vk.api.wall.post(postParams);
      
      return {
        messageId: response.post_id,
        platform: this.platformName,
        success: true,
        vkResponse: response
      };
    } catch (error) {
      console.error('VK postMessage error:', error);
      return { 
        success: false, 
        error: error.message,
        errorCode: error.code 
      };
    }
  }

  /**
   * Edit an existing VK wall post
   */
  async editMessage(messageId, content, options = {}) {
    try {
      const editParams = {
        owner_id: this.ownerId,
        post_id: messageId,
        message: this.convertToVKFormat(content)
      };

      // Handle attachments for edit
      if (options.attachments) {
        editParams.attachments = options.attachments;
      }

      await this.vk.api.wall.edit(editParams);
      return true;
    } catch (error) {
      console.error('VK editMessage error:', error);
      
      // Check for "no changes" type errors
      if (error.code === 224) { // Post not found or no access
        return false;
      }
      
      return false;
    }
  }

  /**
   * Delete a VK wall post
   */
  async deleteMessage(messageId) {
    try {
      await this.vk.api.wall.delete({
        owner_id: this.ownerId,
        post_id: messageId
      });
      return true;
    } catch (error) {
      const errorCode = error.code;
      
      // Handle common VK error codes
      if (errorCode === 15) { // Access denied
        console.warn(`Cannot delete VK post ${messageId}: access denied`);
        return false;
      } else if (errorCode === 210) { // Post not found
        console.warn(`VK post ${messageId} not found (may already be deleted)`);
        return true; // Consider as success
      }
      
      console.error('VK deleteMessage error:', error);
      return false;
    }
  }

  /**
   * Get VK user information
   */
  async getUserInfo(userId) {
    try {
      const users = await this.vk.api.users.get({
        user_ids: userId,
        fields: 'screen_name,photo_50'
      });

      if (users && users.length > 0) {
        const user = users[0];
        return {
          id: user.id,
          username: user.screen_name,
          first_name: user.first_name,
          last_name: user.last_name,
          photo: user.photo_50,
          platform: this.platformName
        };
      }
      
      return null;
    } catch (error) {
      console.error('VK getUserInfo error:', error);
      return null;
    }
  }

  /**
   * Get VK group wall history
   */
  async getChannelHistory(channelId, options = {}) {
    try {
      const params = {
        owner_id: channelId || this.ownerId,
        count: options.limit || 20,
        offset: options.offset || 0,
        filter: options.filter || 'owner', // owner, others, all
        fields: 'attachments'
      };

      const response = await this.vk.api.wall.get(params);
      
      return response.items.map(post => ({
        id: post.id,
        date: new Date(post.date * 1000), // VK uses Unix timestamp
        text: post.text,
        attachments: post.attachments,
        platform: this.platformName,
        originalPost: post
      }));
    } catch (error) {
      console.error('VK getChannelHistory error:', error);
      return [];
    }
  }

  /**
   * Build VK user mention
   */
  buildUserMention(user) {
    if (user.username) {
      return `@${user.username}`;
    } else if (user.id) {
      const name = user.first_name || 'User';
      return `@id${user.id}(${name})`;
    } else {
      return `@id${user.id || 'unknown'}(${user.first_name || 'User'})`;
    }
  }

  /**
   * Convert HTML-like formatting to VK format
   */
  convertToVKFormat(content) {
    if (!content) return '';
    
    // Convert basic HTML tags to VK format
    return content
      // Remove HTML italic tags and convert to VK format if needed
      .replace(/<\/?i>/g, '') // VK doesn't support italic in posts
      // Convert HTML links to VK format
      .replace(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g, '$2 ($1)')
      // Remove other HTML tags
      .replace(/<[^>]*>/g, '')
      // Clean up extra whitespace
      .trim();
  }

  /**
   * Upload file to VK for use in posts
   */
  async uploadFile(fileBuffer, filename, type = 'photo') {
    try {
      let uploadResponse;
      
      if (type === 'photo') {
        // Get upload server for photos
        const uploadServer = await this.vk.api.photos.getWallUploadServer({
          group_id: this.groupId
        });
        
        // Upload file to VK servers
        uploadResponse = await this.vk.upload.wall({
          source: {
            value: fileBuffer,
            filename: filename
          }
        });
        
        // Save uploaded photo
        const saveResponse = await this.vk.api.photos.saveWallPhoto({
          group_id: this.groupId,
          photo: uploadResponse.photo,
          server: uploadResponse.server,
          hash: uploadResponse.hash
        });
        
        if (saveResponse && saveResponse.length > 0) {
          const photo = saveResponse[0];
          return `photo${photo.owner_id}_${photo.id}`;
        }
      }
      
      return null;
    } catch (error) {
      console.error('VK file upload error:', error);
      return null;
    }
  }

  /**
   * Get VK group information
   */
  async getGroupInfo() {
    try {
      const groups = await this.vk.api.groups.getById({
        group_id: this.groupId,
        fields: 'members_count,description'
      });
      
      return groups[0];
    } catch (error) {
      console.error('VK getGroupInfo error:', error);
      return null;
    }
  }

  /**
   * Check if user is a member of the group
   */
  async isGroupMember(userId) {
    try {
      const response = await this.vk.api.groups.isMember({
        group_id: this.groupId,
        user_id: userId
      });
      
      return response === 1;
    } catch (error) {
      console.error('VK isGroupMember error:', error);
      return false;
    }
  }
}

export { VKAdapter };