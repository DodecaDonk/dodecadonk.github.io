// src/routes/api/chat/+server.js

import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private'; // Ensure your API key is set correctly
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Tesseract from 'tesseract.js'; // For OCR
import sharp from 'sharp'; // For image preprocessing (optional)


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
    let fileUrl = null;
    let imageText = '';

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

      // Handle file upload if present
      const file = formData.get('file');
      if (file && typeof file === 'object' && file.name && file.stream) {
        // Validate file size (e.g., max 5MB)
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
          return json({ error: 'File size exceeds the 5MB limit.' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png']; // Only allow JPEG and PNG images
        if (!allowedTypes.includes(file.type)) {
          return json({ error: 'Unsupported file type. Only JPEG and PNG images are allowed.' }, { status: 400 });
        }

        // Generate a unique filename to avoid conflicts
        const fileExtension = path.extname(file.name);
        const filename = `${randomUUID()}${fileExtension}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Optional: Preprocess the image (e.g., resize, grayscale)
        // Uncomment the following lines if you want to preprocess the image
        /*
        const imageBuffer = await file.arrayBuffer();
        const processedBuffer = await sharp(Buffer.from(imageBuffer))
          .resize(1024) // Resize to width 1024px, maintaining aspect ratio
          .grayscale() // Convert to grayscale
          .toBuffer();
        fs.writeFileSync(filepath, processedBuffer);
        */

        // If no preprocessing, save the original image
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filepath, buffer);

        // Generate the file URL
        fileUrl = `/uploads/${filename}`;
      }
    } else {
      // Unsupported Content-Type
      return json({ error: 'Unsupported Content-Type. Use application/json or multipart/form-data.' }, { status: 400 });
    }

    // Log incoming data for debugging
    console.log('Received prompt:', prompt);
    console.log('Received messages:', messages);
    if (fileUrl) {
      console.log('Received file URL:', fileUrl);
    }

    // Define the system message
    const systemMessage = { 
      role: 'system', 
      content: 'You are a helpful assistant. Use the information provided in the uploaded image to assist the user.' 
    };

    // Initialize conversation messages
    let conversation = [
      systemMessage,
      ...messages,
      { role: 'user', content: prompt }
    ];

    // If a file URL is provided, include it in the context
    if (fileUrl) {
      conversation.push({ role: 'system', content: `Referenced Image: ${fileUrl}` });

      // **Image Text Extraction Section**
      const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl)); // Extract filename from URL
      console.log('Constructed file path for OCR:', filePath); // Log the file path

      // Check if the file exists before reading
      if (!fs.existsSync(filePath)) {
        console.error('Image file does not exist at path:', filePath);
        return json({ error: 'Uploaded image file not found on the server.' }, { status: 500 });
      }

      // Perform OCR to extract text from the image
      try {
        // Optional: If you preprocessed the image with sharp, use the processed image
        // const processedImagePath = path.join(UPLOAD_DIR, `processed-${path.basename(fileUrl)}`);
        // const { data: { text } } = await Tesseract.recognize(processedImagePath, 'eng', { logger: m => console.log(m) });

        // Perform OCR on the original image
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng', { logger: m => console.log(m) });
        imageText = text.trim();

        // Include the extracted text in the conversation
        conversation.push({ role: 'system', content: `Image Content: ${imageText}` });
        console.log('Image text extracted successfully.');
      } catch (ocrError) {
        console.error('Error during OCR processing:', ocrError);
        return json({ error: 'Failed to extract text from the uploaded image.' }, { status: 500 });
      }
    }

    // Prepare the request body for OpenAI's API
    const body = {
      model: 'gpt-4',
      messages: conversation,
      temperature: 0.7,
      max_tokens: 1500,
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
