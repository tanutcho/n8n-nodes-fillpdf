# PDF Field Extraction Guide

This guide explains the new dynamic field extraction features in the n8n Fill PDF node, which automatically detects fillable fields in your PDF and presents them as input fields in the node interface.

## Overview

The Fill PDF node now automatically extracts fillable fields from PDF files and dynamically generates input controls in the n8n interface. This eliminates the need for manual field mapping and provides an intuitive form-filling experience.

## How Field Extraction Works

### PDF Source Types and Behaviors

The field extraction behavior varies depending on your PDF source:

#### 1. URL Sources - Real-time Field Extraction

**When to use**: PDF templates hosted on web servers, cloud storage, or any accessible URL.

**How it works**:
- Fields are extracted immediately when you enter a valid PDF URL
- The node interface updates dynamically to show all detected fields
- Field extraction is cached for performance
- You can fill fields before running the workflow

**User Experience**:
1. Select "URL" as PDF source
2. Enter the PDF URL
3. Wait for "Extracting fields..." indicator
4. Interface updates with dynamic field inputs
5. Fill field values using expressions or static values
6. Execute workflow to generate filled PDF

**Example Configuration**:
```javascript
{
  "pdfSource": "url",
  "pdfUrl": "https://example.com/contract-template.pdf",
  // Dynamic fields appear here automatically
  "customer_name": "{{ $json.customerName }}",
  "contract_date": "{{ $now.format('YYYY-MM-DD') }}",
  "annual_salary": "{{ $json.salary }}"
}
```

#### 2. Upload Sources - Runtime Field Extraction

**When to use**: PDF templates stored locally or uploaded directly to the workflow.

**How it works**:
- Fields cannot be extracted during node configuration (n8n limitation)
- Fields are extracted during workflow execution
- Extracted fields are displayed in the workflow execution logs
- You configure field values using manual mapping or JSON input

**User Experience**:
1. Select "Upload File" as PDF source
2. Upload your PDF file
3. Interface shows helpful message: "Fields will be extracted when workflow runs"
4. Configure field values using manual field mapping or JSON input
5. Execute workflow - fields are extracted and logged
6. Review extracted fields in execution logs for reference

**Example Configuration**:
```javascript
{
  "pdfSource": "upload",
  "pdfFile": "contract-template.pdf",
  "fieldMappings": {
    "mapping": [
      {
        "pdfFieldName": "customer_name",
        "valueSource": "expression",
        "expression": "{{ $json.customerName }}"
      },
      {
        "pdfFieldName": "contract_date", 
        "valueSource": "expression",
        "expression": "{{ $now.format('YYYY-MM-DD') }}"
      }
    ]
  }
}
```

#### 3. Binary Sources - Runtime Field Extraction

**When to use**: PDF data from previous nodes (HTTP requests, file reads, etc.).

**How it works**:
- Similar to upload sources - extraction happens at runtime
- Fields are extracted from the binary PDF data during execution
- Extracted fields are logged for reference
- Use manual field mapping or JSON input for field values

**User Experience**:
1. Select "Binary Data" as PDF source
2. Configure binary data input from previous node
3. Interface shows: "Fields will be extracted when workflow runs"
4. Configure field values using manual mapping
5. Execute workflow - fields are extracted from binary data and logged

## Field Types and Interface Controls

The node automatically detects different PDF field types and creates appropriate interface controls:

### Text Fields
- **PDF Type**: Text input fields
- **Interface**: Text input with placeholder
- **Example**: Name, address, comments
- **Configuration**:
  ```javascript
  {
    "customer_name": "{{ $json.firstName }} {{ $json.lastName }}"
  }
  ```

### Checkbox Fields  
- **PDF Type**: Checkbox/boolean fields
- **Interface**: Boolean toggle switch
- **Example**: Terms accepted, opt-in preferences
- **Configuration**:
  ```javascript
  {
    "terms_accepted": "{{ $json.agreedToTerms }}"  // true/false
  }
  ```

### Dropdown Fields
- **PDF Type**: Dropdown/select lists
- **Interface**: Dropdown with extracted options
- **Example**: Country selection, product categories
- **Configuration**:
  ```javascript
  {
    "country": "{{ $json.selectedCountry }}"  // Must match dropdown option
  }
  ```

### Radio Button Fields
- **PDF Type**: Radio button groups
- **Interface**: Single-select dropdown
- **Example**: Payment method, shipping options
- **Configuration**:
  ```javascript
  {
    "payment_method": "credit_card"  // Option value from radio group
  }
  ```

## Field Extraction Examples

### Example 1: URL-based Contract Template

**Scenario**: Automatically fill employment contracts from a URL template.

**Setup**:
1. PDF URL: `https://company.com/templates/employment-contract.pdf`
2. PDF contains fields: `employee_name`, `position`, `salary`, `start_date`, `benefits_eligible`

**Configuration**:
```javascript
{
  "pdfSource": "url",
  "pdfUrl": "https://company.com/templates/employment-contract.pdf",
  // Fields extracted automatically:
  "employee_name": "{{ $json.firstName }} {{ $json.lastName }}",
  "position": "{{ $json.jobTitle }}",
  "salary": "${{ $json.annualSalary }}",
  "start_date": "{{ $json.startDate }}",
  "benefits_eligible": "{{ $json.isFullTime }}"  // boolean
}
```

**Workflow**:
```
Employee Data → Fill Contract → Email HR
```

### Example 2: Upload-based Invoice Generation

**Scenario**: Generate invoices using an uploaded PDF template.

**Setup**:
1. Upload `invoice-template.pdf` 
2. PDF contains fields: `invoice_number`, `customer_name`, `amount`, `due_date`

**Configuration**:
```javascript
{
  "pdfSource": "upload",
  "pdfFile": "invoice-template.pdf",
  "fieldMappings": {
    "mapping": [
      {
        "pdfFieldName": "invoice_number",
        "valueSource": "expression",
        "expression": "INV-{{ $json.orderId }}"
      },
      {
        "pdfFieldName": "customer_name",
        "valueSource": "expression", 
        "expression": "{{ $json.customerName }}"
      },
      {
        "pdfFieldName": "amount",
        "valueSource": "expression",
        "expression": "${{ $json.totalAmount }}"
      },
      {
        "pdfFieldName": "due_date",
        "valueSource": "expression",
        "expression": "{{ $now.plus({days: 30}).format('YYYY-MM-DD') }}"
      }
    ]
  }
}
```

**Execution Log Output**:
```
✅ PDF fields extracted successfully:
   - invoice_number (text, required)
   - customer_name (text, required)  
   - amount (text)
   - due_date (text)
   - payment_terms (dropdown: ["Net 30", "Net 60", "Due on Receipt"])
```

### Example 3: Binary Data from HTTP Request

**Scenario**: Fill PDF received from an API endpoint.

**Workflow**:
```
HTTP Request → Fill PDF → Save File
```

**HTTP Request Node**:
```javascript
{
  "url": "https://api.company.com/templates/{{ $json.templateId }}",
  "method": "GET",
  "responseFormat": "file"
}
```

**Fill PDF Node**:
```javascript
{
  "pdfSource": "binary",
  "binaryPropertyName": "data",
  "fieldMappings": {
    "mapping": [
      {
        "pdfFieldName": "client_name",
        "valueSource": "expression",
        "expression": "{{ $json.clientName }}"
      },
      {
        "pdfFieldName": "project_description",
        "valueSource": "expression",
        "expression": "{{ $json.projectDetails }}"
      }
    ]
  }
}
```

## Field Validation and Requirements

### Required Fields
- Required PDF fields are marked with red asterisk (*)
- Workflow execution fails if required fields are empty
- Clear error messages indicate which required fields are missing

### Field Type Validation
- **Text fields**: Length limits (if specified in PDF)
- **Dropdown fields**: Values must match available options
- **Checkbox fields**: Must be boolean (true/false)
- **Date fields**: Proper date format validation

### Expression Support
All field inputs support n8n expressions:
- `{{ $json.fieldName }}` - Data from previous nodes
- `{{ $now.format('YYYY-MM-DD') }}` - Current date formatting
- `{{ $json.amount * 1.08 }}` - Calculations
- `{{ $json.isVip ? 'Premium' : 'Standard' }}` - Conditional values

## Performance and Caching

### URL Source Caching
- Field extraction results are cached for 5 minutes
- Cache key based on PDF URL and content hash
- Automatic cache invalidation when URL changes
- Improves performance for repeated extractions

### Cache Management
- Cache is automatically cleared when PDF source changes
- Manual cache clearing available in debug mode
- Memory-efficient caching with size limits

### Performance Tips
- **URL sources**: Use stable URLs for better caching
- **Upload sources**: Keep PDF files under 50MB for optimal performance
- **Binary sources**: Process one PDF at a time for large datasets

## Error Handling and Recovery

### Common Error Scenarios

#### "No fillable fields found"
**Cause**: PDF doesn't contain form fields
**Solution**: 
- Verify PDF has fillable form fields (not just text)
- Use Adobe Reader to check for interactive fields
- Convert PDF to fillable form using PDF editor

#### "Field extraction failed"
**Cause**: PDF access issues, corrupted file, or network problems
**Solution**:
- Check PDF file integrity
- Verify URL accessibility (for URL sources)
- Enable manual field mapping as fallback

#### "Field 'fieldName' not found"
**Cause**: Field name mismatch between configuration and PDF
**Solution**:
- Check execution logs for exact field names
- Field names are case-sensitive
- Use field names exactly as they appear in PDF

### Fallback Options

#### Manual Field Mapping
When automatic extraction fails, you can switch to manual mode:

1. **Enable manual mode**: Toggle "Use Manual Field Mapping"
2. **Add field mappings**: Specify field names and values manually
3. **Validation**: System still validates field names during execution

#### Graceful Degradation
- Extraction failures don't break workflows
- Clear error messages with troubleshooting hints
- Automatic fallback to manual configuration
- Partial extraction results are preserved

## Migration from Manual Mapping

### Existing Workflows
- All existing workflows continue to work unchanged
- Manual field mapping remains available
- No breaking changes to current configurations

### Gradual Migration
1. **Test with URL sources first**: Easiest to see immediate benefits
2. **Review extracted fields**: Compare with existing manual mappings
3. **Update field values**: Use dynamic field inputs instead of manual mapping
4. **Validate results**: Ensure filled PDFs match expectations

### Migration Benefits
- **Reduced configuration time**: No need to guess field names
- **Better user experience**: Visual field inputs instead of text mapping
- **Automatic validation**: Field existence and type checking
- **Error prevention**: Typos in field names are eliminated

## Best Practices

### PDF Template Design
- **Use descriptive field names**: `customer_name` instead of `field1`
- **Set field requirements**: Mark required fields in PDF
- **Include field descriptions**: Add tooltips/help text in PDF
- **Test field extraction**: Verify all fields are detected correctly

### Workflow Design
- **Use URL sources when possible**: Better user experience with real-time extraction
- **Cache field extraction results**: For repeated use of same PDF templates
- **Handle errors gracefully**: Include error handling nodes
- **Log field information**: Keep execution logs for debugging

### Field Value Configuration
- **Use expressions for dynamic data**: Leverage n8n's expression system
- **Validate input data**: Ensure data types match field requirements
- **Handle missing data**: Provide default values or conditional logic
- **Format data appropriately**: Dates, numbers, currency formatting

### Performance Optimization
- **Limit PDF file sizes**: Keep under 50MB for best performance
- **Use batch processing**: For multiple PDFs, process in smaller batches
- **Monitor memory usage**: Large PDFs can consume significant memory
- **Cache frequently used templates**: URL sources benefit from caching

## Troubleshooting Field Extraction

### Debug Information
Enable debug logging to see detailed field extraction information:
```bash
export DEBUG=n8n-nodes-fillpdf:field-extraction
n8n start
```

### Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| No fields extracted | Empty field list | Check PDF has fillable form fields |
| Wrong field types | Incorrect input controls | Verify PDF field types in editor |
| Extraction timeout | Loading indicator stuck | Check PDF size and network speed |
| Cache issues | Stale field data | Clear cache or restart n8n |
| Permission errors | Cannot access PDF | Check file permissions and URL access |

### Field Inspection Tools
For troubleshooting field extraction, you can inspect PDF fields manually:

```python
# Python script to inspect PDF fields
import fillpdf

# Get all form fields
fields = fillpdf.get_form_fields('your-pdf.pdf')
print("Available fields:")
for field_name, field_info in fields.items():
    print(f"  {field_name}: {field_info}")
```

### Validation Tools
Test field extraction with minimal configuration:
1. Create simple test PDF with one text field
2. Use static value instead of expression
3. Test with binary output format
4. Check execution logs for field information

This comprehensive guide should help you understand and effectively use the new field extraction features in the Fill PDF node. The automatic field detection significantly improves the user experience while maintaining backward compatibility with existing workflows.