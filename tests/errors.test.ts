import {
  FillPdfError,
  FillPdfConfigError,
  FillPdfDataError,
  FillPdfPythonError,
  FillPdfRuntimeError,
  FillPdfValidationError,
  ErrorUtils,
  FillPdfErrorType,
  ErrorSeverity,
} from '../nodes/FillPdf/errors';
import { INode } from 'n8n-workflow';

// Mock node for testing
const mockNode: INode = {
  id: 'test-node',
  name: 'Test FillPdf Node',
  type: 'fillPdf',
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
};

describe('FillPdf Error System', () => {
  describe('FillPdfError (Base Class)', () => {
    it('should create basic error with default values', () => {
      const error = new FillPdfError(mockNode, 'Test error message', 'data');

      expect(error.message).toContain('Data Error: Test error message');
      expect(error.errorType).toBe('data');
      expect(error.severity).toBe('medium');
      expect(error.isRecoverable).toBe(true);
      expect(error.errorCode).toMatch(/^FILLPDF_DAT_/);
      expect(error.troubleshootingHints).toHaveLength(2);
    });

    it('should create error with custom options', () => {
      const customHints = [
        { issue: 'Custom issue', solution: 'Custom solution', priority: 'high' as const },
      ];

      const error = new FillPdfError(mockNode, 'Custom error', 'config', {
        severity: 'critical',
        isRecoverable: false,
        troubleshootingHints: customHints,
        errorCode: 'CUSTOM_ERROR_123',
      });

      expect(error.severity).toBe('critical');
      expect(error.isRecoverable).toBe(false);
      expect(error.troubleshootingHints).toEqual(customHints);
      expect(error.errorCode).toBe('CUSTOM_ERROR_123');
    });

    it('should include context information in message', () => {
      const error = new FillPdfError(mockNode, 'Test error', 'runtime', {
        context: {
          component: 'TestComponent',
          operation: 'testOperation',
          fieldName: 'testField',
        },
      });

      expect(error.message).toContain('(Component: TestComponent)');
      expect(error.message).toContain('(Operation: testOperation)');
      expect(error.message).toContain('(Field: testField)');
    });

    it('should preserve original error stack', () => {
      const originalError = new Error('Original error');
      const error = new FillPdfError(mockNode, 'Wrapped error', 'runtime', {
        context: { originalError },
      });

      expect(error.stack).toBe(originalError.stack);
    });

    it('should generate error details', () => {
      const error = new FillPdfError(mockNode, 'Test error', 'validation', {
        context: {
          component: 'TestComponent',
          operation: 'testOperation',
          itemIndex: 5,
        },
      });

      const details = error.getErrorDetails();
      
      expect(details).toContain('Error Code:');
      expect(details).toContain('Type: validation');
      expect(details).toContain('Severity: medium');
      expect(details).toContain('Component: TestComponent');
      expect(details).toContain('Item Index: 5');
    });

    it('should generate troubleshooting guide', () => {
      const customHints = [
        { issue: 'High priority issue', solution: 'High priority solution', priority: 'high' as const },
        { issue: 'Low priority issue', solution: 'Low priority solution', priority: 'low' as const },
        { issue: 'Medium priority issue', solution: 'Medium priority solution', priority: 'medium' as const },
      ];

      const error = new FillPdfError(mockNode, 'Test error', 'data', {
        troubleshootingHints: customHints,
      });

      const guide = error.getTroubleshootingGuide();
      
      expect(guide).toContain('1. High priority issue');
      expect(guide).toContain('2. Medium priority issue');
      expect(guide).toContain('3. Low priority issue');
    });
  });

  describe('FillPdfConfigError', () => {
    it('should create config error with parameter details', () => {
      const error = new FillPdfConfigError(mockNode, 'Invalid parameter', undefined, {
        parameterName: 'pdfSource',
        expectedType: 'string',
      });

      expect(error.errorType).toBe('config');
      expect(error.severity).toBe('high');
      expect(error.isRecoverable).toBe(true);
      expect(error.message).toContain('Configuration Error');
      expect(error.troubleshootingHints[0].issue).toContain('Invalid parameter: pdfSource');
      expect(error.troubleshootingHints[0].solution).toContain('type: string');
    });

    it('should use custom troubleshooting hints', () => {
      const customHints = [
        { issue: 'Custom config issue', solution: 'Custom config solution', priority: 'high' as const },
      ];

      const error = new FillPdfConfigError(mockNode, 'Custom config error', undefined, {
        troubleshootingHints: customHints,
      });

      expect(error.troubleshootingHints).toEqual(customHints);
    });
  });

  describe('FillPdfRuntimeError', () => {
    it('should create runtime error with system details', () => {
      const systemError = new Error('System failure');
      const error = new FillPdfRuntimeError(mockNode, 'Runtime failure', undefined, {
        systemError,
        exitCode: 1,
      });

      expect(error.errorType).toBe('runtime');
      expect(error.severity).toBe('critical');
      expect(error.isRecoverable).toBe(false);
      expect(error.errorContext.originalError).toBe(systemError);
      expect(error.errorContext.exitCode).toBe(1);
    });
  });

  describe('FillPdfDataError', () => {
    it('should create data error with format details', () => {
      const error = new FillPdfDataError(mockNode, 'Invalid data format', undefined, {
        dataType: 'PDF',
        expectedFormat: 'application/pdf',
        actualFormat: 'text/plain',
      });

      expect(error.errorType).toBe('data');
      expect(error.severity).toBe('medium');
      expect(error.isRecoverable).toBe(true);
      expect(error.troubleshootingHints[0].solution).toContain('Expected format: application/pdf');
      expect(error.troubleshootingHints[0].solution).toContain('received: text/plain');
    });
  });

  describe('FillPdfPythonError', () => {
    it('should create python error with environment details', () => {
      const error = new FillPdfPythonError(mockNode, 'Python not found', undefined, {
        pythonExecutable: '/usr/bin/python3',
        missingLibrary: 'fillpdf',
        pythonVersion: '2.7.0',
      });

      expect(error.errorType).toBe('python');
      expect(error.severity).toBe('critical');
      expect(error.isRecoverable).toBe(false);
      expect(error.errorContext.pythonExecutable).toBe('/usr/bin/python3');
      
      const hints = error.troubleshootingHints;
      expect(hints.some(h => h.issue.includes('Missing Python library: fillpdf'))).toBe(true);
      expect(hints.some(h => h.issue.includes('Python executable not found'))).toBe(true);
      expect(hints.some(h => h.issue.includes('Incompatible Python version'))).toBe(true);
    });

    it('should provide default hints when none specified', () => {
      const error = new FillPdfPythonError(mockNode, 'Python error');

      expect(error.troubleshootingHints.length).toBeGreaterThan(0);
      expect(error.troubleshootingHints.some(h => h.issue.includes('Python environment'))).toBe(true);
      expect(error.troubleshootingHints.some(h => h.issue.includes('fillpdf library'))).toBe(true);
    });
  });

  describe('FillPdfValidationError', () => {
    it('should create validation error with field details', () => {
      const error = new FillPdfValidationError(mockNode, 'Field validation failed', undefined, {
        fieldName: 'firstName',
        expectedType: 'text',
        actualType: 'number',
        missingFields: ['lastName', 'email'],
        invalidFields: ['invalidField'],
      });

      expect(error.errorType).toBe('validation');
      expect(error.severity).toBe('medium');
      expect(error.isRecoverable).toBe(true);
      expect(error.errorContext.fieldName).toBe('firstName');
      
      const hints = error.troubleshootingHints;
      expect(hints.some(h => h.issue.includes('Missing required fields: lastName, email'))).toBe(true);
      expect(hints.some(h => h.issue.includes('Invalid field mappings: invalidField'))).toBe(true);
      expect(hints.some(h => h.issue.includes('Field type mismatch for "firstName"'))).toBe(true);
    });
  });

  describe('ErrorUtils', () => {
    it('should create appropriate error types', () => {
      const configError = ErrorUtils.createError(mockNode, 'Config error', 'config');
      const runtimeError = ErrorUtils.createError(mockNode, 'Runtime error', 'runtime');
      const dataError = ErrorUtils.createError(mockNode, 'Data error', 'data');
      const pythonError = ErrorUtils.createError(mockNode, 'Python error', 'python');
      const validationError = ErrorUtils.createError(mockNode, 'Validation error', 'validation');

      expect(configError).toBeInstanceOf(FillPdfConfigError);
      expect(runtimeError).toBeInstanceOf(FillPdfRuntimeError);
      expect(dataError).toBeInstanceOf(FillPdfDataError);
      expect(pythonError).toBeInstanceOf(FillPdfPythonError);
      expect(validationError).toBeInstanceOf(FillPdfValidationError);
    });

    it('should wrap existing errors', () => {
      const originalError = new Error('Original error message');
      const wrappedError = ErrorUtils.wrapError(mockNode, originalError, 'runtime', {
        component: 'TestComponent',
      });

      expect(wrappedError).toBeInstanceOf(FillPdfRuntimeError);
      expect(wrappedError.message).toContain('Original error message');
      expect(wrappedError.errorContext.originalError).toBe(originalError);
      expect(wrappedError.errorContext.component).toBe('TestComponent');
    });

    it('should check if error is recoverable', () => {
      const recoverableError = new FillPdfConfigError(mockNode, 'Config error');
      const nonRecoverableError = new FillPdfRuntimeError(mockNode, 'Runtime error');
      const regularError = new Error('Regular error');

      expect(ErrorUtils.isRecoverable(recoverableError)).toBe(true);
      expect(ErrorUtils.isRecoverable(nonRecoverableError)).toBe(false);
      expect(ErrorUtils.isRecoverable(regularError)).toBe(false);
    });

    it('should get error severity', () => {
      const highSeverityError = new FillPdfConfigError(mockNode, 'Config error');
      const criticalSeverityError = new FillPdfRuntimeError(mockNode, 'Runtime error');
      const regularError = new Error('Regular error');

      expect(ErrorUtils.getErrorSeverity(highSeverityError)).toBe('high');
      expect(ErrorUtils.getErrorSeverity(criticalSeverityError)).toBe('critical');
      expect(ErrorUtils.getErrorSeverity(regularError)).toBe('medium');
    });

    it('should format error for logging', () => {
      const fillPdfError = new FillPdfConfigError(mockNode, 'Config error', {
        component: 'TestComponent',
      });
      const regularError = new Error('Regular error');

      const fillPdfLog = ErrorUtils.formatErrorForLogging(fillPdfError);
      const regularLog = ErrorUtils.formatErrorForLogging(regularError);

      expect(fillPdfLog).toContain('Error Code:');
      expect(fillPdfLog).toContain('Troubleshooting:');
      expect(fillPdfLog).toContain('Component: TestComponent');

      expect(regularLog).toContain('Error: Regular error');
    });
  });

  describe('Error Type Defaults', () => {
    const errorTypes: FillPdfErrorType[] = ['config', 'runtime', 'data', 'python', 'validation'];

    it('should have appropriate default severities', () => {
      const severityMap: Record<FillPdfErrorType, ErrorSeverity> = {
        config: 'high',
        runtime: 'critical',
        data: 'medium',
        python: 'critical',
        validation: 'medium',
      };

      errorTypes.forEach(type => {
        const error = new FillPdfError(mockNode, 'Test', type);
        expect(error.severity).toBe(severityMap[type]);
      });
    });

    it('should have appropriate default recoverability', () => {
      const recoverabilityMap: Record<FillPdfErrorType, boolean> = {
        config: true,
        runtime: false,
        data: true,
        python: false,
        validation: true,
      };

      errorTypes.forEach(type => {
        const error = new FillPdfError(mockNode, 'Test', type);
        expect(error.isRecoverable).toBe(recoverabilityMap[type]);
      });
    });

    it('should generate unique error codes', () => {
      const error1 = new FillPdfError(mockNode, 'Test 1', 'config');
      const error2 = new FillPdfError(mockNode, 'Test 2', 'config');

      expect(error1.errorCode).not.toBe(error2.errorCode);
      expect(error1.errorCode).toMatch(/^FILLPDF_CON_/);
      expect(error2.errorCode).toMatch(/^FILLPDF_CON_/);
    });

    it('should include timestamps in error context', () => {
      const beforeTime = new Date().toISOString();
      const error = new FillPdfError(mockNode, 'Test', 'data');
      const afterTime = new Date().toISOString();

      expect(error.errorContext.timestamp).toBeDefined();
      expect(new Date(error.errorContext.timestamp!).getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(new Date(error.errorContext.timestamp!).getTime()).toBeLessThanOrEqual(afterTime);
    });
  });
});