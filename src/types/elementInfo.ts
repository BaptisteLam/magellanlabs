export interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
  elementType?: string;
  isInteractive?: boolean;
  parentTree?: Array<{
    tagName: string;
    id?: string;
    classList: string[];
    isSemanticParent?: boolean;
  }>;
  semanticParent?: {
    tagName: string;
    id?: string;
    classList: string[];
  } | null;
  computedStyles?: {
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    display: string;
    position: string;
    padding: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
  boundingRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
}
