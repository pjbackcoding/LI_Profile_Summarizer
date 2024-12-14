/******************************
 * LinkedIn Profile Summarizer JS *
 ******************************/

// Configuration
const API_KEY = 'YOUR_API_KEY'; 
// Replace with your actual key or remove if you won't call the API

/**
 * Helper function to wait for an element to appear in the DOM
 * @param {string} selector - A CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element>} - Resolves with the DOM element
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    function checkElement() {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        return;
      }
      requestAnimationFrame(checkElement);
    }
    checkElement();
  });
}

/**
 * Extract profile info from LinkedIn's DOM
 * We'll target the education `<div id="education" class="pv-profile-card__anchor">` 
 * and then go up to its parent `<section>` to get the entire block.
 */
async function extractProfileInfo() {
  try {
    // Wait for LinkedIn's dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 1. Name element
    const nameElement = await waitForElement(
      'h1[class*="inline"][class*="t-24"][class*="v-align-middle"][class*="break-words"]'
    );
    const name = nameElement ? nameElement.textContent.trim() : '';

    // 2. Current job title element
    const jobTitleElement = await waitForElement(
      'div[class*="text-body-medium"][class*="break-words"]'
    );
    const titleAndCompany = jobTitleElement ? jobTitleElement.textContent.trim() : '';

    // 3. Grab the entire Education macrosection
    let educationRaw = '';
    const educationAnchor = document.querySelector('div#education.pv-profile-card__anchor');
    if (educationAnchor) {
      // The `<section>` that encloses the Education portion usually has data-view-name="profile-card"
      const educationSection = educationAnchor.closest('section[data-view-name="profile-card"]');
      if (educationSection) {
        educationRaw = educationSection.innerText.trim();
      }
    }

    // 4. Same approach for Experience (optional)
    let experienceRaw = '';
    const experienceAnchor = document.querySelector('div#experience.pv-profile-card__anchor, section#experience.pv-profile-card__anchor');
    if (experienceAnchor) {
      const experienceSection = experienceAnchor.closest('section[data-view-name="profile-card"]');
      if (experienceSection) {
        experienceRaw = experienceSection.innerText.trim();
      }
    }

    return { 
      name, 
      titleAndCompany, 
      educationRaw, 
      experienceRaw 
    };
  } catch (error) {
    console.error('Error extracting profile info:', error);
    return null;
  }
}

/**
 * Generate a summary using ChatGPT API
 */
async function generateSummary(profileInfo) {
  try {
    // Prompt the LLM with the raw text
    const prompt = `Here is the LinkedIn data:\n
Name: ${profileInfo.name}\n
Current: ${profileInfo.titleAndCompany}\n
EDUCATION SECTION (RAW):\n${profileInfo.educationRaw}\n
EXPERIENCE SECTION (RAW):\n${profileInfo.experienceRaw}\n\n
Please create in french a  2 or 3 linesshort structured summary: mention the current role, years of experience, and interpret any education details from the raw text.`;

    // For debugging
    console.log('Sending to API:', { prompt, profileInfo });

    const requestBody = {
      model: 'gpt-4o-mini', // or 'gpt-3.5-turbo', etc.
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    };

    console.log('API Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content.trim();
    }
    throw new Error('No summary generated');
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Unable to generate summary at this time.';
  }
}

/**
 * Insert the summary under the job title div
 */
function insertSummary(summary) {
  const existingSummary = document.querySelector('.ai-profile-summary');
  if (existingSummary) existingSummary.remove();

  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'ai-profile-summary';
  summaryDiv.textContent = summary;

  const jobTitleElement = document.querySelector('div[class*="text-body-medium"][class*="break-words"]');
  if (jobTitleElement && jobTitleElement.parentNode) {
    jobTitleElement.parentNode.insertBefore(summaryDiv, jobTitleElement.nextSibling);
  }
}

/**
 * Main function orchestrating everything
 */
async function main() {
  try {
    const profileInfo = await extractProfileInfo();
    if (!profileInfo) {
      console.log('Could not extract profile information');
      return;
    }

    const summary = await generateSummary(profileInfo);
    if (summary) {
      insertSummary(summary);
    }

    // Observe for dynamic profile changes
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        main();
      }
    }).observe(document, { subtree: true, childList: true });
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run once on load
window.addEventListener('load', main);
