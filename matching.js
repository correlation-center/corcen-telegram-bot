/**
 * Matching system for needs and resources
 */

// Enhanced text similarity using common words and semantic matching
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const normalize = (text) => text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter out very short words
  
  const words1 = normalize(text1);
  const words2 = normalize(text2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Direct word matching
  const commonWords = words1.filter(word => words2.includes(word));
  const directSimilarity = commonWords.length / Math.max(words1.length, words2.length);
  
  // Enhanced matching with synonyms and related terms
  const synonymMap = {
    'car': ['vehicle', 'automobile', 'transport', 'transportation'],
    'vehicle': ['car', 'automobile', 'transport', 'transportation'],
    'bike': ['bicycle', 'cycle'],
    'bicycle': ['bike', 'cycle'],
    'house': ['home', 'apartment', 'dwelling'],
    'home': ['house', 'apartment', 'dwelling'],
    'help': ['assistance', 'support', 'aid'],
    'assistance': ['help', 'support', 'aid'],
    'programming': ['coding', 'development', 'software'],
    'coding': ['programming', 'development', 'software'],
    'javascript': ['js', 'node', 'web'],
    'work': ['job', 'employment', 'office'],
    'job': ['work', 'employment', 'career'],
    'need': ['require', 'want', 'looking'],
    'have': ['own', 'possess', 'offer'],
    'offer': ['provide', 'give', 'supply'],
    'provide': ['offer', 'give', 'supply']
  };
  
  // Count semantic matches
  let semanticMatches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (synonymMap[word1] && synonymMap[word1].includes(word2)) {
        semanticMatches++;
      }
    }
  }
  
  const semanticSimilarity = semanticMatches / Math.max(words1.length, words2.length);
  
  // Combine direct and semantic similarity
  return Math.max(directSimilarity, semanticSimilarity * 0.8);
}

/**
 * Find matches for a given item
 * @param {Object} item - The item to find matches for (need or resource)
 * @param {Array} candidates - Array of potential matches
 * @param {number} threshold - Minimum similarity threshold (0-1)
 */
function findMatches(item, candidates, threshold = 0.3) {
  const matches = [];
  
  for (const candidate of candidates) {
    // Don't match items from the same user
    if (candidate.user?.id === item.user?.id) continue;
    
    const similarity = calculateSimilarity(item.description, candidate.description);
    
    if (similarity >= threshold) {
      matches.push({
        item: candidate,
        similarity,
        matchType: 'textSimilarity'
      });
    }
  }
  
  // Sort by similarity score (highest first)
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Find all matches for needs and resources
 * @param {Object} storage - Storage instance
 * @param {Object} options - Matching options
 */
async function findAllMatches(storage, options = {}) {
  const { threshold = 0.3, maxMatches = 5 } = options;
  
  await storage.readDB();
  const users = storage.db.data.users || {};
  
  const allNeeds = [];
  const allResources = [];
  
  // Collect all needs and resources
  for (const [userId, user] of Object.entries(users)) {
    if (user.needs) {
      allNeeds.push(...user.needs.map(need => ({ ...need, userId })));
    }
    if (user.resources) {
      allResources.push(...user.resources.map(resource => ({ ...resource, userId })));
    }
  }
  
  const matches = {
    needToResource: [],
    needToNeed: []
  };
  
  // Find need-to-resource matches
  for (const need of allNeeds) {
    const resourceMatches = findMatches(need, allResources, threshold)
      .slice(0, maxMatches);
    
    if (resourceMatches.length > 0) {
      matches.needToResource.push({
        need,
        matches: resourceMatches
      });
    }
  }
  
  // Find need-to-need matches
  for (const need of allNeeds) {
    const needMatches = findMatches(need, allNeeds.filter(n => n !== need), threshold)
      .slice(0, maxMatches);
    
    if (needMatches.length > 0) {
      matches.needToNeed.push({
        need,
        matches: needMatches
      });
    }
  }
  
  return matches;
}

/**
 * Get new matches for a specific item since last check
 * @param {Object} item - The item to check matches for
 * @param {Object} storage - Storage instance
 * @param {Object} options - Matching options
 */
async function getNewMatches(item, storage, options = {}) {
  const { threshold = 0.3, maxMatches = 5 } = options;
  
  await storage.readDB();
  const users = storage.db.data.users || {};
  
  // Get all potential matches based on item type
  let candidates = [];
  
  if (item.type === 'need') {
    // For needs, find both resource matches and other need matches
    for (const [userId, user] of Object.entries(users)) {
      if (user.resources) {
        candidates.push(...user.resources.map(resource => ({ 
          ...resource, 
          userId, 
          candidateType: 'resource' 
        })));
      }
      if (user.needs) {
        candidates.push(...user.needs
          .filter(need => need.guid !== item.guid)
          .map(need => ({ 
            ...need, 
            userId, 
            candidateType: 'need' 
          })));
      }
    }
  } else if (item.type === 'resource') {
    // For resources, find need matches
    for (const [userId, user] of Object.entries(users)) {
      if (user.needs) {
        candidates.push(...user.needs.map(need => ({ 
          ...need, 
          userId, 
          candidateType: 'need' 
        })));
      }
    }
  }
  
  const matches = findMatches(item, candidates, threshold).slice(0, maxMatches);
  
  // Filter out matches that were already notified
  const lastMatchCheck = item.lastMatchCheck || item.createdAt;
  const newMatches = matches.filter(match => {
    const matchItemTime = match.item.updatedAt || match.item.createdAt;
    return new Date(matchItemTime) > new Date(lastMatchCheck);
  });
  
  return newMatches;
}

export {
  calculateSimilarity,
  findMatches,
  findAllMatches,
  getNewMatches
};