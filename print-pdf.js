import * as pdfLib from 'pdf-lib';
import {printer} from './public/print-pdf.js';
export {checkSnapshot} from './public/print-pdf.js';
export const makePrintPdf=printer(pdfLib);
