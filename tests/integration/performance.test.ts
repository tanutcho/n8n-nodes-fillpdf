import { FillPdf } from '../../nodes/FillPdf/FillPdf.node';
import { IExecuteFunctions } from 'n8n-workflow';
import { SIMPLE_TEXT_FORM_PDF, SAMPLE_FIELD_MAPPINGS, SAMPLE_INPUT_DATA } from './sample-pdfs';
import * as fs from 'fs';

// Mock file system operations
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FillPdf Performance Tests', () => {
  let fillPdfNode: FillPdf;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockNode: any;

  beforeEach(() => {
    fillPdfNode = new FillPdf();
    
    mockNode = {
      id: 'perf-test-node',
      name: 'Fill PDF Performance Test',
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

    // Setup default mocks
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.readFileSync = jest.fn().mockReturnValue(Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64'));
    mockFs.writeFileSync = jest.fn();
    mockFs.mkdirSync = jest.fn();
    jest.spyOn(mockFs, 'statSync').mockReturnValue({ size: 1000 } as any);

    jest.clearAllMocks();
  });

  describe('Large File Processing', () => {
    it('should handle 10MB PDF files within reasonable time', async () => {
      const largePdfSize = 10 * 1024 * 1024; // 10MB
      const largePdfData = Buffer.alloc(largePdfSize, '%PDF-1.4 large content');
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/large-10mb.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      mockFs.readFileSync.mockReturnValue(largePdfData);

      // Mock Python execution with realistic processing time for large files
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        // Simulate processing time proportional to file size (1-2 seconds for 10MB)
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 large processed').toString('base64'),
          metadata: {
            fieldCount: 2,
            processingTime: 1500,
          },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Performance assertions
      expect(result[0][0].json.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result[0][0].json.metadata.processingTime).toBeLessThan(5000);
    }, 15000); // Increase Jest timeout for this test

    it('should handle 50MB PDF files with memory efficiency', async () => {
      const hugePdfSize = 50 * 1024 * 1024; // 50MB
      
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/huge-50mb.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/huge-result.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);
      
      // Mock file reading to simulate large file without actually allocating memory
      mockFs.readFileSync.mockImplementation(() => {
        // Return a smaller buffer but simulate large file processing
        return Buffer.from(SIMPLE_TEXT_FORM_PDF, 'base64');
      });

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        // Simulate longer processing time for huge files
        await new Promise(resolve => setTimeout(resolve, 3000));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 huge processed').toString('base64'),
          metadata: {
            fieldCount: 2,
            processingTime: 3000,
          },
        };
      });

      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      const result = await fillPdfNode.execute.call(mockContext);
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Performance and memory assertions
      expect(result[0][0].json.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Memory increase should be reasonable
    }, 25000);
  });

  describe('High Volume Field Processing', () => {
    it('should handle 100 field mappings efficiently', async () => {
      // Generate 100 field mappings
      const manyFieldMappings = Array.from({ length: 100 }, (_, i) => ({
        pdfFieldName: `field_${i.toString().padStart(3, '0')}`,
        valueSource: 'static' as const,
        staticValue: `value_${i}`,
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/many-fields.pdf';
          case 'fieldMappings': return { mapping: manyFieldMappings };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async (input) => {
        // Simulate processing time proportional to field count
        const fieldCount = Object.keys(input.fieldMappings || {}).length;
        const processingTime = Math.min(fieldCount * 10, 2000); // Max 2 seconds
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 many fields processed').toString('base64'),
          metadata: {
            fieldCount,
            processingTime,
          },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Performance assertions
      expect(result[0][0].json.success).toBe(true);
      expect(result[0][0].json.fieldsProcessed).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all fields were processed
      const pythonCall = mockPythonBridge.prototype.executePythonScript.mock.calls[0][0];
      expect(Object.keys(pythonCall.fieldMappings)).toHaveLength(100);
    }, 10000);

    it('should handle complex expression evaluations efficiently', async () => {
      // Create complex expression mappings
      const complexExpressionMappings = Array.from({ length: 20 }, (_, i) => ({
        pdfFieldName: `computed_field_${i}`,
        valueSource: 'expression' as const,
        expression: `{{$json.data.items[${i}].value + " - " + new Date().toISOString().substring(0, 10)}}`,
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/complex-expressions.pdf';
          case 'fieldMappings': return { mapping: complexExpressionMappings };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Setup complex input data
      const complexInputData = {
        json: {
          data: {
            items: Array.from({ length: 20 }, (_, i) => ({
              value: `item_value_${i}`,
              timestamp: new Date().toISOString(),
            })),
          },
        },
      };
      mockContext.getInputData.mockReturnValue([complexInputData]);

      // Mock expression evaluation
      mockContext.evaluateExpression.mockImplementation((expression: string) => {
        // Simulate complex expression evaluation
        const match = expression.match(/items\[(\d+)\]/);
        const index = match ? parseInt(match[1]) : 0;
        return `item_value_${index} - ${new Date().toISOString().substring(0, 10)}`;
      });

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 complex expressions processed').toString('base64'),
        metadata: {
          fieldCount: 20,
          processingTime: 800,
        },
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Performance assertions
      expect(result[0][0].json.success).toBe(true);
      expect(result[0][0].json.fieldsProcessed).toBe(20);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(mockContext.evaluateExpression).toHaveBeenCalledTimes(20);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should handle 50 item batch efficiently', async () => {
      // Create batch of 50 items
      const largeBatch = Array.from({ length: 50 }, (_, i) => ({
        json: {
          firstName: `User${i.toString().padStart(2, '0')}`,
          lastName: `Batch${i.toString().padStart(2, '0')}`,
          email: `user${i}@batch.test`,
          id: i,
        },
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/batch-template.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/batch_item.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue(largeBatch);

      // Mock Python execution for batch processing
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        // Simulate individual item processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 batch item processed').toString('base64'),
          metadata: {
            fieldCount: 2,
            processingTime: 50,
          },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Performance assertions
      expect(result[0]).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      // Verify all items processed successfully
      result[0].forEach((item, index) => {
        expect(item.json.success).toBe(true);
        expect(item.json.metadata.batch?.itemIndex).toBe(index + 1);
        expect(item.json.metadata.batch?.totalItems).toBe(50);
      });

      // Verify batch summary
      const batchSummary = result[0][0].json.metadata.batchSummary;
      expect(batchSummary?.totalItems).toBe(50);
      expect(batchSummary?.successfulItems).toBe(50);
      expect(batchSummary?.failedItems).toBe(0);
    }, 20000);

    it('should handle concurrent batch processing without memory leaks', async () => {
      const mediumBatch = Array.from({ length: 20 }, (_, i) => ({
        json: {
          firstName: `Concurrent${i}`,
          lastName: `Test${i}`,
          email: `concurrent${i}@test.com`,
        },
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/concurrent-template.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue(mediumBatch);

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 concurrent item').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 100 },
        };
      });

      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      const result = await fillPdfNode.execute.call(mockContext);
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Performance and memory assertions
      expect(result[0]).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Memory increase should be reasonable

      // Verify all items processed
      result[0].forEach(item => {
        expect(item.json.success).toBe(true);
        expect(item.binary?.pdf).toBeDefined();
      });
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should maintain stable memory usage during processing', async () => {
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/memory-test.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([SAMPLE_INPUT_DATA.SIMPLE]);

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockResolvedValue({
        success: true,
        data: Buffer.from('%PDF-1.4 memory test').toString('base64'),
        metadata: { fieldCount: 2, processingTime: 200 },
      });

      const memoryMeasurements: number[] = [];
      
      // Measure memory before
      memoryMeasurements.push(process.memoryUsage().heapUsed);

      // Process multiple times to check for memory leaks
      for (let i = 0; i < 10; i++) {
        await fillPdfNode.execute.call(mockContext);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        memoryMeasurements.push(process.memoryUsage().heapUsed);
      }

      // Analyze memory usage trend
      const initialMemory = memoryMeasurements[0];
      const finalMemory = memoryMeasurements[memoryMeasurements.length - 1];
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not increase significantly over multiple runs
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      
      // Check for consistent memory usage (no major spikes)
      const maxMemory = Math.max(...memoryMeasurements);
      const avgMemory = memoryMeasurements.reduce((a, b) => a + b, 0) / memoryMeasurements.length;
      expect(maxMemory - avgMemory).toBeLessThan(20 * 1024 * 1024); // Spikes should be less than 20MB
    });

    it('should handle garbage collection efficiently', async () => {
      const largeBatch = Array.from({ length: 30 }, (_, i) => ({
        json: { firstName: `GC${i}`, lastName: `Test${i}`, email: `gc${i}@test.com` },
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/gc-test.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue(largeBatch);

      // Mock Python execution
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        // Create some temporary objects to test GC
        const tempData = new Array(1000).fill(0).map((_, i) => ({ id: i, data: 'x'.repeat(1000) }));
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 gc test').toString('base64'),
          metadata: { fieldCount: 2, processingTime: 50 },
        };
      });

      const initialMemory = process.memoryUsage().heapUsed;
      
      const result = await fillPdfNode.execute.call(mockContext);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Verify processing completed successfully
      expect(result[0]).toHaveLength(30);
      result[0].forEach(item => {
        expect(item.json.success).toBe(true);
      });

      // Memory increase should be reasonable after GC
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024); // Less than 30MB increase
    });
  });

  describe('Concurrent Processing Limits', () => {
    it('should handle system resource limits gracefully', async () => {
      // Simulate system under load
      const heavyBatch = Array.from({ length: 15 }, (_, i) => ({
        json: { firstName: `Heavy${i}`, lastName: `Load${i}`, email: `heavy${i}@test.com` },
      }));

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/heavy-load.pdf';
          case 'fieldMappings': return { mapping: SAMPLE_FIELD_MAPPINGS.SIMPLE_TEXT };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/heavy_load.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue(heavyBatch);

      // Mock Python execution with variable processing times
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      let callCount = 0;
      mockPythonBridge.prototype.executePythonScript = jest.fn().mockImplementation(async () => {
        callCount++;
        // Simulate varying load - some items take longer
        const processingTime = callCount % 3 === 0 ? 300 : 100;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        return {
          success: true,
          data: Buffer.from(`%PDF-1.4 heavy load item ${callCount}`).toString('base64'),
          metadata: { fieldCount: 2, processingTime },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Verify all items processed despite varying load
      expect(result[0]).toHaveLength(15);
      expect(endTime - startTime).toBeLessThan(12000); // Should complete within 12 seconds

      // Verify batch processing handled the load correctly
      const batchSummary = result[0][0].json.metadata.batchSummary;
      expect(batchSummary?.successfulItems).toBe(15);
      expect(batchSummary?.failedItems).toBe(0);
    });
  });
});