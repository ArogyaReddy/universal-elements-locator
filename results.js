/* global chrome */
// Results page JavaScript for Universal Element Locator Extension
// This file handles the detailed results page functionality

let scanResults = null;
let filteredElements = [];
let currentPage = 1;
const itemsPerPage = 50;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    await loadScanResults();
    setupEventListeners();
});

async function loadScanResults() {
    try {
        const result = await chrome.storage.local.get(['scanResults']);
        console.log('🔍 Debug: Raw storage result:', result);
        
        if (result.scanResults) {
            scanResults = result.scanResults;
            console.log('✅ Debug: scanResults loaded:', {
                hasElements: !!scanResults.elements,
                elementsLength: scanResults.elements ? scanResults.elements.length : 'undefined',
                elementsType: typeof scanResults.elements,
                firstElement: scanResults.elements && scanResults.elements[0] ? scanResults.elements[0] : 'none'
            });
            displayResults();
        } else {
            console.log('❌ Debug: No scanResults in storage');
            showNoData();
        }
    } catch (error) {
        console.error('Error loading scan results:', error);
        showNoData();
    }
}

function displayResults() {
    if (!scanResults) return;

    // Update header info
    document.getElementById('pageUrl').textContent = scanResults.url || 'Unknown';
    document.getElementById('pageTitle').textContent = scanResults.title || 'Unknown';
    document.getElementById('scanDate').textContent = scanResults.timestamp ? 
        new Date(scanResults.timestamp).toLocaleString() : 'Unknown';
    document.getElementById('scanDuration').textContent = `${scanResults.duration || 0}ms`;

    // Update statistics
    displayStatistics();

    // Populate filters
    populateFilterOptions();

    // Display elements - set initial filtered elements without calling applyFilters
    const rawElements = scanResults.elements || [];
    filteredElements = rawElements; // Don't apply filters initially
    console.log('🔍 Debug: filteredElements after assignment:', {
        length: filteredElements.length,
        type: typeof filteredElements,
        isArray: Array.isArray(filteredElements),
        firstElement: filteredElements[0] || 'none'
    });
    
    // Validate data quality
    if (filteredElements.length > 0) {
        const firstElement = filteredElements[0];
        const dataQuality = {
            hasAttributes: firstElement.attributes && Object.keys(firstElement.attributes).length > 0,
            hasContext: firstElement.context && Object.keys(firstElement.context).length > 0,
            hasLocators: firstElement.locators && (
                (firstElement.locators.primary && firstElement.locators.primary.length > 0) ||
                (firstElement.locators.secondary && firstElement.locators.secondary.length > 0) ||
                (firstElement.locators.fallback && firstElement.locators.fallback.length > 0)
            ),
            hasTextContent: firstElement.textContent && Object.keys(firstElement.textContent).length > 0,
            hasElementState: firstElement.elementState && Object.keys(firstElement.elementState).length > 0
        };
        
        console.log('🔍 Debug: Data quality check:', dataQuality);
        console.log('🔍 Debug: First element full data:', firstElement);
        
        // If data appears to be empty across the board, log a warning
        const emptyDataFields = Object.values(dataQuality).filter(Boolean).length;
        if (emptyDataFields < 3) {
            console.warn('⚠️ Warning: Most element data fields appear to be empty. This suggests a data extraction issue.');
        }
    }
    
    displayElements();
}

function displayStatistics() {
    const stats = [
        { label: 'Total Elements', value: scanResults.totalElements || 0, color: '#667eea' },
        { label: 'Primary Locators', value: scanResults.elementsWithPrimary || 0, color: '#10b981' },
        { label: 'Secondary Locators', value: scanResults.elementsWithSecondary || 0, color: '#f59e0b' },
        { label: 'Shadow DOM', value: scanResults.shadowDOMElements || 0, color: '#8b5cf6' }
    ];

    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = stats.map(stat => `
        <div class="stat-card" style="background: linear-gradient(135deg, ${stat.color}, ${stat.color}dd)">
            <div class="stat-number">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        </div>
    `).join('');
}

function displayElements() {
    console.log('🔍 Debug: displayElements() called with filteredElements.length:', filteredElements.length);
    
    const container = document.getElementById('elementsContainer');
    console.log('🔍 Debug: elementsContainer found:', !!container);
    
    if (filteredElements.length === 0) {
        console.log('❌ Debug: No filtered elements - showing no data message');
        container.innerHTML = '<div class="no-data">No elements found matching the current filters.</div>';
        return;
    }

    console.log('✅ Debug: Rendering', filteredElements.length, 'elements');

    // Calculate pagination
    const totalPages = Math.ceil(filteredElements.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageElements = filteredElements.slice(startIndex, endIndex);

    console.log('🔍 Debug: Pagination info:', { totalPages, startIndex, endIndex, pageElementsLength: pageElements.length });

    // Create simplified table controls (no longer needed since controls moved to main section)
    const controlsHtml = `
        <div class="results-summary">
            <span>Showing ${pageElements.length} of ${filteredElements.length} elements (Page ${currentPage} of ${totalPages})</span>
        </div>
    `;

    const tableContent = `
        <div class="table-wrapper">
            <table class="elements-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Element Name</th>
                        <th>Tag</th>
                        <th>Text Content</th>
                        <th>Attributes</th>
                        <th>Context</th>
                        <th>State</th>
                        <th>Primary Locators</th>
                        <th>Secondary Locators</th>
                        <th>Fallback Locators</th>
                        <th>Position & Size</th>
                        <th>Styling</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageElements.map((element, index) => createElementRow(element, startIndex + index)).join('')}
                </tbody>
            </table>
        </div>
    `;

    const pagination = createPagination(totalPages);
    const finalHTML = controlsHtml + tableContent + pagination;
    
    console.log('🔍 Debug: Setting container innerHTML, length:', finalHTML.length);
    container.innerHTML = finalHTML;
    console.log('✅ Debug: Container innerHTML set successfully');
}

function createElementRow(element, index) {
    try {
        console.log('🔍 Debug: Creating row for element:', element);
        console.log('🔍 Debug: Element structure keys:', Object.keys(element));
        console.log('🔍 Debug: Element textContent:', element.textContent);
        console.log('🔍 Debug: Element text:', element.text);
        console.log('🔍 Debug: Element attributes:', element.attributes);
        console.log('🔍 Debug: Element locators:', element.locators);
        
        const shadowIndicator = element.isShadowDOM ? '<span class="shadow-indicator">🌑</span>' : '';
        
        // Generate element name based on available attributes
        const elementName = generateElementName(element);

        // Ensure locators exist and provide safe defaults
        const locators = element.locators || { primary: [], secondary: [], fallback: [] };
        
        console.log('🔍 Debug: Processed locators for row:', {
            primary: locators.primary.length,
            secondary: locators.secondary.length, 
            fallback: locators.fallback.length
        });

        return `
            <tr class="element-row" data-element-index="${index}">
                <td class="index-cell">${index + 1}</td>
                <td class="name-cell">
                    <span class="element-name" title="${elementName}">${elementName}</span>
                </td>
                <td class="tag-cell">
                    <span class="element-tag">${safeString(element.tagName).toUpperCase()}</span> ${shadowIndicator}
                    ${element.elementState?.isInteractive ? '<span class="interactive-indicator" title="Interactive element">🔗</span>' : ''}
                    ${element.elementState?.isFormElement ? '<span class="form-indicator" title="Form element">📝</span>' : ''}
                </td>
                <td class="text-cell">
                    ${createTextContentDisplay(element)}
                </td>
                <td class="attributes-cell">
                    ${createAttributesDisplay(element.attributes || {})}
                </td>
                <td class="context-cell">
                    ${createContextDisplay(element.context || {})}
                </td>
                <td class="state-cell">
                    ${createStateDisplay(element.elementState || {})}
                </td>
                <td class="locators-cell">${createLocatorsList(locators.primary, 'primary')}</td>
                <td class="locators-cell">${createLocatorsList(locators.secondary, 'secondary')}</td>
                <td class="locators-cell">${createLocatorsList(locators.fallback, 'fallback')}</td>
                <td class="position-cell">
                    ${createPositionDisplay(element.position || {})}
                </td>
                <td class="styling-cell">
                    ${createStylingDisplay(element.styling || {})}
                </td>
            </tr>
        `;
    } catch (error) {
        console.error('❌ Error creating element row:', error, element);
        console.error('❌ Error stack:', error.stack);
        return `<tr><td colspan="12">Error rendering element ${index + 1}: ${error.message}</td></tr>`;
    }
}

function generateElementName(element) {
    // Try to generate a meaningful name from various element attributes
    
    // 1. Check for data-testid, id, name attributes in primary locators
    if (element.locators && element.locators.primary) {
        for (const locator of element.locators.primary) {
            if (locator.type === 'data-testid' && locator.selector) {
                const match = locator.selector.match(/data-testid="([^"]+)"/);
                if (match) return match[1];
            }
            if (locator.type === 'id' && locator.selector) {
                const match = locator.selector.match(/#([^.\s[]+)/);
                if (match) return match[1];
            }
        }
    }
    
    // 2. Check for aria-label
    if (element.locators && element.locators.primary) {
        for (const locator of element.locators.primary) {
            if (locator.type === 'aria-label' && locator.selector) {
                const match = locator.selector.match(/aria-label="([^"]+)"/);
                if (match) return match[1];
            }
        }
    }
    
    // 3. Use element text if available and meaningful
    const textValue = safeString(element.text);
    if (textValue && safeTrim(textValue).length > 0 && textValue.length <= 50) {
        return safeTrim(textValue);
    }
    
    // 4. Check for name attribute in secondary locators
    if (element.locators && element.locators.secondary) {
        for (const locator of element.locators.secondary) {
            if (locator.selector && locator.selector.includes('name=')) {
                const match = locator.selector.match(/name="([^"]+)"/);
                if (match) return match[1];
            }
        }
    }
    
    // 5. Check for class names that might be meaningful
    if (element.locators && element.locators.secondary) {
        for (const locator of element.locators.secondary) {
            if (locator.type === 'class' && locator.selector) {
                const match = locator.selector.match(/\.([^.\s[]+)/);
                if (match && !match[1].match(/^(btn|button|input|div|span|container)$/i)) {
                    return match[1];
                }
            }
        }
    }
    
    // 6. Default to tag name with index
    return `${safeString(element.tagName).toLowerCase()}_element`;
}

function createLocatorsList(locators, type) {
    console.log(`🔍 Debug: createLocatorsList called with:`, locators, type);
    
    if (!locators || locators.length === 0) {
        console.log(`🔍 Debug: No locators for type ${type}, returning dash`);
        return '-';
    }
    
    console.log(`🔍 Debug: Found ${locators.length} locators for type ${type}`);
    
    const locatorId = `locators_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return `<div class="locators-list" data-locator-id="${locatorId}">
        <div class="locators-header">
            <button class="copy-btn" data-action="copy-all" data-type="${type}" title="Copy all ${type} locators">
                📋 Copy All ${safeString(type).charAt(0).toUpperCase() + safeString(type).slice(1)}
            </button>
        </div>
        ${locators.map((loc) => 
            `<div class="locator-item locator-${type}" data-locator="${escapeHtml(loc.selector)}">
                <div class="locator-content">
                    <div class="locator-type">${loc.type}</div>
                    <div class="locator-value" title="${escapeHtml(loc.selector)}">${escapeHtml(loc.selector)}</div>
                </div>
                <button class="copy-single-btn" data-action="copy-single" data-locator="${escapeHtml(loc.selector)}" title="Copy this locator">📋</button>
            </div>`
        ).join('')}
    </div>`;
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) {
        return '';
    }
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Helper function to safely get string value
function safeString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}

// Helper function to safely trim a string
function safeTrim(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyNotification('Copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showCopyNotification('Copied to clipboard!');
        } catch (fallbackErr) {
            showCopyNotification('Failed to copy', true);
        }
        document.body.removeChild(textArea);
    }
}

function showCopyNotification(message, isError = false) {
    // Remove existing notification
    const existing = document.querySelector('.copy-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `copy-notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isError ? '#ef4444' : '#10b981'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function createPagination(totalPages) {
    if (totalPages <= 1) return '';

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        pages.push(`
            <button data-page="${i}" ${i === currentPage ? 'class="active"' : ''}>
                ${i}
            </button>
        `);
    }

    return `
        <div class="pagination">
            <button data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
                ← Previous
            </button>
            ${pages.join('')}
            <button data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
                Next →
            </button>
        </div>
    `;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredElements.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayElements();
}

function setupEventListeners() {
    // Main controls event listeners (for elements that exist on page load)
    const mainSearchBox = document.getElementById('searchBox');
    if (mainSearchBox) {
        mainSearchBox.addEventListener('input', applyFilters);
    }

    const searchClearBtn = document.getElementById('searchClear');
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', function() {
            document.getElementById('searchBox').value = '';
            applyFilters();
        });
    }

    const confidenceFilter = document.getElementById('confidenceFilter');
    if (confidenceFilter) {
        confidenceFilter.addEventListener('change', applyFilters);
    }

    const tagFilter = document.getElementById('tagFilter');
    if (tagFilter) {
        tagFilter.addEventListener('change', applyFilters);
    }

    const exportCSVBtn = document.getElementById('exportCSV');
    if (exportCSVBtn) {
        exportCSVBtn.addEventListener('click', exportToCSV);
    }

    const exportJSONBtn = document.getElementById('exportJSON');
    if (exportJSONBtn) {
        exportJSONBtn.addEventListener('click', exportToJSON);
    }

    const stateFilter = document.getElementById('stateFilter');
    if (stateFilter) {
        stateFilter.addEventListener('change', applyFilters);
    }

    const locatorFilter = document.getElementById('locatorFilter');
    if (locatorFilter) {
        locatorFilter.addEventListener('change', applyFilters);
    }

    const compactViewBtn = document.getElementById('compactView');
    if (compactViewBtn) {
        compactViewBtn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
            compactViewBtn.classList.add('active');
            toggleView(true);
        });
    }

    const detailedViewBtn = document.getElementById('detailedView');
    if (detailedViewBtn) {
        detailedViewBtn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
            detailedViewBtn.classList.add('active');
            toggleView(false);
        });
    }

    // Table event listeners (for dynamically added elements like pagination and copy buttons)
    document.getElementById('elementsContainer').addEventListener('click', function(event) {

        // Pagination event delegation
        if (event.target.tagName === 'BUTTON' && event.target.hasAttribute('data-page')) {
            const page = parseInt(event.target.getAttribute('data-page'));
            if (!isNaN(page)) {
                goToPage(page);
            }
        }
        
        // Copy button event delegation
        if (event.target.hasAttribute('data-action')) {
            const action = event.target.getAttribute('data-action');
            
            if (action === 'copy-single') {
                const locator = event.target.getAttribute('data-locator');
                if (locator) {
                    copyToClipboard(locator);
                }
            } else if (action === 'copy-all') {
                const type = event.target.getAttribute('data-type');
                const container = event.target.closest('.locators-list');
                if (container && type) {
                    const locatorItems = container.querySelectorAll('.locator-item');
                    const locators = Array.from(locatorItems).map(item => {
                        const typeSpan = item.querySelector('.locator-type');
                        const valueSpan = item.querySelector('.locator-value');
                        return `${typeSpan.textContent} ${valueSpan.textContent}`;
                    });
                    
                    const text = locators.join('\n');
                    copyToClipboard(text);
                }
            }
        }
    });
}

// Helper function to create text content display
function createTextContentDisplay(element) {
    console.log('🔍 Debug: createTextContentDisplay called with element:', element);
    
    // Try multiple possible text sources
    const possibleTexts = [
        element.textContent?.cleanText,
        element.textContent?.innerText,
        element.textContent?.textContent,
        element.text,
        element.innerText,
        element.textContent
    ];
    
    console.log('🔍 Debug: Possible text sources:', possibleTexts);
    
    const actualText = possibleTexts.find(text => {
        const textStr = safeString(text);
        return textStr && safeTrim(textStr).length > 0;
    });
    
    if (!actualText) {
        return '<span class="no-text">No text content</span>';
    }
    
    const textStr = safeString(actualText);
    const safeSubstring = textStr.length > 40 ? textStr.substring(0, 40) : textStr;
    return `
        <div class="text-content-display">
            <div class="text-summary" title="${escapeHtml(textStr)}">
                ${escapeHtml(safeSubstring)}${textStr.length > 40 ? '...' : ''}
            </div>
        </div>
    `;
}

// Helper function to create attributes display
function createAttributesDisplay(attributes) {
    console.log('🔍 Debug: createAttributesDisplay called with:', attributes);
    
    if (!attributes || typeof attributes !== 'object') {
        return '<span class="no-attributes">No attributes</span>';
    }
    
    const attrEntries = Object.entries(attributes);
    console.log('🔍 Debug: Attribute entries:', attrEntries);
    
    if (attrEntries.length === 0) {
        return '<span class="no-attributes">No attributes</span>';
    }
    
    return `
        <div class="attributes-display">
            ${attrEntries.slice(0, 3).map(([name, value]) => {
                const valueStr = safeString(value);
                const valueSafe = valueStr.length > 20 ? valueStr.substring(0, 20) : valueStr;
                return `<div class="attr-item" title="${escapeHtml(name)}='${escapeHtml(valueStr)}'">
                    <strong>${escapeHtml(name)}:</strong> ${escapeHtml(valueSafe)}${valueStr.length > 20 ? '...' : ''}
                </div>`;
            }).join('')}
            ${attrEntries.length > 3 ? `<div class="attr-item">+${attrEntries.length - 3} more...</div>` : ''}
        </div>
    `;
}

// Helper function to create context display
function createContextDisplay(context) {
    if (!context || Object.keys(context).length === 0) {
        return '<span class="no-context">No context</span>';
    }
    
    return `
        <div class="context-display">
            ${context.parentTagName ? `<div class="context-item">
                <strong>Parent:</strong> ${safeString(context.parentTagName).toUpperCase()}
                ${context.parentId ? `#${context.parentId}` : ''}
            </div>` : ''}
            <div class="context-item">
                <strong>Position:</strong> ${context.siblingIndex >= 0 ? `${context.siblingIndex + 1}` : '?'} of ${context.childrenCount || 0}
            </div>
            <div class="context-item">
                <strong>Depth:</strong> ${context.nestingLevel || 0}
            </div>
        </div>
    `;
}

// Helper function to create state display
function createStateDisplay(elementState) {
    if (!elementState || Object.keys(elementState).length === 0) {
        return '<span class="no-state">No state info</span>';
    }
    
    const states = [];
    if (elementState.isFormElement) states.push('📝 Form');
    if (elementState.isInteractive) states.push('🔗 Interactive');
    if (elementState.hasChildren) states.push('👥 Has Children');
    if (elementState.isEmptyElement) states.push('🫙 Empty');
    
    return `
        <div class="state-display">
            ${states.length > 0 ? states.map(state => `<span class="state-badge">${state}</span>`).join('') : '<span class="no-states">Static</span>'}
        </div>
    `;
}

// Helper function to create position display
function createPositionDisplay(position) {
    if (!position || (!position.x && !position.y)) {
        return '<span class="no-position">No position</span>';
    }
    
    return `
        <div class="position-display">
            <div class="position-coords">
                <strong>X:</strong> ${position.x || 0}, <strong>Y:</strong> ${position.y || 0}
            </div>
            ${position.width && position.height ? `
                <div class="position-size">
                    <strong>Size:</strong> ${position.width}×${position.height}
                </div>
            ` : ''}
        </div>
    `;
}

// Helper function to create styling display
function createStylingDisplay(styling) {
    if (!styling || Object.keys(styling).length === 0) {
        return '<span class="no-styling">No style info</span>';
    }
    
    const computedStyles = styling.computedStyles || {};
    const relevantStyles = [
        ['color', computedStyles.color],
        ['bg', computedStyles.backgroundColor],
        ['font-size', computedStyles.fontSize],
        ['display', styling.displayType]
    ].filter(([, value]) => value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent');
    
    return `
        <div class="styling-display">
            ${relevantStyles.map(([prop, value]) => {
                const valueStr = safeString(value);
                const valueSafe = valueStr.length > 15 ? valueStr.substring(0, 15) : valueStr;
                return `<div class="style-item" title="${escapeHtml(prop)}: ${escapeHtml(valueStr)}">
                    <strong>${prop}:</strong> ${escapeHtml(valueSafe)}${valueStr.length > 15 ? '...' : ''}
                </div>`;
            }).join('')}
        </div>
    `;
}

// Enhanced filtering function
function applyFilters() {
    if (!scanResults || !scanResults.elements) {
        console.log('🔍 Debug: applyFilters - no scanResults or elements');
        return;
    }

    console.log('🔍 Debug: applyFilters called, elements:', scanResults.elements.length);

    const searchTerm = safeTrim(document.getElementById('searchBox')?.value || '').toLowerCase();
    const tagFilter = document.getElementById('tagFilter')?.value || '';
    const stateFilter = document.getElementById('stateFilter')?.value || '';
    const locatorFilter = document.getElementById('locatorFilter')?.value || '';

    console.log('🔍 Debug: Filter values:', { searchTerm, tagFilter, stateFilter, locatorFilter });

    filteredElements = scanResults.elements.filter(element => {
        // Search filter
        if (searchTerm) {
            const searchableText = [
                safeString(element.tagName),
                safeString(element.text),
                safeString(element.textContent?.cleanText),
                ...(element.locators?.primary?.map(l => safeString(l.selector)) || []),
                ...(element.locators?.secondary?.map(l => safeString(l.selector)) || []),
                ...Object.keys(element.attributes || {}),
                ...Object.values(element.attributes || {}).map(v => safeString(v))
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) return false;
        }

        // Tag filter
        if (tagFilter && element.tagName !== tagFilter) return false;

        // State filter
        if (stateFilter) {
            if (stateFilter === 'form' && !element.elementState?.isFormElement) return false;
            if (stateFilter === 'interactive' && !element.elementState?.isInteractive) return false;
            if (stateFilter === 'static' && (element.elementState?.isFormElement || element.elementState?.isInteractive)) return false;
        }

        // Locator filter
        if (locatorFilter) {
            if (locatorFilter === 'has-id' && !element.attributes?.id) return false;
            if (locatorFilter === 'has-data' && !Object.keys(element.attributes || {}).some(key => key.startsWith('data-'))) return false;
            if (locatorFilter === 'has-class' && !element.attributes?.class) return false;
        }

        return true;
    });

    console.log('🔍 Debug: applyFilters result - filtered', filteredElements.length, 'from', scanResults.elements.length, 'elements');
    currentPage = 1; // Reset to first page
    displayElements();
    populateFilterOptions();
}

// Populate filter options based on available data
function populateFilterOptions() {
    if (!scanResults || !scanResults.elements) return;

    const tagFilter = document.getElementById('tagFilter');
    if (tagFilter) {
        const tags = [...new Set(scanResults.elements.map(el => safeString(el.tagName)))].sort();
        tagFilter.innerHTML = '<option value="">All Tags</option>' + 
            tags.map(tag => `<option value="${tag}">${safeString(tag).toUpperCase()}</option>`).join('');
    }
}

// Toggle between compact and detailed view
function toggleView(isCompact) {
    const table = document.querySelector('.elements-table');
    if (table) {
        if (isCompact) {
            table.classList.add('compact-view');
        } else {
            table.classList.remove('compact-view');
        }
    }
}

// Export to JSON function
function exportToJSON() {
    if (!scanResults) return;
    
    const dataToExport = {
        scanInfo: {
            url: scanResults.url,
            title: scanResults.title,
            timestamp: scanResults.timestamp,
            totalElements: filteredElements.length
        },
        elements: filteredElements
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elements-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToCSV() {
    if (!filteredElements || filteredElements.length === 0) return;

    const headers = ['Index', 'Element Name', 'Tag', 'Confidence', 'Text', 'Shadow DOM', 'Primary Locators', 'Secondary Locators', 'Fallback Locators', 'XPath'];
    
    const rows = filteredElements.map((element, index) => [
        index + 1,
        `"${generateElementName(element).replace(/"/g, '""')}"`,
        safeString(element.tagName),
        Math.round((element.confidence || 0) * 100) + '%',
        safeString(element.text) ? `"${safeString(element.text).replace(/"/g, '""')}"` : '',
        element.isShadowDOM ? 'Yes' : 'No',
        (element.locators?.primary || []).map(l => safeString(l.selector)).join('; '),
        (element.locators?.secondary || []).map(l => safeString(l.selector)).join('; '),
        (element.locators?.fallback || []).map(l => safeString(l.selector)).join('; '),
        safeString(element.xpath)
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `element-scan-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function showNoData() {
    document.getElementById('elementsContainer').innerHTML = 
        '<div class="no-data">No scan results found. Please run a scan first.</div>';
}
