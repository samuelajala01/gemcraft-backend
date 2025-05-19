require("dotenv").config();
const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const upload = multer({ storage: multer.memoryStorage() });

app.use(
  cors({
    origin: "http://localhost:5173", // replace with your frontend URL if different
  })
);

app.use(express.json());

// Gemini setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiEndpoint: "https://gemini.googleapis.com",
  temperature: 0.5,
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
Generate a professional resume in HTML format for:
Name: ${name}
Email: ${email}
Web Link: ${web_link}
LinkedIn: ${linkedin}

Job Target: ${jobTarget}
Job Description: ${jobDescription}

Create a complete HTML document with proper styling. Include:
1. Name and contact information at the top
2. Professional summary section
3. Work experience section with bullet points for responsibilities/achievements
4. Skills section
5. Education section

Use clean, professional styling with good spacing. The HTML should be ready to render as a PDF.
`;

      contents = [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ];
    } else if (mode === "refine" && resumeFile) {
      const base64 = resumeFile.buffer.toString("base64");

      userPrompt = `
Refine and rewrite the uploaded resume to better match this job description:

${jobDescription}

Return a complete HTML document with professional styling. Make sure to:
1. Tailor the summary and all other sections to match the job description.
2. Do not give any explanations or comments, only modify where necessary.
3. Ensure that many things are changed to make it more relevant to the job description.
4. Try to keep the same structure as the original resume in terms of looks.
5. If there are metrics in the original resume, ensure to keep them if they would be releveant to the job description.

`;

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

    const rawHtml = response.text;

    // Clean up any code blocks in the response
    let finalHtml = rawHtml;
    if (rawHtml.includes("```html")) {
      finalHtml = rawHtml.replace(/```html\s*/i, "").replace(/```\s*$/, "");
    }

    // If the AI didn't return a full HTML document, add the basic structure
    if (!finalHtml.includes("<!DOCTYPE html>")) {
      finalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      line-height: 1.1;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { font-size: 24px; margin-bottom: 5px; }
    h2 { font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 25px; }
    h3 { font-size: 16px; margin-bottom: 0; }
    .contact-info { font-size: 14px; color: #555; margin-bottom: 25px; }
    .job { margin-bottom: 20px; }
    .job-meta { font-style: italic; color: #666; margin-bottom: 10px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="container">
    ${finalHtml}
  </div>
</body>
</html>`;
    }

    // Launch puppeteer
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Set content with specific viewport
    await page.setViewport({ width: 850, height: 1100 });
    await page.setContent(finalHtml, { waitUntil: "networkidle0" });

    // Generate PDF with specific settings for better control
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.75in", bottom: "0.75in", left: "1in", right: "1in" },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });

    await browser.close();

    // Send the PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name || "resume"}.pdf"`,
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
