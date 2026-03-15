import assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { makeConfig } from 'lino-arguments';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to build config the same way as config.js but with custom argv
function buildConfig(argv = ['node', 'test.js']) {
  return makeConfig({
    yargs: ({ yargs, getenv }) =>
      yargs
        .option('bot-token', {
          type: 'string',
          describe: 'Telegram bot token',
          default: getenv('BOT_TOKEN', ''),
        })
        .option('channel-username', {
          type: 'string',
          describe: 'Telegram channel username',
          default: getenv('CHANNEL_USERNAME', '@CorrelationCenter'),
        })
        .option('bot-username', {
          type: 'string',
          describe: 'Bot username for mentions',
          default: getenv('BOT_USERNAME', 'CorrelationCenterBot'),
        })
        .option('public-log-channel', {
          type: 'string',
          describe: 'Public log channel',
          default: getenv('PUBLIC_LOG_CHANNEL', ''),
        })
        .option('public-log-tracing', {
          type: 'boolean',
          describe: 'Enable logging traces',
          default: getenv('PUBLIC_LOG_TRACING', false),
        })
        .option('enable-reposts', {
          type: 'boolean',
          describe: 'Enable repost mode',
          default: getenv('ENABLE_REPOSTS', false),
        })
        .option('verbose', {
          type: 'boolean',
          describe: 'Enable verbose logging',
          default: getenv('VERBOSE', false),
        })
        .option('prompt-delay-ms', {
          type: 'number',
          describe: 'Delay before prompt',
          default: getenv('PROMPT_DELAY_MS', 750),
        })
        .option('daily-limit-needs', {
          type: 'number',
          describe: 'Max needs per 24h',
          default: getenv('DAILY_LIMIT_NEEDS', 3),
        })
        .option('daily-limit-resources', {
          type: 'number',
          describe: 'Max resources per 24h',
          default: getenv('DAILY_LIMIT_RESOURCES', 3),
        })
        .option('migrate-limit', {
          type: 'number',
          describe: 'Max items to migrate',
          default: getenv('MIGRATE_LIMIT', 1),
        })
        .version(false)
        .help(false),
    argv,
    lenv: { enabled: false },
  });
}

describe('config', () => {
  const savedEnv = {};

  beforeEach(() => {
    // Save and clear relevant env vars
    const keys = [
      'BOT_TOKEN', 'CHANNEL_USERNAME', 'BOT_USERNAME',
      'PUBLIC_LOG_CHANNEL', 'PUBLIC_LOG_TRACING', 'ENABLE_REPOSTS',
      'VERBOSE', 'PROMPT_DELAY_MS', 'DAILY_LIMIT_NEEDS',
      'DAILY_LIMIT_RESOURCES', 'MIGRATE_LIMIT',
    ];
    for (const key of keys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe('default values', () => {
    it('has correct defaults when no env vars or CLI args', () => {
      const config = buildConfig();
      assert.strictEqual(config.botToken, '');
      assert.strictEqual(config.channelUsername, '@CorrelationCenter');
      assert.strictEqual(config.botUsername, 'CorrelationCenterBot');
      assert.strictEqual(config.publicLogChannel, '');
      assert.strictEqual(config.publicLogTracing, false);
      assert.strictEqual(config.enableReposts, false);
      assert.strictEqual(config.verbose, false);
      assert.strictEqual(config.promptDelayMs, 750);
      assert.strictEqual(config.dailyLimitNeeds, 3);
      assert.strictEqual(config.dailyLimitResources, 3);
      assert.strictEqual(config.migrateLimit, 1);
    });
  });

  describe('CLI arguments', () => {
    it('overrides defaults with CLI arguments', () => {
      const config = buildConfig([
        'node', 'test.js',
        '--bot-token', 'test-token-123',
        '--channel-username', '@TestChannel',
        '--bot-username', 'TestBot',
        '--verbose',
        '--prompt-delay-ms', '500',
        '--daily-limit-needs', '5',
        '--daily-limit-resources', '10',
      ]);
      assert.strictEqual(config.botToken, 'test-token-123');
      assert.strictEqual(config.channelUsername, '@TestChannel');
      assert.strictEqual(config.botUsername, 'TestBot');
      assert.strictEqual(config.verbose, true);
      assert.strictEqual(config.promptDelayMs, 500);
      assert.strictEqual(config.dailyLimitNeeds, 5);
      assert.strictEqual(config.dailyLimitResources, 10);
    });

    it('handles boolean flags correctly', () => {
      const config = buildConfig([
        'node', 'test.js',
        '--public-log-tracing',
        '--enable-reposts',
      ]);
      assert.strictEqual(config.publicLogTracing, true);
      assert.strictEqual(config.enableReposts, true);
    });
  });

  describe('environment variables', () => {
    it('reads values from environment variables', () => {
      process.env.BOT_TOKEN = 'env-token-456';
      process.env.CHANNEL_USERNAME = '@EnvChannel';
      process.env.BOT_USERNAME = 'EnvBot';
      process.env.VERBOSE = 'true';
      process.env.PROMPT_DELAY_MS = '1000';

      const config = buildConfig();
      assert.strictEqual(config.botToken, 'env-token-456');
      assert.strictEqual(config.channelUsername, '@EnvChannel');
      assert.strictEqual(config.botUsername, 'EnvBot');
      assert.strictEqual(config.verbose, true);
      assert.strictEqual(config.promptDelayMs, 1000);
    });

    it('CLI arguments take priority over environment variables', () => {
      process.env.BOT_TOKEN = 'env-token';
      process.env.CHANNEL_USERNAME = '@EnvChannel';

      const config = buildConfig([
        'node', 'test.js',
        '--bot-token', 'cli-token',
        '--channel-username', '@CliChannel',
      ]);
      assert.strictEqual(config.botToken, 'cli-token');
      assert.strictEqual(config.channelUsername, '@CliChannel');
    });
  });

  describe('.lenv file loading', () => {
    const lenvPath = path.join(__dirname, 'test-config.lenv');

    afterEach(() => {
      try { fs.unlinkSync(lenvPath); } catch {}
    });

    it('loads configuration from .lenv file', () => {
      fs.writeFileSync(lenvPath, [
        'BOT_TOKEN: lenv-token-789',
        'CHANNEL_USERNAME: @LenvChannel',
        'BOT_USERNAME: LenvBot',
        'VERBOSE: true',
        'PROMPT_DELAY_MS: 2000',
        'DAILY_LIMIT_NEEDS: 7',
      ].join('\n'));

      const config = makeConfig({
        yargs: ({ yargs, getenv }) =>
          yargs
            .option('bot-token', { type: 'string', default: getenv('BOT_TOKEN', '') })
            .option('channel-username', { type: 'string', default: getenv('CHANNEL_USERNAME', '@CorrelationCenter') })
            .option('bot-username', { type: 'string', default: getenv('BOT_USERNAME', 'CorrelationCenterBot') })
            .option('verbose', { type: 'boolean', default: getenv('VERBOSE', false) })
            .option('prompt-delay-ms', { type: 'number', default: getenv('PROMPT_DELAY_MS', 750) })
            .option('daily-limit-needs', { type: 'number', default: getenv('DAILY_LIMIT_NEEDS', 3) })
            .version(false)
            .help(false),
        argv: ['node', 'test.js'],
        lenv: { path: lenvPath },
      });

      assert.strictEqual(config.botToken, 'lenv-token-789');
      assert.strictEqual(config.channelUsername, '@LenvChannel');
      assert.strictEqual(config.botUsername, 'LenvBot');
      assert.strictEqual(config.verbose, true);
      assert.strictEqual(config.promptDelayMs, 2000);
      assert.strictEqual(config.dailyLimitNeeds, 7);
    });

    it('CLI arguments override .lenv values', () => {
      fs.writeFileSync(lenvPath, [
        'BOT_TOKEN: lenv-token',
        'CHANNEL_USERNAME: @LenvChannel',
      ].join('\n'));

      const config = makeConfig({
        yargs: ({ yargs, getenv }) =>
          yargs
            .option('bot-token', { type: 'string', default: getenv('BOT_TOKEN', '') })
            .option('channel-username', { type: 'string', default: getenv('CHANNEL_USERNAME', '@CorrelationCenter') })
            .version(false)
            .help(false),
        argv: ['node', 'test.js', '--bot-token', 'cli-token'],
        lenv: { path: lenvPath },
      });

      assert.strictEqual(config.botToken, 'cli-token');
      assert.strictEqual(config.channelUsername, '@LenvChannel');
    });
  });
});
