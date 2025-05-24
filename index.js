require("dotenv").config();
const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const cors = require("cors");

const upload = multer({ storage: multer.memoryStorage() });

app.use(
  cors({
    origin: "http://localhost:5173", 
  })
);

app.use(express.json());

// Gemini setup
const ai = new GoogleGenAI({
  apiKey: '',
  temperature: 0,
});

app.get("/", (req, res) => {
  res.send("Welcome to the Resume Generator API!");
});

// POST /generate-pdf
app.post("/generate-pdf", upload.single("resume"), async (req, res) => {
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
1. Create a complete HTML document with inline CSS
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
   - Return complete HTML document with inline CSS
   - Use ONLY black text on white background (no colors)
   - Professional ATS-friendly layout
   - Clean typography with Arial/Helvetica fonts
   - Proper spacing and hierarchy
   - No tables for layout

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

    rawHtml = rawHtml.replace(/```html\s*/gi, "").replace(/```\s*$/g, "");
    rawHtml = rawHtml.replace(/```/g, "");
    rawHtml = rawHtml.trim();

    let finalHtml = rawHtml;

    const hasDoctype = finalHtml.toLowerCase().includes("<!doctype html>");
    const hasHtmlTag = finalHtml.toLowerCase().includes("<html");
    const hasHeadTag = finalHtml.toLowerCase().includes("<head");
    const hasBodyTag = finalHtml.toLowerCase().includes("<body");


    if (!hasDoctype || !hasHtmlTag || !hasHeadTag || !hasBodyTag) {
      finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume - ${name || 'Professional Resume'}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.4;
      color: #000000;
      background: white;
      font-size: 11pt;
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.75in;
      background: white;
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
      body { font-size: 10pt; }
      .container { padding: 0.5in; }
      * { -webkit-print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${finalHtml}
  </div>
</body>
</html>`;
    }

    // Launch puppeteer with better settings
    const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set content with better options
    await page.setContent(finalHtml, { 
      waitUntil: "networkidle0",
      timeout: 30000 
    });

    // Wait a bit more for fonts and styles to load
    await page.evaluateHandle('document.fonts.ready');

    // Generate PDF with better settings
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { 
        top: "0.5in", 
        bottom: "0.5in", 
        left: "0.75in", 
        right: "0.75in" 
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 0.9, // Slightly reduce scale to ensure content fits
    });

    await browser.close();

    // Send the PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name ? name.replace(/[^a-zA-Z0-9]/g, '_') : "resume"}.pdf"`,
    });

    res.send(pdf);
  } catch (err) {
    console.error("Error:", err);
    res
      .status(500)
      .json({ error: "Failed to generate PDF", details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));