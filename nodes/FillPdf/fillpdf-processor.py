#!/usr/bin/env python3
"""
PDF Processing Script for n8n FillPdf Node

This script provides core functionality for PDF form inspection and filling
using the fillpdf Python library. It communicates with the Node.js n8n node
through JSON input/output and base64 encoding for binary data transport.

Requirements covered:
- 1.1: PDF field identification and listing
- 1.2: PDF form field population with workflow data
- 1.3: Return filled PDF as output data
- 2.1: Handle text fields with string values
- 2.2: Handle checkbox fields with boolean values
- 2.3: Handle radio button fields with string values
- 2.4: Handle dropdown fields with string values
"""

import sys
import json
import base64
import io
import time
import traceback
from typing import Dict, List, Any, Optional, Union

try:
    from fillpdf import fillpdfs
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "fillpdf library not found. Please install it using: pip install fillpdf",
        "errorType": "runtime"
    }))
    sys.exit(1)


class PdfProcessingError(Exception):
    """Custom exception for PDF processing errors"""
    
    def __init__(self, message: str, error_type: str = "runtime", details: Any = None):
        super().__init__(message)
        self.error_type = error_type
        self.details = details


class ErrorHandler:
    """Centralized error handling for PDF operations"""
    
    @staticmethod
    def handle_exception(e: Exception, context: str = "") -> Dict[str, Any]:
        """
        Handle exceptions and return structured error response
        
        Args:
            e: Exception to handle
            context: Context where the error occurred
            
        Returns:
            Structured error response dictionary
        """
        error_type = "runtime"
        error_message = str(e)
        
        # Categorize different types of errors
        if isinstance(e, PdfProcessingError):
            error_type = e.error_type
            error_message = str(e)
        elif isinstance(e, FileNotFoundError):
            error_type = "data"
            error_message = f"File not found: {error_message}"
        elif isinstance(e, PermissionError):
            error_type = "runtime"
            error_message = f"Permission denied: {error_message}"
        elif isinstance(e, MemoryError):
            error_type = "runtime"
            error_message = "Insufficient memory to process PDF. File may be too large."
        elif isinstance(e, ValueError):
            error_type = "data"
            error_message = f"Invalid data: {error_message}"
        elif isinstance(e, TypeError):
            error_type = "data"
            error_message = f"Invalid data type: {error_message}"
        elif "PDF" in str(e).upper() or "CORRUPT" in str(e).upper():
            error_type = "data"
            error_message = f"PDF file error: {error_message}"
        
        # Add context if provided
        if context:
            error_message = f"{context}: {error_message}"
        
        return {
            "success": False,
            "error": error_message,
            "errorType": error_type,
            "details": {
                "exception_type": type(e).__name__,
                "traceback": traceback.format_exc() if hasattr(e, '__traceback__') else None
            }
        }
    
    @staticmethod
    def validate_input_data(input_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Validate input data structure and return error if invalid
        
        Args:
            input_data: Input data to validate
            
        Returns:
            Error dictionary if validation fails, None if valid
        """
        required_fields = ["action", "pdfData"]
        
        # Check required fields
        for field in required_fields:
            if field not in input_data:
                return {
                    "success": False,
                    "error": f"Missing required field: {field}",
                    "errorType": "config"
                }
        
        # Validate action
        valid_actions = ["inspect", "fill"]
        if input_data["action"] not in valid_actions:
            return {
                "success": False,
                "error": f"Invalid action '{input_data['action']}'. Must be one of: {', '.join(valid_actions)}",
                "errorType": "config"
            }
        
        # Validate PDF data
        if not input_data["pdfData"]:
            return {
                "success": False,
                "error": "PDF data cannot be empty",
                "errorType": "data"
            }
        
        # Validate base64 encoding
        try:
            base64.b64decode(input_data["pdfData"])
        except Exception:
            return {
                "success": False,
                "error": "Invalid base64 encoded PDF data",
                "errorType": "data"
            }
        
        # Validate fill-specific requirements
        if input_data["action"] == "fill":
            if "fieldMappings" not in input_data:
                return {
                    "success": False,
                    "error": "Field mappings required for fill action",
                    "errorType": "config"
                }
            
            if not isinstance(input_data["fieldMappings"], dict):
                return {
                    "success": False,
                    "error": "Field mappings must be a dictionary",
                    "errorType": "config"
                }
        
        return None


class PdfProcessor:
    """Core PDF processing class using fillpdf library"""
    
    def __init__(self):
        self.start_time = time.time()
    
    def inspect_pdf(self, pdf_data: str) -> Dict[str, Any]:
        """
        Inspect PDF form fields and return field information
        
        Args:
            pdf_data: Base64 encoded PDF data
            
        Returns:
            Dictionary containing field information or error details
        """
        try:
            # Validate PDF data size
            if len(pdf_data) > 50 * 1024 * 1024:  # 50MB limit
                raise PdfProcessingError(
                    "PDF file too large (>50MB). Please use a smaller file.",
                    "data"
                )
            
            # Decode base64 PDF data with error handling
            try:
                pdf_bytes = base64.b64decode(pdf_data)
            except Exception as e:
                raise PdfProcessingError(
                    "Invalid base64 PDF data encoding",
                    "data"
                )
            
            # Validate PDF file signature
            if not pdf_bytes.startswith(b'%PDF'):
                raise PdfProcessingError(
                    "Invalid PDF file format. File does not appear to be a valid PDF.",
                    "data"
                )
            
            # Create temporary file-like object
            pdf_file = io.BytesIO(pdf_bytes)
            
            # Get form fields using fillpdf with error handling
            try:
                fields = fillpdfs.get_form_fields(pdf_file)
            except Exception as e:
                if "corrupt" in str(e).lower() or "damaged" in str(e).lower():
                    raise PdfProcessingError(
                        "PDF file appears to be corrupted or damaged",
                        "data"
                    )
                elif "password" in str(e).lower() or "encrypted" in str(e).lower():
                    raise PdfProcessingError(
                        "PDF file is password protected or encrypted. Please provide an unprotected PDF.",
                        "data"
                    )
                else:
                    raise PdfProcessingError(
                        f"Failed to read PDF form fields: {str(e)}",
                        "runtime"
                    )
            
            if not fields:
                return {
                    "success": True,
                    "fields": [],
                    "metadata": {
                        "fieldCount": 0,
                        "processingTime": time.time() - self.start_time
                    }
                }
            
            # Convert fields to structured format with error handling
            field_info = []
            for field_name, field_data in fields.items():
                try:
                    field_info.append(self._parse_field_info(field_name, field_data))
                except Exception as e:
                    # Log field parsing error but continue with other fields
                    continue
            
            return {
                "success": True,
                "fields": field_info,
                "metadata": {
                    "fieldCount": len(field_info),
                    "processingTime": time.time() - self.start_time
                }
            }
            
        except PdfProcessingError:
            # Re-raise custom errors
            raise
        except Exception as e:
            return ErrorHandler.handle_exception(e, "PDF inspection")
    
    def fill_pdf(self, pdf_data: str, field_mappings: Dict[str, Any], 
                 options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fill PDF form fields with provided data
        
        Args:
            pdf_data: Base64 encoded PDF data
            field_mappings: Dictionary mapping field names to values
            options: Processing options (flatten, outputFormat, etc.)
            
        Returns:
            Dictionary containing filled PDF data or error details
        """
        try:
            # Validate PDF data size
            if len(pdf_data) > 50 * 1024 * 1024:  # 50MB limit
                raise PdfProcessingError(
                    "PDF file too large (>50MB). Please use a smaller file.",
                    "data"
                )
            
            # Validate field mappings
            if not field_mappings:
                raise PdfProcessingError(
                    "No field mappings provided. At least one field must be mapped.",
                    "config"
                )
            
            # Decode base64 PDF data with error handling
            try:
                pdf_bytes = base64.b64decode(pdf_data)
            except Exception as e:
                raise PdfProcessingError(
                    "Invalid base64 PDF data encoding",
                    "data"
                )
            
            # Validate PDF file signature
            if not pdf_bytes.startswith(b'%PDF'):
                raise PdfProcessingError(
                    "Invalid PDF file format. File does not appear to be a valid PDF.",
                    "data"
                )
            
            pdf_file = io.BytesIO(pdf_bytes)
            
            # Validate field mappings against PDF fields
            validation_result = self._validate_field_mappings(pdf_file, field_mappings)
            if not validation_result["valid"]:
                raise PdfProcessingError(
                    validation_result["error"],
                    "data"
                )
            
            # Reset file pointer
            pdf_file.seek(0)
            
            # Convert field mappings to fillpdf format with validation
            try:
                fillpdf_data = self._convert_field_mappings(field_mappings)
            except Exception as e:
                raise PdfProcessingError(
                    f"Failed to convert field mappings: {str(e)}",
                    "data"
                )
            
            # Fill the PDF using fillpdf with comprehensive error handling
            output_stream = io.BytesIO()
            
            try:
                fillpdfs.write_fillable_pdf(
                    input_pdf_path=pdf_file,
                    output_pdf_path=output_stream,
                    data_dict=fillpdf_data,
                    flatten=options.get("flatten", False)
                )
            except Exception as e:
                error_msg = str(e).lower()
                if "corrupt" in error_msg or "damaged" in error_msg:
                    raise PdfProcessingError(
                        "PDF file appears to be corrupted or damaged",
                        "data"
                    )
                elif "password" in error_msg or "encrypted" in error_msg:
                    raise PdfProcessingError(
                        "PDF file is password protected. Please provide an unprotected PDF.",
                        "data"
                    )
                elif "permission" in error_msg:
                    raise PdfProcessingError(
                        "PDF file has restrictions that prevent form filling",
                        "data"
                    )
                elif "field" in error_msg:
                    raise PdfProcessingError(
                        f"Field mapping error: {str(e)}",
                        "data"
                    )
                else:
                    raise PdfProcessingError(
                        f"PDF filling operation failed: {str(e)}",
                        "runtime"
                    )
            
            # Validate output
            output_stream.seek(0)
            filled_pdf_bytes = output_stream.read()
            
            if not filled_pdf_bytes:
                raise PdfProcessingError(
                    "PDF filling produced empty output",
                    "runtime"
                )
            
            # Encode to base64 for transport
            try:
                filled_pdf_b64 = base64.b64encode(filled_pdf_bytes).decode('utf-8')
            except Exception as e:
                raise PdfProcessingError(
                    "Failed to encode filled PDF for transport",
                    "runtime"
                )
            
            return {
                "success": True,
                "data": filled_pdf_b64,
                "metadata": {
                    "fieldCount": len(field_mappings),
                    "filledFieldCount": len([v for v in field_mappings.values() if v is not None and v != ""]),
                    "processingTime": time.time() - self.start_time
                }
            }
            
        except PdfProcessingError:
            # Re-raise custom errors
            raise
        except Exception as e:
            return ErrorHandler.handle_exception(e, "PDF filling")
    
    def _parse_field_info(self, field_name: str, field_data: Any) -> Dict[str, Any]:
        """
        Parse field information from fillpdf field data
        
        Args:
            field_name: Name of the PDF field
            field_data: Field data from fillpdf
            
        Returns:
            Structured field information dictionary
        """
        try:
            # Validate field name
            if not field_name or not isinstance(field_name, str):
                raise ValueError("Invalid field name")
            
            field_info = {
                "name": field_name,
                "type": "text",  # Default type
                "required": False,
                "defaultValue": None
            }
            
            # Handle different field data formats with error handling
            if isinstance(field_data, dict):
                try:
                    # Extract field type information
                    field_type = str(field_data.get("type", "text")).lower()
                    
                    # Map fillpdf field types to our standard types
                    if "checkbox" in field_type or "check" in field_type:
                        field_info["type"] = "checkbox"
                    elif "radio" in field_type:
                        field_info["type"] = "radio"
                        if "options" in field_data and isinstance(field_data["options"], list):
                            field_info["options"] = [str(opt) for opt in field_data["options"]]
                    elif "dropdown" in field_type or "choice" in field_type:
                        field_info["type"] = "dropdown"
                        if "options" in field_data and isinstance(field_data["options"], list):
                            field_info["options"] = [str(opt) for opt in field_data["options"]]
                    else:
                        field_info["type"] = "text"
                        if "maxLength" in field_data:
                            try:
                                max_length = int(field_data["maxLength"])
                                if max_length > 0:
                                    field_info["maxLength"] = max_length
                            except (ValueError, TypeError):
                                pass  # Ignore invalid maxLength values
                    
                    # Extract other properties with validation
                    if "required" in field_data:
                        field_info["required"] = bool(field_data["required"])
                    
                    if "defaultValue" in field_data and field_data["defaultValue"] is not None:
                        field_info["defaultValue"] = str(field_data["defaultValue"])
                        
                except Exception:
                    # If parsing dict fails, use defaults
                    pass
                    
            elif isinstance(field_data, list):
                try:
                    # Handle list format (common with some fillpdf versions)
                    if len(field_data) > 0:
                        field_info["type"] = "dropdown"
                        field_info["options"] = [str(opt) for opt in field_data if opt is not None]
                except Exception:
                    # If parsing list fails, use defaults
                    pass
            
            # Validate final field info
            if not field_info.get("name"):
                raise ValueError("Field name cannot be empty")
            
            return field_info
            
        except Exception as e:
            # Return minimal field info if parsing fails
            return {
                "name": str(field_name) if field_name else "unknown",
                "type": "text",
                "required": False,
                "defaultValue": None,
                "parseError": str(e)
            }
    
    def _validate_field_mappings(self, pdf_file: io.BytesIO, 
                                field_mappings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate field mappings against actual PDF fields
        
        Args:
            pdf_file: PDF file stream
            field_mappings: Field mappings to validate
            
        Returns:
            Validation result with success status and error details
        """
        try:
            # Get actual PDF fields with error handling
            try:
                pdf_fields = fillpdfs.get_form_fields(pdf_file)
            except Exception as e:
                error_msg = str(e).lower()
                if "corrupt" in error_msg or "damaged" in error_msg:
                    return {
                        "valid": False,
                        "error": "PDF file appears to be corrupted or damaged"
                    }
                elif "password" in error_msg or "encrypted" in error_msg:
                    return {
                        "valid": False,
                        "error": "PDF file is password protected. Please provide an unprotected PDF."
                    }
                else:
                    return {
                        "valid": False,
                        "error": f"Failed to read PDF fields: {str(e)}"
                    }
            
            if not pdf_fields:
                return {
                    "valid": False,
                    "error": "PDF contains no fillable fields. Please ensure the PDF has form fields."
                }
            
            # Check if all mapped fields exist in PDF
            pdf_field_names = set(pdf_fields.keys())
            mapped_field_names = set(field_mappings.keys())
            
            # Find fields that don't exist in PDF
            invalid_fields = mapped_field_names - pdf_field_names
            if invalid_fields:
                available_fields = ', '.join(sorted(pdf_field_names)[:10])  # Show first 10 fields
                if len(pdf_field_names) > 10:
                    available_fields += f" (and {len(pdf_field_names) - 10} more)"
                
                return {
                    "valid": False,
                    "error": f"Fields not found in PDF: {', '.join(sorted(invalid_fields))}. Available fields: {available_fields}"
                }
            
            # Validate field values for specific field types
            for field_name, value in field_mappings.items():
                if value is None or value == "":
                    continue
                    
                # Check for extremely long values that might cause issues
                if isinstance(value, str) and len(value) > 10000:
                    return {
                        "valid": False,
                        "error": f"Value for field '{field_name}' is too long (>10000 characters)"
                    }
            
            return {"valid": True}
            
        except Exception as e:
            return {
                "valid": False,
                "error": f"Field validation failed: {str(e)}"
            }
    
    def _convert_field_mappings(self, field_mappings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert field mappings to fillpdf-compatible format
        
        Args:
            field_mappings: Original field mappings
            
        Returns:
            Converted field mappings for fillpdf
        """
        converted = {}
        
        for field_name, value in field_mappings.items():
            if value is None:
                continue
            
            try:
                # Handle different value types with validation
                if isinstance(value, bool):
                    # Convert boolean to fillpdf checkbox format
                    converted[field_name] = "Yes" if value else "Off"
                elif isinstance(value, (int, float)):
                    # Convert numbers to strings with validation
                    if isinstance(value, float) and (value != value):  # Check for NaN
                        raise ValueError(f"Invalid numeric value (NaN) for field '{field_name}'")
                    converted[field_name] = str(value)
                elif isinstance(value, str):
                    # Validate string length and content
                    if len(value) > 10000:
                        raise ValueError(f"Value for field '{field_name}' is too long (>10000 characters)")
                    converted[field_name] = value
                elif isinstance(value, (list, dict)):
                    # Handle complex types by converting to JSON string
                    try:
                        converted[field_name] = json.dumps(value)
                    except (TypeError, ValueError):
                        raise ValueError(f"Cannot convert complex value for field '{field_name}' to string")
                else:
                    # Try to convert other types to string
                    try:
                        converted[field_name] = str(value)
                    except Exception:
                        raise ValueError(f"Cannot convert value for field '{field_name}' to string")
                        
            except Exception as e:
                raise PdfProcessingError(
                    f"Field conversion error for '{field_name}': {str(e)}",
                    "data"
                )
        
        if not converted:
            raise PdfProcessingError(
                "No valid field mappings found after conversion",
                "data"
            )
        
        return converted


def main():
    """Main entry point for the script"""
    try:
        # Read JSON input from stdin with timeout handling
        try:
            input_raw = sys.stdin.read()
            if not input_raw.strip():
                raise ValueError("Empty input received")
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": f"Failed to read input: {str(e)}",
                "errorType": "config"
            }))
            sys.exit(1)
        
        # Parse JSON input with detailed error handling
        try:
            input_data = json.loads(input_raw)
        except json.JSONDecodeError as e:
            print(json.dumps({
                "success": False,
                "error": f"Invalid JSON input at line {e.lineno}, column {e.colno}: {e.msg}",
                "errorType": "config"
            }))
            sys.exit(1)
        
        # Validate input data structure
        validation_error = ErrorHandler.validate_input_data(input_data)
        if validation_error:
            print(json.dumps(validation_error))
            sys.exit(1)
        
        # Create processor instance
        processor = PdfProcessor()
        
        # Determine action and execute with error handling
        action = input_data.get("action")
        
        try:
            if action == "inspect":
                result = processor.inspect_pdf(input_data["pdfData"])
            elif action == "fill":
                result = processor.fill_pdf(
                    input_data["pdfData"],
                    input_data.get("fieldMappings", {}),
                    input_data.get("options", {})
                )
            else:
                result = {
                    "success": False,
                    "error": f"Unknown action: {action}. Valid actions are: inspect, fill",
                    "errorType": "config"
                }
        except PdfProcessingError as e:
            result = {
                "success": False,
                "error": str(e),
                "errorType": e.error_type,
                "details": e.details
            }
        except Exception as e:
            result = ErrorHandler.handle_exception(e, f"Action '{action}'")
        
        # Output result as JSON with error handling
        try:
            print(json.dumps(result))
        except Exception as e:
            # Fallback error response if JSON serialization fails
            fallback_result = {
                "success": False,
                "error": f"Failed to serialize result: {str(e)}",
                "errorType": "runtime"
            }
            print(json.dumps(fallback_result))
            sys.exit(1)
        
    except KeyboardInterrupt:
        print(json.dumps({
            "success": False,
            "error": "Operation was interrupted",
            "errorType": "runtime"
        }))
        sys.exit(1)
    except SystemExit:
        # Re-raise system exit to preserve exit codes
        raise
    except Exception as e:
        # Catch-all for any unexpected errors
        print(json.dumps({
            "success": False,
            "error": f"Unexpected system error: {str(e)}",
            "errorType": "runtime",
            "details": {
                "exception_type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()