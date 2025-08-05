import { FillPdf } from '../../nodes/FillPdf/FillPdf.node';
import { IExecuteFunctions } from 'n8n-workflow';
import { CORRUPTED_PDF, SIMPLE_TEXT_FORM_PDF, SAMPLE_FIELD_MAPPINGS, SAMPLE_INPUT_DATA } from './sample-pdfs';
import { FillPdfConfigError, FillPdfRuntimeError, FillPdfPythonError } from '../../nodes/FillPdf/errors';
import * as fs from 'fs';

// Mock file system operations
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FillPdf Error Scenario Integration Tests', () => {
  let fillPdfNode: FillPdf;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockNode: any;

  beforeEach(() => {
    fillPdfNode = new FillPdf();
    
    mockNode = {
      id: 'error-test-node',
      name: 'Fill PDF Error Test',
      type: 'fillPdf',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    };

    mockContext = {
      getNode: jest.fn().mockReturnValue(mockNode),
      getNodeParameter: jest.fn(),
      getInputData: jest.fn(),
      evaluateExpression: jest.fn(),
      continueOnFail: jest.fn().mockReturnValue(false),
    } as any;

    // Setup default mocks
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
    mockFs.mkdirSync = jest.fn();
    jest.spyOn(mockFs, 'statSync').mockReturnValue({ size: 1000 } as any);

    jest.clearAllMocks();
  });

  describe('Configuration Errors', () => {
    it('should handle missing PDF source parameter', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return undefined;
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow(FillPdfConfigError);
    });

    it('should handle invalid PDF source type', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'invalid-source';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Unsupported PDF source type');
    });

    it('should handle missing field mappings', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: [] };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('No field mappings configured');
    });

    it('should handle missing output path for file output', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return undefined;
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 test').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 100 },
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Output path is required when saving to file');
    });

    it('should handle invalid field mapping structure', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: [{ invalid: 'mapping' }] };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow();
    });
  });

  describe('File System Errors', () => {
    it('should handle PDF file not found', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/nonexistent/file.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory');
        (error as any).code = 'ENOENT';
        throw error;
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Failed to read PDF file');
    });

    it('should handle permission denied errors', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/restricted/file.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Failed to read PDF file');
    });

    it('should handle output directory creation failure', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/readonly/output.pdf';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied, mkdir');
      });

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 test').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 100 },
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Failed to save PDF to file');
    });

    it('should handle disk full errors', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/test.pdf';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));
      mockFs.writeFileSync.mockImplementation(() => {
        const error = new Error('ENOSPC: no space left on device');
        (error as any).code = 'ENOSPC';
        throw error;
      });

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 test').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 100 },
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Failed to save PDF to file');
    });
  });

  describe('PDF Processing Errors', () => {
    it('should handle corrupted PDF files', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/corrupted.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { validateFields: true };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(CORRUPTED_PDF, 'base64'));

      // Mock field inspection to fail
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockRejectedValue(
        new Error('Invalid PDF format: corrupted file structure')
      );

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Invalid PDF format');
    });

    it('should handle PDF without form fields', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/no-fields.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { validateFields: true };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock field inspection to return no fields
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue([]);

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow("Field 'firstName' not found in PDF");
    });

    it('should handle PDF field type mismatches', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/type-mismatch.pdf';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'numericField',
                valueSource: 'static',
                staticValue: 'not-a-number',
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return { validateFields: true };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock field inspection with numeric field
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue([
        {
          name: 'numericField',
          type: 'text',
          required: true,
          validation: { type: 'number' },
        },
      ]);

      // Mock Python execution to fail with validation error
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: false,
        error: 'Field validation failed: numericField expects numeric value',
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Field validation failed');
    });

    it('should handle password-protected PDFs', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/protected.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution to fail with password error
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: false,
        error: 'PDF is password protected and cannot be processed',
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('PDF is password protected');
    });
  });

  describe('Python Environment Errors', () => {
    it('should handle Python not found', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python bridge to fail with Python not found
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockRejectedValue(
        new FillPdfPythonError(mockNode, 'Python executable not found', {
          pythonExecutable: 'python3',
          missingLibrary: undefined,
        })
      );

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow(FillPdfPythonError);
    });

    it('should handle fillpdf library not installed', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python bridge to fail with missing library
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockRejectedValue(
        new FillPdfPythonError(mockNode, 'fillpdf library not found', {
          pythonExecutable: 'python3',
          missingLibrary: 'fillpdf',
        })
      );

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow(FillPdfPythonError);
    });

    it('should handle Python script timeout', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python bridge to timeout
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new FillPdfRuntimeError(mockNode, 'Python script execution timeout', {
          component: 'Python Bridge',
          operation: 'executePythonScript',
          timeout: 30000,
        });
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Python script execution timeout');
    });

    it('should handle Python version incompatibility', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python bridge to fail with version error
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockRejectedValue(
        new FillPdfPythonError(mockNode, 'Incompatible Python version', {
          pythonExecutable: 'python2',
          pythonVersion: '2.7.18',
        })
      );

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow(FillPdfPythonError);
    });
  });

  describe('Expression Evaluation Errors', () => {
    it('should handle invalid expressions', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'firstName',
                valueSource: 'expression',
                expression: '{{invalid.syntax.here}}',
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock expression evaluation to fail
      mockContext.evaluateExpression.mockImplementation(() => {
        throw new Error('Cannot read property \'syntax\' of undefined');
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Expression evaluation failed');
    });

    it('should handle expressions that return undefined', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'firstName',
                valueSource: 'expression',
                expression: '{{$json.nonExistentField}}',
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock expression evaluation to return undefined
      mockContext.evaluateExpression.mockReturnValue(undefined);

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 test').toString('base64'),
        metadata: { fieldCount: 1, processingTime: 100 },
      });

      const result = await fillPdfNode.execute.call(mockContext);

      // Should handle undefined by converting to empty string
      expect(result[0][0].json.success).toBe(true);
      expect(mockPythonBridge.prototype.executePythonScript).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldMappings: expect.objectContaining({
            firstName: '', // undefined should be converted to empty string
          }),
        })
      );
    });

    it('should handle circular reference in expressions', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/form.pdf';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'firstName',
                valueSource: 'expression',
                expression: '{{$json.circular}}',
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      // Create circular reference in input data
      const circularData: any = { json: {} };
      circularData.json.circular = circularData.json;
      mockContext.getInputData.mockReturnValue([circularData]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock expression evaluation to fail with circular reference
      mockContext.evaluateExpression.mockImplementation(() => {
        throw new Error('Converting circular structure to JSON');
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Expression evaluation failed');
    });
  });

  describe('Continue on Fail Mode', () => {
    it('should continue processing on configuration errors', async () => {
      mockContext.continueOnFail.mockReturnValue(true);
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/nonexistent/file.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.success).toBe(false);
      expect(result[0][0].json.error).toContain('File not found');
      expect(result[0][0].json.fieldsProcessed).toBe(0);
    });

    it('should continue processing on batch item failures', async () => {
      mockContext.continueOnFail.mockReturnValue(true);
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/batch-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/batch.pdf';
          case 'options': return {};
          default: return undefined;
        }
      });

      // Create batch with mixed success/failure scenarios
      const mixedBatch = [
        SAMPLE_INPUT_DATA.SIMPLE,
        { json: { firstName: null, lastName: null } }, // Will cause issues
        SAMPLE_INPUT_DATA.SIMPLE,
      ];
      mockContext.getInputData.mockReturnValue(mixedBatch);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution to fail on second item
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn()
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('%PDF-1.4 item 1').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 100 },
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Invalid field values: null values not allowed',
        })
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('%PDF-1.4 item 3').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 100 },
        });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result[0]).toHaveLength(3);
      expect(result[0][0].json.success).toBe(true);
      expect(result[0][1].json.success).toBe(false);
      expect(result[0][2].json.success).toBe(true);

      // Check batch summary reflects mixed results
      const batchSummary = (result[0][0].json.metadata as any).batchSummary;
      expect(batchSummary?.successfulItems).toBe(2);
      expect(batchSummary?.failedItems).toBe(1);
    });

    it('should provide detailed error information in continue mode', async () => {
      mockContext.continueOnFail.mockReturnValue(true);
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/error-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution to fail with detailed error
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockRejectedValue(
        new FillPdfRuntimeError(mockNode, 'Detailed processing error', {
          component: 'PDF Processor',
          operation: 'fillPdf',
          itemIndex: 0,
          originalError: new Error('Underlying system error'),
        })
      );

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result[0][0].json.success).toBe(false);
      expect(result[0][0].json.error).toContain('Detailed processing error');
      expect(result[0][0].json.errorType).toBe('runtime');
      expect(result[0][0].json.errorCode).toBeDefined();
      expect(result[0][0].json.troubleshooting).toBeDefined();
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory exhaustion gracefully', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/memory-intensive.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution to fail with memory error
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockRejectedValue(
        new FillPdfRuntimeError(mockNode, 'Memory allocation failed', {
          component: 'Python Script',
          operation: 'processPdf',
          systemError: new Error('MemoryError: Unable to allocate memory'),
        })
      );

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Memory allocation failed');
    });

    it('should handle concurrent processing limits', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        json: { firstName: `User${i}`, lastName: `Test${i}` },
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/concurrent-limit.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue(largeBatch);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution to occasionally fail due to resource limits
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      let callCount = 0;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount > 50) {
          throw new FillPdfRuntimeError(mockNode, 'Resource limit exceeded', {
            component: 'System',
            operation: 'processBatch',
            resourceType: 'concurrent_processes',
          });
        }
        return {
          success: true,
          data: Buffer.from(`%PDF-1.4 item ${callCount}`).toString('base64'),
          metadata: { fieldCount: 2, processingTime: 50 },
        };
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Resource limit exceeded');
    });
  });

  describe('Network-Related Errors (URL Source)', () => {
    it('should handle network timeouts for URL source', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'url';
          case 'pdfUrl': return 'https://slow-server.example.com/form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      // Mock axios to timeout
      const mockAxios = require('axios');
      mockAxios.get = jest.fn().mockRejectedValue(new Error('timeout of 30000ms exceeded'));

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Request timeout - the PDF download took too long');
    });

    it('should handle invalid URLs', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'url';
          case 'pdfUrl': return 'not-a-valid-url';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('Invalid PDF URL');
    });

    it('should handle HTTP 404 errors', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'url';
          case 'pdfUrl': return 'https://example.com/nonexistent.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      // Mock axios to return 404
      const mockAxios = require('axios');
      mockAxios.get = jest.fn().mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow('HTTP 404: Not Found');
    });
  });
});