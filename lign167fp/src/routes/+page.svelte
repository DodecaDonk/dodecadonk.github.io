<script>
    let prompt = "";              // The user input for the prompt
    let messages = [];            // An array to store the conversation history
    let isLoading = false;        // A flag to show loading state
    let messageContainer;         // The container that holds the messages
  
    // Function to send the user's prompt to the backend and get the AI's response
    async function sendPrompt() {
      isLoading = true;
  
      // Send the prompt and conversation context to the backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          messages: messages  // Send previous conversation context
        }),
      });
  
      const data = await response.json();
  
      // If the response contains a message, add it to the conversation
      if (data.reply) {
        messages = [
          ...messages,
          { role: 'user', content: prompt },
          { role: 'assistant', content: data.reply }
        ];
      } else {
        // Handle any errors
        messages = [
          ...messages,
          { role: 'system', content: "Sorry, something went wrong!" }
        ];
      }
  
      prompt = "";  // Clear the prompt input after sending
      isLoading = false;  // Reset the loading state
    }
  
    // Handle the Enter key press to send the prompt
    function handleKeyPress(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();  // Prevent form submission on Enter key (avoid newline)
        sendPrompt();  // Trigger the sendPrompt function
      }
    }
  
    // This function will automatically scroll to the bottom of the container when new messages are added
    import { afterUpdate } from 'svelte';
  
    // Scroll to the bottom of the message container after the messages are updated
    afterUpdate(() => {
      if (messageContainer) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
      }
    });
  </script>
  
  <style>
    /* Make sure the body and html fill the entire viewport */
    :global(html, body) {
      height: 100%;  /* Full height of the viewport */
      margin: 0;     /* Remove default margin */
      overflow: hidden;  /* Disable scrolling on the entire page */
    }
  
    .chat-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
      border-radius: 10px;
      box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column; /* Arrange items in a column */
      height: 80vh; /* Set full screen height */
      padding-bottom: 20px; /* Ensure there's space at the bottom */
    }
  
    /* Center the title */
    h1 {
      text-align: center; /* Center the title text */
      margin-bottom: 20px; /* Add some spacing below the title */
    }
  
    /* Adjust the message container */
    .message-container {
      flex-grow: 1; /* Allow the message container to take up remaining space */
      overflow-y: auto; /* Enable scrolling when messages overflow */
      max-height: 600px; /* Set a maximum height for the message container */
      margin-bottom: 20px;
      padding-bottom: 20px; /* Add space at the bottom of the messages */
    }
  
    /* Style for the "AI is thinking..." message */
    .loading {
      color: gray;
      text-align: center;
    }
  
    /* Input and button styling */
    .chat-input {
      display: flex;
      flex-direction: column;
      gap: 10px; /* Space between textarea and button */
      margin-top: 10px;
    }
  
    textarea {
      width: 97.3%;
      padding: 10px;   /* Reduced padding for a more compact input box */
      border-radius: 5px;
      border: 1px solid #ccc;
      font-size: 14px;
      resize: none; /* Prevent resizing */
      height: 40px;  /* Set a specific height */
    }
  
    button {
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border: none;
      cursor: pointer;
      border-radius: 5px;
      width: 100%;
      height: 40px;
    }
  
    button:disabled {
      background-color: #ccc;
    }
  
    .user-message {
      background-color: #e0f7fa;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 10px;
    }
  
    .assistant-message {
      background-color: #f1f8e9;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 10px;
    }
  </style>
  
  <div class="chat-container">
    <h1>SvelteGPT - Your AI Tutor</h1>
  
    <!-- Displaying the conversation messages -->
    <div class="message-container" bind:this={messageContainer}>
      {#each messages as { role, content }}
        <div class={role === 'user' ? 'user-message' : 'assistant-message'}>
          <strong>{role === 'user' ? 'You' : 'Tutor'}:</strong>
          <p>{content}</p>
        </div>
      {/each}
    </div>
  
    <!-- Loading state message -->
    {#if isLoading}
      <p class="loading">The Tutor is thinking...</p>
    {/if}
  
    <!-- Chat Input Form -->
    <div class="chat-input">
      <form method="POST" on:submit|preventDefault={sendPrompt}>
        <label for="prompt">Your question:</label>
        <textarea id="prompt" rows="4" bind:value={prompt} placeholder="Ask your question here..." on:keydown={handleKeyPress}></textarea>
        <button type="submit" disabled={isLoading || !prompt}>Send</button>
      </form>
    </div>
  </div>
  