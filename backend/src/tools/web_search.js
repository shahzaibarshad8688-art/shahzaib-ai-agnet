/**
 * Real Web Research Tool for Shahzaib AI Agent
 * Genuine search using DuckDuckGo & Wikipedia APIs with real web fetch fallback
 */

export const webSearchTool = {
  name: 'web_search',
  label: 'Live Web Research',
  description: 'Search the live web for up-to-date information, news, documentation, or facts, and fetch full webpage contents.',
  category: 'research',
  requiresConfirmation: false,
  dangerLevel: 'safe',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or topic to investigate on the web'
      },
      url: {
        type: 'string',
        description: 'Optional URL to directly scrape and extract readable text from'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of search results to return (default: 5)'
      }
    },
    required: ['query']
  },

  async execute({ query, url, maxResults = 5 }) {
    const results = [];
    const logs = [];

    // If a direct URL was provided, fetch and parse its text
    if (url) {
      logs.push(`Directly fetching page content from: ${url}`);
      try {
        const pageContent = await fetchWebpageText(url);
        return {
          status: 'success',
          type: 'webpage_content',
          url,
          content: pageContent.slice(0, 4000),
          length: pageContent.length,
          logs
        };
      } catch (err) {
        logs.push(`Error fetching URL: ${err.message}. Falling back to search.`);
      }
    }

    logs.push(`Initiating real web search query: "${query}"`);

    // 1. DuckDuckGo Instant Answer API
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(ddgUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ShahzaibAIAgent/1.0 (Mozilla/5.0)' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        if (data.AbstractText) {
          results.push({
            title: data.Heading || 'Instant Answer',
            snippet: data.AbstractText,
            url: data.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
            source: data.AbstractSource || 'DuckDuckGo Instant Answer'
          });
        }

        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics) {
            if (results.length >= maxResults) break;
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || 'Result',
                snippet: topic.Text,
                url: topic.FirstURL,
                source: 'DuckDuckGo Related'
              });
            }
          }
        }
      }
    } catch (err) {
      logs.push(`DDG API note: ${err.message}`);
    }

    // 2. Wikipedia Search API as rich factual research fallback
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=${maxResults}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const wikiRes = await fetch(wikiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ShahzaibAIAgent/1.0 (Wikipedia Client)' }
      });
      clearTimeout(timeoutId);

      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const searchHits = wikiData?.query?.search || [];

        for (const hit of searchHits) {
          if (results.length >= maxResults + 2) break;
          // Clean snippet of HTML tags
          const cleanSnippet = hit.snippet.replace(/<[^>]*>?/gm, '');
          results.push({
            title: hit.title,
            snippet: cleanSnippet,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, '_'))}`,
            source: 'Wikipedia'
          });
        }
      }
    } catch (err) {
      logs.push(`Wiki API note: ${err.message}`);
    }

    // 3. DuckDuckGo HTML Lite fallback if no results yet
    if (results.length === 0) {
      try {
        const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const htmlRes = await fetch(htmlUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (htmlRes.ok) {
          const html = await htmlRes.text();
          // Extract result snippets using regex
          const regex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;
          let match;
          let count = 0;
          while ((match = regex.exec(html)) !== null && count < maxResults) {
            const clean = match[1].replace(/<[^>]*>?/gm, '').trim();
            if (clean) {
              results.push({
                title: `Web Result ${count + 1}`,
                snippet: clean,
                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                source: 'DuckDuckGo Web'
              });
              count++;
            }
          }
        }
      } catch (err) {
        logs.push(`DDG HTML fallback note: ${err.message}`);
      }
    }

    return {
      status: 'success',
      query,
      resultsCount: results.length,
      results: results.slice(0, maxResults),
      logs
    };
  }
};

/**
 * Fetch and extract text content from a public webpage
 */
async function fetchWebpageText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'ShahzaibAIAgent/1.0 (Content Fetcher; Windows NT 10.0)'
    }
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const rawHtml = await res.text();
  // Strip styles, scripts, and HTML tags
  const text = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}

export default webSearchTool;
