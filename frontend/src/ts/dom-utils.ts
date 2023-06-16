/**
 * Safely gets an element by its id from the document.
 *
 * If an element with the ID is not found, an exception is thrown.
 *
 * @export
 * @param {string} id - The id to find
 * @return {HTMLElement} - The found element
 */
export function getElemById(id: string): HTMLElement {
  const res = document.getElementById(id);
  if (res == null) {
    throw Error('Malformed DOM. Cannot find elem ' + id);
  }
  return res;
}

/**
 * Gets all child elements of root with a speciic class.
 *
 * This wraps the HTMLCollectionOf, which is the return of
 * getElementsByClassName, in an array so that it is iterable.
 *
 * @export
 * @param {(HTMLElement | Document)} root - The root element to search
 * @param {string} name - The class name to find
 * @return {Array<HTMLElement>} - The list of found elements with the class
 */
export function getElemsByClass(root: HTMLElement | Document, name: string):
    Array<HTMLElement> {
  const coll = root.getElementsByClassName(name) as
      HTMLCollectionOf<HTMLElement>;
  return Array.from(coll);
}
/**
 * Gets all elements of root with a specific tag.
 *
 * This wraps the HTMLCollectionOf, which is the return of
 * getElementByTagName, in an array so that it is iterable.
 *
 * @export
 * @param {(HTMLElement | Document)} root - The root element to search
 * @param {string} tag - The tag name to find
 * @return {Array<HTMLElement>} - The list of found elements with the tag
 */
export function getElemsByTag(root: HTMLElement | Document, tag: string):
    Array<HTMLElement> {
  const coll = root.getElementsByTagName(tag) as HTMLCollectionOf<HTMLElement>;
  return Array.from(coll);
}

/**
  * Gets an element by its id inside the current widget layout
  *
  * The ids inside the widget are in the form:
  * <widget number>.<item>.<sub item>
  *
  * This function will prepend the widget number to the args passed in.
  * An example would be:
  *
  * this.getElem('foo', 'bar) would return an element with the ID
  * <widget number>.foo.bar
  *
  * @protected
  * @param {string} id - The ID
  * @param {...Array<string>} args - The list of args to append
  * @return {HTMLElement} - The element with the ID
  */
export function getElemWithId(id: string, ...args: Array<string>): HTMLElement {
  const fullId = [id].concat(args).join('.');
  return getElemById(fullId);
}
