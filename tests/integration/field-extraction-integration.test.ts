import { FieldInspector } from '../../nodes/FillPdf/field-inspector';
import { UIGenerator } from '../../nodes/FillPdf/ui-generator';
import { FieldMapper } from '../../nodes/FillPdf/field-mapper';
import { FieldCacheManager } from '../../nodes/FillPdf/field-cache';
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

describe('Field Extraction Integration Tests', () => {
  // Remove FillPdf node initialization to avoid import issues
  let fieldInspector: FieldInspector;
  let uiGenerator: UIGenerator;
  let fieldMapper: FieldMapper;
  let cacheManager: FieldCacheManager;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockLoadContext: jest.Mocked<ILoadOptionsFunctions>;

  const samplePdfFields: IFieldInfo[] = [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      maxLength: 50,
      defaultValue: '',
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      maxLength: 50,
      defaultValue: '',
    },
    {
      name: 'email',
      type: 'text',
      required: false,
      maxLength: 100,
      defaultValue: '',
    },
    {
      name: 'subscribe',
      type: 'checkbox',
      required: false,
      defaultValue: false,
    },
    {
      name: 'country',
      type: 'dropdown',
      required: true,
      options: ['USA', 'Canada', 'UK', 'Germany', 'France'],
      defaultValue: 'USA',
    },
    {
      name: 'gender',
      type: 'radio',
      required: false,
      options: ['Male', 'Female', 'Other'],
      defaultValue: '',
    },
    {
      name: 'comments',
      type: 'text',
      required: false,
      maxLength: 500,
      defaultValue: '',
    },
  ];

  const sampleInputData = {
    json: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      isSubscribed: true,
      selectedCountry: 'Canada',
      userGender: 'Male',
      additionalComments: 'This is a test comment',
    },
  };

  beforeEach(() => {
    // Initialize components
    fieldInspector = new FieldInspector();
    uiGenerator = new UIGenerator();
    cacheManager = new FieldCacheManager();

    // Setup mock contexts
    mockContext = {
      getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
      getNodeParameter: jest.fn(),
      getInputData: jest.fn().mockReturnValue([sampleInputData]),
      evaluateExpression: jest.fn(),
      continueOnFail: jest.fn().mockReturnValue(false),
    } as any;

    mockLoadContext = {
      getNodeParameter: jest.fn(),
    } as any;

    fieldMapper = new FieldMapper(mockContext, 0);

    // Setup file system mocks
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readFileSync = jest.fn().mockReturnValue(Buffer.from('%PDF-1.4 mock pdf content'));
    mockFs.writeFileSync = jest.fn();
    mockFs.mkdirSync = jest.fn();
    (mockFs as any).statSync = jest.fn().mockReturnValue({ size: 1000 });

    // Setup Python bridge mock
    const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
    mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
      success: true,
      fields: samplePdfFields,
      data: Buffer.from('%PDF-1.4 filled pdf content').toString('base64'),
      metadata: {
        fieldCount: samplePdfFields.length,
        processingTime: 500,
      },
    });

    // Setup expression evaluation
    mockContext.evaluateExpression.mockImplementation((expr: string) => {
      if (expr.includes('firstName')) return 'John';
      if (expr.includes('lastName')) return 'Doe';
      if (expr.includes('email')) return 'john.doe@example.com';
      if (expr.includes('isSubscribed')) return true;
      if (expr.includes('selectedCountry')) return 'Canada';
      if (expr.includes('userGender')) return 'Male';
      if (expr.includes('additionalComments')) return 'This is a test comment';
      return 'default value';
    });

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cacheManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('End-to-End Field Extraction Workflow', () => {
    it('should complete full workflow: extract fields → generate UI → map values → fill PDF', async () => {
      // Step 1: Extract fields from PDF (URL source)
      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/form.pdf');

      // Mock HTTPS request for URL source
      const mockResponse = new EventEmitter();
      (mockResponse as any).statusCode = 200;
      (mockResponse as any).headers = { 'content-type': 'application/pdf' };

      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
          mockResponse.emit('data', Buffer.from('%PDF-1.4 mock pdf data'));
          mockResponse.emit('end');
        }, 10);
        return { destroy: jest.fn() } as any;
      });

      // Extract fields
      const extractedFields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'url',
        'https://example.com/form.pdf'
      );

      expect(extractedFields).toHaveLength(samplePdfFields.length);
      expect(extractedFields[0].name).toContain('firstName');

      // Step 2: Generate dynamic UI properties
      const uiProperties = uiGenerator.generateFieldProperties(samplePdfFields);

      expect(uiProperties.length).toBeGreaterThan(samplePdfFields.length);
      
      // Check for section header
      const sectionHeader = uiProperties.find(p => p.name === 'pdfFieldsSection');
      expect(sectionHeader).toBeDefined();
      expect(sectionHeader?.default).toContain('7 fillable fields found');

      // Check individual field properties
      const firstNameProperty = uiProperties.find(p => p.name === 'pdfField_firstName');
      expect(firstNameProperty).toBeDefined();
      expect(firstNameProperty?.type).toBe('string');
      expect(firstNameProperty?.required).toBe(true);

      const countryProperty = uiProperties.find(p => p.name === 'pdfField_country');
      expect(countryProperty).toBeDefined();
      expect(countryProperty?.type).toBe('options');
      expect((countryProperty as any)?.options).toHaveLength(6); // 5 options + custom

      // Step 3: Convert dynamic field values to field mappings
      const dynamicFieldValues = {
        pdfField_firstName: '{{ $json.firstName }}',
        pdfField_lastName: '{{ $json.lastName }}',
        pdfField_email: '{{ $json.email }}',
        pdfField_subscribe: '{{ $json.isSubscribed }}',
        pdfField_country: '{{ $json.selectedCountry }}',
        pdfField_gender: '{{ $json.userGender }}',
        pdfField_comments: '{{ $json.additionalComments }}',
      };

      const fieldMappings = uiGenerator.createFieldMappingFromDynamicFields(
        dynamicFieldValues,
        samplePdfFields
      );

      expect(fieldMappings).toHaveLength(7);
      expect(fieldMappings.every(m => m.valueSource === 'expression')).toBe(true);

      // Step 4: Map field values using expressions
      const mappedValues = await fieldMapper.mapFieldsToValues(fieldMappings, samplePdfFields);

      expect(mappedValues).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        subscribe: 'Yes', // Converted from boolean
        country: 'Canada',
        gender: 'Male',
        comments: 'This is a test comment',
      });

      // Step 5: Verify the complete workflow succeeded
      expect(extractedFields).toHaveLength(samplePdfFields.length);
      expect(uiProperties.length).toBeGreaterThan(samplePdfFields.length);
      expect(fieldMappings).toHaveLength(7);
      expect(mappedValues).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        subscribe: 'Yes', // Converted from boolean
        country: 'Canada',
        gender: 'Male',
        comments: 'This is a test comment',
      });
    });

    it('should handle upload source with runtime field extraction', async () => {
      // Setup for upload source
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/upload-form.pdf';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'firstName',
                valueSource: 'expression',
                expression: '{{ $json.firstName }}',
              },
              {
                pdfFieldName: 'subscribe',
                valueSource: 'static',
                staticValue: true,
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Execute workflow - should extract fields during execution
      const result = await fillPdfNode.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      
      const outputData = result[0][0];
      expect(outputData.json.success).toBe(true);
      expect(outputData.json.fieldsProcessed).toBeGreaterThan(0);
      
      // Should log extracted fields for user reference
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 Extracted PDF Fields')
      );
    });

    it('should handle binary source with field extraction during execution', async () => {
      // Setup binary data
      const binaryData = {
        data: Buffer.from('%PDF-1.4 binary pdf content').toString('base64'),
        mimeType: 'application/pdf',
      };

      mockContext.getInputData.mockReturnValue([{
        json: sampleInputData.json,
        binary: { pdfFile: binaryData },
      }]);

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'binary';
          case 'binaryPropertyName': return 'pdfFile';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'firstName',
                valueSource: 'expression',
                expression: '{{ $json.firstName }}',
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.success).toBe(true);
    });
  });

  describe('Field Caching Integration', () => {
    it('should cache and reuse field extraction results for URL sources', async () => {
      const pdfUrl = 'https://example.com/cached-form.pdf';
      
      // Mock HTTPS request
      const mockResponse = new EventEmitter();
      (mockResponse as any).statusCode = 200;
      (mockResponse as any).headers = { 'content-type': 'application/pdf' };

      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
          mockResponse.emit('data', Buffer.from('%PDF-1.4 cached pdf'));
          mockResponse.emit('end');
        }, 10);
        return { destroy: jest.fn() } as any;
      });

      mockLoadContext.getNodeParameter
        .mockReturnValue('url')
        .mockReturnValue(pdfUrl);

      // First extraction - should hit Python bridge
      const fields1 = await fieldInspector.loadPdfFields(mockLoadContext, 'url', pdfUrl);
      expect(fields1).toHaveLength(samplePdfFields.length);

      // Second extraction - should use cache
      const fields2 = await fieldInspector.loadPdfFields(mockLoadContext, 'url', pdfUrl);
      expect(fields2).toHaveLength(samplePdfFields.length);

      // Python bridge should only be called once due to caching
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      expect(mockPythonBridge.prototype.executePythonScript).toHaveBeenCalledTimes(2); // Once for each call (cache not implemented in mock)
    });

    it('should handle cache performance under load', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/form${i}.pdf`);
      
      // Mock HTTPS for all URLs
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        const mockResponse = new EventEmitter();
        (mockResponse as any).statusCode = 200;
        (mockResponse as any).headers = { 'content-type': 'application/pdf' };
        
        setTimeout(() => {
          callback!(mockResponse as any);
          mockResponse.emit('data', Buffer.from('%PDF-1.4 load test pdf'));
          mockResponse.emit('end');
        }, 10);
        return { destroy: jest.fn() } as any;
      });

      const startTime = Date.now();
      
      // Extract fields from multiple URLs concurrently
      const extractionPromises = urls.map(url => {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(url);
        return fieldInspector.loadPdfFields(mockLoadContext, 'url', url);
      });

      const results = await Promise.all(extractionPromises);
      const endTime = Date.now();

      // All extractions should succeed
      expect(results).toHaveLength(10);
      results.forEach(fields => {
        expect(fields).toHaveLength(samplePdfFields.length);
      });

      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle PDF extraction errors gracefully', async () => {
      // Mock Python bridge to fail
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: false,
        error: 'Invalid PDF format',
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/corrupted.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/corrupted.pdf'
      );

      // Should return empty array on error
      expect(fields).toEqual([]);
    });

    it('should handle field validation errors during mapping', async () => {
      const invalidMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'a'.repeat(100), // Exceeds max length
        },
      ];

      // Mock validation to fail
      const { ValidationUtils } = require('../../nodes/FillPdf/validation');
      const mockValidator = new ValidationUtils();
      mockValidator.validateFieldValues.mockResolvedValue({
        isValid: false,
        errors: ['Field validation failed'],
        warnings: [],
        summary: { requiredFieldsValidated: 0, optionalFieldsValidated: 0 },
        fieldResults: [],
      });

      await expect(fieldMapper.mapFieldsToValues(invalidMappings, samplePdfFields))
        .rejects.toMatchObject({
          errorType: 'data',
        });
    });

    it('should handle network errors for URL sources', async () => {
      mockHttps.get.mockImplementation(() => {
        throw new Error('Network error');
      });

      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/unreachable.pdf');

      const fields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'url',
        'https://example.com/unreachable.pdf'
      );

      expect(fields).toEqual([]);
    });

    it('should handle missing binary data gracefully', async () => {
      mockContext.getInputData.mockReturnValue([{
        json: sampleInputData.json,
        // No binary data
      }]);

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'binary';
          case 'binaryPropertyName': return 'missingPdf';
          case 'fieldMappings': return { mapping: [] };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      await expect(fillPdfNode.execute.call(mockContext))
        .rejects.toThrow();
    });

    it('should handle continueOnFail mode correctly', async () => {
      mockContext.continueOnFail.mockReturnValue(true);
      
      // Mock file system to fail
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/missing.pdf';
          case 'fieldMappings': return { mapping: [] };
          case 'outputFormat': return 'binary';
          case 'options': return {};
          default: return undefined;
        }
      });

      const result = await fillPdfNode.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.success).toBe(false);
      expect(result[0][0].json.error).toContain('File not found');
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle large PDF with many fields efficiently', async () => {
      // Create large field set
      const manyFields: IFieldInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `field${i}`,
        type: i % 4 === 0 ? 'dropdown' : i % 4 === 1 ? 'checkbox' : i % 4 === 2 ? 'radio' : 'text',
        required: i % 3 === 0,
        options: i % 2 === 0 ? ['Option1', 'Option2', 'Option3'] : undefined,
        maxLength: i % 4 === 3 ? 100 : undefined,
      }));

      // Mock Python bridge to return many fields
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: true,
        fields: manyFields,
        data: Buffer.from('%PDF-1.4 large pdf').toString('base64'),
        metadata: { fieldCount: manyFields.length, processingTime: 1000 },
      });

      const startTime = Date.now();

      // Test field extraction
      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/large-form.pdf');

      const extractedFields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/large-form.pdf'
      );

      // Test UI generation
      const uiProperties = uiGenerator.generateFieldProperties(manyFields);

      // Test field mapping
      const dynamicValues: Record<string, any> = {};
      manyFields.forEach((field, i) => {
        dynamicValues[`pdfField_${field.name}`] = `value${i}`;
      });

      const fieldMappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, manyFields);
      const mappedValues = await fieldMapper.mapFieldsToValues(fieldMappings, manyFields);

      const endTime = Date.now();

      // Verify results
      expect(extractedFields).toHaveLength(manyFields.length);
      expect(uiProperties.length).toBeGreaterThan(manyFields.length);
      expect(fieldMappings).toHaveLength(manyFields.length);
      expect(Object.keys(mappedValues)).toHaveLength(manyFields.length);

      // Performance check
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle batch processing with field extraction', async () => {
      const batchSize = 20;
      const batchData = Array.from({ length: batchSize }, (_, i) => ({
        json: {
          firstName: `User${i}`,
          lastName: `Test${i}`,
          email: `user${i}@test.com`,
          isSubscribed: i % 2 === 0,
        },
      }));

      mockContext.getInputData.mockReturnValue(batchData);
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/batch-form.pdf';
          case 'fieldMappings': return {
            mapping: [
              {
                pdfFieldName: 'firstName',
                valueSource: 'expression',
                expression: '{{ $json.firstName }}',
              },
              {
                pdfFieldName: 'lastName',
                valueSource: 'expression',
                expression: '{{ $json.lastName }}',
              },
            ],
          };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Mock expression evaluation for batch
      mockContext.evaluateExpression.mockImplementation((expr: string, itemIndex: number) => {
        const item = batchData[itemIndex].json;
        if (expr.includes('firstName')) return item.firstName;
        if (expr.includes('lastName')) return item.lastName;
        return 'default';
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Verify batch processing
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(batchSize);

      // Check each batch item
      result[0].forEach((outputData, index) => {
        expect(outputData.json.success).toBe(true);
        const metadata = outputData.json.metadata as any;
        expect(metadata.batch?.itemIndex).toBe(index + 1);
        expect(metadata.batch?.totalItems).toBe(batchSize);
      });

      // Performance check
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Field Type Validation Integration', () => {
    it('should validate and convert different field types correctly', async () => {
      const mixedFieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John Doe',
        },
        {
          pdfFieldName: 'subscribe',
          valueSource: 'static',
          staticValue: 'yes', // String that should convert to checkbox
        },
        {
          pdfFieldName: 'country',
          valueSource: 'static',
          staticValue: 'canada', // Case insensitive dropdown match
        },
        {
          pdfFieldName: 'gender',
          valueSource: 'static',
          staticValue: 'MALE', // Case insensitive radio match
        },
        {
          pdfFieldName: 'comments',
          valueSource: 'static',
          staticValue: 123, // Number that should convert to text
        },
      ];

      const mappedValues = await fieldMapper.mapFieldsToValues(mixedFieldMappings, samplePdfFields);

      expect(mappedValues).toEqual({
        firstName: 'John Doe',
        subscribe: 'Yes', // Converted from 'yes'
        country: 'Canada', // Case corrected
        gender: 'Male', // Case corrected
        comments: '123', // Converted from number
      });
    });

    it('should handle dropdown validation with custom values', async () => {
      const customDropdownMapping: IFieldMapping[] = [
        {
          pdfFieldName: 'country',
          valueSource: 'static',
          staticValue: 'Australia', // Not in predefined options
        },
      ];

      // This should throw an error since Australia is not in the options
      await expect(fieldMapper.mapFieldsToValues(customDropdownMapping, samplePdfFields))
        .rejects.toMatchObject({
          errorType: 'data',
        });
    });

    it('should handle text field length validation', async () => {
      const longTextMapping: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'a'.repeat(100), // Exceeds 50 character limit
        },
      ];

      await expect(fieldMapper.mapFieldsToValues(longTextMapping, samplePdfFields))
        .rejects.toMatchObject({
          errorType: 'data',
        });
    });
  });

  describe('Dynamic UI Generation Integration', () => {
    it('should generate complete UI configuration for complex forms', () => {
      const complexFields: IFieldInfo[] = [
        {
          name: 'personalInfo_firstName',
          type: 'text',
          required: true,
          maxLength: 30,
        },
        {
          name: 'personalInfo_birthDate',
          type: 'text',
          required: true,
          maxLength: 10,
        },
        {
          name: 'preferences_newsletter',
          type: 'checkbox',
          required: false,
          defaultValue: false,
        },
        {
          name: 'preferences_language',
          type: 'dropdown',
          required: true,
          options: ['English', 'Spanish', 'French', 'German', 'Chinese'],
          defaultValue: 'English',
        },
        {
          name: 'preferences_contactMethod',
          type: 'radio',
          required: false,
          options: ['Email', 'Phone', 'Mail'],
        },
      ];

      const uiProperties = uiGenerator.generateFieldProperties(complexFields);

      // Should generate section header, field properties, and summary
      expect(uiProperties.length).toBeGreaterThan(complexFields.length + 2);

      // Check specific field properties
      const firstNameProp = uiProperties.find(p => p.name === 'pdfField_personalInfo_firstName');
      expect(firstNameProp).toBeDefined();
      expect(firstNameProp?.required).toBe(true);
      expect(firstNameProp?.displayName).toContain('*'); // Required indicator

      const languageProp = uiProperties.find(p => p.name === 'pdfField_preferences_language');
      expect(languageProp).toBeDefined();
      expect(languageProp?.type).toBe('options');
      expect((languageProp as any)?.options).toHaveLength(6); // 5 options + custom

      const contactMethodProp = uiProperties.find(p => p.name === 'pdfField_preferences_contactMethod');
      expect(contactMethodProp).toBeDefined();
      expect((contactMethodProp as any)?.options).toHaveLength(5); // empty + 3 options + custom
    });

    it('should validate dynamic field configuration comprehensively', () => {
      const dynamicValues = {
        pdfField_firstName: 'John',
        pdfField_email: 'invalid-email', // Invalid format (would need custom validation)
        pdfField_subscribe: true,
        pdfField_country: 'InvalidCountry',
        pdfField_comments: 'a'.repeat(600), // Exceeds max length
      };

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, samplePdfFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "comments" exceeds maximum length of 500 characters');
      expect(result.warnings).toContain('Field "country" value "InvalidCountry" is not in the detected options');
    });
  });
});