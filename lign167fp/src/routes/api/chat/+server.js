import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';  // Ensure your API key is set correctly

export const POST = async ({ request }) => {
  try {
    // Parse the request body to extract prompt and messages
    const { prompt, messages } = await request.json();

    // Log incoming request for debugging
    console.log('Received prompt:', prompt);
    console.log('Received messages:', messages);

    // Define the system message
    const systemMessage = { 
      role: 'system', 
      content: 'You are a helpful assistant that conducts content review. This content review will be concerned with the information provided in the documents uploaded by the student, and these documents only. Do not answer the student\'s question unless there is at least one document available. You are not allowed to use information from other sources to answer this question, but outside information may be used to corroborate information provided in the document uploaded by the student. You will ask the student questions based off the information provided in the document uploaded by the student and correct their response based on the accuracy of their statement relative to the information provided in the uploaded documents. If the student shows any resistance to the answers provided, check the previous answer for any issues with inaccuracy. If the answer provided is correct, insist that it is. However, when answering trivial questions such as high-school level knowledge, you are permitted to answer without any documents.' 
    };

    // Prepare the request body for OpenAI's API
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        systemMessage,
        ...messages,
        { role: 'user', content: prompt }
      ]
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
