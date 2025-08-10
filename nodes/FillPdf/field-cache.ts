import { IFieldInfo } from './types';
import * as crypto from 'crypto';

/**
 * Cache entry for PDF field extraction results
 */
interface ICacheEntry {
	fields: IFieldInfo[];
	timestamp: number;
	sourceHash: string;
	ttl: number;
}

/**
 * Cache statistics for performance monitoring
 */
export interface ICacheStats {
	hits: number;
	misses: number;
	totalRequests: number;
	hitRate: number;
}

/**
 * Debounce configuration for field extraction
 */
interface IDebounceConfig {
	delay: number;
	maxWait: number;
}

/**
 * Field cache manager for URL-based PDF field extraction
 * Improves performance by caching field extraction results
 */
export class FieldCacheManager {
	private cache = new Map<string, ICacheEntry>();
	private readonly maxCacheSize = 100;
	private readonly defaultTtl = 5 * 60 * 1000; // 5 minutes in milliseconds

	// Performance tracking
	private stats: ICacheStats = {
		hits: 0,
		misses: 0,
		totalRequests: 0,
		hitRate: 0,
	};

	// Debounce tracking
	private debounceTimers = new Map<string, NodeJS.Timeout>();
	private pendingExtractions = new Map<string, Promise<IFieldInfo[]>>();
	private readonly debounceConfig: IDebounceConfig = {
		delay: 300, // 300ms delay
		maxWait: 2000, // Maximum 2 seconds wait
	};

	/**
	 * Generate cache key from PDF source and value
	 */
	private generateCacheKey(pdfSource: string, sourceValue: string): string {
		const hash = crypto.createHash('sha256').update(sourceValue).digest('hex').substring(0, 16);
		return `${pdfSource}:${hash}`;
	}

	/**
	 * Generate hash for source value to detect changes
	 */
	private generateSourceHash(sourceValue: string): string {
		return crypto.createHash('sha256').update(sourceValue).digest('hex');
	}

	/**
	 * Cache extracted fields for a PDF source with performance logging
	 */
	cacheFields(
		pdfSource: string,
		sourceValue: string,
		fields: IFieldInfo[],
		customTtl?: number,
	): void {
		try {
			// Clean up cache if it's getting too large
			if (this.cache.size >= this.maxCacheSize) {
				const beforeSize = this.cache.size;
				this.cleanupOldEntries();
				const afterSize = this.cache.size;
				this.logCacheEvent('evict', 'cleanup', `Cleaned ${beforeSize - afterSize} entries`);
			}

			const cacheKey = this.generateCacheKey(pdfSource, sourceValue);
			const sourceHash = this.generateSourceHash(sourceValue);
			const ttl = customTtl || this.defaultTtl;

			const entry: ICacheEntry = {
				fields: [...fields], // Create a copy to avoid mutations
				timestamp: Date.now(),
				sourceHash,
				ttl,
			};

			this.cache.set(cacheKey, entry);
			this.logCacheEvent('store', cacheKey, `${fields.length} fields, TTL: ${ttl}ms`);
		} catch (error) {
			// Log error but don't throw - caching is optional
			console.warn('Failed to cache PDF fields:', error);
		}
	}

	/**
	 * Get cached fields for a PDF source with hit/miss tracking
	 */
	getCachedFields(pdfSource: string, sourceValue: string): IFieldInfo[] | null {
		try {
			this.stats.totalRequests++;

			const cacheKey = this.generateCacheKey(pdfSource, sourceValue);
			const entry = this.cache.get(cacheKey);

			if (!entry) {
				this.stats.misses++;
				this.updateHitRate();
				this.logCacheEvent('miss', cacheKey, 'Entry not found');
				return null;
			}

			// Check if entry has expired
			if (Date.now() - entry.timestamp > entry.ttl) {
				this.cache.delete(cacheKey);
				this.stats.misses++;
				this.updateHitRate();
				this.logCacheEvent('miss', cacheKey, 'Entry expired');
				return null;
			}

			// Check if source has changed
			const currentSourceHash = this.generateSourceHash(sourceValue);
			if (entry.sourceHash !== currentSourceHash) {
				this.cache.delete(cacheKey);
				this.stats.misses++;
				this.updateHitRate();
				this.logCacheEvent('miss', cacheKey, 'Source changed');
				return null;
			}

			// Cache hit
			this.stats.hits++;
			this.updateHitRate();
			this.logCacheEvent('hit', cacheKey, `${entry.fields.length} fields`);

			// Return a copy to avoid mutations
			return [...entry.fields];
		} catch (error) {
			// Log error but don't throw - return null to trigger fresh extraction
			console.warn('Failed to retrieve cached PDF fields:', error);
			this.stats.misses++;
			this.updateHitRate();
			return null;
		}
	}

	/**
	 * Check if cache entry is valid for given source
	 */
	isCacheValid(pdfSource: string, sourceValue: string): boolean {
		try {
			const cacheKey = this.generateCacheKey(pdfSource, sourceValue);
			const entry = this.cache.get(cacheKey);

			if (!entry) {
				return false;
			}

			// Check expiration
			if (Date.now() - entry.timestamp > entry.ttl) {
				return false;
			}

			// Check source hash
			const currentSourceHash = this.generateSourceHash(sourceValue);
			return entry.sourceHash === currentSourceHash;
		} catch (error) {
			console.warn('Failed to validate cache entry:', error);
			return false;
		}
	}

	/**
	 * Clear cache entries for specific PDF source or all entries
	 */
	clearCache(pdfSource?: string): void {
		try {
			if (!pdfSource) {
				// Clear all cache entries and cleanup debounce timers
				this.cache.clear();
				this.cleanup();
				this.logCacheEvent('evict', 'all', 'Full cache clear');
				return;
			}

			// Clear entries for specific PDF source
			const keysToDelete: string[] = [];
			for (const [key] of this.cache) {
				if (key.startsWith(`${pdfSource}:`)) {
					keysToDelete.push(key);
				}
			}

			keysToDelete.forEach((key) => {
				this.cache.delete(key);
				this.cancelDebouncedExtraction(key);
			});

			this.logCacheEvent('evict', pdfSource, `${keysToDelete.length} entries`);
		} catch (error) {
			console.warn('Failed to clear cache:', error);
		}
	}

	/**
	 * Clean up old cache entries to maintain size limit
	 */
	private cleanupOldEntries(): void {
		try {
			const now = Date.now();
			const entriesToDelete: string[] = [];

			// First, remove expired entries
			for (const [key, entry] of this.cache) {
				if (now - entry.timestamp > entry.ttl) {
					entriesToDelete.push(key);
				}
			}

			// Delete expired entries
			entriesToDelete.forEach((key) => this.cache.delete(key));

			// If still too large, remove oldest entries
			if (this.cache.size >= this.maxCacheSize) {
				const entries = Array.from(this.cache.entries());
				entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

				const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2)); // Remove 20%
				toRemove.forEach(([key]) => this.cache.delete(key));
			}
		} catch (error) {
			console.warn('Failed to cleanup cache entries:', error);
		}
	}

	/**
	 * Get comprehensive cache statistics for debugging
	 */
	getCacheStats(): {
		size: number;
		maxSize: number;
		hitRate: number;
		performance: ICacheStats;
		debounce: {
			pendingExtractions: number;
			activeTimers: number;
		};
		entries: Array<{
			key: string;
			fieldCount: number;
			age: number;
			ttl: number;
			expired: boolean;
		}>;
	} {
		try {
			const now = Date.now();
			const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
				key: `${key.substring(0, 20)}...`, // Truncate for readability
				fieldCount: entry.fields.length,
				age: now - entry.timestamp,
				ttl: entry.ttl,
				expired: now - entry.timestamp > entry.ttl,
			}));

			return {
				size: this.cache.size,
				maxSize: this.maxCacheSize,
				hitRate: this.stats.hitRate,
				performance: { ...this.stats },
				debounce: {
					pendingExtractions: this.pendingExtractions.size,
					activeTimers: this.debounceTimers.size,
				},
				entries,
			};
		} catch (error) {
			console.warn('Failed to get cache stats:', error);
			return {
				size: 0,
				maxSize: this.maxCacheSize,
				hitRate: 0,
				performance: { hits: 0, misses: 0, totalRequests: 0, hitRate: 0 },
				debounce: { pendingExtractions: 0, activeTimers: 0 },
				entries: [],
			};
		}
	}

	/**
	 * Debounced field extraction to avoid repeated calls
	 * Returns a promise that resolves when extraction is complete
	 */
	async debouncedExtraction<T>(
		key: string,
		extractionFn: () => Promise<T>,
		customDelay?: number,
	): Promise<T> {
		const delay = customDelay || this.debounceConfig.delay;

		// Check if there's already a pending extraction for this key
		const existingPromise = this.pendingExtractions.get(key);
		if (existingPromise) {
			return existingPromise as Promise<T>;
		}

		// Clear any existing timer for this key
		const existingTimer = this.debounceTimers.get(key);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Create a new promise for this extraction
		const extractionPromise = new Promise<T>((resolve, reject) => {
			const timer = setTimeout(async () => {
				try {
					this.debounceTimers.delete(key);
					this.pendingExtractions.delete(key);

					const result = await extractionFn();
					resolve(result);
				} catch (error) {
					this.pendingExtractions.delete(key);
					reject(error);
				}
			}, delay);

			this.debounceTimers.set(key, timer);
		});

		this.pendingExtractions.set(key, extractionPromise as Promise<IFieldInfo[]>);
		return extractionPromise;
	}

	/**
	 * Cancel pending debounced extraction
	 */
	cancelDebouncedExtraction(key: string): void {
		const timer = this.debounceTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(key);
		}
		this.pendingExtractions.delete(key);
	}

	/**
	 * Update hit rate calculation
	 */
	private updateHitRate(): void {
		if (this.stats.totalRequests > 0) {
			this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;
		}
	}

	/**
	 * Log cache events for debugging
	 */
	private logCacheEvent(
		type: 'hit' | 'miss' | 'store' | 'evict',
		key: string,
		details: string,
	): void {
		const timestamp = new Date().toISOString();
		const truncatedKey = key.length > 20 ? `${key.substring(0, 20)}...` : key;

		// Only log in development or when debug logging is enabled
		if (process.env.NODE_ENV === 'development' || process.env.FILL_PDF_DEBUG === 'true') {
			console.debug(
				`[FieldCache] ${timestamp} ${type.toUpperCase()}: ${truncatedKey} - ${details}`,
			);
		}
	}

	/**
	 * Set custom TTL for specific PDF source types
	 */
	setCustomTtl(_pdfSource: string, _ttl: number): void {
		// This could be extended to store per-source TTL settings
		// For now, TTL is set per cache entry
	}

	/**
	 * Get performance statistics
	 */
	getPerformanceStats(): ICacheStats & {
		pendingExtractions: number;
		activeTimers: number;
		averageFieldsPerEntry: number;
	} {
		const totalFields = Array.from(this.cache.values()).reduce(
			(sum, entry) => sum + entry.fields.length,
			0,
		);
		const averageFieldsPerEntry = this.cache.size > 0 ? totalFields / this.cache.size : 0;

		return {
			...this.stats,
			pendingExtractions: this.pendingExtractions.size,
			activeTimers: this.debounceTimers.size,
			averageFieldsPerEntry: Math.round(averageFieldsPerEntry * 100) / 100,
		};
	}

	/**
	 * Reset performance statistics
	 */
	resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			totalRequests: 0,
			hitRate: 0,
		};
	}

	/**
	 * Cleanup method to clear all timers and pending extractions
	 */
	cleanup(): void {
		// Clear all debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.pendingExtractions.clear();
	}
}

/**
 * Global field cache instance
 */
export const fieldCache = new FieldCacheManager();
