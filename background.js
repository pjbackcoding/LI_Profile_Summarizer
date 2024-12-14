// Background script is minimal since we're doing most work in the content script
chrome.runtime.onInstalled.addListener(() => {
    console.log('LinkedIn Profile Summarizer installed');
});
