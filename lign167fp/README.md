# SvelteGPT

Your fact-checking tutor and feedback feeder!

## Node.js

This app requires the latest version of Node.js to run. [Install it from here!](https://nodejs.org/en)


## Running SvelteGPT

In the Windows terminal, ensure that you're in the directory where lign167fp is located. 

```bash
# install dependencies 
npm install
```

## API Key

Once you've installed dependencies, create a new .env file in the lign167fp folder and define `OPENAI_API_KEY = YOUR_API_KEY`.


## Running the app

After everything has been completed, run the following to start and open a page to SvelteGPT.

```bash
npm run dev -- --open
```

## Best Use Practices

The current working version of SvelteGPT is a work in progress, and some things may function incorrectly.

### For Both PDFs and Images
SvelteGPT extracts text with Tesseract for images and pdf-parse for PDFs, so it does not have vision to recognize the content of vivid imagery. For the best results possible, send in images/PDFs comprised mostly of typed/legible textual information. 

When answering questions, number the answer according to the question you are responding to. If you don't know the answer, type and send "I don't know". If you don't know any of the answers, type and send that you don't know any of them. 

Currently, SvelteGPT will ask a maximum of 10 questions for PDFs and 3 questions for single images. 

Currently, we don't support a clear history feature. If you want to start from scratch, refresh the webpage!

### For PDFs

If you wish to finish early, click on the 'Summarize' button to see your strengths and weaknesses regarding the document's contents.

You can ask specify which topic you'd like to focus on! Simply specify the topic you want when uploading the PDF. 

Want to the content of a certain slide? You can ask what the content of slide `NUMBER_HERE` is. SvelteGPT will then ask you if you want to answer some questions based on the content of that slide!
