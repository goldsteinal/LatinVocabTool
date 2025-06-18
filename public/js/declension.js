/**
 * Declension fetching functionality for Latin nouns
 * Uses Wiktionary API to retrieve declension tables
 */

// Main function to fetch Latin declension from Wiktionary
async function fetchLatinDeclension(word) {
    if (!word || !word.trim()) {
        throw new Error('Please provide a Latin word');
    }
    
    try {
        // Use Wiktionary API to get page content
        const apiUrl = `https://en.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(word.trim())}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Word "${word}" not found in Wiktionary`);
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const declensionData = parseDeclensionTable(doc, word);
        
        if (!declensionData || declensionData.length === 0) {
            throw new Error(`No declension table found for "${word}"`);
        }
        
        return declensionData;
        
    } catch (error) {
        console.error('Error fetching declension:', error);
        throw error;
    }
}

// Parse declension table from Wiktionary HTML
function parseDeclensionTable(doc, word) {
    // Look for tables with the specific Wiktionary Latin declension structure
    const tables = doc.querySelectorAll('table.inflection-table-la');
    
    for (let table of tables) {
        const result = extractLatinDeclensionFromTable(table);
        if (result && result.length > 0) {
            return result;
        }
    }
    
    // Fallback: look for any table with Latin declension structure
    const allTables = doc.querySelectorAll('table');
    for (let table of allTables) {
        // Check if table contains spans with lang="la"
        const latinSpans = table.querySelectorAll('span[lang="la"]');
        if (latinSpans.length > 0) {
            const result = extractLatinDeclensionFromTable(table);
            if (result && result.length > 0) {
                return result;
            }
        }
    }
    
    // Additional fallback: look for tables with "inflection" in class name
    const inflectionTables = doc.querySelectorAll('table[class*="inflection"]');
    for (let table of inflectionTables) {
        const result = extractLatinDeclensionFromTable(table);
        if (result && result.length > 0) {
            return result;
        }
    }
    
    return null;
}

// Extract Latin declension data from a table element
function extractLatinDeclensionFromTable(table) {
    const cases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative', 'vocative'];
    const declension = {};
    
    const rows = table.querySelectorAll('tr');
    
    for (let row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length < 2) continue; // Need at least case and one form
        
        const firstCell = cells[0];
        const firstCellText = firstCell.textContent.toLowerCase().trim();
        
        // Check if this row contains a case name
        const caseMatch = cases.find(caseName => 
            firstCellText.includes(caseName) || 
            firstCellText.includes(caseName.substring(0, 3)) // Handle abbreviations like "nom", "gen"
        );
        
        if (caseMatch) {
            // Try to extract singular and plural forms
            let singular = '';
            let plural = '';
            
            // Look for patterns in the table structure
            if (cells.length >= 3) {
                // Standard format: Case | Singular | Plural
                singular = extractLatinTextFromCell(cells[1]);
                plural = extractLatinTextFromCell(cells[2]);
            } else if (cells.length === 2) {
                // Alternative format: Case | Forms (may contain both singular and plural)
                const forms = extractLatinTextFromCell(cells[1]);
                // Try to split forms if they contain multiple entries
                const formParts = forms.split(/[,;]/).map(f => f.trim()).filter(f => f);
                if (formParts.length >= 2) {
                    singular = formParts[0];
                    plural = formParts[1];
                } else {
                    singular = forms;
                }
            }
            
            if (singular || plural) {
                declension[caseMatch] = {
                    singular: singular || '',
                    plural: plural || ''
                };
            }
        }
    }
    
    // Convert to array format for consistency with the original structure
    const result = [];
    const targetCases = ['nominative', 'genitive', 'dative', 'accusative', 'ablative'];
    
    targetCases.forEach(caseName => {
        if (declension[caseName]) {
            result.push({
                case: caseName,
                singular: declension[caseName].singular,
                plural: declension[caseName].plural
            });
        }
    });
    
    return result.length > 0 ? result : null;
}

// Extract Latin text from a table cell
function extractLatinTextFromCell(cell) {
    // First, try to find spans with lang="la"
    const latinSpans = cell.querySelectorAll('span[lang="la"]');
    
    if (latinSpans.length > 0) {
        // Get text from all Latin spans, separated by commas if multiple
        const latinTexts = Array.from(latinSpans).map(span => {
            // Check if there's a link inside the span
            const link = span.querySelector('a');
            if (link) {
                return cleanLatinText(link.textContent);
            }
            
            // Otherwise get the span text directly
            return cleanLatinText(span.textContent);
        }).filter(text => text);
        
        return latinTexts.join(', ');
    }
    
    // Fallback: look for links with Latin text
    const links = cell.querySelectorAll('a');
    if (links.length > 0) {
        const latinTexts = Array.from(links).map(link => cleanLatinText(link.textContent)).filter(text => text);
        if (latinTexts.length > 0) {
            return latinTexts.join(', ');
        }
    }
    
    // Final fallback: get cell text directly (less reliable)
    const cellText = cleanLatinText(cell.textContent);
    
    // Filter out common non-Latin indicators
    if (cellText && !cellText.match(/^(—|–|[0-9]+|case|singular|plural|form)/i)) {
        return cellText;
    }
    
    return '';
}

// Clean up Latin text - remove extra whitespace, HTML artifacts
function cleanLatinText(text) {
    return text
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/[[\]()]/g, '') // Remove brackets and parentheses
        .replace(/[0-9]+/g, '') // Remove numbers
        .trim();
}

// Test function to verify declension fetching works
async function testDeclension(word = 'rosa') {
    try {
        console.log(`Testing declension for: ${word}`);
        const result = await fetchLatinDeclension(word);
        console.log('Declension result:', result);
        return result;
    } catch (error) {
        console.error('Test failed:', error);
        return null;
    }
}

// Utility function to format declension for display
function formatDeclensionForDisplay(declensionArray) {
    if (!declensionArray || declensionArray.length === 0) {
        return 'No declension data available';
    }
    
    let formatted = '';
    declensionArray.forEach(item => {
        formatted += `${item.case.charAt(0).toUpperCase() + item.case.slice(1)}: `;
        formatted += `${item.singular || '—'} / ${item.plural || '—'}\n`;
    });
    
    return formatted.trim();
}