<!-- src/routes/+page.svelte -->
<script>
  import { afterUpdate, onDestroy, onMount } from 'svelte';

  let prompt = "";              // The user input for the prompt
  let messages = [];            // An array to store the conversation history
  let isLoading = false;        // A flag to show loading state
  let messageContainer;         // The container that holds the messages

  // Variables for multiple file uploads
  let selectedFiles = [];       // An array to hold selected files
  let previewUrls = [];         // An array to hold preview URLs for selected files
  let uploadError = '';         // Error message for file upload
  let uploadSuccess = false;    // Success flag for file upload
  let hasContentSent = false;   // Detects if files have been uploaded for summarize button

  const MAX_FILES = 5;          // Maximum number of files allowed
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']; // Allowed file types
  let fileValue = '';           // Bindings for clearing the file upload text
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file

  // Function to handle file selection
  function handleFileChange(event) {
    const files = Array.from(event.target.files);
    let validFiles = [];
    let previews = [];
    let errorMessages = [];

    if (files.length > MAX_FILES) {
      errorMessages.push(`You can only upload up to ${MAX_FILES} files.`);
    }

    files.slice(0, MAX_FILES).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errorMessages.push(`Unsupported file type: ${file.name}. Allowed types are JPEG, PNG, and PDF.`);
        return;
      }
      if (file.size > MAX_SIZE) {
        errorMessages.push(`File size exceeds 10MB: ${file.name}`);
        return;
      }
      validFiles.push(file);
      if (file.type.startsWith('image/')) {
        previews.push({ url: URL.createObjectURL(file), type: 'image' });
      } else if (file.type === 'application/pdf') {
        previews.push({ url: URL.createObjectURL(file), type: 'pdf' });
      }
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
    URL.revokeObjectURL(previewUrls[index].url);

    selectedFiles.splice(index, 1);
    previewUrls.splice(index, 1);

    // Clear error if any
    uploadError = '';
  }

  // Function to convert Markdown-like syntax to HTML tags
  function formatMessage(content) {
    // Replace **text** with <strong>text</strong>
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Replace `text` with <code>text</code>
    content = content.replace(/`(.*?)`/g, '<code>$1</code>');

    // Replace ### Header with <qheader>Header</qheader>
    content = content.replace(/###(.*?)(?=\n|$)/g, '<qheader>$1</qheader>');

    // Remove remaining # characters
    content = content.replace(/#+/g, '');
    return content;
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

      // Detects if files have been uploaded
      const hasFiles = selectedFiles.length > 0;

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

        uploadSuccess = hasFiles; // Set upload success flag if applicable
        hasContentSent = true;
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
      previewUrls.forEach(file => URL.revokeObjectURL(file.url)); // Clean up preview URLs
      previewUrls = [];
      isLoading = false;
      fileValue = ''; // Clear the file input
    }
  }

  // Function to send a summary message to the tutor
  async function sendSummary() {
    const summaryPrompt = "I am done answering questions, give me a summary";
    if (!summaryPrompt.trim() && selectedFiles.length === 0) return; // Prevent sending if no prompt or files

    isLoading = true;
    uploadError = '';
    uploadSuccess = false;

    try {
      // Create a FormData object to handle multipart/form-data
      const formData = new FormData();
      formData.append('prompt', summaryPrompt);
      formData.append('messages', JSON.stringify(messages));

      // Append all selected files to the FormData (if any)
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
          { role: 'user', content: summaryPrompt },
          { role: 'assistant', content: data.reply }
        ];
        hasContentSent = true;
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
      previewUrls.forEach(file => URL.revokeObjectURL(file.url)); // Clean up preview URLs
      previewUrls = [];
      isLoading = false;
      fileValue = ''; // Clear the file input
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
    previewUrls.forEach(file => URL.revokeObjectURL(file.url));
  });
</script>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Open+Sans&family=Spinnaker&display=swap');

  /* Make sure the body and html fill the entire viewport */
  :global(html, body) {
    height: 100%;  /* Full height of the viewport */
    margin: 0;     /* Remove default margin */
    overflow: hidden;  /* Disable scrolling on the entire page */
    font-family: Arial, sans-serif;
  }

  .chat-container {
    max-width: 70%;
    margin: 40px auto;
    padding: 20px;
    background-color: #ffffff;
    border-radius: 10px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column; 
    height: 80vh; 
    padding-bottom: 20px;
  }

  /* Center the title */
  h1 {
    text-align: center; /* Center the title text */
    margin-bottom: 20px; /* Add some spacing below the title */
    color: #333333;
    font-family: "Josefin Sans", sans-serif;
  }

  /* Adjust the message container */
  .message-container {
    flex-grow: 1;
    overflow-y: auto; 
    overflow-x: hidden;
    padding: 10px;
    max-height: 100%;
    box-sizing: border-box; 
    max-width: 100%;
    white-space: normal;
  }

  .user-message, .assistant-message {
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 10px;
    max-width: 90%; 
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .user-message {
    background-color: #e0f7fa;
    align-self: flex-end;
  }

  .assistant-message {
    background-color: #f1f8e9; /* light green */
    align-self: flex-start;
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

  button[type="summarize"] {
    background-color: #a1e6b1; /* Green color */
    color: white;
    padding: 10px 20px;
    border: none;
    cursor: pointer;
    border-radius: 5px;
    width: 100%;
    height: 40px;
    font-size: 16px;
    transition: background-color 0.3s ease;
    margin-top: 10px; /* Add some margin for spacing */
  }

  /* Hover effect when the button is not disabled */
  button[type="summarize"]:hover {
    background-color: #218838; /* Darker green on hover */
  }

  /* Style for the disabled button */
  button[type="summarize"]:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  button[type="summarize"]:hover:not(:disabled) {
    background-color: #16a400;
  }

  textarea {
    width: 100%;
    padding: 10px;   /* Reduced padding for a more compact input box */
    border-radius: 5px;
    border: 1px solid #ccc;
    font-size: 14px;
    resize: none; /* Prevent resizing */
    height: 80px;  /* Set a specific height */
    box-sizing: border-box;
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

  .preview iframe {
    width: 100%;
    height: 100%;
  }

  .pdf-icon {
    width: 100%;
    height: 100%;
    background-color: #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #d32f2f;
    font-size: 24px;
  }

  .remove-button {
    position: absolute;
    top: 5px;
    right: 5px;
    background-color: rgba(255, 0, 0, 0.8);
    border: none;
    color: white;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-weight: bold;
    font-size: 20px;
    display: flex; 
    align-items: center; 
    justify-content: center; 
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

  pre {
    font-family: 'Lato', sans-serif;
    font-weight: 100;
    font-style: normal;
    color: #575757; /* Set the text color */
    padding: 10px; /* Add some padding inside the pre tag */
    border-radius: 5px; /* Add rounded corners */
    white-space: pre-wrap; /* Maintain line breaks and spaces but allow wrapping */
  }

  /* Customize bold text */
  strong {
    font-weight: bold; /* Ensure bold text stays bold */
  }

  /* Customize inline code */
  code {
    font-family: 'Courier New', monospace; /* Keep code in monospace */
    font-size: 30px !important;
    font-weight: bold;
    background-color: #e0e0e0;
    border-radius: 80%;
  }

</style>

<div class="chat-container">
  <h1>SvelteGPT - Your AI Tutor</h1>

  <!-- Displaying the conversation messages -->
  <div class="message-container" bind:this={messageContainer}>
    {#each messages as { role, content }}
      <div class={role === 'user' ? 'user-message' : 'assistant-message'}>
        <strong>{role === 'user' ? 'You' : 'Tutor'}:</strong>
        <pre>{@html formatMessage(content)}</pre> <!-- Use the formatted message -->
        <!-- Removed the duplicate raw content rendering -->
      </div>
    {/each}
  </div>

  <!-- Loading state message -->
  {#if isLoading}
    <p class="loading">thinking...</p>
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
      <div bind:this={uploadArea}>
        <label for="file">Attach images or PDFs:</label>
        <input
          type="file"
          bind:value={fileValue}
          id="file"
          accept="image/jpeg,image/png,application/pdf"
          multiple
          on:change={handleFileChange}
        />
      </div>

      <!-- Display Previews of Selected Files -->
      {#if previewUrls.length > 0}
        <div class="previews">
          {#each previewUrls as file, index}
            <div class="preview">
              {#if file.type === 'image'}
                <img src={file.url} alt={`Selected Image ${index + 1}`} />
              {:else if file.type === 'pdf'}
                <!-- Option 1: Display PDF using iframe -->
                <iframe src={file.url} title={`Selected PDF ${index + 1}`} sandbox></iframe>

                <!-- Option 2: Display a PDF icon -->
                <!-- <div class="pdf-icon">PDF</div> -->
              {/if}
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
      <button type="button" on:click={sendSummary} disabled={!hasContentSent}>
        Summarize
      </button>
    </form>
  </div>
</div>
