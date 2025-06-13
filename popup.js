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
      
      if (!tab || !tab.url.startsWith('http')) {
        setStatus('This extension only works on web pages');
        if (scanBtn) scanBtn.disabled = false;
        return;
      }
      
      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (error) {
        console.log('Content script injection note:', error.message);
      }
      
      // Wait for script to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
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
          
          if (!scanResponse || !scanResponse.success) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`🔍 Popup: Scan attempt failed, retrying in 500ms...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } catch (error) {
          console.log(`🔍 Popup: Scan attempt ${retryCount + 1} error:`, error);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      if (!scanResponse || !scanResponse.success) {
        setStatus('Scan failed - please try again');
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
  
  // Wire up events
  if (scanBtn) scanBtn.onclick = scanWithHighlighting;
  if (viewResultsBtn) viewResultsBtn.onclick = viewResults;
  
  // Set initial state
  setStatus('Ready to scan any webpage!');
  enableViewResults(false);
});
