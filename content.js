/* global chrome */
// Content script - Enhanced with visibility filtering
console.log('Universal Element Locator: Content script starting...');

// Enhanced helper function to recursively traverse Shadow DOM
function getAllElementsIncludingShadowDOM(root = document, includeHidden = false) {
  const allElements = [];
  const processedNodes = new WeakSet(); // Prevent infinite loops
  
  function traverse(node, isShadowRoot = false, shadowHost = null) {
    // Avoid processing the same node twice
    if (processedNodes.has(node)) return;
    processedNodes.add(node);
    
    // If it's an element, add it to our list
    if (node.nodeType === Node.ELEMENT_NODE) {
      // When includeHidden is true, collect ALL elements without visibility filtering
      // When includeHidden is false, apply basic filtering but be lenient
      const shouldInclude = includeHidden || isElementVisible(node);
      
      if (shouldInclude) {
        allElements.push({
          element: node,
          isShadowDOM: isShadowRoot,
          shadowHost: shadowHost
        });
      }
      
      // Even if element is not visible, still traverse its children
      // (they might be visible due to CSS)
    }
    
    // Traverse all child nodes, not just elements
    if (node.childNodes && node.childNodes.length > 0) {
      for (const child of node.childNodes) {
        traverse(child, isShadowRoot, shadowHost);
      }
    }
    
    // If this element has a shadow root, traverse it
    if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
      console.log('🔍 Content: Found open Shadow DOM on element:', node.tagName, node.id || node.className);
      try {
        traverse(node.shadowRoot, true, node);
      } catch (e) {
        console.warn('Could not traverse shadow root:', e);
      }
    }
    
    // Also check for closed shadow roots and other shadow patterns
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Try various shadow root access patterns
      const possibleShadowKeys = [
        '_shadowRoot', '__shadowRoot', 'shadowRoot',
        '_$shadowRoot', '__SHADOW_ROOT__', 'closedShadowRoot'
      ];
      
      for (const key of possibleShadowKeys) {
        try {
          if (node[key] && typeof node[key] === 'object' && 
              node[key].nodeType && !processedNodes.has(node[key])) {
            console.log('🔍 Content: Found closed Shadow DOM via', key, 'on element:', node.tagName);
            traverse(node[key], true, node);
          }
        } catch (e) {
          // Ignore errors when trying to access shadow roots
        }
      }
      
      // Also check for web component registries and custom elements
      if (node.tagName && node.tagName.includes('-')) {
        console.log('🔍 Content: Found custom element:', node.tagName);
        // Custom elements might have internal shadow DOM
      }
    }
  }
  
  console.log('🔍 Content: Starting comprehensive element traversal...');
  traverse(root);
  console.log(`🔍 Content: Traversal complete. Found ${allElements.length} elements total.`);
  
  return allElements;
}

// Enhanced helper function to check if element is truly visible - more lenient approach
function isElementVisible(element) {
  try {
    if (!element || !element.isConnected) return false;
    
    const style = window.getComputedStyle(element);
    
    // Check CSS visibility properties (be lenient)
    if (style.display === 'none') {
      return false;
    }
    
    // Don't filter on visibility: hidden for now - some sites use this for interactive elements
    // if (style.visibility === 'hidden') {
    //   return false;
    // }
    
    // Allow very low opacity but not completely transparent
    if (parseFloat(style.opacity) === 0) {
      return false;
    }
    
    // Get element bounds
    const rect = element.getBoundingClientRect();
    
    // Allow elements with very small dimensions (some buttons/links are tiny)
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }
    
    // Be much more lenient with offscreen elements - don't filter them
    // Many elements are legitimately outside viewport but still interactive
    
    // Only check if parent is completely hidden
    const parent = element.parentElement;
    if (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none') {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    // If we can't determine visibility, assume it's visible to be safe
    console.warn('Visibility check failed for element:', e);
    return true;
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

// Highlighting functionality - Green highlighting for scan-time
function highlightElementForScan(element) {
  if (!element || window.highlightedElements.includes(element)) return;
  
  // Enhanced logging for debugging
  const elementInfo = {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    text: element.textContent?.trim()?.substring(0, 30),
    href: element.href
  };
  console.log('🟢 Applying scan highlight to element:', elementInfo);
  
  // Special logging for links to track visual_user
  if (element.tagName === 'A') {
    console.log('🔗 Highlighting LINK:', {
      text: element.textContent?.trim(),
      href: element.href,
      classes: element.className
    });
    
    if (element.textContent?.trim() === 'visual_user') {
      console.log('✅ FOUND AND HIGHLIGHTING visual_user link!');
    }
  }
  
  // Store original styles
  const originalOutline = element.style.outline;
  const originalBoxShadow = element.style.boxShadow;
  const originalZIndex = element.style.zIndex;
  const originalTransition = element.style.transition;
  const originalBackground = element.style.backgroundColor;
  
  // Apply green outline with minimal background for scan-time (like original)
  element.style.transition = 'all 0.2s ease';
  element.style.outline = '2px solid #00ff00';
  element.style.boxShadow = '0 0 4px rgba(0, 255, 0, 0.3)';
  element.style.zIndex = '999999';
  // Keep background transparent/white like original
  element.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  
  // Store element and original styles for cleanup
  element._originalStyles = {
    outline: originalOutline,
    boxShadow: originalBoxShadow,
    zIndex: originalZIndex,
    transition: originalTransition,
    backgroundColor: originalBackground
  };
  
  window.highlightedElements.push(element);
}

// Orange/red highlighting for UI-triggered highlighting (🎯 button clicks)
function highlightElement(element, skipClearAndScroll = false) {
  if (!element) {
    console.error('❌ No element provided for highlighting');
    return;
  }
  
  console.log('🎯 Applying UI highlight to element:', element.tagName, element.id || element.className);
  
  // Clear any existing highlights first (only for the first element)
  if (!skipClearAndScroll) {
    clearHighlights();
    
    // Scroll element into view with smooth animation (only for the first element)
    try {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center', 
        inline: 'center' 
      });
      console.log('📍 Scrolled element into view');
    } catch (scrollError) {
      console.warn('⚠️ Could not scroll element into view:', scrollError);
    }
  }
  
  // Store original styles
  const originalOutline = element.style.outline;
  const originalBoxShadow = element.style.boxShadow;
  const originalZIndex = element.style.zIndex;
  const originalTransition = element.style.transition;
  const originalBackground = element.style.backgroundColor;
  const originalBorder = element.style.border;
  const originalBorderRadius = element.style.borderRadius;
  
  console.log('💾 Stored original styles for element');
  
  // Apply prominent border highlighting without animations - stable and clear
  element.style.transition = 'all 0.2s ease';
  element.style.outline = '4px solid #ff1744 !important';
  element.style.border = '3px solid #ff1744 !important';
  element.style.boxShadow = '0 0 15px rgba(255, 23, 68, 0.8), inset 0 0 10px rgba(255, 23, 68, 0.3) !important';
  element.style.zIndex = '999999 !important';
  element.style.backgroundColor = 'rgba(255, 255, 0, 0.15) !important';
  element.style.borderRadius = '4px !important';
  
  console.log('🎨 Applied stable border highlighting styles');
  
  // Store element and original styles for cleanup
  element._originalStyles = {
    outline: originalOutline,
    boxShadow: originalBoxShadow,
    zIndex: originalZIndex,
    transition: originalTransition,
    backgroundColor: originalBackground,
    border: originalBorder,
    borderRadius: originalBorderRadius
  };
  
  window.highlightedElements.push(element);
  
  console.log('✅ Stable border highlighting completed for element:', element.tagName);
}

function clearAllHighlighting() {
  console.log('🧹 Clearing all highlights from', window.highlightedElements.length, 'elements');
  window.highlightedElements.forEach(element => {
    if (element && element._originalStyles) {
      element.style.outline = element._originalStyles.outline;
      element.style.boxShadow = element._originalStyles.boxShadow;
      element.style.zIndex = element._originalStyles.zIndex;
      element.style.transition = element._originalStyles.transition;
      element.style.backgroundColor = element._originalStyles.backgroundColor;
      if (element._originalStyles.border !== undefined) {
        element.style.border = element._originalStyles.border;
      }
      if (element._originalStyles.borderRadius !== undefined) {
        element.style.borderRadius = element._originalStyles.borderRadius;
      }
      delete element._originalStyles;
    }
  });
  window.highlightedElements = [];
  console.log('✅ All highlights cleared');
}

// Alias for consistency with new message handler
function clearHighlights() {
  clearAllHighlighting();
}

// Function to find ALL elements including those in Shadow DOM (matches browser behavior)
function findAllElementsBySelectorIncludingShadowDOM(selector) {
  console.log('🔍 FIND ELEMENTS - Searching for ALL elements with selector:', selector);
  const foundElements = [];
  
  // First try standard document query for all elements
  try {
    console.log('🔍 FIND ELEMENTS - Trying document.querySelectorAll...');
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      foundElements.push(...Array.from(elements));
      console.log(`✅ FIND ELEMENTS - Found ${elements.length} elements in main document`);
      
      // Log details of found elements
      Array.from(elements).forEach((el, index) => {
        console.log(`  Main document element ${index + 1}:`, {
          tag: el.tagName,
          id: el.id || 'no-id',
          classes: el.className || 'no-classes',
          text: (el.textContent || '').trim().substring(0, 30)
        });
      });
    } else {
      console.log('⚠️ FIND ELEMENTS - No elements found in main document');
    }
  } catch (e) {
    console.error('❌ FIND ELEMENTS - Invalid selector for main document:', selector, e);
    return [];
  }
  
  // Search in Shadow DOM trees
  console.log('🔍 FIND ELEMENTS - Searching in Shadow DOM trees...');
  const allElements = getAllElementsIncludingShadowDOM(document);
  let shadowSearchCount = 0;
  
  for (const el of allElements) {
    if (el.element && el.element.shadowRoot) {
      shadowSearchCount++;
      try {
        const shadowElements = el.element.shadowRoot.querySelectorAll(selector);
        if (shadowElements.length > 0) {
          foundElements.push(...Array.from(shadowElements));
          console.log(`✅ FIND ELEMENTS - Found ${shadowElements.length} elements in Shadow DOM of:`, el.element.tagName);
        }
      } catch (e) {
        // Ignore errors from closed shadow roots or invalid selectors
        console.log('⚠️ FIND ELEMENTS - Could not search in Shadow DOM:', e.message);
      }
    }
  }
  
  console.log(`🔍 FIND ELEMENTS - Searched ${shadowSearchCount} Shadow DOM trees`);
  console.log(`🎯 FIND ELEMENTS - TOTAL elements found: ${foundElements.length}`);
  
  return foundElements;
}

// Legacy function for backward compatibility (returns first element)
// eslint-disable-next-line no-unused-vars
function findElementBySelectorIncludingShadowDOM(selector) {
  const elements = findAllElementsBySelectorIncludingShadowDOM(selector);
  return elements.length > 0 ? elements[0] : null;
}

// Function to highlight all matching elements
function highlightAllElements(elements) {
  if (!elements || elements.length === 0) {
    console.log('❌ HIGHLIGHT - No elements to highlight');
    return false;
  }
  
  console.log(`🎯 HIGHLIGHT - Starting to highlight ${elements.length} elements`);
  
  let successCount = 0;
  elements.forEach((element, index) => {
    try {
      console.log(`🎯 HIGHLIGHT - Processing element ${index + 1}/${elements.length}:`, {
        tag: element.tagName,
        id: element.id || 'no-id',
        classes: element.className || 'no-classes'
      });
      
      // For the first element, clear highlights and scroll into view
      // For subsequent elements, skip clearing and scrolling
      const skipClearAndScroll = index > 0;
      highlightElement(element, skipClearAndScroll);
      successCount++;
      console.log(`✅ HIGHLIGHT - Successfully highlighted element ${index + 1}/${elements.length}`);
    } catch (error) {
      console.error(`❌ HIGHLIGHT - Failed to highlight element ${index + 1}:`, error);
    }
  });
  
  console.log(`🎯 HIGHLIGHT - Successfully highlighted ${successCount}/${elements.length} elements`);
  return successCount > 0;
}

// Simple initialization
if (!window.universalLocatorInjected) {
  window.universalLocatorInjected = true;
  console.log('🚀 CONTENT SCRIPT: Universal Element Locator initializing...');
  console.log('🚀 CONTENT SCRIPT: Page URL:', window.location.href);
  console.log('🚀 CONTENT SCRIPT: Document ready state:', document.readyState);
  
  // Highlighting functionality - only declare if not already declared
  if (!window.highlightedElements) {
    window.highlightedElements = [];
    console.log('🚀 CONTENT SCRIPT: highlightedElements array initialized');
  }
  
  // Only add event listener if not already added
  if (!window.universalLocatorListenerAdded) {
    window.universalLocatorListenerAdded = true;
    console.log('🚀 CONTENT SCRIPT: Adding message listener...');
    
    // Basic message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📥 CONTENT SCRIPT: Message received:', request.action, request);
    
    switch (request.action) {
      case 'ping':
        console.log('🏓 CONTENT SCRIPT: Ping received, sending pong');
        sendResponse({ success: true });
        break;
        
      case 'scanPage':
      case 'scanPageWithHighlighting':
        try {
          console.log('🔍 Content: Starting visible elements scan...');
          console.log('🔍 Content: Document ready state:', document.readyState);
          console.log('🔍 Content: DOM loaded:', document.body ? 'Yes' : 'No');
          
          if (!document.body) {
            throw new Error('Page not fully loaded - DOM body not available');
          }
          
          const scanOptions = request.options || {};
          const shouldHighlight = request.action === 'scanPageWithHighlighting' && scanOptions.highlight !== false;
          
          // Clear any existing highlighting first
          clearAllHighlighting();
          
          // Use enhanced element collection - get ALL elements first, filter later
          const allElementsData = getAllElementsIncludingShadowDOM(document, true); // Always get all elements
          const results = [];
          let totalChecked = 0;
          let visibleFound = 0;
          let skippedByTag = 0;
          let skippedByVisibility = 0;
          let shadowDOMFound = 0;
          
          console.log(`🔍 Content: Found ${allElementsData.length} total elements to check (including Shadow DOM)`);
          console.log(`🔍 Content: Highlighting enabled: ${shouldHighlight}`);
          console.log(`🔍 Content: Include hidden elements: ${scanOptions.includeHidden}`);
          
          // Scan for visible elements - increased limit and better filtering
          for (let i = 0; i < allElementsData.length && results.length < 500; i++) {
            const elementInfo = allElementsData[i];
            const el = elementInfo.element;
            const isShadowElement = elementInfo.isShadowDOM;
            
            totalChecked++;
            
            // Track Shadow DOM elements found
            if (isShadowElement) {
              shadowDOMFound++;
            }
            
            // Skip fewer element types - only truly problematic ones
            if (!el.tagName || ['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'NOSCRIPT'].includes(el.tagName)) {
              skippedByTag++;
              continue;
            }
            
            // Apply visibility filtering only once and with detailed logging
            let isVisible = true;
            if (!scanOptions.includeHidden) {
              isVisible = isElementVisible(el);
              if (!isVisible) {
                skippedByVisibility++;
                // Log details for debugging missing elements
                if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
                  console.log(`🔍 Content: Skipped ${el.tagName} element due to visibility:`, {
                    text: el.textContent?.trim()?.substring(0, 50),
                    id: el.id,
                    class: el.className,
                    display: window.getComputedStyle(el).display,
                    visibility: window.getComputedStyle(el).visibility,
                    opacity: window.getComputedStyle(el).opacity,
                    rect: el.getBoundingClientRect()
                  });
                }
                continue;
              }
            }
            
            visibleFound++;
            const rect = el.getBoundingClientRect();
            
            // Highlight element if enabled - use green highlighting for scan
            if (shouldHighlight) {
              try {
                highlightElementForScan(el);
                // Add a small delay to make highlighting more visible
                if (i % 10 === 0) {
                  console.log(`🟢 Highlighted ${i + 1} elements so far...`);
                }
              } catch (highlightError) {
                console.warn('Failed to highlight element during scan:', highlightError);
              }
            }
            
            // Enhanced logging for specific element types we care about
            if (el.tagName === 'A' || el.tagName === 'BUTTON') {
              console.log(`🔍 Processing ${el.tagName}:`, {
                text: el.textContent?.trim()?.substring(0, 30),
                id: el.id,
                class: el.className,
                href: el.href,
                highlighted: shouldHighlight
              });
            }
            
            // Enhanced element data with detailed context and attributes
            const elementData = {
              index: results.length,
              tagName: el.tagName.toLowerCase(),
              text: getCleanText(el),
              confidence: Math.random() * 0.4 + 0.6,
              isShadowDOM: isShadowElement,
              shadowHost: isShadowElement && elementInfo.shadowHost ? {
                tagName: elementInfo.shadowHost.tagName.toLowerCase(),
                id: elementInfo.shadowHost.id || null,
                className: elementInfo.shadowHost.className || null
              } : null,
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

            // Enhanced locator generation with uniqueness detection
            // 1. ID locators (highest priority) - Enhanced with uniqueness verification
            if (el.id) {
              const baseSelector = `#${el.id}`;
              const selector = baseSelector;
              const isUnique = !isShadowElement && isSelectorUnique(baseSelector);
              
              elementData.locators.primary.push({
                type: 'id',
                selector: selector,
                value: el.id,
                shadowDOM: isShadowElement,
                isUnique: isUnique,
                uniquenessLevel: isUnique ? 'unique' : 'duplicate-id'
              });
              
              // If ID is not unique (should be rare but happens), add contextual selectors
              if (!isUnique || isShadowElement) {
                const uniqueSelectors = generateUniqueSelector(el, baseSelector);
                uniqueSelectors.slice(1).slice(0, 3).forEach((uniqueSelector, index) => {
                  // Re-test uniqueness for contextual selectors
                  const contextualIsUnique = !isShadowElement && isSelectorUnique(uniqueSelector);
                  
                  elementData.locators.primary.push({
                    type: `id-contextual-${index + 1}`,
                    selector: uniqueSelector,
                    value: el.id,
                    shadowDOM: isShadowElement,
                    isUnique: contextualIsUnique,
                    uniquenessLevel: contextualIsUnique ? 'contextual-unique' : 'contextual-non-unique',
                    baseAttribute: 'id'
                  });
                });
              }
            }

            // 2. Data attributes (high priority for testing) - Enhanced with uniqueness
            for (const attr of el.attributes) {
              if (attr.name.startsWith('data-')) {
                const baseSelector = `[${attr.name}="${attr.value}"]`;
                const basicSelector = baseSelector;
                
                // Check if the basic selector is unique
                const isUnique = !isShadowElement && isSelectorUnique(baseSelector);
                
                // Always add the basic selector
                elementData.locators.primary.push({
                  type: attr.name,
                  selector: basicSelector,
                  value: attr.value,
                  shadowDOM: isShadowElement,
                  isUnique: isUnique,
                  uniquenessLevel: isUnique ? 'unique' : 'non-unique'
                });
                
                // If not unique, generate additional contextual selectors
                if (!isUnique || isShadowElement) {
                  const uniqueSelectors = generateUniqueSelector(el, baseSelector);
                  uniqueSelectors.slice(1).forEach((uniqueSelector, index) => {
                    // Important: Re-test uniqueness for each contextual selector
                    const contextualIsUnique = !isShadowElement && isSelectorUnique(uniqueSelector);
                    
                    elementData.locators.primary.push({
                      type: `${attr.name}-contextual-${index + 1}`,
                      selector: uniqueSelector,
                      value: attr.value,
                      shadowDOM: isShadowElement,
                      isUnique: contextualIsUnique,
                      uniquenessLevel: contextualIsUnique ? 'contextual-unique' : 'contextual-non-unique',
                      baseAttribute: attr.name,
                      contextType: index === 0 ? 'parent-id' : 
                                   index === 1 ? 'parent-class' :
                                   index === 2 ? 'parent-tag' :
                                   index === 3 ? 'nth-child' :
                                   index === 4 ? 'grandparent' :
                                   'table-row' 
                    });
                  });
                }
              }
            }

            // 3. Name attribute (important for forms)
            if (el.name) {
              const selector = `[name="${el.name}"]`;
              elementData.locators.primary.push({
                type: 'name',
                selector: selector,
                value: el.name,
                shadowDOM: isShadowElement
              });
            }

            // 4. Aria labels and roles (accessibility)
            if (el.getAttribute('aria-label')) {
              const selector = `[aria-label="${el.getAttribute('aria-label')}"]`;
              elementData.locators.secondary.push({
                type: 'aria-label',
                selector: selector,
                value: el.getAttribute('aria-label'),
                shadowDOM: isShadowElement
              });
            }

            if (el.getAttribute('role')) {
              const selector = `[role="${el.getAttribute('role')}"]`;
              elementData.locators.secondary.push({
                type: 'role',
                selector: selector,
                value: el.getAttribute('role'),
                shadowDOM: isShadowElement
              });
            }

            // 5. Class names (medium priority) - Enhanced with uniqueness detection
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\s+/).filter(c => c);
              if (classes.length > 0) {
                const combinedSelector = `.${classes.join('.')}`;
                const selector = combinedSelector;
                const isUnique = !isShadowElement && isSelectorUnique(combinedSelector);
                
                elementData.locators.secondary.push({
                  type: 'class',
                  selector: selector,
                  value: classes.join(' '),
                  shadowDOM: isShadowElement,
                  isUnique: isUnique,
                  uniquenessLevel: isUnique ? 'unique' : 'non-unique'
                });
                
                // If combined classes are not unique, try contextual selectors
                if (!isUnique || isShadowElement) {
                  const uniqueSelectors = generateUniqueSelector(el, combinedSelector);
                  uniqueSelectors.slice(1).slice(0, 2).forEach((uniqueSelector, index) => {
                    const contextualIsUnique = !isShadowElement && isSelectorUnique(uniqueSelector);
                    
                    elementData.locators.secondary.push({
                      type: `class-contextual-${index + 1}`,
                      selector: uniqueSelector,
                      value: classes.join(' '),
                      shadowDOM: isShadowElement,
                      isUnique: contextualIsUnique,
                      uniquenessLevel: contextualIsUnique ? 'contextual-unique' : 'contextual-non-unique'
                    });
                  });
                }
                
                // Also add individual classes as separate locators with uniqueness check
                classes.forEach((className, classIndex) => {
                  const singleSelector = `.${className}`;
                  const selector = singleSelector;
                  const isClassUnique = !isShadowElement && isSelectorUnique(singleSelector);
                  
                  elementData.locators.secondary.push({
                    type: 'single-class',
                    selector: selector,
                    value: className,
                    shadowDOM: isShadowElement,
                    isUnique: isClassUnique,
                    uniquenessLevel: isClassUnique ? 'unique' : 'non-unique',
                    classIndex: classIndex
                  });
                  
                  // If single class is not unique, add contextual version
                  if (!isClassUnique && classIndex === 0) { // Only for first class to avoid too many locators
                    const uniqueSelectors = generateUniqueSelector(el, singleSelector);
                    const bestContextual = uniqueSelectors.slice(1)[0]; // Take the first contextual selector
                    if (bestContextual) {
                      const contextualIsUnique = !isShadowElement && isSelectorUnique(bestContextual);
                      
                      elementData.locators.secondary.push({
                        type: 'single-class-contextual',
                        selector: bestContextual,
                        value: className,
                        shadowDOM: isShadowElement,
                        isUnique: contextualIsUnique,
                        uniquenessLevel: contextualIsUnique ? 'contextual-unique' : 'contextual-non-unique'
                      });
                    }
                  }
                });
              }
            }

            // 6. Type attribute (for inputs)
            if (el.type) {
              const selector = `[type="${el.type}"]`;
              elementData.locators.secondary.push({
                type: 'type',
                selector: selector,
                value: el.type,
                shadowDOM: isShadowElement
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
          console.log(`🔍 Content: Shadow DOM found: ${shadowDOMFound} elements`);
          console.log(`🔍 Content: Filtering stats - Skipped by tag: ${skippedByTag}, Skipped by visibility: ${skippedByVisibility}, Visible elements processed: ${visibleFound}`);

          // Validate results quality
          if (results.length === 0) {
            console.warn('🔍 Content: No elements found - this might indicate an issue');
            throw new Error(`No visible elements found on page. Checked ${totalChecked} elements, found ${visibleFound} visible elements.`);
          }
          
          if (results.length < 5 && visibleFound > 10) {
            console.warn('🔍 Content: Very few results captured compared to visible elements found');
          }

          const stats = {
            totalElements: results.length,
            primaryElements: results.filter(el => el.locators.primary.length > 0).length,
            secondaryElements: results.filter(el => el.locators.secondary.length > 0).length,
            shadowElements: results.filter(el => el.isShadowDOM).length,
            scanDuration: 100,
            debugInfo: {
              totalChecked,
              visibleFound,
              skippedByTag,
              skippedByVisibility,
              shadowDOMFound
            }
          };

          sendResponse({ success: true, results, stats });
        } catch (error) {
          console.error('🔍 Content: Scan error:', error);
          console.error('🔍 Content: Error stack:', error.stack);
          sendResponse({ success: false, error: error.message, details: error.stack });
        }
        break;
      
      case 'clearHighlighting':
        try {
          clearAllHighlighting();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'highlightElement':
        try {
          const { selector } = request;
          if (!selector) {
            throw new Error('No selector provided for highlighting');
          }
          
          console.log('🎯 HIGHLIGHT REQUEST RECEIVED - Selector:', selector);
          console.log('🎯 Page URL:', window.location.href);
          console.log('🎯 Document ready state:', document.readyState);
          
          // Clear previous highlights first
          clearAllHighlighting();
          
          // Find all matching elements (like browser dev tools)
          console.log('🔍 Searching for elements with selector:', selector);
          const elements = findAllElementsBySelectorIncludingShadowDOM(selector);
          
          console.log(`🔍 Found ${elements.length} elements for selector: ${selector}`);
          
          if (elements.length > 0) {
            console.log('🎯 Elements found, applying highlighting...');
            elements.forEach((el, index) => {
              console.log(`  Element ${index + 1}:`, {
                tag: el.tagName,
                id: el.id || 'no-id',
                classes: el.className || 'no-classes',
                text: (el.textContent || '').trim().substring(0, 50)
              });
            });
            
            const success = highlightAllElements(elements);
            if (success) {
              console.log(`✅ Successfully highlighted ${elements.length} elements`);
              sendResponse({ 
                success: true, 
                found: true, 
                count: elements.length 
              });
            } else {
              console.log('❌ Failed to highlight elements');
              sendResponse({ success: false, error: 'Failed to apply highlighting' });
            }
          } else {
            console.log('❌ No elements found for highlighting');
            
            // Additional debugging - try basic querySelector
            try {
              const basicElements = document.querySelectorAll(selector);
              console.log(`🔍 Basic querySelectorAll found: ${basicElements.length} elements`);
              
              if (basicElements.length > 0) {
                console.log('🎯 Basic selector works, highlighting with fallback method...');
                const fallbackSuccess = highlightAllElements(Array.from(basicElements));
                if (fallbackSuccess) {
                  sendResponse({ 
                    success: true, 
                    found: true, 
                    count: basicElements.length,
                    method: 'fallback' 
                  });
                  return;
                }
              }
            } catch (fallbackError) {
              console.error('❌ Fallback selector also failed:', fallbackError);
            }
            
            sendResponse({ success: true, found: false, count: 0 });
          }
        } catch (error) {
          console.error('❌ Error in highlightElement handler:', error);
          console.error('❌ Error stack:', error.stack);
          sendResponse({ success: false, error: error.message });
        }
        break;
      
      case 'clearHighlights':
        try {
          clearHighlights();
          console.log('✅ Highlights cleared');
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error clearing highlights:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'startElementScan':
        try {
          console.log('🎯 Starting element scan mode...');
          startElementScanMode();
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error starting element scan mode:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'stopElementScan':
        try {
          console.log('🎯 Stopping element scan mode...');
          stopElementScanMode();
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error stopping element scan mode:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep channel open
  });
  
  console.log('🚀 CONTENT SCRIPT: Universal Element Locator initialization complete!');
  console.log('🚀 CONTENT SCRIPT: Message listener added, ready to receive messages');
  console.log('🚀 CONTENT SCRIPT: Available functions: highlightElement, scanPage, clearHighlighting');
  }
}

// Helper function to generate unique contextual selectors
function generateUniqueSelector(element, baseSelector) {
  const selectors = [];
  const prefix = '';
  
  console.log('🔧 Generating contextual selectors for base:', baseSelector);
  
  // Start with the base selector
  selectors.push(`${prefix}${baseSelector}`);
  
  // Try to make it unique by adding parent context
  let parent = element.parentElement;
  if (parent) {
    // Parent with ID
    if (parent.id) {
      const contextualSelector = `${prefix}#${parent.id} ${baseSelector}`;
      selectors.push(contextualSelector);
      console.log('🔧 Added parent ID context:', contextualSelector);
    }
    
    // Parent with unique class
    if (parent.className) {
      const parentClasses = parent.className.trim().split(/\s+/).filter(c => c);
      if (parentClasses.length > 0) {
        const contextualSelector = `${prefix}.${parentClasses[0]} ${baseSelector}`;
        selectors.push(contextualSelector);
        console.log('🔧 Added parent class context:', contextualSelector);
      }
    }
    
    // Parent tag name context
    const tagContextSelector = `${prefix}${parent.tagName.toLowerCase()} ${baseSelector}`;
    selectors.push(tagContextSelector);
    console.log('🔧 Added parent tag context:', tagContextSelector);
    
    // Sibling index context (nth-child)
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    if (index >= 0) {
      selectors.push(`${prefix}${baseSelector}:nth-child(${index + 1})`);
    }
    
    // Grandparent context for deeply nested elements
    const grandparent = parent.parentElement;
    if (grandparent && grandparent.id) {
      selectors.push(`${prefix}#${grandparent.id} ${parent.tagName.toLowerCase()} ${baseSelector}`);
    }
  }
  
  // Table context (for table cells, rows)
  const table = element.closest('table');
  if (table) {
    const row = element.closest('tr');
    if (row) {
      const rowIndex = Array.from(table.querySelectorAll('tr')).indexOf(row);
      const cellIndex = Array.from(row.children).indexOf(element);
      if (rowIndex >= 0 && cellIndex >= 0) {
        selectors.push(`${prefix}table tr:nth-child(${rowIndex + 1}) ${baseSelector}`);
        selectors.push(`${prefix}table tr:nth-child(${rowIndex + 1}) td:nth-child(${cellIndex + 1}) ${baseSelector}`);
      }
    }
  }
  
  // Form context
  const form = element.closest('form');
  if (form) {
    if (form.id) {
      selectors.push(`${prefix}#${form.id} ${baseSelector}`);
    } else if (form.className) {
      const formClasses = form.className.trim().split(/\s+/).filter(c => c);
      if (formClasses.length > 0) {
        selectors.push(`${prefix}.${formClasses[0]} ${baseSelector}`);
      }
    }
  }
  
  // List context (for list items)
  const list = element.closest('ul, ol');
  if (list) {
    const listItems = Array.from(list.children);
    const itemIndex = listItems.indexOf(element.closest('li'));
    if (itemIndex >= 0) {
      selectors.push(`${prefix}${list.tagName.toLowerCase()} li:nth-child(${itemIndex + 1}) ${baseSelector}`);
    }
  }
  
  console.log(`🔧 Generated ${selectors.length} contextual selectors:`, selectors);
  return selectors;
}

// Helper function to check if a selector is unique on the page
function isSelectorUnique(selector, shadowDOM = false) {
  try {
    if (shadowDOM) {
      // For shadow DOM, we'd need more complex checking
      // For now, assume it might not be unique
      return false;
    }
    
    // Clean the selector - remove prefix spaces/artifacts
    const cleanSelector = selector.trim();
    
    console.log('🔍 Checking uniqueness for selector:', cleanSelector);
    
    const elements = document.querySelectorAll(cleanSelector);
    const isUnique = elements.length === 1;
    
    console.log(`🎯 Selector "${cleanSelector}" found ${elements.length} elements - Unique: ${isUnique}`);
    
    // Also log the first few elements found for debugging
    if (elements.length > 0 && elements.length <= 5) {
      console.log('🔍 Found elements:', Array.from(elements).map(el => ({
        tag: el.tagName,
        id: el.id || 'no-id',
        classes: el.className || 'no-classes'
      })));
    }
    
    return isUnique;
  } catch (e) {
    console.warn('⚠️ Error checking selector uniqueness:', e.message, 'for selector:', selector);
    return false;
  }
}

// Element scan mode functionality
if (!window.isElementScanMode) {
  window.isElementScanMode = false;
}
if (!window.scanModeHoverElement) {
  window.scanModeHoverElement = null;
}
if (!window.scanModeEventListeners) {
  window.scanModeEventListeners = [];
}

function startElementScanMode() {
  console.log('🎯 Starting element scan mode...');
  
  if (window.isElementScanMode) {
    console.log('🎯 Element scan mode already active');
    return;
  }
  
  window.isElementScanMode = true;
  
  // Clear any existing highlights
  clearAllHighlighting();
  
  // Create overlay to indicate scan mode is active
  createScanModeOverlay();
  
  // Add event listeners for hover and click
  const hoverListener = (event) => {
    if (!window.isElementScanMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    
    // Clear previous hover highlight
    if (window.scanModeHoverElement) {
      removeScanModeHighlight(window.scanModeHoverElement);
    }
    
    // Highlight current hover element
    window.scanModeHoverElement = element;
    addScanModeHighlight(element);
  };
  
  const clickListener = (event) => {
    if (!window.isElementScanMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    console.log('🎯 Element selected for scanning:', element);
    
    // Scan the selected element
    scanSelectedElement(element);
    
    // Exit scan mode
    stopElementScanMode();
  };
  
  const escapeListener = (event) => {
    if (!window.isElementScanMode) return;
    
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      console.log('🎯 Escape pressed - exiting scan mode');
      stopElementScanMode();
    }
  };
  
  // Add event listeners
  document.addEventListener('mouseover', hoverListener, true);
  document.addEventListener('click', clickListener, true);
  document.addEventListener('keydown', escapeListener, true);
  
  // Store listeners for cleanup
  window.scanModeEventListeners = [
    { element: document, event: 'mouseover', listener: hoverListener, capture: true },
    { element: document, event: 'click', listener: clickListener, capture: true },
    { element: document, event: 'keydown', listener: escapeListener, capture: true }
  ];
  
  console.log('🎯 Element scan mode activated - hover to highlight, click to select, ESC to exit');
}

function stopElementScanMode() {
  console.log('🎯 Stopping element scan mode...');
  
  if (!window.isElementScanMode) {
    console.log('🎯 Element scan mode not active');
    return;
  }
  
  window.isElementScanMode = false;
  
  // Clear hover highlight
  if (window.scanModeHoverElement) {
    removeScanModeHighlight(window.scanModeHoverElement);
    window.scanModeHoverElement = null;
  }
  
  // Remove event listeners
  window.scanModeEventListeners.forEach(({ element, event, listener, capture }) => {
    element.removeEventListener(event, listener, capture);
  });
  window.scanModeEventListeners = [];
  
  // Remove scan mode overlay
  removeScanModeOverlay();
  
  console.log('🎯 Element scan mode deactivated');
}

function createScanModeOverlay() {
  // Remove existing overlay if any
  removeScanModeOverlay();
  
  const overlay = document.createElement('div');
  overlay.id = 'universal-locator-scan-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 100, 200, 0.05);
    z-index: 999998;
    pointer-events: none;
    border: 3px solid #0066cc;
    box-sizing: border-box;
  `;
  
  const instruction = document.createElement('div');
  instruction.id = 'universal-locator-scan-instruction';
  instruction.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #0066cc;
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  instruction.textContent = '🎯 Element Scan Mode: Hover to highlight, Click to select, ESC to exit';
  
  document.body.appendChild(overlay);
  document.body.appendChild(instruction);
}

function removeScanModeOverlay() {
  const overlay = document.getElementById('universal-locator-scan-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  // Remove instruction by ID
  const instruction = document.getElementById('universal-locator-scan-instruction');
  if (instruction) {
    instruction.remove();
  }
}

function addScanModeHighlight(element) {
  if (!element) return;
  
  // Store original styles
  if (!element._originalScanStyles) {
    element._originalScanStyles = {
      outline: element.style.outline || '',
      backgroundColor: element.style.backgroundColor || '',
      boxShadow: element.style.boxShadow || '',
      transform: element.style.transform || '',
      transition: element.style.transition || ''
    };
  }
  
  // Apply hover highlight styles
  element.style.outline = '3px solid #ff6b35';
  element.style.backgroundColor = 'rgba(255, 107, 53, 0.2)';
  element.style.boxShadow = '0 0 10px rgba(255, 107, 53, 0.5)';
  element.style.transition = 'all 0.2s ease';
  element.classList.add('universal-locator-scan-hover');
}

function removeScanModeHighlight(element) {
  if (!element || !element._originalScanStyles) return;
  
  // Restore original styles
  const original = element._originalScanStyles;
  element.style.outline = original.outline;
  element.style.backgroundColor = original.backgroundColor;
  element.style.boxShadow = original.boxShadow;
  element.style.transform = original.transform;
  element.style.transition = original.transition;
  
  element.classList.remove('universal-locator-scan-hover');
  delete element._originalScanStyles;
}

function scanSelectedElement(element) {
  console.log('🎯 Scanning selected element:', element);
  
  try {
    // Generate comprehensive locators for the selected element
    const elementData = generateElementData(element);
    
    console.log('🎯 Generated element data:', elementData);
    
    // Show locators popup directly on the page
    showElementLocatorsOnPage(elementData);
    
    // Also send the element data back to the popup (if it's open)
    chrome.runtime.sendMessage({
      action: 'elementScanned',
      elementData: elementData
    }, (response) => {
      console.log('🎯 Message sent response:', response);
    });
    
    console.log('🎯 Element data processed and popup shown');
    
  } catch (error) {
    console.error('🎯 Error scanning selected element:', error);
    chrome.runtime.sendMessage({
      action: 'elementScanError',
      error: error.message
    });
  }
}

function generateElementData(element) {
  const rect = element.getBoundingClientRect();
  const isShadowElement = element.getRootNode() !== document;
  
  // Generate comprehensive element data similar to the main scan
  const elementData = {
    tagName: element.tagName.toLowerCase(),
    text: getCleanText(element),
    isShadowDOM: isShadowElement,
    position: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    textContent: {
      innerText: (element.innerText || '').trim().substring(0, 200),
      textContent: (element.textContent || '').trim().substring(0, 200),
      cleanText: getCleanText(element),
      hasText: !!(element.innerText || element.textContent || '').trim()
    },
    context: {
      parentTagName: element.parentElement ? element.parentElement.tagName.toLowerCase() : null,
      parentId: element.parentElement ? element.parentElement.id || null : null,
      parentClasses: element.parentElement ? Array.from(element.parentElement.classList) : [],
      childrenCount: element.children.length,
      siblingIndex: Array.from(element.parentElement?.children || []).indexOf(element),
      nestingLevel: getElementNestingLevel(element)
    },
    attributes: getAllAttributes(element),
    elementState: {
      isFormElement: ['input', 'select', 'textarea', 'button'].includes(element.tagName.toLowerCase()),
      isInteractive: isInteractiveElement(element),
      isVisible: isElementVisible(element),
      hasChildren: element.children.length > 0,
      isEmptyElement: !element.textContent?.trim() && element.children.length === 0
    },
    styling: {
      computedStyles: getRelevantStyles(element),
      displayType: window.getComputedStyle(element).display,
      visibility: window.getComputedStyle(element).visibility,
      opacity: window.getComputedStyle(element).opacity
    },
    locators: {
      primary: [],
      secondary: [],
      fallback: []
    }
  };
  
  // Generate locators for this specific element (similar to scan logic)
  generateLocatorsForElement(element, elementData, isShadowElement);
  
  return elementData;
}

function generateLocatorsForElement(element, elementData, isShadowElement) {
  const prefix = '';
  
  // 1. ID locators
  if (element.id) {
    const baseSelector = `#${element.id}`;
    const isUnique = !isShadowElement && isSelectorUnique(baseSelector);
    
    elementData.locators.primary.push({
      type: 'id',
      selector: prefix + baseSelector,
      value: element.id,
      shadowDOM: isShadowElement,
      isUnique: isUnique,
      uniquenessLevel: isUnique ? 'unique' : 'duplicate-id'
    });
    
    if (!isUnique || isShadowElement) {
      const uniqueSelectors = generateUniqueSelector(element, baseSelector);
      uniqueSelectors.slice(1).slice(0, 3).forEach((uniqueSelector, index) => {
        elementData.locators.primary.push({
          type: `id-contextual-${index + 1}`,
          selector: prefix + uniqueSelector,
          value: element.id,
          shadowDOM: isShadowElement,
          isUnique: !isShadowElement && isSelectorUnique(uniqueSelector),
          uniquenessLevel: 'contextual-id',
          baseAttribute: 'id'
        });
      });
    }
  }
  
  // 2. Data attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      const baseSelector = `[${attr.name}="${attr.value}"]`;
      const isUnique = !isShadowElement && isSelectorUnique(baseSelector);
      
      elementData.locators.primary.push({
        type: attr.name,
        selector: prefix + baseSelector,
        value: attr.value,
        shadowDOM: isShadowElement,
        isUnique: isUnique,
        uniquenessLevel: isUnique ? 'unique' : 'non-unique'
      });
      
      if (!isUnique || isShadowElement) {
        const uniqueSelectors = generateUniqueSelector(element, baseSelector);
        uniqueSelectors.slice(1).slice(0, 2).forEach((uniqueSelector, index) => {
          elementData.locators.primary.push({
            type: `${attr.name}-contextual-${index + 1}`,
            selector: prefix + uniqueSelector,
            value: attr.value,
            shadowDOM: isShadowElement,
            isUnique: !isShadowElement && isSelectorUnique(uniqueSelector),
            uniquenessLevel: 'contextual-data',
            baseAttribute: attr.name
          });
        });
      }
    }
  }
  
  // 3. Name attribute (for form elements)
  if (element.name) {
    const baseSelector = `[name="${element.name}"]`;
    const tagSelector = `${element.tagName.toLowerCase()}[name="${element.name}"]`;
    
    elementData.locators.secondary.push({
      type: 'name',
      selector: prefix + baseSelector,
      value: element.name,
      shadowDOM: isShadowElement,
      isUnique: !isShadowElement && isSelectorUnique(baseSelector)
    });
    
    elementData.locators.secondary.push({
      type: 'name-with-tag',
      selector: prefix + tagSelector,
      value: element.name,
      shadowDOM: isShadowElement,
      isUnique: !isShadowElement && isSelectorUnique(tagSelector)
    });
  }
  
  // 4. Class-based selectors
  if (element.className && element.className.trim()) {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    
    // Single class selectors
    classes.slice(0, 3).forEach(className => {
      const baseSelector = `.${className}`;
      const tagSelector = `${element.tagName.toLowerCase()}.${className}`;
      
      elementData.locators.secondary.push({
        type: 'class',
        selector: prefix + baseSelector,
        value: className,
        shadowDOM: isShadowElement,
        isUnique: !isShadowElement && isSelectorUnique(baseSelector)
      });
      
      elementData.locators.secondary.push({
        type: 'class-with-tag',
        selector: prefix + tagSelector,
        value: className,
        shadowDOM: isShadowElement,
        isUnique: !isShadowElement && isSelectorUnique(tagSelector)
      });
    });
    
    // Combined class selectors
    if (classes.length > 1) {
      const combinedSelector = `.${classes.join('.')}`;
      const combinedTagSelector = `${element.tagName.toLowerCase()}${combinedSelector}`;
      
      elementData.locators.secondary.push({
        type: 'multiple-classes',
        selector: prefix + combinedSelector,
        value: classes.join(' '),
        shadowDOM: isShadowElement,
        isUnique: !isShadowElement && isSelectorUnique(combinedSelector)
      });
      
      elementData.locators.secondary.push({
        type: 'multiple-classes-with-tag',
        selector: prefix + combinedTagSelector,
        value: classes.join(' '),
        shadowDOM: isShadowElement,
        isUnique: !isShadowElement && isSelectorUnique(combinedTagSelector)
      });
    }
  }
  
  // 5. Text-based selectors
  const cleanText = getCleanText(element);
  if (cleanText && cleanText.length > 0 && cleanText.length <= 50) {
    // Exact text match
    elementData.locators.secondary.push({
      type: 'text-exact',
      selector: `${prefix}:contains("${cleanText}")`,
      value: cleanText,
      shadowDOM: isShadowElement,
      note: 'CSS :contains() not standard - use XPath instead'
    });
    
    // Tag with text
    elementData.locators.secondary.push({
      type: 'tag-with-text',
      selector: `${prefix}${element.tagName.toLowerCase()}:contains("${cleanText}")`,
      value: cleanText,
      shadowDOM: isShadowElement,
      note: 'CSS :contains() not standard - use XPath instead'
    });
    
    // XPath text selectors
    elementData.locators.fallback.push({
      type: 'xpath-text-exact',
      selector: `//${element.tagName.toLowerCase()}[text()="${cleanText}"]`,
      value: cleanText,
      shadowDOM: isShadowElement,
      selectorType: 'xpath'
    });
    
    elementData.locators.fallback.push({
      type: 'xpath-text-contains',
      selector: `//${element.tagName.toLowerCase()}[contains(text(),"${cleanText}")]`,
      value: cleanText,
      shadowDOM: isShadowElement,
      selectorType: 'xpath'
    });
  }
  
  // 6. Positional/structural selectors
  if (element.parentElement) {
    const siblings = Array.from(element.parentElement.children);
    const index = siblings.indexOf(element);
    
    if (index >= 0) {
      // nth-child
      elementData.locators.fallback.push({
        type: 'nth-child',
        selector: `${prefix}${element.tagName.toLowerCase()}:nth-child(${index + 1})`,
        value: index + 1,
        shadowDOM: isShadowElement,
        note: 'Position-based - may be fragile'
      });
      
      // nth-of-type
      const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);
      const typeIndex = sameTagSiblings.indexOf(element);
      if (typeIndex >= 0) {
        elementData.locators.fallback.push({
          type: 'nth-of-type',
          selector: `${prefix}${element.tagName.toLowerCase()}:nth-of-type(${typeIndex + 1})`,
          value: typeIndex + 1,
          shadowDOM: isShadowElement,
          note: 'Position-based - may be fragile'
        });
      }
    }
  }
  
  // 7. Attribute-based selectors (other than id, name, class, data-*)
  for (const attr of element.attributes) {
    if (!['id', 'class', 'name'].includes(attr.name) && !attr.name.startsWith('data-')) {
      const baseSelector = `[${attr.name}="${attr.value}"]`;
      const tagSelector = `${element.tagName.toLowerCase()}[${attr.name}="${attr.value}"]`;
      
      elementData.locators.fallback.push({
        type: `attribute-${attr.name}`,
        selector: prefix + baseSelector,
        value: attr.value,
        shadowDOM: isShadowElement,
        isUnique: !isShadowElement && isSelectorUnique(baseSelector)
      });
      
      elementData.locators.fallback.push({
        type: `attribute-${attr.name}-with-tag`,
        selector: prefix + tagSelector,
        value: attr.value,
        shadowDOM: isShadowElement,
        isUnique: !isShadowElement && isSelectorUnique(tagSelector)
      });
    }
  }
}

// Function to show element locators popup directly on the page
function showElementLocatorsOnPage(elementData) {
  console.log('🎯 Showing element locators on page:', elementData);
  
  // Remove existing popup if any
  const existingPopup = document.getElementById('universal-locator-element-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  const popup = document.createElement('div');
  popup.id = 'universal-locator-element-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    width: 400px;
    max-height: 80vh;
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 2px solid #0066cc;
    overflow: hidden;
  `;
  
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 15px 20px;
    background: #0066cc;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
    user-select: none;
  `;
  
  const title = document.createElement('h3');
  title.style.cssText = `
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  `;
  title.textContent = `🎯 Element Locators: ${elementData.tagName.toUpperCase()}`;
  
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 14px;
    color: white;
    font-weight: bold;
  `;
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => popup.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Make popup draggable
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = popup.offsetLeft;
    startTop = popup.offsetTop;
    header.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    popup.style.left = (startLeft + deltaX) + 'px';
    popup.style.top = (startTop + deltaY) + 'px';
    popup.style.right = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'move';
    }
  });
  
  const body = document.createElement('div');
  body.style.cssText = `
    padding: 20px;
    max-height: 60vh;
    overflow-y: auto;
    background: #f8f9fa;
  `;
  
  // Element info
  const elementInfo = document.createElement('div');
  elementInfo.style.cssText = `
    background: #f8f9fa;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 15px;
  `;
  
  elementInfo.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Tag:</strong> ${elementData.tagName.toUpperCase()}
      ${elementData.isShadowDOM ? ' <span style="color: #e67e22; font-weight: bold;">(Shadow DOM)</span>' : ''}
    </div>
    ${elementData.textContent && elementData.textContent.cleanText ? `<div style="margin-bottom: 10px;"><strong>Text:</strong> "${elementData.textContent.cleanText}"</div>` : ''}
    ${elementData.attributes && elementData.attributes.id ? `<div style="margin-bottom: 10px;"><strong>ID:</strong> ${elementData.attributes.id}</div>` : ''}
    ${elementData.attributes && elementData.attributes.class ? `<div style="margin-bottom: 10px;"><strong>Classes:</strong> ${elementData.attributes.class}</div>` : ''}
    <div><strong>Position:</strong> ${elementData.position.x}, ${elementData.position.y} (${elementData.position.width}x${elementData.position.height})</div>
  `;
  
  body.appendChild(elementInfo);
  
  // Locators sections
  const locatorSections = [
    { title: 'Primary Locators (Recommended)', locators: elementData.locators.primary || [], style: 'background: #d4edda; border-left: 4px solid #28a745;' },
    { title: 'Secondary Locators', locators: elementData.locators.secondary || [], style: 'background: #fff3cd; border-left: 4px solid #ffc107;' },
    { title: 'Fallback Locators', locators: elementData.locators.fallback || [], style: 'background: #f8d7da; border-left: 4px solid #dc3545;' }
  ];
  
  locatorSections.forEach(section => {
    if (section.locators.length > 0) {
      const sectionDiv = document.createElement('div');
      sectionDiv.style.cssText = `margin-bottom: 20px;`;
      
      const sectionTitle = document.createElement('h3');
      sectionTitle.style.cssText = `
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #333;
      `;
      sectionTitle.textContent = `${section.title} (${section.locators.length})`;
      
      sectionDiv.appendChild(sectionTitle);
      
      section.locators.forEach((locator) => {
        const locatorDiv = document.createElement('div');
        locatorDiv.style.cssText = `
          ${section.style}
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        `;
        
        const selectorDiv = document.createElement('div');
        selectorDiv.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 5px;
        `;
        
        const selectorText = document.createElement('code');
        selectorText.style.cssText = `
          flex: 1;
          background: rgba(0, 0, 0, 0.05);
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 12px;
          word-break: break-all;
        `;
        selectorText.textContent = locator.selector;
        
        const copyBtn = document.createElement('button');
        copyBtn.style.cssText = `
          background: #007bff;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 11px;
          white-space: nowrap;
        `;
        copyBtn.textContent = '📋 Copy';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(locator.selector);
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
          }, 2000);
        };
        
        const highlightBtn = document.createElement('button');
        highlightBtn.style.cssText = `
          background: #28a745;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 11px;
          white-space: nowrap;
        `;
        highlightBtn.textContent = '🎯 Test';
        highlightBtn.onclick = () => {
          try {
            console.log('🎯 Testing selector:', locator.selector);
            
            // Test the selector by highlighting elements
            const elements = findAllElementsBySelectorIncludingShadowDOM(locator.selector);
            console.log(`🎯 Found ${elements.length} elements for selector:`, locator.selector);
            
            if (elements.length > 0) {
              const success = highlightAllElements(elements);
              if (success) {
                highlightBtn.textContent = `✅ Found ${elements.length}!`;
                highlightBtn.style.background = '#28a745';
                
                // Auto-scroll to first element
                if (elements[0]) {
                  try {
                    elements[0].scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'center', 
                      inline: 'center' 
                    });
                  } catch (scrollError) {
                    console.warn('Could not scroll to element:', scrollError);
                  }
                }
              } else {
                highlightBtn.textContent = '❌ Highlight failed';
                highlightBtn.style.background = '#dc3545';
              }
            } else {
              highlightBtn.textContent = '❌ None found';
              highlightBtn.style.background = '#dc3545';
            }
            
            setTimeout(() => {
              highlightBtn.textContent = '🎯 Test';
              highlightBtn.style.background = '#28a745';
            }, 3000);
            
          } catch (error) {
            console.error('Error testing selector:', error);
            highlightBtn.textContent = '❌ Error';
            highlightBtn.style.background = '#dc3545';
            setTimeout(() => {
              highlightBtn.textContent = '🎯 Test';
              highlightBtn.style.background = '#28a745';
            }, 3000);
          }
        };
        
        selectorDiv.appendChild(selectorText);
        selectorDiv.appendChild(copyBtn);
        selectorDiv.appendChild(highlightBtn);
        
        const metaDiv = document.createElement('div');
        metaDiv.style.cssText = `
          font-size: 11px;
          color: #666;
          margin-top: 5px;
        `;
        
        let metaInfo = `Type: ${locator.type}`;
        if (locator.isUnique !== undefined) {
          metaInfo += ` | Unique: ${locator.isUnique ? '✅' : '❌'}`;
        }
        if (locator.shadowDOM) {
          metaInfo += ' | Shadow DOM';
        }
        if (locator.note) {
          metaInfo += ` | Note: ${locator.note}`;
        }
        
        metaDiv.textContent = metaInfo;
        
        locatorDiv.appendChild(selectorDiv);
        locatorDiv.appendChild(metaDiv);
        
        sectionDiv.appendChild(locatorDiv);
      });
      
      body.appendChild(sectionDiv);
    }
  });
  
  // If no locators were generated, show a message
  if ((!elementData.locators.primary || elementData.locators.primary.length === 0) &&
      (!elementData.locators.secondary || elementData.locators.secondary.length === 0) &&
      (!elementData.locators.fallback || elementData.locators.fallback.length === 0)) {
    const noLocatorsDiv = document.createElement('div');
    noLocatorsDiv.style.cssText = `
      background: #f8d7da;
      border-left: 4px solid #dc3545;
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    `;
    noLocatorsDiv.innerHTML = `
      <h3 style="margin: 0 0 10px 0; color: #721c24;">No Locators Generated</h3>
      <p style="margin: 0; color: #721c24;">This element might not have sufficient identifying attributes for reliable locator generation.</p>
    `;
    body.appendChild(noLocatorsDiv);
  }
  
  // Create content container
  const content = document.createElement('div');
  content.appendChild(header);
  content.appendChild(body);
  popup.appendChild(content);
  
  document.body.appendChild(popup);
  
  // Auto-focus first copy button for keyboard users
  const firstCopyBtn = popup.querySelector('button[onclick]');
  if (firstCopyBtn) {
    firstCopyBtn.focus();
  }
  
  console.log('🎯 Element locators popup created and displayed');
}
