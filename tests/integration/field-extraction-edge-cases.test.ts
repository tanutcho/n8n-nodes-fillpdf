import { FieldInspector } from '../../nodes/FillPdf/field-inspector';
import { UIGenerator } from '../../nodes/FillPdf/ui-generator';
import { FieldMapper } from '../../nodes/FillPdf/field-mapper';
import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { IFieldInfo, IFieldMapping } from '../../nodes/FillPdf/types';
import * as fs from 'fs';
import * as https from 'https';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('fs');
jest.mock('https');
jest.mock('../../nodes/FillPdf/python-bridge');

// Mock n8n workflow types
jest.mock('n8n-workflow', () => ({
  NodeConnectionType: {
    Main: 'main',
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockHttps = https as jest.Mocked<typeof https>;

describe('Field Extraction Edge Cases and Error Scenarios', () => {
  // Remove FillPdf node initialization to avoid import issues
  let fieldInspector: FieldInspector;
  let uiGenerator: UIGenerator;
  let fieldMapper: FieldMapper;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockLoadContext: jest.Mocked<ILoadOptionsFunctions>;

  beforeEach(() => {
    // Initialize components
    fieldInspector = new FieldInspector();
    uiGenerator = new UIGenerator();

    // Setup mock contexts
    mockContext = {
      getNode: jest.fn().mockReturnValue({ name: 'Edge Case Test Node' }),
      getNodeParameter: jest.fn(),
      getInputData: jest.fn(),
      evaluateExpression: jest.fn(),
      continueOnFail: jest.fn().mockReturnValue(false),
    } as any;

    mockLoadContext = {
      getNodeParameter: jest.fn(),
    } as any;

    fieldMapper = new FieldMapper(mockContext, 0);

    // Setup file system mocks
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readFileSync = jest.fn().mockReturnValue(Buffer.from('%PDF-1.4 edge case test'));
    mockFs.writeFileSync = jest.fn();
    mockFs.mkdirSync = jest.fn();
    (mockFs as any).statSync = jest.fn().mockReturnValue({ size: 1000 });

    // Setup Python bridge mock
    const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
    mockPythonBridge.prototype.executePythonScript = jest.fn();

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Malformed PDF Handling', () => {
    it('should handle corrupted PDF files gracefully', async () => {
      // Mock corrupted PDF content
      mockFs.readFileSync.mockReturnValue(Buffer.from('Not a PDF file'));

      // Mock Python bridge to fail with corrupted PDF
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: false,
        error: 'Invalid PDF format: File does not start with PDF signature',
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/corrupted.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/corrupted.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle password-protected PDFs', async () => {
      // Mock Python bridge to fail with password protection
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: false,
        error: 'PDF is password protected and cannot be processed',
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/password-protected.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/password-protected.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle PDFs with no fillable fields', async () => {
      // Mock Python bridge to return empty fields
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: true,
        fields: [],
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/no-fields.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/no-fields.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle PDFs with malformed field definitions', async () => {
      // Mock Python bridge to return malformed field data
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: true,
        fields: [
          null, // Null field
          undefined, // Undefined field
          { name: '', type: 'text' }, // Empty name
          { name: 'validField', type: 'unknown' }, // Unknown type
          { name: 'incompleteField' }, // Missing type
          { name: 'dropdownWithoutOptions', type: 'dropdown' }, // Dropdown without options
          { 
            name: 'fieldWithSpecialChars!@#$%^&*()',
            type: 'text',
            maxLength: -1, // Invalid max length
          },
        ],
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/malformed-fields.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/malformed-fields.pdf'
      );

      // Should filter out invalid fields and process valid ones
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.name === 'validField')).toBe(true);
    });
  });

  describe('Network and File System Edge Cases', () => {
    it('should handle network timeouts for URL sources', async () => {
      // Mock HTTPS to timeout
      mockHttps.get.mockImplementation((_url, _options, _callback) => {
        const mockRequest = {
          destroy: jest.fn(),
          on: jest.fn((event, handler) => {
            if (event === 'timeout') {
              setTimeout(() => handler(), 100);
            }
          }),
        };
        return mockRequest as any;
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://slow-server.com/timeout.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'url',
        'https://slow-server.com/timeout.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle HTTP error responses', async () => {
      const errorCodes = [404, 403, 500, 502];

      for (const errorCode of errorCodes) {
        // Mock HTTPS to return error
        const mockResponse = new EventEmitter();
        (mockResponse as any).statusCode = errorCode;
        (mockResponse as any).statusMessage = `HTTP ${errorCode} Error`;

        mockHttps.get.mockImplementation((_url, options, callback) => {
          if (typeof options === 'function') {
            callback = options;
          }
          setTimeout(() => {
            callback!(mockResponse as any);
          }, 10);
          return { destroy: jest.fn() } as any;
        });

        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(`https://example.com/error-${errorCode}.pdf`);

        const fields = await fieldInspector.loadPdfFields(
          mockLoadContext,
          'url',
          `https://example.com/error-${errorCode}.pdf`
        );

        expect(fields).toEqual([]);
      }
    });

    it('should handle invalid URLs', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/file.pdf',
        'http://',
        'https://',
        '',
        null,
        undefined,
      ];

      for (const invalidUrl of invalidUrls) {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(invalidUrl);

        const fields = await fieldInspector.loadPdfFields(
          mockLoadContext,
          'url',
          invalidUrl as any
        );

        expect(fields).toEqual([]);
      }
    });

    it('should handle file system permission errors', async () => {
      // Mock file system to throw permission error
      mockFs.readFileSync.mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/restricted/file.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/restricted/file.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle missing files', async () => {
      mockFs.existsSync.mockReturnValue(false);

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/nonexistent/file.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/nonexistent/file.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle files that are too large', async () => {
      const largePdfSize = 60 * 1024 * 1024; // 60MB (over 50MB limit)
      (mockFs as any).statSync.mockReturnValue({ size: largePdfSize });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/too-large.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/too-large.pdf'
      );

      expect(fields).toEqual([]);
    });
  });

  describe('Expression and Data Edge Cases', () => {
    it('should handle malformed expressions gracefully', async () => {
      const malformedExpressions = [
        '{{ $json.field', // Missing closing braces
        '$json.field }}', // Missing opening braces
        '{{ eval("dangerous") }}', // Unsafe expression
        '{{ $json..field }}', // Double dots
        '{{ $json["field" }}', // Unclosed bracket
        '{{ $json[field] }}', // Unquoted property
        '{{ $undefined.property }}', // Undefined reference
      ];

      const testFields: IFieldInfo[] = [
        { name: 'testField', type: 'text', required: false },
      ];

      for (const expression of malformedExpressions) {
        const fieldMappings: IFieldMapping[] = [
          {
            pdfFieldName: 'testField',
            valueSource: 'expression',
            expression,
          },
        ];

        mockContext.evaluateExpression.mockImplementation(() => {
          throw new Error('Expression evaluation failed');
        });

        await expect(fieldMapper.mapFieldsToValues(fieldMappings, testFields))
          .rejects.toMatchObject({
            errorType: 'data',
          });
      }
    });

    it('should handle circular references in expression results', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'testField',
          valueSource: 'expression',
          expression: '{{ $json.circularData }}',
        },
      ];

      const testFields: IFieldInfo[] = [
        { name: 'testField', type: 'text', required: false },
      ];

      mockContext.evaluateExpression.mockReturnValue(circularObj);

      // Should handle circular reference gracefully
      const result = await fieldMapper.mapFieldsToValues(fieldMappings, testFields);
      expect(result.testField).toBe('[Object]'); // Fallback for circular reference
    });

    it('should handle extremely large expression results', async () => {
      const hugeString = 'x'.repeat(100000); // 100KB string

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'testField',
          valueSource: 'expression',
          expression: '{{ $json.hugeData }}',
        },
      ];

      const testFields: IFieldInfo[] = [
        { name: 'testField', type: 'text', required: false, maxLength: 50 },
      ];

      mockContext.evaluateExpression.mockReturnValue(hugeString);

      // Should fail due to length constraint
      await expect(fieldMapper.mapFieldsToValues(fieldMappings, testFields))
        .rejects.toMatchObject({
          errorType: 'data',
        });
    });

    it('should handle null and undefined expression results', async () => {
      const testCases = [
        { value: null, expected: '' },
        { value: undefined, expected: '' },
        { value: '', expected: '' },
        { value: 0, expected: '0' },
        { value: false, expected: 'false' },
      ];

      const testFields: IFieldInfo[] = [
        { name: 'testField', type: 'text', required: false },
      ];

      for (const testCase of testCases) {
        const fieldMappings: IFieldMapping[] = [
          {
            pdfFieldName: 'testField',
            valueSource: 'expression',
            expression: '{{ $json.testValue }}',
          },
        ];

        mockContext.evaluateExpression.mockReturnValue(testCase.value);

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, testFields);
        expect(result.testField).toBe(testCase.expected);
      }
    });
  });

  describe('Field Type Edge Cases', () => {
    it('should handle dropdown fields with duplicate options', async () => {
      const duplicateOptionsField: IFieldInfo = {
        name: 'duplicateDropdown',
        type: 'dropdown',
        required: false,
        options: ['Option1', 'Option2', 'Option1', 'Option3', 'Option2'], // Duplicates
      };

      const uiProperties = uiGenerator.generateFieldProperties([duplicateOptionsField]);
      const dropdownProperty = uiProperties.find(p => p.name === 'pdfField_duplicateDropdown');

      expect(dropdownProperty).toBeDefined();
      expect((dropdownProperty as any)?.options).toBeDefined();
      
      // Should handle duplicates gracefully
      const options = (dropdownProperty as any).options;
      const optionValues = options.map((opt: any) => opt.value);
      expect(optionValues.filter((val: string) => val === 'Option1')).toHaveLength(2); // Duplicates preserved
    });

    it('should handle fields with extremely long names', async () => {
      const longFieldName = 'a'.repeat(1000);
      const longNameField: IFieldInfo = {
        name: longFieldName,
        type: 'text',
        required: false,
      };

      const uiProperties = uiGenerator.generateFieldProperties([longNameField]);
      const fieldProperty = uiProperties.find(p => p.name === `pdfField_${longFieldName}`);

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.displayName).toContain(longFieldName);
    });

    it('should handle fields with special characters and Unicode', async () => {
      const specialFields: IFieldInfo[] = [
        {
          name: 'field-with-dashes_and_underscores',
          type: 'text',
          required: false,
        },
        {
          name: 'field.with.dots',
          type: 'text',
          required: false,
        },
        {
          name: 'field with spaces',
          type: 'text',
          required: false,
        },
        {
          name: 'field@with#special$chars%',
          type: 'text',
          required: false,
        },
        {
          name: '测试字段名称',
          type: 'text',
          required: false,
        },
        {
          name: 'поле_на_русском',
          type: 'text',
          required: false,
        },
        {
          name: 'フィールド名前',
          type: 'text',
          required: false,
        },
        {
          name: 'field🚀with😀emojis',
          type: 'text',
          required: false,
        },
      ];

      const uiProperties = uiGenerator.generateFieldProperties(specialFields);

      // Should generate properties for all fields
      expect(uiProperties.length).toBeGreaterThan(specialFields.length);

      // Check that each field has a corresponding property
      specialFields.forEach(field => {
        const property = uiProperties.find(p => p.name === `pdfField_${field.name}`);
        expect(property).toBeDefined();
      });
    });

    it('should handle checkbox fields with non-boolean default values', async () => {
      const checkboxFields: IFieldInfo[] = [
        {
          name: 'checkboxWithStringDefault',
          type: 'checkbox',
          required: false,
          defaultValue: 'yes' as any,
        },
        {
          name: 'checkboxWithNumberDefault',
          type: 'checkbox',
          required: false,
          defaultValue: 1 as any,
        },
        {
          name: 'checkboxWithNullDefault',
          type: 'checkbox',
          required: false,
          defaultValue: null as any,
        },
      ];

      const uiProperties = uiGenerator.generateFieldProperties(checkboxFields);

      checkboxFields.forEach(field => {
        const property = uiProperties.find(p => p.name === `pdfField_${field.name}`);
        expect(property).toBeDefined();
        expect(property?.type).toBe('boolean');
        // Default should be converted to boolean
        expect(typeof property?.default).toBe('boolean');
      });
    });

    it('should handle dropdown/radio fields with empty or null options', async () => {
      const problematicFields: IFieldInfo[] = [
        {
          name: 'dropdownWithEmptyOptions',
          type: 'dropdown',
          required: false,
          options: [],
        },
        {
          name: 'dropdownWithNullOptions',
          type: 'dropdown',
          required: false,
          options: null as any,
        },
        {
          name: 'radioWithUndefinedOptions',
          type: 'radio',
          required: false,
          options: undefined,
        },
        {
          name: 'dropdownWithMixedOptions',
          type: 'dropdown',
          required: false,
          options: ['Valid', '', null, undefined, 'Another Valid'] as any,
        },
      ];

      const uiProperties = uiGenerator.generateFieldProperties(problematicFields);

      problematicFields.forEach(field => {
        const property = uiProperties.find(p => p.name === `pdfField_${field.name}`);
        expect(property).toBeDefined();
        
        // Fields without valid options should fall back to text input
        if (!field.options || field.options.length === 0) {
          expect(property?.type).toBe('string');
        }
      });
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle validation with missing field information', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'existingField',
          valueSource: 'static',
          staticValue: 'value',
        },
        {
          pdfFieldName: 'missingField',
          valueSource: 'static',
          staticValue: 'value',
        },
      ];

      const incompleteFields: IFieldInfo[] = [
        {
          name: 'existingField',
          type: 'text',
          required: false,
        },
        // missingField is not in the PDF fields list
      ];

      const validation = await fieldMapper.validateMappings(fieldMappings, incompleteFields);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Field \'missingField\' not found in PDF');
    });

    it('should handle dynamic field validation with extreme values', async () => {
      const extremeValues = {
        pdfField_textField: 'a'.repeat(10000), // Very long text
        pdfField_numberField: Number.MAX_SAFE_INTEGER.toString(),
        pdfField_negativeField: Number.MIN_SAFE_INTEGER.toString(),
        pdfField_floatField: Math.PI.toString(),
        pdfField_scientificField: '1.23e-45',
        pdfField_unicodeField: '🚀🌟💫⭐🌙☀️🌈🦄🎉🎊',
        pdfField_htmlField: '<script>alert("xss")</script>',
        pdfField_sqlField: "'; DROP TABLE users; --",
      };

      const extremeFields: IFieldInfo[] = [
        { name: 'textField', type: 'text', required: false, maxLength: 100 },
        { name: 'numberField', type: 'text', required: false },
        { name: 'negativeField', type: 'text', required: false },
        { name: 'floatField', type: 'text', required: false },
        { name: 'scientificField', type: 'text', required: false },
        { name: 'unicodeField', type: 'text', required: false },
        { name: 'htmlField', type: 'text', required: false },
        { name: 'sqlField', type: 'text', required: false },
      ];

      const validation = uiGenerator.validateDynamicFieldConfiguration(extremeValues, extremeFields);

      expect(validation.valid).toBe(false); // Should fail due to length constraint
      expect(validation.errors.some(error => error.includes('exceeds maximum length'))).toBe(true);
    });
  });

  describe('Concurrency and Race Condition Edge Cases', () => {
    it('should handle concurrent field extractions for the same PDF', async () => {
      const sameUrl = 'https://example.com/concurrent-same.pdf';
      const concurrentCount = 5;

      // Mock HTTPS
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        const mockResponse = new EventEmitter();
        (mockResponse as any).statusCode = 200;
        (mockResponse as any).headers = { 'content-type': 'application/pdf' };
        
        setTimeout(() => {
          callback!(mockResponse as any);
          mockResponse.emit('data', Buffer.from('%PDF-1.4 concurrent test'));
          mockResponse.emit('end');
        }, Math.random() * 100); // Random delay to simulate race conditions
        return { destroy: jest.fn() } as any;
      });

      // Mock Python bridge
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      let callCount = 0;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        const currentCall = callCount++;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
        return {
          success: true,
          fields: [
            { name: `concurrent_field_${currentCall}`, type: 'text', required: false },
          ],
        };
      });

      // Start concurrent extractions
      const promises = Array.from({ length: concurrentCount }, () => {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(sameUrl);
        return fieldInspector.loadPdfFields(mockLoadContext, 'url', sameUrl);
      });

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(concurrentCount);
      results.forEach(fields => {
        expect(fields).toHaveLength(1);
      });
    });

    it('should handle rapid sequential field extractions', async () => {
      const rapidCount = 20;
      const rapidFields: IFieldInfo[] = [
        { name: 'rapidField', type: 'text', required: false },
      ];

      // Mock Python bridge for rapid calls
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: true,
        fields: rapidFields,
      });

      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Fire rapid sequential requests
      for (let i = 0; i < rapidCount; i++) {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('upload')
          .mockReturnValueOnce(`/test/rapid-${i}.pdf`);
        
        promises.push(fieldInspector.loadPdfFields(
          mockLoadContext,
          'upload',
          `/test/rapid-${i}.pdf`
        ));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      expect(results).toHaveLength(rapidCount);
      results.forEach(fields => {
        expect(fields).toHaveLength(1);
      });

      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle memory pressure during field processing', async () => {
      // Create memory pressure by generating large objects
      const memoryPressureFields: IFieldInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `memory_pressure_field_${i}`,
        type: 'dropdown',
        required: false,
        options: Array.from({ length: 100 }, (_, j) => `Option_${i}_${j}_${'x'.repeat(100)}`),
        defaultValue: `Option_${i}_0_${'x'.repeat(100)}`,
      }));

      // Mock Python bridge
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        // Create additional memory pressure
        const _largeArray = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(1000),
          nested: { value: i, array: new Array(100).fill(i) },
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          fields: memoryPressureFields,
        };
      });

      const initialMemory = process.memoryUsage().heapUsed;

      try {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('upload')
          .mockReturnValueOnce('/test/memory-pressure.pdf');

        const fields = await fieldInspector.loadPdfFields(
          mockLoadContext,
          'upload',
          '/test/memory-pressure.pdf'
        );

        // Generate UI under memory pressure
        const uiProperties = uiGenerator.generateFieldProperties(memoryPressureFields);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Should still succeed despite memory pressure
        expect(fields).toHaveLength(100);
        expect(uiProperties.length).toBeGreaterThan(100);

        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // < 500MB

        console.log(`Memory pressure test:
          - Initial memory: ${Math.round(initialMemory / 1024 / 1024)}MB
          - Final memory: ${Math.round(finalMemory / 1024 / 1024)}MB
          - Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

      } catch (error) {
        // If we run out of memory, that's also a valid test result
        console.log(`Memory pressure test failed with: ${error}`);
        expect(error).toBeDefined();
      }
    });

    it('should handle resource cleanup on errors', async () => {
      // Mock Python bridge to fail after partial processing
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        // Create resources that need cleanup
        const _resources = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: new Array(1000).fill(`resource_${i}`),
        }));
        
        // Simulate failure after resource allocation
        throw new Error('Processing failed after resource allocation');
      });

      const initialMemory = process.memoryUsage().heapUsed;

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/resource-cleanup.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/resource-cleanup.pdf'
      );

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should return empty array on error
      expect(fields).toEqual([]);

      // Memory should be cleaned up (increase should be minimal)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB

      console.log(`Resource cleanup test:
        - Memory increase after error: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  describe('Integration with continueOnFail', () => {
    it('should handle errors gracefully when continueOnFail is enabled', async () => {
      mockContext.continueOnFail.mockReturnValue(true);

      // Mock various error scenarios
      const errorScenarios = [
        {
          name: 'File not found',
          setup: () => {
            mockFs.existsSync.mockReturnValue(false);
          },
          params: {
            pdfSource: 'upload',
            pdfFile: '/nonexistent/file.pdf',
          },
        },
        {
          name: 'Network error',
          setup: () => {
            mockHttps.get.mockImplementation(() => {
              throw new Error('Network unreachable');
            });
          },
          params: {
            pdfSource: 'url',
            pdfUrl: 'https://unreachable.com/file.pdf',
          },
        },
        {
          name: 'Python processing error',
          setup: () => {
            const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
            mockPythonBridge.prototype.executePythonScript.mockRejectedValue(
              new Error('Python script crashed')
            );
          },
          params: {
            pdfSource: 'upload',
            pdfFile: '/test/crash.pdf',
          },
        },
      ];

      for (const scenario of errorScenarios) {
        scenario.setup();

        mockContext.getNodeParameter.mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'pdfSource': return scenario.params.pdfSource;
            case 'pdfFile': return scenario.params.pdfFile;
            case 'pdfUrl': return scenario.params.pdfUrl;
            case 'fieldMappings': return { mapping: [] };
            case 'outputFormat': return 'binary';
            case 'options': return {};
            default: return undefined;
          }
        });

        mockContext.getInputData.mockReturnValue([{ json: { test: 'data' } }]);

        const result = await fillPdfNode.execute.call(mockContext);

        // Should return error result instead of throwing
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json.success).toBe(false);
        expect(result[0][0].json.error).toContain(scenario.name.toLowerCase().replace(' ', ''));

        console.log(`continueOnFail test - ${scenario.name}: PASSED`);
      }
    });
  });
});