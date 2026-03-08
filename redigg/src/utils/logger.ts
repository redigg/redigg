import chalk from 'chalk';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

class Logger {
  private scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const scopeStr = chalk.gray(`[${this.scope}]`);
    
    let levelStr = '';
    switch (level) {
      case 'info':
        levelStr = chalk.blue('INFO');
        break;
      case 'warn':
        levelStr = chalk.yellow('WARN');
        break;
      case 'error':
        levelStr = chalk.red('ERROR');
        break;
      case 'debug':
        levelStr = chalk.magenta('DEBUG');
        break;
      case 'success':
        levelStr = chalk.green('SUCCESS');
        break;
    }

    let log = `${chalk.dim(timestamp)} ${levelStr} ${scopeStr} ${message}`;
    if (meta) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  }

  public info(message: string, meta?: any) {
    console.log(this.formatMessage('info', message, meta));
  }

  public warn(message: string, meta?: any) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  public error(message: string, meta?: any) {
    console.error(this.formatMessage('error', message, meta));
  }

  public debug(message: string, meta?: any) {
    if (process.env.DEBUG) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  public success(message: string, meta?: any) {
    console.log(this.formatMessage('success', message, meta));
  }
}

export const createLogger = (scope: string) => new Logger(scope);
