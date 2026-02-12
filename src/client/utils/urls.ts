export const  urlIsOK = (url:string, timeout:number = 10000) : Promise<boolean> => {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Set a timeout to abort the fetch manually
    const timer = setTimeout(() => {
      controller.abort(); // Abort the request
      resolve(false); // Resolve with false
    }, timeout);

    fetch(url, { signal })
      .then(response => {
        clearTimeout(timer);
        if (!response.ok) {
            resolve(false);
        } else {
          resolve(true);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false); // Resolve with false on error
      });
  });
}
