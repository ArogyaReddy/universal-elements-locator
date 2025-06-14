/* global chrome */
// Popup script - Enhanced with highlighting and separate view results

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup initializing...');
  
  const statusEl = document.getElementById('status');
  const scanBtn = document.getElementById('scanButton');
  const viewResultsBtn = document.getElementById('viewResultsButton');
  
  let scanResults = null;
  
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }
  
  function enableViewResults(enable = true) {
    if (viewResultsBtn) {
      viewResultsBtn.disabled = !enable;
    }
  }
  
  async function scanWithHighlighting() {
    try {
      setStatus('Scanning and highlighting elements...');
      if (scanBtn) scanBtn.disabled = true;
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url) {
        console.log('🔍 Popup: No tab or URL available:', { tab: !!tab, url: tab?.url });
        setStatus('No active tab found');
        if (scanBtn) scanBtn.disabled = false;
        return;
      }
      
      // Check if URL is supported (exclude browser internal pages)
      const url = tab.url;
      const isSupported = url.startsWith('http://') || 
                         url.startsWith('https://') || 
                         url.startsWith('file://') ||
                         url.startsWith('data:text/html');
      
      const isBlocked = url.startsWith('chrome://') || 
                       url.startsWith('chrome-extension://') ||
                       url.startsWith('moz-extension://') ||
                       url.startsWith('about:') ||
                       url.startsWith('edge://') ||
                       url.startsWith('brave://');
      
      if (!isSupported || isBlocked) {
        console.log('🔍 Popup: Unsupported URL:', { url, isSupported, isBlocked });
        setStatus('This page type is not supported - please try a website or HTML file');
        if (scanBtn) scanBtn.disabled = false;
        return;
      }
      
      console.log('🔍 Popup: Starting scan on tab:', { id: tab.id, url: tab.url });
      
      // Ensure content script is injected
      try {
        console.log('🔍 Popup: Injecting content script...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('🔍 Popup: Content script injected successfully');
      } catch (error) {
        console.log('🔍 Popup: Content script injection error:', error);
        if (error.message.includes('Cannot access')) {
          setStatus('Cannot access this page - try a different website or enable file access');
          if (scanBtn) scanBtn.disabled = false;
          return;
        }
      }
      
      // Wait for script to be ready and test communication
      console.log('🔍 Popup: Waiting for content script to be ready...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test if content script is responsive
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        console.log('🔍 Popup: Content script ping response:', pingResponse);
        if (!pingResponse || !pingResponse.success) {
          console.log('🔍 Popup: Content script not responding to ping');
          setStatus('Content script not ready - please try again');
          if (scanBtn) scanBtn.disabled = false;
          return;
        }
      } catch (pingError) {
        console.log('🔍 Popup: Content script ping failed:', pingError);
        setStatus('Cannot communicate with page - please try again');
        if (scanBtn) scanBtn.disabled = false;
        return;
      }
      
      // Check highlighting preference
      const highlightEnabled = document.getElementById('highlightDuringScan')?.checked ?? true;
      
      // Start scan with highlighting
      let scanResponse = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!scanResponse && retryCount < maxRetries) {
        try {
          console.log(`🔍 Popup: Scan attempt ${retryCount + 1}/${maxRetries}`);
          
          // Send scan message with highlighting option
          scanResponse = await chrome.tabs.sendMessage(tab.id, { 
            action: 'scanPageWithHighlighting',
            options: {
              highlight: highlightEnabled,
              includeShadowDOM: document.getElementById('includeShadowDOM')?.checked ?? true,
              includeHidden: document.getElementById('includeHidden')?.checked ?? false
            }
          });
          
          console.log(`🔍 Popup: Scan attempt ${retryCount + 1} response:`, scanResponse);
          
          if (!scanResponse) {
            console.log(`🔍 Popup: No response received on attempt ${retryCount + 1}`);
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`🔍 Popup: Retrying in 1000ms...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            continue;
          }
          
          if (!scanResponse.success) {
            console.log(`🔍 Popup: Scan failed on attempt ${retryCount + 1}:`, scanResponse.error || 'Unknown error');
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`🔍 Popup: Retrying in 1000ms...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            continue;
          }
          
          // Success - break out of retry loop
          break;
          
        } catch (error) {
          console.log(`🔍 Popup: Scan attempt ${retryCount + 1} error:`, error);
          
          if (error.message.includes('Receiving end does not exist')) {
            console.log('🔍 Popup: Content script disconnected, re-injecting...');
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              });
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (injectionError) {
              console.log('🔍 Popup: Re-injection failed:', injectionError);
            }
          }
          
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`🔍 Popup: Retrying in 1000ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!scanResponse || !scanResponse.success) {
        console.log('🔍 Popup: All scan attempts failed');
        console.log('🔍 Popup: Final scan response:', scanResponse);
        
        let errorMessage = 'Scan failed - please try again';
        if (scanResponse && scanResponse.error) {
          errorMessage = `Scan failed: ${scanResponse.error}`;
        }
        
        setStatus(errorMessage);
        if (scanBtn) scanBtn.disabled = false;
        return;
      }
      
      console.log('🔍 Popup: Raw scan response:', scanResponse);
      
      if (scanResponse && scanResponse.success) {
        console.log('🔍 Popup: Scan response details:', {
          hasResults: !!scanResponse.results,
          resultsLength: scanResponse.results ? scanResponse.results.length : 'undefined',
          resultsType: typeof scanResponse.results,
          firstResult: scanResponse.results && scanResponse.results[0] ? {
            tagName: scanResponse.results[0].tagName,
            hasAttributes: !!scanResponse.results[0].attributes,
            attributeKeys: scanResponse.results[0].attributes ? Object.keys(scanResponse.results[0].attributes) : 'no attributes',
            hasContext: !!scanResponse.results[0].context,
            hasLocators: !!scanResponse.results[0].locators,
            primaryLocators: scanResponse.results[0].locators?.primary?.length || 0,
            secondaryLocators: scanResponse.results[0].locators?.secondary?.length || 0,
            fallbackLocators: scanResponse.results[0].locators?.fallback?.length || 0,
            hasTextContent: !!scanResponse.results[0].textContent,
            textContentKeys: scanResponse.results[0].textContent ? Object.keys(scanResponse.results[0].textContent) : 'no textContent'
          } : 'no first result'
        });
        
        setStatus(`Scan complete! Found ${scanResponse.stats.totalElements} elements`);
        
        // Prepare scan results
        scanResults = {
          url: tab.url,
          title: tab.title,
          timestamp: new Date().toISOString(),
          duration: scanResponse.stats.scanDuration || 100,
          totalElements: scanResponse.stats.totalElements || 0,
          elementsWithPrimary: scanResponse.stats.primaryElements || 0,
          elementsWithSecondary: scanResponse.stats.secondaryElements || 0,
          shadowDOMElements: scanResponse.stats.shadowElements || 0,
          elements: scanResponse.results || []
        };
        
        console.log('🔍 Popup: Prepared scan data:', {
          elementsLength: scanResults.elements.length,
          firstElementDebug: scanResults.elements[0] ? {
            tagName: scanResults.elements[0].tagName,
            hasAttributes: !!scanResults.elements[0].attributes,
            attributeCount: scanResults.elements[0].attributes ? Object.keys(scanResults.elements[0].attributes).length : 0,
            hasContext: !!scanResults.elements[0].context,
            hasLocators: !!scanResults.elements[0].locators,
            locatorCounts: {
              primary: scanResults.elements[0].locators?.primary?.length || 0,
              secondary: scanResults.elements[0].locators?.secondary?.length || 0,
              fallback: scanResults.elements[0].locators?.fallback?.length || 0
            }
          } : 'no first element'
        });
        
        // Validate data quality before saving
        const hasValidData = scanResults.elements.some(element => {
          const hasAttributes = element.attributes && Object.keys(element.attributes).length > 0;
          const hasLocators = element.locators && (
            (element.locators.primary && element.locators.primary.length > 0) ||
            (element.locators.secondary && element.locators.secondary.length > 0) ||
            (element.locators.fallback && element.locators.fallback.length > 0)
          );
          return hasAttributes || hasLocators;
        });
        
        if (!hasValidData) {
          console.warn('⚠️ Warning: Scan data appears to be empty or invalid.');
          setStatus('Scan completed but data appears empty - please try again');
          if (scanBtn) scanBtn.disabled = false;
          return;
        }
        
        // Save scan results
        await chrome.storage.local.clear();
        await chrome.storage.local.set({ scanResults });
        
        // Enable view results button
        enableViewResults(true);
        setStatus('Scan complete! Click "View Scanned Results" to see details');
        
        // Clear highlighting after a delay
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'clearHighlighting' });
          } catch (error) {
            console.log('Note: Could not clear highlighting:', error.message);
          }
        }, 3000);
        
      } else {
        setStatus('Scan failed - please try again');
      }
    } catch (error) {
      console.log('Scan failed:', error);
      setStatus('Scan failed - please try again');
    } finally {
      if (scanBtn) scanBtn.disabled = false;
    }
  }
  
  async function viewResults() {
    if (!scanResults) {
      setStatus('No scan results available - please scan first');
      return;
    }
    
    // Open results page
    chrome.tabs.create({ url: 'results.html' });
  }
  
  // Manual highlight functionality
  const manualSelector = document.getElementById('manualSelector');
  const manualHighlightBtn = document.getElementById('manualHighlightBtn');
  
  async function manualHighlight() {
    try {
      const selector = manualSelector?.value?.trim();
      if (!selector) {
        setStatus('Please enter a CSS selector');
        return;
      }
      
      setStatus('Highlighting element with selector: ' + selector);
      if (manualHighlightBtn) manualHighlightBtn.disabled = true;
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        setStatus('No active tab found');
        if (manualHighlightBtn) manualHighlightBtn.disabled = false;
        return;
      }
      
      console.log('🎯 Manual highlight: Sending to tab', tab.id, 'selector:', selector);
      
      // Send highlight message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'highlightElement',
        selector: selector
      });
      
      console.log('🎯 Manual highlight response:', response);
      
      if (response && response.success) {
        if (response.found) {
          const count = response.count || 1;
          if (count === 1) {
            setStatus('✅ Element highlighted successfully! Check the page.');
          } else {
            setStatus(`✅ ${count} elements highlighted successfully! Check the page.`);
          }
        } else {
          setStatus('⚠️ No elements found with selector: ' + selector);
        }
      } else {
        setStatus('❌ Failed to highlight: ' + (response?.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Manual highlight error:', error);
      
      // Check if it's a content script issue
      if (error.message.includes('Could not establish connection') || 
          error.message.includes('Receiving end does not exist')) {
        
        setStatus('⚠️ Content script not found - try refreshing the page first');
      } else {
        setStatus('❌ Highlight failed: ' + error.message);
      }
    } finally {
      if (manualHighlightBtn) manualHighlightBtn.disabled = false;
    }
  }
  
  // Wire up events
  if (scanBtn) scanBtn.onclick = scanWithHighlighting;
  if (viewResultsBtn) viewResultsBtn.onclick = viewResults;
  if (manualHighlightBtn) manualHighlightBtn.onclick = manualHighlight;
  
  // Enable Enter key in the selector input
  if (manualSelector) {
    manualSelector.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        manualHighlight();
      }
    });
    
    // Auto-clear status when typing
    manualSelector.addEventListener('input', () => {
      if (manualSelector.value.trim()) {
        setStatus('Ready to highlight: ' + manualSelector.value.trim());
      } else {
        setStatus('Ready to scan any webpage or HTML file!');
      }
    });
  }
  
  // Set initial state
  setStatus('Ready to scan any webpage or HTML file!');
  enableViewResults(false);
});
