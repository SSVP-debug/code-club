import { getDriver } from "./languageDrivers/index.js";
import { generateCOperationSequence } from "./cOperationSequenceDriver.js";

export function generateOperationSequenceDriver(language,userCode,shape,className,resultMode='all'){
  const {constructorArgs,opNames,opArgsList}=shape;
  if(language==='c')return generateCOperationSequence({userCode,className,constructorArgs,opNames,opArgsList,resultMode});
  const driver=getDriver(language);if(!driver)throw new Error(`Unsupported language: ${language}`);
  return driver.generateOperationSequence({userCode,className,constructorArgs,opNames,opArgsList,resultMode});
}
