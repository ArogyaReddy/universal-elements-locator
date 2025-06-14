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
  const originalTransform = element.style.transform;
  
  console.log('💾 Stored original styles for element');
  
  // Apply bright orange/red highlighting with maximum visibility
  element.style.transition = 'all 0.3s ease';
  element.style.outline = '5px solid #ff4500 !important';
  element.style.boxShadow = '0 0 30px rgba(255, 69, 0, 1), inset 0 0 30px rgba(255, 69, 0, 0.4) !important';
  element.style.zIndex = '999999 !important';
  element.style.backgroundColor = 'rgba(255, 69, 0, 0.2) !important';
  element.style.transform = 'scale(1.02)';
  
  console.log('🎨 Applied orange highlighting styles');
  
  // Store element and original styles for cleanup
  element._originalStyles = {
    outline: originalOutline,
    boxShadow: originalBoxShadow,
    zIndex: originalZIndex,
    transition: originalTransition,
    backgroundColor: originalBackground,
    transform: originalTransform
  };
  
  window.highlightedElements.push(element);
  
  // Add a strong pulsing effect for maximum visibility
  setTimeout(() => {
    if (element.style.outline && element.style.outline.includes('#ff4500')) {
      element.style.outline = '5px solid rgba(255, 69, 0, 0.8) !important';
      element.style.boxShadow = '0 0 40px rgba(255, 69, 0, 1), inset 0 0 40px rgba(255, 69, 0, 0.5) !important';
      console.log('💫 Applied first pulse effect');
    }
  }, 150);
  
  // Add a second pulse for extra visibility
  setTimeout(() => {
    if (element.style.outline && (element.style.outline.includes('#ff4500') || element.style.outline.includes('255, 69, 0'))) {
      element.style.outline = '5px solid #ff4500 !important';
      element.style.boxShadow = '0 0 35px rgba(255, 69, 0, 1), inset 0 0 35px rgba(255, 69, 0, 0.4) !important';
      console.log('💫 Applied second pulse effect');
    }
  }, 300);
  
  console.log('✅ UI highlighting completed for element:', element.tagName);
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
      if (element._originalStyles.transform !== undefined) {
        element.style.transform = element._originalStyles.transform;
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
  console.log('🔍 Searching for ALL elements with selector:', selector);
  const foundElements = [];
  
  // First try standard document query for all elements
  try {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      foundElements.push(...Array.from(elements));
      console.log(`✅ Found ${elements.length} elements in main document`);
    }
  } catch (e) {
    console.error('❌ Invalid selector:', selector, e);
    return [];
  }
  
  // Search in Shadow DOM trees
  const allElements = getAllElementsIncludingShadowDOM(document);
  for (const el of allElements) {
    if (el.element && el.element.shadowRoot) {
      try {
        const shadowElements = el.element.shadowRoot.querySelectorAll(selector);
        if (shadowElements.length > 0) {
          foundElements.push(...Array.from(shadowElements));
          console.log(`✅ Found ${shadowElements.length} elements in Shadow DOM of:`, el.element.tagName);
        }
      } catch (e) {
        // Ignore errors from closed shadow roots or invalid selectors
        console.log('⚠️ Could not search in Shadow DOM:', e.message);
      }
    }
  }
  
  console.log(`🎯 Total elements found: ${foundElements.length}`);
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
    console.log('❌ No elements to highlight');
    return false;
  }
  
  console.log(`🎯 Highlighting ${elements.length} elements`);
  
  let successCount = 0;
  elements.forEach((element, index) => {
    try {
      // For the first element, clear highlights and scroll into view
      // For subsequent elements, skip clearing and scrolling
      const skipClearAndScroll = index > 0;
      highlightElement(element, skipClearAndScroll);
      successCount++;
      console.log(`✅ Highlighted element ${index + 1}/${elements.length}:`, element.tagName, element.id || element.className);
    } catch (error) {
      console.error(`❌ Failed to highlight element ${index + 1}:`, error);
    }
  });
  
  console.log(`🎯 Successfully highlighted ${successCount}/${elements.length} elements`);
  return successCount > 0;
}

// Simple initialization
if (!window.universalLocatorInjected) {
  window.universalLocatorInjected = true;
  
  // Highlighting functionality - only declare if not already declared
  if (!window.highlightedElements) {
    window.highlightedElements = [];
  }
  
  // Only add event listener if not already added
  if (!window.universalLocatorListenerAdded) {
    window.universalLocatorListenerAdded = true;
    
    // Basic message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request.action);
    
    switch (request.action) {
      case 'ping':
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
                  elementData.locators.primary.push({
                    type: `id-contextual-${index + 1}`,
                    selector: uniqueSelector,
                    value: el.id,
                    shadowDOM: isShadowElement,
                    isUnique: !isShadowElement && isSelectorUnique(uniqueSelector.replace('/* Shadow DOM */ ', '')),
                    uniquenessLevel: 'contextual-id',
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
                    elementData.locators.primary.push({
                      type: `${attr.name}-contextual-${index + 1}`,
                      selector: uniqueSelector,
                      value: attr.value,
                      shadowDOM: isShadowElement,
                      isUnique: !isShadowElement && isSelectorUnique(uniqueSelector),
                      uniquenessLevel: 'contextual',
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
                    elementData.locators.secondary.push({
                      type: `class-contextual-${index + 1}`,
                      selector: uniqueSelector,
                      value: classes.join(' '),
                      shadowDOM: isShadowElement,
                      isUnique: !isShadowElement && isSelectorUnique(uniqueSelector),
                      uniquenessLevel: 'contextual-class'
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
                      elementData.locators.secondary.push({
                        type: 'single-class-contextual',
                        selector: bestContextual,
                        value: className,
                        shadowDOM: isShadowElement,
                        isUnique: !isShadowElement && isSelectorUnique(bestContextual),
                        uniquenessLevel: 'contextual-single-class'
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
          
          console.log('🎯 Highlighting ALL elements with selector:', selector);
          
          // Find all matching elements (like browser dev tools)
          const elements = findAllElementsBySelectorIncludingShadowDOM(selector);
          if (elements.length > 0) {
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
            sendResponse({ success: true, found: false, count: 0 });
          }
        } catch (error) {
          console.error('Error highlighting elements:', error);
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
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep channel open
  });
  
  console.log('Universal Element Locator: Content script ready');
  }
}

// Helper function to generate unique contextual selectors
function generateUniqueSelector(element, baseSelector) {
  const selectors = [];
  const prefix = '';
  
  // Start with the base selector
  selectors.push(`${prefix}${baseSelector}`);
  
  // Try to make it unique by adding parent context
  let parent = element.parentElement;
  if (parent) {
    // Parent with ID
    if (parent.id) {
      selectors.push(`${prefix}#${parent.id} ${baseSelector}`);
    }
    
    // Parent with unique class
    if (parent.className) {
      const parentClasses = parent.className.trim().split(/\s+/).filter(c => c);
      if (parentClasses.length > 0) {
        selectors.push(`${prefix}.${parentClasses[0]} ${baseSelector}`);
      }
    }
    
    // Parent tag name context
    selectors.push(`${prefix}${parent.tagName.toLowerCase()} ${baseSelector}`);
    
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
    const elements = document.querySelectorAll(selector);
    return elements.length === 1;
  } catch (e) {
    return false;
  }
}
