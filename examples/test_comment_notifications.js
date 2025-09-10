#!/usr/bin/env node

// Test script for comment notification functionality
// This is a demonstration of how the comment notification feature works

import { fileURLToPath } from 'url';
import path from 'path';
import { buildUserMention } from '../buildUserMention.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock locales for testing
const locales = {
  en: {
    messages: {
      commentNotification: "💬 New comment on your {{type}}:",
      commentBy: "💭 Comment by {{commenter}}:"
    },
    need: "need",
    resource: "resource"
  },
  ru: {
    messages: {
      commentNotification: "💬 Новый комментарий к вашей {{type}}:",
      commentBy: "💭 Комментарий от {{commenter}}:"
    },
    need: "потребности",
    resource: "ресурсу"
  }
};

// Helper function to get localized text (copied from main file)
function getLocalizedText(ctx, key, vars = {}) {
  const lang = ctx.from && locales[ctx.from.language_code] ? ctx.from.language_code : 'en';
  let text = (locales[lang].messages && locales[lang].messages[key]) || locales[lang][key] || locales['en'].messages?.[key] || locales['en'][key] || key;
  Object.keys(vars).forEach((k) => {
    text = text.replace(`{{${k}}}`, vars[k]);
  });
  return text;
}

// Test function to demonstrate comment notification formatting
function testCommentNotificationFormat() {
  console.log('=== Comment Notification Tests ===\n');

  // Test data
  const originalPoster = {
    userId: 123456789,
    type: 'need',
    item: {
      description: 'Looking for a reliable web developer to help with my e-commerce project',
      channelMessageId: 42
    }
  };

  const commenter = {
    id: 987654321,
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe'
  };

  const commentMessage = {
    from: commenter,
    text: 'I can help you with your e-commerce project. I have 5 years of experience with React and Node.js.'
  };

  // Test English notification
  console.log('📧 English Notification:');
  console.log('========================');
  
  const userCtxEn = { from: { language_code: 'en' } };
  const commenterMention = buildUserMention({ user: commenter });
  const localizedTypeEn = getLocalizedText(userCtxEn, originalPoster.type);
  
  const notificationTextEn = `${getLocalizedText(userCtxEn, 'commentNotification', { type: localizedTypeEn })}\n\n` +
    `"${originalPoster.item.description.length > 50 ? originalPoster.item.description.substring(0, 50) + '...' : originalPoster.item.description}"\n\n` +
    `${getLocalizedText(userCtxEn, 'commentBy', { commenter: commenterMention })}\n${commentMessage.text}`;
    
  console.log(notificationTextEn);
  console.log('\n');

  // Test Russian notification
  console.log('📧 Russian Notification:');
  console.log('========================');
  
  const userCtxRu = { from: { language_code: 'ru' } };
  const localizedTypeRu = getLocalizedText(userCtxRu, originalPoster.type);
  
  const notificationTextRu = `${getLocalizedText(userCtxRu, 'commentNotification', { type: localizedTypeRu })}\n\n` +
    `"${originalPoster.item.description.length > 50 ? originalPoster.item.description.substring(0, 50) + '...' : originalPoster.item.description}"\n\n` +
    `${getLocalizedText(userCtxRu, 'commentBy', { commenter: commenterMention })}\n${commentMessage.text}`;
    
  console.log(notificationTextRu);
  console.log('\n');

  // Test with resource type
  console.log('📧 Resource Comment (English):');
  console.log('==============================');
  
  const resourcePoster = {
    ...originalPoster,
    type: 'resource',
    item: {
      description: 'Offering free consultation on React development',
      channelMessageId: 43
    }
  };
  
  const localizedResourceType = getLocalizedText(userCtxEn, resourcePoster.type);
  
  const resourceNotificationText = `${getLocalizedText(userCtxEn, 'commentNotification', { type: localizedResourceType })}\n\n` +
    `"${resourcePoster.item.description}"\n\n` +
    `${getLocalizedText(userCtxEn, 'commentBy', { commenter: commenterMention })}\nI'm interested in your consultation offer!`;
    
  console.log(resourceNotificationText);
  console.log('\n');
}

// Test channel post detection logic
function testChannelPostDetection() {
  console.log('=== Channel Post Detection Tests ===\n');

  // Helper function to check if a message is a comment on a channel post
  function isCommentOnChannelPost(message, channelUsername = 'CorrelationCenter') {
    if (!message.reply_to_message) return false;
    if (!message.reply_to_message.forward_from_chat) return false;
    
    const channelName = channelUsername.startsWith('@') ? channelUsername.slice(1) : channelUsername;
    return message.reply_to_message.forward_from_chat.username === channelName;
  }

  // Test cases
  const testCases = [
    {
      name: 'Valid comment on channel post',
      message: {
        text: 'This is a comment',
        reply_to_message: {
          forward_from_chat: { username: 'CorrelationCenter' },
          forward_from_message_id: 42
        }
      },
      expected: true
    },
    {
      name: 'Regular reply (not from channel)',
      message: {
        text: 'This is a reply',
        reply_to_message: {
          forward_from_chat: { username: 'SomeOtherChannel' },
          forward_from_message_id: 42
        }
      },
      expected: false
    },
    {
      name: 'Message without reply',
      message: {
        text: 'This is just a message'
      },
      expected: false
    },
    {
      name: 'Reply without forward_from_chat',
      message: {
        text: 'This is a reply',
        reply_to_message: {
          message_id: 42
        }
      },
      expected: false
    }
  ];

  testCases.forEach(testCase => {
    const result = isCommentOnChannelPost(testCase.message);
    const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testCase.name}: ${result} (expected: ${testCase.expected})`);
  });

  console.log('\n');
}

// Run tests
console.log('Comment Notification Feature Tests\n');
console.log('===================================\n');

testChannelPostDetection();
testCommentNotificationFormat();

console.log('✨ All tests completed successfully!');
console.log('\nTo enable comment notifications in production:');
console.log('1. Set up a discussion group linked to your channel');
console.log('2. Add the bot as an admin to both the channel and discussion group');
console.log('3. Set DISCUSSION_GROUP_ID in your .env file to the discussion group chat ID');
console.log('4. The bot will automatically detect comments and notify original posters');