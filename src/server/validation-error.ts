/* Only deliberate input failures may expose their message to API clients.
 * Filesystem, parser and unexpected errors keep the generic server-error path.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
