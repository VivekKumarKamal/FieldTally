import { GoogleGenAI } from "@google/genai";

async function runTest() {
    // It is best practice to pass it via environment variables (process.env.GEMINI_API_KEY),
    // but you can pass it explicitly here to test.
    const apiKey = ÀQQQQQQQQQQQQQQQQA"; 
    
    if (!apiKey) {
        console.error("Please provide a valid API key in the script.");
        return;
    }

    try {
        console.log("Initializing GoogleGenAI client...");
        const ai = new GoogleGenAI({ apiKey: apiKey });

        console.log("Sending a test prompt to gemini-3.5-flash...");
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: "Say hello!",
        });

        console.log("✅ SDK Test Successful!");
        console.log("Response text:", response.text);
    } catch (error) {
        console.error("❌ SDK Test Failed.");
        console.error(error);
    }
}

runTest();
