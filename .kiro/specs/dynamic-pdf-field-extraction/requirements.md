# Requirements Document

## Introduction

This feature will transform the n8n Fill PDF node to automatically extract fillable fields from PDF files and dynamically present them as input fields in the n8n node interface. Users will be able to see all available PDF fields and fill them directly in the node configuration, eliminating the need for complex field mapping configurations.

## Requirements

### Requirement 1

**User Story:** As an n8n workflow builder, I want the Fill PDF node to automatically detect all fillable fields in my PDF and show them as input fields in the node interface, so that I can easily see what fields are available and fill them without guessing field names.

#### Acceptance Criteria

1. WHEN a user selects or uploads a PDF file THEN the system SHALL automatically extract all fillable fields from the PDF
2. WHEN PDF fields are extracted THEN the system SHALL dynamically generate input fields in the n8n node interface for each detected PDF field
3. WHEN displaying extracted fields THEN the system SHALL show the field name, type (text, checkbox, dropdown, etc.), and whether it's required
4. WHEN a PDF field is a dropdown THEN the system SHALL show the available options as a dropdown in the n8n interface
5. WHEN a PDF field is a checkbox THEN the system SHALL show it as a boolean toggle in the n8n interface

### Requirement 2

**User Story:** As an n8n workflow builder, I want the field extraction to work for all PDF sources (upload, URL, binary data), so that I can use any PDF source and still get the dynamic field interface.

#### Acceptance Criteria

1. WHEN PDF source is "Upload File" THEN the system SHALL extract fields after file upload and refresh the node interface
2. WHEN PDF source is "URL" THEN the system SHALL extract fields when the URL is entered and refresh the node interface
3. WHEN PDF source is "Binary Data" THEN the system SHALL extract fields during workflow execution and show available fields in logs
4. WHEN field extraction fails THEN the system SHALL show an error message but allow manual field entry as fallback
5. WHEN no fillable fields are found THEN the system SHALL display a clear message indicating the PDF has no fillable fields

### Requirement 3

**User Story:** As an n8n workflow builder, I want to fill the extracted PDF fields using expressions or static values, so that I can populate the PDF with data from my workflow or fixed values.

#### Acceptance Criteria

1. WHEN a PDF field is displayed in the interface THEN the system SHALL allow both static values and n8n expressions as input
2. WHEN entering field values THEN the system SHALL support all n8n expression syntax ({{ $json.field }}, etc.)
3. WHEN a field is required in the PDF THEN the system SHALL mark it as required in the n8n interface
4. WHEN a field has validation rules THEN the system SHALL apply appropriate validation in the n8n interface
5. WHEN field values are provided THEN the system SHALL fill the PDF with the specified values during execution

### Requirement 4

**User Story:** As an n8n workflow builder, I want the node interface to update automatically when I change the PDF source, so that I always see the correct fields for the currently selected PDF.

#### Acceptance Criteria

1. WHEN the PDF source is changed THEN the system SHALL clear previous field inputs and extract fields from the new source
2. WHEN PDF extraction is in progress THEN the system SHALL show a loading indicator
3. WHEN field extraction completes THEN the system SHALL refresh the node interface with new field inputs
4. WHEN switching between different PDFs THEN the system SHALL preserve field values only if field names match
5. WHEN field extraction takes too long THEN the system SHALL show a timeout message and allow manual configuration

### Requirement 5

**User Story:** As an n8n workflow builder, I want clear feedback about the field extraction process, so that I understand what's happening and can troubleshoot issues.

#### Acceptance Criteria

1. WHEN field extraction starts THEN the system SHALL show a progress indicator with status message
2. WHEN fields are successfully extracted THEN the system SHALL show a success message with field count
3. WHEN field extraction fails THEN the system SHALL show a clear error message with troubleshooting hints
4. WHEN no fields are found THEN the system SHALL explain that the PDF may not have fillable fields
5. WHEN field extraction is complete THEN the system SHALL log the available fields for reference

### Requirement 6

**User Story:** As an n8n workflow builder, I want a fallback option to manually add fields if automatic extraction doesn't work, so that I can still use the node even when field detection fails.

#### Acceptance Criteria

1. WHEN automatic field extraction fails THEN the system SHALL provide an option to switch to manual field entry
2. WHEN in manual mode THEN the system SHALL allow users to add field mappings with name, type, and value
3. WHEN switching between automatic and manual modes THEN the system SHALL preserve existing field values where possible
4. WHEN in manual mode THEN the system SHALL still attempt to validate field names against the PDF during execution
5. WHEN manual fields are configured THEN the system SHALL process them the same way as automatically extracted fields