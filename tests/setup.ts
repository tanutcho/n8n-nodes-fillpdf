// Jest setup file for FillPdf node tests

// Mock n8n-workflow module
jest.mock('n8n-workflow', () => ({
  NodeOperationError: class MockNodeOperationError extends Error {
    constructor(_node: any, message: string, _options?: any) {
      super(message);
      this.name = 'NodeOperationError';
    }
  },
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.env for consistent testing
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);