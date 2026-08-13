import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.list();
    // response.models is the array in the new SDK? Let's log the raw response to see its structure.
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
