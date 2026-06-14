/**
 * Simulated stream implementation for hackathon fallback.
 * Simulates a streaming API response character by character.
 */

export const streamText = async (fullText, onChunk, durationMs = 7000) => {
  return new Promise((resolve) => {
    // Calculate required delay to finish in exactly durationMs
    const delayMs = Math.max(10, Math.floor(durationMs / fullText.length));
    
    let i = 0;
    const interval = setInterval(() => {
      onChunk(fullText.charAt(i));
      i++;
      if (i >= fullText.length) {
        clearInterval(interval);
        resolve();
      }
    }, delayMs);
  });
};
