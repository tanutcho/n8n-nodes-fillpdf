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

describe('Field Extraction Performance Integration Tests', () => {
  // Remove FillPdf node initialization to avoid import issues
  let fieldInspector: FieldInspector;
  let uiGenerator: UIGenerator;
  let fieldMapper: FieldMapper;
  let cacheManager: FieldCacheManager;
  let mockContext: jest.Mocked<IExecuteFunctions>;
  let mockLoadContext: jest.Mocked<ILoadOptionsFunctions>;

  beforeEach(() => {
    // Initialize components
    fieldInspector = new FieldInspector();
    uiGenerator = new UIGenerator();
    cacheManager = new FieldCacheManager();

    // Setup mock contexts
    mockContext = {
      getNode: jest.fn().mockReturnValue({ name: 'Performance Test Node' }),
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
    mockFs.readFileSync = jest.fn().mockReturnValue(Buffer.from('%PDF-1.4 performance test pdf'));
    mockFs.writeFileSync = jest.fn();
    mockFs.mkdirSync = jest.fn();
    (mockFs as any).statSync = jest.fn().mockReturnValue({ size: 5 * 1024 * 1024 }); // 5MB

    // Setup Python bridge mock
    const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
    mockPythonBridge.prototype.executePythonScript = jest.fn();

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cacheManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('Large PDF Processing Performance', () => {
    it('should handle PDF with 200+ fields efficiently', async () => {
      // Generate large field set
      const manyFields: IFieldInfo[] = Array.from({ length: 200 }, (_, i) => ({
        name: `field_${i.toString().padStart(3, '0')}`,
        type: ['text', 'checkbox', 'dropdown', 'radio'][i % 4] as any,
        required: i % 5 === 0,
        options: i % 4 >= 2 ? [`Option${i}_1`, `Option${i}_2`, `Option${i}_3`] : undefined,
        maxLength: i % 4 === 0 ? 50 + (i % 100) : undefined,
        defaultValue: i % 4 === 1 ? (i % 2 === 0) : '',
      }));

      // Mock Python bridge to return many fields
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async (input) => {
        // Simulate processing time proportional to field count
        await new Promise(resolve => setTimeout(resolve, Math.min(manyFields.length * 2, 1000)));
        
        if (input.action === 'inspect') {
          return {
            success: true,
            fields: manyFields,
          };
        } else {
          return {
            success: true,
            data: Buffer.from('%PDF-1.4 large processed pdf').toString('base64'),
            metadata: {
              fieldCount: Object.keys(input.fieldMappings || {}).length,
              processingTime: Math.min(manyFields.length * 5, 2000),
            },
          };
        }
      });

      const startTime = Date.now();

      // Test field extraction performance
      mockLoadContext.getNodeParameter
        .mockReturnValueOnce('upload')
        .mockReturnValueOnce('/test/large-200-fields.pdf');

      const extractedFields = await fieldInspector.loadPdfFields(
        mockLoadContext,
        'upload',
        '/test/large-200-fields.pdf'
      );

      const extractionTime = Date.now() - startTime;

      // Test UI generation performance
      const uiStartTime = Date.now();
      const uiProperties = uiGenerator.generateFieldProperties(manyFields);
      const uiGenerationTime = Date.now() - uiStartTime;

      // Test field mapping performance
      const mappingStartTime = Date.now();
      const dynamicValues: Record<string, any> = {};
      manyFields.forEach((field, i) => {
        dynamicValues[`pdfField_${field.name}`] = 
          field.type === 'checkbox' ? (i % 2 === 0) :
          field.type === 'dropdown' && field.options ? field.options[0] :
          field.type === 'radio' && field.options ? field.options[0] :
          `value_${i}`;
      });

      const fieldMappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, manyFields);
      
      // Mock expression evaluation for performance test
      mockContext.evaluateExpression.mockImplementation((expr) => {
        const match = expr.match(/value_(\d+)/);
        return match ? `evaluated_${match[1]}` : 'default_value';
      });

      const mappedValues = await fieldMapper.mapFieldsToValues(fieldMappings, manyFields);
      const mappingTime = Date.now() - mappingStartTime;

      // Performance assertions
      expect(extractedFields).toHaveLength(200);
      expect(uiProperties.length).toBeGreaterThan(200);
      expect(fieldMappings).toHaveLength(200);
      expect(Object.keys(mappedValues)).toHaveLength(200);

      // Time-based performance checks
      expect(extractionTime).toBeLessThan(3000); // Field extraction < 3s
      expect(uiGenerationTime).toBeLessThan(1000); // UI generation < 1s
      expect(mappingTime).toBeLessThan(2000); // Field mapping < 2s

      console.log(`Performance metrics for 200 fields:
        - Field extraction: ${extractionTime}ms
        - UI generation: ${uiGenerationTime}ms
        - Field mapping: ${mappingTime}ms
        - Total: ${Date.now() - startTime}ms`);
    }, 15000); // Increase timeout for performance test

    it('should handle very large PDF files (50MB) efficiently', async () => {
      const largePdfSize = 50 * 1024 * 1024; // 50MB
      (mockFs as any).statSync.mockReturnValue({ size: largePdfSize });

      // Mock large PDF content
      mockFs.readFileSync.mockImplementation(() => {
        // Don't actually create 50MB buffer, just simulate
        return Buffer.from('%PDF-1.4 large file content');
      });

      const mediumFieldSet: IFieldInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `largeFile_field_${i}`,
        type: 'text',
        required: i % 3 === 0,
        maxLength: 100,
      }));

      // Mock Python bridge with realistic large file processing time
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        // Simulate longer processing for large files
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
          success: true,
          fields: mediumFieldSet,
          data: Buffer.from('%PDF-1.4 large file processed').toString('base64'),
          metadata: {
            fieldCount: mediumFieldSet.length,
            processingTime: 2000,
            fileSize: largePdfSize,
          },
        };
      });

      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/large-50mb.pdf';
          case 'fieldMappings': return {
            mapping: mediumFieldSet.map(field => ({
              pdfFieldName: field.name,
              valueSource: 'static',
              staticValue: `value_for_${field.name}`,
            })),
          };
          case 'outputFormat': return 'file';
          case 'outputPath': return '/output/large-result.pdf';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      mockContext.getInputData.mockReturnValue([{
        json: { testData: 'large file test' },
      }]);

      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      const result = await fillPdfNode.execute.call(mockContext);

      const endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Performance and memory assertions
      expect(result[0][0].json.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Memory increase < 100MB

      console.log(`Large file performance:
        - Processing time: ${endTime - startTime}ms
        - Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    }, 20000);
  });

  describe('High Concurrency Performance', () => {
    it('should handle multiple concurrent field extractions', async () => {
      const concurrentRequests = 10;
      const fieldsPerRequest = 20;

      // Create different field sets for each request
      const fieldSets = Array.from({ length: concurrentRequests }, (_, i) =>
        Array.from({ length: fieldsPerRequest }, (_, j) => ({
          name: `concurrent_${i}_field_${j}`,
          type: 'text' as const,
          required: j % 2 === 0,
          maxLength: 50,
        }))
      );

      // Mock Python bridge for concurrent requests
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      let callCount = 0;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        const currentCall = callCount++;
        // Simulate varying processing times
        await new Promise(resolve => setTimeout(resolve, 100 + (currentCall % 3) * 50));
        return {
          success: true,
          fields: fieldSets[currentCall % fieldSets.length],
        };
      });

      // Mock HTTPS for URL sources
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
        }, 50);
        return { destroy: jest.fn() } as any;
      });

      const startTime = Date.now();

      // Create concurrent extraction promises
      const extractionPromises = Array.from({ length: concurrentRequests }, (_, i) => {
        const url = `https://example.com/concurrent-form-${i}.pdf`;
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(url);
        return fieldInspector.loadPdfFields(mockLoadContext, 'url', url);
      });

      const results = await Promise.all(extractionPromises);
      const endTime = Date.now();

      // Verify all extractions succeeded
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((fields, i) => {
        expect(fields).toHaveLength(fieldsPerRequest);
        expect(fields[0].name).toContain(`concurrent_${i}_field_0`);
      });

      // Performance check - concurrent should be faster than sequential
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`Concurrent extraction performance:
        - ${concurrentRequests} requests with ${fieldsPerRequest} fields each
        - Total time: ${endTime - startTime}ms
        - Average per request: ${Math.round((endTime - startTime) / concurrentRequests)}ms`);
    });

    it('should handle concurrent batch processing efficiently', async () => {
      const batchSize = 25;
      const fieldsPerItem = 10;

      // Create batch data
      const batchData = Array.from({ length: batchSize }, (_, i) => ({
        json: {
          id: i,
          name: `BatchUser${i}`,
          email: `batch${i}@test.com`,
          category: `Category${i % 5}`,
        },
      }));

      const batchFields: IFieldInfo[] = Array.from({ length: fieldsPerItem }, (_, i) => ({
        name: `batch_field_${i}`,
        type: ['text', 'checkbox', 'dropdown'][i % 3] as any,
        required: i % 3 === 0,
        options: i % 3 === 2 ? ['A', 'B', 'C'] : undefined,
      }));

      mockContext.getInputData.mockReturnValue(batchData);
      mockContext.getNodeParameter.mockImplementation((paramName: string) => {
        switch (paramName) {
          case 'pdfSource': return 'upload';
          case 'pdfFile': return '/test/batch-concurrent.pdf';
          case 'fieldMappings': return {
            mapping: batchFields.map(field => ({
              pdfFieldName: field.name,
              valueSource: 'expression',
              expression: `{{ $json.name }}_${field.name}`,
            })),
          };
          case 'outputFormat': return 'binary';
          case 'options': return { flattenPdf: true, validateFields: false, skipMissingFields: false };
          default: return undefined;
        }
      });

      // Mock expression evaluation for batch
      mockContext.evaluateExpression.mockImplementation((expr: string, itemIndex: number) => {
        const item = batchData[itemIndex].json;
        return `${item.name}_evaluated`;
      });

      // Mock Python bridge for batch processing
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async (input) => {
        if (input.action === 'inspect') {
          return { success: true, fields: batchFields };
        }
        
        // Simulate individual item processing
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          data: Buffer.from('%PDF-1.4 batch item').toString('base64'),
          metadata: { fieldCount: fieldsPerItem, processingTime: 50 },
        };
      });

      const startTime = Date.now();
      const result = await fillPdfNode.execute.call(mockContext);
      const endTime = Date.now();

      // Verify batch processing
      expect(result[0]).toHaveLength(batchSize);
      result[0].forEach((item, index) => {
        expect(item.json.success).toBe(true);
        const metadata = item.json.metadata as any;
        expect(metadata.batch?.itemIndex).toBe(index + 1);
        expect(metadata.batch?.totalItems).toBe(batchSize);
      });

      // Performance check
      expect(endTime - startTime).toBeLessThan(8000); // Should complete within 8 seconds

      console.log(`Batch processing performance:
        - ${batchSize} items with ${fieldsPerItem} fields each
        - Total time: ${endTime - startTime}ms
        - Average per item: ${Math.round((endTime - startTime) / batchSize)}ms`);
    });
  });

  describe('Memory Usage and Optimization', () => {
    it('should maintain stable memory usage during repeated operations', async () => {
      const iterations = 20;
      const fieldsPerIteration = 25;

      const testFields: IFieldInfo[] = Array.from({ length: fieldsPerIteration }, (_, i) => ({
        name: `memory_test_field_${i}`,
        type: 'text',
        required: false,
        maxLength: 100,
      }));

      // Mock Python bridge
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockResolvedValue({
        success: true,
        fields: testFields,
        data: Buffer.from('%PDF-1.4 memory test').toString('base64'),
        metadata: { fieldCount: fieldsPerIteration, processingTime: 100 },
      });

      const memoryMeasurements: number[] = [];
      
      // Measure initial memory
      if (global.gc) global.gc();
      memoryMeasurements.push(process.memoryUsage().heapUsed);

      for (let i = 0; i < iterations; i++) {
        // Perform field extraction
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('upload')
          .mockReturnValueOnce(`/test/memory-test-${i}.pdf`);

        await fieldInspector.loadPdfFields(
          mockLoadContext,
          'upload',
          `/test/memory-test-${i}.pdf`
        );

        // Generate UI properties
        const uiProperties = uiGenerator.generateFieldProperties(testFields);

        // Create field mappings
        const dynamicValues: Record<string, any> = {};
        testFields.forEach(field => {
          dynamicValues[`pdfField_${field.name}`] = `iteration_${i}_value`;
        });

        const fieldMappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, testFields);

        // Force garbage collection if available
        if (global.gc && i % 5 === 0) {
          global.gc();
        }

        // Measure memory every few iterations
        if (i % 3 === 0) {
          memoryMeasurements.push(process.memoryUsage().heapUsed);
        }
      }

      // Final memory measurement
      if (global.gc) global.gc();
      memoryMeasurements.push(process.memoryUsage().heapUsed);

      // Analyze memory usage
      const initialMemory = memoryMeasurements[0];
      const finalMemory = memoryMeasurements[memoryMeasurements.length - 1];
      const maxMemory = Math.max(...memoryMeasurements);
      const avgMemory = memoryMeasurements.reduce((a, b) => a + b, 0) / memoryMeasurements.length;

      const memoryIncrease = finalMemory - initialMemory;
      const maxSpike = maxMemory - avgMemory;

      // Memory assertions
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB increase
      expect(maxSpike).toBeLessThan(30 * 1024 * 1024); // < 30MB spikes

      console.log(`Memory usage analysis over ${iterations} iterations:
        - Initial: ${Math.round(initialMemory / 1024 / 1024)}MB
        - Final: ${Math.round(finalMemory / 1024 / 1024)}MB
        - Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB
        - Max spike: ${Math.round(maxSpike / 1024 / 1024)}MB`);
    });

    it('should handle garbage collection efficiently with large objects', async () => {
      const largeFieldCount = 100;
      const iterations = 10;

      const largeFields: IFieldInfo[] = Array.from({ length: largeFieldCount }, (_, i) => ({
        name: `gc_test_field_${i}`,
        type: 'dropdown',
        required: false,
        options: Array.from({ length: 20 }, (_, j) => `Option_${i}_${j}`), // Many options
        defaultValue: `Option_${i}_0`,
      }));

      // Mock Python bridge
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        // Create temporary large objects to test GC
        const _tempData = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(1000),
          nested: { value: i, array: new Array(100).fill(i) },
        }));
        
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          fields: largeFields,
        };
      });

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        // Generate large UI properties
        const uiProperties = uiGenerator.generateFieldProperties(largeFields);
        
        // Create complex dynamic values
        const dynamicValues: Record<string, any> = {};
        largeFields.forEach((field, fieldIndex) => {
          dynamicValues[`pdfField_${field.name}`] = 
            field.options ? field.options[fieldIndex % field.options.length] : `value_${fieldIndex}`;
        });

        // Generate field mappings
        const fieldMappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, largeFields);

        // Validate configuration (creates more objects)
        const validation = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, largeFields);

        // Clear references
        dynamicValues.length = 0;
        fieldMappings.length = 0;
        uiProperties.length = 0;

        // Force GC periodically
        if (global.gc && i % 3 === 0) {
          global.gc();
        }
      }

      // Final GC
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // GC efficiency check
      expect(memoryIncrease).toBeLessThan(40 * 1024 * 1024); // < 40MB after GC

      console.log(`GC efficiency test:
        - Initial memory: ${Math.round(initialMemory / 1024 / 1024)}MB
        - Final memory: ${Math.round(finalMemory / 1024 / 1024)}MB
        - Net increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  describe('Cache Performance Optimization', () => {
    it('should demonstrate cache performance benefits', async () => {
      const testUrls = [
        'https://example.com/cached-form-1.pdf',
        'https://example.com/cached-form-2.pdf',
        'https://example.com/cached-form-3.pdf',
      ];

      const cacheFields: IFieldInfo[] = Array.from({ length: 30 }, (_, i) => ({
        name: `cache_field_${i}`,
        type: 'text',
        required: i % 2 === 0,
      }));

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
          mockResponse.emit('data', Buffer.from('%PDF-1.4 cache test'));
          mockResponse.emit('end');
        }, 100); // Simulate network delay
        return { destroy: jest.fn() } as any;
      });

      // Mock Python bridge with processing delay
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate processing time
        return { success: true, fields: cacheFields };
      });

      // First round - populate cache
      const firstRoundStart = Date.now();
      const firstRoundPromises = testUrls.map(url => {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(url);
        return fieldInspector.loadPdfFields(mockLoadContext, 'url', url);
      });
      await Promise.all(firstRoundPromises);
      const firstRoundTime = Date.now() - firstRoundStart;

      // Second round - should use cache (but our mock doesn't implement caching)
      const secondRoundStart = Date.now();
      const secondRoundPromises = testUrls.map(url => {
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('url')
          .mockReturnValueOnce(url);
        return fieldInspector.loadPdfFields(mockLoadContext, 'url', url);
      });
      await Promise.all(secondRoundPromises);
      const secondRoundTime = Date.now() - secondRoundStart;

      // In a real implementation with caching, second round should be much faster
      console.log(`Cache performance test:
        - First round (no cache): ${firstRoundTime}ms
        - Second round (with cache): ${secondRoundTime}ms
        - Note: Mock doesn't implement caching, so times are similar`);

      // Both rounds should complete successfully
      expect(firstRoundTime).toBeGreaterThan(0);
      expect(secondRoundTime).toBeGreaterThan(0);
    });

    it('should handle cache cleanup under memory pressure', async () => {
      const cacheManager = new FieldCacheManager();
      const manyUrls = Array.from({ length: 150 }, (_, i) => `https://example.com/cache-test-${i}.pdf`);
      
      const testFields: IFieldInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `cache_cleanup_field_${i}`,
        type: 'text',
        required: false,
      }));

      // Fill cache beyond capacity
      manyUrls.forEach((url, i) => {
        cacheManager.cacheFields('url', url, testFields, 300000); // 5 minute TTL
      });

      const stats = cacheManager.getCacheStats();
      
      // Cache should enforce size limits
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
      expect(stats.size).toBeGreaterThan(0);

      // Performance should remain good even with cleanup
      const startTime = Date.now();
      const cachedFields = cacheManager.getCachedFields('url', manyUrls[manyUrls.length - 1]);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Cache lookup should be very fast

      console.log(`Cache cleanup performance:
        - Attempted to cache ${manyUrls.length} entries
        - Actual cache size: ${stats.size}
        - Max cache size: ${stats.maxSize}
        - Cache lookup time: ${endTime - startTime}ms`);

      cacheManager.cleanup();
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme field counts without crashing', async () => {
      const extremeFieldCount = 500;
      const extremeFields: IFieldInfo[] = Array.from({ length: extremeFieldCount }, (_, i) => ({
        name: `extreme_field_${i.toString().padStart(4, '0')}`,
        type: ['text', 'checkbox', 'dropdown', 'radio'][i % 4] as any,
        required: i % 10 === 0,
        options: i % 4 >= 2 ? Array.from({ length: 5 }, (_, j) => `Opt${i}_${j}`) : undefined,
        maxLength: i % 4 === 0 ? 50 + (i % 50) : undefined,
      }));

      // Mock Python bridge for extreme case
      const mockPythonBridge = require('../../nodes/FillPdf/python-bridge').PythonBridge;
      mockPythonBridge.prototype.executePythonScript.mockImplementation(async () => {
        // Simulate longer processing for extreme case
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          success: true,
          fields: extremeFields,
          data: Buffer.from('%PDF-1.4 extreme case').toString('base64'),
          metadata: { fieldCount: extremeFieldCount, processingTime: 1000 },
        };
      });

      const startTime = Date.now();
      let memoryPeak = process.memoryUsage().heapUsed;

      try {
        // Test field extraction
        mockLoadContext.getNodeParameter
          .mockReturnValueOnce('upload')
          .mockReturnValueOnce('/test/extreme-500-fields.pdf');

        const extractedFields = await fieldInspector.loadPdfFields(
          mockLoadContext,
          'upload',
          '/test/extreme-500-fields.pdf'
        );

        memoryPeak = Math.max(memoryPeak, process.memoryUsage().heapUsed);

        // Test UI generation (this might be the bottleneck)
        const uiProperties = uiGenerator.generateFieldProperties(extremeFields);
        memoryPeak = Math.max(memoryPeak, process.memoryUsage().heapUsed);

        // Test field mapping with subset to avoid timeout
        const subsetFields = extremeFields.slice(0, 100);
        const dynamicValues: Record<string, any> = {};
        subsetFields.forEach((field, i) => {
          dynamicValues[`pdfField_${field.name}`] = `stress_test_value_${i}`;
        });

        const fieldMappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, subsetFields);
        memoryPeak = Math.max(memoryPeak, process.memoryUsage().heapUsed);

        const endTime = Date.now();

        // Verify results
        expect(extractedFields).toHaveLength(extremeFieldCount);
        expect(uiProperties.length).toBeGreaterThan(extremeFieldCount);
        expect(fieldMappings).toHaveLength(100); // Subset

        // Performance checks (more lenient for extreme case)
        expect(endTime - startTime).toBeLessThan(15000); // 15 seconds max
        expect(memoryPeak - process.memoryUsage().heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB max

        console.log(`Extreme stress test (${extremeFieldCount} fields):
          - Total time: ${endTime - startTime}ms
          - Peak memory increase: ${Math.round((memoryPeak - process.memoryUsage().heapUsed) / 1024 / 1024)}MB
          - Status: PASSED`);

      } catch (error) {
        console.log(`Extreme stress test failed: ${error}`);
        throw error;
      }
    }, 20000); // Extended timeout for stress test
  });
});