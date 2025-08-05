import { ValidationUtils } from '../nodes/FillPdf/validation';
import { IExecuteFunctions } from 'n8n-workflow';

// Mock IExecuteFunctions for testing
const createMockExecuteFunctions = (parameters: any = {}): IExecuteFunctions => {
  return {
    getNodeParameter: jest.fn((paramName: string, _itemIndex: number, defaultValue?: any) => {
      return parameters[paramName] !== undefined ? parameters[paramName] : defaultValue;
    }),
    getInputData: jest.fn(() => [{ json: { test: 'data' } }]),
    getNode: jest.fn(() => ({ name: 'Test Node', type: 'test' })),
  } as any;
};

describe('ValidationUtils', () => {
  describe('validateNodeParameters', () => {
    it('should validate correct parameters', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'upload',
        pdfFile: 'test.pdf',
        fieldMappings: {
          mapping: [
            {
              pdfFieldName: 'name',
              valueSource: 'static',
              staticValue: 'John Doe',
            },
          ],
        },
        outputFormat: 'binary',
        options: {
          flattenPdf: true,
          validateFields: true,
          skipMissingFields: false,
        },
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required parameters', async () => {
      const mockContext = createMockExecuteFunctions({
        fieldMappings: { mapping: [] },
        outputFormat: 'binary',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate PDF source upload with missing file', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'upload',
        pdfFile: '',
        fieldMappings: { mapping: [] },
        outputFormat: 'binary',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PDF file is required when using upload source');
    });

    it('should validate PDF source URL with invalid URL', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'url',
        pdfUrl: 'invalid-url',
        fieldMappings: { mapping: [] },
        outputFormat: 'binary',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });

    it('should validate PDF source binary with missing property name', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'binary',
        binaryPropertyName: '',
        fieldMappings: { mapping: [] },
        outputFormat: 'binary',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Binary property name is required when using binary source');
    });

    it('should validate invalid output format', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'upload',
        pdfFile: 'test.pdf',
        fieldMappings: { mapping: [] },
        outputFormat: 'invalid',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid output format: invalid. Must be one of: binary, file, both');
    });

    it('should validate file output format with missing output path', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'upload',
        pdfFile: 'test.pdf',
        fieldMappings: { mapping: [] },
        outputFormat: 'file',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output path is required');
    });

    it('should validate boolean options', async () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'upload',
        pdfFile: 'test.pdf',
        fieldMappings: { mapping: [] },
        outputFormat: 'binary',
        options: {
          flattenPdf: 'not-boolean',
          validateFields: true,
          skipMissingFields: false,
        },
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Option "flattenPdf" must be a boolean value');
    });

    it('should handle parameter validation errors gracefully', async () => {
      const mockContext = createMockExecuteFunctions();
      // Mock getNodeParameter to throw an error
      (mockContext.getNodeParameter as jest.Mock).mockImplementation(() => {
        throw new Error('Parameter not found');
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Parameter validation failed');
    });

    it('should validate complex field mappings', async () => {
      const validMappings = [
        {
          pdfFieldName: 'name',
          valueSource: 'static' as const,
          staticValue: 'John Doe',
        },
        {
          pdfFieldName: 'email',
          valueSource: 'expression' as const,
          expression: '{{ $json["email"] }}',
        },
      ];

      const mockContext = createMockExecuteFunctions({
        pdfSource: 'upload',
        pdfFile: 'test.pdf',
        fieldMappings: { mapping: validMappings },
        outputFormat: 'binary',
        options: {},
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.validateNodeParameters();
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateInputData', () => {
    it('should validate valid input data', () => {
      const mockContext = createMockExecuteFunctions();
      (mockContext.getInputData as jest.Mock).mockReturnValue([
        { json: { name: 'John', email: 'john@example.com' } }
      ]);

      const validator = new ValidationUtils(mockContext, 0);
      const result = validator.validateInputData();
      
      expect(result.isValid).toBe(true);
    });

    it('should handle null input data', () => {
      const mockContext = createMockExecuteFunctions();
      (mockContext.getInputData as jest.Mock).mockReturnValue(null);

      const validator = new ValidationUtils(mockContext, 0);
      const result = validator.validateInputData();
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No input data received from previous nodes');
    });

    it('should validate binary data when using binary source', () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'binary',
        binaryPropertyName: 'pdf',
      });
      
      (mockContext.getInputData as jest.Mock).mockReturnValue([
        { 
          json: { test: 'data' },
          binary: {
            pdf: {
              data: 'base64data',
              mimeType: 'application/pdf'
            }
          }
        }
      ]);

      const validator = new ValidationUtils(mockContext, 0);
      const result = validator.validateInputData();
      
      expect(result.isValid).toBe(true);
    });

    it('should detect missing binary data', () => {
      const mockContext = createMockExecuteFunctions({
        pdfSource: 'binary',
        binaryPropertyName: 'pdf',
      });
      
      (mockContext.getInputData as jest.Mock).mockReturnValue([
        { json: { test: 'data' } }
      ]);

      const validator = new ValidationUtils(mockContext, 0);
      const result = validator.validateInputData();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Input item 0 missing binary property "pdf"');
    });

    it('should handle input data validation errors', () => {
      const mockContext = createMockExecuteFunctions();
      (mockContext.getInputData as jest.Mock).mockImplementation(() => {
        throw new Error('Input data error');
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = validator.validateInputData();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Failed to validate input data');
    });
  });

  describe('performSafetyChecks', () => {
    it('should perform basic safety checks', async () => {
      const mockContext = createMockExecuteFunctions({
        outputFormat: 'binary',
        fieldMappings: { mapping: [] },
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.performSafetyChecks();
      
      expect(result).toHaveProperty('isSafe');
      expect(result).toHaveProperty('risks');
      expect(result).toHaveProperty('recommendations');
    });

    it('should detect unsafe expressions', async () => {
      const mockContext = createMockExecuteFunctions({
        outputFormat: 'binary',
        fieldMappings: {
          mapping: [
            {
              pdfFieldName: 'test',
              valueSource: 'expression',
              expression: '{{ eval("dangerous code") }}',
            }
          ]
        },
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.performSafetyChecks();
      
      expect(result.isSafe).toBe(false);
      expect(result.risks.some(risk => risk.includes('unsafe expression'))).toBe(true);
    });

    it('should handle safety check errors gracefully', async () => {
      const mockContext = createMockExecuteFunctions();
      (mockContext.getNodeParameter as jest.Mock).mockImplementation(() => {
        throw new Error('Parameter error');
      });

      const validator = new ValidationUtils(mockContext, 0);
      const result = await validator.performSafetyChecks();
      
      expect(result.isSafe).toBe(false);
      expect(result.risks.length).toBeGreaterThan(0);
    });
  });
});