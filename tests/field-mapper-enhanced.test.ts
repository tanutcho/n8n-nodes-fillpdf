import { FieldMapper, createFieldMapper } from '../nodes/FillPdf/field-mapper';
import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from '../nodes/FillPdf/types';

// Mock ValidationUtils
jest.mock('../nodes/FillPdf/validation', () => ({
  ValidationUtils: jest.fn().mockImplementation(() => ({
    validateFieldValues: jest.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        requiredFieldsValidated: 1,
        optionalFieldsValidated: 1,
      },
      fieldResults: [],
    }),
    logFieldValidationWarnings: jest.fn(),
    createFieldValidationErrorMessage: jest.fn().mockReturnValue('Validation failed'),
  })),
}));

describe('FieldMapper - Comprehensive Unit Tests', () => {
  let fieldMapper: FieldMapper;
  let mockContext: jest.Mocked<IExecuteFunctions>;

  const mockPdfFields: IFieldInfo[] = [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      maxLength: 50,
    },
    {
      name: 'subscribe',
      type: 'checkbox',
      required: false,
    },
    {
      name: 'country',
      type: 'dropdown',
      required: true,
      options: ['USA', 'Canada', 'UK'],
    },
    {
      name: 'gender',
      type: 'radio',
      required: false,
      options: ['Male', 'Female', 'Other'],
    },
    {
      name: 'comments',
      type: 'text',
      required: false,
      maxLength: 500,
    },
  ];

  beforeEach(() => {
    mockContext = {
      evaluateExpression: jest.fn(),
      getInputData: jest.fn(),
      getNodeParameter: jest.fn(),
    } as any;

    fieldMapper = new FieldMapper(mockContext, 0);

    // Setup default mock data
    mockContext.getInputData.mockReturnValue([
      {
        json: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isActive: true,
          selectedCountry: 'Canada',
        },
      },
    ]);

    // Clear console.log spy
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('mapFieldsToValues', () => {
    it('should map static values correctly', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John Doe',
        },
        {
          pdfFieldName: 'subscribe',
          valueSource: 'static',
          staticValue: true,
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'John Doe',
        subscribe: 'Yes',
      });
    });

    it('should map expression values correctly', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '{{ $json.firstName }}',
        },
        {
          pdfFieldName: 'subscribe',
          valueSource: 'expression',
          expression: '{{ $json.isActive }}',
        },
      ];

      mockContext.evaluateExpression
        .mockReturnValueOnce('John')
        .mockReturnValueOnce(true);

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'John',
        subscribe: 'Yes',
      });

      expect(mockContext.evaluateExpression).toHaveBeenCalledWith('{{ $json.firstName }}', 0);
      expect(mockContext.evaluateExpression).toHaveBeenCalledWith('{{ $json.isActive }}', 0);
    });

    it('should handle mixed static and expression mappings', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'Static Name',
        },
        {
          pdfFieldName: 'country',
          valueSource: 'expression',
          expression: '{{ $json.selectedCountry }}',
        },
      ];

      mockContext.evaluateExpression.mockReturnValue('Canada');

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'Static Name',
        country: 'Canada',
      });
    });

    it('should skip empty field names', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: '',
          valueSource: 'static',
          staticValue: 'Should be skipped',
        },
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'John',
      });
    });

    it('should handle expression evaluation errors', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '{{ $json.nonExistentField }}',
        },
      ];

      mockContext.evaluateExpression.mockImplementation(() => {
        throw new Error('Property not found');
      });

      await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
        .rejects.toMatchObject({
          message: expect.stringContaining('Field mapping conversion failed'),
          errorType: 'data',
        });
    });

    it('should handle validation failures', async () => {
      const { ValidationUtils } = require('../nodes/FillPdf/validation');
      const mockValidator = new ValidationUtils();
      mockValidator.validateFieldValues.mockResolvedValue({
        isValid: false,
        errors: ['Field validation failed'],
        warnings: [],
        summary: { requiredFieldsValidated: 0, optionalFieldsValidated: 0 },
        fieldResults: [],
      });

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John',
        },
      ];

      await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
        .rejects.toMatchObject({
          message: 'Validation failed',
          errorType: 'data',
        });
    });
  });

  describe('convertValueForFieldType', () => {
    describe('text field conversion', () => {
      const textField: IFieldInfo = {
        name: 'textField',
        type: 'text',
        required: false,
        maxLength: 50,
      };

      it('should convert string values', () => {
        const result = (fieldMapper as any).convertValueForFieldType('Hello World', textField);
        expect(result).toBe('Hello World');
      });

      it('should convert number values', () => {
        const result = (fieldMapper as any).convertValueForFieldType(123, textField);
        expect(result).toBe('123');
      });

      it('should convert boolean values', () => {
        const trueResult = (fieldMapper as any).convertValueForFieldType(true, textField);
        const falseResult = (fieldMapper as any).convertValueForFieldType(false, textField);
        expect(trueResult).toBe('true');
        expect(falseResult).toBe('false');
      });

      it('should convert Date values', () => {
        const date = new Date('2023-01-01T00:00:00.000Z');
        const result = (fieldMapper as any).convertValueForFieldType(date, textField);
        expect(result).toBe('2023-01-01T00:00:00.000Z');
      });

      it('should convert object values to JSON', () => {
        const obj = { key: 'value', number: 123 };
        const result = (fieldMapper as any).convertValueForFieldType(obj, textField);
        expect(result).toBe('{"key":"value","number":123}');
      });

      it('should handle null and undefined values', () => {
        const nullResult = (fieldMapper as any).convertValueForFieldType(null, textField);
        const undefinedResult = (fieldMapper as any).convertValueForFieldType(undefined, textField);
        expect(nullResult).toBe('');
        expect(undefinedResult).toBe('');
      });

      it('should enforce max length constraints', () => {
        const longText = 'a'.repeat(100);
        expect(() => {
          (fieldMapper as any).convertValueForFieldType(longText, textField);
        }).toThrow('Text value exceeds maximum length of 50 characters');
      });

      it('should handle special number values', () => {
        expect(() => {
          (fieldMapper as any).convertValueForFieldType(NaN, textField);
        }).toThrow('Cannot use NaN as text value');

        expect(() => {
          (fieldMapper as any).convertValueForFieldType(Infinity, textField);
        }).toThrow('Cannot use infinite number as text value');
      });

      it('should enforce general length limit', () => {
        const veryLongText = 'a'.repeat(15000);
        const unlimitedTextField = { ...textField, maxLength: undefined };
        
        expect(() => {
          (fieldMapper as any).convertValueForFieldType(veryLongText, unlimitedTextField);
        }).toThrow('Text value exceeds maximum allowed length of 10,000 characters');
      });
    });

    describe('checkbox field conversion', () => {
      const checkboxField: IFieldInfo = {
        name: 'checkboxField',
        type: 'checkbox',
        required: false,
      };

      it('should convert boolean values', () => {
        const trueResult = (fieldMapper as any).convertValueForFieldType(true, checkboxField);
        const falseResult = (fieldMapper as any).convertValueForFieldType(false, checkboxField);
        expect(trueResult).toBe('Yes');
        expect(falseResult).toBe('Off');
      });

      it('should convert truthy string values', () => {
        const truthyStrings = ['true', 'yes', '1', 'on', 'checked', 'selected'];
        truthyStrings.forEach(str => {
          const result = (fieldMapper as any).convertValueForFieldType(str, checkboxField);
          expect(result).toBe('Yes');
        });
      });

      it('should convert falsy string values', () => {
        const falsyStrings = ['false', 'no', '0', 'off', 'unchecked', 'unselected', ''];
        falsyStrings.forEach(str => {
          const result = (fieldMapper as any).convertValueForFieldType(str, checkboxField);
          expect(result).toBe('Off');
        });
      });

      it('should handle case insensitive string values', () => {
        const result1 = (fieldMapper as any).convertValueForFieldType('TRUE', checkboxField);
        const result2 = (fieldMapper as any).convertValueForFieldType('Yes', checkboxField);
        const result3 = (fieldMapper as any).convertValueForFieldType('FALSE', checkboxField);
        expect(result1).toBe('Yes');
        expect(result2).toBe('Yes');
        expect(result3).toBe('Off');
      });

      it('should convert number values', () => {
        const zeroResult = (fieldMapper as any).convertValueForFieldType(0, checkboxField);
        const nonZeroResult = (fieldMapper as any).convertValueForFieldType(42, checkboxField);
        const nanResult = (fieldMapper as any).convertValueForFieldType(NaN, checkboxField);
        expect(zeroResult).toBe('Off');
        expect(nonZeroResult).toBe('Yes');
        expect(nanResult).toBe('Off');
      });

      it('should handle null and undefined values', () => {
        const nullResult = (fieldMapper as any).convertValueForFieldType(null, checkboxField);
        const undefinedResult = (fieldMapper as any).convertValueForFieldType(undefined, checkboxField);
        expect(nullResult).toBe('Off');
        expect(undefinedResult).toBe('Off');
      });

      it('should handle non-empty strings as truthy', () => {
        const result = (fieldMapper as any).convertValueForFieldType('any text', checkboxField);
        expect(result).toBe('Yes');
      });
    });

    describe('dropdown field conversion', () => {
      const dropdownField: IFieldInfo = {
        name: 'dropdownField',
        type: 'dropdown',
        required: false,
        options: ['Option1', 'Option2', 'Option3'],
      };

      it('should convert exact matching values', () => {
        const result = (fieldMapper as any).convertValueForFieldType('Option1', dropdownField);
        expect(result).toBe('Option1');
      });

      it('should handle case insensitive matching', () => {
        const result = (fieldMapper as any).convertValueForFieldType('option1', dropdownField);
        expect(result).toBe('Option1');
      });

      it('should throw error for invalid options', () => {
        expect(() => {
          (fieldMapper as any).convertValueForFieldType('InvalidOption', dropdownField);
        }).toThrow('Invalid dropdown value \'InvalidOption\'. Available options: Option1, Option2, Option3');
      });

      it('should handle null and undefined values', () => {
        const nullResult = (fieldMapper as any).convertValueForFieldType(null, dropdownField);
        const undefinedResult = (fieldMapper as any).convertValueForFieldType(undefined, dropdownField);
        expect(nullResult).toBe('');
        expect(undefinedResult).toBe('');
      });

      it('should handle dropdown without options', () => {
        const noOptionsField = { ...dropdownField, options: [] };
        const result = (fieldMapper as any).convertValueForFieldType('AnyValue', noOptionsField);
        expect(result).toBe('AnyValue');
      });

      it('should convert non-string values to string', () => {
        const result = (fieldMapper as any).convertValueForFieldType(123, dropdownField);
        expect(result).toBe('123');
      });
    });

    describe('radio field conversion', () => {
      const radioField: IFieldInfo = {
        name: 'radioField',
        type: 'radio',
        required: false,
        options: ['Male', 'Female', 'Other'],
      };

      it('should convert exact matching values', () => {
        const result = (fieldMapper as any).convertValueForFieldType('Male', radioField);
        expect(result).toBe('Male');
      });

      it('should handle case insensitive matching', () => {
        const result = (fieldMapper as any).convertValueForFieldType('female', radioField);
        expect(result).toBe('Female');
      });

      it('should throw error for invalid options', () => {
        expect(() => {
          (fieldMapper as any).convertValueForFieldType('InvalidGender', radioField);
        }).toThrow('Invalid radio button value \'InvalidGender\'. Available options: Male, Female, Other');
      });

      it('should handle radio without options', () => {
        const noOptionsField = { ...radioField, options: [] };
        const result = (fieldMapper as any).convertValueForFieldType('AnyValue', noOptionsField);
        expect(result).toBe('AnyValue');
      });

      it('should handle null and undefined values', () => {
        const nullResult = (fieldMapper as any).convertValueForFieldType(null, radioField);
        const undefinedResult = (fieldMapper as any).convertValueForFieldType(undefined, radioField);
        expect(nullResult).toBe('');
        expect(undefinedResult).toBe('');
      });
    });
  });

  describe('validateMappings', () => {
    it('should validate correct mappings', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John',
        },
        {
          pdfFieldName: 'subscribe',
          valueSource: 'expression',
          expression: '{{ $json.isActive }}',
        },
      ];

      mockContext.evaluateExpression.mockReturnValue(true);

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect non-existent PDF fields', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'nonExistentField',
          valueSource: 'static',
          staticValue: 'value',
        },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field \'nonExistentField\' not found in PDF');
    });

    it('should detect missing static values', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: null,
        },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Static value required for field \'firstName\'');
    });

    it('should detect missing expressions', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '',
        },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expression required for field \'firstName\'');
    });

    it('should detect invalid value sources', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'invalid' as any,
          staticValue: 'value',
        },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid value source \'invalid\' for field \'firstName\'');
    });

    it('should detect invalid expressions', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '{{ invalid expression',
        },
      ];

      mockContext.evaluateExpression.mockImplementation(() => {
        throw new Error('Syntax error');
      });

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid expression for field \'firstName\': Syntax error');
    });
  });

  describe('expression validation', () => {
    it('should validate correct expression syntax', async () => {
      const validExpressions = [
        '{{ $json.field }}',
        '{{ $json["field"] }}',
        '{{ $node["NodeName"].json.field }}',
        '{{ $json.field || "default" }}',
        '{{ $json.field ? "yes" : "no" }}',
      ];

      for (const expression of validExpressions) {
        mockContext.evaluateExpression.mockReturnValue('test');
        const result = await (fieldMapper as any).validateExpressionSyntax(expression);
        expect(result.valid).toBe(true);
      }
    });

    it('should detect mismatched braces', async () => {
      const invalidExpressions = [
        '{{ $json.field',
        '$json.field }}',
        '{{ $json.field } }',
        '{ { $json.field }}',
      ];

      for (const expression of invalidExpressions) {
        const result = await (fieldMapper as any).validateExpressionSyntax(expression);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Mismatched braces');
      }
    });

    it('should detect potentially unsafe expressions', async () => {
      const unsafeExpressions = [
        '{{ eval("dangerous code") }}',
        '{{ Function("return process") }}',
        '{{ require("fs") }}',
        '{{ process.exit() }}',
        '{{ global.something }}',
        '{{ __dirname }}',
      ];

      for (const expression of unsafeExpressions) {
        const result = await (fieldMapper as any).validateExpressionSyntax(expression);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('potentially unsafe code');
      }
    });

    it('should detect common expression mistakes', async () => {
      const mistakes = [
        { expr: '{{ $json }}', error: 'Use $json["propertyName"]' },
        { expr: '{{ $ }}', error: 'Invalid expression syntax' },
        { expr: '{{ json }}', error: 'Use $json instead of json' },
      ];

      for (const { expr, error } of mistakes) {
        const result = await (fieldMapper as any).validateExpressionSyntax(expr);
        expect(result.valid).toBe(false);
        expect(result.error).toContain(error);
      }
    });

    it('should validate expression results', () => {
      const testCases = [
        { result: undefined, valid: false, warning: 'evaluated to undefined' },
        { result: null, valid: true, warning: 'evaluated to null' },
        { result: 'normal string', valid: true, warning: undefined },
        { result: 'x'.repeat(60000), valid: true, warning: 'very large' },
      ];

      testCases.forEach(({ result, valid, warning }) => {
        const validation = (fieldMapper as any).validateExpressionResult(result, '{{ $json.test }}');
        expect(validation.valid).toBe(valid);
        if (warning) {
          expect(validation.warning).toContain(warning);
        }
      });
    });

    it('should detect circular references in expression results', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const validation = (fieldMapper as any).validateExpressionResult(circularObj, '{{ $json.circular }}');
      expect(validation.valid).toBe(false);
      expect(validation.warning).toContain('circular references');
    });
  });

  describe('utility methods', () => {
    it('should get mapping summary', () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'field1',
          valueSource: 'static',
          staticValue: 'value1',
        },
        {
          pdfFieldName: 'field2',
          valueSource: 'expression',
          expression: '{{ $json.field2 }}',
        },
      ];

      const summary = fieldMapper.getMappingSummary(fieldMappings);

      expect(summary).toContain('Field mappings (2)');
      expect(summary).toContain('field1 <- static: "value1"');
      expect(summary).toContain('field2 <- expression: "{{ $json.field2 }}"');
    });

    it('should set and get item index', () => {
      expect(fieldMapper.getItemIndex()).toBe(0);
      
      fieldMapper.setItemIndex(5);
      expect(fieldMapper.getItemIndex()).toBe(5);
    });

    it('should get expression context information', () => {
      const context = fieldMapper.getExpressionContext();

      expect(context).toHaveProperty('itemIndex');
      expect(context).toHaveProperty('totalItems');
      expect(context).toHaveProperty('currentItemKeys');
      expect(context.itemIndex).toBe(0);
      expect(context.totalItems).toBe(1);
      expect(context.currentItemKeys).toContain('firstName');
    });

    it('should provide expression suggestions', () => {
      const suggestions = fieldMapper.getExpressionSuggestions();

      expect(suggestions).toContain('{{ $json["propertyName"] }}');
      expect(suggestions).toContain('{{ $json.propertyName }}');
      expect(suggestions.some(s => s.includes('firstName'))).toBe(true);
    });

    it('should handle expression context errors gracefully', () => {
      mockContext.getInputData.mockImplementation(() => {
        throw new Error('Context error');
      });

      const context = fieldMapper.getExpressionContext();

      expect(context).toHaveProperty('error');
      expect(context.error).toBe('Could not retrieve expression context');
    });
  });

  describe('createFieldMapper utility', () => {
    it('should create configured field mapper instance', () => {
      const mapper = createFieldMapper(mockContext, 5);

      expect(mapper).toBeInstanceOf(FieldMapper);
      expect(mapper.getItemIndex()).toBe(5);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty field mappings', async () => {
      const result = await fieldMapper.mapFieldsToValues([], mockPdfFields);
      expect(result).toEqual({});
    });

    it('should handle empty PDF fields', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'anyField',
          valueSource: 'static',
          staticValue: 'value',
        },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field \'anyField\' not found in PDF');
    });

    it('should handle complex object values in expressions', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '{{ $json.complexObject }}',
        },
      ];

      const complexObject = {
        nested: { value: 'test' },
        array: [1, 2, 3],
        date: new Date(),
      };

      mockContext.evaluateExpression.mockReturnValue(complexObject);

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result.firstName).toBe(JSON.stringify(complexObject));
    });

    it('should handle very long field names', async () => {
      const longFieldName = 'a'.repeat(1000);
      const longField: IFieldInfo = {
        name: longFieldName,
        type: 'text',
        required: false,
      };

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: longFieldName,
          valueSource: 'static',
          staticValue: 'value',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, [longField]);
      expect(result[longFieldName]).toBe('value');
    });

    it('should handle special characters in field names', async () => {
      const specialField: IFieldInfo = {
        name: 'field-with_special.chars@123',
        type: 'text',
        required: false,
      };

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'field-with_special.chars@123',
          valueSource: 'static',
          staticValue: 'special value',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, [specialField]);
      expect(result['field-with_special.chars@123']).toBe('special value');
    });

    it('should handle Unicode characters in values', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: '测试用户 🚀 émojis',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
      expect(result.firstName).toBe('测试用户 🚀 émojis');
    });
  });

  describe('performance tests', () => {
    it('should handle large number of field mappings efficiently', async () => {
      const manyMappings: IFieldMapping[] = Array.from({ length: 100 }, (_, i) => ({
        pdfFieldName: `field${i}`,
        valueSource: 'static',
        staticValue: `value${i}`,
      }));

      const manyFields: IFieldInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `field${i}`,
        type: 'text',
        required: false,
      }));

      const startTime = Date.now();
      const result = await fieldMapper.mapFieldsToValues(manyMappings, manyFields);
      const endTime = Date.now();

      expect(Object.keys(result)).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex expressions efficiently', async () => {
      const complexMappings: IFieldMapping[] = Array.from({ length: 50 }, (_, i) => ({
        pdfFieldName: `field${i}`,
        valueSource: 'expression',
        expression: `{{ $json.data.items[${i}].value + " processed" }}`,
      }));

      const fields: IFieldInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `field${i}`,
        type: 'text',
        required: false,
      }));

      mockContext.evaluateExpression.mockImplementation((expr) => `result for ${expr}`);

      const startTime = Date.now();
      const result = await fieldMapper.mapFieldsToValues(complexMappings, fields);
      const endTime = Date.now();

      expect(Object.keys(result)).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});