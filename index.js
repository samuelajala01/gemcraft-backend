
const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const cors = require("cors");

const upload = multer({ storage: multer.memoryStorage() });

app.use(
  cors({
    origin: ["http://localhost:5173", "https://gemcraft.vercel.app"],
  })
);

app.use(express.json());

// Gemini setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
});

app.get("/", (req, res) => {
  res.send("Welcome to the Resume Generator API!");
});


app.post("/refine-pdf", upload.single("resume"), async (req, res) => {
  const { name, email, web_link, linkedin, jobTarget, jobDescription, mode } =
    req.body;
  const resumeFile = req.file;

  try {
    let contents;
    let userPrompt;

    if (mode === "build") {
      userPrompt = `
You are a professional resume rewriter. Create a complete, ATS-friendly HTML resume for the user based on the following information:

PERSONAL INFORMATION:
- Name: ${name}
- Email: ${email}
- Website: ${web_link}
- LinkedIn: ${linkedin}

TARGET POSITION: ${jobTarget}

JOB DESCRIPTION TO MATCH:
${jobDescription}

REQUIREMENTS:
1. Create a complete HTML document with inline CSS - MUST include <!DOCTYPE html>, <html>, <head>, and <body> tags
2. Use ONLY black text on white background - no colors except black/gray
3. Professional, clean layout optimized for ATS scanning
4. Include these sections in order:
   - Header with name and contact info
   - Professional Summary 
   - Core Skills/Technical Skills (relevant to job description)
   - Professional Experience
   - Education (relevant degree)
   - Additional sections if relevant

5. Use professional fonts (Arial, Helvetica, or similar)
6. Proper spacing and hierarchy
7. Bullet points with quantified achievements where possible
8. Keywords from job description naturally integrated
9. No tables for layout - use divs and CSS
10. Ensure content is relevant and realistic for the target role
11. Add proper page margins and spacing for PDF generation

Return ONLY the complete HTML document. No explanations, no markdown, no code blocks.`;

      contents = [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ];
    } else if (mode === "refine" && resumeFile) {
      const base64 = resumeFile.buffer.toString("base64");

      userPrompt = `
You are a professional resume rewriter. Analyze the uploaded resume and rewrite it to perfectly match this job description:

JOB DESCRIPTION:
${jobDescription}

REQUIREMENTS:
1. Keep the same personal information (name, contact details)
2. Tailor EVERYTHING to match the job description:
   - Rewrite professional summary to highlight relevant experience
   - Modify job titles and descriptions to emphasize relevant skills
   - Reorganize and enhance skills section with job-relevant keywords
   - Add quantified achievements that would appeal to this role
   - Maintain professional experience chronology but enhance relevance

3. FORMATTING REQUIREMENTS:
   - Return complete HTML document with inline CSS - MUST include <!DOCTYPE html>, <html>, <head>, and <body> tags
   - Use ONLY black text on white background (no colors)
   - Professional ATS-friendly layout
   - Clean typography with Arial/Helvetica fonts
   - Proper spacing and hierarchy
   - No tables for layout
   - Add proper page margins and spacing for PDF generation

4. CONTENT OPTIMIZATION:
   - Integrate keywords from job description naturally
   - Quantify achievements with metrics/percentages where relevant
   - Make skills section highly relevant to the target role
   - Ensure all experience demonstrates value for the target position

5. Keep the same overall structure and length as the original resume
6. Preserve any important metrics or achievements that are relevant

Return ONLY the complete HTML document. No explanations, no markdown, no code blocks.`;

      contents = [
        {
          role: "user",
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
          ],
        },
      ];
    } else {
      return res.status(400).json({ error: "Invalid mode or missing data." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents,
    });

    let rawHtml = response.text;

    // Clean up the response
    rawHtml = rawHtml.replace(/```html\s*/gi, "").replace(/```\s*$/g, "");
    rawHtml = rawHtml.replace(/```/g, "");
    rawHtml = rawHtml.trim();

    let finalHtml = rawHtml;

    // Check if it's a complete HTML document
    const hasDoctype = finalHtml.toLowerCase().includes("<!doctype html>");
    const hasHtmlTag = finalHtml.toLowerCase().includes("<html");
    const hasHeadTag = finalHtml.toLowerCase().includes("<head");
    const hasBodyTag = finalHtml.toLowerCase().includes("<body");

    // Only wrap if it's NOT a complete HTML document
    if (!hasDoctype || !hasHtmlTag || !hasHeadTag || !hasBodyTag) {
      finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume - ${name || "Professional Resume"}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.4;
      color: #000000;
      background: white;
      font-size: 11pt;
      padding: 0.75in;
    }
    
    .header {
      text-align: center;
      margin-bottom: 25px;
      border-bottom: 1px solid #000000;
      padding-bottom: 15px;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      color: #000000;
      margin: 0 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .contact-info {
      font-size: 10pt;
      color: #000000;
      line-height: 1.3;
      margin: 0;
    }
    
    .section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #000000;
      border-bottom: 1px solid #000000;
      padding-bottom: 2px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .job-entry {
      margin-bottom: 18px;
    }
    
    .job-title {
      font-size: 11pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 2px;
    }
    
    .company-info {
      font-size: 10pt;
      color: #333333;
      font-style: italic;
      margin-bottom: 6px;
    }
    
    .job-description ul {
      margin: 0 0 10px 20px;
      padding: 0;
    }
    
    .job-description li {
      margin-bottom: 3px;
      font-size: 10pt;
      line-height: 1.3;
      color: #000000;
    }
    
    .skills-list {
      font-size: 10pt;
      line-height: 1.4;
      color: #000000;
    }
    
    .education-entry {
      margin-bottom: 12px;
    }
    
    .degree {
      font-size: 11pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 2px;
    }
    
    .school-info {
      font-size: 10pt;
      color: #333333;
      font-style: italic;
    }
    
    p {
      margin-bottom: 6px;
      font-size: 10pt;
      line-height: 1.3;
      color: #000000;
    }
    
    .summary {
      font-size: 10pt;
      line-height: 1.4;
      text-align: justify;
      margin-bottom: 8px;
      color: #000000;
    }
    
    @media print {
      body { 
        font-size: 10pt;
        padding: 0.5in;
      }
      * { -webkit-print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  ${finalHtml}
</body>
</html>`;
    }

    // FIXED: Launch puppeteer with better settings and no extra margins
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
    });
    const page = await browser.newPage();

    // Set content with better options
    await page.setContent(finalHtml, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for fonts and styles to load
    await page.evaluateHandle("document.fonts.ready");

    //Generate PDF with optimized settings - reduced margins
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.25in", 
        bottom: "0.25in",
        left: "0.25in",
        right: "0.25in",  
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1.0,  
    });

    await browser.close();

    // Send the PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${
        name ? name.replace(/[^a-zA-Z0-9]/g, "_") : "resume"
      }.pdf"`,
    });

    res.send(pdf);
  } catch (err) {
    console.error("Error:", err);
    res
      .status(500)
      .json({ error: "Failed to generate PDF", details: err.message });
  }
});

app.post("/extract-info", async (req, res) => {
  const { message, currentData } = req.body;

  try {
    const extractPrompt = `
You are an expert resume information extractor. Analyze the user's conversational message and extract structured information.

CURRENT DATA: ${JSON.stringify(currentData, null, 2)}

USER MESSAGE: "${message}"

Extract and return ONLY the NEW information from this message in JSON format. Be smart about understanding context:

Rules:
1. If user mentions their name in any form ("I'm John", "My name is...", "John Smith here"), extract it
2. Extract emails, phone numbers, LinkedIn URLs, websites automatically
3. For job titles: look for "I'm applying for...", "I want to be...", "targeting...", etc.
4. For experience: understand phrases like "I worked at...", "My last job was...", "I was a..."
5. For skills: extract technical skills, programming languages, tools mentioned
6. For education: look for degrees, schools, graduation years
7. If they're describing job responsibilities, categorize as experience
8. Be contextually aware - if they're answering a question about skills, treat the response as skills

Return JSON with these exact fields (only include fields with new data):
{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "+1234567890",
    "linkedin": "linkedin-url",
    "website": "website-url"
  },
  "jobTarget": "Specific job title/role",
  "jobDescription": "Full job description text",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Time period",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "education": [
    {
      "degree": "Degree Name",
      "school": "School Name", 
      "year": "Graduation Year"
    }
  ]
}

Examples:
- "Hi, I'm Sarah Johnson, sarah.j@email.com" → {"personalInfo": {"name": "Sarah Johnson", "email": "sarah.j@email.com"}}
- "I'm targeting software engineer roles" → {"jobTarget": "Software Engineer"}
- "I worked at Google as a developer for 2 years doing React and Node.js" → {"experience": [{"title": "Developer", "company": "Google", "duration": "2 years"}], "skills": ["React", "Node.js"]}
- "I have Python, JavaScript, and SQL experience" → {"skills": ["Python", "JavaScript", "SQL"]}

Return ONLY valid JSON, no explanations or formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: extractPrompt }],
        },
      ],
    });

    let extractedJson = response.text.trim();

    // Clean up the response
    extractedJson = extractedJson
      .replace(/```json\s*/gi, "")
      .replace(/```\s*$/g, "");
    extractedJson = extractedJson.replace(/```/g, "").trim();

    try {
      const extractedData = JSON.parse(extractedJson);
      console.log("Extracted data:", extractedData); // For debugging
      res.json({ success: true, data: extractedData });
    } catch (parseError) {
      console.error("Parse error:", parseError, "Raw response:", extractedJson);
      res.json({ success: false, error: "Could not parse extracted data" });
    }
  } catch (error) {
    console.error("Extraction error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/generate-next-question", async (req, res) => {
  const { currentData, conversationHistory } = req.body;
  try {
    const questionPrompt = `
You are a friendly, professional resume building assistant. Based on the collected data and conversation flow, generate the next logical question.

CURRENT DATA: ${JSON.stringify(currentData, null, 2)}
RECENT CONVERSATION: ${JSON.stringify(conversationHistory.slice(-3), null, 2)}

QUESTION GENERATION RULES:
1. Follow this priority order:
   - Basic info (name, email) - CRITICAL
   - Job target/role they want - CRITICAL  
   - Job description (if they have a specific job) - IMPORTANT
   - Work experience - CRITICAL
   - Education - IMPORTANT
   - Skills - IMPORTANT
   - Additional sections (certifications, projects, etc.) - NICE TO HAVE

2. Be conversational and encouraging
3. Ask ONE specific question at a time
4. If they have basic info + job target + some experience/skills, offer to generate resume
5. Make questions feel natural, not like a form

DECISION LOGIC:
- No name/email? → Ask for basic contact info
- No job target? → Ask what role they're targeting
- No job description but have target? → Ask if they have a specific job posting
- No experience but have target? → Ask about their most relevant work experience
- No education? → Ask about their education background
- Few skills mentioned? → Ask about their key skills
- Have all basics? → Offer to generate or ask about additional info

RESPONSE FORMAT:
Return a JSON object with:
{
  "question": "The next question to ask (conversational tone)",
  "context": "Brief explanation of why this question is being asked",
  "stage": "current_stage" (basic_info|job_target|experience|education|skills|additional|ready_to_generate),
  "isComplete": false|true,
  "suggestion": "Optional helpful suggestion or encouragement"
}

EXAMPLES:
- If missing name: {"question": "Let's start with the basics - what's your full name?", "context": "Need basic contact information", "stage": "basic_info", "isComplete": false}
- If have basics but no job target: {"question": "What type of role are you looking to apply for?", "context": "Understanding job target helps tailor the resume", "stage": "job_target", "isComplete": false}
- If ready to generate: {"question": "Great! I have enough information to create your resume. Would you like me to generate it now, or is there anything else you'd like to add?", "context": "All essential information collected", "stage": "ready_to_generate", "isComplete": true}

Generate your response now:`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: questionPrompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const aiResponse = response.choices[0].message.content.trim();

    // Parse the AI response as JSON
    let questionData;
    try {
      questionData = JSON.parse(aiResponse);
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      questionData = {
        question: aiResponse,
        context: "Continuing resume building process",
        stage: "unknown",
        isComplete: false,
      };
    }

    res.json({
      success: true,
      data: questionData,
    });
  } catch (error) {
    console.error("Error generating next question:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate next question",
      fallback: {
        question: "Could you tell me more about your work experience?",
        context: "Collecting work experience information",
        stage: "experience",
        isComplete: false,
      },
    });
  }
});

// POST /build-from-chat - Generate resume from chat-extracted data
app.post("/build-from-chat", async (req, res) => {
  const { extractedData } = req.body;

  try {
    const buildPrompt = `
You are a professional resume builder. Create a complete, ATS-friendly HTML resume using this extracted data:

${JSON.stringify(extractedData, null, 2)}

REQUIREMENTS:
1. Create a complete HTML document with inline CSS
2. Use ONLY black text on white background - no colors except black/gray
3. Professional, clean layout optimized for ATS scanning
4. Include relevant sections based on available data
5. Fill in realistic details where data is sparse but keep it professional
6. Use professional fonts (Arial, Helvetica)
7. Proper spacing and hierarchy
8. Keywords naturally integrated
9. No tables for layout - use divs and CSS

Return ONLY the complete HTML document. No explanations, no markdown, no code blocks.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt }],
        },
      ],
    });

    let rawHtml = response.text;
    rawHtml = rawHtml.replace(/```html\s*/gi, "").replace(/```\s*$/g, "");
    rawHtml = rawHtml.replace(/```/g, "");
    rawHtml = rawHtml.trim();

    // Generate PDF using existing logic
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(rawHtml, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    await page.evaluateHandle("document.fonts.ready");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.5in",
        bottom: "0.5in",
        left: "0.75in",
        right: "0.75in",
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 0.9,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${
        extractedData.personalInfo?.name?.replace(/[^a-zA-Z0-9]/g, "_") ||
        "resume"
      }.pdf"`,
    });

    res.send(pdf);
  } catch (error) {
    console.error("Build error:", error);
    res
      .status(500)
      .json({ error: "Failed to generate resume", details: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
