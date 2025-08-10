# Design Document

## Overview

This design transforms the n8n Fill PDF node from a manual field mapping approach to an automatic field extraction and dynamic UI generation system. The node will automatically detect PDF form fields and present them as native n8n input controls, providing an intuitive user experience similar to other n8n nodes.

## Architecture

### High-Level Flow
```
PDF Source Selection → Field Extraction → Dynamic UI Generation → Field Value Input → PDF Processing
```

### Core Components

1. **Dynamic Field Extractor** - Extracts fields from PDF and triggers UI updates
2. **UI Generator** - Creates dynamic n8n property definitions based on extracted fields  
3. **Field Cache Manager** - Caches extracted fields to avoid repeated extraction
4. **Value Processor** - Handles field value processing with expressions and static values
5. **PDF Processor** - Fills PDF with processed field values

## Components and Interfaces

### 1. Dynamic Field Extractor

**Purpose**: Extract PDF fields and trigger dynamic UI updates

**Key Methods**:
```typescript
interface IDynamicFieldExtractor {
  extractFields(pdfSource: string, sourceValue: string): Promise<IExtractedField[]>
  triggerUIUpdate(fields: IExtractedField[]): Promise<void>
  validateFieldAccess(pdfSource: string, sourceValue: string): Promise<boolean>
}
```

**Implementation Strategy**:
- Extends existing `FieldInspector` class
- **CRITICAL FIX**: Properly handle upload PDF source in loadOptions context
- Implements field extraction during workflow execution for upload/binary sources
- Adds UI update triggering capabilities for URL sources only
- Implements field caching for performance
- Provides clear error messages for unsupported extraction contexts

### 2. UI Generator

**Purpose**: Generate dynamic n8n property definitions from extracted PDF fields

**Key Methods**:
```typescript
interface IUIGenerator {
  generateFieldProperties(fields: IExtractedField[]): INodePropertyOptions[]
  createFieldInput(field: IExtractedField): INodeProperty
  updateNodeDescription(fields: IExtractedField[]): INodeTypeDescription
}
```

**Field Type Mapping**:
- Text fields → `type: 'string'` with placeholder
- Checkboxes → `type: 'boolean'` with default false
- Dropdowns → `type: 'options'` with extracted options
- Radio buttons → `type: 'options'` with single selection
- Required fields → `required: true` property

### 3. Field Cache Manager

**Purpose**: Cache extracted fields to improve performance and user experience

**Key Methods**:
```typescript
interface IFieldCacheManager {
  cacheFields(pdfSource: string, sourceValue: string, fields: IExtractedField[]): void
  getCachedFields(pdfSource: string, sourceValue: string): IExtractedField[] | null
  clearCache(pdfSource?: string): void
  isCacheValid(pdfSource: string, sourceValue: string): boolean
}
```

**Caching Strategy**:
- Cache key: `${pdfSource}:${hash(sourceValue)}`
- TTL: 5 minutes for URL sources, session-based for uploads
- Automatic invalidation on PDF source changes

### 4. Enhanced Node Properties Structure

**New Property Structure**:
```typescript
// Static properties (always present)
{
  displayName: 'PDF Source',
  name: 'pdfSource',
  type: 'options',
  // ... existing configuration
}

// Dynamic section (generated based on extracted fields)
{
  displayName: 'PDF Fields',
  name: 'pdfFields',
  type: 'collection',
  placeholder: 'PDF fields will appear here after extraction',
  options: [], // Populated dynamically
  displayOptions: {
    show: {
      pdfSource: ['upload', 'url', 'binary']
    }
  }
}

// Fallback manual configuration
{
  displayName: 'Manual Field Configuration',
  name: 'manualFields',
  type: 'fixedCollection',
  displayOptions: {
    show: {
      useManualFields: [true]
    }
  }
  // ... existing field mapping structure
}
```

## Data Models

### Extracted Field Model
```typescript
interface IExtractedField {
  name: string;                    // PDF field name
  type: 'text' | 'checkbox' | 'dropdown' | 'radio';
  required: boolean;               // Whether field is required
  defaultValue?: string | boolean; // Default value from PDF
  options?: string[];              // For dropdown/radio fields
  maxLength?: number;              // For text fields
  validation?: IFieldValidation;   // Field validation rules
  description?: string;            // Field description/tooltip
}

interface IFieldValidation {
  pattern?: string;                // Regex pattern
  minLength?: number;              // Minimum length
  maxLength?: number;              // Maximum length
  customMessage?: string;          // Custom validation message
}
```

### Dynamic Property Model
```typescript
interface IDynamicProperty extends INodeProperty {
  sourceField: IExtractedField;    // Reference to source PDF field
  generatedAt: number;             // Timestamp of generation
  cacheKey: string;                // Cache key for invalidation
}
```

## Error Handling

### Field Extraction Errors
- **PDF Access Failure**: Show error message, enable manual mode
- **No Fields Found**: Display info message, offer manual configuration
- **Extraction Timeout**: Show timeout message, cache partial results
- **Invalid PDF**: Clear error message with troubleshooting steps

### UI Generation Errors
- **Property Generation Failure**: Fall back to manual configuration
- **Field Type Mapping Error**: Default to text field with warning
- **Validation Rule Error**: Skip validation, log warning

### Runtime Errors
- **Field Value Processing Error**: Show field-specific error
- **PDF Filling Error**: Provide detailed error with field context
- **Cache Corruption**: Clear cache, re-extract fields

## Testing Strategy

### Unit Tests
1. **Field Extraction Tests**
   - Test extraction from different PDF sources
   - Validate field type detection accuracy
   - Test error handling for invalid PDFs

2. **UI Generation Tests**
   - Test property generation for all field types
   - Validate required field handling
   - Test dropdown option extraction

3. **Cache Management Tests**
   - Test cache hit/miss scenarios
   - Validate cache invalidation logic
   - Test concurrent access handling

### Integration Tests
1. **End-to-End Field Extraction**
   - Upload PDF → Extract fields → Generate UI → Fill PDF
   - Test with various PDF types and complexities
   - Validate field value processing

2. **Performance Tests**
   - Large PDF handling (50MB limit)
   - Multiple concurrent extractions
   - Cache performance under load

3. **Error Scenario Tests**
   - Network failures for URL sources
   - Corrupted PDF files
   - Missing binary data

## Implementation Phases

### Phase 1: Core Field Extraction Enhancement
- Enhance `FieldInspector` with UI update capabilities
- Implement field caching mechanism
- Add comprehensive error handling

### Phase 2: Dynamic UI Generation
- Create `UIGenerator` component
- Implement dynamic property generation
- Add field type mapping logic

### Phase 3: Node Integration
- Integrate dynamic properties into node description
- Implement property update mechanisms
- Add fallback manual configuration

### Phase 4: User Experience Enhancements
- Add loading indicators during extraction
- Implement field validation feedback
- Add field description tooltips

## Technical Considerations

### Critical Upload PDF Fix
- **Root Cause**: `loadOptions` method cannot access uploaded files in n8n
- **Solution**: Extract fields during workflow execution, not in UI configuration
- **User Experience**: Show helpful messages in UI, extract fields at runtime
- **Logging**: Display extracted fields in workflow execution logs

### Performance Optimizations
- **Lazy Loading**: Extract fields only when needed
- **Debounced Extraction**: Avoid repeated extractions during typing (URL only)
- **Runtime Extraction**: Extract fields during execution for upload/binary sources
- **Background Processing**: Extract fields asynchronously where possible

### Memory Management
- **Field Cache Limits**: Maximum 100 cached field sets (URL sources only)
- **Automatic Cleanup**: Clear old cache entries
- **Runtime Memory**: Efficient field extraction during execution

### Security Considerations
- **PDF Validation**: Validate PDF structure before processing
- **Size Limits**: Enforce 50MB PDF size limit
- **Timeout Protection**: 30-second extraction timeout
- **Input Sanitization**: Sanitize field names and values

## User Experience Flow

### Successful Field Extraction Flow

**For URL Sources:**
1. User selects PDF source as "URL" and enters URL
2. System shows "Extracting fields..." indicator
3. Fields are extracted and cached
4. UI updates with dynamic field inputs
5. User fills field values using expressions or static values
6. Workflow executes and fills PDF

**For Upload/Binary Sources:**
1. User selects PDF source (upload/binary)
2. UI shows helpful message: "Fields will be extracted when workflow runs"
3. User configures basic settings and field values using JSON or manual mapping
4. Workflow executes, extracts fields, and displays them in logs
5. PDF is filled with provided values

### Error Recovery Flow
1. Field extraction fails
2. System shows error message with cause
3. "Switch to Manual Mode" option appears
4. User can configure fields manually
5. System validates manual fields during execution

### Performance Optimization Flow
1. User changes PDF source
2. System checks cache for existing fields
3. If cached, immediately show fields
4. If not cached, show loading and extract
5. Cache results for future use

## Migration Strategy

### Backward Compatibility
- Existing workflows continue to work unchanged
- Manual field mapping remains available as fallback
- Gradual migration path for existing users

### Configuration Migration
- Detect existing manual configurations
- Offer to convert to dynamic mode
- Preserve existing field mappings during conversion

This design provides a comprehensive foundation for transforming the Fill PDF node into an intuitive, dynamic field extraction system that significantly improves the user experience while maintaining backward compatibility and robust error handling.