// src/routes/api/chat/pdfExport.js

import fs from 'fs';
import pdfParse from 'pdf-parse/lib/pdf-parse'


/**
 * Extracts text from a PDF file.
 * @param {string} filePath - The absolute path to the PDF file.
 * @returns {Promise<string>} - The extracted text content.
 */
export async function GetTextFromPDF(filePath) {
    try {
        // Read the PDF file into a buffer
        const dataBuffer = fs.readFileSync(filePath);
        
        // Parse the PDF buffer to extract text
        const data = await pdfParse(dataBuffer);
        
        return data.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}
