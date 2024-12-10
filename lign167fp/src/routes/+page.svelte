<!-- src/routes/+page.svelte -->
<script>
  import { afterUpdate, onDestroy } from 'svelte';

  let prompt = "";              // The user input for the prompt
  let messages = [];            // An array to store the conversation history
  let isLoading = false;        // A flag to show loading state
  let messageContainer;         // The container that holds the messages

  // Updated variables for multiple file uploads
  let selectedFiles = [];       // An array to hold selected files
  let previewUrls = [];         // An array to hold preview URLs for selected files
  let uploadError = '';         // Error message for file upload
  let uploadSuccess = false;    // Success flag for file upload

  const MAX_FILES = 5;          // Maximum number of files allowed
  const allowedTypes = ['image/jpeg', 'image/png']; // Allowed file types
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB per file

  // Function to handle file selection
  function handleFileChange(event) {
    const files = Array.from(event.target.files);
    let validFiles = [];
    let previews = [];
    let errorMessages = [];

    if (files.length > MAX_FILES) {
      errorMessages.push(`You can only upload up to ${MAX_FILES} images.`);
    }

    files.slice(0, MAX_FILES).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errorMessages.push(`Unsupported file type: ${file.name}`);
        return;
      }
      if (file.size > MAX_SIZE) {
        errorMessages.push(`File size exceeds 5MB: ${file.name}`);
        return;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    });

    if (errorMessages.length > 0) {
      uploadError = errorMessages.join(' ');
    } else {
      uploadError = '';
    }

    selectedFiles = validFiles;
    previewUrls = previews;
  }

  // Function to remove a selected file
  function removeFile(index) {
    // Revoke the object URL to free memory
    URL.revokeObjectURL(previewUrls[index]);

    selectedFiles.splice(index, 1);
    previewUrls.splice(index, 1);

    // Clear error if any
    uploadError = '';
  }

  // Function to send the user's prompt and files to the backend and get the AI's response
  async function sendPrompt() {
    if (!prompt.trim() && selectedFiles.length === 0) return; // Prevent sending if no prompt or files

    isLoading = true;
    uploadError = '';
    uploadSuccess = false;

    try {
      // Create a FormData object to handle multipart/form-data
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('messages', JSON.stringify(messages));

      // Append all selected files to the FormData
      selectedFiles.forEach(file => {
        formData.append('file', file);
      });

      // Send the prompt and files to the backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData, // Let the browser set the Content-Type to multipart/form-data
      });

      const data = await response.json();

      if (response.ok && data.reply) {
        // Add user prompt and AI reply to the conversation history
        messages = [
          ...messages,
          { role: 'user', content: prompt },
          { role: 'assistant', content: data.reply }
        ];
        uploadSuccess = true; // Set upload success flag if applicable
      } else if (data.error) {
        // Handle errors returned from the server
        messages = [
          ...messages,
          { role: 'system', content: `Error: ${data.error}` }
        ];
        uploadError = data.error;
      } else {
        // Handle generic errors
        messages = [
          ...messages,
          { role: 'system', content: "Sorry, something went wrong!" }
        ];
        uploadError = "Sorry, something went wrong!";
      }
    } catch (error) {
      // Handle unexpected errors
      messages = [
        ...messages,
        { role: 'system', content: `Unexpected Error: ${error.message}` }
      ];
      uploadError = error.message || 'An unexpected error occurred.';
    } finally {
      // Reset prompt and file input
      prompt = "";
      selectedFiles = [];
      previewUrls.forEach(url => URL.revokeObjectURL(url)); // Clean up preview URLs
      previewUrls = [];
      isLoading = false;
    }
  }

  // Handle the Enter key press to send the prompt
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();  // Prevent form submission on Enter key (avoid newline)
      sendPrompt();            // Trigger the sendPrompt function
    }
  }

  // Automatically scroll to the bottom of the container when new messages are added
  afterUpdate(() => {
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  });

  // Clean up object URLs on component destroy to prevent memory leaks
  onDestroy(() => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
  });
</script>

<style>
  /* Make sure the body and html fill the entire viewport */
  :global(html, body) {
    height: 100%;  /* Full height of the viewport */
    margin: 0;     /* Remove default margin */
    overflow: hidden;  /* Disable scrolling on the entire page */
    font-family: Arial, sans-serif;
  }

  .chat-container {
    max-width: 800px;
    margin: 20px auto;
    padding: 20px;
    background-color: #ffffff;
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
    color: #333333;
  }

  /* Adjust the message container */
  .message-container {
  flex-grow: 1;
  overflow-y: auto; 
  padding: 10px;
  max-height: 100%; 
  box-sizing: border-box; 
}

  /* Style for the "AI is thinking..." message */
  .loading {
    color: gray;
    text-align: center;
    margin-bottom: 10px;
  }

  /* Input and button styling */
  .chat-input {
    display: flex;
    flex-direction: column;
    gap: 10px; /* Space between textarea and button */
    margin-top: 10px;
  }

  textarea {
    width: 97.2%;
    padding: 10px;   /* Reduced padding for a more compact input box */
    border-radius: 5px;
    border: 1px solid #ccc;
    font-size: 14px;
    resize: none; /* Prevent resizing */
    height: 80px;  /* Set a specific height */
  }

  input[type="file"] {
    padding: 5px 0;
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
    font-size: 16px;
    transition: background-color 0.3s ease;
  }

  button:hover:not(:disabled) {
    background-color: #0056b3;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .user-message, .assistant-message {
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 10px;
    max-width: 80%;
    word-wrap: break-word;
  }

  .user-message {
    background-color: #e0f7fa;
    align-self: flex-end;
  }

  .assistant-message {
  background-color: #f1f8e9; /* light green */
  align-self: flex-start;
  padding: 10px; 
  border-radius: 5px; 
  width: auto; 
  max-width: 100%; 
  word-wrap: break-word; 
  white-space: pre-wrap; 
  box-sizing: border-box; 
  overflow: visible;
}


  /* Styles for file previews and status messages */
  .previews {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
  }

  .preview {
    position: relative;
    width: 150px;
    height: 150px;
    border: 1px solid #ccc;
    border-radius: 5px;
    overflow: hidden;
    background-color: #f9f9f9;
  }

  .preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-button {
    position: absolute;
    top: 5px;
    right: 5px;
    background-color: rgba(255, 0, 0, 0.7);
    border: none;
    color: white;
    border-radius: 50%;
    width: 25px;
    height: 25px;
    cursor: pointer;
    font-weight: bold;
    line-height: 25px;
    text-align: center;
  }

  .upload-status {
    margin-top: 10px;
    font-weight: bold;
    color: green;
  }

  .error {
    margin-top: 10px;
    font-weight: bold;
    color: red;
  }
</style>

<div class="chat-container">
  <h1>SvelteGPT - Your AI Tutor</h1>

  <!-- Displaying the conversation messages -->
  <div class="message-container" bind:this={messageContainer}>
    {#each messages as { role, content }}
    <div class={role === 'user' ? 'user-message' : 'assistant-message'}>
    <strong>{role === 'user' ? 'You' : 'Tutor'}:</strong>
    <pre>{content}</pre>
  </div>
{/each}

  </div>

  <!-- Loading state message -->
  {#if isLoading}
    <p class="loading">The Tutor is thinking...</p>
  {/if}

  <!-- Chat Input Form -->
  <div class="chat-input">
    <form on:submit|preventDefault={sendPrompt}>
      <label for="prompt">Your question:</label>
      <textarea
        id="prompt"
        bind:value={prompt}
        placeholder="Ask your question here..."
        on:keydown={handleKeyPress}
      ></textarea>

      <!-- File Upload Section -->
      <label for="file">Attach images:</label>
      <input type="file" id="file" accept="image/jpeg,image/png" multiple on:change={handleFileChange} />

      <!-- Display Previews of Selected Files -->
      {#if previewUrls.length > 0}
        <div class="previews">
          {#each previewUrls as url, index}
            <div class="preview">
              <img src={url} alt={`Selected Image ${index + 1}`} />
              <button type="button" class="remove-button" on:click={() => removeFile(index)}>×</button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Upload Status Messages -->
      {#if uploadSuccess}
        <p class="upload-status">Files uploaded successfully!</p>
      {/if}

      {#if uploadError}
        <p class="error">Error: {uploadError}</p>
      {/if}

      <button type="submit" disabled={isLoading || (prompt.trim() === "" && selectedFiles.length === 0)}>
        {isLoading ? 'Processing...' : 'Send'}
      </button>
    </form>
  </div>
</div>
