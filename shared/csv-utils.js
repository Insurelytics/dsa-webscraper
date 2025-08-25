/**
 * Shared CSV generation utility for DGS project data
 * Works in both browser and Node.js environments
 */

function generateProjectsCSV(projects) {
    if (!projects || projects.length === 0) return '';
    
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
    
    // Order the headers based on the sample CSV structure
    // const orderedHeaders_Full = [
    //     '# Of Incr', 'Address', 'Adj Est.Amt#1', 'Adj Est.Amt#2', 'Adj Est.Date#1', 'Adj Est.Date#2',
    //     'Application #', 'Approval Ext. Date', 'Approved Date', 'Auto Fire Detection', 'City',
    //     "Client's Notes", 'Climate Zone', 'Closed Date', 'Complete Submittal Received Date',
    //     'Construction Change Document Amt', 'Contracted Amt', 'EPR Approved Date', 'Energy Efficiency',
    //     'Energy Notes', 'Estimated Amt', 'File #', 'HPI', 'HPI Hours', 'HPI Points', 'Included In Plan',
    //     'OPSC #', 'Office ID', 'PTN #', 'Project Class', 'Project Name', 'Project Scope', 'Project Type',
    //     "Project's Sq.footage", 'Received Date', 'Required', 'Required review services', 'SB 575',
    //     'Special Type', 'Special review type', 'Sprinkler System', 'Zip'
    // ];

    const orderedHeaders = [
        'Project Name', 'Address', 'City', 'Zip',
        'url',
        'Project Scope',
        'Received Date', 'Approved Date', 'Closed Date',
        'Estimated Amt', 'Contracted Amt', 'Construction Change Document Amt'
    ];
    
    // Log any remaining keys that weren't in the ordered list, but only if they have data for debugging
    const remainingKeys = keysWithData.filter(key => !orderedHeaders.includes(key));
    console.log('Remaining keys:', remainingKeys);
    headers = [...orderedHeaders];
    
    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...projects.map(project => 
            headers.map(header => {
                const value = project[header] || '';
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    return csvContent;
}

// Export for both CommonJS (Node.js) and ES modules (browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateProjectsCSV };
} else if (typeof window !== 'undefined') {
    window.CSVUtils = { generateProjectsCSV };
}
