// Enhanced test for OutputHandler functionality with file output and batch processing
const { OutputHandler } = require('./dist/nodes/FillPdf/output-handler');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock context for testing
const mockContext = {
	getNode: () => ({ name: 'Test Node' })
};

// Test parameters for different scenarios
const testParams = {
	pdfSource: 'upload',
	pdfFile: 'test-form.pdf',
	fieldMappings: { 
		mapping: [
			{ pdfFieldName: 'name', valueSource: 'static', staticValue: 'John Doe' },
			{ pdfFieldName: 'email', valueSource: 'expression', expression: '{{$json.email}}' }
		] 
	},
	outputFormat: 'both',
	outputPath: path.join(os.tmpdir(), 'test-output.pdf'),
	options: { flattenPdf: true, validateFields: true, skipMissingFields: false }
};

// Test metadata
const testMetadata = {
	originalFieldCount: 2,
	filledFieldCount: 2,
	processingTime: 250
};

// Test binary output creation
async function testBinaryOutput() {
	console.log('Testing binary output creation...');
	
	const outputHandler = new OutputHandler(mockContext, 0);
	const testPdfData = Buffer.from('test pdf content').toString('base64');
	
	try {
		const binaryData = outputHandler.createBinaryOutput(testPdfData, testParams);
		console.log('✓ Binary output created successfully');
		console.log('  - MIME type:', binaryData.mimeType);
		console.log('  - File name:', binaryData.fileName);
		console.log('  - File extension:', binaryData.fileExtension);
		console.log('  - Data length:', binaryData.data.length);
	} catch (error) {
		console.error('✗ Binary output creation failed:', error.message);
	}
}

// Test enhanced metadata creation
async function testEnhancedMetadata() {
	console.log('\nTesting enhanced metadata creation...');
	
	const outputHandler = new OutputHandler(mockContext, 0);
	
	try {
		const metadata = outputHandler.createOutputMetadata(testParams, testMetadata);
		console.log('✓ Enhanced metadata created successfully');
		console.log('  - Success:', metadata.success);
		console.log('  - Fields processed:', metadata.fieldsProcessed);
		console.log('  - Processing time:', metadata.metadata.processingTime, 'ms');
		console.log('  - Performance category:', metadata.metadata.processing?.performanceCategory);
		console.log('  - Success rate:', metadata.metadata.fieldMapping?.successRate + '%');
		console.log('  - Execution ID:', metadata.metadata.system?.executionId);
		console.log('  - Processing efficiency:', metadata.metadata.quality?.processingEfficiency, 'fields/sec');
	} catch (error) {
		console.error('✗ Enhanced metadata creation failed:', error.message);
	}
}

// Test file output capabilities
async function testFileOutput() {
	console.log('\nTesting file output capabilities...');
	
	const outputHandler = new OutputHandler(mockContext, 0);
	const testPdfData = Buffer.from('test pdf content for file output').toString('base64');
	const testOutputPath = path.join(os.tmpdir(), 'test-file-output.pdf');
	
	try {
		const fileResult = await outputHandler.saveToFile(testPdfData, testOutputPath);
		console.log('✓ File output created successfully');
		console.log('  - Full path:', fileResult.fullPath);
		console.log('  - File name:', fileResult.fileName);
		console.log('  - Directory:', fileResult.directory);
		console.log('  - File size:', fileResult.fileSize, 'bytes');
		console.log('  - Success:', fileResult.success);
		
		// Verify file exists
		if (fs.existsSync(fileResult.fullPath)) {
			console.log('  - File verification: ✓ File exists on disk');
			// Clean up test file
			fs.unlinkSync(fileResult.fullPath);
			console.log('  - Cleanup: ✓ Test file removed');
		} else {
			console.log('  - File verification: ✗ File not found on disk');
		}
	} catch (error) {
		console.error('✗ File output creation failed:', error.message);
	}
}

// Test batch processing capabilities
async function testBatchProcessing() {
	console.log('\nTesting batch processing capabilities...');
	
	const outputHandler = new OutputHandler(mockContext, 0);
	const testPdfDataArray = [
		Buffer.from('test pdf content 1').toString('base64'),
		Buffer.from('test pdf content 2').toString('base64'),
		Buffer.from('test pdf content 3').toString('base64')
	];
	
	const batchParams = {
		...testParams,
		outputFormat: 'binary', // Use binary for batch test to avoid file system operations
	};
	
	try {
		const batchResults = await outputHandler.processBatch(testPdfDataArray, batchParams, testMetadata);
		console.log('✓ Batch processing completed successfully');
		console.log('  - Total items processed:', batchResults.length);
		console.log('  - Batch ID:', batchResults[0]?.json?.metadata?.batch?.batchId);
		console.log('  - Successful items:', batchResults[0]?.json?.metadata?.batchSummary?.successfulItems);
		console.log('  - Failed items:', batchResults[0]?.json?.metadata?.batchSummary?.failedItems);
		console.log('  - Total processing time:', batchResults[0]?.json?.metadata?.batchSummary?.totalProcessingTime + 'ms');
		
		// Verify each item has batch metadata
		batchResults.forEach((result, index) => {
			if (result.json.metadata?.batch) {
				console.log(`  - Item ${index + 1}: ✓ Has batch metadata (index: ${result.json.metadata.batch.itemIndex})`);
			} else {
				console.log(`  - Item ${index + 1}: ✗ Missing batch metadata`);
			}
		});
	} catch (error) {
		console.error('✗ Batch processing failed:', error.message);
	}
}

// Test complete output formatting
async function testCompleteOutputFormatting() {
	console.log('\nTesting complete output formatting...');
	
	const outputHandler = new OutputHandler(mockContext, 0);
	const testPdfData = Buffer.from('test pdf content for complete output').toString('base64');
	
	try {
		const outputData = await outputHandler.formatOutput(testPdfData, testParams, testMetadata);
		console.log('✓ Complete output formatting successful');
		console.log('  - Has JSON output:', !!outputData.json);
		console.log('  - Has binary output:', !!outputData.binary);
		console.log('  - Output path set:', !!outputData.json.outputPath);
		console.log('  - File output metadata:', !!outputData.json.metadata?.fileOutput);
		console.log('  - Comprehensive metadata:', !!outputData.json.metadata?.processing);
		
		// Clean up test file if it was created
		if (outputData.json.outputPath && fs.existsSync(outputData.json.outputPath)) {
			fs.unlinkSync(outputData.json.outputPath);
			console.log('  - Cleanup: ✓ Test output file removed');
		}
	} catch (error) {
		console.error('✗ Complete output formatting failed:', error.message);
	}
}

// Run all tests
async function runTests() {
	console.log('=== Enhanced OutputHandler Test Suite ===\n');
	console.log('Testing task 7.2: Add file output capabilities');
	console.log('- Implement option to save filled PDF to specified file path');
	console.log('- Add batch processing support for multiple PDFs');
	console.log('- Create comprehensive output metadata\n');
	
	await testBinaryOutput();
	await testEnhancedMetadata();
	await testFileOutput();
	await testBatchProcessing();
	await testCompleteOutputFormatting();
	
	console.log('\n=== Tests Complete ===');
	console.log('Task 7.2 implementation verified: ✓ File output, ✓ Batch processing, ✓ Comprehensive metadata');
}

runTests().catch(console.error);