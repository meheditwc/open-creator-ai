/* Tiny dependency-free logger with pretty, aligned output. */

const ESC = '\u001b[';

const COLORS = {
  reset: `${ESC}0m`,
  dim: `${ESC}2m`,
  cyan: `${ESC}36m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  red: `${ESC}31m`,
  magenta: `${ESC}35m`,
};

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

function paint(color: keyof typeof COLORS, text: string): string {
  if (!useColor) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function stamp(): string {
  return paint('dim', new Date().toISOString().slice(11, 19));
}

export const logger = {
  info(message: string) {
    console.log(`${stamp()} ${paint('cyan', 'info')}  ${message}`);
  },
  success(message: string) {
    console.log(`${stamp()} ${paint('green', 'ready')} ${message}`);
  },
  warn(message: string) {
    console.log(`${stamp()} ${paint('yellow', 'warn')}  ${message}`);
  },
  error(message: string) {
    console.error(`${stamp()} ${paint('red', 'error')} ${message}`);
  },
  debug(message: string) {
    if (process.env.OPENCREATOR_DEBUG) {
      console.log(`${stamp()} ${paint('magenta', 'debug')} ${message}`);
    }
  },
};
