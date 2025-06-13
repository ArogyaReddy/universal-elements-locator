/* global chrome */
// Popup script - Always ready, no connection checking

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup initializing...');
  
  const statusEl = document.getElementById('status');
  const scanBtn = document.getElementById('scanButton');
  
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }
  
  async function scan() {
    try {
      setStatus('Scanning page elements...');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url.startsWith('http')) {
        setStatus('This extension only works on web pages');
        return;
      }
      
      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (error) {
        // Content script might already be injected, continue anyway
        console.log('Content script injection note:', error.message);
      }
      
      // Wait a moment for script to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Try scan with retry logic
      let scanResponse = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!scanResponse && retryCount < maxRetries) {
        try {
          console.log(`🔍 Popup: Scan attempt ${retryCount + 1}/${maxRetries}`);
          scanResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });
          
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
      
      const response = scanResponse;
      
      console.log('🔍 Popup: Raw scan response:', response);
      
      if (response && response.success) {
        console.log('🔍 Popup: Scan response details:', {
          hasResults: !!response.results,
          resultsLength: response.results ? response.results.length : 'undefined',
          resultsType: typeof response.results,
          firstResult: response.results && response.results[0] ? {
            tagName: response.results[0].tagName,
            hasAttributes: !!response.results[0].attributes,
            attributeKeys: response.results[0].attributes ? Object.keys(response.results[0].attributes) : 'no attributes',
            hasContext: !!response.results[0].context,
            hasLocators: !!response.results[0].locators,
            primaryLocators: response.results[0].locators?.primary?.length || 0,
            secondaryLocators: response.results[0].locators?.secondary?.length || 0,
            fallbackLocators: response.results[0].locators?.fallback?.length || 0,
            hasTextContent: !!response.results[0].textContent,
            textContentKeys: response.results[0].textContent ? Object.keys(response.results[0].textContent) : 'no textContent'
          } : 'no first result'
        });
        
        setStatus(`Scan complete! Found ${response.stats.totalElements} elements`);
        
        console.log('🔍 Popup: Scan response received:', {
          totalElements: response.stats.totalElements,
          primaryElements: response.stats.primaryElements,
          resultsLength: response.results ? response.results.length : 'undefined',
          firstResult: response.results && response.results[0] ? {
            tagName: response.results[0].tagName,
            locatorCounts: {
              primary: response.results[0].locators?.primary?.length || 0,
              secondary: response.results[0].locators?.secondary?.length || 0,
              fallback: response.results[0].locators?.fallback?.length || 0
            }
          } : 'no first result'
        });
        
        // Prepare scan results in the format expected by results.js
        const scanData = {
          url: tab.url,
          title: tab.title,
          timestamp: new Date().toISOString(),
          duration: response.stats.scanDuration || 100,
          totalElements: response.stats.totalElements || 0,
          elementsWithPrimary: response.stats.primaryElements || 0,
          elementsWithSecondary: response.stats.secondaryElements || 0,
          shadowDOMElements: response.stats.shadowElements || 0,
          elements: response.results || []
        };
        
        console.log('🔍 Popup: Saving scan data:', {
          elementsLength: scanData.elements.length,
          firstElementDebug: scanData.elements[0] ? {
            tagName: scanData.elements[0].tagName,
            hasAttributes: !!scanData.elements[0].attributes,
            attributeCount: scanData.elements[0].attributes ? Object.keys(scanData.elements[0].attributes).length : 0,
            hasContext: !!scanData.elements[0].context,
            hasLocators: !!scanData.elements[0].locators,
            locatorCounts: {
              primary: scanData.elements[0].locators?.primary?.length || 0,
              secondary: scanData.elements[0].locators?.secondary?.length || 0,
              fallback: scanData.elements[0].locators?.fallback?.length || 0
            }
          } : 'no first element'
        });
        
        // Validate data quality before saving
        const hasValidData = scanData.elements.some(element => {
          const hasAttributes = element.attributes && Object.keys(element.attributes).length > 0;
          const hasLocators = element.locators && (
            (element.locators.primary && element.locators.primary.length > 0) ||
            (element.locators.secondary && element.locators.secondary.length > 0) ||
            (element.locators.fallback && element.locators.fallback.length > 0)
          );
          return hasAttributes || hasLocators;
        });
        
        if (!hasValidData) {
          console.warn('⚠️ Warning: Scan data appears to be empty or invalid. Refusing to save.');
          setStatus('Scan completed but data appears empty - please try again');
          return;
        }
        
        // Clear any existing results first, then save new ones
        await chrome.storage.local.clear();
        chrome.storage.local.set({ scanResults: scanData });
        chrome.tabs.create({ url: 'results.html' });
      } else {
        setStatus('Scan failed - please try again');
      }
    } catch (error) {
      console.log('Scan failed:', error);
      setStatus('Scan failed - please try again');
    }
  }
  
  // Wire up events
  if (scanBtn) scanBtn.onclick = scan;
  
  // Set ready status immediately
  setStatus('Ready to scan any webpage!');
});
