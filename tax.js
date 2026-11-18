export {validate} from './public/base-tax.js';
import {TaxReturn} from './public/return-model.js';
export const draft=answers=>new TaxReturn(answers).snapshot();
