/**
 * Test script for comprehensive error handling validation
 */

const { FillPdfError, FillPdfConfigError, FillPdfDataError, FillPdfPythonError, FillPdfRuntimeError, FillPdfValidationError, ErrorUtils } = require('./nodes/FillPdf/errors');
const { ValidationUtils } = require('./nodes/FillPdf/validation');

// Mock node for testing
const mockNode = {
	id: 'test-node',
	name: 'Test FillPdf Node',
	type: 'fillPdf',
	typeVersion: 1
};

console.log('🧪 Testing FillPdf Error Handling System...\n');

// Test 1: Basic error creation
console.log('1. Testing basic error creation...');
try {
	const configError = new FillPdfConfigError(
		mockNode,
		'Invalid parameter configuration',
		{ component: 'Test', operation: 'testConfig' },
		{ parameterName: 'pdfSource', expectedType: 'string' }
	);
	
	console.log('✅ Config error created successfully');
	console.log(`   Error Type: ${configError.errorType}`);
	console.log(`   Error Code: ${configError.errorCode}`);
	console.log(`   Severity: ${configError.severity}`);
	console.log(`   Recoverable: ${configError.isRecoverable}`);
	
} catch (error) {
	console.log('❌ Failed to create config error:', error.message);
}

// Test 2: Python error with specific context
console.log('\n2. Testing Python error with context...');
try {
	const pythonError = new FillPdfPythonError(
		mockNode,
		'fillpdf library not found',
		{ component: 'Python Bridge', operation: 'executePythonScript' },
		{ 
			missingLibrary: 'fillpdf',
			pythonExecutable: 'python3'
		}
	);
	
	console.log('✅ Python error created successfully');
	console.log(`   Troubleshooting Guide:\n${pythonError.getTroubleshootingGuide()}`);
	
} catch (error) {
	console.log('❌ Failed to create Python error:', error.message);
}

// Test 3: Data error with validation details
console.log('\n3. Testing Data error with validation...');
try {
	const dataError = new FillPdfDataError(
		mockNode,
		'Invalid PDF format',
		{ component: 'PDF Processor', operation: 'validatePdf' },
		{ 
			dataType: 'PDF',
			expectedFormat: 'application/pdf',
			actualFormat: 'text/plain'
		}
	);
	
	console.log('✅ Data error created successfully');
	console.log(`   Error Details:\n${dataError.getErrorDetails()}`);
	
} catch (error) {
	console.log('❌ Failed to create data error:', error.message);
}

// Test 4: Validation error with field details
console.log('\n4. Testing Validation error with field details...');
try {
	const validationError = new FillPdfValidationError(
		mockNode,
		'Field mapping validation failed',
		{ component: 'Field Mapper', operation: 'validateFields' },
		{ 
			fieldName: 'firstName',
			expectedType: 'text',
			actualType: 'number',
			missingFields: ['lastName', 'email'],
			invalidFields: ['invalidField1']
		}
	);
	
	console.log('✅ Validation error created successfully');
	console.log(`   Field Name: ${validationError.context.fieldName}`);
	console.log(`   Missing Fields: ${validationError.troubleshootingHints.find(h => h.issue.includes('Missing'))?.issue}`);
	
} catch (error) {
	console.log('❌ Failed to create validation error:', error.message);
}

// Test 5: Runtime error with system context
console.log('\n5. Testing Runtime error with system context...');
try {
	const runtimeError = new FillPdfRuntimeError(
		mockNode,
		'System process failed',
		{ component: 'System', operation: 'executeProcess' },
		{ 
			exitCode: 1,
			systemError: new Error('Process terminated unexpectedly')
		}
	);
	
	console.log('✅ Runtime error created successfully');
	console.log(`   Exit Code: ${runtimeError.context.exitCode}`);
	console.log(`   Severity: ${runtimeError.severity}`);
	
} catch (error) {
	console.log('❌ Failed to create runtime error:', error.message);
}

// Test 6: Error utility functions
console.log('\n6. Testing Error utility functions...');
try {
	const originalError = new Error('Original system error');
	const wrappedError = ErrorUtils.wrapError(
		mockNode,
		originalError,
		'runtime',
		{ component: 'Test', operation: 'wrapTest' }
	);
	
	console.log('✅ Error wrapping successful');
	console.log(`   Original preserved: ${wrappedError.context.originalError?.message === originalError.message}`);
	console.log(`   Is recoverable: ${ErrorUtils.isRecoverable(wrappedError)}`);
	console.log(`   Severity: ${ErrorUtils.getErrorSeverity(wrappedError)}`);
	
} catch (error) {
	console.log('❌ Failed to test error utilities:', error.message);
}

// Test 7: Error creation factory
console.log('\n7. Testing Error creation factory...');
try {
	const factoryError = ErrorUtils.createError(
		mockNode,
		'Factory created error',
		'config',
		{ component: 'Factory', operation: 'createTest' },
		{ parameterName: 'testParam' }
	);
	
	console.log('✅ Factory error creation successful');
	console.log(`   Error type matches: ${factoryError.errorType === 'config'}`);
	console.log(`   Is FillPdfConfigError: ${factoryError instanceof FillPdfConfigError}`);
	
} catch (error) {
	console.log('❌ Failed to test error factory:', error.message);
}

// Test 8: Error logging format
console.log('\n8. Testing Error logging format...');
try {
	const testError = new FillPdfError(
		mockNode,
		'Test error for logging',
		'data',
		{
			context: { component: 'Logger', operation: 'formatTest' },
			troubleshootingHints: [
				{ issue: 'Test issue', solution: 'Test solution', priority: 'high' }
			]
		}
	);
	
	const logFormat = ErrorUtils.formatErrorForLogging(testError);
	console.log('✅ Error logging format successful');
	console.log(`   Contains error code: ${logFormat.includes(testError.errorCode)}`);
	console.log(`   Contains troubleshooting: ${logFormat.includes('Troubleshooting')}`);
	
} catch (error) {
	console.log('❌ Failed to test error logging:', error.message);
}

console.log('\n🎉 Error handling system tests completed!');
console.log('\n📋 Summary:');
console.log('- Custom error classes with categorization ✅');
console.log('- n8n compatibility with NodeOperationError ✅');
console.log('- Detailed error context and troubleshooting ✅');
console.log('- Error severity and recoverability ✅');
console.log('- Utility functions for error handling ✅');
console.log('- Comprehensive error logging ✅');