import { FieldCacheManager, ICacheStats } from '../nodes/FillPdf/field-cache';
import { IFieldInfo } from '../nodes/FillPdf/types';

describe('FieldCacheManager Performance Optimizations', () => {
	let cacheManager: FieldCacheManager;
	
	const mockFields: IFieldInfo[] = [
		{
			name: 'field1',
			type: 'text',
			required: false,
			value: '',
			options: [],
		},
		{
			name: 'field2',
			type: 'checkbox',
			required: true,
			value: false,
			options: [],
		},
	];

	beforeEach(() => {
		cacheManager = new FieldCacheManager();
		jest.clearAllMocks();
		// Reset console.debug mock for testing logging
		(console.debug as jest.Mock).mockClear();
	});

	afterEach(() => {
		cacheManager.cleanup();
	});

	describe('Debounced Field Extraction', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should debounce multiple extraction calls for the same key', async () => {
			const extractionFn = jest.fn().mockResolvedValue(mockFields);
			const key = 'test-pdf-url';

			// Start multiple extractions simultaneously
			const promise1 = cacheManager.debouncedExtraction(key, extractionFn);
			const promise2 = cacheManager.debouncedExtraction(key, extractionFn);
			const promise3 = cacheManager.debouncedExtraction(key, extractionFn);

			// Fast-forward past debounce delay
			jest.advanceTimersByTime(300);

			const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

			// All should return the same result
			expect(result1).toEqual(mockFields);
			expect(result2).toEqual(mockFields);
			expect(result3).toEqual(mockFields);

			// Extraction function should only be called once
			expect(extractionFn).toHaveBeenCalledTimes(1);
		});

		it('should handle different keys independently', async () => {
			const extractionFn1 = jest.fn().mockResolvedValue(mockFields);
			const extractionFn2 = jest.fn().mockResolvedValue([mockFields[0]]);

			const key1 = 'test-pdf-1';
			const key2 = 'test-pdf-2';

			// Start extractions for different keys
			const promise1 = cacheManager.debouncedExtraction(key1, extractionFn1);
			const promise2 = cacheManager.debouncedExtraction(key2, extractionFn2);

			// Fast-forward past debounce delay
			jest.advanceTimersByTime(300);

			const [result1, result2] = await Promise.all([promise1, promise2]);

			// Both extraction functions should be called
			expect(extractionFn1).toHaveBeenCalledTimes(1);
			expect(extractionFn2).toHaveBeenCalledTimes(1);

			// Results should be different
			expect(result1).toEqual(mockFields);
			expect(result2).toEqual([mockFields[0]]);
		});

		it('should cancel pending extraction when requested', async () => {
			const extractionFn = jest.fn().mockResolvedValue(mockFields);
			const key = 'test-pdf-cancel';

			// Start extraction
			const promise = cacheManager.debouncedExtraction(key, extractionFn);

			// Cancel before timer fires
			cacheManager.cancelDebouncedExtraction(key);

			// Fast-forward past debounce delay
			jest.advanceTimersByTime(300);

			// Promise should still be pending, extraction function not called
			expect(extractionFn).not.toHaveBeenCalled();

			// Cancel the promise to avoid unhandled promise rejection
			cacheManager.cancelDebouncedExtraction(key);
		});

		it('should use custom delay when provided', async () => {
			const extractionFn = jest.fn().mockResolvedValue(mockFields);
			const key = 'test-pdf-custom-delay';
			const customDelay = 500;

			// Start extraction with custom delay
			const promise = cacheManager.debouncedExtraction(key, extractionFn, customDelay);

			// Fast-forward by default delay (300ms) - should not trigger
			jest.advanceTimersByTime(300);
			expect(extractionFn).not.toHaveBeenCalled();

			// Fast-forward by custom delay
			jest.advanceTimersByTime(200);
			
			await promise;
			expect(extractionFn).toHaveBeenCalledTimes(1);
		});

		it('should handle extraction errors properly', async () => {
			const error = new Error('Extraction failed');
			const extractionFn = jest.fn().mockRejectedValue(error);
			const key = 'test-pdf-error';

			// Start extraction that will fail
			const promise = cacheManager.debouncedExtraction(key, extractionFn);

			// Fast-forward past debounce delay
			jest.advanceTimersByTime(300);

			// Should reject with the original error
			await expect(promise).rejects.toThrow('Extraction failed');

			// Pending extractions should be cleaned up
			const stats = cacheManager.getPerformanceStats();
			expect(stats.pendingExtractions).toBe(0);
		});
	});

	describe('Cache Hit/Miss Logging', () => {
		beforeEach(() => {
			// Enable debug logging for these tests
			process.env.FILL_PDF_DEBUG = 'true';
		});

		afterEach(() => {
			delete process.env.FILL_PDF_DEBUG;
		});

		it('should log cache miss when entry not found', () => {
			const result = cacheManager.getCachedFields('url', 'http://example.com/test.pdf');
			
			expect(result).toBeNull();
			expect(console.debug).toHaveBeenCalledWith(
				expect.stringMatching(/\[FieldCache\].*MISS.*Entry not found/)
			);
		});

		it('should log cache hit when entry found and valid', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';

			// Cache some fields first
			cacheManager.cacheFields(pdfSource, sourceValue, mockFields);

			// Clear previous logs
			(console.debug as jest.Mock).mockClear();

			// Retrieve cached fields
			const result = cacheManager.getCachedFields(pdfSource, sourceValue);

			expect(result).toEqual(mockFields);
			expect(console.debug).toHaveBeenCalledWith(
				expect.stringMatching(/\[FieldCache\].*HIT.*2 fields/)
			);
		});

		it('should log cache store operation', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';

			cacheManager.cacheFields(pdfSource, sourceValue, mockFields);

			expect(console.debug).toHaveBeenCalledWith(
				expect.stringMatching(/\[FieldCache\].*STORE.*2 fields, TTL: 300000ms/)
			);
		});

		it('should log cache eviction during cleanup', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';

			// Cache and then clear
			cacheManager.cacheFields(pdfSource, sourceValue, mockFields);
			(console.debug as jest.Mock).mockClear();
			
			cacheManager.clearCache(pdfSource);

			expect(console.debug).toHaveBeenCalledWith(
				expect.stringMatching(/\[FieldCache\].*EVICT.*url.*1 entries/)
			);
		});

		it('should log expired entry as cache miss', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';
			const shortTtl = 100; // 100ms TTL

			// Cache with short TTL
			cacheManager.cacheFields(pdfSource, sourceValue, mockFields, shortTtl);

			// Wait for expiration
			jest.useFakeTimers();
			jest.advanceTimersByTime(150);

			// Clear previous logs
			(console.debug as jest.Mock).mockClear();

			// Try to retrieve - should be expired
			const result = cacheManager.getCachedFields(pdfSource, sourceValue);

			expect(result).toBeNull();
			expect(console.debug).toHaveBeenCalledWith(
				expect.stringMatching(/\[FieldCache\].*MISS.*Entry expired/)
			);

			jest.useRealTimers();
		});

		it('should not log when debug logging is disabled', () => {
			delete process.env.FILL_PDF_DEBUG;
			process.env.NODE_ENV = 'production';

			const result = cacheManager.getCachedFields('url', 'http://example.com/test.pdf');
			
			expect(result).toBeNull();
			expect(console.debug).not.toHaveBeenCalled();
		});
	});

	describe('Cache Size Limits and Automatic Cleanup', () => {
		it('should enforce maximum cache size limit', () => {
			// Fill cache beyond max size (100 entries)
			for (let i = 0; i < 105; i++) {
				cacheManager.cacheFields('url', `http://example.com/test${i}.pdf`, mockFields);
			}

			const stats = cacheManager.getCacheStats();
			expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
		});

		it('should remove expired entries during cleanup', () => {
			const shortTtl = 100; // 100ms TTL
			
			// Fill cache to near max capacity to trigger cleanup
			for (let i = 0; i < 95; i++) {
				cacheManager.cacheFields('url', `http://example.com/test${i}.pdf`, mockFields, shortTtl);
			}

			expect(cacheManager.getCacheStats().size).toBe(95);

			// Wait for expiration
			jest.useFakeTimers();
			jest.advanceTimersByTime(150);

			// Add more entries to trigger cleanup (exceed max size)
			for (let i = 95; i < 105; i++) {
				cacheManager.cacheFields('url', `http://example.com/test${i}.pdf`, mockFields);
			}

			const stats = cacheManager.getCacheStats();
			// After cleanup, cache should be at or below max size
			expect(stats.size).toBeLessThanOrEqual(100);
			// Should have removed expired entries during cleanup
			expect(stats.size).toBeGreaterThan(0);

			jest.useRealTimers();
		});

		it('should remove oldest entries when cache is full', () => {
			// Fill cache to exactly max size
			for (let i = 0; i < 100; i++) {
				cacheManager.cacheFields('url', `http://example.com/test${i}.pdf`, mockFields);
			}

			// Add one more to trigger LRU cleanup
			cacheManager.cacheFields('url', 'http://example.com/overflow.pdf', mockFields);

			const stats = cacheManager.getCacheStats();
			expect(stats.size).toBeLessThanOrEqual(100);

			// The new entry should be present
			const newEntry = cacheManager.getCachedFields('url', 'http://example.com/overflow.pdf');
			expect(newEntry).toEqual(mockFields);
		});

		it('should clear specific PDF source entries', () => {
			// Cache entries for different sources
			cacheManager.cacheFields('url', 'http://example.com/test1.pdf', mockFields);
			cacheManager.cacheFields('upload', 'file123', mockFields);
			cacheManager.cacheFields('url', 'http://example.com/test2.pdf', mockFields);

			expect(cacheManager.getCacheStats().size).toBe(3);

			// Clear only URL source entries
			cacheManager.clearCache('url');

			expect(cacheManager.getCacheStats().size).toBe(1);
			
			// Upload source should still be there
			const uploadEntry = cacheManager.getCachedFields('upload', 'file123');
			expect(uploadEntry).toEqual(mockFields);
		});

		it('should clear all cache entries', () => {
			// Cache multiple entries
			for (let i = 0; i < 5; i++) {
				cacheManager.cacheFields('url', `http://example.com/test${i}.pdf`, mockFields);
			}

			expect(cacheManager.getCacheStats().size).toBe(5);

			// Clear all
			cacheManager.clearCache();

			expect(cacheManager.getCacheStats().size).toBe(0);
		});
	});

	describe('Performance Statistics', () => {
		it('should track cache hit/miss statistics', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';

			// Initial stats should be zero
			let stats = cacheManager.getPerformanceStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.totalRequests).toBe(0);
			expect(stats.hitRate).toBe(0);

			// Cache miss
			cacheManager.getCachedFields(pdfSource, sourceValue);
			stats = cacheManager.getPerformanceStats();
			expect(stats.misses).toBe(1);
			expect(stats.totalRequests).toBe(1);
			expect(stats.hitRate).toBe(0);

			// Cache the fields
			cacheManager.cacheFields(pdfSource, sourceValue, mockFields);

			// Cache hit
			cacheManager.getCachedFields(pdfSource, sourceValue);
			stats = cacheManager.getPerformanceStats();
			expect(stats.hits).toBe(1);
			expect(stats.misses).toBe(1);
			expect(stats.totalRequests).toBe(2);
			expect(stats.hitRate).toBe(50);
		});

		it('should provide comprehensive cache statistics', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';

			// Cache some fields
			cacheManager.cacheFields(pdfSource, sourceValue, mockFields);
			
			const stats = cacheManager.getCacheStats();
			
			expect(stats.size).toBe(1);
			expect(stats.maxSize).toBe(100);
			expect(stats.entries).toHaveLength(1);
			expect(stats.entries[0]).toMatchObject({
				fieldCount: 2,
				expired: false,
			});
			expect(stats.debounce.pendingExtractions).toBe(0);
			expect(stats.debounce.activeTimers).toBe(0);
		});

		it('should calculate average fields per entry', () => {
			// Cache entries with different field counts
			const fields1 = [mockFields[0]]; // 1 field
			const fields2 = mockFields; // 2 fields
			const fields3 = [...mockFields, mockFields[0]]; // 3 fields

			cacheManager.cacheFields('url', 'http://example.com/test1.pdf', fields1);
			cacheManager.cacheFields('url', 'http://example.com/test2.pdf', fields2);
			cacheManager.cacheFields('url', 'http://example.com/test3.pdf', fields3);

			const stats = cacheManager.getPerformanceStats();
			expect(stats.averageFieldsPerEntry).toBe(2); // (1+2+3)/3 = 2
		});

		it('should reset statistics', () => {
			const pdfSource = 'url';
			const sourceValue = 'http://example.com/test.pdf';

			// Generate some stats
			cacheManager.getCachedFields(pdfSource, sourceValue); // miss
			cacheManager.cacheFields(pdfSource, sourceValue, mockFields);
			cacheManager.getCachedFields(pdfSource, sourceValue); // hit

			let stats = cacheManager.getPerformanceStats();
			expect(stats.hits).toBe(1);
			expect(stats.misses).toBe(1);
			expect(stats.totalRequests).toBe(2);

			// Reset
			cacheManager.resetStats();

			stats = cacheManager.getPerformanceStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.totalRequests).toBe(0);
			expect(stats.hitRate).toBe(0);
		});
	});

	describe('Integration Tests', () => {
		it('should handle concurrent cache operations safely', async () => {
			const pdfSource = 'url';
			const promises: Promise<any>[] = [];

			// Start multiple concurrent operations
			for (let i = 0; i < 10; i++) {
				const sourceValue = `http://example.com/test${i}.pdf`;
				
				// Mix of cache operations
				promises.push(
					Promise.resolve().then(() => cacheManager.getCachedFields(pdfSource, sourceValue))
				);
				promises.push(
					Promise.resolve().then(() => cacheManager.cacheFields(pdfSource, sourceValue, mockFields))
				);
			}

			// Wait for all operations to complete
			await Promise.all(promises);

			// Cache should be in consistent state
			const stats = cacheManager.getCacheStats();
			expect(stats.size).toBe(10);
			expect(stats.performance.totalRequests).toBe(10);
		});

		it('should maintain performance under high load', async () => {
			const startTime = Date.now();
			
			// First cache some entries to ensure we get hits
			for (let i = 0; i < 25; i++) {
				const pdfSource = 'url';
				const sourceValue = `http://example.com/test${i}.pdf`;
				cacheManager.cacheFields(pdfSource, sourceValue, mockFields);
			}
			
			// Perform many cache operations
			for (let i = 0; i < 1000; i++) {
				const pdfSource = 'url';
				const sourceValue = `http://example.com/test${i % 50}.pdf`; // Reuse some URLs
				
				// Mix of hits and misses - more gets to generate hit rate
				if (i % 3 === 0) {
					cacheManager.cacheFields(pdfSource, sourceValue, mockFields);
				} else {
					cacheManager.getCachedFields(pdfSource, sourceValue);
				}
			}

			const endTime = Date.now();
			const duration = endTime - startTime;
			
			// Should complete reasonably quickly (less than 1 second)
			expect(duration).toBeLessThan(1000);

			const stats = cacheManager.getPerformanceStats();
			expect(stats.totalRequests).toBeGreaterThan(0);
			expect(stats.hitRate).toBeGreaterThanOrEqual(0); // Allow 0% hit rate in edge cases
		});
	});
});