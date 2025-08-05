import { PdfInputHandler } from '../nodes/FillPdf/pdf-input-handler';
import { IExecuteFunctions, IBinaryData, NodeOperationError } from 'n8n-workflow';
import { readFileSync } from 'fs';
import * as axios from 'axios';

// Mock dependencies
jest.mock('fs');
jest.mock('axios');

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('PdfInputHandler', () => {
  let pdfInputHandler: PdfInputHandler;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockNode: any;

  beforeEach(() => {
    mockNode = {
      id: 'test-node',
      name: 'Test PDF Input Handler',
      type: 'fillPdf',
    };

    mockContext = {
      getNodeParameter: jest.fn(),
      getInputData: jest.fn(),
      getNode: jest.fn().mockReturnValue(mockNode),
    } as any;

    pdfInputHandler = new PdfInputHandler(mockContext, 0);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with context and item index', () => {
      const handler = new PdfInputHandler(mockContext, 5);
      expect(handler).toBeInstanceOf(PdfInputHandler);
    });
  });

  describe('getPdfData', () => {
    it('should route to correct handler based on PDF source', async () => {
      // Test upload source
      mockContext.getNodeParameter.mockReturnValue('upload');
      mockReadFileSync.mockReturnValue(Buffer.from('%PDF-1.4 mock pdf'));
      
      const uploadSpy = jest.spyOn(pdfInputHandler as any, 'getPdfFromFile');
      uploadSpy.mockResolvedValue('base64-data');
      
      await pdfInputHandler.getPdfData();
      expect(uploadSpy).toHaveBeenCalled();

      // Test URL source
      mockContext.getNodeParameter.mockReturnValue('url');
      const urlSpy = jest.spyOn(pdfInputHandler as any, 'getPdfFromUrl');
      urlSpy.mockResolvedValue('base64-data');
      
      await pdfInputHandler.getPdfData();
      expect(urlSpy).toHaveBeenCalled();

      // Test binary source
      mockContext.getNodeParameter.mockReturnValue('binary');
      const binarySpy = jest.spyOn(pdfInputHandler as any, 'getPdfFromBinary');
      binarySpy.mockResolvedValue('base64-data');
      
      await pdfInputHandler.getPdfData();
      expect(binarySpy).toHaveBeenCalled();
    });

    it('should throw error for unsupported source type', async () => {
      mockContext.getNodeParameter.mockReturnValue('unsupported');

      await expect(pdfInputHandler.getPdfData())
        .rejects.toThrow(NodeOperationError);
    });
  });

  describe('getPdfFromFile', () => {
    beforeEach(() => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('upload') // pdfSource
        .mockReturnValueOnce('/path/to/test.pdf'); // pdfFile
    });

    it('should read PDF file successfully', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
      mockReadFileSync.mockReturnValue(mockPdfBuffer);

      const result = await (pdfInputHandler as any).getPdfFromFile();

      expect(result).toBe(mockPdfBuffer.toString('base64'));
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/test.pdf');
    });

    it('should throw error when PDF file parameter is missing', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('upload') // pdfSource
        .mockReturnValueOnce(''); // empty pdfFile

      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('PDF file path is required when using upload source');
    });

    it('should validate file path and reject path traversal', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('../../../etc/passwd');

      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('Invalid file path - path traversal not allowed');
    });

    it('should validate PDF file extension', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/path/to/document.txt');

      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('File must have a .pdf extension');
    });

    it('should handle file read errors', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/path/to/test.pdf');
      
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('Failed to read PDF file: Permission denied');
    });

    it('should validate PDF buffer content', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/path/to/test.pdf');
      
      // Test small file
      mockReadFileSync.mockReturnValue(Buffer.from('small'));
      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('PDF from uploaded file is too small');

      // Test large file
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      mockReadFileSync.mockReturnValue(largeBuffer);
      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('PDF from uploaded file is too large');

      // Test invalid PDF header
      mockReadFileSync.mockReturnValue(Buffer.from('not a pdf file content'));
      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('does not appear to be a valid PDF');
    });
  });

  describe('getPdfFromUrl', () => {
    beforeEach(() => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('url') // pdfSource
        .mockReturnValueOnce('https://example.com/test.pdf'); // pdfUrl
    });

    it('should download PDF from URL successfully', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: mockPdfBuffer.buffer,
      });

      const result = await (pdfInputHandler as any).getPdfFromUrl();

      expect(result).toBe(mockPdfBuffer.toString('base64'));
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://example.com/test.pdf',
        expect.objectContaining({
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { 'User-Agent': 'n8n-fillpdf-node/1.0' },
        })
      );
    });

    it('should throw error when PDF URL parameter is missing', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('url') // pdfSource
        .mockReturnValueOnce(''); // empty pdfUrl

      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('PDF URL is required when using URL source');
    });

    it('should validate URL format', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('invalid-url');

      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('Invalid PDF URL');
    });

    it('should handle HTTP errors', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/notfound.pdf');

      mockAxios.get.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
      });

      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle network timeouts', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/slow.pdf');

      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.message = 'timeout of 30000ms exceeded';
      mockAxios.get.mockRejectedValue(timeoutError);

      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('Request timeout - the PDF download took too long');
    });

    it('should handle network errors', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/test.pdf');

      const networkError = new Error('Network Error');
      mockAxios.get.mockRejectedValue(networkError);

      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('Network error - could not reach the URL');
    });

    it('should validate downloaded PDF content', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/test.pdf');

      // Test invalid PDF content
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('not a pdf').buffer,
      });

      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('does not appear to be a valid PDF');
    });
  });

  describe('getPdfFromBinary', () => {
    const mockBinaryData: IBinaryData = {
      data: Buffer.from('%PDF-1.4 mock pdf').toString('base64'),
      mimeType: 'application/pdf',
      fileName: 'test.pdf',
    };

    beforeEach(() => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('binary') // pdfSource
        .mockReturnValueOnce('data'); // binaryPropertyName
      
      mockContext.getInputData.mockReturnValue([{
        binary: { data: mockBinaryData },
      }]);
    });

    it('should get PDF from binary data successfully', async () => {
      const result = await (pdfInputHandler as any).getPdfFromBinary();

      expect(result).toBe(mockBinaryData.data);
      expect(mockContext.getInputData).toHaveBeenCalled();
    });

    it('should throw error when binary property name is missing', async () => {
      mockContext.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('binary') // pdfSource
        .mockReturnValueOnce(''); // empty binaryPropertyName

      await expect((pdfInputHandler as any).getPdfFromBinary())
        .rejects.toThrow('Binary property name is required when using binary source');
    });

    it('should throw error when binary data is not found', async () => {
      mockContext.getInputData.mockReturnValue([{ binary: {} }]);

      await expect((pdfInputHandler as any).getPdfFromBinary())
        .rejects.toThrow("No binary data found for property 'data'");
    });

    it('should throw error when binary data has no data property', async () => {
      mockContext.getInputData.mockReturnValue([{
        binary: { 
          data: { mimeType: 'application/pdf' } as any 
        },
      }]);

      await expect((pdfInputHandler as any).getPdfFromBinary())
        .rejects.toThrow("Binary property 'data' has no data");
    });

    it('should warn about incorrect MIME type but continue', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockContext.getInputData.mockReturnValue([{
        binary: { 
          data: {
            ...mockBinaryData,
            mimeType: 'text/plain',
          }
        },
      }]);

      const result = await (pdfInputHandler as any).getPdfFromBinary();

      expect(result).toBe(mockBinaryData.data);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Binary data MIME type is 'text/plain', expected PDF"
      );
      
      consoleSpy.mockRestore();
    });

    it('should validate binary PDF content', async () => {
      // Test invalid PDF content
      mockContext.getInputData.mockReturnValue([{
        binary: { 
          data: {
            data: Buffer.from('not a pdf').toString('base64'),
            mimeType: 'application/pdf',
          }
        },
      }]);

      await expect((pdfInputHandler as any).getPdfFromBinary())
        .rejects.toThrow('does not appear to be a valid PDF');
    });
  });

  describe('getPdfMetadata', () => {
    it('should return metadata for upload source', async () => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('upload') // pdfSource
        .mockReturnValueOnce('/path/to/document.pdf'); // pdfFile
      
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf');
      mockReadFileSync.mockReturnValue(mockPdfBuffer);

      const metadata = await pdfInputHandler.getPdfMetadata();

      expect(metadata).toEqual({
        size: mockPdfBuffer.length,
        source: 'upload',
        filename: 'document.pdf',
      });
    });

    it('should return metadata for URL source', async () => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('url') // pdfSource
        .mockReturnValueOnce('https://example.com/report.pdf'); // pdfUrl
      
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf');
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: mockPdfBuffer.buffer,
      });

      const metadata = await pdfInputHandler.getPdfMetadata();

      expect(metadata).toEqual({
        size: mockPdfBuffer.length,
        source: 'url',
        filename: 'report.pdf',
      });
    });

    it('should return metadata for binary source', async () => {
      const mockBinaryData: IBinaryData = {
        data: Buffer.from('%PDF-1.4 mock pdf').toString('base64'),
        mimeType: 'application/pdf',
        fileName: 'binary-doc.pdf',
      };

      mockContext.getNodeParameter
        .mockReturnValueOnce('binary') // pdfSource
        .mockReturnValueOnce('pdfData'); // binaryPropertyName
      
      mockContext.getInputData.mockReturnValue([{
        binary: { pdfData: mockBinaryData },
      }]);

      const metadata = await pdfInputHandler.getPdfMetadata();

      expect(metadata).toEqual({
        size: Buffer.from(mockBinaryData.data, 'base64').length,
        source: 'binary',
        filename: 'binary-doc.pdf',
      });
    });

    it('should return partial metadata on error', async () => {
      mockContext.getNodeParameter.mockReturnValue('upload');
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const metadata = await pdfInputHandler.getPdfMetadata();

      expect(metadata).toEqual({
        size: 0,
        source: 'upload',
        filename: undefined,
      });
    });

    it('should generate default filename for binary without fileName', async () => {
      const mockBinaryData: IBinaryData = {
        data: Buffer.from('%PDF-1.4 mock pdf').toString('base64'),
        mimeType: 'application/pdf',
      };

      mockContext.getNodeParameter
        .mockReturnValueOnce('binary')
        .mockReturnValueOnce('document');
      
      mockContext.getInputData.mockReturnValue([{
        binary: { document: mockBinaryData },
      }]);

      const metadata = await pdfInputHandler.getPdfMetadata();

      expect(metadata.filename).toBe('document.pdf');
    });
  });

  describe('validation methods', () => {
    describe('validateFilePath', () => {
      it('should accept valid PDF file paths', () => {
        const validPaths = [
          '/path/to/document.pdf',
          'document.PDF',
          './relative/path.pdf',
        ];

        validPaths.forEach(path => {
          expect(() => (pdfInputHandler as any).validateFilePath(path))
            .not.toThrow();
        });
      });

      it('should reject non-PDF extensions', () => {
        expect(() => (pdfInputHandler as any).validateFilePath('document.txt'))
          .toThrow('File must have a .pdf extension');
      });

      it('should reject path traversal attempts', () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          '~/sensitive/file.pdf',
          'path/../../../file.pdf',
        ];

        maliciousPaths.forEach(path => {
          expect(() => (pdfInputHandler as any).validateFilePath(path))
            .toThrow('Invalid file path - path traversal not allowed');
        });
      });
    });

    describe('validateUrl', () => {
      it('should accept valid HTTP/HTTPS URLs', () => {
        const validUrls = [
          'https://example.com/document.pdf',
          'http://localhost:3000/file.pdf',
          'https://domain.com/path/to/file.pdf?param=value',
        ];

        validUrls.forEach(url => {
          expect(() => (pdfInputHandler as any).validateUrl(url))
            .not.toThrow();
        });
      });

      it('should reject non-HTTP protocols', () => {
        expect(() => (pdfInputHandler as any).validateUrl('ftp://example.com/file.pdf'))
          .toThrow('Only HTTP and HTTPS URLs are supported');
      });

      it('should reject malformed URLs', () => {
        expect(() => (pdfInputHandler as any).validateUrl('not-a-url'))
          .toThrow('Invalid PDF URL');
      });

      it('should warn about non-PDF extensions but not throw', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        expect(() => (pdfInputHandler as any).validateUrl('https://example.com/document.txt'))
          .not.toThrow();
        
        expect(consoleSpy).toHaveBeenCalledWith(
          'URL does not end with .pdf extension, but will attempt to download'
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('validatePdfBuffer', () => {
      it('should accept valid PDF buffers', () => {
        const validBuffer = Buffer.from('%PDF-1.4 content here %%EOF');
        
        expect(() => (pdfInputHandler as any).validatePdfBuffer(validBuffer, 'test'))
          .not.toThrow();
      });

      it('should reject buffers that are too small', () => {
        const smallBuffer = Buffer.from('tiny');
        
        expect(() => (pdfInputHandler as any).validatePdfBuffer(smallBuffer, 'test'))
          .toThrow('PDF from test is too small');
      });

      it('should reject buffers that are too large', () => {
        const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
        
        expect(() => (pdfInputHandler as any).validatePdfBuffer(largeBuffer, 'test'))
          .toThrow('PDF from test is too large');
      });

      it('should reject buffers without PDF header', () => {
        const invalidBuffer = Buffer.from('not a pdf file content here');
        
        expect(() => (pdfInputHandler as any).validatePdfBuffer(invalidBuffer, 'test'))
          .toThrow('does not appear to be a valid PDF');
      });

      it('should warn about incomplete PDFs but not throw', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const incompleteBuffer = Buffer.from('%PDF-1.4 content without EOF marker');
        
        expect(() => (pdfInputHandler as any).validatePdfBuffer(incompleteBuffer, 'test'))
          .not.toThrow();
        
        expect(consoleSpy).toHaveBeenCalledWith(
          'PDF from test may be incomplete (missing EOF marker)'
        );
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined input data gracefully', async () => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('binary')
        .mockReturnValueOnce('data');
      
      mockContext.getInputData.mockReturnValue([]);

      await expect((pdfInputHandler as any).getPdfFromBinary())
        .rejects.toThrow("No binary data found for property 'data'");
    });

    it('should handle axios errors with different error types', async () => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('url')
        .mockReturnValueOnce('https://example.com/test.pdf');

      // Test generic error
      mockAxios.get.mockRejectedValue(new Error('Generic error'));
      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('Failed to download PDF from URL: Generic error');

      // Test unknown error type
      mockAxios.get.mockRejectedValue('string error');
      await expect((pdfInputHandler as any).getPdfFromUrl())
        .rejects.toThrow('Failed to download PDF from URL: Unknown error');
    });

    it('should handle file system errors gracefully', async () => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/path/to/test.pdf');

      // Test non-NodeOperationError
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory');
        throw error;
      });

      await expect((pdfInputHandler as any).getPdfFromFile())
        .rejects.toThrow('Failed to read PDF file: ENOENT: no such file or directory');
    });

    it('should handle binary data validation edge cases', async () => {
      mockContext.getNodeParameter
        .mockReturnValueOnce('binary')
        .mockReturnValueOnce('data');

      // Test with null binary data
      mockContext.getInputData.mockReturnValue([{
        binary: { data: null },
      }]);

      await expect((pdfInputHandler as any).getPdfFromBinary())
        .rejects.toThrow("No binary data found for property 'data'");
    });
  });
});