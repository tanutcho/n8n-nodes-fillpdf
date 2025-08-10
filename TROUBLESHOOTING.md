# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the n8n-nodes-fillpdf community node.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [PDF Processing Issues](#pdf-processing-issues)
- [Performance Problems](#performance-problems)
- [Environment-Specific Issues](#environment-specific-issues)
- [Debug Mode](#debug-mode)
- [Getting Help](#getting-help)

## Quick Diagnostics

Run these commands to quickly identify common issues:

```bash
# Check Python installation
python3 --version

# Check fillpdf installation
python3 -c "import fillpdf; print('fillpdf version:', fillpdf.__version__)"

# Check Node.js version
node --version

# Check n8n version
n8n --version

# Check if node is installed
npm list n8n-nodes-fillpdf

# Check system resources
free -h  # Linux memory
df -h    # Disk space
ps aux | grep n8n  # n8n processes

# Check Python path
which python3
echo $PATH

# Test basic PDF processing
python3 -c "
import fillpdf
import tempfile
print('fillpdf basic test passed')
"
```

## Installation Issues

### Issue: "Package not found" during installation

**Error Message:**
```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/n8n-nodes-fillpdf
```

**Possible Causes:**
- Network connectivity issues
- npm registry problems
- Incorrect package name

**Solutions:**

1. **Check package name spelling**:
   ```bash
   npm search n8n-nodes-fillpdf
   ```

2. **Try different registry**:
   ```bash
   npm install n8n-nodes-fillpdf --registry https://registry.npmjs.org/
   ```

3. **Clear npm cache**:
   ```bash
   npm cache clean --force
   npm install n8n-nodes-fillpdf
   ```

4. **Check network connectivity**:
   ```bash
   curl -I https://registry.npmjs.org/
   ```

### Issue: "Permission denied" during installation

**Error Message:**
```
npm ERR! Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**

1. **Use sudo (Linux/macOS)**:
   ```bash
   sudo npm install -g n8n-nodes-fillpdf
   ```

2. **Change npm permissions**:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

3. **Use npx for temporary installation**:
   ```bash
   npx n8n-nodes-fillpdf
   ```

### Issue: Node doesn't appear in n8n palette

**Possible Causes:**
- n8n not restarted after installation
- Installation in wrong directory
- Node registration failed

**Solutions:**

1. **Restart n8n completely**:
   ```bash
   # Stop n8n
   pkill -f n8n
   
   # Start n8n
   n8n start
   ```

2. **Check installation location**:
   ```bash
   # Check global installation
   npm list -g n8n-nodes-fillpdf
   
   # Check local installation
   npm list n8n-nodes-fillpdf
   ```

3. **Reinstall the node**:
   ```bash
   npm uninstall n8n-nodes-fillpdf
   npm install n8n-nodes-fillpdf
   ```

4. **Clear browser cache** and refresh n8n interface

## Runtime Errors

### Issue: "Python not found"

**Error Message:**
```
Error: spawn python3 ENOENT
```

**Possible Causes:**
- Python not installed
- Python not in system PATH
- Wrong Python executable name

**Solutions:**

1. **Install Python**:
   ```bash
   # Ubuntu/Debian
   sudo apt install python3
   
   # macOS
   brew install python3
   
   # Windows: Download from python.org
   ```

2. **Check Python PATH**:
   ```bash
   which python3
   echo $PATH
   ```

3. **Add Python to PATH**:
   ```bash
   # Linux/macOS
   export PATH="/usr/bin/python3:$PATH"
   
   # Windows: Add to system PATH via Environment Variables
   ```

4. **Use specific Python path**:
   ```bash
   export N8N_PYTHON_PATH="/usr/bin/python3"
   ```

### Issue: "fillpdf module not found"

**Error Message:**
```
ModuleNotFoundError: No module named 'fillpdf'
```

**Solutions:**

1. **Install fillpdf**:
   ```bash
   pip3 install fillpdf
   ```

2. **Check installation**:
   ```bash
   pip3 list | grep fillpdf
   python3 -c "import fillpdf; print('OK')"
   ```

3. **Install in correct environment**:
   ```bash
   # If using virtual environment
   source venv/bin/activate
   pip install fillpdf
   
   # If using conda
   conda activate your-env
   pip install fillpdf
   ```

4. **Use system Python**:
   ```bash
   python3 -m pip install fillpdf
   ```

### Issue: "NodeOperationError" during execution

**Error Message:**
```
NodeOperationError: PDF processing failed
```

**Possible Causes:**
- Invalid PDF file
- Corrupted input data
- Missing required parameters
- Python script errors

**Solutions:**

1. **Check PDF file validity**:
   ```bash
   # Test with a simple PDF viewer
   # Ensure PDF has fillable form fields
   ```

2. **Validate input parameters**:
   - Ensure all required fields are filled
   - Check field mapping configuration
   - Verify PDF source is accessible

3. **Enable debug logging**:
   ```bash
   export DEBUG=n8n-nodes-fillpdf:*
   n8n start
   ```

4. **Test with minimal configuration**:
   - Use a simple PDF with one text field
   - Use static values instead of expressions
   - Test with binary output format

## PDF Processing Issues

### Issue: "Field extraction failed"

**Error Message:**
```
Error: Failed to extract fields from PDF
```

**Possible Causes:**
- Network connectivity issues (URL sources)
- PDF access permissions
- Corrupted PDF file
- PDF extraction timeout

**Solutions:**

**For URL Sources:**
1. **Check URL accessibility**:
   ```bash
   curl -I https://your-pdf-url.com/file.pdf
   ```

2. **Verify PDF validity**:
   - Open URL in browser to test access
   - Check for authentication requirements
   - Ensure PDF is not password protected

3. **Enable manual field mapping**:
   - Toggle "Use Manual Field Mapping" option
   - Configure fields manually as fallback

**For Upload/Binary Sources:**
1. **Check PDF file integrity**:
   - Open PDF in a PDF viewer
   - Verify file is not corrupted
   - Ensure PDF has fillable form fields

2. **Review execution logs**:
   - Check workflow execution logs for extracted field information
   - Fields are displayed during runtime execution
   - Use logged field names for manual mapping

### Issue: "Field extraction timeout"

**Error Message:**
```
Field extraction timed out after 30 seconds
```

**Symptoms:**
- Loading indicator stuck on "Extracting fields..."
- Node interface doesn't update with fields

**Solutions:**

1. **Check PDF file size**:
   ```bash
   # Keep PDF files under 50MB for optimal performance
   ls -lh your-pdf-file.pdf
   ```

2. **Verify network speed** (URL sources):
   - Test download speed of PDF URL
   - Use local/cached PDF if possible

3. **Clear cache and retry**:
   - Restart n8n to clear field extraction cache
   - Try refreshing the node configuration

4. **Use manual field mapping**:
   - Enable manual mode as fallback
   - Configure fields manually while extraction issues are resolved

### Issue: "PDF has no fillable fields"

**Error Message:**
```
Error: No fillable fields found in PDF
```

**Possible Causes:**
- PDF is not a form (just text/images)
- PDF fields are flattened
- PDF is password protected

**Solutions:**

1. **Check PDF in a PDF viewer**:
   - Open PDF in Adobe Reader
   - Look for fillable form fields
   - Try clicking on suspected field areas

2. **Create fillable PDF**:
   - Use Adobe Acrobat to add form fields
   - Use online PDF form creators
   - Convert existing PDF to fillable form

3. **Test with known fillable PDF**:
   ```bash
   # Download a test PDF with form fields
   wget https://www.irs.gov/pub/irs-pdf/fw4.pdf
   ```

### Issue: "Field mapping failed"

**Error Message:**
```
Error: Field 'fieldName' not found in PDF
```

**Solutions:**

**For URL Sources (with automatic field extraction):**
1. **Use dynamic field inputs**:
   - Fields should appear automatically in the interface
   - Use the generated input controls instead of manual mapping
   - If fields don't appear, check for extraction errors

**For Upload/Binary Sources:**
1. **Check execution logs**:
   - Review workflow execution logs for extracted field names
   - Fields are logged during runtime: "PDF fields extracted: field1, field2..."
   - Use exact field names from logs

2. **Inspect PDF fields manually**:
   ```python
   import fillpdf
   fields = fillpdf.get_form_fields('your-pdf.pdf')
   print(fields)
   ```

3. **Check field names exactly**:
   - Field names are case-sensitive
   - Check for extra spaces or special characters
   - Use the exact field name from PDF

4. **Enable field validation**:
   ```javascript
   {
     "options": {
       "validateFields": true,
       "skipMissingFields": false
     }
   }
   ```

### Issue: "Field extraction cache issues"

**Symptoms:**
- Stale field data for URL sources
- Fields don't update when PDF changes
- Incorrect field types displayed

**Solutions:**

1. **Clear field extraction cache**:
   ```bash
   # Restart n8n to clear all caches
   pkill -f n8n
   n8n start
   ```

2. **Force cache refresh**:
   - Modify PDF URL slightly (add ?v=1 parameter)
   - Change PDF source and change back
   - Wait for cache TTL (5 minutes for URL sources)

3. **Check cache debug info**:
   ```bash
   export DEBUG=n8n-nodes-fillpdf:field-cache
   n8n start
   ```

### Issue: "PDF output is corrupted"

**Possible Causes:**
- Encoding issues during transfer
- Memory limitations
- Python processing errors

**Solutions:**

1. **Use file output instead of binary**:
   ```javascript
   {
     "outputFormat": "file",
     "outputPath": "/tmp/output.pdf"
   }
   ```

2. **Check file size limits**:
   ```bash
   # Check available memory
   free -h
   
   # Check disk space
   df -h
   ```

3. **Test with smaller PDF**:
   - Reduce PDF file size
   - Process fewer fields at once
   - Use batch processing

## Performance Problems

### Issue: Slow PDF processing

**Symptoms:**
- Long execution times
- High memory usage
- Timeouts

**Solutions:**

1. **Increase timeout**:
   ```javascript
   {
     "options": {
       "timeout": 60000  // 60 seconds
     }
   }
   ```

2. **Optimize memory usage**:
   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

3. **Process in batches**:
   ```javascript
   // Split large datasets into smaller chunks
   // Process one PDF at a time
   ```

4. **Use file-based processing**:
   ```javascript
   {
     "outputFormat": "file"  // Instead of binary
   }
   ```

### Issue: Memory errors

**Error Message:**
```
JavaScript heap out of memory
```

**Solutions:**

1. **Increase memory limit**:
   ```bash
   node --max-old-space-size=8192 node_modules/n8n/bin/n8n start
   ```

2. **Process smaller batches**:
   - Limit items per execution
   - Use pagination for large datasets

3. **Use streaming for large files**:
   - Process PDFs one at a time
   - Clear memory between operations

## Environment-Specific Issues

### Docker Issues

#### Issue: Python not available in container

**Solutions:**

1. **Install Python in Dockerfile**:
   ```dockerfile
   FROM n8nio/n8n:latest
   USER root
   RUN apk add --no-cache python3 py3-pip
   RUN pip3 install fillpdf
   USER node
   ```

2. **Runtime installation**:
   ```bash
   docker exec -it n8n-container sh
   apk add --no-cache python3 py3-pip
   pip3 install fillpdf
   ```

#### Issue: File permissions in Docker

**Solutions:**

1. **Fix file permissions**:
   ```bash
   docker exec -it n8n-container chown -R node:node /data
   ```

2. **Use proper volume mounts**:
   ```yaml
   volumes:
     - ./data:/home/node/.n8n:rw
   ```

### Windows Issues

#### Issue: Path separator problems

**Solutions:**

1. **Use forward slashes**:
   ```javascript
   "outputPath": "C:/temp/output.pdf"  // Instead of C:\temp\output.pdf
   ```

2. **Use environment variables**:
   ```javascript
   "outputPath": "%TEMP%/output.pdf"
   ```

#### Issue: Long path limitations

**Solutions:**

1. **Enable long paths in Windows**:
   ```cmd
   # Run as Administrator
   reg add HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled /t REG_DWORD /d 1
   ```

2. **Use shorter paths**:
   ```javascript
   "outputPath": "C:/temp/out.pdf"  // Shorter path
   ```

## Debug Mode

### Enable Debug Logging

1. **Environment variable**:
   ```bash
   export DEBUG=n8n-nodes-fillpdf:*
   n8n start
   ```

2. **n8n log level**:
   ```bash
   export N8N_LOG_LEVEL=debug
   n8n start
   ```

3. **Node-specific debugging**:
   ```bash
   export DEBUG=n8n-nodes-fillpdf:python-bridge,n8n-nodes-fillpdf:validation
   ```

### Debug Information to Collect

When reporting issues, include:

1. **System information**:
   ```bash
   uname -a
   node --version
   python3 --version
   pip3 list | grep fillpdf
   ```

2. **n8n information**:
   ```bash
   n8n --version
   npm list n8n-nodes-fillpdf
   ```

3. **Error logs**:
   - Full error messages
   - Stack traces
   - Debug output

4. **Configuration**:
   - Node parameters (sanitized)
   - Workflow JSON (if possible)
   - Environment variables

### Test Scripts

Create test scripts to isolate issues:

```javascript
// test-fillpdf.js
const { spawn } = require('child_process');

const python = spawn('python3', ['-c', 'import fillpdf; print("OK")']);
python.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});
python.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});
```

```python
# test-fillpdf.py
import fillpdf
import sys

try:
    print(f"fillpdf version: {fillpdf.__version__}")
    print("fillpdf import successful")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
```

## Getting Help

### Before Asking for Help

1. **Search existing issues** on GitHub
2. **Check documentation** thoroughly
3. **Try the solutions** in this guide
4. **Collect debug information**

### Where to Get Help

1. **GitHub Issues**: For bugs and feature requests
2. **GitHub Discussions**: For questions and ideas
3. **n8n Community Forum**: For n8n-specific questions
4. **Stack Overflow**: Tag with `n8n` and `fillpdf`

### Information to Include

When asking for help, provide:

- **Clear problem description**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **System information**
- **Error messages and logs**
- **Configuration details**
- **What you've already tried**

### Sample Issue Template

```markdown
**Problem Description**
Brief description of the issue

**Environment**
- OS: [e.g., Ubuntu 20.04]
- Node.js: [e.g., 16.14.0]
- Python: [e.g., 3.9.7]
- n8n: [e.g., 0.200.0]
- fillpdf: [e.g., 3.0.0]

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Error Message**
```
Full error message here
```

**Configuration**
```json
{
  "node_parameters": "sanitized_config_here"
}
```

**What I've Tried**
- Solution 1
- Solution 2
- etc.
```

## Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| Python not found | `export PATH="/usr/bin/python3:$PATH"` |
| fillpdf not found | `pip3 install fillpdf` |
| Node not in palette | Restart n8n completely |
| Permission denied | Use `sudo` or fix npm permissions |
| Memory errors | `export NODE_OPTIONS="--max-old-space-size=4096"` |
| PDF no fields | Check PDF has fillable form fields |
| Field not found | Check exact field name spelling |
| Slow processing | Use file output, increase timeout |
| Docker issues | Install Python in container |
| Windows paths | Use forward slashes in paths |

Remember: Most issues are related to Python environment setup or PDF file format problems. Start with the quick diagnostics and work through the solutions systematically.