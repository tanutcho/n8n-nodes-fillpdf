import { OutputHandler } from '../nodes/FillPdf/output-handler';
import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { IFillPdfNodeParams } from '../nodes/FillPdf/types';
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('path');

const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockStatSync = statSync as jest.MockedFunction<typeof statSync>;
const mockResolve = resolve as jest.MockedFunction<typeof resolve>;
const mockDirname = dirname as jest.MockedFunction<typeof dirname>;

describe('OutputHandler', () => {
  let outputHandler: OutputHandler;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockNode: any;

  const mockParams: IFillPdfNodeParams = {
    pdfSource: 'upload',
    pdfFile: '/path/to/test.pdf',
    fieldMappings: {
      mapping: [
        { pdfFieldName: 'name', valueSource: 'static', staticValue: 'John Doe' },
        { pdfFieldName: 'email', valueSource: 'expression', expression: '{{$json.email}}' },
      ],
    },
    outputFormat: 'binary',
    options: {
      flattenPdf: true,
      validateFields: true,
      skipMissingFields: false,
    },
  };

  const mockMetadata = {
    originalFieldCount: 2,
    filledFieldCount: 2,
    processingTime: 1500,
  };

  beforeEach(() => {
    mockNode = {
      id: 'test-node',
      name: 'Test Output Handler',
      type: 'fillPdf',
    };

    mockContext = {
      getNode: jest.fn().mockReturnValue(mockNode),
    } as any;

    outputHandler = new OutputHandler(mockContext, 0);
    jest.clearAllMocks();

    // Setup default mocks
    mockResolve.mockImplementation((path) => `/resolved${path}`);
    mockDirname.mockImplementation((path) => path.substring(0, path.lastIndexOf('/')));
  });

  describe('constructor', () => {
    it('should initialize with context and item index', () => {
      const handler = new OutputHandler(mockContext, 5);
      expect(handler).toBeInstanceOf(OutputHandler);
    });
  });

  describe('createBinaryOutput', () => {
    const mockPdfData = Buffer.from('%PDF-1.4 mock pdf content').toString('base64');

    it('should create binary output with correct structure', () => {
      const result = outputHandler.createBinaryOutput(mockPdfData, mockParams);

      expect(result).toEqual({
        data: mockPdfData,
        mimeType: 'application/pdf',
        fileName: expect.stringMatching(/test_filled_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf/),
        fileExtension: 'pdf',
      });
    });

    it('should generate filename from upload source', () => {
      const params = { ...mockParams, pdfSource: 'upload' as const, pdfFile: '/documents/invoice.pdf' };
      const result = outputHandler.createBinaryOutput(mockPdfData, params);

      expect(result.fileName).toMatch(/invoice_filled_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf/);
    });

    it('should generate filename from URL source', () => {
      const params = { 
        ...mockParams, 
        pdfSource: 'url' as const, 
        pdfUrl: 'https://example.com/form.pdf' 
      };
      const result = outputHandler.createBinaryOutput(mockPdfData, params);

      expect(result.fileName).toMatch(/form_filled_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf/);
    });

    it('should generate filename from binary source', () => {
      const params = { 
        ...mockParams, 
        pdfSource: 'binary' as const, 
        binaryPropertyName: 'document' 
      };
      const result = outputHandler.createBinaryOutput(mockPdfData, params);

      expect(result.fileName).toMatch(/document_filled_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf/);
    });

    it('should clean invalid characters from filename', () => {
      const params = { 
        ...mockParams, 
        pdfSource: 'upload' as const, 
        pdfFile: '/path/to/file with spaces & symbols!.pdf' 
      };
      const result = outputHandler.createBinaryOutput(mockPdfData, params);

      expect(result.fileName).toMatch(/file_with_spaces___symbols__filled_/);
    });

    it('should handle missing source values gracefully', () => {
      const params = { ...mockParams, pdfSource: 'upload' as const, pdfFile: undefined };
      const result = outputHandler.createBinaryOutput(mockPdfData, params);

      expect(result.fileName).toMatch(/document_filled_/);
    });

    it('should handle binary output creation errors', () => {
      const invalidParams = null as any;

      expect(() => outputHandler.createBinaryOutput(mockPdfData, invalidParams))
        .toThrow(NodeOperationError);
    });
  });

  describe('createOutputMetadata', () => {
    it('should create comprehensive metadata structure', () => {
      const result = outputHandler.createOutputMetadata(mockParams, mockMetadata);

      expect(result).toMatchObject({
        success: true,
        fieldsProcessed: 2,
        metadata: {
          originalFieldCount: 2,
          filledFieldCount: 2,
          processingTime: 1500,
          outputFormat: 'binary',
          pdfSource: 'upload',
          timestamp: expect.any(String),
          options: {
            flattened: true,
            fieldsValidated: true,
            missingFieldsSkipped: false,
          },
          processing: {
            startTime: expect.any(String),
            endTime: expect.any(String),
            durationMs: 1500,
            durationFormatted: '1.5s',
            performanceCategory: 'good',
          },
          fieldMapping: {
            totalMappings: 2,
            successfulMappings: 2,
            failedMappings: 0,
            successRate: 100,
            mappingDetails: expect.arrayContaining([
              {
                fieldName: 'name',
                valueSource: 'static',
                hasStaticValue: true,
                hasExpression: false,
              },
              {
                fieldName: 'email',
                valueSource: 'expression',
                hasStaticValue: false,
                hasExpression: true,
              },
            ]),
          },
          output: {
            format: 'binary',
            binaryDataIncluded: true,
            fileOutputIncluded: false,
            capabilities: {
              supportsBatch: true,
              supportsMultipleFormats: true,
              supportsMetadata: true,
            },
          },
          system: {
            nodeVersion: '1.0.0',
            executionId: expect.stringMatching(/^exec_\d+_[a-z0-9]{6}$/),
            platform: expect.any(String),
            nodeEnv: expect.any(String),
          },
          quality: {
            dataIntegrity: true,
            processingEfficiency: expect.any(Number),
            errorRate: 0,
          },
        },
      });
    });

    it('should include output path when provided', () => {
      const outputPath = '/output/filled.pdf';
      const result = outputHandler.createOutputMetadata(mockParams, mockMetadata, outputPath);

      expect(result.outputPath).toBe(outputPath);
      expect(result.metadata.output.outputPath).toBe(outputPath);
    });

    it('should add source-specific metadata for upload', () => {
      const params = { ...mockParams, pdfSource: 'upload' as const, pdfFile: '/docs/form.pdf' };
      const result = outputHandler.createOutputMetadata(params, mockMetadata);

      expect(result.metadata.source).toEqual({
        type: 'upload',
        file: '/docs/form.pdf',
        fileName: 'form.pdf',
        fileExtension: 'pdf',
      });
    });

    it('should add source-specific metadata for URL', () => {
      const params = { 
        ...mockParams, 
        pdfSource: 'url' as const, 
        pdfUrl: 'https://example.com/form.pdf' 
      };
      const result = outputHandler.createOutputMetadata(params, mockMetadata);

      expect(result.metadata.source).toEqual({
        type: 'url',
        url: 'https://example.com/form.pdf',
        domain: 'example.com',
        protocol: 'https',
      });
    });

    it('should add source-specific metadata for binary', () => {
      const params = { 
        ...mockParams, 
        pdfSource: 'binary' as const, 
        binaryPropertyName: 'document' 
      };
      const result = outputHandler.createOutputMetadata(params, mockMetadata);

      expect(result.metadata.source).toEqual({
        type: 'binary',
        propertyName: 'document',
        fromPreviousNode: true,
      });
    });

    it('should format duration correctly', () => {
      const testCases = [
        { ms: 500, expected: '500ms' },
        { ms: 2500, expected: '2.5s' },
        { ms: 90000, expected: '1.5m' },
      ];

      testCases.forEach(({ ms, expected }) => {
        const metadata = { ...mockMetadata, processingTime: ms };
        const result = outputHandler.createOutputMetadata(mockParams, metadata);
        expect(result.metadata.processing.durationFormatted).toBe(expected);
      });
    });

    it('should categorize performance correctly', () => {
      const testCases = [
        { ms: 500, expected: 'excellent' },
        { ms: 3000, expected: 'good' },
        { ms: 10000, expected: 'acceptable' },
        { ms: 20000, expected: 'slow' },
      ];

      testCases.forEach(({ ms, expected }) => {
        const metadata = { ...mockMetadata, processingTime: ms };
        const result = outputHandler.createOutputMetadata(mockParams, metadata);
        expect(result.metadata.processing.performanceCategory).toBe(expected);
      });
    });

    it('should calculate processing efficiency', () => {
      const metadata = { ...mockMetadata, processingTime: 2000, filledFieldCount: 4 };
      const result = outputHandler.createOutputMetadata(mockParams, metadata);

      expect(result.metadata.quality.processingEfficiency).toBe(2); // 4 fields / 2 seconds
    });

    it('should handle zero fields processed', () => {
      const metadata = { ...mockMetadata, filledFieldCount: 0 };
      const result = outputHandler.createOutputMetadata(mockParams, metadata);

      expect(result.metadata.quality.processingEfficiency).toBe(0);
      expect(result.metadata.fieldMapping.successRate).toBe(0);
    });
  });

  describe('saveToFile', () => {
    const mockPdfData = Buffer.from('%PDF-1.4 mock pdf content').toString('base64');
    const outputPath = '/output/filled.pdf';

    beforeEach(() => {
      mockResolve.mockReturnValue('/resolved/output/filled.pdf');
      mockDirname.mockReturnValue('/resolved/output');
      mockStatSync.mockReturnValue({ size: Buffer.from(mockPdfData, 'base64').length } as any);
    });

    it('should save PDF file successfully', async () => {
      const result = await outputHandler.saveToFile(mockPdfData, outputPath);

      expect(mockMkdirSync).toHaveBeenCalledWith('/resolved/output', { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/resolved/output/filled.pdf',
        Buffer.from(mockPdfData, 'base64')
      );
      expect(result).toEqual({
        fullPath: '/resolved/output/filled.pdf',
        fileSize: Buffer.from(mockPdfData, 'base64').length,
        directory: '/resolved/output',
        fileName: 'filled.pdf',
        success: true,
      });
    });

    it('should validate PDF extension', async () => {
      await expect(outputHandler.saveToFile(mockPdfData, '/output/file.txt'))
        .rejects.toThrow('Output path must end with .pdf extension');
    });

    it('should handle empty PDF data', async () => {
      await expect(outputHandler.saveToFile('', outputPath))
        .rejects.toThrow('PDF data is empty');
    });

    it('should handle file write errors', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(outputHandler.saveToFile(mockPdfData, outputPath))
        .rejects.toThrow('Failed to save PDF to file: Permission denied');
    });

    it('should handle directory creation errors', async () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Cannot create directory');
      });

      await expect(outputHandler.saveToFile(mockPdfData, outputPath))
        .rejects.toThrow('Failed to save PDF to file: Cannot create directory');
    });

    it('should verify file size after writing', async () => {
      mockStatSync.mockReturnValue({ size: 999 } as any); // Different size

      await expect(outputHandler.saveToFile(mockPdfData, outputPath))
        .rejects.toThrow('File size mismatch after writing');
    });

    it('should handle complex file paths', async () => {
      const complexPath = '/complex/path/with spaces/file-name.pdf';
      mockResolve.mockReturnValue('/resolved/complex/path/with spaces/file-name.pdf');
      mockDirname.mockReturnValue('/resolved/complex/path/with spaces');

      const result = await outputHandler.saveToFile(mockPdfData, complexPath);

      expect(result.fileName).toBe('file-name.pdf');
      expect(result.directory).toBe('/resolved/complex/path/with spaces');
    });
  });

  describe('processBatch', () => {
    const mockPdfDataArray = [
      Buffer.from('%PDF-1.4 pdf1').toString('base64'),
      Buffer.from('%PDF-1.4 pdf2').toString('base64'),
      Buffer.from('%PDF-1.4 pdf3').toString('base64'),
    ];

    const batchParams: IFillPdfNodeParams = {
      ...mockParams,
      outputFormat: 'both',
      outputPath: '/output/batch.pdf',
    };

    beforeEach(() => {
      mockResolve.mockImplementation((path) => `/resolved${path}`);
      mockDirname.mockImplementation((path) => path.substring(0, path.lastIndexOf('/')));
      mockStatSync.mockReturnValue({ size: 1000 } as any);
    });

    it('should process batch successfully', async () => {
      const results = await outputHandler.processBatch(mockPdfDataArray, batchParams, mockMetadata);

      expect(results).toHaveLength(3);
      
      // Check first result structure
      expect(results[0]).toMatchObject({
        json: {
          success: true,
          fieldsProcessed: 2,
          metadata: {
            batch: {
              batchId: expect.stringMatching(/^batch_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-z0-9]{6}$/),
              itemIndex: 1,
              totalItems: 3,
              itemProcessingTime: expect.any(Number),
            },
            batchSummary: {
              batchId: expect.any(String),
              totalItems: 3,
              successfulItems: 3,
              failedItems: 0,
              startTime: expect.any(String),
              endTime: expect.any(String),
              totalProcessingTime: expect.any(Number),
              outputPaths: expect.arrayContaining([
                expect.stringMatching(/_batch_.*_1\.pdf$/),
                expect.stringMatching(/_batch_.*_2\.pdf$/),
                expect.stringMatching(/_batch_.*_3\.pdf$/),
              ]),
            },
          },
        },
        binary: expect.objectContaining({
          pdf: expect.objectContaining({
            data: expect.any(String),
            mimeType: 'application/pdf',
          }),
        }),
      });

      // Verify all items have consistent batch ID
      const batchId = results[0].json.metadata.batch?.batchId;
      results.forEach((result, index) => {
        expect(result.json.metadata.batch?.batchId).toBe(batchId);
        expect(result.json.metadata.batch?.itemIndex).toBe(index + 1);
      });
    });

    it('should handle batch processing errors gracefully', async () => {
      // Mock formatOutput to fail on second item
      const originalFormatOutput = outputHandler.formatOutput;
      jest.spyOn(outputHandler, 'formatOutput')
        .mockImplementationOnce(() => originalFormatOutput.call(outputHandler, mockPdfDataArray[0], batchParams, mockMetadata))
        .mockImplementationOnce(() => { throw new Error('Processing failed'); })
        .mockImplementationOnce(() => originalFormatOutput.call(outputHandler, mockPdfDataArray[2], batchParams, mockMetadata));

      const results = await outputHandler.processBatch(mockPdfDataArray, batchParams, mockMetadata);

      expect(results).toHaveLength(3);
      expect(results[0].json.success).toBe(true);
      expect(results[1].json.success).toBe(false);
      expect(results[1].json.error).toBe('Processing failed');
      expect(results[2].json.success).toBe(true);

      // Check batch summary reflects the failure
      expect(results[0].json.metadata.batchSummary?.successfulItems).toBe(2);
      expect(results[0].json.metadata.batchSummary?.failedItems).toBe(1);
    });

    it('should generate unique batch output paths', async () => {
      const results = await outputHandler.processBatch(mockPdfDataArray, batchParams, mockMetadata);

      const outputPaths = results[0].json.metadata.batchSummary?.outputPaths || [];
      expect(outputPaths).toHaveLength(3);
      
      // All paths should be unique
      const uniquePaths = new Set(outputPaths);
      expect(uniquePaths.size).toBe(3);
      
      // All paths should follow the batch naming pattern
      outputPaths.forEach((path, index) => {
        expect(path).toMatch(new RegExp(`_batch_.*_${index + 1}\\.pdf$`));
      });
    });

    it('should handle empty batch array', async () => {
      const results = await outputHandler.processBatch([], batchParams, mockMetadata);

      expect(results).toHaveLength(0);
    });

    it('should process batch without file output', async () => {
      const binaryOnlyParams = { ...batchParams, outputFormat: 'binary' as const };
      const results = await outputHandler.processBatch(mockPdfDataArray, binaryOnlyParams, mockMetadata);

      expect(results).toHaveLength(3);
      expect(results[0].json.metadata.batchSummary?.outputPaths).toHaveLength(0);
    });
  });

  describe('formatOutput', () => {
    const mockPdfData = Buffer.from('%PDF-1.4 mock pdf content').toString('base64');

    it('should format binary output correctly', async () => {
      const params = { ...mockParams, outputFormat: 'binary' as const };
      const result = await outputHandler.formatOutput(mockPdfData, params, mockMetadata);

      expect(result.json.success).toBe(true);
      expect(result.binary).toBeDefined();
      expect(result.binary?.pdf).toMatchObject({
        data: mockPdfData,
        mimeType: 'application/pdf',
        fileName: expect.stringMatching(/\.pdf$/),
        fileExtension: 'pdf',
      });
    });

    it('should format file output correctly', async () => {
      const params = { 
        ...mockParams, 
        outputFormat: 'file' as const, 
        outputPath: '/output/test.pdf' 
      };
      
      mockResolve.mockReturnValue('/resolved/output/test.pdf');
      mockDirname.mockReturnValue('/resolved/output');
      mockStatSync.mockReturnValue({ size: Buffer.from(mockPdfData, 'base64').length } as any);

      const result = await outputHandler.formatOutput(mockPdfData, params, mockMetadata);

      expect(result.json.success).toBe(true);
      expect(result.json.outputPath).toBe('/resolved/output/test.pdf');
      expect(result.json.metadata.fileOutput).toMatchObject({
        fullPath: '/resolved/output/test.pdf',
        fileName: 'test.pdf',
        directory: '/resolved/output',
        fileSize: expect.any(Number),
        success: true,
      });
      expect(result.binary).toBeUndefined();
    });

    it('should format both output correctly', async () => {
      const params = { 
        ...mockParams, 
        outputFormat: 'both' as const, 
        outputPath: '/output/test.pdf' 
      };
      
      mockResolve.mockReturnValue('/resolved/output/test.pdf');
      mockDirname.mockReturnValue('/resolved/output');
      mockStatSync.mockReturnValue({ size: Buffer.from(mockPdfData, 'base64').length } as any);

      const result = await outputHandler.formatOutput(mockPdfData, params, mockMetadata);

      expect(result.json.success).toBe(true);
      expect(result.json.outputPath).toBe('/resolved/output/test.pdf');
      expect(result.binary).toBeDefined();
      expect(result.json.metadata.fileOutput).toBeDefined();
    });

    it('should throw error when output path is missing for file output', async () => {
      const params = { ...mockParams, outputFormat: 'file' as const };

      await expect(outputHandler.formatOutput(mockPdfData, params, mockMetadata))
        .rejects.toThrow('Output path is required when saving to file');
    });

    it('should handle file save errors', async () => {
      const params = { 
        ...mockParams, 
        outputFormat: 'file' as const, 
        outputPath: '/output/test.pdf' 
      };
      
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      await expect(outputHandler.formatOutput(mockPdfData, params, mockMetadata))
        .rejects.toThrow('Failed to save PDF to file: Disk full');
    });

    it('should handle binary output creation errors', async () => {
      const params = { ...mockParams, outputFormat: 'binary' as const };
      
      // Mock a scenario that would cause binary output creation to fail
      jest.spyOn(outputHandler, 'createBinaryOutput').mockImplementation(() => {
        throw new Error('Binary creation failed');
      });

      await expect(outputHandler.formatOutput(mockPdfData, params, mockMetadata))
        .rejects.toThrow('Output formatting failed: Binary creation failed');
    });
  });

  describe('utility methods', () => {
    it('should generate unique execution IDs', () => {
      const id1 = (outputHandler as any).generateExecutionId();
      const id2 = (outputHandler as any).generateExecutionId();

      expect(id1).toMatch(/^exec_\d+_[a-z0-9]{6}$/);
      expect(id2).toMatch(/^exec_\d+_[a-z0-9]{6}$/);
      expect(id1).not.toBe(id2);
    });

    it('should extract domain from URL correctly', () => {
      const testCases = [
        { url: 'https://example.com/path', expected: 'example.com' },
        { url: 'http://subdomain.domain.org/file.pdf', expected: 'subdomain.domain.org' },
        { url: 'invalid-url', expected: 'unknown' },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = (outputHandler as any).extractDomain(url);
        expect(result).toBe(expected);
      });
    });

    it('should generate unique batch IDs', () => {
      const id1 = (outputHandler as any).generateBatchId();
      const id2 = (outputHandler as any).generateBatchId();

      expect(id1).toMatch(/^batch_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-z0-9]{6}$/);
      expect(id2).toMatch(/^batch_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-z0-9]{6}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate batch output paths correctly', () => {
      const basePath = '/output/document.pdf';
      const batchId = 'batch123';

      const path1 = (outputHandler as any).generateBatchOutputPath(basePath, 0, batchId);
      const path2 = (outputHandler as any).generateBatchOutputPath(basePath, 1, batchId);
      const path3 = (outputHandler as any).generateBatchOutputPath(basePath, 2);

      expect(path1).toBe('/output/document_batch123_1.pdf');
      expect(path2).toBe('/output/document_batch123_2.pdf');
      expect(path3).toBe('/output/document_batch_3.pdf');
    });

    it('should handle paths without extensions in batch naming', () => {
      const basePath = '/output/document';
      const result = (outputHandler as any).generateBatchOutputPath(basePath, 0, 'batch123');

      expect(result).toBe('/output/document_batch123_1.');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined parameters gracefully', () => {
      const mockPdfData = Buffer.from('%PDF-1.4 mock pdf').toString('base64');

      expect(() => outputHandler.createBinaryOutput(mockPdfData, null as any))
        .toThrow(NodeOperationError);
    });

    it('should handle empty field mappings', () => {
      const params = { ...mockParams, fieldMappings: { mapping: [] } };
      const result = outputHandler.createOutputMetadata(params, mockMetadata);

      expect(result.metadata.fieldMapping.totalMappings).toBe(0);
      expect(result.metadata.fieldMapping.mappingDetails).toHaveLength(0);
    });

    it('should handle missing optional parameters', () => {
      const minimalParams: IFillPdfNodeParams = {
        pdfSource: 'binary',
        fieldMappings: { mapping: [] },
        outputFormat: 'binary',
        options: {},
      };

      const result = outputHandler.createOutputMetadata(minimalParams, mockMetadata);

      expect(result.metadata.options.flattened).toBe(true); // default value
      expect(result.metadata.source).toBeUndefined();
    });

    it('should handle very large processing times', () => {
      const largeMetadata = { ...mockMetadata, processingTime: 300000 }; // 5 minutes
      const result = outputHandler.createOutputMetadata(mockParams, largeMetadata);

      expect(result.metadata.processing.durationFormatted).toBe('5.0m');
      expect(result.metadata.processing.performanceCategory).toBe('slow');
    });

    it('should handle zero processing time', () => {
      const zeroMetadata = { ...mockMetadata, processingTime: 0 };
      const result = outputHandler.createOutputMetadata(mockParams, zeroMetadata);

      expect(result.metadata.processing.durationFormatted).toBe('0ms');
      expect(result.metadata.processing.performanceCategory).toBe('excellent');
    });

    it('should handle batch processing with mixed success/failure', async () => {
      const mockPdfDataArray = [
        Buffer.from('%PDF-1.4 pdf1').toString('base64'),
        'invalid-pdf-data',
        Buffer.from('%PDF-1.4 pdf3').toString('base64'),
      ];

      // Mock formatOutput to handle the invalid data
      jest.spyOn(outputHandler, 'formatOutput')
        .mockImplementationOnce(async (data, _params, metadata) => ({
          json: { success: true, fieldsProcessed: 1, metadata: { ...metadata } },
          binary: { pdf: { data, mimeType: 'application/pdf' } },
        } as any))
        .mockImplementationOnce(async () => {
          throw new Error('Invalid PDF data');
        })
        .mockImplementationOnce(async (data, _params, metadata) => ({
          json: { success: true, fieldsProcessed: 1, metadata: { ...metadata } },
          binary: { pdf: { data, mimeType: 'application/pdf' } },
        } as any));

      const results = await outputHandler.processBatch(mockPdfDataArray, mockParams, mockMetadata);

      expect(results).toHaveLength(3);
      expect(results[0].json.success).toBe(true);
      expect(results[1].json.success).toBe(false);
      expect(results[2].json.success).toBe(true);
    });
  });
});