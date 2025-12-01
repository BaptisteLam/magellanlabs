import { parse, serialize } from 'parse5';
import { ASTModification, ASTModificationResult } from '@/types/ast';

interface Element {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: any[];
  parentNode?: any;
}

interface TextNode {
  nodeName: '#text';
  value: string;
  parentNode?: any;
}

interface Document {
  nodeName: '#document';
  childNodes?: any[];
}

function isElement(node: any): node is Element {
  return node.nodeName !== '#text' && node.nodeName !== '#comment';
}

function findElements(node: any, selector: string): Element[] {
  const results: Element[] = [];
  
  function traverse(n: any) {
    if (isElement(n)) {
      // Simple selector matching (tagName only for now)
      if (n.nodeName === selector || selector === '*') {
        results.push(n);
      }
      
      // Check class selector
      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        const classAttr = n.attrs?.find((attr: any) => attr.name === 'class');
        if (classAttr?.value.includes(className)) {
          results.push(n);
        }
      }
      
      // Check id selector
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        const idAttr = n.attrs?.find((attr: any) => attr.name === 'id');
        if (idAttr?.value === id) {
          results.push(n);
        }
      }
      
      if (n.childNodes) {
        n.childNodes.forEach(traverse);
      }
    }
  }
  
  traverse(node);
  return results;
}

export async function applyHTMLModifications(
  content: string,
  modifications: ASTModification[]
): Promise<ASTModificationResult> {
  try {
    const document = parse(content) as Document;
    let modificationsApplied = 0;

    for (const mod of modifications) {
      const { target, type, value, position } = mod;

      if (!target.selector) continue;

      const elements = findElements(document, target.selector);

      for (const element of elements) {
        if (type === 'update') {
          if (target.attribute && value !== undefined) {
            // Update attribute
            const attr = element.attrs?.find(a => a.name === target.attribute);
            if (attr) {
              attr.value = value;
              modificationsApplied++;
            } else {
              element.attrs = element.attrs || [];
              element.attrs.push({ name: target.attribute, value });
              modificationsApplied++;
            }
          } else if (value !== undefined) {
            // Update text content
            const textNode: TextNode = {
              nodeName: '#text',
              value,
              parentNode: element,
            };
            element.childNodes = [textNode];
            modificationsApplied++;
          }
        } else if (type === 'delete') {
          if (target.attribute) {
            // Delete attribute
            element.attrs = element.attrs?.filter(a => a.name !== target.attribute);
            modificationsApplied++;
          } else {
            // Delete element
            const parent = element.parentNode as any;
            if (parent?.childNodes) {
              parent.childNodes = parent.childNodes.filter((n: any) => n !== element);
              modificationsApplied++;
            }
          }
        } else if (type === 'insert' && value) {
          // Insert HTML content
          const fragment = parse(value) as Document;
          const newNodes = (fragment as any).childNodes || [];
          
          if (position === 'before' && element.parentNode) {
            const parent = element.parentNode as any;
            const index = parent.childNodes.indexOf(element);
            parent.childNodes.splice(index, 0, ...newNodes);
            modificationsApplied++;
          } else if (position === 'after' && element.parentNode) {
            const parent = element.parentNode as any;
            const index = parent.childNodes.indexOf(element);
            parent.childNodes.splice(index + 1, 0, ...newNodes);
            modificationsApplied++;
          } else if (position === 'inside' || position === 'append') {
            element.childNodes = element.childNodes || [];
            element.childNodes.push(...newNodes);
            modificationsApplied++;
          } else if (position === 'prepend') {
            element.childNodes = element.childNodes || [];
            element.childNodes.unshift(...newNodes);
            modificationsApplied++;
          }
        }
      }
    }

    if (modificationsApplied === 0) {
      return {
        success: false,
        error: 'No modifications were applied',
      };
    }

    const modifiedContent = serialize(document as any);
    return {
      success: true,
      modifiedContent,
      modificationsApplied,
    };
  } catch (error) {
    console.error('HTML AST modification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown HTML parsing error',
    };
  }
}
