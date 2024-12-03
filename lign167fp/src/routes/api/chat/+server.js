// src/routes/api/chat/+server.js

import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';  // Ensure your API key is set correctly

export const POST = async ({ request }) => {
  try {
    // Parse the request body to extract prompt and messages
    const { prompt, messages } = await request.json();

    // Modify the system message to instruct the model to speak like a pirate
    const systemMessage = { 
      role: 'system', 
      content: 'You are a helpful assistant that conducts content review. This content review will be concerned with the information provided in the documents uploaded by the student, and these documents only. Do not answer the student\'s question unless there is at least one document available. You are not allowed to use information from other sources to answer this question, but outside information may be used to corroborate information provided in the document uploaded by the student. You will ask the student questions based off the information provided in the document uploaded by the student and correct their response based on the accuracy of their statement relative to the information provided in the uploaded documents. If the student shows any resistance to the answers provided, check the previous answer for any issues with inaccuracy. If the answer provided is correct, insist that it is. However, when answering trivial questions such as high-school level knowledge, you are permitted to answer without any documents.' 
    };

    // Prepare the request body to send to OpenAI's API
    const body = {
      model: 'gpt-4',  // You can use gpt-3.5-turbo or other models too
      messages: [
        systemMessage,  // Add the system message to guide the AI
        ...messages,    // Add any previous messages in the conversation
        { role: 'user', content: prompt }  // Add the current user prompt
      ]
    };

    // Send the request to OpenAI's API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`  // Bearer token authentication with your API key
      },
      body: JSON.stringify(body)
    });

    // Check if the API response is successful
    if (!response.ok) {
      throw new Error('Failed to fetch from OpenAI');
    }

    const data = await response.json();

    // Return the AI's reply
    return json({ reply: data.choices[0].message.content });
  } catch (error) {
    // Return error response if something goes wrong
    return json({ error: error.message }, { status: 500 });
  }
};
