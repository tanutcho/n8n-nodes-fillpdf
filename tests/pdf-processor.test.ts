import { PdfProcessor } from '../nodes/FillPdf/pdf-processor';
import { PdfInputHandler } from '../nodes/FillPdf/pdf-input-handler';
import { FieldMapper } from '../nodes/FillPdf/field-mapper';
import { FieldInspector } from '../nodes/FillPdf/field-inspector';
import { PythonBridge } from '../nodes/FillPdf/python-bridge';
import { OutputHandler } from '../nodes/FillPdf/output-handler';
import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldInfo, IPythonOutput, IFillPdfNodeParams } from '../nodes/FillPdf/types';

// Mock all dependencies
jest.mock('../nodes/FillPdf/pdf-input-handler');
jest.mock('../nodes/FillPdf/field-mapper');
jest.mock('../nodes/FillPdf/field-inspector');
jest.mock('../nodes/FillPdf/python-bridge');
jest.mock('../nodes/FillPdf/output-handler');

const MockPdfInputHandler = PdfInputHandler as jest.MockedClass<typeof PdfInputHandler>;
const MockFieldMapper = FieldMapper as jest.MockedClass<typeof FieldMapper>;
const MockFieldInspector = FieldInspector as jest.MockedClass<typeof FieldInspector>;
const MockPythonBridge = PythonBridge as jest.MockedClass<typeof PythonBridge>;
const MockOutputHandler = OutputHandler as jest.MockedClass<typeof OutputHandler>;

describe('PdfProcessor', () => {
  let pdfProcessor: PdfProcessor;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockNode: any;
  
  // Mock instances
  let mockPdfInputHandler: jest.Mocked<PdfInputHandler>;
  let mockFieldMapper: jest.Mocked<FieldMapper>;
  let mockFieldInspector: jest.Mocked<FieldInspector>;
  let mockPythonBridge: jest.Mocked<PythonBridge>;
  let mockOutputHandler: jest.Mocked<OutputHandler>;

  const mockPdfFields: IFieldInfo[] = [
    {
      name: 'firstName',
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
  ];

  const mockParams: IFillPdfNodeParams = {
    pdfSource: 'upload',
    pdfFile: '/path/to/test.pdf',
    fieldMappings: {
      mapping: [
        { pdfFieldName: 'firstName', valueSource: 'static', staticValue: 'John Doe' },
        { pdfFieldName: 'email', valueSource: 'expression', expression: '{{$json.email}}' },
        { pdfFieldName: 'subscribe', valueSource: 'static', staticValue: 'true' },
      ],
    },
    outputFormat: 'binary',
    options: {
      flattenPdf: true,
      validateFields: true,
      skipMissingFields: false,
    },
  };

  beforeEach(() => {
    mockNode = {
      id: 'test-node',
      name: 'Test PDF Processor',
      type: 'fillPdf',
    };

    mockContext = {
      getNodeParameter: jest.fn(),
      getNode: jest.fn().mockReturnValue(mockNode),
      getInputData: jest.fn(),
      evaluateExpression: jest.fn(),
    } as any;

    // Setup parameter mocks
    mockContext.getNodeParameter
      .mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return mockParams.pdfSource;
          case 'pdfFile': return mockParams.pdfFile;
          case 'fieldMappings': return mockParams.fieldMappings;
          case 'outputFormat': return mockParams.outputFormat;
          case 'options': return mockParams.options;
          default: return undefined;
        }
      });

    // Create mock instances
    mockPdfInputHandler = {
      getPdfData: jest.fn(),
      getPdfMetadata: jest.fn(),
    } as any;

    mockFieldMapper = {
      mapFieldsToValues: jest.fn(),
      validateMappings: jest.fn(),
      setItemIndex: jest.fn(),
      getItemIndex: jest.fn(),
      getMappingSummary: jest.fn(),
    } as any;

    mockFieldInspector = {
      inspectPdfFields: jest.fn(),
      validateFieldMappings: jest.fn(),
      getPythonBridge: jest.fn(),
    } as any;

    mockPythonBridge = {
      executePythonScript: jest.fn(),
      validateEnvironment: jest.fn(),
    } as any;

    mockOutputHandler = {
      formatOutput: jest.fn(),
      createBinaryOutput: jest.fn(),
      saveToFile: jest.fn(),
    } as any;

    // Setup constructor mocks
    MockPdfInputHandler.mockImplementation(() => mockPdfInputHandler);
    MockFieldMapper.mockImplementation(() => mockFieldMapper);
    MockFieldInspector.mockImplementation(() => mockFieldInspector);
    MockPythonBridge.mockImplementation(() => mockPythonBridge);
    MockOutputHandler.mockImplementation(() => mockOutputHandler);

    pdfProcessor = new PdfProcessor(mockContext, 0);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with context and item index', () => {
      const processor = new PdfProcessor(mockContext, 5);
      expect(processor).toBeInstanceOf(PdfProcessor);
      expect(MockPdfInputHandler).toHaveBeenCalledWith(mockContext, 5);
      expect(MockFieldMapper).toHaveBeenCalledWith(mockContext, 5);
      expect(MockOutputHandler).toHaveBeenCalledWith(mockContext, 5);
    });
  });

  describe('getPdfData', () => {
    it('should delegate to PDF input handler', async () => {
      const mockPdfData = 'base64-pdf-data';
      mockPdfInputHandler.getPdfData.mockResolvedValue(mockPdfData);

      const result = await pdfProcessor.getPdfData();

      expect(result).toBe(mockPdfData);
      expect(mockPdfInputHandler.getPdfData).toHaveBeenCalled();
    });

    it('should handle PDF input handler errors', async () => {
      mockPdfInputHandler.getPdfData.mockRejectedValue(new Error('PDF load failed'));

      await expect(pdfProcessor.getPdfData()).rejects.toThrow('PDF load failed');
    });
  });

  describe('processPdf', () => {
    const mockPdfData = 'base64-pdf-data';
    const mockFilledPdfData = 'base64-filled-pdf-data';
    const mockFieldValues = {
      firstName: 'John Doe',
      email: 'john@example.com',
      subscribe: 'Yes',
    };

    beforeEach(() => {
      // Setup default successful mocks
      mockPdfInputHandler.getPdfData.mockResolvedValue(mockPdfData);
      mockFieldInspector.inspectPdfFields.mockResolvedValue(mockPdfFields);
      mockFieldMapper.mapFieldsToValues.mockResolvedValue(mockFieldValues);
      
      const mockPythonOutput: IPythonOutput = {
        success: true,
        data: mockFilledPdfData,
        metadata: {
          fieldCount: 3,
          processingTime: 1500,
        },
      };
      mockPythonBridge.executePythonScript.mockResolvedValue(mockPythonOutput);
      
      mockOutputHandler.formatOutput.mockResolvedValue({
        json: {
          success: true,
          fieldsProcessed: 3,
          metadata: {
            originalFieldCount: 3,
            filledFieldCount: 3,
            processingTime: 1500,
          },
        },
        binary: {
          pdf: {
            data: mockFilledPdfData,
            mimeType: 'application/pdf',
          },
        },
      });
    });

    it('should process PDF successfully with full workflow', async () => {
      const result = await pdfProcessor.processPdf();

      expect(result).toMatchObject({
        json: {
          success: true,
          fieldsProcessed: 3,
          metadata: {
            originalFieldCount: 3,
            filledFieldCount: 3,
            processingTime: expect.any(Number),
          },
        },
        binary: {
          pdf: {
            data: mockFilledPdfData,
            mimeType: 'application/pdf',
          },
        },
      });

      // Verify the workflow steps
      expect(mockPdfInputHandler.getPdfData).toHaveBeenCalled();
      expect(mockFieldInspector.inspectPdfFields).toHaveBeenCalledWith(mockPdfData);
      expect(mockFieldMapper.mapFieldsToValues).toHaveBeenCalledWith(
        mockParams.fieldMappings.mapping,
        mockPdfFields
      );
      expect(mockPythonBridge.executePythonScript).toHaveBeenCalledWith({
        action: 'fill',
        pdfData: mockPdfData,
        fieldMappings: mockFieldValues,
        options: {
          flatten: true,
          outputFormat: 'binary',
        },
      });
      expect(mockOutputHandler.formatOutput).toHaveBeenCalled();
    });

    it('should handle PDF loading errors', async () => {
      mockPdfInputHandler.getPdfData.mockRejectedValue(new Error('PDF not found'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('PDF not found');
    });

    it('should handle field inspection errors', async () => {
      mockFieldInspector.inspectPdfFields.mockRejectedValue(new Error('Field inspection failed'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Field inspection failed');
    });

    it('should handle field mapping errors', async () => {
      mockFieldMapper.mapFieldsToValues.mockRejectedValue(new Error('Field mapping failed'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Field mapping failed');
    });

    it('should handle Python script execution errors', async () => {
      mockPythonBridge.executePythonScript.mockResolvedValue({
        success: false,
        error: 'PDF filling failed',
      });

      await expect(pdfProcessor.processPdf()).rejects.toThrow('PDF filling failed');
    });

    it('should handle Python bridge errors', async () => {
      mockPythonBridge.executePythonScript.mockRejectedValue(new Error('Python bridge error'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Python bridge error');
    });

    it('should handle output formatting errors', async () => {
      mockOutputHandler.formatOutput.mockRejectedValue(new Error('Output formatting failed'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Output formatting failed');
    });

    it('should validate fields when option is enabled', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'options') {
          return { ...mockParams.options, validateFields: true };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      await pdfProcessor.processPdf();

      expect(mockFieldInspector.inspectPdfFields).toHaveBeenCalled();
      expect(mockFieldMapper.mapFieldsToValues).toHaveBeenCalledWith(
        mockParams.fieldMappings.mapping,
        mockPdfFields
      );
    });

    it('should skip field validation when option is disabled', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'options') {
          return { ...mockParams.options, validateFields: false };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      await pdfProcessor.processPdf();

      expect(mockFieldInspector.inspectPdfFields).not.toHaveBeenCalled();
      expect(mockFieldMapper.mapFieldsToValues).toHaveBeenCalledWith(
        mockParams.fieldMappings.mapping,
        []
      );
    });

    it('should handle missing field mappings', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'fieldMappings') {
          return { mapping: [] };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      await expect(pdfProcessor.processPdf()).rejects.toThrow('No field mappings configured');
    });

    it('should pass correct options to Python script', async () => {
      const customOptions = {
        flattenPdf: false,
        validateFields: true,
        skipMissingFields: true,
      };

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'options') {
          return customOptions;
        }
        if (paramName === 'outputFormat') {
          return 'file';
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      await pdfProcessor.processPdf();

      expect(mockPythonBridge.executePythonScript).toHaveBeenCalledWith({
        action: 'fill',
        pdfData: mockPdfData,
        fieldMappings: mockFieldValues,
        options: {
          flatten: false,
          outputFormat: 'file',
        },
      });
    });

    it('should handle different output formats', async () => {
      const outputFormats = ['binary', 'file', 'both'] as const;

      for (const format of outputFormats) {
        mockContext.getNodeParameter.mockImplementation((paramName: string) => {
          if (paramName === 'outputFormat') {
            return format;
          }
          return mockParams[paramName as keyof IFillPdfNodeParams];
        });

        await pdfProcessor.processPdf();

        expect(mockPythonBridge.executePythonScript).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              outputFormat: format,
            }),
          })
        );
      }
    });

    it('should measure processing time accurately', async () => {
      const startTime = Date.now();
      
      // Add delay to Python script execution
      mockPythonBridge.executePythonScript.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          data: mockFilledPdfData,
          metadata: { fieldCount: 3, processingTime: 100 },
        };
      });

      await pdfProcessor.processPdf();

      const callArgs = mockOutputHandler.formatOutput.mock.calls[0];
      const metadata = callArgs[2];
      
      expect(metadata.processingTime).toBeGreaterThanOrEqual(100);
      expect(metadata.processingTime).toBeLessThan(Date.now() - startTime + 50); // Allow some margin
    });

    it('should handle empty PDF data', async () => {
      mockPdfInputHandler.getPdfData.mockResolvedValue('');

      await expect(pdfProcessor.processPdf()).rejects.toThrow('PDF data is empty');
    });

    it('should handle null field mappings', async () => {
      mockFieldMapper.mapFieldsToValues.mockResolvedValue({});

      await pdfProcessor.processPdf();

      expect(mockPythonBridge.executePythonScript).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldMappings: {},
        })
      );
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed field mappings', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'fieldMappings') {
          return { mapping: null };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      await expect(pdfProcessor.processPdf()).rejects.toThrow();
    });

    it('should handle missing required parameters', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'pdfSource') {
          return undefined;
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      await expect(pdfProcessor.processPdf()).rejects.toThrow();
    });

    it('should handle Python script timeout', async () => {
      mockPythonBridge.executePythonScript.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Script execution timeout');
      });

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Script execution timeout');
    });

    it('should handle corrupted PDF data', async () => {
      mockPdfInputHandler.getPdfData.mockResolvedValue('corrupted-data');
      mockFieldInspector.inspectPdfFields.mockRejectedValue(new Error('Invalid PDF format'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Invalid PDF format');
    });

    it('should handle field mapping validation errors', async () => {
      mockFieldMapper.mapFieldsToValues.mockRejectedValue(new Error('Field validation failed'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Field validation failed');
    });

    it('should handle Python environment issues', async () => {
      mockPythonBridge.executePythonScript.mockRejectedValue(new Error('Python not found'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Python not found');
    });

    it('should handle memory issues with large PDFs', async () => {
      const largePdfData = 'x'.repeat(100 * 1024 * 1024); // 100MB string
      mockPdfInputHandler.getPdfData.mockResolvedValue(largePdfData);
      mockPythonBridge.executePythonScript.mockRejectedValue(new Error('Out of memory'));

      await expect(pdfProcessor.processPdf()).rejects.toThrow('Out of memory');
    });

    it('should handle concurrent processing issues', async () => {
      // Simulate concurrent calls
      const promises = Array(5).fill(null).map(() => pdfProcessor.processPdf());
      
      // Mock one to fail
      mockPythonBridge.executePythonScript
        .mockResolvedValueOnce({ success: true, data: 'data1' })
        .mockResolvedValueOnce({ success: true, data: 'data2' })
        .mockRejectedValueOnce(new Error('Concurrent access error'))
        .mockResolvedValueOnce({ success: true, data: 'data4' })
        .mockResolvedValueOnce({ success: true, data: 'data5' });

      const results = await Promise.allSettled(promises);
      
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(4);
      expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex field mappings with expressions', async () => {
      const complexMappings = [
        { pdfFieldName: 'fullName', valueSource: 'expression', expression: '{{$json.firstName + " " + $json.lastName}}' },
        { pdfFieldName: 'age', valueSource: 'expression', expression: '{{new Date().getFullYear() - new Date($json.birthYear).getFullYear()}}' },
        { pdfFieldName: 'isAdult', valueSource: 'expression', expression: '{{$json.age >= 18}}' },
      ];

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'fieldMappings') {
          return { mapping: complexMappings };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      mockFieldMapper.mapFieldsToValues.mockResolvedValue({
        fullName: 'John Doe',
        age: '30',
        isAdult: 'Yes',
      });

      const result = await pdfProcessor.processPdf();

      expect(result.json.success).toBe(true);
      expect(mockFieldMapper.mapFieldsToValues).toHaveBeenCalledWith(
        complexMappings,
        mockPdfFields
      );
    });

    it('should handle mixed static and expression mappings', async () => {
      const mixedMappings = [
        { pdfFieldName: 'company', valueSource: 'static', staticValue: 'ACME Corp' },
        { pdfFieldName: 'userName', valueSource: 'expression', expression: '{{$json.user.name}}' },
        { pdfFieldName: 'timestamp', valueSource: 'expression', expression: '{{new Date().toISOString()}}' },
        { pdfFieldName: 'version', valueSource: 'static', staticValue: '1.0' },
      ];

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'fieldMappings') {
          return { mapping: mixedMappings };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      mockFieldMapper.mapFieldsToValues.mockResolvedValue({
        company: 'ACME Corp',
        userName: 'john.doe',
        timestamp: '2023-01-01T00:00:00.000Z',
        version: '1.0',
      });

      const result = await pdfProcessor.processPdf();

      expect(result.json.success).toBe(true);
      expect(mockPythonBridge.executePythonScript).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldMappings: {
            company: 'ACME Corp',
            userName: 'john.doe',
            timestamp: '2023-01-01T00:00:00.000Z',
            version: '1.0',
          },
        })
      );
    });

    it('should handle different PDF sources correctly', async () => {
      const sources = [
        { pdfSource: 'upload', pdfFile: '/path/to/file.pdf' },
        { pdfSource: 'url', pdfUrl: 'https://example.com/form.pdf' },
        { pdfSource: 'binary', binaryPropertyName: 'pdfData' },
      ] as const;

      for (const source of sources) {
        mockContext.getNodeParameter.mockImplementation((paramName: string) => {
          if (paramName in source) {
            return source[paramName as keyof typeof source];
          }
          return mockParams[paramName as keyof IFillPdfNodeParams];
        });

        const result = await pdfProcessor.processPdf();
        expect(result.json.success).toBe(true);
      }
    });

    it('should handle all output formats correctly', async () => {
      const formats = ['binary', 'file', 'both'] as const;

      for (const format of formats) {
        mockContext.getNodeParameter.mockImplementation((paramName: string) => {
          if (paramName === 'outputFormat') {
            return format;
          }
          if (paramName === 'outputPath' && (format === 'file' || format === 'both')) {
            return '/output/test.pdf';
          }
          return mockParams[paramName as keyof IFillPdfNodeParams];
        });

        const result = await pdfProcessor.processPdf();
        expect(result.json.success).toBe(true);
      }
    });
  });

  describe('performance and optimization', () => {
    it('should handle large numbers of field mappings efficiently', async () => {
      const largeMappings = Array.from({ length: 100 }, (_, i) => ({
        pdfFieldName: `field${i}`,
        valueSource: 'static' as const,
        staticValue: `value${i}`,
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'fieldMappings') {
          return { mapping: largeMappings };
        }
        return mockParams[paramName as keyof IFillPdfNodeParams];
      });

      const largeFieldValues = Object.fromEntries(
        largeMappings.map(m => [m.pdfFieldName, m.staticValue])
      );
      mockFieldMapper.mapFieldsToValues.mockResolvedValue(largeFieldValues);

      const startTime = Date.now();
      const result = await pdfProcessor.processPdf();
      const endTime = Date.now();

      expect(result.json.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle processing time measurement accurately', async () => {
      let processingStartTime: number;
      let processingEndTime: number;

      mockPythonBridge.executePythonScript.mockImplementation(async (_input) => {
        processingStartTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate processing
        processingEndTime = Date.now();
        
        return {
          success: true,
          data: 'filled-pdf-data',
          metadata: {
            fieldCount: 3,
            processingTime: processingEndTime - processingStartTime,
          },
        };
      });

      const result = await pdfProcessor.processPdf();

      expect(result.json.success).toBe(true);
      expect(result.json.metadata.processingTime).toBeGreaterThanOrEqual(200);
      expect(result.json.metadata.processingTime).toBeLessThan(300); // Allow some margin
    });
  });
});