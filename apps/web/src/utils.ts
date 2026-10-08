export const isURL = (str:string) => {
  try {
    new URL(str);
    return true;
  }
  catch {
    return false;
  }
}

export const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "An unknown error occurred";
