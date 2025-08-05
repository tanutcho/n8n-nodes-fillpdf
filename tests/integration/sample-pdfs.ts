/**
 * Sample PDF data for integration testing
 * These are base64-encoded minimal PDF files with form fields
 */

// Simple PDF with text fields
export const SIMPLE_TEXT_FORM_PDF = `
JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKL0Fjcm9Gb3JtIDw8Ci9GaWVsZHMgWzMgMCBSIDQgMCBSXQo+Pgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzUgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovRlQgL1R4Ci9UIChmaXJzdE5hbWUpCi9WICgpCi9SZWN0IFsxMDAgNTAwIDIwMCA1MjBdCi9QIDUgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9Bbm5vdAovU3VidHlwZSAvV2lkZ2V0Ci9GVCA+VHgKL1QgKGxhc3ROYW1lKQovViAoKQovUmVjdCBbMTAwIDQ3MCAyMDAgNDkwXQovUCA1IDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDYgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCA2IDYxMiA3OTJdCi9Db250ZW50cyA3IDAgUgovQW5ub3RzIFszIDAgUiA0IDAgUl0KPj4KZW5kb2JqCjYgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNTUwIFRkCihTYW1wbGUgRm9ybSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDEwNCAwMDAwMCBuIAowMDAwMDAwMTYxIDAwMDAwIG4gCjAwMDAwMDAyNTMgMDAwMDAgbiAKMDAwMDAwMDM0MyAwMDAwMCBuIAowMDAwMDAwNDk2IDAwMDAwIG4gCjAwMDAwMDA1NjMgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA4Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo2NTcKJSVFT0Y=
`.trim();

// PDF with checkbox and radio button fields
export const CHECKBOX_RADIO_FORM_PDF = `
JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKL0Fjcm9Gb3JtIDw8Ci9GaWVsZHMgWzMgMCBSIDQgMCBSIDUgMCBSXQo+Pgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzYgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovRlQgL0J0Ci9UIChzdWJzY3JpYmUpCi9WIC9PZmYKL1JlY3QgWzEwMCA0NTAgMTIwIDQ3MF0KL1AgNiAwIFIKL0FQIDw8Ci9OIDw8Ci9ZZXMgNyAwIFIKL09mZiA4IDAgUgo+Pgo+Pgo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovRlQgL0J0Ci9UIChncm91cCkKL1YgL09wdGlvbjEKL1JlY3QgWzEwMCA0MDAgMTIwIDQyMF0KL1AgNiAwIFIKL0tpZHMgWzUgMCBSXQo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovUGFyZW50IDQgMCBSCi9BUyAvT3B0aW9uMQovUmVjdCBbMTAwIDQwMCAxMjAgNDIwXQovUCA2IDAgUgo+PgplbmRvYmoKNiAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDkgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCA2IDYxMiA3OTJdCi9Db250ZW50cyAxMCAwIFIKL0Fubm90cyBbMyAwIFIgNCAwIFIgNSAwIFJdCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9MZW5ndGggMTAKPj4Kc3RyZWFtCjEgMCAwIDEgMCAwIGNtCmVuZHN0cmVhbQplbmRvYmoKOCAwIG9iago8PAovTGVuZ3RoIDEwCj4+CnN0cmVhbQoxIDAgMCAxIDAgMCBjbQplbmRzdHJlYW0KZW5kb2JqCjkgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoxMCAwIG9iago8PAovTGVuZ3RoIDUwCj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDUwMCBUZAooQ2hlY2tib3ggRm9ybSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTEKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAxMTcgMDAwMDAgbiAKMDAwMDAwMDE3NCAwMDAwMCBuIAowMDAwMDAwMzI4IDAwMDAwIG4gCjAwMDAwMDA0MjcgMDAwMDAgbiAKMDAwMDAwMDUxNSAwMDAwMCBuIAowMDAwMDAwNjc5IDAwMDAwIG4gCjAwMDAwMDA3MzkgMDAwMDAgbiAKMDAwMDAwMDc5OSAwMDAwMCBuIAowMDAwMDAwODY2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgMTEKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjk2NwolJUVPRg==
`.trim();

// PDF with dropdown field
export const DROPDOWN_FORM_PDF = `
JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKL0Fjcm9Gb3JtIDw8Ci9GaWVsZHMgWzMgMCBSXQo+Pgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzQgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovRlQgL0NoCi9UIihjb3VudHJ5KQovViAoKQovT3B0IFsKKFVTQSkKKENhbmFkYSkKKFVLKQpdCi9SZWN0IFsxMDAgNDAwIDIwMCA0MjBdCi9QIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDYgMCBSCi9Bbm5vdHMgWzMgMCBSXQo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0xlbmd0aCA0OAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA1MDAgVGQKKERyb3Bkb3duIEZvcm0pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwOTcgMDAwMDAgbiAKMDAwMDAwMDE1NCAwMDAwMCBuIAowMDAwMDAwMzA4IDAwMDAwIG4gCjAwMDAwMDA0NjEgMDAwMDAgbiAKMDAwMDAwMDUyOCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDcKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjYyNgolJUVPRg==
`.trim();

// Complex PDF with multiple field types
export const COMPLEX_FORM_PDF = `
JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKL0Fjcm9Gb3JtIDw8Ci9GaWVsZHMgWzMgMCBSIDQgMCBSIDUgMCBSIDYgMCBSIDcgMCBSXQo+Pgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzggMCBSXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovRlQgL1R4Ci9UIChmdWxsTmFtZSkKL1YgKCkKL1JlY3QgWzEwMCA1NTAgMzAwIDU3MF0KL1AgOCAwIFIKL01heExlbiA1MAo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvQW5ub3QKL1N1YnR5cGUgL1dpZGdldAovRlQgL1R4Ci9UIihlbWFpbCkKL1YgKCkKL1JlY3QgWzEwMCA1MTAgMzAwIDUzMF0KL1AgOCAwIFIKL01heExlbiAxMDAKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL0Fubm90Ci9TdWJ0eXBlIC9XaWRnZXQKL0ZUIC9CdAovVCAoYWdyZWUpCi9WIC9PZmYKL1JlY3QgWzEwMCA0NzAgMTIwIDQ5MF0KL1AgOCAwIFIKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL1R5cGUgL0Fubm90Ci9TdWJ0eXBlIC9XaWRnZXQKL0ZUIC9CdAovVCAoZ2VuZGVyKQovViAvTWFsZQovUmVjdCBbMTAwIDQzMCAxMjAgNDUwXQovUCA4IDAgUgovS2lkcyBbNyAwIFJdCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9UeXBlIC9Bbm5vdAovU3VidHlwZSAvV2lkZ2V0Ci9QYXJlbnQgNiAwIFIKL0FTIC9NYWxlCi9SZWN0IFsxMDAgNDMwIDEyMCA0NTBdCi9QIDggMCBSCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgOSAwIFIKPj4KPj4KL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDEwIDAgUgovQW5ub3RzIFszIDAgUiA0IDAgUiA1IDAgUiA2IDAgUiA3IDAgUl0KPj4KZW5kb2JqCjkgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoxMCAwIG9iago8PAovTGVuZ3RoIDQ4Cj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDYwMCBUZAooQ29tcGxleCBGb3JtKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDEyNyAwMDAwMCBuIAowMDAwMDAwMTg0IDAwMDAwIG4gCjAwMDAwMDAyOTQgMDAwMDAgbiAKMDAwMDAwMDQwNSAwMDAwMCBuIAowMDAwMDAwNDk3IDAwMDAwIG4gCjAwMDAwMDA2MDEgMDAwMDAgbiAKMDAwMDAwMDY5NCAwMDAwMCBuIAowMDAwMDAwODY5IDAwMDAwIG4gCjAwMDAwMDA5MzYgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxMQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMTAzNAolJUVPRg==
`.trim();

// Corrupted PDF for error testing
export const CORRUPTED_PDF = `
JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCAyMAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCkVUCmVuZHN0cmVhbQplbmRvYmoKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoyMDAKJSVFT0Y=
`.trim();

// Large PDF for performance testing (simulated)
export const LARGE_PDF_METADATA = {
  size: 10 * 1024 * 1024, // 10MB
  fieldCount: 50,
  description: 'Large PDF with many fields for performance testing',
};

/**
 * Field information for sample PDFs
 */
export const SAMPLE_PDF_FIELDS = {
  SIMPLE_TEXT_FORM: [
    {
      name: 'firstName',
      type: 'text' as const,
      required: false,
      maxLength: 50,
    },
    {
      name: 'lastName',
      type: 'text' as const,
      required: false,
      maxLength: 50,
    },
  ],
  
  CHECKBOX_RADIO_FORM: [
    {
      name: 'subscribe',
      type: 'checkbox' as const,
      required: false,
    },
    {
      name: 'group',
      type: 'radio' as const,
      required: false,
      options: ['Option1', 'Option2', 'Option3'],
    },
  ],
  
  DROPDOWN_FORM: [
    {
      name: 'country',
      type: 'dropdown' as const,
      required: false,
      options: ['USA', 'Canada', 'UK'],
    },
  ],
  
  COMPLEX_FORM: [
    {
      name: 'fullName',
      type: 'text' as const,
      required: false,
      maxLength: 50,
    },
    {
      name: 'email',
      type: 'text' as const,
      required: false,
      maxLength: 100,
    },
    {
      name: 'agree',
      type: 'checkbox' as const,
      required: false,
    },
    {
      name: 'gender',
      type: 'radio' as const,
      required: false,
      options: ['Male', 'Female', 'Other'],
    },
  ],
};

/**
 * Sample field mappings for testing
 */
export const SAMPLE_FIELD_MAPPINGS = {
  SIMPLE_TEXT: [
    {
      pdfFieldName: 'firstName',
      valueSource: 'static' as const,
      staticValue: 'John',
    },
    {
      pdfFieldName: 'lastName',
      valueSource: 'static' as const,
      staticValue: 'Doe',
    },
  ],
  
  MIXED_TYPES: [
    {
      pdfFieldName: 'fullName',
      valueSource: 'expression' as const,
      expression: '{{$json.firstName + " " + $json.lastName}}',
    },
    {
      pdfFieldName: 'email',
      valueSource: 'expression' as const,
      expression: '{{$json.email}}',
    },
    {
      pdfFieldName: 'agree',
      valueSource: 'static' as const,
      staticValue: true,
    },
    {
      pdfFieldName: 'gender',
      valueSource: 'static' as const,
      staticValue: 'Male',
    },
  ],
  
  EXPRESSION_HEAVY: [
    {
      pdfFieldName: 'fullName',
      valueSource: 'expression' as const,
      expression: '{{$json.user.firstName + " " + $json.user.lastName}}',
    },
    {
      pdfFieldName: 'email',
      valueSource: 'expression' as const,
      expression: '{{$json.user.email.toLowerCase()}}',
    },
    {
      pdfFieldName: 'agree',
      valueSource: 'expression' as const,
      expression: '{{$json.preferences.marketing === true}}',
    },
  ],
};

/**
 * Sample input data for testing
 */
export const SAMPLE_INPUT_DATA = {
  SIMPLE: {
    json: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    },
  },
  
  COMPLEX: {
    json: {
      user: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'JANE.SMITH@EXAMPLE.COM',
      },
      preferences: {
        marketing: true,
        newsletter: false,
      },
      metadata: {
        timestamp: '2023-01-01T00:00:00Z',
        source: 'web-form',
      },
    },
  },
  
  BATCH: [
    {
      json: {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
      },
    },
    {
      json: {
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob@example.com',
      },
    },
    {
      json: {
        firstName: 'Charlie',
        lastName: 'Brown',
        email: 'charlie@example.com',
      },
    },
  ],
};

/**
 * Expected output data for validation
 */
export const EXPECTED_OUTPUTS = {
  SIMPLE_TEXT_FILLED: {
    firstName: 'John',
    lastName: 'Doe',
  },
  
  COMPLEX_FILLED: {
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    agree: 'Yes',
    gender: 'Male',
  },
  
  BATCH_FILLED: [
    { fullName: 'Alice Johnson', email: 'alice@example.com' },
    { fullName: 'Bob Wilson', email: 'bob@example.com' },
    { fullName: 'Charlie Brown', email: 'charlie@example.com' },
  ],
};