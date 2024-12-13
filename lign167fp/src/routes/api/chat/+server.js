// ChatGPT was used to write the framework for the backend file server.js.

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

let documents = [];

const sessionStore = {}; // Key: sessionId, Value: { documents: [], messages: [] }

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

General Guidelines:
1. Role as a Teacher: Style your responses as if you were a teacher.
2. No Assumed Answers: Do not assume any questions have been answered unless the student explicitly provides answers.
3. Document Handling:
   - The information in the documents will be sent in as the role of the user, and the document is numbered in the same order in which they are uploaded.
   - Identify document types based on the provided indicators (e.g., "Content from Image #" or "Content from Slide #").
4. Response Formatting: 
   - Utilize headings, bullet points, bold text, and other HTML elements where appropriate for clarity and emphasis.
   - Ensure that responses are clear and structured for easy understanding.

Guidelines if you have received an image:
You will know if you have received an image as it will state "Content from Image #"
1. Initial Interaction: Do not ask any questions until at least one document is available.
2. Question Generation: For each document, generate **no more than three questions** based solely on the information provided by the user.
3. Relevance: 
   - Do not ask questions that cannot be answered by the content of the document.
   - Do not use information from any external sources to formulate questions.
4. Progression: Once the student has answered them—correctly or incorrectly—proceed to the next document.
5. Response to Answers:
   - Correct the student's responses based on the accuracy relative to the information provided in the uploaded documents.
   - If the student replies that they do not know the answer to the question, provide them with the correct answer.
6. Session Summary:
   - At the end of the session, provide a **summary** highlighting topics the student should improve on based on their incorrect responses, and point out topics where they did well.

Guidelines if you have received a PDF:
You will know if you have received a PDF as it will state "Content from Slide #"
1. Initial Interaction: Do not ask any questions until at least one document is available.
2. Question Structure:
   - Begin each question by displaying which slide the question comes from.
   - Skip slides that discuss URLs, news, reading guides, or reviews as specified.
3. Question Quantity:
   - If the student does not specify topics, prepare up to 10 questions related to the slides.
   - Ask 2-3 questions at a time, waiting for the student's response before proceeding.
   - Number the questions accordingly.
4. Topic-Specific Questions:
   - If the student specifies topics, focus on at least 4 questions related to those topics.
5. Answer Handling:
   - Do not ask questions that require the student to refer back to the slides.
   - Ensure questions can be answered from memory and reasoning alone.
   - Avoid keywords not defined in the slides.
6. Content Requests:
   - If the student asks for the content of a certain slide, provide a summary of that slide.
   - Offer to ask 2 questions based on the specified slide if the student agrees.
7. Session Summary:
   - Once all slides are exhausted, provide a summary of the student's progress based on incorrect answers.
   - Include slide numbers where the topics are discussed.
   - Recommend continued practice on topics where the student struggled, referencing the relevant slide numbers.
   - Highlight topics the student performed well on, specifying the corresponding slide numbers.
   - If the student chooses to end the session early, do not count unanswered questions and proceed to the summary.

Additional Instructions:
- State Management: Maintain an internal state to track which questions have been asked and whether they have been answered, ensuring no questions are marked as answered unless the student provides a response.
- Awaiting Responses: After presenting questions, wait for the student's answers before taking further actions. Do not assume or infer answers.
- No Premature Conclusions: Do not draw conclusions about the student's knowledge or progress until the session summary is initiated.
- Clarity and Precision: Ensure all communications are clear, concise, and free of ambiguity to facilitate effective learning and feedback.
- Explicit Acknowledgment: Only acknowledge and respond to answers that the student explicitly provides. Silence or lack of response should not be interpreted as an answer. "I am done answering questions, give me a summary of my work!" is not an answer to any of the questions asked.

Response Formatting:
- Utilize headings, bullet points, bold text, and other HTML elements where appropriate for clarity and emphasis.
      `
    };

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
            documents.push({ role: 'user', content: `<strong>Content from Image ${i + 1}:</strong><br><p>${imageText}</p>` });
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
    }


    // After parsing messages from the request, assign to messageHistory
    messageHistory = messages || [];

    // Save messages to the session store
    sessionStore[sessionId].messages = sessionStore[sessionId].messages.concat(messageHistory);

    // Initialize conversation messages
    let conversation = [
      systemMessage,
      ...sessionStore[sessionId].messages, // Only include trimmed message history
      ...documents,
      { role: 'user', content: prompt }
    ];
    
    console.log("Conversation to send: ", conversation);

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

    // Update the session messages with the latest prompt and response
    sessionStore[sessionId].messages = sessionStore[sessionId].messages.concat([
      { role: 'user', content: prompt },
      { role: 'assistant', content: data.choices[0].message.content }
    ]);

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
