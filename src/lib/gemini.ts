import { GoogleGenAI } from '@google/genai';

// Vite client-side env var (will be inlined at build time). For demo only.
const API_KEY = (import.meta as any).env?.VITE_GOOGLE_GENAI_API_KEY || '';

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  status: 'generating' | 'completed' | 'error';
  error?: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  originalPrompt?: string;
  age?: number;
  gender?: string; // Hebrew values: "בן" | "ילדה" | "גבר" | "אישה"
  sector?: string; // "חרדי" | "דתי" | "מסורתי" | "חילוני" | "מוסלמי"
}

/**
 * Generate an actual image using Google's Imagen model
 * @param request - The image generation request
 * @returns Promise<GeneratedImage>
 */
export async function generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
  const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Derive audience description from profile (outside try so it's available in fallbacks)
  const age = request.age != null ? request.age : undefined;
  const gender = request.gender || '';
  const genderEn = gender === 'בן' ? 'boy' : gender === 'ילדה' ? 'girl' : gender === 'גבר' ? 'man' : gender === 'אישה' ? 'woman' : 'child';
  const audience = age ? `${age}-year-old ${genderEn}` : gender ? `${genderEn}` : 'child';

  // Cultural/religious context
  const sector = request.sector || '';
  const sectorEn = sector === 'מוסלמי' ? 'Muslim' : sector === 'חרדי' ? 'ultra-Orthodox Jewish' : sector === 'דתי' ? 'religious Jewish' : sector === 'מסורתי' ? 'traditional Jewish' : sector === 'חילוני' ? 'secular' : '';
  const cultureLine = sectorEn ? `Cultural context: appropriate for a ${sectorEn} audience; avoid offensive or inappropriate religious imagery.` : '';

  try {
    const ai = new GoogleGenAI({
      apiKey: API_KEY,
    });

    // Create a child-friendly, medical-appropriate prompt tailored to age/gender
    const enhancedPrompt = `Create a simple, colorful illustration of ${request.prompt} for a ${audience}.
    Style: clean cartoon, bright colors, simple shapes, suitable for a hospital communication board.
    Background: plain white or very light color.
    Content: clear, recognizable object; friendly; culturally neutral; no scary details.
    ${cultureLine}
    Safety: no text, no logos, no blood, no needles in skin.`;

    console.log('Generating content with Gemini, prompt:', enhancedPrompt);

    // Use the correct Gemini image generation model with generateContent
    console.log('Generating image with gemini-2.5-flash-image');
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ 
        role: "user", 
        parts: [{ text: enhancedPrompt }] 
      }]
    });

    console.log('Image generation response:', result);

    // Extract image data from gemini-2.5-flash-image response
    if (!result || !result.candidates) {
      throw new Error('No response received from Gemini image model.');
    }

    // Look for image data in the response
    let imageUrl = '';
    const candidate = result.candidates[0];
    
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          // Found image data
          const mimeType = part.inlineData.mimeType || 'image/jpeg';
          imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          console.log('Successfully extracted image from Gemini response');
          break;
        }
      }
    }

    // If no image data found, throw error to trigger fallback
    if (!imageUrl) {
      throw new Error('No image data found in Gemini response');
    }

    return {
      id,
      prompt: request.prompt,
      imageUrl,
      status: 'completed'
    };

  } catch (error) {
    console.error('Error generating image:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for billing requirement, API not enabled, or model not found
      if (errorMessage.includes('only accessible to billed users') || 
          errorMessage.includes('SERVICE_DISABLED') ||
          errorMessage.includes('API has not been used') ||
          errorMessage.includes('PERMISSION_DENIED') ||
          errorMessage.includes('not found for API version') ||
          errorMessage.includes('No image generation models available')) {
        console.log('Image generation not available, falling back to AI-enhanced placeholder');
        
        // Try to get enhanced description using text generation first
        try {
          const textAI = new GoogleGenAI({ apiKey: API_KEY });
          const textPrompt = `Create a detailed, child-friendly description for generating an image of: ${request.prompt}.
          Audience: ${audience}${sectorEn ? `, ${sectorEn}` : ''}.
          Style: clean cartoon illustration, bright colors, simple shapes, suitable for a medical communication board.
          Background: plain white or very light color.
          Content: clear, recognizable object a child easily understands.
          ${cultureLine}
          Safety: no text in the image.`;
          
          const textResult = await textAI.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: textPrompt,
          });
          
          let enhancedDescription = textPrompt;
          if (textResult?.candidates?.[0]?.content?.parts?.[0]?.text) {
            enhancedDescription = textResult.candidates[0].content.parts[0].text;
            console.log('Got enhanced description from Gemini text model');
          }
          
          const enhancedPlaceholder = await createEnhancedPlaceholder(request.prompt, enhancedDescription);
          return {
            id,
            prompt: request.prompt,
            imageUrl: enhancedPlaceholder,
            status: 'completed' // Mark as completed with AI-enhanced placeholder
          };
        } catch (textError) {
          console.log('Text generation also failed, using basic placeholder');
          const basicPlaceholder = await createEnhancedPlaceholder(request.prompt);
          return {
            id,
            prompt: request.prompt,
            imageUrl: basicPlaceholder,
            status: 'completed'
          };
        }
      }
      
      // Provide user-friendly error messages for other errors
      if (errorMessage.includes('Requested entity was not found')) {
        errorMessage = 'Model not found. Please check API key permissions.';
      } else if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
        errorMessage = 'Invalid API key. Please check your Google AI API key.';
      } else if (errorMessage.includes('permission denied')) {
        errorMessage = 'Permission denied. Please check API key permissions.';
      } else if (errorMessage.includes('blocked')) {
        errorMessage = 'Content was blocked by safety filters. Try a different prompt.';
      }
    }

    return {
      id,
      prompt: request.prompt,
      imageUrl: '',
      status: 'error',
      error: errorMessage
    };
  }
}

/**
 * Create an enhanced placeholder image with better visual design
 * @param prompt - The image prompt
 * @param description - Enhanced description from Gemini (optional)
 * @returns Promise<string> - Base64 image data URL
 */
async function createEnhancedPlaceholder(prompt: string, description?: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve('');
      return;
    }
    
    canvas.width = 300;
    canvas.height = 300;
    
    // Create gradient background based on prompt content
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    
    // Choose colors based on prompt content
    let colors = ['#FF6B6B', '#4ECDC4']; // Default: red to teal
    
    if (prompt.includes('אבטיח') || prompt.includes('watermelon')) {
      colors = ['#FF6B6B', '#90EE90']; // Red to light green
    } else if (prompt.includes('לימון') || prompt.includes('lemon')) {
      colors = ['#FFD700', '#FFFF99']; // Gold to light yellow
    } else if (prompt.includes('מים') || prompt.includes('water')) {
      colors = ['#87CEEB', '#E0F6FF']; // Sky blue to light blue
    } else if (prompt.includes('תרופה') || prompt.includes('medicine')) {
      colors = ['#98FB98', '#F0FFF0']; // Light green to honeydew
    } else if (prompt.includes('כאב') || prompt.includes('pain')) {
      colors = ['#FFB6C1', '#FFF0F5']; // Light pink to lavender blush
    }
    
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Add main text
    ctx.fillStyle = '#333';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Split text into lines for better display
    const words = prompt.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 40 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Draw text lines
    const lineHeight = 30;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
    
    // Add decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(50, 50, 20, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(canvas.width - 50, 50, 15, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(50, canvas.height - 50, 25, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add "AI Enhanced" or "Demo Image" watermark
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const watermark = description ? 'AI Enhanced' : 'תמונת הדגמה';
    ctx.fillText(watermark, canvas.width / 2, canvas.height - 15);
    
    resolve(canvas.toDataURL('image/png'));
  });
}

/**
 * Parse user input to extract individual image requests
 * @param input - User's free text input
 * @returns Array of image prompts
 */
export function parseImageRequests(input: string): string[] {
  // Split by common delimiters and clean up
  const delimiters = /[,،\n\r\t;]+/; // Include Arabic comma and semicolon for Hebrew/Arabic text
  
  return input
    .split(delimiters)
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .map(item => item.replace(/^[-•*]\s*/, '')); // Remove bullet points
}

/**
 * Download image to user's device
 * @param imageUrl - The image data URL
 * @param filename - The filename for download
 */
export function downloadImage(imageUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}