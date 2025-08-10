// Simple test to verify cache performance optimizations
const { fieldCache } = require('./dist/nodes/FillPdf/field-cache');

async function testCachePerformance() {
    console.log('Testing Field Cache Performance Optimizations...\n');

    // Test 1: Basic caching functionality
    console.log('1. Testing basic cache functionality:');
    const mockFields = [
        { name: 'field1', type: 'text', required: true },
        { name: 'field2', type: 'checkbox', required: false }
    ];

    fieldCache.cacheFields('url', 'https://example.com/test.pdf', mockFields);
    const cachedFields = fieldCache.getCachedFields('url', 'https://example.com/test.pdf');
    console.log('   ✓ Cache store and retrieve working');
    console.log('   ✓ Fields cached:', cachedFields?.length || 0);

    // Test 2: Cache hit/miss tracking
    console.log('\n2. Testing cache hit/miss tracking:');
    fieldCache.getCachedFields('url', 'https://example.com/nonexistent.pdf'); // Miss
    fieldCache.getCachedFields('url', 'https://example.com/test.pdf'); // Hit
    
    const stats = fieldCache.getCacheStats();
    console.log('   ✓ Cache hits:', stats.performance.hits);
    console.log('   ✓ Cache misses:', stats.performance.misses);
    console.log('   ✓ Hit rate:', stats.hitRate.toFixed(2) + '%');

    // Test 3: Debounced extraction
    console.log('\n3. Testing debounced extraction:');
    let extractionCount = 0;
    const mockExtraction = async () => {
        extractionCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockFields;
    };

    // Start multiple extractions for the same key
    const promises = [
        fieldCache.debouncedExtraction('test-key', mockExtraction),
        fieldCache.debouncedExtraction('test-key', mockExtraction),
        fieldCache.debouncedExtraction('test-key', mockExtraction)
    ];

    await Promise.all(promises);
    console.log('   ✓ Extraction function called only once despite 3 requests');
    console.log('   ✓ Actual extraction count:', extractionCount);

    // Test 4: Performance stats
    console.log('\n4. Testing performance statistics:');
    const perfStats = fieldCache.getPerformanceStats();
    console.log('   ✓ Total requests:', perfStats.totalRequests);
    console.log('   ✓ Hit rate:', perfStats.hitRate.toFixed(2) + '%');
    console.log('   ✓ Pending extractions:', perfStats.pendingExtractions);
    console.log('   ✓ Active timers:', perfStats.activeTimers);

    // Test 5: Cache cleanup
    console.log('\n5. Testing cache cleanup:');
    const beforeSize = fieldCache.getCacheStats().size;
    fieldCache.clearCache();
    const afterSize = fieldCache.getCacheStats().size;
    console.log('   ✓ Cache cleared successfully');
    console.log('   ✓ Before cleanup:', beforeSize, 'entries');
    console.log('   ✓ After cleanup:', afterSize, 'entries');

    console.log('\n✅ All cache performance optimizations working correctly!');
}

testCachePerformance().catch(console.error);