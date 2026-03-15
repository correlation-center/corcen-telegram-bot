import { makeConfig } from 'lino-arguments';

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('bot-token', {
        type: 'string',
        describe: 'Telegram bot token (get from @BotFather)',
        default: getenv('BOT_TOKEN', ''),
      })
      .option('channel-username', {
        type: 'string',
        describe: 'Telegram channel username for publishing needs and resources',
        default: getenv('CHANNEL_USERNAME', '@CorrelationCenter'),
      })
      .option('bot-username', {
        type: 'string',
        describe: 'Bot username for mentions in messages (without @)',
        default: getenv('BOT_USERNAME', 'CorrelationCenterBot'),
      })
      .option('public-log-channel', {
        type: 'string',
        describe: 'Public log channel for transparent database change history',
        default: getenv('PUBLIC_LOG_CHANNEL', ''),
      })
      .option('public-log-tracing', {
        type: 'boolean',
        describe: 'Enable detailed logging traces',
        default: getenv('PUBLIC_LOG_TRACING', false),
      })
      .option('enable-reposts', {
        type: 'boolean',
        describe: 'Enable repost mode to forward user message and post metadata separately',
        default: getenv('ENABLE_REPOSTS', false),
      })
      .option('verbose', {
        type: 'boolean',
        describe: 'Enable verbose logging mode for debugging',
        default: getenv('VERBOSE', false),
      })
      .option('prompt-delay-ms', {
        type: 'number',
        describe: 'Delay (ms) before prompting user for description',
        default: getenv('PROMPT_DELAY_MS', 750),
      })
      .option('daily-limit-needs', {
        type: 'number',
        describe: 'Maximum needs per user per 24 hours',
        default: getenv('DAILY_LIMIT_NEEDS', 3),
      })
      .option('daily-limit-resources', {
        type: 'number',
        describe: 'Maximum resources per user per 24 hours',
        default: getenv('DAILY_LIMIT_RESOURCES', 3),
      })
      .option('migrate-limit', {
        type: 'number',
        describe: 'Maximum items to migrate per run',
        default: getenv('MIGRATE_LIMIT', 1),
      })
      .version(false)
      .help(false),
});

export default config;
