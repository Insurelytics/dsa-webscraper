function extractAmount(amountStr) {
    if (!amountStr) return null;
    const cleanStr = String(amountStr).replace(/[$,\s]/g, '');
    const amount = parseFloat(cleanStr);
    return isNaN(amount) ? null : amount;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Common date formats to try
    const dateFormats = [
        // Try parsing as is first
        () => new Date(dateStr),
        // MM/DD/YYYY format
        () => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const month = parseInt(parts[0]) - 1; // JavaScript months are 0-indexed
                const day = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                return new Date(year, month, day);
            }
            return null;
        }
    ];
    
    for (const formatFunc of dateFormats) {
        try {
            const date = formatFunc();
            if (date && !isNaN(date.getTime())) {
                return date;
            }
        } catch (e) {
            continue;
        }
    }
    
    return null;
}

module.exports = { extractAmount, parseDate }; 