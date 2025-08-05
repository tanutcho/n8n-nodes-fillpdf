import { FillPdf } from '../../nodes/FillPdf/FillPdf.node';
import { IExecuteFunctions, INodeExecutionData, ILoadOptionsFunctions } from 'n8n-workflow';
import {
  SIMPLE_TEXT_FORM_PDF,
  CHECKBOX_RADIO_FORM_PDF,
  DROPDOWN_FORM_PDF,
  COMPLEX_FORM_PDF,
  CORRUPTED_PDF,
  SAMPLE_PDF_FIELDS,
  SAMPLE_FIELD_MAPPINGS,
  SAMPLE_INPUT_DATA,
  EXPECTED_OUTPUTS,
} from './sample-pdfs';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('FillPdf Integration Tests', () => {
  let fillPdfNode: FillPdf;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockLoadContext: jest.Mocked<ILoadOptionsFunctions>;
  let mockNode: any;

  beforeEach(() => {
    fillPdfNode = new FillPdf();
    
    mockNode = {
      id: 'test-node',
      name: 'Fill PDF Integration Test',
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

    mockLoadContext = {
      getNodeParameter: jest.fn(),
    } as any;

    // Setup default file system mocks
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
    mockFs.mkdirSync = jest.fn();
    mockFs.statSync = jest.fn().mockReturnValue({ size: 1000 } as any);
    
    mockPath.resolve = jest.fn().mockImplementation((p) => `/resolved${p}`);
    mockPath.dirname = jest.fn().mockImplementation((p) => p.substring(0, p.lastIndexOf('/')));

    jest.clearAllMocks();
  });

  describe('End-to-End PDF Processing', () => {
    it('should process simple text form PDF successfully', async () => {
      // Setup parameters
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/simple-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Setup input data
      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      
      // Mock file reading
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python script execution (this would normally be handled by the Python bridge)
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 filled pdf content').toString('base64'),
        metadata: {
          fieldCount: 2,
          processingTime: 500,
        },
      });

      // Mock field inspection
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue(SAMPLE_PDF_FIELDS.SIMPLE_TEXT_FORM);

      // Execute the node
      const result = await fillPdfNode.execute.call(mockContext);

      // Verify results
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      
      const outputData = result[0][0];
      expect(outputData.json.success).toBe(true);
      expect(outputData.json.fieldsProcessed).toBe(2);
      expect(outputData.binary?.pdf).toBeDefined();
      expect(outputData.binary?.pdf.mimeType).toBe('application/pdf');
    });

    it('should process complex form with mixed field types', async () => {
      // Setup parameters for complex form
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/complex-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.MIXED_TYPES };
          case 'outputFormat': return 'both';
          case 'outputPath': return '/output/filled-complex.pdf';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Setup input data
      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.COMPLEX]);
      
      // Mock expression evaluation
      mockContext.evaluateExpression
        .mockReturnValueOnce('Jane Smith') // fullName expression
        .mockReturnValueOnce('jane.smith@example.com') // email expression
        .mockReturnValueOnce(true); // agree expression

      // Mock file operations
      mockFs.readFileSync.mockReturnValue(Buffer.from(COMPLEX_FORM_PDF, 'base64'));

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 complex filled pdf').toString('base64'),
        metadata: {
          fieldCount: 4,
          processingTime: 1200,
        },
      });

      // Mock field inspection
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue(SAMPLE_PDF_FIELDS.COMPLEX_FORM);

      // Execute the node
      const result = await fillPdfNode.execute.call(mockContext);

      // Verify results
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      
      const outputData = result[0][0];
      expect(outputData.json.success).toBe(true);
      expect(outputData.json.fieldsProcessed).toBe(4);
      expect(outputData.json.outputPath).toBe('/resolved/output/filled-complex.pdf');
      expect(outputData.binary?.pdf).toBeDefined();
      
      // Verify file was written
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/resolved/output', { recursive: true });
    });

    it('should handle batch processing correctly', async () => {
      // Setup parameters for batch processing
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/batch-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/batch.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Setup batch input data
      mockContext.getInputData.mockReturnValue(SAMPLE_INPUT_DATA.BATCH);

      // Mock file operations
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution for batch
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn()
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('%PDF-1.4 batch item 1').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 300 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('%PDF-1.4 batch item 2').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 350 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('%PDF-1.4 batch item 3').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 280 },
        });

      // Execute the node
      const result = await fillPdfNode.execute.call(mockContext);

      // Verify batch results
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(3);
      
      // Check each batch item
      result[0].forEach((outputData, index) => {
        expect(outputData.json.success).toBe(true);
        expect(outputData.json.fieldsProcessed).toBe(2);
        expect(outputData.json.metadata.batch?.itemIndex).toBe(index + 1);
        expect(outputData.json.metadata.batch?.totalItems).toBe(3);
        expect(outputData.json.metadata.batchSummary?.totalItems).toBe(3);
        expect(outputData.json.metadata.batchSummary?.successfulItems).toBe(3);
        expect(outputData.json.metadata.batchSummary?.failedItems).toBe(0);
      });

      // Verify files were written for each batch item
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle corrupted PDF gracefully', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/corrupted.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(CORRUPTED_PDF, 'base64'));

      // Mock Python execution to fail
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid PDF format',
      });

      // Execute and expect error
      await expect(fillPdfNode.execute.call(mockContext)).rejects.toThrow('Invalid PDF format');
    });

    it('should handle missing fields with skipMissingFields option', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/simple-form.pdf';
          case 'fieldMappings': return {
            mapping: [
              ...SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT,
              { pdfFieldName: 'nonExistentField', valueSource: 'static', staticValue: 'test' },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: true };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock field inspection to return only existing fields
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue(SAMPLE_PDF_FIELDS.SIMPLE_TEXT_FORM);

      // Mock Python execution to succeed with partial fields
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 partial filled pdf').toString('base64'),
        metadata: {
          fieldCount: 2, // Only existing fields processed
          processingTime: 400,
        },
      });

      // Execute the node
      const result = await fillPdfNode.execute.call(mockContext);

      // Verify partial success
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      
      const outputData = result[0][0];
      expect(outputData.json.success).toBe(true);
      expect(outputData.json.fieldsProcessed).toBe(2); // Only existing fields
    });

    it('should handle continueOnFail mode correctly', async () => {
      mockContext.continueOnFail.mockReturnValue(true);
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/problematic.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Execute the node
      const result = await fillPdfNode.execute.call(mockContext);

      // Verify error handling
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      
      const outputData = result[0][0];
      expect(outputData.json.success).toBe(false);
      expect(outputData.json.error).toContain('File not found');
      expect(outputData.json.fieldsProcessed).toBe(0);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large PDF files efficiently', async () => {
      const largePdfData = 'x'.repeat(5 * 1024 * 1024); // 5MB base64 string
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/large-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(largePdfData));

      // Mock Python execution with realistic processing time
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        // Simulate processing time proportional to file size
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 large filled pdf').toString('base64'),
          metadata: {
            fieldCount: 2,
            processingTime: 2000,
          },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Verify performance
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle many field mappings efficiently', async () => {
      // Create many field mappings
      const manyMappings = Array.from({ length: 50 }, (_, i) => ({
        pdfFieldName: `field${i}`,
        valueSource: 'static' as const,
        staticValue: `value${i}`,
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/many-fields.pdf';
          case 'fieldMappings': return { mapping: manyMappings };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 many fields filled').toString('base64'),
        metadata: {
          fieldCount: 50,
          processingTime: 1500,
        },
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Verify performance and results
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.success).toBe(true);
      expect(result[0][0].json.fieldsProcessed).toBe(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent batch processing', async () => {
      const largeBatch = Array.from({ length: 10 }, (_, i) => ({
        json: {
          firstName: `User${i}`,
          lastName: `Test${i}`,
          email: `user${i}@example.com`,
        },
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/batch-form.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/batch.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue(largeBatch);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution for each batch item
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 batch item').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 200 },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Verify batch processing
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify all items processed successfully
      result[0].forEach((outputData, index) => {
        expect(outputData.json.success).toBe(true);
        expect(outputData.json.metadata.batch?.itemIndex).toBe(index + 1);
        expect(outputData.json.metadata.batch?.totalItems).toBe(10);
      });
    });
  });

  describe('Field Type Validation', () => {
    it('should handle text fields with length validation', async () => {
      const longTextMapping = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static' as const,
          staticValue: 'a'.repeat(100), // Exceeds typical max length
        },
      ];

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/text-form.pdf';
          case 'fieldMappings': return { mapping: longTextMapping };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock field inspection with max length
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue([
        {
          name: 'firstName',
          type: 'text',
          required: false,
          maxLength: 50,
        },
      ]);

      // Execute and expect validation error
      await expect(fillPdfNode.execute.call(mockContext)).rejects.toThrow('exceeds maximum length');
    });

    it('should handle checkbox field value conversion', async () => {
      const checkboxMappings = [
        {
          pdfFieldName: 'subscribe',
          valueSource: 'static' as const,
          staticValue: 'yes', // String that should convert to checkbox
        },
      ];

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/checkbox-form.pdf';
          case 'fieldMappings': return { mapping: checkboxMappings };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(CHECKBOX_RADIO_FORM_PDF, 'base64'));

      // Mock field inspection
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue(SAMPLE_PDF_FIELDS.CHECKBOX_RADIO_FORM);

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 checkbox filled').toString('base64'),
        metadata: { fieldCount: 1, processingTime: 300 },
      });

      // Execute the node
      const result = await fillPdfNode.execute.call(mockContext);

      // Verify checkbox conversion
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.success).toBe(true);

      // Verify the Python script was called with converted value
      expect(mockPythonBridge.prototype.executePythonScript).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldMappings: expect.objectContaining({
            subscribe: 'Yes', // Should be converted from 'yes' to 'Yes'
          }),
        })
      );
    });

    it('should handle dropdown field option validation', async () => {
      const dropdownMappings = [
        {
          pdfFieldName: 'country',
          valueSource: 'static' as const,
          staticValue: 'Germany', // Not in the available options
        },
      ];

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/dropdown-form.pdf';
          case 'fieldMappings': return { mapping: dropdownMappings };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: true, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(DROPDOWN_FORM_PDF, 'base64'));

      // Mock field inspection
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue(SAMPLE_PDF_FIELDS.DROPDOWN_FORM);

      // Execute and expect validation error
      await expect(fillPdfNode.execute.call(mockContext)).rejects.toThrow('Invalid dropdown value');
    });
  });

  describe('Dynamic Field Loading', () => {
    it('should load PDF fields dynamically for UI', async () => {
      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload') // pdfSource
        .mockReturnValueOnce('/test/dynamic-form.pdf'); // pdfFile

      mockFs.readFileSync.mockReturnValue(Buffer.from(COMPLEX_FORM_PDF, 'base64'));

      // Mock field inspection
      const mockFieldInspector = require('../../nodes/FillPdf/field-inspector').FieldInspector;
      mockFieldInspector.prototype.inspectPdfFields = jest.fn().mockResolvedValue(SAMPLE_PDF_FIELDS.COMPLEX_FORM);

      // Call the loadOptions method
      const fields = await fillPdfNode.methods!.loadOptions!.getPdfFields.call(mockLoadContext);

      // Verify field loading
      expect(fields).toHaveLength(4);
      expect(fields[0]).toEqual({
        name: expect.stringContaining('fullName'),
        value: 'fullName',
      });
      expect(fields[1]).toEqual({
        name: expect.stringContaining('email'),
        value: 'email',
      });
      expect(fields[2]).toEqual({
        name: expect.stringContaining('agree'),
        value: 'agree',
      });
      expect(fields[3]).toEqual({
        name: expect.stringContaining('gender'),
        value: 'gender',
      });
    });

    it('should handle field loading errors gracefully', async () => {
      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload') // pdfSource
        .mockReturnValueOnce('/test/invalid-form.pdf'); // pdfFile

      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Call the loadOptions method
      const fields = await fillPdfNode.methods!.loadOptions!.getPdfFields.call(mockLoadContext);

      // Should return empty array on error
      expect(fields).toEqual([]);
    });

    it('should return empty array when no PDF source provided', async () => {
      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload') // pdfSource
        .mockReturnValueOnce(''); // empty pdfFile

      // Call the loadOptions method
      const fields = await fillPdfNode.methods!.loadOptions!.getPdfFields.call(mockLoadContext);

      // Should return empty array
      expect(fields).toEqual([]);
    });
  });

  describe('Output Format Variations', () => {
    it('should handle binary output format', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/binary-output.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 binary output').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 400 },
      });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result[0][0].binary?.pdf).toBeDefined();
      expect(result[0][0].json.outputPath).toBeUndefined();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle file output format', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/file-output.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/file-result.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 file output').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 400 },
      });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result[0][0].binary).toBeUndefined();
      expect(result[0][0].json.outputPath).toBe('/resolved/output/file-result.pdf');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle both output format', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/both-output.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'both';
          case 'outputPath': return '/output/both-result.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 both output').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 400 },
      });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result[0][0].binary?.pdf).toBeDefined();
      expect(result[0][0].json.outputPath).toBe('/resolved/output/both-result.pdf');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });
});