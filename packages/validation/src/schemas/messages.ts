/** Schema messages are keys in the frontend's validation namespace. */
export const validationMessages = [
  "validation:invalidUpload",
  "validation:recordingRequired",
  "validation:recordingFormat",
  "validation:recordingEmpty",
  "validation:recordingTooLarge",
] as const;
export type ValidationMessage = (typeof validationMessages)[number];
export const isValidationMessage = (
  message: string,
): message is ValidationMessage =>
  validationMessages.includes(message as ValidationMessage);
