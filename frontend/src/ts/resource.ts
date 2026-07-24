/**
 * Corresponds to a text file
 */
export type Resource = {
  basename: string;
  contents: string;
}

/**
 * Corresponds to a list of Resources
 */
export type ResourceList = Array<Resource>;
