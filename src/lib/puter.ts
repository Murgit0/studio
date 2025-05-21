
'use client';

/**
 * @fileOverview Puter SDK Initialization.
 * This file provides a way to get an instance of the Puter SDK.
 * It's marked as a client component because Puter SDK interacts with the browser environment.
 */

import Puter from 'puter-sdk';

let puterInstance: Puter | null = null;

/**
 * Initializes and/or returns an instance of the Puter SDK.
 * If NEXT_PUBLIC_PUTER_CLIENT_ID is set in the environment,
 * it will be used to initialize the SDK, enabling OAuth flows if needed.
 * Otherwise, a default Puter instance is created, suitable for apps running
 * within the Puter environment.
 *
 * @returns {Puter} The Puter SDK instance.
 */
export function getPuterInstance(): Puter {
  if (!puterInstance) {
    const clientId = process.env.NEXT_PUBLIC_PUTER_CLIENT_ID;
    if (clientId) {
      console.log('Initializing Puter SDK with Client ID.');
      puterInstance = new Puter({ clientId });
    } else {
      console.log('Initializing Puter SDK without Client ID (default).');
      puterInstance = new Puter();
    }
  }
  return puterInstance;
}

// Example of how you might use it (optional, for demonstration):
// if (typeof window !== 'undefined') { // Ensure it runs only on the client
//   const puter = getPuterInstance();
//   // You can now use the 'puter' instance, e.g.:
//   // puter.ui.showToast('Puter SDK loaded!');
//   // puter.fs.read('/path/to/file').then(content => console.log(content));
// }
