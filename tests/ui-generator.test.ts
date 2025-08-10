import { UIGenerator, IDynamicProperty } from '../nodes/FillPdf/ui-generator';
import { IFieldInfo } from '../nodes/FillPdf/types';

describe('UIGenerator - Comprehensive Unit Tests', () => {
  let uiGenerator: UIGenerator;

  const mockFields: IFieldInfo[] = [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      maxLength: 50,
      defaultValue: 'John',
    },
    {
      name: 'subscribe',
      type: 'checkbox',
      required: false,
      defaultValue: false,
    },
    {
      name: 'country',
      type: 'dropdown',
      required: true,
      options: ['USA', 'Canada', 'UK', 'Germany', 'France'],
      defaultValue: 'USA',
    },
    {
      name: 'gender',
      type: 'radio',
      required: false,
      options: ['Male', 'Female', 'Other'],
    },
    {
      name: 'comments',
      type: 'text',
      required: false,
      maxLength: 500,
    },
  ];

  beforeEach(() => {
    uiGenerator = new UIGenerator();
  });

  describe('generateFieldProperties', () => {
    it('should generate properties for all field types', () => {
      const properties = uiGenerator.generateFieldProperties(mockFields);

      // Should include section header, fields, and summary
      expect(properties.length).toBeGreaterThan(mockFields.length);
      
      // Check for section header
      const sectionHeader = properties.find(p => p.name === 'pdfFieldsSection');
      expect(sectionHeader).toBeDefined();
      expect(sectionHeader?.type).toBe('notice');
      expect(sectionHeader?.default).toContain('5 fillable fields found');

      // Check for field summary
      const fieldSummary = properties.find(p => p.name === 'fieldSummary');
      expect(fieldSummary).toBeDefined();
      expect(fieldSummary?.default).toContain('Total fields: 5');
      expect(fieldSummary?.default).toContain('2 required, 3 optional');
    });

    it('should generate correct properties for text fields', () => {
      const textField: IFieldInfo = {
        name: 'testText',
        type: 'text',
        required: true,
        maxLength: 100,
        defaultValue: 'default text',
      };

      const properties = uiGenerator.generateFieldProperties([textField]);
      const fieldProperty = properties.find(p => p.name === 'pdfField_testText');

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.type).toBe('string');
      expect(fieldProperty?.required).toBe(true);
      expect(fieldProperty?.default).toBe('default text');
      expect(fieldProperty?.displayName).toContain('📝 testText *');
      expect(fieldProperty?.displayName).toContain('max:100');
      expect(fieldProperty?.hint).toContain('max 100 chars');
      expect(fieldProperty?.hint).toContain('This field is required');
    });

    it('should generate correct properties for checkbox fields', () => {
      const checkboxField: IFieldInfo = {
        name: 'testCheckbox',
        type: 'checkbox',
        required: false,
        defaultValue: true,
      };

      const properties = uiGenerator.generateFieldProperties([checkboxField]);
      const fieldProperty = properties.find(p => p.name === 'pdfField_testCheckbox');

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.type).toBe('boolean');
      expect(fieldProperty?.required).toBe(false);
      expect(fieldProperty?.default).toBe(true);
      expect(fieldProperty?.displayName).toContain('☑️ testCheckbox');
      expect(fieldProperty?.hint).toContain('Checkbox field');
      expect(fieldProperty?.hint).toContain('This field is optional');
    });

    it('should generate correct properties for dropdown fields with options', () => {
      const dropdownField: IFieldInfo = {
        name: 'testDropdown',
        type: 'dropdown',
        required: true,
        options: ['Option1', 'Option2', 'Option3'],
        defaultValue: 'Option1',
      };

      const properties = uiGenerator.generateFieldProperties([dropdownField]);
      const fieldProperty = properties.find(p => p.name === 'pdfField_testDropdown');

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.type).toBe('options');
      expect(fieldProperty?.required).toBe(true);
      expect(fieldProperty?.default).toBe('Option1');
      expect(fieldProperty?.displayName).toContain('📋 testDropdown *');
      expect(fieldProperty?.displayName).toContain('[3 options]');
      
      // Check options structure
      const options = (fieldProperty as any)?.options;
      expect(options).toBeDefined();
      expect(options).toHaveLength(5); // 3 options + custom option (no empty option for required field)
      expect(options[0].value).toBe('Option1');
      expect(options[3].value).toBe('__custom__');
      expect(options[3].name).toContain('Custom Value');
    });

    it('should generate correct properties for dropdown fields without options', () => {
      const dropdownField: IFieldInfo = {
        name: 'testDropdown',
        type: 'dropdown',
        required: false,
        options: [],
      };

      const properties = uiGenerator.generateFieldProperties([dropdownField]);
      const fieldProperty = properties.find(p => p.name === 'pdfField_testDropdown');

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.type).toBe('string');
      expect(fieldProperty?.placeholder).toContain('Enter dropdown value');
      expect(fieldProperty?.description).toContain('No options detected');
    });

    it('should generate correct properties for radio fields', () => {
      const radioField: IFieldInfo = {
        name: 'testRadio',
        type: 'radio',
        required: false,
        options: ['Choice1', 'Choice2'],
      };

      const properties = uiGenerator.generateFieldProperties([radioField]);
      const fieldProperty = properties.find(p => p.name === 'pdfField_testRadio');

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.type).toBe('options');
      expect(fieldProperty?.displayName).toContain('🔘 testRadio');
      
      const options = (fieldProperty as any)?.options;
      expect(options).toHaveLength(4); // empty option + 2 choices + custom option
      expect(options[0].name).toBe('(No Selection)');
      expect(options[0].value).toBe('');
    });

    it('should handle empty field array', () => {
      const properties = uiGenerator.generateFieldProperties([]);
      
      // Should not include section header or summary for empty fields
      expect(properties).toHaveLength(0);
    });

    it('should handle unknown field types', () => {
      const unknownField: IFieldInfo = {
        name: 'unknownField',
        type: 'unknown' as any,
        required: false,
      };

      const properties = uiGenerator.generateFieldProperties([unknownField]);
      const fieldProperty = properties.find(p => p.name === 'pdfField_unknownField');

      expect(fieldProperty).toBeDefined();
      expect(fieldProperty?.type).toBe('string');
      expect(fieldProperty?.displayName).toContain('❓ unknownField');
      expect(fieldProperty?.description).toContain('Unknown field type');
    });
  });

  describe('createFieldInput', () => {
    it('should create text field input with validation', () => {
      const textField: IFieldInfo = {
        name: 'testField',
        type: 'text',
        required: true,
        maxLength: 50,
      };

      const fieldInput = uiGenerator.createFieldInput(textField, 0);

      expect(fieldInput).toBeDefined();
      expect(fieldInput?.type).toBe('string');
      expect(fieldInput?.required).toBe(true);
      expect((fieldInput as any)?.typeOptions?.maxLength).toBe(50);
      expect((fieldInput as any)?.typeOptions?.validation).toBeDefined();
    });

    it('should create checkbox field input', () => {
      const checkboxField: IFieldInfo = {
        name: 'testCheckbox',
        type: 'checkbox',
        required: false,
        defaultValue: false,
      };

      const fieldInput = uiGenerator.createFieldInput(checkboxField, 0);

      expect(fieldInput).toBeDefined();
      expect(fieldInput?.type).toBe('boolean');
      expect(fieldInput?.default).toBe(false);
      expect(fieldInput?.description).toContain('expressions like {{ $json.agree }}');
    });

    it('should create dropdown with many options (truncated display)', () => {
      const manyOptions = Array.from({ length: 10 }, (_, i) => `Option${i + 1}`);
      const dropdownField: IFieldInfo = {
        name: 'manyOptionsDropdown',
        type: 'dropdown',
        required: false,
        options: manyOptions,
      };

      const fieldInput = uiGenerator.createFieldInput(dropdownField, 0);

      expect(fieldInput).toBeDefined();
      expect(fieldInput?.displayName).toContain('[10 options]');
      expect(fieldInput?.description).toContain('10 available options');
      
      const options = (fieldInput as any)?.options;
      expect(options).toHaveLength(12); // empty + 10 options + custom
    });

    it('should handle field with few options (show all in display name)', () => {
      const fewOptions = ['A', 'B', 'C'];
      const dropdownField: IFieldInfo = {
        name: 'fewOptionsDropdown',
        type: 'dropdown',
        required: false,
        options: fewOptions,
      };

      const fieldInput = uiGenerator.createFieldInput(dropdownField, 0);

      expect(fieldInput?.displayName).toContain('[A|B|C]');
    });
  });

  describe('createCustomValueInput', () => {
    it('should create custom value input for dropdown field', () => {
      const dropdownField: IFieldInfo = {
        name: 'testDropdown',
        type: 'dropdown',
        required: true,
        options: ['Option1', 'Option2'],
      };

      const customInput = uiGenerator.createCustomValueInput(dropdownField);

      expect(customInput).toBeDefined();
      expect(customInput.name).toBe('pdfField_testDropdown_custom');
      expect(customInput.type).toBe('string');
      expect(customInput.required).toBe(true);
      expect(customInput.displayOptions?.show?.[`pdfField_testDropdown`]).toEqual(['__custom__']);
      expect(customInput.placeholder).toContain('Enter custom value');
    });

    it('should create custom value input for radio field', () => {
      const radioField: IFieldInfo = {
        name: 'testRadio',
        type: 'radio',
        required: false,
        options: ['Choice1', 'Choice2'],
      };

      const customInput = uiGenerator.createCustomValueInput(radioField);

      expect(customInput.required).toBe(false);
      expect(customInput.description).toContain('radio field');
    });
  });

  describe('createFieldMappingFromDynamicFields', () => {
    it('should convert dynamic field values to field mappings', () => {
      const dynamicValues = {
        pdfField_firstName: 'John Doe',
        pdfField_subscribe: true,
        pdfField_country: 'Canada',
        pdfField_gender: '__custom__',
        pdfField_gender_custom: '{{ $json.userGender }}',
      };

      const fields: IFieldInfo[] = [
        { name: 'firstName', type: 'text', required: true },
        { name: 'subscribe', type: 'checkbox', required: false },
        { name: 'country', type: 'dropdown', required: true, options: ['USA', 'Canada'] },
        { name: 'gender', type: 'radio', required: false, options: ['Male', 'Female'] },
      ];

      const mappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, fields);

      expect(mappings).toHaveLength(4);
      
      // Check static value mapping
      const firstNameMapping = mappings.find(m => m.pdfFieldName === 'firstName');
      expect(firstNameMapping?.valueSource).toBe('static');
      expect(firstNameMapping?.staticValue).toBe('John Doe');

      // Check boolean mapping
      const subscribeMapping = mappings.find(m => m.pdfFieldName === 'subscribe');
      expect(subscribeMapping?.valueSource).toBe('static');
      expect(subscribeMapping?.staticValue).toBe(true);

      // Check custom expression mapping
      const genderMapping = mappings.find(m => m.pdfFieldName === 'gender');
      expect(genderMapping?.valueSource).toBe('expression');
      expect(genderMapping?.expression).toBe('{{ $json.userGender }}');
    });

    it('should skip empty optional fields', () => {
      const dynamicValues = {
        pdfField_firstName: 'John',
        pdfField_optionalField: '',
        pdfField_anotherOptional: null,
      };

      const fields: IFieldInfo[] = [
        { name: 'firstName', type: 'text', required: true },
        { name: 'optionalField', type: 'text', required: false },
        { name: 'anotherOptional', type: 'text', required: false },
      ];

      const mappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, fields);

      expect(mappings).toHaveLength(1);
      expect(mappings[0].pdfFieldName).toBe('firstName');
    });

    it('should detect expressions correctly', () => {
      const dynamicValues = {
        pdfField_field1: '{{ $json.value }}',
        pdfField_field2: 'static value',
        pdfField_field3: 'text with $json.reference',
        pdfField_field4: 'text with $node reference',
      };

      const fields: IFieldInfo[] = [
        { name: 'field1', type: 'text', required: false },
        { name: 'field2', type: 'text', required: false },
        { name: 'field3', type: 'text', required: false },
        { name: 'field4', type: 'text', required: false },
      ];

      const mappings = uiGenerator.createFieldMappingFromDynamicFields(dynamicValues, fields);

      expect(mappings[0].valueSource).toBe('expression'); // {{ $json.value }}
      expect(mappings[1].valueSource).toBe('static'); // static value
      expect(mappings[2].valueSource).toBe('expression'); // contains $json
      expect(mappings[3].valueSource).toBe('expression'); // contains $node
    });
  });

  describe('validateDynamicFieldConfiguration', () => {
    it('should validate correct field configuration', () => {
      const dynamicValues = {
        pdfField_firstName: 'John Doe',
        pdfField_subscribe: true,
        pdfField_country: 'USA',
      };

      const fields: IFieldInfo[] = [
        { name: 'firstName', type: 'text', required: true, maxLength: 50 },
        { name: 'subscribe', type: 'checkbox', required: false },
        { name: 'country', type: 'dropdown', required: true, options: ['USA', 'Canada'] },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const dynamicValues = {
        pdfField_firstName: '',
        pdfField_subscribe: false,
      };

      const fields: IFieldInfo[] = [
        { name: 'firstName', type: 'text', required: true },
        { name: 'subscribe', type: 'checkbox', required: false },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Required field "firstName" cannot be empty');
    });

    it('should detect text field length violations', () => {
      const dynamicValues = {
        pdfField_shortText: 'a'.repeat(100),
      };

      const fields: IFieldInfo[] = [
        { name: 'shortText', type: 'text', required: false, maxLength: 50 },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "shortText" exceeds maximum length of 50 characters');
    });

    it('should warn about invalid dropdown options', () => {
      const dynamicValues = {
        pdfField_country: 'Germany',
      };

      const fields: IFieldInfo[] = [
        { name: 'country', type: 'dropdown', required: false, options: ['USA', 'Canada', 'UK'] },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Field "country" value "Germany" is not in the detected options');
    });

    it('should validate custom field values', () => {
      const dynamicValues = {
        pdfField_country: '__custom__',
        pdfField_country_custom: '',
      };

      const fields: IFieldInfo[] = [
        { name: 'country', type: 'dropdown', required: true, options: ['USA', 'Canada'] },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Custom value required for field "country"');
    });

    it('should validate expression syntax', () => {
      const dynamicValues = {
        pdfField_field1: '{{ $json.value',
        pdfField_field2: '$json.value }}',
      };

      const fields: IFieldInfo[] = [
        { name: 'field1', type: 'text', required: false },
        { name: 'field2', type: 'text', required: false },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid expression syntax in field "field1": mismatched braces');
    });

    it('should not warn about expressions in dropdown validation', () => {
      const dynamicValues = {
        pdfField_country: '{{ $json.selectedCountry }}',
      };

      const fields: IFieldInfo[] = [
        { name: 'country', type: 'dropdown', required: false, options: ['USA', 'Canada'] },
      ];

      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, fields);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0); // Should not warn about expressions
    });
  });

  describe('generateFieldValidation', () => {
    it('should generate validation rules for required text field', () => {
      const field: IFieldInfo = {
        name: 'requiredText',
        type: 'text',
        required: true,
        maxLength: 100,
      };

      const validationRules = uiGenerator.generateFieldValidation(field);

      expect(validationRules).toHaveLength(2);
      expect(validationRules[0].type).toBe('required');
      expect(validationRules[1].type).toBe('maxLength');
      expect(validationRules[1].properties.maxLength).toBe(100);
    });

    it('should generate validation rules for dropdown field', () => {
      const field: IFieldInfo = {
        name: 'dropdown',
        type: 'dropdown',
        required: false,
        options: ['A', 'B', 'C'],
      };

      const validationRules = uiGenerator.generateFieldValidation(field);

      expect(validationRules).toHaveLength(1);
      expect(validationRules[0].type).toBe('options');
      expect(validationRules[0].properties.validOptions).toContain('A');
      expect(validationRules[0].properties.validOptions).toContain('__custom__');
      expect(validationRules[0].properties.validOptions).toContain('');
    });

    it('should generate no validation rules for optional field without constraints', () => {
      const field: IFieldInfo = {
        name: 'optional',
        type: 'text',
        required: false,
      };

      const validationRules = uiGenerator.generateFieldValidation(field);

      expect(validationRules).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle fields with null/undefined values gracefully', () => {
      const fieldsWithNulls: IFieldInfo[] = [
        {
          name: 'nullField',
          type: 'text',
          required: false,
          defaultValue: null,
          options: null,
        } as any,
        {
          name: 'undefinedField',
          type: 'dropdown',
          required: false,
          defaultValue: undefined,
          options: undefined,
        } as any,
      ];

      const properties = uiGenerator.generateFieldProperties(fieldsWithNulls);

      expect(properties.length).toBeGreaterThan(0);
      
      const nullFieldProperty = properties.find(p => p.name === 'pdfField_nullField');
      expect(nullFieldProperty).toBeDefined();
      expect(nullFieldProperty?.default).toBe('');

      const undefinedFieldProperty = properties.find(p => p.name === 'pdfField_undefinedField');
      expect(undefinedFieldProperty).toBeDefined();
      expect(undefinedFieldProperty?.type).toBe('string'); // Fallback for dropdown without options
    });

    it('should handle very long field names', () => {
      const longNameField: IFieldInfo = {
        name: 'a'.repeat(100),
        type: 'text',
        required: false,
      };

      const fieldInput = uiGenerator.createFieldInput(longNameField, 0);

      expect(fieldInput).toBeDefined();
      expect(fieldInput?.name).toBe(`pdfField_${'a'.repeat(100)}`);
    });

    it('should handle fields with special characters in names', () => {
      const specialCharField: IFieldInfo = {
        name: 'field-with_special.chars@123',
        type: 'text',
        required: false,
      };

      const fieldInput = uiGenerator.createFieldInput(specialCharField, 0);

      expect(fieldInput).toBeDefined();
      expect(fieldInput?.name).toBe('pdfField_field-with_special.chars@123');
    });

    it('should handle dropdown with empty string options', () => {
      const dropdownField: IFieldInfo = {
        name: 'emptyOptions',
        type: 'dropdown',
        required: false,
        options: ['', 'Option1', '', 'Option2'],
      };

      const fieldInput = uiGenerator.createFieldInput(dropdownField, 0);

      expect(fieldInput).toBeDefined();
      const options = (fieldInput as any)?.options;
      expect(options).toBeDefined();
      // Should include all options, even empty strings
      expect(options.some((opt: any) => opt.value === '')).toBe(true);
    });

    it('should handle very large option lists', () => {
      const manyOptions = Array.from({ length: 1000 }, (_, i) => `Option${i}`);
      const dropdownField: IFieldInfo = {
        name: 'manyOptions',
        type: 'dropdown',
        required: false,
        options: manyOptions,
      };

      const fieldInput = uiGenerator.createFieldInput(dropdownField, 0);

      expect(fieldInput).toBeDefined();
      expect(fieldInput?.displayName).toContain('[1000 options]');
      
      const options = (fieldInput as any)?.options;
      expect(options).toHaveLength(1002); // empty + 1000 options + custom
    });

    it('should handle field validation with extreme values', () => {
      const extremeField: IFieldInfo = {
        name: 'extreme',
        type: 'text',
        required: true,
        maxLength: 0, // Edge case: zero max length
      };

      const validationRules = uiGenerator.generateFieldValidation(extremeField);

      expect(validationRules).toHaveLength(2);
      expect(validationRules[1].properties.maxLength).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of fields efficiently', () => {
      const manyFields: IFieldInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `field${i}`,
        type: 'text',
        required: i % 2 === 0,
        maxLength: 50 + i,
      }));

      const startTime = Date.now();
      const properties = uiGenerator.generateFieldProperties(manyFields);
      const endTime = Date.now();

      expect(properties.length).toBeGreaterThan(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex field validation efficiently', () => {
      const complexFields: IFieldInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `complexField${i}`,
        type: i % 4 === 0 ? 'dropdown' : i % 4 === 1 ? 'radio' : i % 4 === 2 ? 'checkbox' : 'text',
        required: i % 3 === 0,
        options: i % 2 === 0 ? Array.from({ length: 10 }, (_, j) => `Option${j}`) : undefined,
        maxLength: i % 4 === 3 ? 100 + i : undefined,
      }));

      const dynamicValues: Record<string, any> = {};
      complexFields.forEach((field, i) => {
        dynamicValues[`pdfField_${field.name}`] = `value${i}`;
      });

      const startTime = Date.now();
      const result = uiGenerator.validateDynamicFieldConfiguration(dynamicValues, complexFields);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });
});