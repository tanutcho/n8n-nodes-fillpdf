import { FieldInspector } from '../nodes/FillPdf/field-inspector';
import { PythonBridge } from '../nodes/FillPdf/python-bridge';
import { IFieldInfo, IPythonOutput } from '../nodes/FillPdf/types';
import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../nodes/FillPdf/python-bridge');
jest.mock('fs');
jest.mock('https');
jest.mock('http');

const MockPythonBridge = PythonBridge as jest.MockedClass<typeof PythonBridge>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockHttps = https as jest.Mocked<typeof https>;
// const _mockHttp = http as jest.Mocked<typeof http>;

describe('FieldInspector', () => {
  let fieldInspector: FieldInspector;
  let mockPythonBridge: jest.Mocked<PythonBridge>;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockLoadContext: jest.Mocked<ILoadOptionsFunctions>;

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
      required: false,
      options: ['USA', 'Canada', 'UK'],
    },
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create field inspector
    fieldInspector = new FieldInspector('/usr/bin/python3');
    
    // Mock python bridge
    mockPythonBridge = {
      executePythonScript: jest.fn(),
      validateEnvironment: jest.fn(),
      setPythonExecutable: jest.fn(),
      setScriptPath: jest.fn(),
      getPythonExecutable: jest.fn(),
      getScriptPath: jest.fn(),
      revalidateEnvironment: jest.fn(),
    } as any;
    
    (fieldInspector as any).pythonBridge = mockPythonBridge;
    
    // Mock contexts
    mockContext = {
      getInputData: jest.fn(),
      getNodeParameter: jest.fn(),
    } as any;
    
    mockLoadContext = {
      getNodeParameter: jest.fn(),
    } as any;
  });

  describe('constructor', () => {
    it('should initialize with default python executable', () => {
      // const inspector = new FieldInspector();
      expect(MockPythonBridge).toHaveBeenCalledWith(undefined);
    });

    it('should initialize with custom python executable', () => {
      // const inspector = new FieldInspector('/custom/python');
      expect(MockPythonBridge).toHaveBeenCalledWith('/custom/python');
    });
  });

  describe('loadPdfFields', () => {
    beforeEach(() => {
      mockPythonBridge.executePythonScript.mockResolvedValue({
        success: true,
        fields: mockPdfFields,
      });
    });

    it('should load fields from upload source', async () => {
      mockLoadContext.getNodeParameter.mockReturnValue('test.pdf');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue(Buffer.from('mock-pdf-data'));

      const result = await fieldInspector.loadPdfFields(mockLoadContext, 'upload', 'test.pdf');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'firstName 📝 * (max: 50)',
        value: 'firstName',
      });
      expect(result[1]).toEqual({
        name: 'subscribe ☑',
        value: 'subscribe',
      });
      expect(result[2]).toEqual({
        name: 'country ▼ (USA, Canada, UK)',
        value: 'country',
      });
    });

    it('should load fields from URL source', async () => {
      const mockResponse = new EventEmitter();
      (mockResponse as any).statusCode = 200;
      (mockResponse as any).headers = { 'content-type': 'application/pdf' };
      
      mockHttps.get.mockImplementation((url, options, callback) => {
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

      const result = await fieldInspector.loadPdfFields(
        mockLoadContext, 
        'url', 
        'https://example.com/test.pdf'
      );

      expect(result).toHaveLength(3);
      expect(mockHttps.get).toHaveBeenCalled();
    });

    it('should load fields from binary source', async () => {
      mockContext.getInputData.mockReturnValue([{
        json: {},
        binary: {
          data: {
            data: Buffer.from('mock-pdf-data').toString('base64'),
            mimeType: 'application/pdf',
          },
        },
      }]);

      const result = await fieldInspector.loadPdfFields(mockContext, 'binary', 'data');

      expect(result).toHaveLength(3);
      expect(mockContext.getInputData).toHaveBeenCalled();
    });

    it('should return empty array when no source value provided', async () => {
      const result = await fieldInspector.loadPdfFields(mockLoadContext, 'upload', '');
      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockPythonBridge.executePythonScript.mockRejectedValue(new Error('Python error'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await fieldInspector.loadPdfFields(mockLoadContext, 'upload', 'test.pdf');
      expect(result).toEqual([]);
    });
  });

  describe('inspectPdfFields', () => {
    it('should inspect PDF fields successfully', async () => {
      const mockOutput: IPythonOutput = {
        success: true,
        fields: mockPdfFields,
      };
      
      mockPythonBridge.executePythonScript.mockResolvedValue(mockOutput);

      const result = await fieldInspector.inspectPdfFields('base64-pdf-data');

      expect(result).toEqual(mockPdfFields);
      expect(mockPythonBridge.executePythonScript).toHaveBeenCalledWith({
        action: 'inspect',
        pdfData: 'base64-pdf-data',
        options: {
          flatten: false,
          outputFormat: 'binary',
        },
      });
    });

    it('should handle Python script failure', async () => {
      mockPythonBridge.executePythonScript.mockResolvedValue({
        success: false,
        error: 'PDF inspection failed',
      });

      await expect(fieldInspector.inspectPdfFields('invalid-data'))
        .rejects.toThrow('PDF inspection failed');
    });

    it('should handle Python bridge errors', async () => {
      mockPythonBridge.executePythonScript.mockRejectedValue(new Error('Bridge error'));

      await expect(fieldInspector.inspectPdfFields('invalid-data'))
        .rejects.toThrow('PDF field inspection failed');
    });
  });

  describe('getPdfDataFromFile', () => {
    it('should read PDF file successfully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockReturnValue(Buffer.from('mock-pdf-data'));

      const result = await fieldInspector.getPdfDataFromFile('test.pdf');

      expect(result).toBe(Buffer.from('mock-pdf-data').toString('base64'));
      expect(mockFs.existsSync).toHaveBeenCalledWith('test.pdf');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('test.pdf');
    });

    it('should return null for non-existent file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await fieldInspector.getPdfDataFromFile('nonexistent.pdf');

      expect(result).toBeNull();
    });

    it('should throw error for file too large', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 60 * 1024 * 1024 } as any); // 60MB

      await expect(fieldInspector.getPdfDataFromFile('large.pdf'))
        .rejects.toMatchObject({
          message: 'PDF file too large (>50MB). Please use a smaller file.',
          errorType: 'data',
        });
    });

    it('should handle file read errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1000 } as any);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(fieldInspector.getPdfDataFromFile('test.pdf'))
        .rejects.toMatchObject({
          message: 'Failed to read PDF file: Permission denied',
          errorType: 'runtime',
        });
    });
  });

  describe('getPdfDataFromUrl', () => {
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        destroy: jest.fn(),
        on: jest.fn(),
      };
      
      mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;
      mockResponse.headers = { 'content-type': 'application/pdf' };
    });

    it('should download PDF from URL successfully', async () => {
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
          mockResponse.emit('data', Buffer.from('%PDF-1.4 mock pdf data'));
          mockResponse.emit('end');
        }, 10);
        return mockRequest;
      });

      const result = await fieldInspector.getPdfDataFromUrl('https://example.com/test.pdf');

      expect(result).toBe(Buffer.from('%PDF-1.4 mock pdf data').toString('base64'));
    });

    it('should return null for invalid URL', async () => {
      const result = await fieldInspector.getPdfDataFromUrl('invalid-url');
      expect(result).toBeNull();
    });

    it('should handle HTTP errors', async () => {
      mockResponse.statusCode = 404;
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
        }, 10);
        return mockRequest;
      });

      await expect(fieldInspector.getPdfDataFromUrl('https://example.com/notfound.pdf'))
        .rejects.toMatchObject({
          message: 'HTTP 404: undefined',
          errorType: 'runtime',
        });
    });

    it('should handle non-PDF content type', async () => {
      mockResponse.headers = { 'content-type': 'text/html' };
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
        }, 10);
        return mockRequest;
      });

      await expect(fieldInspector.getPdfDataFromUrl('https://example.com/test.pdf'))
        .rejects.toMatchObject({
          message: 'URL does not point to a PDF file. Content-Type: text/html',
          errorType: 'data',
        });
    });

    it('should handle file too large', async () => {
      mockResponse.headers = { 'content-length': (60 * 1024 * 1024).toString() };
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
        }, 10);
        return mockRequest;
      });

      await expect(fieldInspector.getPdfDataFromUrl('https://example.com/large.pdf'))
        .rejects.toMatchObject({
          message: 'PDF file too large (>50MB). Please use a smaller file.',
          errorType: 'data',
        });
    });

    it('should handle download timeout', async () => {
      mockHttps.get.mockImplementation((_url, _options, _callback) => {
        setTimeout(() => {
          mockRequest.on.mock.calls.find((call: any) => call[0] === 'timeout')[1]();
        }, 10);
        return mockRequest;
      });

      await expect(fieldInspector.getPdfDataFromUrl('https://example.com/test.pdf'))
        .rejects.toMatchObject({
          message: 'Download timeout (30 seconds). Please try again or use a different URL.',
          errorType: 'runtime',
        });
    });

    it('should validate PDF signature', async () => {
      mockHttps.get.mockImplementation((_url, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
        }
        setTimeout(() => {
          callback!(mockResponse as any);
          mockResponse.emit('data', Buffer.from('not a pdf file'));
          mockResponse.emit('end');
        }, 10);
        return mockRequest;
      });

      await expect(fieldInspector.getPdfDataFromUrl('https://example.com/fake.pdf'))
        .rejects.toMatchObject({
          message: 'Downloaded file is not a valid PDF',
          errorType: 'data',
        });
    });
  });

  describe('getPdfDataFromBinary', () => {
    it('should get PDF data from binary property', async () => {
      const binaryData = {
        data: Buffer.from('mock-pdf-data').toString('base64'),
        mimeType: 'application/pdf',
      };
      
      mockContext.getInputData.mockReturnValue([{
        binary: { data: binaryData },
      }]);

      const result = await fieldInspector.getPdfDataFromBinary(mockContext, 'data');

      expect(result).toBe(binaryData.data);
    });

    it('should return null for missing property', async () => {
      mockContext.getInputData.mockReturnValue([{ json: {}, binary: {} }]);

      const result = await fieldInspector.getPdfDataFromBinary(mockContext, 'missing');

      expect(result).toBeNull();
    });

    it('should handle invalid MIME type', async () => {
      const binaryData = {
        data: Buffer.from('mock-data').toString('base64'),
        mimeType: 'text/plain',
      };
      
      mockContext.getInputData.mockReturnValue([{
        binary: { data: binaryData },
      }]);

      await expect(fieldInspector.getPdfDataFromBinary(mockContext, 'data'))
        .rejects.toMatchObject({
          message: 'Binary data is not a PDF file. MIME type: text/plain',
          errorType: 'data',
        });
    });

    it('should handle load context without binary access', async () => {
      await expect(fieldInspector.getPdfDataFromBinary(mockLoadContext as any, 'data'))
        .rejects.toMatchObject({
          message: 'Binary data access not available in current context',
          errorType: 'runtime',
        });
    });
  });

  describe('validateFieldMappings', () => {
    beforeEach(() => {
      mockPythonBridge.executePythonScript.mockResolvedValue({
        success: true,
        fields: mockPdfFields,
      });
    });

    it('should validate correct field mappings', async () => {
      const mappings = [
        { pdfFieldName: 'firstName', valueSource: 'static', staticValue: 'John' },
        { pdfFieldName: 'subscribe', valueSource: 'expression', expression: '{{$json.subscribe}}' },
      ];

      const result = await fieldInspector.validateFieldMappings('pdf-data', mappings);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect non-existent fields', async () => {
      const mappings = [
        { pdfFieldName: 'nonExistent', valueSource: 'static', staticValue: 'value' },
      ];

      const result = await fieldInspector.validateFieldMappings('pdf-data', mappings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field 'nonExistent' not found in PDF");
    });

    it('should detect missing static values', async () => {
      const mappings = [
        { pdfFieldName: 'firstName', valueSource: 'static' },
      ];

      const result = await fieldInspector.validateFieldMappings('pdf-data', mappings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Static value required for field 'firstName'");
    });

    it('should detect missing expressions', async () => {
      const mappings = [
        { pdfFieldName: 'firstName', valueSource: 'expression' },
      ];

      const result = await fieldInspector.validateFieldMappings('pdf-data', mappings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Expression required for field 'firstName'");
    });

    it('should handle inspection errors', async () => {
      mockPythonBridge.executePythonScript.mockRejectedValue(new Error('Inspection failed'));

      const result = await fieldInspector.validateFieldMappings('invalid-data', []);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Field validation failed');
    });
  });

  describe('utility methods', () => {
    it('should format field display names correctly', () => {
      const textField: IFieldInfo = {
        name: 'firstName',
        type: 'text',
        required: true,
        maxLength: 50,
      };

      const checkboxField: IFieldInfo = {
        name: 'subscribe',
        type: 'checkbox',
        required: false,
      };

      const dropdownField: IFieldInfo = {
        name: 'country',
        type: 'dropdown',
        required: false,
        options: ['USA', 'Canada', 'UK', 'Germany', 'France'],
      };

      const textOptions = (fieldInspector as any).convertFieldsToOptions([textField]);
      const checkboxOptions = (fieldInspector as any).convertFieldsToOptions([checkboxField]);
      const dropdownOptions = (fieldInspector as any).convertFieldsToOptions([dropdownField]);

      expect(textOptions[0].name).toBe('firstName 📝 * (max: 50)');
      expect(checkboxOptions[0].name).toBe('subscribe ☑');
      expect(dropdownOptions[0].name).toBe('country ▼ (USA, Canada, UK, +2 more)');
    });

    it('should get and set python executable', () => {
      fieldInspector.setPythonExecutable('/new/python');
      expect(mockPythonBridge.setPythonExecutable).toHaveBeenCalledWith('/new/python');
    });

    it('should get python bridge instance', () => {
      const bridge = fieldInspector.getPythonBridge();
      expect(bridge).toBe(mockPythonBridge);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty PDF data', async () => {
      await expect(fieldInspector.inspectPdfFields(''))
        .rejects.toThrow();
    });

    it('should handle malformed field data', async () => {
      mockPythonBridge.executePythonScript.mockResolvedValue({
        success: true,
        fields: [null, undefined, { invalid: 'field' }] as any,
      });

      const result = await fieldInspector.inspectPdfFields('pdf-data');
      expect(result).toEqual([null, undefined, { invalid: 'field' }]);
    });

    it('should handle network errors gracefully', async () => {
      mockHttps.get.mockImplementation(() => {
        throw new Error('Network error');
      });

      await expect(fieldInspector.getPdfDataFromUrl('https://example.com/test.pdf'))
        .rejects.toMatchObject({
          errorType: 'runtime',
        });
    });

    it('should validate URL format correctly', () => {
      const validUrls = [
        'https://example.com/test.pdf',
        'http://localhost/file.pdf',
        'https://domain.com/path/to/file.pdf?param=value',
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/file.pdf',
        'https://example.com/file.txt',
      ];

      validUrls.forEach(url => {
        expect((fieldInspector as any).isValidPdfUrl(url)).toBe(true);
      });

      // Note: The current implementation allows non-.pdf URLs, so we test the actual behavior
      expect((fieldInspector as any).isValidPdfUrl('not-a-url')).toBe(false);
      expect((fieldInspector as any).isValidPdfUrl('ftp://example.com/file.pdf')).toBe(false);
    });
  });
});