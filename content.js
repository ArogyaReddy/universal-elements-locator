/* global chrome */
// Content script - Enhanced with visibility filtering
console.log('Universal Element Locator: Content script starting...');

// Enhanced helper function to check if element is truly visible
function isElementVisible(element) {
  try {
    if (!element || !element.isConnected) return false;
    
    const style = window.getComputedStyle(element);
    
    // Check CSS visibility properties
    if (style.display === 'none' || 
        style.visibility === 'hidden' || 
        parseFloat(style.opacity) === 0) {
      return false;
    }
    
    // Get element bounds
    const rect = element.getBoundingClientRect();
    
    // Check if element has dimensions
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    // Check if element is significantly offscreen (allowing for some margin)
    const viewport = {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };
    
    if (rect.right < -500 || 
        rect.left > viewport.width + 500 ||
        rect.bottom < -500 || 
        rect.top > viewport.height + 500) {
      return false;
    }
    
    // Check for parent elements that might hide this element
    let parent = element.parentElement;
    let checkDepth = 0;
    while (parent && checkDepth < 3) { // Only check a few levels up for performance
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || 
          parentStyle.visibility === 'hidden' ||
          parseFloat(parentStyle.opacity) === 0) {
        return false;
      }
      parent = parent.parentElement;
      checkDepth++;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

// Enhanced helper function to get clean text content
function getCleanText(element) {
  try {
    // Try innerText first (respects styling), fall back to textContent
    const rawText = element.innerText || element.textContent || '';
    let cleanText = rawText.trim();
    
    // Return empty for clearly empty content
    if (!cleanText) return '';
    
    // Filter out JavaScript code patterns
    const jsPatterns = [
      /function\s*\(/,           // function declarations
      /=>\s*{/,                 // arrow functions
      /console\./,              // console statements
      /document\./,             // DOM access
      /window\./,               // window access
      /var\s+\w+\s*=/,          // variable declarations
      /const\s+\w+\s*=/,        // const declarations
      /let\s+\w+\s*=/,          // let declarations
      /\{\s*[\w'"]+\s*:\s*[\w'"]/,  // object literals
      /^\s*[{}();,]\s*$/,       // just punctuation
      /import\s+.*from/,        // import statements
      /export\s+(default\s+)?/,  // export statements
      /require\s*\(/,           // require statements
      /addEventListener/,        // event listeners
      /getElementById/,         // DOM methods
      /querySelector/           // DOM methods
    ];
    
    // Check if text matches JavaScript patterns
    for (const pattern of jsPatterns) {
      if (pattern.test(cleanText)) {
        return '';
      }
    }
    
    // Filter out very long content (likely code or data)
    if (cleanText.length > 300) {
      return '';
    }
    
    // Filter out content that's mostly symbols or numbers
    const alphaRatio = (cleanText.match(/[a-zA-Z]/g) || []).length / cleanText.length;
    if (alphaRatio < 0.3 && cleanText.length > 10) {
      return '';
    }
    
    // Return truncated meaningful text
    return cleanText.substring(0, 150).trim();
  } catch (e) {
    return '';
  }
}

// Helper function to get element nesting level
function getElementNestingLevel(element) {
  let level = 0;
  let current = element.parentElement;
  while (current && level < 20) { // Prevent infinite loops
    level++;
    current = current.parentElement;
  }
  return level;
}

// Helper function to get all element attributes
function getAllAttributes(element) {
  const attributes = {};
  try {
    if (element.attributes && element.attributes.length > 0) {
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value;
      }
    }
  } catch (e) {
    console.log(`🔍 Debug: Error getting attributes for ${element.tagName}:`, e);
  }
  return attributes;
}

// Helper function to check if element is interactive
function isInteractiveElement(element) {
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
  const interactiveRoles = ['button', 'link', 'tab', 'option', 'checkbox', 'radio'];
  const interactiveTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
  
  return interactiveTags.includes(element.tagName.toLowerCase()) ||
         interactiveRoles.includes(element.getAttribute('role')) ||
         interactiveTypes.includes(element.getAttribute('type')) ||
         element.hasAttribute('onclick') ||
         element.hasAttribute('onmousedown') ||
         element.style.cursor === 'pointer';
}

// Helper function to get relevant CSS styles
function getRelevantStyles(element) {
  try {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      textAlign: style.textAlign,
      padding: style.padding,
      margin: style.margin,
      border: style.border,
      borderRadius: style.borderRadius,
      cursor: style.cursor
    };
  } catch (e) {
    return {};
  }
}

// Simple initialization
if (!window.universalLocatorInjected) {
  window.universalLocatorInjected = true;
  
  // Basic message handling
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request.action);
    
    switch (request.action) {
      case 'ping':
        sendResponse({ success: true });
        break;
        
      case 'scanPage':
        try {
          console.log('🔍 Content: Starting visible elements scan...');
          const elements = document.querySelectorAll('*');
          const results = [];
          let totalChecked = 0;
          let visibleFound = 0;
          let skippedByTag = 0;
          let skippedByVisibility = 0;
          
          console.log(`🔍 Content: Found ${elements.length} total elements to check`);
          
          // Scan for visible elements only
          for (let i = 0; i < elements.length && results.length < 200; i++) {
            const el = elements[i];
            totalChecked++;
            
            // Skip script/style elements
            if (!el.tagName || ['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE'].includes(el.tagName)) {
              skippedByTag++;
              continue;
            }
            
            // Only process visible elements
            if (!isElementVisible(el)) {
              skippedByVisibility++;
              continue;
            }
            
            visibleFound++;
            const rect = el.getBoundingClientRect();
            
            // Enhanced element data with detailed context and attributes
            const elementData = {
              index: results.length,
              tagName: el.tagName.toLowerCase(),
              text: getCleanText(el),
              confidence: Math.random() * 0.4 + 0.6,
              isShadowDOM: false,
              position: {
                x: Math.round(rect.left + window.scrollX),
                y: Math.round(rect.top + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              // Enhanced text and content information
              textContent: {
                innerText: (el.innerText || '').trim().substring(0, 200),
                textContent: (el.textContent || '').trim().substring(0, 200),
                cleanText: getCleanText(el),
                hasText: !!(el.innerText || el.textContent || '').trim()
              },
              // Element context and hierarchy
              context: {
                parentTagName: el.parentElement ? el.parentElement.tagName.toLowerCase() : null,
                parentId: el.parentElement ? el.parentElement.id || null : null,
                parentClasses: el.parentElement ? Array.from(el.parentElement.classList) : [],
                childrenCount: el.children.length,
                siblingIndex: Array.from(el.parentElement?.children || []).indexOf(el),
                nestingLevel: getElementNestingLevel(el)
              },
              // All attributes as key-value pairs
              attributes: getAllAttributes(el),
              // Element state and properties
              elementState: {
                isFormElement: ['input', 'select', 'textarea', 'button'].includes(el.tagName.toLowerCase()),
                isInteractive: isInteractiveElement(el),
                isVisible: true, // We already checked this
                hasChildren: el.children.length > 0,
                isEmptyElement: !el.textContent?.trim() && el.children.length === 0
              },
              // CSS information
              styling: {
                computedStyles: getRelevantStyles(el),
                displayType: window.getComputedStyle(el).display,
                visibility: window.getComputedStyle(el).visibility,
                opacity: window.getComputedStyle(el).opacity
              },
              locators: {
                primary: [],
                secondary: [],
                fallback: []
              }
            };

            // Enhanced locator generation
            // 1. ID locators (highest priority)
            if (el.id) {
              elementData.locators.primary.push({
                type: 'id',
                selector: `#${el.id}`,
                value: el.id
              });
            }

            // 2. Data attributes (high priority for testing)
            for (const attr of el.attributes) {
              if (attr.name.startsWith('data-')) {
                elementData.locators.primary.push({
                  type: attr.name,
                  selector: `[${attr.name}="${attr.value}"]`,
                  value: attr.value
                });
              }
            }

            // 3. Name attribute (important for forms)
            if (el.name) {
              elementData.locators.primary.push({
                type: 'name',
                selector: `[name="${el.name}"]`,
                value: el.name
              });
            }

            // 4. Aria labels and roles (accessibility)
            if (el.getAttribute('aria-label')) {
              elementData.locators.secondary.push({
                type: 'aria-label',
                selector: `[aria-label="${el.getAttribute('aria-label')}"]`,
                value: el.getAttribute('aria-label')
              });
            }

            if (el.getAttribute('role')) {
              elementData.locators.secondary.push({
                type: 'role',
                selector: `[role="${el.getAttribute('role')}"]`,
                value: el.getAttribute('role')
              });
            }

            // 5. Class names (medium priority)
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\s+/).filter(c => c);
              if (classes.length > 0) {
                elementData.locators.secondary.push({
                  type: 'class',
                  selector: `.${classes.join('.')}`,
                  value: classes.join(' ')
                });
                
                // Also add individual classes as separate locators
                classes.forEach(className => {
                  elementData.locators.secondary.push({
                    type: 'single-class',
                    selector: `.${className}`,
                    value: className
                  });
                });
              }
            }

            // 6. Type attribute (for inputs)
            if (el.type) {
              elementData.locators.secondary.push({
                type: 'type',
                selector: `[type="${el.type}"]`,
                value: el.type
              });
            }

            // 7. Placeholder text (for inputs)
            if (el.placeholder) {
              elementData.locators.secondary.push({
                type: 'placeholder',
                selector: `[placeholder="${el.placeholder}"]`,
                value: el.placeholder
              });
            }

            // 8. Text content-based locators (for links and buttons)
            const textContent = getCleanText(el);
            if (textContent && textContent.length > 0 && textContent.length <= 50) {
              if (el.tagName.toLowerCase() === 'a' || 
                  el.tagName.toLowerCase() === 'button' ||
                  el.getAttribute('role') === 'button') {
                elementData.locators.secondary.push({
                  type: 'text',
                  selector: `${el.tagName.toLowerCase()}:contains("${textContent}")`,
                  value: textContent
                });
              }
            }

            // 9. Always add tagName as fallback
            elementData.locators.fallback.push({
              type: 'tagName',
              selector: el.tagName.toLowerCase(),
              value: el.tagName.toLowerCase()
            });

            // 10. Add position-based fallback for unique identification
            const position = `${Math.round(rect.left)},${Math.round(rect.top)}`;
            elementData.locators.fallback.push({
              type: 'position',
              selector: `/* position: ${position} */`,
              value: position
            });

            results.push(elementData);
            
            // Validate that we actually have meaningful data
            if (results.length === 1) {
              console.log('🔍 Debug: First element validation:', {
                hasAttributes: Object.keys(elementData.attributes).length > 0,
                hasContext: !!elementData.context.parentTagName,
                hasLocators: elementData.locators.primary.length > 0 || elementData.locators.secondary.length > 0,
                sampleData: {
                  attributes: elementData.attributes,
                  context: elementData.context,
                  primaryLocators: elementData.locators.primary.length,
                  secondaryLocators: elementData.locators.secondary.length
                }
              });
            }
          }
          
          console.log(`🔍 Content: Scan complete! Checked ${totalChecked} elements, found ${visibleFound} visible, captured ${results.length}`);
          console.log(`🔍 Content: Filtering stats - Skipped by tag: ${skippedByTag}, Skipped by visibility: ${skippedByVisibility}`);

          const stats = {
            totalElements: results.length,
            primaryElements: results.filter(el => el.locators.primary.length > 0).length,
            secondaryElements: results.filter(el => el.locators.secondary.length > 0).length,
            shadowElements: results.filter(el => el.isShadowDOM).length,
            scanDuration: 100
          };

          sendResponse({ success: true, results, stats });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep channel open
  });
  
  console.log('Universal Element Locator: Content script ready');
}
