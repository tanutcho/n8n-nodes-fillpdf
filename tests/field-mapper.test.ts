import { FieldMapper } from '../nodes/FillPdf/field-mapper';
import { IFieldMapping, IFieldInfo } from '../nodes/FillPdf/types';
import { IExecuteFunctions } from 'n8n-workflow';

// Mock n8n execution context
const mockContext = {
  evaluateExpression: jest.fn(),
} as unknown as IExecuteFunctions;

describe('FieldMapper', () => {
  let fieldMapper: FieldMapper;
  
  const mockPdfFields: IFieldInfo[] = [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      maxLength: 50,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      maxLength: 50,
    },
    {
      name: 'email',
      type: 'text',
      required: false,
      maxLength: 100,
    },
    {
      name: 'subscribe',
      type: 'checkbox',
      required: false,
    },
    {
      name: 'gender',
      type: 'radio',
      required: false,
      options: ['Male', 'Female', 'Other'],
    },
    {
      name: 'country',
      type: 'dropdown',
      required: false,
      options: ['USA', 'Canada', 'UK', 'Other'],
    },
  ];

  beforeEach(() => {
    fieldMapper = new FieldMapper(mockContext, 0);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with context and item index', () => {
      const mapper = new FieldMapper(mockContext, 5);
      expect(mapper.getItemIndex()).toBe(5);
    });

    it('should default to item index 0', () => {
      const mapper = new FieldMapper(mockContext);
      expect(mapper.getItemIndex()).toBe(0);
    });
  });

  describe('mapFieldsToValues', () => {
    it('should map static values correctly', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John',
        },
        {
          pdfFieldName: 'lastName',
          valueSource: 'static',
          staticValue: 'Doe',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should map expression values correctly', async () => {
      (mockContext.evaluateExpression as jest.Mock)
        .mockReturnValueOnce('Jane')
        .mockReturnValueOnce('Smith');

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '{{$json.firstName}}',
        },
        {
          pdfFieldName: 'lastName',
          valueSource: 'expression',
          expression: '{{$json.lastName}}',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'Jane',
        lastName: 'Smith',
      });
      expect(mockContext.evaluateExpression).toHaveBeenCalledWith('{{$json.firstName}}', 0);
      expect(mockContext.evaluateExpression).toHaveBeenCalledWith('{{$json.lastName}}', 0);
    });

    it('should handle mixed static and expression values', async () => {
      (mockContext.evaluateExpression as jest.Mock).mockReturnValue('test@example.com');

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'static',
          staticValue: 'John',
        },
        {
          pdfFieldName: 'email',
          valueSource: 'expression',
          expression: '{{$json.email}}',
        },
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);

      expect(result).toEqual({
        firstName: 'John',
        email: 'test@example.com',
      });
    });

    it('should throw error for non-existent PDF fields', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'nonExistentField',
          valueSource: 'static',
          staticValue: 'value',
        },
      ];

      await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
        .rejects.toThrow('Field \'nonExistentField\' not found in PDF');
    });

    it('should throw error for missing expression', async () => {
      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '',
        },
      ];

      await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
        .rejects.toThrow('Expression is required for expression-based mapping');
    });

    it('should handle expression evaluation errors', async () => {
      (mockContext.evaluateExpression as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid expression syntax');
      });

      const fieldMappings: IFieldMapping[] = [
        {
          pdfFieldName: 'firstName',
          valueSource: 'expression',
          expression: '{{invalid}}',
        },
      ];

      await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
        .rejects.toThrow('Expression evaluation failed');
    });
  });

  describe('convertValueForFieldType', () => {
    describe('text fields', () => {
      it('should convert string values', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'firstName', valueSource: 'static', staticValue: 'John' },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.firstName).toBe('John');
      });

      it('should convert number values to string', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'firstName', valueSource: 'static', staticValue: 123 },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.firstName).toBe('123');
      });

      it('should convert boolean values to string', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'firstName', valueSource: 'static', staticValue: true },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.firstName).toBe('true');
      });

      it('should handle null/undefined values', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'email', valueSource: 'static', staticValue: null },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.email).toBe('');
      });

      it('should enforce max length constraints', async () => {
        const longValue = 'a'.repeat(100); // Exceeds maxLength of 50
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'firstName', valueSource: 'static', staticValue: longValue },
        ];

        await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
          .rejects.toThrow('Text value exceeds maximum length of 50 characters');
      });
    });

    describe('checkbox fields', () => {
      it('should convert boolean true to "Yes"', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: true },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.subscribe).toBe('Yes');
      });

      it('should convert boolean false to "Off"', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: false },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.subscribe).toBe('Off');
      });

      it('should convert truthy strings to "Yes"', async () => {
        const truthyValues = ['true', 'yes', '1', 'on', 'checked'];
        
        for (const value of truthyValues) {
          const fieldMappings: IFieldMapping[] = [
            { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: value },
          ];

          const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
          expect(result.subscribe).toBe('Yes');
        }
      });

      it('should convert falsy strings to "Off"', async () => {
        const falsyValues = ['false', 'no', '0', 'off', 'unchecked', ''];
        
        for (const value of falsyValues) {
          const fieldMappings: IFieldMapping[] = [
            { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: value },
          ];

          const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
          expect(result.subscribe).toBe('Off');
        }
      });

      it('should convert numbers correctly', async () => {
        const fieldMappings1: IFieldMapping[] = [
          { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: 1 },
        ];
        const fieldMappings2: IFieldMapping[] = [
          { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: 0 },
        ];

        const result1 = await fieldMapper.mapFieldsToValues(fieldMappings1, mockPdfFields);
        const result2 = await fieldMapper.mapFieldsToValues(fieldMappings2, mockPdfFields);
        
        expect(result1.subscribe).toBe('Yes');
        expect(result2.subscribe).toBe('Off');
      });
    });

    describe('radio fields', () => {
      it('should accept valid option values', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'gender', valueSource: 'static', staticValue: 'Male' },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.gender).toBe('Male');
      });

      it('should handle case-insensitive matching', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'gender', valueSource: 'static', staticValue: 'male' },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.gender).toBe('Male'); // Should return the exact option value
      });

      it('should throw error for invalid option values', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'gender', valueSource: 'static', staticValue: 'Invalid' },
        ];

        await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
          .rejects.toThrow('Invalid radio button value \'Invalid\'. Available options: Male, Female, Other');
      });
    });

    describe('dropdown fields', () => {
      it('should accept valid option values', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'country', valueSource: 'static', staticValue: 'USA' },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.country).toBe('USA');
      });

      it('should handle case-insensitive matching', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'country', valueSource: 'static', staticValue: 'usa' },
        ];

        const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
        expect(result.country).toBe('USA');
      });

      it('should throw error for invalid option values', async () => {
        const fieldMappings: IFieldMapping[] = [
          { pdfFieldName: 'country', valueSource: 'static', staticValue: 'Mars' },
        ];

        await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
          .rejects.toThrow('Invalid dropdown value \'Mars\'. Available options: USA, Canada, UK, Other');
      });
    });
  });

  describe('validateMappings', () => {
    it('should validate correct mappings', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'firstName', valueSource: 'static', staticValue: 'John' },
        { pdfFieldName: 'email', valueSource: 'expression', expression: '{{$json.email}}' },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect non-existent fields', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'nonExistent', valueSource: 'static', staticValue: 'value' },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field \'nonExistent\' not found in PDF');
    });

    it('should detect missing static values', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'firstName', valueSource: 'static', staticValue: null },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Static value required for field \'firstName\'');
    });

    it('should detect missing expressions', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'firstName', valueSource: 'expression', expression: '' },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expression required for field \'firstName\'');
    });

    it('should detect invalid value sources', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'firstName', valueSource: 'invalid' as any, staticValue: 'value' },
      ];

      const result = await fieldMapper.validateMappings(fieldMappings, mockPdfFields);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid value source \'invalid\' for field \'firstName\'');
    });
  });

  describe('utility methods', () => {
    it('should set and get item index', () => {
      fieldMapper.setItemIndex(5);
      expect(fieldMapper.getItemIndex()).toBe(5);
    });

    it('should generate mapping summary', () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'firstName', valueSource: 'static', staticValue: 'John' },
        { pdfFieldName: 'email', valueSource: 'expression', expression: '{{$json.email}}' },
      ];

      const summary = fieldMapper.getMappingSummary(fieldMappings);
      
      expect(summary).toContain('Field mappings (2)');
      expect(summary).toContain('firstName <- static: "John"');
      expect(summary).toContain('email <- expression: "{{$json.email}}"');
    });

    it('should handle empty mappings in summary', () => {
      const summary = fieldMapper.getMappingSummary([]);
      expect(summary).toContain('Field mappings (0)');
      expect(summary).toContain('No field mappings configured');
    });

    it('should truncate long values in summary', () => {
      const longValue = 'a'.repeat(100);
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'longField', valueSource: 'static', staticValue: longValue },
      ];

      const summary = fieldMapper.getMappingSummary(fieldMappings);
      expect(summary).toContain('...');
    });
  });

  describe('required field validation', () => {
    it('should enforce required fields', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'firstName', valueSource: 'static', staticValue: '' }, // Empty required field
      ];

      await expect(fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields))
        .rejects.toThrow('This field is required and cannot be empty');
    });

    it('should allow empty values for non-required fields', async () => {
      const fieldMappings: IFieldMapping[] = [
        { pdfFieldName: 'email', valueSource: 'static', staticValue: '' }, // Empty non-required field
      ];

      const result = await fieldMapper.mapFieldsToValues(fieldMappings, mockPdfFields);
      expect(result.email).toBe('');
    });
  });
});