/** Run the optional npm postinstall guidance without ever failing installation. */
export async function runOptionalPostinstall(task: () => void | Promise<void>): Promise<void> {
  try {
    await task();
  } catch {
    // Postinstall only prints guidance; installation must remain successful.
  }
}
