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

export const POST = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    let prompt = '';
    let messages = [];
    let fileUrls = []; // Array to store multiple file URLs
    let imageTexts = []; // Array to store extracted text from images
    let messageHistory = [];

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
          const allowedTypes = ['image/jpeg', 'image/png']; // Only allow JPEG and PNG images
          if (!allowedTypes.includes(file.type)) {
            return json({ error: 'Unsupported file type detected. Only JPEG and PNG images are allowed.' }, { status: 400 });
          }

          // Generate a unique filename to avoid conflicts
          const fileExtension = path.extname(file.name);
          const filename = `${randomUUID()}${fileExtension}`;
          const filepath = path.join(UPLOAD_DIR, filename);

          // Save the original image
          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(filepath, buffer);

          // Generate the file URL and add to the array
          const fileUrl = `/uploads/${filename}`;
          fileUrls.push(fileUrl);
        }
      }
    } else {
      // Unsupported Content-Type
      return json({ error: 'Unsupported Content-Type. Use application/json or multipart/form-data.' }, { status: 400 });
    }

    // Log incoming data for debugging
    console.log('Received prompt:', prompt);
    console.log('Received messages:', messages);
    if (fileUrls.length > 0) {
      console.log('Received file URLs:', fileUrls);
    }

    // Define the system message with instruction to use HTML
    const systemMessage = { 
      role: 'system', 
      content: `
You are a helpful assistant that conducts content reviews based strictly on the information provided in the documents uploaded by the student.

**Guidelines:**
1. Style your responses as if you were a teacher.
2. **Do not ask any questions until at least one document is available.**
3. After a document or a group of documents has been uploaded, confirm if there will be any more.
4. For each document, generate **no more than four questions** based solely on its content.
5. Do not ask all questions at once. Ask two to four questions per document, depending on how much content is available, and once the student has answered them—correctly or incorrectly—proceed to the next document.
6. **Do not use information from any external sources** to formulate questions.
7. Correct the student's responses based on the accuracy relative to the information provided in the uploaded documents.
8. If the student shows any resistance to the answers provided, review the previous answer for any inaccuracies. If the answer provided is correct, firmly reaffirm its correctness.
9. At the end of the session, provide a **summary** highlighting areas the student should improve on based on their incorrect responses, and point out areas where they did well!.

**Response Formatting:**
- Utilize headings, bullet points, bold text, and other HTML elements where appropriate for clarity and emphasis.
      `
    };

    // Initialize conversation messages
    let conversation = [
      systemMessage,
      ...messageHistory,
      ...messages,
      { role: 'user', content: prompt }
    ];

    // If file URLs are provided, include them in the context
    if (fileUrls.length > 0) {
      for (let i = 0; i < fileUrls.length; i++) {
        const fileUrl = fileUrls[i];
        // Include the document image
        conversation.push({ role: 'system', content: `<img src="${fileUrl}" alt="Document ${i + 1}">` });

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
          imageTexts.push(imageText);

          // Include the extracted text in the conversation using HTML formatting
          conversation.push({ role: 'system', content: `<strong>Content from Document ${i + 1}:</strong><br><p>${imageText}</p>` });
          console.log(`Image text extracted successfully for Image ${i + 1}.`);
        } catch (ocrError) {
          console.error('Error during OCR processing:', ocrError);
          return json({ error: 'Failed to extract text from one of the uploaded images.' }, { status: 500 });
        }
      }
    }
    // Prepare the request body for OpenAI's API
    const body = {
      model: 'gpt-4',
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

    // Return the AI's reply
    return json({ reply: data.choices[0].message.content });
  } catch (error) {
    // Log the error for debugging
    console.error('Server Error:', error.message);
    // Return error response with detailed message
    return json({ error: error.message }, { status: 500 });
  }
};
