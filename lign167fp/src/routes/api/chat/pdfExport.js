// src/routes/api/chat/pdfExport.js

//ChatGPT was used to write the PDF extraction function.

import fs from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse'

/**
 * Extracts text from each page of a PDF file.
 * @param {string} filePath - The absolute path to the PDF file.
 * @returns {Promise<Array<{ slide: number, text: string }>>} - An array of objects containing slide numbers and their corresponding text.
 */
export async function GetTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer, {
            // Define a pagerender function to extract text per page
            pagerender: async (pageData) => {
                const textContent = await pageData.getTextContent();
                const strings = textContent.items.map(item => item.str);
                return strings.join(' ');
            }
        });

        // `data.numpages` provides the total number of pages
        const numPages = data.numpages;
        const slides = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pageData = await pdfParse(dataBuffer, { pagerender: async (page) => {
                if (page.pageIndex + 1 !== pageNum) return '';
                const textContent = await page.getTextContent();
                const strings = textContent.items.map(item => item.str);
                return strings.join(' ');
            }});
            slides.push({
                slide: pageNum,
                text: pageData.text.trim()
            });
        }

        return slides;

    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw error;
    }
}
