import * as fc from 'fast-check';

// Feature: smart-crop-advisory, Property 26: Missing environment variable terminates startup with descriptive error

const REQUIRED_ENV_VARS = [
  'PORT',
  'JWT_SECRET',
] as const;

/**
 * Creates a complete set of valid environment variables
 */
function createValidEnv(): Record<string, string> {
  return {
    PORT: '3000',
    JWT_SECRET: 'test-secret-key',
  };
}

describe('Config startup validation - Property 26', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let exitCode: number | undefined;
  let errorMessages: string[];

  beforeAll(() => {
    // Save original functions once
    originalExit = process.exit;
    originalConsoleError = console.error;
  });

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset captured values
    exitCode = undefined;
    errorMessages = [];

    // Mock process.exit to capture exit code
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    // Mock console.error to capture error messages
    console.error = (...args: any[]) => {
      errorMessages.push(args.join(' '));
    };

    // Clear the module cache to ensure fresh load
    delete require.cache[require.resolve('./config')];
  });

  afterEach(() => {
    // Restore original environment and functions
    process.env = originalEnv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    
    // Clear the module cache again
    delete require.cache[require.resolve('./config')];
  });

  // Property 26: Missing environment variable terminates startup with descriptive error
  // Validates: Requirements 10.4
  
  it('should terminate with exit code 1 and descriptive error when any required env var is missing', () => {
    fc.assert(
      fc.property(
        // Generate a random index to select which env var to omit
        fc.integer({ min: 0, max: REQUIRED_ENV_VARS.length - 1 }),
        (indexToOmit) => {
          const missingVar = REQUIRED_ENV_VARS[indexToOmit];
          const env = createValidEnv();
          
          // Remove the selected environment variable
          delete env[missingVar];

          // Set up the environment
          process.env = { ...env };

          // Reset captured values for this iteration
          exitCode = undefined;
          errorMessages = [];

          // Try to require the config module - it should call process.exit(1)
          try {
            // Clear the module cache before requiring
            delete require.cache[require.resolve('./config')];
            require('./config');
            
            // If we reach here, the config didn't exit as expected
            throw new Error('Config module did not call process.exit');
          } catch (error: any) {
            // Expected to throw because of mocked process.exit
            if (!error.message.includes('process.exit')) {
              throw error;
            }
          }

          // Assert that process.exit was called with code 1
          expect(exitCode).toBe(1);

          // Assert that the error message identifies the missing variable
          const allErrors = errorMessages.join('\n');
          expect(allErrors).toContain('[FATAL]');
          expect(allErrors).toContain('Missing required environment variable');
          expect(allErrors).toContain(missingVar);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should successfully load config when all required env vars are present', () => {
    const env = createValidEnv();
    process.env = { ...env };

    // Reset captured values
    exitCode = undefined;
    errorMessages = [];

    // Clear the module cache before requiring
    delete require.cache[require.resolve('./config')];
    
    // Require the config module - it should not call process.exit
    const config = require('./config').config;

    // When all env vars are present, the config should load successfully
    expect(exitCode).toBeUndefined();
    expect(errorMessages.length).toBe(0);
    expect(config).toBeDefined();
    expect(config.port).toBe(3000);
  });
});
