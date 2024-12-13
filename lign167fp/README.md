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

Once you've installed dependencies, create a new .env file in the lign167fp folder and define `OPENAI_API_KEY` as the API key provided to you.

## Running the app

After everything has been completed, run the following to start and open a page to SvelteGPT.

```bash
npm run dev -- --open
```

## Best Use Practices

SvelteGPT is capable of a great deal of things - but just like Google, it is capable of even more when used in an intended manner.

The current working version of SvelteGPT is a work in progress, and some things are expected to function incorrectly. Refer to the project write up to learn more!

SvelteGPT extracts text with Tesseract for images and pdf-parse for PDFs, so it does not have vision to recognize the content of vivid imagery. For the best results possible, send in images/PDFs with information that is text, rather than image, heavy