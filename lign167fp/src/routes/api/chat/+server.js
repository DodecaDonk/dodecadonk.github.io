// src/routes/api/chat/+server.js

import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private'; // Ensure your API key is set correctly
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Tesseract from 'tesseract.js'; // For OCR

// Define the upload directory
const UPLOAD_DIR = path.resolve('static', 'uploads');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const sessionStore = {}; // Key: sessionId, Value: { documents: [], messages: [] }

// Define maximum limits
const MAX_MESSAGES = 100;
const MAX_DOCUMENTS = 50;

// Helper function to trim messages
function trimMessages(messages) {
  if (messages.length > MAX_MESSAGES) {
    // Remove the oldest messages
    return messages.slice(-MAX_MESSAGES);
  }
  return messages;
}

// Helper function to trim documents
function trimDocuments(documents) {
  if (documents.length > MAX_DOCUMENTS) {
    // Remove the oldest documents
    return documents.slice(-MAX_DOCUMENTS);
  }
  return documents;
}

export const POST = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    let prompt = '';
    let messages = [];
    let messageHistory = [];
    let fileUrls = []; // Array to store multiple file URLs and their types

    const sessionId = request.headers.get('x-session-id') || randomUUID(); // Generate if not provided

    // Initialize session data if not present
    if (!sessionStore[sessionId]) {
      sessionStore[sessionId] = {
        documents: [],
        messages: []
      };
    }

    // Handle JSON or multipart/form-data
    if (contentType.includes('application/json')) {
      // Handle JSON request
      const { prompt: jsonPrompt, messages: jsonMessages } = await request.json();
      prompt = jsonPrompt || '';
      messages = jsonMessages || [];
    } else if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data request
      const formData = await request.formData();

      // Extract prompt and messages from form data
      prompt = formData.get('prompt') || '';
      const messagesJson = formData.get('messages');
      messages = messagesJson ? JSON.parse(messagesJson) : [];

      // Handle file uploads
      const files = formData.getAll('file'); // Get all files with the name 'file'
      for (const file of files) {
        if (file && typeof file === 'object' && file.name && file.stream) {
          // Validate file size (e.g., max 5MB)
          const MAX_SIZE = 5 * 1024 * 1024; // 5MB
          if (file.size > MAX_SIZE) {
            return json({ error: 'One of the files exceeds the 5MB limit.' }, { status: 400 });
          }

          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']; // Only allow JPEG, PNG images and PDFs
          if (!allowedTypes.includes(file.type)) {
            return json({ error: 'Unsupported file type detected. Only JPEG, PNG images, and PDFs are allowed.' }, { status: 400 });
          }

          // Generate a unique filename to avoid conflicts
          const fileExtension = path.extname(file.name);
          const filename = `${randomUUID()}${fileExtension}`;
          const filepath = path.join(UPLOAD_DIR, filename);

          // Save the original file
          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(filepath, buffer);

          // Generate the file URL and add to the array along with its type
          const fileUrl = `/uploads/${filename}`;
          fileUrls.push({ url: fileUrl, type: file.type });
        }
      }
    } else {
      // Unsupported Content-Type
      return json({ error: 'Unsupported Content-Type. Use application/json or multipart/form-data.' }, { status: 400 });
    }

    // Log incoming data for debugging
    console.log('Received prompt:', prompt);
    if (fileUrls.length > 0) {
      console.log('Received files:', fileUrls);
    }

    // Define the system message with instruction to use HTML
    const systemMessage = { 
      role: 'system', 
      content: `
You are a helpful assistant that conducts content reviews based strictly on the information provided in the documents uploaded by the student.

**Guidelines if you have received a single document:**
1. Style your responses as if you were a teacher.
2. **Do not ask any questions until at least one document is available.**
3. The information in the documents will be sent in as the role of the user, and the document is numbered in the same order in which they are uploaded. 
4. For each document, generate **no more than three questions** based solely on the information provided by the user.
5. Do not ask questions that cannot be answered by the content of the document.
6. Once the student has answered them—correctly or incorrectly—proceed to the next document.
7. **Do not use information from any external sources** to formulate questions.
8. Correct the student's responses based on the accuracy relative to the information provided in the uploaded documents.
9. If the student replies that they do not know the answer to the question, give them the answer.
10. At the end of the session, provide a **summary** highlighting areas the student should improve on based on their incorrect responses, and point out areas where they did well!.

**Guidelines if you have received a larger document (4000+ tokens): **
1. Style your responses as if you were a teacher.
2. Identify which slide the information is on

**Response Formatting:**
- Utilize headings, bullet points, bold text, and other HTML elements where appropriate for clarity and emphasis.
      `
    };
    console.log("message history: ", messages);

    // Initialize documents array for this request
    let documents = [];

    // If file URLs are provided, include them in the context
    if (fileUrls.length > 0) {
      for (let i = 0; i < fileUrls.length; i++) {
        const fileUrlObj = fileUrls[i];
        const { url: fileUrl, type: fileType } = fileUrlObj;

        if (fileType === 'image/jpeg' || fileType === 'image/png') {
          // **Image Text Extraction Section**
          const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl)); // Extract filename from URL
          console.log(`Constructed file path for OCR (Image ${i + 1}):`, filePath); // Log the file path

          // Check if the file exists before reading
          if (!fs.existsSync(filePath)) {
            console.error('Image file does not exist at path:', filePath);
            return json({ error: 'Uploaded image file not found on the server.' }, { status: 500 });
          }

          // Perform OCR to extract text from the image
          try {
            const { data: { text } } = await Tesseract.recognize(filePath, 'eng', { logger: m => console.log(m) });
            const imageText = text.trim();
            // Include the extracted text in the conversation using HTML formatting
            documents.push({ role: 'user', content: `<strong>Content from Slide ${i + 1}:</strong><br><p>${imageText}</p>` });
            console.log(`Image text extracted successfully for Image ${i + 1}.`);
          } catch (ocrError) {
            console.error('Error during OCR processing:', ocrError);
            return json({ error: 'Failed to extract text from one of the uploaded images.' }, { status: 500 });
          }
        } else if (fileType === 'application/pdf') {
          // **PDF Text Extraction Section**
          const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl)); // Extract filename from URL
          console.log(`Constructed file path for PDF Text Extraction (PDF ${i + 1}):`, filePath); // Log the file path

          // Check if the file exists before reading
          if (!fs.existsSync(filePath)) {
            console.error('PDF file does not exist at path:', filePath);
            return json({ error: 'Uploaded PDF file not found on the server.' }, { status: 500 });
          }

          // Perform PDF text extraction
          try {
            // Dynamic import to comply with ES Modules
            const { GetTextFromPDF } = await import('./pdfExport.js'); // Ensure the correct path and file extension
            const extractedSlides = await GetTextFromPDF(filePath); // Array of slides with slide numbers and text

            // Iterate through each slide and add to documents with slide number
            for (const slide of extractedSlides) {
              documents.push({ 
                role: 'user', 
                content: `<strong>Content from Slide ${slide.slide}:</strong><br><p>${slide.text}</p>` 
              });
            }

            console.log(`PDF text extracted successfully for PDF ${i + 1}.`);
          } catch (pdfError) {
            console.error('Error during PDF text extraction:', pdfError);
            return json({ error: 'Failed to extract text from one of the uploaded PDFs.' }, { status: 500 });
          }
        }
      }

      // Save documents to the session store
      sessionStore[sessionId].documents = sessionStore[sessionId].documents.concat(documents);

      // Trim documents if necessary
      sessionStore[sessionId].documents = trimDocuments(sessionStore[sessionId].documents);
    }

    console.log("Documents: ", sessionStore[sessionId].documents);

    // After parsing messages from the request, assign to messageHistory
    messageHistory = messages || [];

    // Save messages to the session store
    sessionStore[sessionId].messages = sessionStore[sessionId].messages.concat(messageHistory);

    // Trim messages if necessary
    sessionStore[sessionId].messages = trimMessages(sessionStore[sessionId].messages);

    // Initialize conversation messages
    let conversation = [
      systemMessage,
      ...sessionStore[sessionId].messages, // Only include trimmed message history
      ...sessionStore[sessionId].documents,
      { role: 'user', content: prompt }
    ];

    // Prepare the request body for OpenAI's API
    const body = {
      model: 'gpt-4o',
      messages: conversation,
      temperature: 0.3,
      max_tokens: 4000,
      // You can add more parameters as needed
    };

    // Send the request to OpenAI's API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    // Log OpenAI's response status
    console.log('OpenAI response status:', response.status);

    // Check if the API response is successful
    if (!response.ok) { 
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API Error: ${errorData.error.message}`);
    }

    const data = await response.json();

    // Log the AI's reply for debugging
    console.log('AI Reply:', data.choices[0].message.content);

    // Optionally, update the session messages with the latest prompt and response
    sessionStore[sessionId].messages = sessionStore[sessionId].messages.concat([
      { role: 'user', content: prompt },
      { role: 'assistant', content: data.choices[0].message.content }
    ]);

    // Trim messages again after adding the latest interaction
    sessionStore[sessionId].messages = trimMessages(sessionStore[sessionId].messages);

    // Return the AI's reply along with the sessionId for client-side tracking
    return json({ 
      reply: data.choices[0].message.content,
      sessionId // Ensure the client uses this sessionId in subsequent requests
    });
  } catch (error) {
    // Log the error for debugging
    console.error('Server Error:', error.message);
    // Return error response with detailed message
    return json({ error: error.message }, { status: 500 });
  }
};
