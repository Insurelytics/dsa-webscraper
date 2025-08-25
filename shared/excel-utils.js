/**
 * Shared Excel generation utility for DGS project data
 * Works in both browser and Node.js environments
 */

function generateProjectsExcel(projects) {
    if (!projects || projects.length === 0) return null;
    
    // Get all unique keys from all projects to create comprehensive headers
    const allKeys = new Set();
    projects.forEach(project => {
        Object.keys(project).forEach(key => allKeys.add(key));
    });
    
    // Filter out columns that are completely empty or only contain empty strings
    const keysWithData = Array.from(allKeys).filter(key => {
        return projects.some(project => {
            const value = project[key];
            return value !== null && value !== undefined && value !== '' && String(value).trim() !== '';
        });
    });
    
    // Order the headers based on the sample structure
    const orderedHeaders = [
        'Project Name', 'Address', 'City', 'Zip',
        'Project Scope',
        'Received Date', 'Approved Date', 'Closed Date',
        'Estimated Amt', 'Contracted Amt', 'Construction Change Document Amt',
        'url',
    ];
    
    // Log any remaining keys that weren't in the ordered list, but only if they have data for debugging
    const remainingKeys = keysWithData.filter(key => !orderedHeaders.includes(key));
    console.log('Remaining keys:', remainingKeys);
    const headers = [...orderedHeaders];
    
    // Node.js environment - use xlsx library
    if (typeof require !== 'undefined') {
        try {
            // Try to resolve xlsx from server directory first
            let XLSX;
            try {
                XLSX = require('xlsx');
            } catch (e) {
                // Fallback to server's node_modules
                const path = require('path');
                const serverDir = path.resolve(__dirname, '..', 'server');
                XLSX = require(path.join(serverDir, 'node_modules', 'xlsx'));
            }
            
            // Create worksheet data with proper handling for URLs
            const worksheetData = [
                headers,
                ...projects.map(project => 
                    headers.map(header => {
                        const value = project[header] || '';
                        // If this is the url column and it has a value, make it a clickable hyperlink
                        if (header === 'url' && value && typeof value === 'string' && value.trim()) {
                            return { f: `HYPERLINK("${value.trim()}", "${value.trim()}")` };
                        }
                        return value;
                    })
                )
            ];
            
            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
            
            // Generate buffer
            return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            
        } catch (error) {
            console.error('Error generating Excel file:', error);
            return null;
        }
    }
    
    // Browser environment - return structured data for frontend Excel generation
    return {
        headers,
        data: projects.map(project => 
            headers.map(header => {
                const value = project[header] || '';
                // If this is the url column and it has a value, mark it for hyperlink handling
                if (header === 'url' && value && typeof value === 'string' && value.trim()) {
                    return { type: 'hyperlink', value: value.trim() };
                }
                return value;
            })
        )
    };
}

// Export for both CommonJS (Node.js) and ES modules (browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateProjectsExcel };
} else if (typeof window !== 'undefined') {
    window.ExcelUtils = { generateProjectsExcel };
}
