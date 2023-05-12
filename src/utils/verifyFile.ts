export const verifyFile = (file: File) => {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];

  return validTypes.includes(file.type);
};
