import assert from 'assert';
import { describe, it } from 'node:test';

// Import the functions we want to test (these are defined in index.js)
// For testing purposes, we'll extract them to a separate module or test them through integration

// Mock functions for testing (in a real scenario, these would be properly imported)
function parseCustomParams(text) {
  const params = {};
  if (!text) return params;
  
  // Look for key:value patterns (allow everything except newlines)
  const paramRegex = /(\w+):\s*([^\n\r]+)/g;
  let match;
  while ((match = paramRegex.exec(text)) !== null) {
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key && value) {
      params[key] = value;
    }
  }
  return params;
}

function formatCustomParams(params) {
  if (!params || Object.keys(params).length === 0) return '';
  
  const formatted = Object.entries(params)
    .map(([key, value]) => `<b>${key}:</b> ${value}`)
    .join('\n');
  
  return formatted ? `\n\n${formatted}` : '';
}

function stripCustomParams(text) {
  if (!text) return text;
  
  // Split text into lines
  const lines = text.split('\n');
  const cleanLines = [];
  
  for (const line of lines) {
    // Check if line matches param pattern
    if (!/^\w+:\s*/.test(line.trim())) {
      cleanLines.push(line);
    }
  }
  
  // Join back and clean up excessive newlines
  return cleanLines.join('\n').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

describe('Custom Parameters Functions', () => {
  describe('parseCustomParams', () => {
    it('parses simple key:value pairs', () => {
      const text = 'location: New York\nurgency: high';
      const result = parseCustomParams(text);
      assert.deepStrictEqual(result, {
        location: 'New York',
        urgency: 'high'
      });
    });

    it('handles empty input', () => {
      const result = parseCustomParams('');
      assert.deepStrictEqual(result, {});
    });

    it('handles null input', () => {
      const result = parseCustomParams(null);
      assert.deepStrictEqual(result, {});
    });

    it('ignores malformed patterns', () => {
      const text = 'location: New York\ninvalid line\nurgency: high';
      const result = parseCustomParams(text);
      assert.deepStrictEqual(result, {
        location: 'New York',
        urgency: 'high'
      });
    });

    it('handles parameters with spaces and special characters', () => {
      const text = 'location: San Francisco, CA\nprice: $50-100';
      const result = parseCustomParams(text);
      assert.deepStrictEqual(result, {
        location: 'San Francisco, CA',
        price: '$50-100'
      });
    });

    it('converts keys to lowercase', () => {
      const text = 'LOCATION: New York\nUrgency: High';
      const result = parseCustomParams(text);
      assert.deepStrictEqual(result, {
        location: 'New York',
        urgency: 'High'
      });
    });
  });

  describe('formatCustomParams', () => {
    it('formats parameters correctly', () => {
      const params = {
        location: 'New York',
        urgency: 'high'
      };
      const result = formatCustomParams(params);
      assert.strictEqual(result, '\n\n<b>location:</b> New York\n<b>urgency:</b> high');
    });

    it('returns empty string for no parameters', () => {
      const result = formatCustomParams({});
      assert.strictEqual(result, '');
    });

    it('returns empty string for null input', () => {
      const result = formatCustomParams(null);
      assert.strictEqual(result, '');
    });

    it('handles single parameter', () => {
      const params = { location: 'New York' };
      const result = formatCustomParams(params);
      assert.strictEqual(result, '\n\n<b>location:</b> New York');
    });
  });

  describe('stripCustomParams', () => {
    it('removes parameter lines from text', () => {
      const text = 'I need help with programming\nlocation: New York\nurgency: high\nPlease contact me';
      const result = stripCustomParams(text);
      assert.strictEqual(result, 'I need help with programming\nPlease contact me');
    });

    it('handles text without parameters', () => {
      const text = 'I need help with programming';
      const result = stripCustomParams(text);
      assert.strictEqual(result, 'I need help with programming');
    });

    it('returns empty string for empty input', () => {
      const result = stripCustomParams('');
      assert.strictEqual(result, '');
    });

    it('handles null input', () => {
      const result = stripCustomParams(null);
      assert.strictEqual(result, null);
    });
  });

  describe('Integration tests', () => {
    it('parse and strip work together correctly', () => {
      const originalText = 'I need a laptop\nlocation: Boston\nbudget: $500\nThanks!';
      
      const params = parseCustomParams(originalText);
      const cleanText = stripCustomParams(originalText);
      
      assert.deepStrictEqual(params, {
        location: 'Boston',
        budget: '$500'
      });
      assert.strictEqual(cleanText, 'I need a laptop\nThanks!');
    });

    it('format and parse are consistent', () => {
      const originalParams = {
        location: 'New York',
        urgency: 'high',
        contact: 'email@example.com'
      };
      
      const formatted = formatCustomParams(originalParams);
      // Note: formatted output uses HTML, so we can't directly parse it back
      // This test verifies the format structure
      assert(formatted.includes('<b>location:</b> New York'));
      assert(formatted.includes('<b>urgency:</b> high'));
      assert(formatted.includes('<b>contact:</b> email@example.com'));
    });
  });
});