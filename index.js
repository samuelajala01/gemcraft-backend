require("dotenv").config();
const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const cors = require("cors");
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'templates', 'resume-template.html');

const templateHtml = fs.readFileSync(templatePath, 'utf-8');


const upload = multer({ storage: multer.memoryStorage() });

function extractSection(html, sectionClass) {
  // Example: Looks for <section class="summary">content</section> pattern
  const regex = new RegExp(`<section class="${sectionClass}">([\\s\\S]*?)<\/section>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : '';
}

app.use(cors());

app.use(
  cors({
    origin: "http://localhost:5173", // replace with your frontend URL if different
  })
);

app.use(express.json());

// Gemini setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
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
You are a resume generator. Build a resume using the following:

Name: ${name}
Email: ${email}
Web Link: ${web_link}
LinkedIn: ${linkedin}

Job Target: ${jobTarget}
Job Description: ${jobDescription}

Return a clean, HTML-formatted resume. No commentary.
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
You are a resume optimization tool. Refine and tailor the uploaded resume to match the job description.
Return a clean HTML resume. Do not include explanations.

Return the following resume sections as clean inline HTML:

    Summary

    Experience

    Skills

    Education

Only return HTML fragments for each section, no wrapping <html> or <body> tags.

Job Description: ${jobDescription}`;

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

    const raw = response.text;
    const generatedHtml = raw.replace(/^```html\s*/i, "").replace(/```$/, "");

    // Parse the generated HTML into sections (you may need to adjust this based on AI's output format)
    const summaryHtml = extractSection(generatedHtml, 'summary');
    const experienceHtml = extractSection(generatedHtml, 'experience');
    const skillsHtml = extractSection(generatedHtml, 'skills');
    const educationHtml = extractSection(generatedHtml, 'education');

    // Now apply to template
    const finalHtml = templateHtml
      .replace('{{NAME}}', name || '')
      .replace('{{EMAIL}}', email || '')
      .replace('{{LINKEDIN}}', linkedin || '')
      .replace('{{WEB_LINK}}', web_link || '')
      .replace('{{SUMMARY_HTML}}', summaryHtml || '')
      .replace('{{EXPERIENCE_HTML}}', experienceHtml || '')
      .replace('{{SKILLS_HTML}}', skillsHtml || '')
      .replace('{{EDUCATION_HTML}}', educationHtml || '');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.75in", bottom: "0.75in", left: "1in", right: "1in" },
      displayHeaderFooter: false, // or true to add your own
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name || "resume"}.pdf"`,
    });

    res.send(pdf);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
